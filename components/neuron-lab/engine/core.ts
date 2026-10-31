// Qwen3 / Qwen3.5 forward pass over Q8_0 weights, in WebAssembly SIMD (int8 x int8 dot products) plus
// plain JS for the cheap parts (RMSNorm, RoPE, attention, SwiGLU). No DOM, no Node APIs: the same
// file runs inside a Web Worker and under Node for the PyTorch parity tests.
import { KERNELS_WASM_BASE64 } from "./kernels-wasm"
import { GGML_F32, GGML_Q8_0, readGGUFHeader, type GGUFHeader } from "./gguf"
import type { ByteSource, Calibration, ProgressFn, Steer } from "./types"

const RESERVED = 1 << 20 // wasm stack + data live below this
const TC = 32 // tokens per prefill chunk
const STAGE_BLOCKS = 1 << 18 // Q8_0 blocks per read while loading (8.9 MB)
export const MAX_CTX = 2048
export const MAX_BATCH = 4 // streams decoded together (the three-column comparison uses 3)

interface Q8 { q: number; s: number; rows: number; k: number }
interface FullLayer {
  kind: "full"
  attnNorm: Float32Array; qNorm: Float32Array; kNorm: Float32Array; ffnNorm: Float32Array
  wq: Q8; wk: Q8; wv: Q8; wo: Q8; gate: Q8; up: Q8; down: Q8
}
/** Qwen3.5 Gated DeltaNet block: causal depthwise conv over [q|k|v], then a gated delta-rule recurrence per head. */
interface LinearLayer {
  kind: "linear"
  attnNorm: Float32Array; ffnNorm: Float32Array
  wqkv: Q8; wz: Q8; wa: Q8; wb: Q8; wout: Q8; gate: Q8; up: Q8; down: Q8
  convW: Float32Array // [convDim][convK], oldest tap first
  ssmA: Float32Array; dtBias: Float32Array; ssmNorm: Float32Array
}
type Layer = FullLayer | LinearLayer
interface Kernels {
  matmul_q8(w: number, ws: number, xq: number, xs: number, out: number, rows: number, k: number, t: number): void
  quantize_q8(x: number, q: number, s: number, nblocks: number): void
  repack_q8(src: number, dq: number, ds: number, nblocks: number): void
}

