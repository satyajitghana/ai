// Tokenizer + core + sampler = the engine behind the public API. Environment-agnostic.
import { MAX_BATCH, Qwen3Core, type KVStream } from "./core"
import { Tokenizer } from "./tokenizer"
import { GpuBackend } from "./gpu"
import type { ActivationsResult, ByteSource, Calibration, GenerateManyOptions, GenerateOptions, GenerateResult, ProgressFn, Steer } from "./types"

/** A fixed plain-English passage the residual norms are measured on when the site ships no calibration. */
export const CALIBRATION_PASSAGE =
  "The lighthouse keeper climbed the stairs each evening, counted the steps out of habit, and lit the lamp just as the last boat turned toward the harbour. " +
  "Below him the sea kept its own accounts: tides, currents, the slow wearing of the rock. He wrote the weather in a notebook, ate his supper standing at the window, " +
  "and listened to the radio until the static took over. In the morning there would be gulls, a delivery of oil and bread, and perhaps a letter from his daughter, " +
  "who lived in a city where nobody had ever needed to know which way the wind was blowing."

export const EOS_IDS = new Set([151645, 151643])
export const KEEP_ALL_MAX_TOKENS = 128

/** mulberry32: tiny, fast, and identical on every platform. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Temperature 0 (or topK 1) is greedy. Otherwise sample from softmax(logits / T) over the top-k. */
export function sampleToken(logits: Float32Array, temperature: number, topK: number, rand: () => number): number {
  const n = logits.length
  if (temperature <= 0 || topK === 1) {
    let bi = 0, bv = -Infinity
    for (let i = 0; i < n; i++) if (logits[i] > bv) { bv = logits[i]; bi = i }
    return bi
  }
  const k = Math.max(1, Math.min(topK > 0 ? topK : 40, 256, n))
  const tv = new Float64Array(k).fill(-Infinity)
  const ti = new Int32Array(k)
  let cnt = 0
  for (let i = 0; i < n; i++) {
    const v = logits[i]
    if (cnt === k && v <= tv[k - 1]) continue
    let j = cnt < k ? cnt++ : k - 1
    while (j > 0 && tv[j - 1] < v) { tv[j] = tv[j - 1]; ti[j] = ti[j - 1]; j-- }
    tv[j] = v; ti[j] = i
  }
  let z = 0
  const p = new Float64Array(cnt)
  for (let j = 0; j < cnt; j++) { p[j] = Math.exp((tv[j] - tv[0]) / temperature); z += p[j] }
  let r = rand() * z
  for (let j = 0; j < cnt; j++) { r -= p[j]; if (r <= 0) return ti[j] }
  return ti[cnt - 1]
}

export type Backend = "cpu" | "webgpu"

export class Runtime {
  constructor(readonly core: Qwen3Core, readonly tok: Tokenizer) {}

  /** The WebGPU decode path, once enabled. The CPU path stays the default and the reference. */
  gpu: GpuBackend | null = null
  useGpu = false

  async setBackend(kind: Backend, onProgress?: ProgressFn): Promise<{ backend: Backend; adapter?: GpuBackend["info"] }> {
    if (kind === "cpu") { this.useGpu = false; return { backend: "cpu" } }
    if (!this.gpu) {
      this.gpu = await GpuBackend.create(this.core, onProgress)
      if (!this.gpu) throw new Error("WebGPU is not available in this browser")
    }
    this.useGpu = true
    return { backend: "webgpu", adapter: this.gpu.info }
  }

  /** Last-position logits on the GPU path (tests; generation uses it automatically once enabled). */
  async logitsGpu(prompt: string, steers: Steer[]): Promise<Float32Array> {
    const gpu = this.gpu
    if (!gpu) throw new Error("WebGPU backend not enabled")
    const ids = this.tok.encode(prompt)
    if (!ids.length) throw new Error("empty prompt")
    const st = gpu.newStream(ids.length + 1, this.core.buildDeltas(steers))
    try {
      for (let i = 0; i < ids.length - 1; i++) await gpu.step(st, ids[i], false)
      return (await gpu.step(st, ids[ids.length - 1], true))!
    } finally { gpu.freeStream(st) }
  }

