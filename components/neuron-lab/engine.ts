// Public API of the in-browser Qwen3-0.6B engine (client only: import it from effects / "use client"
// components, never during SSR). The model is NOT part of the site: `loadModel` downloads it from
// huggingface.co at run time (Qwen3-0.6B-Q8_0.gguf, 639 MB, plus the 11 MB tokenizer.json), keeps it in
// the browser's origin-private file system, and runs it in a Web Worker (WebAssembly SIMD, CPU).
//
// Steering is exact and follows the neuron-explorer recipe: at layer L the MLP hidden activation
// silu(gate) * up of neuron n gets  delta = dose x medianResidualNorm[L] / ||W_down[:, n]||  added at
// every position (prompt and generated), i.e. it writes dose residual-norms along the neuron's own
// down_proj column.
import { DEFAULT_LOADER, DOWNLOAD_MB, cacheStatus as cacheStatusRaw, clearCache as clearCacheRaw, type CacheState, type LoaderConfig } from "./engine/loader"
import { chatPrompt } from "./engine/runtime"
import { DEFAULT_MODEL, MODELS, MODEL_IDS, downloadMB, type ModelId } from "./engine/models"
import type { ActivationsResult, Calibration, GenerateManyOptions, GenerateOptions, GenerateResult, Steer } from "./engine/types"

export type { ActivationsResult, Calibration, GenerateManyOptions, GenerateOptions, GenerateResult, Steer, CacheState }
export { chatPrompt, DOWNLOAD_MB, MODELS, MODEL_IDS, DEFAULT_MODEL }
export type { ModelId }

export const MODEL_INFO = {
  model: "Qwen/Qwen3-0.6B",
  weights: "Qwen3-0.6B-Q8_0.gguf (Q8_0, 8.5 bits per weight)",
  layers: 28,
  neurons: 3072,
  hidden: 1024,
  vocab: 151936,
  downloadMB: DOWNLOAD_MB,
  /** Tensors unpacked in memory once loaded (plus the KV cache, up to ~230 MB at 2,048 tokens). */
  memoryMB: 680,
  maxContext: 2048,
}

/** What the UI needs to know about a model before it is loaded. */
export function getModelInfo(id: ModelId = currentModel) {
  const m = MODELS[id]
  return { id, label: m.label, model: m.hfModel, arch: m.arch, layers: m.layers, neurons: m.neurons, hidden: m.hidden, vocab: m.vocab, downloadMB: downloadMB(id), memoryMB: m.memoryMB, maxContext: 2048 }
}

let currentModel: ModelId = DEFAULT_MODEL
export const currentModelId = (): ModelId => currentModel

/** Switch the model the next loadModel() fetches (unloads the current one). The default is Qwen3-0.6B. */
export function selectModel(id: ModelId) {
  if (!(id in MODELS)) throw new Error(`unknown model ${String(id)}`)
  if (id === currentModel) return
  unloadModel()
  currentModel = id
  config.calibration = undefined
  config.calibrationUrl = `${MODELS[id].dataBase}/meta.json`
  config.loader = { ...MODELS[id].files }
}

export interface EngineConfig {
  /** Where meta.json (resNormMedian, colNorm) lives. */
  calibrationUrl: string
  calibration?: Calibration
  loader: Partial<LoaderConfig>
  /** Tests (esbuild) supply their own worker; Next/Turbopack uses the default `new URL` form. */
  workerFactory?: () => Worker
}

const config: EngineConfig = { calibrationUrl: "/neuron-lab/qwen3-0.6b/meta.json", loader: {} }
export function configureEngine(c: Partial<EngineConfig> & { model?: ModelId }) {
  const { model, ...rest } = c
  if (model) selectModel(model)
  Object.assign(config, rest)
}

let worker: Worker | null = null
let seq = 0
let loaded = false
let loadPromise: Promise<void> | null = null
const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void; onMsg?(m: Record<string, unknown>): void }>()

function ensureWorker(): Worker {
  if (worker) return worker
  worker = config.workerFactory ? config.workerFactory() : new Worker(new URL("./engine/worker.ts", import.meta.url), { type: "module" })
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data as { id: number; type: string; [k: string]: unknown }
    const p = pending.get(m.id)
    if (!p) return
    if (m.type === "done") { pending.delete(m.id); p.resolve(m.result) }
    else if (m.type === "error") { pending.delete(m.id); p.reject(new Error(String(m.message))) }
    else p.onMsg?.(m)
  }
  worker.onerror = (e) => { for (const [, p] of pending) p.reject(new Error(e.message || "engine worker crashed")); pending.clear(); worker = null; loaded = false; loadPromise = null }
  return worker
}

function call<T>(msg: Record<string, unknown>, onMsg?: (m: Record<string, unknown>) => void, transfer: Transferable[] = []): { id: number; promise: Promise<T> } {
  const id = ++seq
  const w = ensureWorker()
  const promise = new Promise<T>((resolve, reject) => { pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onMsg }) })
  w.postMessage({ id, ...msg }, transfer)
  return { id, promise }
}

async function fetchCalibration(): Promise<Calibration | undefined> {
  if (config.calibration) return config.calibration
  try {
    const r = await fetch(config.calibrationUrl)
    if (!r.ok) return undefined
    const j = await r.json()
    if (Array.isArray(j.resNormMedian) && Array.isArray(j.colNorm)) return (config.calibration = { resNormMedian: j.resNormMedian, colNorm: j.colNorm })
  } catch { /* steering will say what is missing */ }
  return undefined
}

