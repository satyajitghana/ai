/* eslint-disable @typescript-eslint/no-explicit-any */
// Page side of webgpu-test.mts: runs the engine in a Worker, once on the CPU path and once on the WebGPU path.
import { configureEngine, loadModel, logits, generate, generateMany, setBackend, getModelInfo } from "../../components/neuron-lab/engine"

declare global { interface Window { runGpu(model: string, refB64: string, refN: number, cases: any): Promise<unknown> } }
const t = () => performance.now()
const say = (...a: unknown[]) => console.log("[gpu]", ...a)
const b64f32 = (s: string) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Float32Array(u.buffer) }
function rel(a: Float32Array, b: Float32Array) { let n = 0, d = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - b[i]; n += x * x; d += b[i] * b[i] } return Math.sqrt(n / d) }
function top1(a: Float32Array) { let k = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i; return k }
function cosDelta(sa: Float32Array, ba: Float32Array, sb: Float32Array, bb: Float32Array) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < sa.length; i++) { const x = sa[i] - ba[i], y = sb[i] - bb[i]; dot += x * y; na += x * x; nb += y * y }
  return { cos: na && nb ? dot / Math.sqrt(na * nb) : NaN, norm: Math.sqrt(nb) }
}

window.runGpu = async (model, refB64, refN, cases) => {
  const out: Record<string, unknown> = { info: getModelInfo(model as never) }
  configureEngine({ model: model as never, workerFactory: () => new Worker("/worker.js", { type: "module" }) })
  let t0 = t()
  await loadModel(() => {})
  out.loadSec = (t() - t0) / 1000
  t0 = t()
  const prog: string[] = []
  out.backend = await setBackend("webgpu", (_f, m) => { if (!prog.length || prog[prog.length - 1] !== m) prog.push(m) })
  out.gpuInitSec = (t() - t0) / 1000
  out.gpuInitMessages = prog.filter((_, i) => i % 6 === 0 || i === prog.length - 1)
  say("backend ready", JSON.stringify(out.backend), "init", (out.gpuInitSec as number).toFixed(1), "s; load", (out.loadSec as number).toFixed(1), "s")

  const V = getModelInfo(model as never).vocab
  const ref = b64f32(refB64)
  const logitRows: unknown[] = []
  for (let i = 0; i < cases.prompts.length; i++) {
    const p = cases.prompts[i]
    t0 = t()
    const g = await logits(p, [], { backend: "webgpu" })
    const gMs = t() - t0
    const c = await logits(p, [], { backend: "cpu" })
    const r = i < refN ? ref.subarray(i * V, (i + 1) * V) : null
    say("logits", i, "gpu", Math.round(gMs), "ms")
    logitRows.push({ prompt: p.slice(0, 24), gpuVsCpuRelL2: rel(g, c), top1SameAsCpu: top1(g) === top1(c), gpuVsTorchRelL2: r ? rel(g, r) : null, cpuVsTorchRelL2: r ? rel(c, r) : null, gpuMs: Math.round(gMs) })
  }
  out.logits = logitRows

  say("logits rows", JSON.stringify(logitRows))
  const steerRows: unknown[] = []
  const baseCache = new Map<string, { g: Float32Array; c: Float32Array }>()
  for (const sc of cases.steers) {
    if (!baseCache.has(sc.prompt)) baseCache.set(sc.prompt, { g: await logits(sc.prompt, [], { backend: "webgpu" }), c: await logits(sc.prompt, [], { backend: "cpu" }) })
    const { g: gb, c: cb } = baseCache.get(sc.prompt)!
    const gs = await logits(sc.prompt, sc.steers, { backend: "webgpu" }), cs = await logits(sc.prompt, sc.steers, { backend: "cpu" })
    steerRows.push({ name: sc.name, steers: sc.steers, ...cosDelta(gs, gb, cs, cb), gpuSteeredVsCpuSteeredRelL2: rel(gs, cs) })
    say("steer", sc.name, JSON.stringify(steerRows[steerRows.length - 1]))
  }
  out.steer = steerRows

  const gen: unknown[] = []
  for (const p of cases.gen) {
    await setBackend("cpu")
    const c = await generate({ prompt: p, steers: [], maxNewTokens: cases.genTokens, temperature: 0, topK: 1, seed: 1, onToken: () => {} })
    await setBackend("webgpu")
    t0 = t()
    const g = await generate({ prompt: p, steers: [], maxNewTokens: cases.genTokens, temperature: 0, topK: 1, seed: 1, onToken: () => {} })
    say("generate", p, "cpu:", JSON.stringify(c.text), "gpu:", JSON.stringify(g.text), "ms/token", Math.round(g.msPerToken))
    gen.push({ prompt: p, identical: c.text === g.text, cpu: c.text.slice(0, 60), gpu: g.text.slice(0, 60), gpuMsPerToken: Math.round(g.msPerToken), wallMs: Math.round(t() - t0) })
  }
  out.generate = gen

  // batched variants on the GPU path equal solo runs
  const variants = cases.variants
  const solo: string[] = []
  for (const v of variants) solo.push((await generate({ prompt: cases.gen[0], steers: v, maxNewTokens: cases.genTokens, temperature: 0, topK: 1, seed: 3, onToken: () => {} })).text)
  const many = await generateMany({ prompt: cases.gen[0], variants, maxNewTokens: cases.genTokens, temperature: 0, topK: 1, seed: 3, onToken: () => {} })
  say("generateMany", JSON.stringify(many.map((r, i) => r.text === solo[i])))
  out.generateMany = { identicalToSolo: many.map((r, i) => r.text === solo[i]), texts: many.map((r) => r.text.slice(0, 50)) }
  return out
}