  private async generateGpu(o: GenerateOptions, yieldFn?: () => Promise<void>): Promise<GenerateResult & { promptTokens: number; prefillMs: number }> {
    const gpu = this.gpu!
    const ids = this.tok.encode(o.prompt)
    if (!ids.length) throw new Error("empty prompt")
    const st = gpu.newStream(ids.length + o.maxNewTokens + 1, this.core.buildDeltas(o.steers))
    const rand = rng(o.seed)
    const dec = new TextDecoder("utf-8")
    let text = ""
    try {
      const t0 = performance.now()
      for (let i = 0; i < ids.length - 1; i++) await gpu.step(st, ids[i], false)
      let lg = (await gpu.step(st, ids[ids.length - 1], true))!
      const prefillMs = performance.now() - t0
      const t1 = performance.now()
      let n = 0
      for (; n < o.maxNewTokens; n++) {
        if (o.signal?.aborted) break
        const id = sampleToken(lg, o.temperature, o.topK, rand)
        if (this.core.eosIds.has(id)) break
        const piece = dec.decode(this.tok.tokenBytes(id), { stream: true })
        text += piece
        o.onToken(piece, { index: n })
        if (n + 1 >= o.maxNewTokens) { n++; break }
        lg = (await gpu.step(st, id, true))!
        if (yieldFn) await yieldFn()
      }
      const tail = dec.decode()
      if (tail) { text += tail; o.onToken(tail, { index: n }) }
      return { text, tokens: n, msPerToken: n ? (performance.now() - t1) / n : 0, promptTokens: ids.length, prefillMs }
    } finally { gpu.freeStream(st) }
  }

  private async generateManyGpu(o: GenerateManyOptions, yieldFn?: () => Promise<void>): Promise<(GenerateResult & { promptTokens: number })[]> {
    const gpu = this.gpu!
    const B = o.variants.length
    const ids = this.tok.encode(o.prompt)
    if (!ids.length) throw new Error("empty prompt")
    const streams = o.variants.map((v) => gpu.newStream(ids.length + o.maxNewTokens + 1, this.core.buildDeltas(v)))
    try {
      const cur: Float32Array[] = []
      for (let b = 0; b < B; b++) {
        for (let i = 0; i < ids.length - 1; i++) await gpu.step(streams[b], ids[i], false)
        cur.push((await gpu.step(streams[b], ids[ids.length - 1], true))!)
      }
      const rands = o.variants.map(() => rng(o.seed))
      const decs = o.variants.map(() => new TextDecoder("utf-8"))
      const text = o.variants.map(() => "")
      const n = o.variants.map(() => 0)
      const alive = o.variants.map(() => true)
      const t1 = performance.now()
      while (alive.some(Boolean)) {
        if (o.signal?.aborted) break
        for (let b = 0; b < B; b++) {
          if (!alive[b]) continue
          const id = sampleToken(cur[b], o.temperature, o.topK, rands[b])
          if (this.core.eosIds.has(id)) { alive[b] = false; continue }
          const piece = decs[b].decode(this.tok.tokenBytes(id), { stream: true })
          text[b] += piece
          o.onToken(b, piece, { index: n[b] })
          n[b]++
          if (n[b] >= o.maxNewTokens) { alive[b] = false; continue }
          cur[b] = (await gpu.step(streams[b], id, true))!
        }
        if (yieldFn) await yieldFn()
      }
      const ms = performance.now() - t1
      const tot = Math.max(1, ...n)
      return o.variants.map((_, b) => {
        const tail = decs[b].decode()
        if (tail) { text[b] += tail; o.onToken(b, tail, { index: n[b] }) }
        return { text: text[b], tokens: n[b], msPerToken: ms / tot, promptTokens: ids.length }
      })
    } finally { for (const s of streams) gpu.freeStream(s) }
  }

