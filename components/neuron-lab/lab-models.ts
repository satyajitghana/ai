// What the page knows about each model. The numbers (layers, neurons, download size, data folder) come from the
// engine's own table (engine/models.ts, pure data, no worker), so the page and the engine cannot disagree; only the
// reader-facing notes are written here.
import { DEFAULT_MODEL, MODEL_IDS, MODELS, downloadMB, type ModelId } from "./engine/models"

export { DEFAULT_MODEL, MODEL_IDS, MODELS, downloadMB }
export type { ModelId }

export const isModelId = (s: string | null | undefined): s is ModelId => !!s && (MODEL_IDS as string[]).includes(s)

export interface ModelNotes {
  /** axes of the search that were not run on this model */
  notRun: string[]
  /** one line on the architecture, shown next to the picker */
  arch: string
  /** how the published data for this model was made, shown beside the recipes */
  data: string
}

export const MODEL_NOTES: Record<ModelId, ModelNotes> = {
  "qwen3-0.6b": {
    notRun: [],
    arch: "28 layers of attention plus a gated MLP, 3,072 neurons each.",
    data: "Searched on 69,596 tokens of Wikipedia text in four languages, in float32 on a CPU, with the full screen (32 candidates, 5 prompts).",
  },
  "qwen3.5-0.8b": {
    notRun: ["old-English style", "legal", "verbosity", "repetition"],
    arch: "24 layers, a hybrid: 18 Gated DeltaNet (linear attention) layers and 6 full-attention layers, each with a gated MLP of 3,584 neurons.",
    data: "Searched in bfloat16 on a smaller corpus (192 chunks, 24,384 tokens), with a lighter screen (16 candidates instead of 32) on most axes, so its misses are weaker evidence than the 0.6B's.",
  },
}

export const modelOptionLabel = (id: ModelId) => `${MODELS[id].label} (${downloadMB(id)} MB)`
