import type { NeuronEngine } from "./types"

// Resolves the in-browser engine. The real engine (components/neuron-lab/engine.ts, a Web Worker that
// fetches Qwen3-0.6B from huggingface.co at run time) is wired in here at merge; until it exists the
// page offers only the labelled mock, behind ?mock=1.
export async function loadEngine(allowMock: boolean): Promise<NeuronEngine | null> {
  if (allowMock) {
    const { createMockEngine } = await import("./engine-mock")
    return createMockEngine()
  }
  return null
}
