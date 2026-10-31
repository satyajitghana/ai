import { MODELS, downloadMB, type ModelId } from "./lab-models"
import type { NeuronEngine } from "./types"

// Resolves the in-browser engine: components/neuron-lab/engine.ts, a Web Worker that runs Qwen3-0.6B or
// Qwen3.5-0.8B (Q8_0 GGUF, WebAssembly SIMD on the CPU, with an opt-in WebGPU path) and fetches the weights from
// huggingface.co at run time. ?mock=1 swaps in a labelled stand-in for UI work. Imported lazily: nothing of the
// engine is loaded until the page runs.
export async function loadEngine(allowMock: boolean, initial: ModelId): Promise<NeuronEngine | null> {
  if (allowMock) {
    const { createMockEngine } = await import("./engine-mock")
    return createMockEngine(initial)
  }
  try {
    const m = await import("./engine")
    const { DEFAULT_LOADER, cacheStatus } = await import("./engine/loader")
    m.selectModel(initial)
    let kind: "cpu" | "webgpu" = "cpu"
    const engine: NeuronEngine = {
      get info() {
        const i = m.getModelInfo()
        return { model: i.model, downloadMB: i.downloadMB, memoryMB: i.memoryMB, backend: kind === "webgpu" ? "WebGPU (experimental)" : "WebAssembly SIMD, Q8_0, on the CPU" }
      },
      modelId: () => m.currentModelId(),
      select(id) {
        m.selectModel(id as ModelId) // unloads the current model (terminates its worker) when the id changes
        kind = "cpu"
      },
      isLoaded: m.isLoaded,
      cached: async (id) => {
        const sel = (id ?? m.currentModelId()) as ModelId
        const s = await cacheStatus({ ...DEFAULT_LOADER, ...MODELS[sel].files })
        return s.state === "complete" ? "cached" : s.state === "unavailable" ? "unknown" : "missing"
      },
      load: m.loadModel,
      unload() {
        m.unloadModel()
        kind = "cpu"
      },
      webgpuAvailable: m.webgpuSupported(),
      backend: () => kind,
      async setBackend(k, onProgress) {
        const r = await m.setBackend(k, onProgress)
        kind = r.backend
        return r
      },
      generate: m.generate,
      generateMany: m.generateMany,
      activations: m.activations,
    }
    return engine
  } catch {
    return null
  }
}

export { downloadMB }