  static async create(src: ByteSource, tokenizerJson: unknown, onProgress?: ProgressFn): Promise<Runtime> {
    const core = await Qwen3Core.load(src, onProgress)
    return new Runtime(core, new Tokenizer(tokenizerJson as ConstructorParameters<typeof Tokenizer>[0]))
  }

  setCalibration(c: Calibration) { this.core.setCalibration(c) }

  /**
   * Measure what the steering recipe needs from the loaded model itself: the median norm of the residual stream
   * leaving each layer (tokens after the first, over a fixed reference passage) and each neuron's down_proj column
   * length. Takes a few seconds; used when the site ships no precomputed calibration for the model.
   */
  selfCalibrate(): Calibration {
    const ids = this.tok.encode(CALIBRATION_PASSAGE)
    const { nLayer, hidden } = this.core
    const norms: number[][] = Array.from({ length: nLayer }, () => [])
    this.core.reset()
    this.core.forward(ids, false, {
      onLayerOut: (l, x, t0, nTok) => {
        for (let t = 0; t < nTok; t++) {
          if (t0 + t === 0) continue
          let ss = 0
          for (let i = 0; i < hidden; i++) { const v = x[t * hidden + i]; ss += v * v }
          norms[l].push(Math.sqrt(ss))
        }
      },
    })
    const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
    return { resNormMedian: norms.map(median), colNorm: this.core.columnNorms() }
  }

  tokenize(text: string): number[] { return this.tok.encode(text) }

  /** Last-position logits after `prompt` under `steers` (a copy; safe to keep). */
  logits(prompt: string, steers: Steer[]): Float32Array {
    const ids = this.tok.encode(prompt)
    if (!ids.length) throw new Error("empty prompt")
    this.core.reset()
    const out = this.core.forward(ids, true, { deltas: this.core.buildDeltas(steers) })!
    return out.slice()
  }

  /** `all` is [token][layer][neuron] when the text is short enough to keep every activation. */
  activations(text: string): ActivationsResult & { all?: Float32Array } {
    const ids = this.tok.encode(text)
    const { nLayer, inter } = this.core
    const max = new Float32Array(nLayer * inter).fill(-Infinity)
    const keep = ids.length <= KEEP_ALL_MAX_TOKENS
    const all = keep ? new Float32Array(ids.length * nLayer * inter) : null
    this.core.reset()
    this.core.forward(ids, false, {
      onHidden: (l, h, t0, nTok) => {
        const base = l * inter
        for (let t = 0; t < nTok; t++) {
          const ro = t * inter
          for (let n = 0; n < inter; n++) { const v = h[ro + n]; if (v > max[base + n]) max[base + n] = v }
          if (all) all.set(h.subarray(ro, ro + inter), ((t0 + t) * nLayer + l) * inter)
        }
      },
    })
    return {
      tokens: ids.map((i) => this.tok.display(i)),
      max,
      all: all ?? undefined,
      byToken: all
        ? (layer: number, neuron: number) => {
            const out = new Float32Array(ids.length)
            for (let t = 0; t < ids.length; t++) out[t] = all[(t * nLayer + layer) * inter + neuron]
            return out
          }
        : undefined,
    }
  }

