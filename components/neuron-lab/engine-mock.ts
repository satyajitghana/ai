import type { NeuronEngine } from "./types"

// UI development stand-in. It streams a fixed sentence and says so in `info.backend`; the page uses it
// only when the real engine is absent AND the URL carries ?mock=1. It never ships a fake model answer
// as if it were real: the output is labelled in the first token.
export function createMockEngine(): NeuronEngine {
  let loaded = false
  return {
    info: { model: "Qwen/Qwen3-0.6B", downloadMB: 0, memoryMB: 0, backend: "mock (UI development only)" },
    isLoaded: () => loaded,
    cached: async () => "unknown",
    async load(onProgress) {
      for (let i = 1; i <= 10; i++) {
        await new Promise((r) => setTimeout(r, 60))
        onProgress(i / 10, "mock load")
      }
      loaded = true
    },
    unload() {
      loaded = false
    },
    async generate({ steers, maxNewTokens, onToken, signal }) {
      const words = `[mock output, ${steers.length} steer${steers.length === 1 ? "" : "s"}] This is placeholder text streamed by the UI development stand-in, not a model answer.`.split(" ")
      let n = 0
      const t0 = performance.now()
      let text = ""
      for (const w of words.slice(0, maxNewTokens)) {
        if (signal?.aborted) break
        await new Promise((r) => setTimeout(r, 25))
        const t = (n ? " " : "") + w
        text += t
        onToken(t, { index: n++ })
      }
      return { text, tokens: n, msPerToken: (performance.now() - t0) / Math.max(1, n) }
    },
    async activations(text) {
      const tokens = text.split(/\s+/).filter(Boolean)
      return { tokens, max: new Float32Array(28 * 3072) }
    },
  }
}
