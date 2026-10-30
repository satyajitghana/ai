import { DATA_BASE } from "./data"
import type { NeuronEngine } from "./types"

// Resolves the in-browser engine: components/neuron-lab/engine.ts, a Web Worker that runs Qwen3-0.6B
// (Q8_0 GGUF, WebAssembly SIMD) and fetches the weights from huggingface.co at run time. ?mock=1 swaps in
// a labelled stand-in for UI work. Imported lazily: nothing of the engine is loaded until the page runs.
export async function loadEngine(allowMock: boolean): Promise<NeuronEngine | null> {
  if (allowMock) {
    const { createMockEngine } = await import("./engine-mock")
    return createMockEngine()
  }
  try {
    const m = await import("./engine")
    m.configureEngine({ calibrationUrl: `${DATA_BASE}/meta.json` })
    return {
      info: { model: m.MODEL_INFO.model, downloadMB: m.DOWNLOAD_MB, memoryMB: m.MODEL_INFO.memoryMB, backend: "WebAssembly SIMD, Q8_0, on the CPU" },
      isLoaded: m.isLoaded,
      cached: async () => {
        const s = await m.cacheStatus()
        return s.state === "complete" ? "cached" : s.state === "unavailable" ? "unknown" : "missing"
      },
      load: m.loadModel,
      unload: m.unloadModel,
      generate: m.generate,
      generateMany: m.generateMany,
      activations: m.activations,
    }
  } catch {
    return null
  }
}