/** Download (first visit) or open from the browser cache, then unpack the weights into memory. */
export function loadModel(onProgress: (frac: number, msg: string) => void): Promise<void> {
  if (loaded) { onProgress(1, "ready"); return Promise.resolve() }
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try { await navigator.storage?.persist?.() } catch { /* optional */ }
    const calibration = await fetchCalibration()
    const { promise } = call<null>({ op: "load", config: config.loader, calibration }, (m) => { if (m.type === "progress") onProgress(m.frac as number, m.msg as string) })
    await promise
    loaded = true
    onProgress(1, "ready")
  })().catch((e) => { loadPromise = null; throw e })
  return loadPromise
}

export const isLoaded = () => loaded

/** Is the model already in this browser's cache (so Load is instant and offline)? */
export function cacheStatus(): Promise<CacheState> { return cacheStatusRaw({ ...DEFAULT_LOADER, ...config.loader }) }
export async function clearCache(): Promise<void> { await clearCacheRaw() }

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  if (!loaded) throw new Error("model not loaded")
  if (!config.calibration && opts.steers.some((s) => s.dose)) await fetchCalibration().then((c) => c && call({ op: "calibrate", calibration: c }).promise)
  const { onToken, signal, ...rest } = opts
  const { id, promise } = call<GenerateResult>({ op: "generate", opts: rest }, (m) => { if (m.type === "token") onToken(m.t as string, { index: m.index as number }) })
  const onAbort = () => ensureWorker().postMessage({ op: "abort", target: id })
  if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true }) }
  try { return await promise } finally { signal?.removeEventListener("abort", onAbort) }
}

/**
 * Decode up to four steered variants of one prompt together (the explorer's -dose / baseline / +dose
 * columns). Each variant's text equals generate() for the same steers and seed; the batch is just
 * cheaper per variant than running them one after another.
 */
export async function generateMany(opts: GenerateManyOptions): Promise<GenerateResult[]> {
  if (!loaded) throw new Error("model not loaded")
  if (!config.calibration && opts.variants.some((v) => v.some((s) => s.dose))) await fetchCalibration().then((c) => c && call({ op: "calibrate", calibration: c }).promise)
  const { onToken, signal, ...rest } = opts
  const { id, promise } = call<GenerateResult[]>({ op: "generateMany", opts: rest }, (m) => { if (m.type === "token") onToken(m.variant as number, m.t as string, { index: m.index as number }) })
  const onAbort = () => ensureWorker().postMessage({ op: "abort", target: id })
  if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true }) }
  try { return await promise } finally { signal?.removeEventListener("abort", onAbort) }
}

export async function activations(text: string): Promise<ActivationsResult> {
  if (!loaded) throw new Error("model not loaded")
  const r = await call<{ tokens: string[]; max: Float32Array; all?: Float32Array }>({ op: "activations", text }).promise
  const { tokens, max, all } = r
  const { layers: L, neurons: N } = getModelInfo()
  return {
    tokens, max,
    byToken: all ? (layer, neuron) => { const out = new Float32Array(tokens.length); for (let t = 0; t < tokens.length; t++) out[t] = all[(t * L + layer) * N + neuron]; return out } : undefined,
  }
}

/** Last-position logits after `prompt` (for tests and for the logit-lens style probes). */
export async function logits(prompt: string, steers: Steer[], opts: { backend?: "cpu" | "webgpu" } = {}): Promise<Float32Array> {
  if (!loaded) throw new Error("model not loaded")
  return call<Float32Array>({ op: "logits", prompt, steers, backend: opts.backend ?? "cpu" }).promise
}

/**
 * Choose where tokens are computed: "cpu" (WebAssembly SIMD: the default, verified against PyTorch) or "webgpu"
 * (opt-in: weights are uploaded to the GPU and every step runs there; parity with the CPU path is tested on a
 * software adapter, speed on a real GPU is not measured by us). Throws when WebGPU is unavailable.
 */
export async function setBackend(kind: "cpu" | "webgpu", onProgress: (frac: number, msg: string) => void = () => {}): Promise<{ backend: "cpu" | "webgpu"; adapter?: { vendor: string; architecture: string; description: string; fallback: boolean; maxBinding: number } }> {
  if (!loaded) throw new Error("model not loaded")
  return call<{ backend: "cpu" | "webgpu"; adapter?: { vendor: string; architecture: string; description: string; fallback: boolean; maxBinding: number } }>({ op: "backend", kind }, (m) => { if (m.type === "progress") onProgress(m.frac as number, m.msg as string) }).promise
}

/** Cheap feature test for the opt-in WebGPU backend (the page can decide whether to offer it). */
export const webgpuSupported = (): boolean => typeof navigator !== "undefined" && "gpu" in navigator

export async function tokenize(text: string): Promise<number[]> {
  if (!loaded) throw new Error("model not loaded")
  return call<number[]>({ op: "tokenize", text }).promise
}

/** Free the ~700 MB the engine holds. loadModel() starts it again (from the cache). */
export function unloadModel() { worker?.terminate(); worker = null; loaded = false; loadPromise = null; pending.clear() }