  /**
   * Decode several steered variants of one prompt together. Each variant's text is identical to what
   * generate() gives for it alone (same prefill, same sampler seed); the batch only shares the weight
   * reads, so three variants cost about 1.2-1.5x one.
   */
  async generateMany(o: GenerateManyOptions, yieldFn?: () => Promise<void>): Promise<(GenerateResult & { promptTokens: number })[]> {
    const B = o.variants.length
    if (B < 1 || B > MAX_BATCH) throw new Error(`1 to ${MAX_BATCH} variants`)
    if (this.useGpu && this.gpu) return this.generateManyGpu(o, yieldFn)
    const ids = this.tok.encode(o.prompt)
    if (!ids.length) throw new Error("empty prompt")
    const deltas = o.variants.map((v) => this.core.buildDeltas(v))
    const streams: KVStream[] = []
    const cur: Float32Array[] = []
    for (let b = 0; b < B; b++) {
      this.core.reset()
      const lg = this.core.forward(ids, true, { deltas: deltas[b] })!
      cur.push(lg.slice())
      streams.push(this.core.snapshotStream(o.maxNewTokens + 1))
    }
    const rands = o.variants.map(() => rng(o.seed))
    const decs = o.variants.map(() => new TextDecoder("utf-8"))
    const text = o.variants.map(() => "")
    const n = o.variants.map(() => 0)
    const alive = o.variants.map(() => true)
    const t1 = performance.now()
    while (alive.some(Boolean)) {
      if (o.signal?.aborted) break
      const nextIds: number[] = [], idx: number[] = []
      for (let b = 0; b < B; b++) {
        if (!alive[b]) continue
        const id = sampleToken(cur[b], o.temperature, o.topK, rands[b])
        if (this.core.eosIds.has(id)) { alive[b] = false; continue }
        const piece = decs[b].decode(this.tok.tokenBytes(id), { stream: true })
        text[b] += piece
        o.onToken(b, piece, { index: n[b] })
        n[b]++
        if (n[b] >= o.maxNewTokens) { alive[b] = false; continue }
        nextIds.push(id); idx.push(b)
      }
      if (!idx.length) break
      const lg = this.core.forwardBatch(nextIds, { streams: idx.map((b) => streams[b]), deltas: idx.map((b) => deltas[b]) })
      const V = this.core.vocab
      idx.forEach((b, k) => { cur[b] = lg.slice(k * V, (k + 1) * V) })
      if (yieldFn) await yieldFn()
    }
    const ms = performance.now() - t1
    const tot = Math.max(1, ...n)
    return o.variants.map((_, b) => {
      const tail = decs[b].decode()
      if (tail) { text[b] += tail; o.onToken(b, tail, { index: n[b] }) }
      return { text: text[b], tokens: n[b], msPerToken: ms / tot, promptTokens: ids.length }
    })
  }

  async generate(o: GenerateOptions, yieldFn?: () => Promise<void>): Promise<GenerateResult & { promptTokens: number; prefillMs: number }> {
    if (this.useGpu && this.gpu) return this.generateGpu(o, yieldFn)
    const ids = this.tok.encode(o.prompt)
    if (!ids.length) throw new Error("empty prompt")
    const deltas = this.core.buildDeltas(o.steers)
    const rand = rng(o.seed)
    const dec = new TextDecoder("utf-8")
    let text = ""
    this.core.reset()
    const t0 = performance.now()
    let lg = this.core.forward(ids, true, { deltas })!
    const prefillMs = performance.now() - t0
    const t1 = performance.now()
    let n = 0
    for (; n < o.maxNewTokens; n++) {
      if (o.signal?.aborted) break
      const id = sampleToken(lg, o.temperature, o.topK, rand)
      if (this.core.eosIds.has(id)) break
      const piece = dec.decode(this.tok.tokenBytes(id), { stream: true })
      text += piece
      o.onToken(piece, { index: n })
      if (n + 1 >= o.maxNewTokens) { n++; break }
      lg = this.core.forward([id], true, { deltas })!
      if (yieldFn) await yieldFn()
    }
    const tail = dec.decode()
    if (tail) { text += tail; o.onToken(tail, { index: n }) }
    return { text, tokens: n, msPerToken: n ? (performance.now() - t1) / n : 0, promptTokens: ids.length, prefillMs }
  }
}

/** Qwen3 chat template for one user turn (thinking off, as the instruct model expects). */
export function chatPrompt(user: string, system?: string): string {
  return (system ? `<|im_start|>system\n${system}<|im_end|>\n` : "") +
    `<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`
}