function b64(s: string): Uint8Array {
  if (typeof atob === "function") { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u }
  return Uint8Array.from((globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(s, "base64"))
}

/**
 * One independent sequence's state, so several steered variants of a prompt can be decoded in one pass:
 * a KV cache per full-attention layer and, for Gated DeltaNet layers, the conv window and the recurrent state.
 */
export interface KVStream { kc: Float32Array[]; vc: Float32Array[]; conv: Float32Array[]; rec: Float32Array[]; len: number; cap: number }
export interface BatchCtx { streams: KVStream[]; deltas: (NonNullable<StepHooks["deltas"]> | null)[] }

export interface StepHooks {
  /** Per layer: neuron indices and activation shifts to add to silu(gate)*up at every position. */
  deltas?: ({ n: Int32Array; d: Float32Array; mn?: Int32Array; mf?: Float32Array } | null)[]
  /** Called with each layer's hidden activations [T][intermediate] after any delta (for statistics). */
  onHidden?: (layer: number, h: Float32Array, t0: number, nTok: number) => void
  /** Called with the residual stream [T][hidden] leaving each layer, after the MLP (for calibration). */
  onLayerOut?: (layer: number, x: Float32Array, t0: number, nTok: number) => void
}
export type Arch = "qwen3" | "qwen35"

export class Qwen3Core {
  readonly arch: Arch
  readonly nLayer: number
  readonly hidden: number
  readonly inter: number
  readonly nHead: number
  readonly nKV: number
  readonly headDim: number
  readonly vocab: number
  readonly eps: number
  readonly theta: number
  /** Rotated dims per head (all of headDim for Qwen3; a quarter for Qwen3.5), rotate_half style. */
  readonly ropeDim: number
  /** Qwen3.5 full-attention layers: q_proj also emits a per-head output gate. */
  readonly qGate: boolean
  readonly isLinear: boolean[]
  readonly eosIds: Set<number>
  // Gated DeltaNet dimensions (0 for Qwen3)
  readonly convK: number; readonly dK: number; readonly dV: number; readonly nKH: number; readonly nVH: number
  readonly keyDim: number; readonly valueDim: number; readonly convDim: number
  calibration: Calibration | null = null
  private k!: Kernels
  private mem!: WebAssembly.Memory
  private layers: Layer[] = []
  private embd!: Q8
  private outNorm!: Float32Array
  // scratch (views into wasm memory)
  private pQin = 0; private pXq = 0; private pXs = 0
  private qin!: Float32Array; private oq!: Float32Array; private ok!: Float32Array; private ov!: Float32Array
  private og!: Float32Array; private ou!: Float32Array; private od!: Float32Array; private logitsV!: Float32Array; private logitsAll!: Float32Array
  private pOq = 0; private pOk = 0; private pOv = 0; private pOg = 0; private pOu = 0; private pOd = 0; private pLogits = 0
  private x!: Float32Array
  // KV cache
  private kc: Float32Array[] = []
  private vc: Float32Array[] = []
  private convState: Float32Array[] = []
  private recState: Float32Array[] = []
  private cap = 0
  len = 0
  private cosT: Float32Array | null = null
  private sinT: Float32Array | null = null
  private ropeCap = 0
  private invFreq!: Float64Array

  private constructor(h: GGUFHeader) {
    const m = h.meta
    const arch = m["general.architecture"]
    if (arch !== "qwen3" && arch !== "qwen35") throw new Error(`expected a qwen3 or qwen35 GGUF, got ${String(arch)}`)
    this.arch = arch
    const num = (k: string) => { const v = m[`${arch}.${k}`]; if (typeof v !== "number") throw new Error(`gguf missing ${arch}.${k}`); return v }
    const opt = (k: string, d: number) => { const v = m[`${arch}.${k}`]; return typeof v === "number" ? v : d }
    // the last block of a Qwen3.5 GGUF is the multi-token-prediction head: not part of the language model we run
    this.nLayer = num("block_count") - opt("nextn_predict_layers", 0)
    this.hidden = num("embedding_length")
    this.inter = num("feed_forward_length")
    this.nHead = num("attention.head_count")
    this.nKV = num("attention.head_count_kv")
    this.headDim = num("attention.key_length")
    this.eps = num("attention.layer_norm_rms_epsilon")
    this.theta = num("rope.freq_base")
    this.ropeDim = opt("rope.dimension_count", this.headDim)
    this.qGate = arch === "qwen35"
    const every = arch === "qwen35" ? num("full_attention_interval") : 1
    this.isLinear = Array.from({ length: this.nLayer }, (_, l) => arch === "qwen35" && (l + 1) % every !== 0)
    if (arch === "qwen35") {
      this.convK = num("ssm.conv_kernel"); this.dK = num("ssm.state_size"); this.nKH = num("ssm.group_count"); this.nVH = num("ssm.time_step_rank")
      this.dV = num("ssm.inner_size") / this.nVH
    } else { this.convK = this.dK = this.dV = this.nKH = this.nVH = 0 }
    this.keyDim = this.dK * this.nKH; this.valueDim = this.dV * this.nVH; this.convDim = 2 * this.keyDim + this.valueDim
    this.vocab = h.tensors.get("token_embd.weight")!.dims[1]
    this.eosIds = new Set<number>()
    for (const k of ["tokenizer.ggml.eos_token_id", "tokenizer.ggml.padding_token_id"]) if (typeof m[k] === "number") this.eosIds.add(m[k] as number)
  }

  static async load(src: ByteSource, onProgress?: ProgressFn): Promise<Qwen3Core> {
    const header = await readGGUFHeader(src)
    const c = new Qwen3Core(header)
    await c.init(src, header, onProgress)
    return c
  }

  private async init(src: ByteSource, h: GGUFHeader, onProgress?: ProgressFn) {
    const T = h.tensors
    const want: string[] = ["token_embd.weight", "output_norm.weight"]
    const ffnNorm = this.arch === "qwen35" ? "post_attention_norm.weight" : "ffn_norm.weight"
    const layerTensors = (l: number): string[] => this.isLinear[l]
      ? ["attn_norm.weight", ffnNorm, "attn_qkv.weight", "attn_gate.weight", "ssm_alpha.weight", "ssm_beta.weight", "ssm_out.weight", "ssm_conv1d.weight", "ssm_a", "ssm_dt.bias", "ssm_norm.weight", "ffn_gate.weight", "ffn_up.weight", "ffn_down.weight"]
      : ["attn_norm.weight", "attn_q_norm.weight", "attn_k_norm.weight", ffnNorm, "attn_q.weight", "attn_k.weight", "attn_v.weight", "attn_output.weight", "ffn_gate.weight", "ffn_up.weight", "ffn_down.weight"]
    for (let l = 0; l < this.nLayer; l++) for (const s of layerTensors(l)) want.push(`blk.${l}.${s}`)
    let q8Bytes = 0, totalBytes = 0
    for (const n of want) {
      const t = T.get(n)
      if (!t) throw new Error(`gguf is missing tensor ${n}`)
      if (t.type === GGML_Q8_0) { const el = t.dims[0] * t.dims[1]; q8Bytes += el + (el / 32) * 4 + 64 } else if (t.type !== GGML_F32) throw new Error(`tensor ${n} has unsupported type ${t.type}`)
      totalBytes += t.bytes
    }
    const qd0 = this.nHead * this.headDim * (this.qGate ? 2 : 1)
    const maxBlk = Math.max(this.inter, qd0, this.convDim, this.valueDim)
    const scratch = TC * (maxBlk * 4 * 6 + this.hidden * 4 * 8) + this.vocab * 4 * MAX_BATCH + STAGE_BLOCKS * 34 + (1 << 20)
    const pages = Math.ceil((RESERVED + q8Bytes + scratch) / 65536) + 1
    this.mem = new WebAssembly.Memory({ initial: pages, maximum: pages })
    const mod = await WebAssembly.instantiate(b64(KERNELS_WASM_BASE64) as BufferSource, { env: { memory: this.mem } })
    this.k = mod.instance.exports as unknown as Kernels
    let bump = RESERVED
    const alloc = (n: number) => { const p = bump; bump += (n + 63) & ~63; return p }
    const u8 = () => new Uint8Array(this.mem.buffer)
    const f32 = (p: number, n: number) => new Float32Array(this.mem.buffer, p, n)

    // scratch first (fixed size), weights after
    const hd = this.hidden, qd = this.nHead * this.headDim, kd = this.nKV * this.headDim, I = this.inter
    const wideIn = Math.max(I, qd, hd, this.valueDim)
    this.pQin = alloc(TC * wideIn * 4); this.qin = f32(this.pQin, TC * wideIn)
    this.pXq = alloc(TC * wideIn); this.pXs = alloc(TC * (wideIn / 32) * 4)
    const qs = this.qGate ? 2 * qd : qd, small = Math.max(kd, this.nVH)
    this.pOq = alloc(TC * qs * 4); this.oq = f32(this.pOq, TC * qs)
    this.pOk = alloc(TC * small * 4); this.ok = f32(this.pOk, TC * small)
    this.pOv = alloc(TC * small * 4); this.ov = f32(this.pOv, TC * small)
    const wideA = Math.max(I, this.convDim), wideB = Math.max(I, this.valueDim)
    this.pOg = alloc(TC * wideA * 4); this.og = f32(this.pOg, TC * wideA)
    this.pOu = alloc(TC * wideB * 4); this.ou = f32(this.pOu, TC * wideB)
    this.pOd = alloc(TC * hd * 4); this.od = f32(this.pOd, TC * hd)
    this.pLogits = alloc(this.vocab * 4 * MAX_BATCH); this.logitsAll = f32(this.pLogits, this.vocab * MAX_BATCH); this.logitsV = this.logitsAll.subarray(0, this.vocab)
    this.x = new Float32Array(TC * hd)
    const pStage = alloc(STAGE_BLOCKS * 34)

    let done = 0
    const loadQ8 = async (name: string): Promise<Q8> => {
      const t = T.get(name)!
      const k = t.dims[0], rows = t.dims[1]
      if (k % 32) throw new Error(`${name}: K=${k} is not a multiple of 32`)
      const nblk = (rows * k) / 32
      const q = alloc(rows * k), s = alloc(nblk * 4)
      for (let b = 0; b < nblk; b += STAGE_BLOCKS) {
        const c = Math.min(STAGE_BLOCKS, nblk - b)
        await src.read(t.offset + b * 34, new Uint8Array(this.mem.buffer, pStage, c * 34))
        this.k.repack_q8(pStage, q + b * 32, s + b * 4, c)
        done += c * 34
        onProgress?.(done / totalBytes, `unpacking ${name}`)
      }
      return { q, s, rows, k }
    }
    const loadF32 = async (name: string): Promise<Float32Array> => {
      const t = T.get(name)!
      const out = new Float32Array(t.bytes / 4)
      await src.read(t.offset, new Uint8Array(out.buffer))
      done += t.bytes
      return out
    }
    this.embd = await loadQ8("token_embd.weight")
    this.outNorm = await loadF32("output_norm.weight")
    for (let l = 0; l < this.nLayer; l++) {
      const p = `blk.${l}.`
      const ffnNormName = this.arch === "qwen35" ? "post_attention_norm.weight" : "ffn_norm.weight"
      if (this.isLinear[l]) {
        const L: Partial<LinearLayer> = { kind: "linear" }
        L.attnNorm = await loadF32(p + "attn_norm.weight")
        L.ffnNorm = await loadF32(p + ffnNormName)
        L.wqkv = await loadQ8(p + "attn_qkv.weight")
        L.wz = await loadQ8(p + "attn_gate.weight")
        L.wa = await loadQ8(p + "ssm_alpha.weight")
        L.wb = await loadQ8(p + "ssm_beta.weight")
        L.wout = await loadQ8(p + "ssm_out.weight")
        L.convW = await loadF32(p + "ssm_conv1d.weight")
        L.ssmA = await loadF32(p + "ssm_a")
        L.dtBias = await loadF32(p + "ssm_dt.bias")
        L.ssmNorm = await loadF32(p + "ssm_norm.weight")
        L.gate = await loadQ8(p + "ffn_gate.weight")
        L.up = await loadQ8(p + "ffn_up.weight")
        L.down = await loadQ8(p + "ffn_down.weight")
        this.layers.push(L as LinearLayer)
        this.convState[l] = new Float32Array(this.convDim * (this.convK - 1))
        this.recState[l] = new Float32Array(this.nVH * this.dK * this.dV)
      } else {
        const L: Partial<FullLayer> = { kind: "full" }
        L.attnNorm = await loadF32(p + "attn_norm.weight")
        L.qNorm = await loadF32(p + "attn_q_norm.weight")
        L.kNorm = await loadF32(p + "attn_k_norm.weight")
        L.ffnNorm = await loadF32(p + ffnNormName)
        L.wq = await loadQ8(p + "attn_q.weight")
        L.wk = await loadQ8(p + "attn_k.weight")
        L.wv = await loadQ8(p + "attn_v.weight")
        L.wo = await loadQ8(p + "attn_output.weight")
        L.gate = await loadQ8(p + "ffn_gate.weight")
        L.up = await loadQ8(p + "ffn_up.weight")
        L.down = await loadQ8(p + "ffn_down.weight")
        this.layers.push(L as FullLayer)
        this.convState[l] = new Float32Array(0)
        this.recState[l] = new Float32Array(0)
      }
    }
    void u8
    this.invFreq = new Float64Array(this.ropeDim / 2)
    for (let i = 0; i < this.invFreq.length; i++) this.invFreq[i] = Math.pow(this.theta, (-2 * i) / this.ropeDim)
    this.ensureCap(256)
    this.ensureRope(256)
  }

  /** ||W_down[:, n]|| for every layer and neuron (the length of the vector one unit of the neuron writes). */
  columnNorms(): number[][] {
    const out: number[][] = []
    const I = this.inter
    for (let l = 0; l < this.nLayer; l++) {
      const d = this.layers[l].down
      const q = new Int8Array(this.mem.buffer, d.q, d.rows * d.k), sc = new Float32Array(this.mem.buffer, d.s, (d.rows * d.k) / 32)
      const acc = new Float64Array(I)
      for (let r = 0; r < d.rows; r++) {
        const qo = r * I, so = r * (I >> 5)
        for (let n = 0; n < I; n++) { const v = q[qo + n] * sc[so + (n >> 5)]; acc[n] += v * v }
      }
      out.push(Array.from(acc, (v) => Math.sqrt(v)))
    }
    return out
  }

  setCalibration(c: Calibration) {
    if (c.resNormMedian.length !== this.nLayer || c.colNorm.length !== this.nLayer || c.colNorm[0].length !== this.inter)
      throw new Error("calibration does not match the model shape")
    this.calibration = c
  }

  /** Activation shift for a steer: dose x median||residual leaving L|| / ||W_down[:, n]||. */
  deltaFor(s: Steer): number {
    if (typeof s.delta === "number") return s.delta
    if (!this.calibration) throw new Error("steering needs calibration (meta.json: resNormMedian, colNorm)")
    if (!(s.layer >= 0 && s.layer < this.nLayer && s.neuron >= 0 && s.neuron < this.inter)) throw new Error(`no such neuron ${s.layer}.${s.neuron}`)
    return (s.dose * this.calibration.resNormMedian[s.layer]) / this.calibration.colNorm[s.layer][s.neuron]
  }

  buildDeltas(steers: Steer[]): NonNullable<StepHooks["deltas"]> {
    const per: ({ n: number[]; d: number[]; mn: number[]; mf: number[] } | null)[] = new Array(this.nLayer).fill(null)
    for (const s of steers) {
      if (s.mode === "mul") {
        // multiply mode: the activation of the neuron is scaled by `dose` (1 = unchanged, 0 = ablated)
        if (!(s.layer >= 0 && s.layer < this.nLayer && s.neuron >= 0 && s.neuron < this.inter)) throw new Error(`no such neuron ${s.layer}.${s.neuron}`)
        if (!Number.isFinite(s.dose)) throw new Error("multiply factor must be a number")
        if (s.dose === 1) continue
        const e = (per[s.layer] ??= { n: [], d: [], mn: [], mf: [] })
        e.mn.push(s.neuron); e.mf.push(s.dose)
        continue
      }
      if (!s.dose && typeof s.delta !== "number") continue
      const e = (per[s.layer] ??= { n: [], d: [], mn: [], mf: [] })
      e.n.push(s.neuron); e.d.push(this.deltaFor(s))
    }
    return per.map((e) => (e ? { n: Int32Array.from(e.n), d: Float32Array.from(e.d), mn: Int32Array.from(e.mn), mf: Float32Array.from(e.mf) } : null))
  }

  private ensureCap(n: number) {
    if (n > MAX_CTX) throw new Error(`context limit is ${MAX_CTX} tokens`)
    if (n <= this.cap) return
    let cap = Math.max(256, this.cap)
    while (cap < n) cap *= 2
    cap = Math.min(cap, MAX_CTX)
    const kd = this.nKV * this.headDim
    for (let l = 0; l < this.nLayer; l++) {
      if (this.isLinear[l]) { this.kc[l] = this.vc[l] = new Float32Array(0); continue }
      const nk = new Float32Array(cap * kd), nv = new Float32Array(cap * kd)
      if (this.kc[l]) { nk.set(this.kc[l].subarray(0, this.len * kd)); nv.set(this.vc[l].subarray(0, this.len * kd)) }
      this.kc[l] = nk; this.vc[l] = nv
    }
    this.cap = cap
  }

  private ensureRope(n: number) {
    if (n <= this.ropeCap) return
    const cap = Math.max(256, n)
    const half = this.ropeDim / 2
    const cs = new Float32Array(cap * half), sn = new Float32Array(cap * half)
    for (let p = 0; p < cap; p++) for (let i = 0; i < half; i++) { const a = p * this.invFreq[i]; cs[p * half + i] = Math.cos(a); sn[p * half + i] = Math.sin(a) }
    this.cosT = cs; this.sinT = sn; this.ropeCap = cap
  }

  reset() {
    this.len = 0
    for (let l = 0; l < this.nLayer; l++) if (this.isLinear[l]) { this.convState[l].fill(0); this.recState[l].fill(0) }
  }

  private rmsnorm(src: Float32Array, so: number, w: Float32Array, dst: Float32Array, dof: number, n: number) {
    let ss = 0
    for (let i = 0; i < n; i++) { const v = src[so + i]; ss += v * v }
    const r = 1 / Math.sqrt(ss / n + this.eps)
    for (let i = 0; i < n; i++) dst[dof + i] = src[so + i] * r * w[i]
  }

  private mm(w: Q8, outP: number, t: number) {
    this.k.matmul_q8(w.q, w.s, this.pXq, this.pXs, outP, w.rows, w.k, t)
  }
  private quant(k: number, t: number) { this.k.quantize_q8(this.pQin, this.pXq, this.pXs, (t * k) / 32) }

  /**
   * Run `ids` through the model starting at KV position this.len. Returns logits for the last token
   * when `wantLogits` is set (a view into wasm memory: copy before the next call).
   */
  forward(ids: ArrayLike<number>, wantLogits: boolean, hooks: StepHooks = {}): Float32Array | null {
    const n = ids.length
    this.ensureCap(this.len + n)
    this.ensureRope(this.len + n)
    let out: Float32Array | null = null
    for (let c0 = 0; c0 < n; c0 += TC) {
      const t = Math.min(TC, n - c0)
      const last = c0 + t >= n
      this.chunk(ids, c0, t, last && wantLogits, hooks)
      this.len += t
      if (last && wantLogits) out = this.logitsV
    }
    return out
  }

  /** Copy the KV cache built by forward() so a variant can keep decoding on its own (room for `extra` more tokens). */
  snapshotStream(extra: number): KVStream {
    const cap = this.len + extra
    if (cap > MAX_CTX) throw new Error(`context limit is ${MAX_CTX} tokens`)
    const kd = this.nKV * this.headDim
    const kc: Float32Array[] = [], vc: Float32Array[] = [], conv: Float32Array[] = [], rec: Float32Array[] = []
    for (let l = 0; l < this.nLayer; l++) {
      if (this.isLinear[l]) { kc.push(new Float32Array(0)); vc.push(new Float32Array(0)); conv.push(this.convState[l].slice()); rec.push(this.recState[l].slice()); continue }
      const nk = new Float32Array(cap * kd), nv = new Float32Array(cap * kd)
      nk.set(this.kc[l].subarray(0, this.len * kd)); nv.set(this.vc[l].subarray(0, this.len * kd))
      kc.push(nk); vc.push(nv); conv.push(new Float32Array(0)); rec.push(new Float32Array(0))
    }
    return { kc, vc, conv, rec, len: this.len, cap }
  }

  /** One decode step for several streams at once: stream b advances by ids[b]. Returns logits [B][vocab] (a view: copy before the next call). */
  forwardBatch(ids: number[], batch: BatchCtx): Float32Array {
    const B = ids.length
    if (B < 1 || B > MAX_BATCH || batch.streams.length !== B) throw new Error(`batch of ${B} streams (1..${MAX_BATCH})`)
    let mx = 0
    for (const s of batch.streams) { if (s.len + 1 > s.cap) throw new Error("stream is full"); mx = Math.max(mx, s.len + 1) }
    this.ensureRope(mx)
    this.chunk(ids, 0, B, true, {}, batch)
    for (const s of batch.streams) s.len++
    return this.logitsAll.subarray(0, B * this.vocab)
  }

  private lq = new Float32Array(0); private lk = new Float32Array(0); private lkv = new Float32Array(0); private lout = new Float32Array(0)

  /**
   * Gated DeltaNet block (Qwen3.5): x += out_proj(gated_rmsnorm(delta_rule(silu(causal_conv(in_proj(norm(x))))))).
   * The delta rule keeps S[h] (dK x dV) per value head: S = S*exp(g); S += k (x) beta*(v - S^T k); out = S^T q.
   */
  private linearMixer(l: number, L: LinearLayer, T: number, batch?: BatchCtx) {
    const hd = this.hidden, x = this.x, qin = this.qin
    const K = this.convK, cd = this.convDim, kdim = this.keyDim, vdim = this.valueDim, dK = this.dK, dV = this.dV
    const nVH = this.nVH, rep = this.nVH / this.nKH
    if (this.lq.length !== dK) { this.lq = new Float32Array(dK); this.lk = new Float32Array(dK); this.lkv = new Float32Array(dV); this.lout = new Float32Array(dV) }
    const lq = this.lq, lk = this.lk, kv = this.lkv, out = this.lout
    for (let t = 0; t < T; t++) this.rmsnorm(x, t * hd, L.attnNorm, qin, t * hd, hd)
    this.quant(hd, T)
    this.mm(L.wqkv, this.pOg, T); this.mm(L.wz, this.pOu, T); this.mm(L.wa, this.pOk, T); this.mm(L.wb, this.pOv, T)
    const mixed = this.og, z = this.ou, av = this.ok, bv = this.ov
    const invSqrtK = 1 / Math.sqrt(dK)
    for (let t = 0; t < T; t++) {
      const conv = batch ? batch.streams[t].conv[l] : this.convState[l]
      const S = batch ? batch.streams[t].rec[l] : this.recState[l]
      const mo = t * cd
      // causal depthwise conv over [previous K-1 inputs, this one], then silu; slide the window
      for (let c = 0; c < cd; c++) {
        const cur = mixed[mo + c], so = c * (K - 1), wo = c * K
        let acc = L.convW[wo + K - 1] * cur
        for (let j = 0; j < K - 1; j++) acc += L.convW[wo + j] * conv[so + j]
        for (let j = 0; j < K - 2; j++) conv[so + j] = conv[so + j + 1]
        conv[so + K - 2] = cur
        mixed[mo + c] = acc / (1 + Math.exp(-acc))
      }
      for (let h = 0; h < nVH; h++) {
        const kh = (h / rep) | 0
        const qo = mo + kh * dK, ko = mo + kdim + kh * dK, vo = mo + 2 * kdim + h * dV
        let qq = 0, kk = 0
        for (let i = 0; i < dK; i++) { const a = mixed[qo + i], b = mixed[ko + i]; qq += a * a; kk += b * b }
        const qsc = invSqrtK / Math.sqrt(qq + 1e-6), ksc = 1 / Math.sqrt(kk + 1e-6)
        for (let i = 0; i < dK; i++) { lq[i] = mixed[qo + i] * qsc; lk[i] = mixed[ko + i] * ksc }
        const beta = 1 / (1 + Math.exp(-bv[t * nVH + h]))
        const ap = av[t * nVH + h] + L.dtBias[h]
        const decay = Math.exp(L.ssmA[h] * (ap > 20 ? ap : Math.log1p(Math.exp(ap))))
        const so = h * dK * dV
        kv.fill(0)
        for (let i = 0; i < dK; i++) {
          const ro = so + i * dV, ki = lk[i]
          for (let j = 0; j < dV; j++) { const sv = S[ro + j] * decay; S[ro + j] = sv; kv[j] += sv * ki }
        }
        for (let j = 0; j < dV; j++) kv[j] = (mixed[vo + j] - kv[j]) * beta
        out.fill(0)
        for (let i = 0; i < dK; i++) {
          const ro = so + i * dV, ki = lk[i], qi = lq[i]
          for (let j = 0; j < dV; j++) { const sv = S[ro + j] + ki * kv[j]; S[ro + j] = sv; out[j] += sv * qi }
        }
        // gated RMSNorm over the value head: norm(out) * weight * silu(z)
        let ms = 0
        for (let j = 0; j < dV; j++) ms += out[j] * out[j]
        const r = 1 / Math.sqrt(ms / dV + this.eps)
        const zo = t * vdim + h * dV
        for (let j = 0; j < dV; j++) { const zz = z[zo + j]; qin[zo + j] = out[j] * r * L.ssmNorm[j] * (zz / (1 + Math.exp(-zz))) }
      }
    }
    this.quant(vdim, T)
    this.mm(L.wout, this.pOd, T)
    for (let i = 0; i < T * hd; i++) x[i] += this.od[i]
  }

  private chunk(ids: ArrayLike<number>, c0: number, T: number, wantLogits: boolean, hooks: StepHooks, batch?: BatchCtx) {
    const hd = this.hidden, nh = this.nHead, nkv = this.nKV, D = this.headDim, I = this.inter
    const qd = nh * D, kd = nkv * D
    const x = this.x, qin = this.qin
    const pos0 = this.len
    // embeddings
    {
      const mem = new Int8Array(this.mem.buffer)
      const sc = this.embd.s >> 2
      const f = new Float32Array(this.mem.buffer)
      for (let t = 0; t < T; t++) {
        const id = ids[c0 + t]
        const qo = this.embd.q + id * hd, so = sc + id * (hd / 32)
        for (let i = 0; i < hd; i++) x[t * hd + i] = mem[qo + i] * f[so + (i >> 5)]
      }
    }
    const group = nh / nkv
    const scale = 1 / Math.sqrt(D)
    const cos = this.cosT!, sin = this.sinT!
    const scores = new Float64Array(batch ? Math.max(...batch.streams.map((s) => s.len)) + 1 : this.len + T)
    const qs = this.qGate ? 2 * qd : qd // floats per token in the q projection (q, plus a per-head output gate on Qwen3.5)
    const qh = this.qGate ? 2 * D : D // floats per head in it
    const rhalf = this.ropeDim / 2
    for (let l = 0; l < this.nLayer; l++) {
      const L = this.layers[l]
      if (L.kind === "linear") this.linearMixer(l, L, T, batch)
      else {
        // ---- attention
        for (let t = 0; t < T; t++) this.rmsnorm(x, t * hd, L.attnNorm, qin, t * hd, hd)
        this.quant(hd, T)
        this.mm(L.wq, this.pOq, T); this.mm(L.wk, this.pOk, T); this.mm(L.wv, this.pOv, T)
        for (let t = 0; t < T; t++) {
          const p = batch ? batch.streams[t].len : pos0 + t
          const kc = batch ? batch.streams[t].kc[l] : this.kc[l], vc = batch ? batch.streams[t].vc[l] : this.vc[l]
          // q/k norm per head, then rope (rotate_half over the first ropeDim dims)
          for (let h = 0; h < nh; h++) {
            const o = t * qs + h * qh
            this.rmsnorm(this.oq, o, L.qNorm, this.oq, o, D)
            const cb = p * rhalf
            for (let i = 0; i < rhalf; i++) {
              const a = this.oq[o + i], b = this.oq[o + i + rhalf], cs = cos[cb + i], sn = sin[cb + i]
              this.oq[o + i] = a * cs - b * sn
              this.oq[o + i + rhalf] = b * cs + a * sn
            }
          }
          for (let h = 0; h < nkv; h++) {
            const o = t * kd + h * D
            const dst = p * kd + h * D
            this.rmsnorm(this.ok, o, L.kNorm, kc, dst, D)
            const cb = p * rhalf
            for (let i = 0; i < rhalf; i++) {
              const a = kc[dst + i], b = kc[dst + i + rhalf], cs = cos[cb + i], sn = sin[cb + i]
              kc[dst + i] = a * cs - b * sn
              kc[dst + i + rhalf] = b * cs + a * sn
            }
            for (let i = 0; i < D; i++) vc[dst + i] = this.ov[o + i]
          }
        }
        // attention (causal) -> qin as [T][qd], times sigmoid(gate) on Qwen3.5
        for (let t = 0; t < T; t++) {
          const p = batch ? batch.streams[t].len : pos0 + t
          const kc = batch ? batch.streams[t].kc[l] : this.kc[l], vc = batch ? batch.streams[t].vc[l] : this.vc[l]
          for (let h = 0; h < nh; h++) {
            const kvh = (h / group) | 0
            const qo = t * qs + h * qh
            let mx = -Infinity
            for (let j = 0; j <= p; j++) {
              const ko = j * kd + kvh * D
              let s = 0
              for (let i = 0; i < D; i++) s += this.oq[qo + i] * kc[ko + i]
              s *= scale
              scores[j] = s
              if (s > mx) mx = s
            }
            let z = 0
            for (let j = 0; j <= p; j++) { const e = Math.exp(scores[j] - mx); scores[j] = e; z += e }
            const inv = 1 / z
            const oo = t * qd + h * D
            for (let i = 0; i < D; i++) qin[oo + i] = 0
            for (let j = 0; j <= p; j++) {
              const w = scores[j] * inv
              const vo = j * kd + kvh * D
              for (let i = 0; i < D; i++) qin[oo + i] += w * vc[vo + i]
            }
            if (this.qGate) for (let i = 0; i < D; i++) qin[oo + i] /= 1 + Math.exp(-this.oq[qo + D + i])
          }
        }
        this.quant(qd, T)
        this.mm(L.wo, this.pOd, T)
        for (let i = 0; i < T * hd; i++) x[i] += this.od[i]
      }
      // ---- MLP (SwiGLU) with the neuron hook
      for (let t = 0; t < T; t++) this.rmsnorm(x, t * hd, L.ffnNorm, qin, t * hd, hd)
      this.quant(hd, T)
      this.mm(L.gate, this.pOg, T); this.mm(L.up, this.pOu, T)
      const g = this.og, u = this.ou
      for (let i = 0; i < T * I; i++) { const a = g[i]; qin[i] = (a / (1 + Math.exp(-a))) * u[i] }
      for (let t = 0; t < T; t++) {
        const dl = batch ? batch.deltas[t]?.[l] : hooks.deltas?.[l]
        if (dl) {
          // scale first, then shift, so a neuron in both lists behaves like the studio's multiply-then-add
          if (dl.mn) for (let j = 0; j < dl.mn.length; j++) qin[t * I + dl.mn[j]] *= dl.mf![j]
          for (let j = 0; j < dl.n.length; j++) qin[t * I + dl.n[j]] += dl.d[j]
        }
      }
      if (hooks.onHidden) hooks.onHidden(l, qin, c0, T)
      this.quant(I, T)
      this.mm(L.down, this.pOd, T)
      for (let i = 0; i < T * hd; i++) x[i] += this.od[i]
      if (hooks.onLayerOut) hooks.onLayerOut(l, x, c0, T)
    }
    if (wantLogits && batch) {
      for (let t = 0; t < T; t++) this.rmsnorm(x, t * hd, this.outNorm, qin, t * hd, hd)
      this.quant(hd, T)
      this.k.matmul_q8(this.embd.q, this.embd.s, this.pXq, this.pXs, this.pLogits, this.embd.rows, this.embd.k, T)
    } else if (wantLogits) {
      this.rmsnorm(x, (T - 1) * hd, this.outNorm, qin, 0, hd)
      this.quant(hd, 1)
      this.k.matmul_q8(this.embd.q, this.embd.s, this.pXq, this.pXs, this.pLogits, this.embd.rows, this.embd.k, 1)
    }
  }
}
