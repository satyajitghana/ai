// The models the engine can run. Each entry pins a Hugging Face revision (so an upstream edit cannot change
// what a visitor runs) and the file sizes (checked after download). Nothing here is part of the site.
export interface ModelFiles {
  ggufUrl: string
  ggufBytes: number
  tokenizerUrl: string
  tokenizerBytes: number
  cacheKey: string
}

export interface ModelSpec {
  id: string
  label: string
  /** The model the steering recipe and neuron ids refer to. */
  hfModel: string
  arch: "qwen3" | "qwen35"
  layers: number
  neurons: number
  hidden: number
  vocab: number
  /** Where the precomputed calibration (resNormMedian, colNorm) and neuron data live, if the site ships them. */
  dataBase: string
  /** Tensors unpacked in memory once loaded (plus the KV cache / recurrent state). */
  memoryMB: number
  files: ModelFiles
}

export const MODELS = {
  "qwen3-0.6b": {
    id: "qwen3-0.6b",
    label: "Qwen3-0.6B",
    hfModel: "Qwen/Qwen3-0.6B",
    arch: "qwen3",
    layers: 28,
    neurons: 3072,
    hidden: 1024,
    vocab: 151936,
    dataBase: "/neuron-lab/qwen3-0.6b",
    memoryMB: 680,
    files: {
      ggufUrl: "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/Qwen3-0.6B-Q8_0.gguf",
      ggufBytes: 639446688,
      tokenizerUrl: "https://huggingface.co/Qwen/Qwen3-0.6B/resolve/c1899de289a04d12100db370d81485cdf75e47ca/tokenizer.json",
      tokenizerBytes: 11422654,
      cacheKey: "qwen3-0.6b-q8_0-23749fe",
    },
  },
  "qwen3.5-0.8b": {
    id: "qwen3.5-0.8b",
    label: "Qwen3.5-0.8B",
    hfModel: "Qwen/Qwen3.5-0.8B",
    arch: "qwen35",
    layers: 24,
    neurons: 3584,
    hidden: 1024,
    vocab: 248320,
    dataBase: "/neuron-lab/qwen3.5-0.8b",
    memoryMB: 960,
    files: {
      ggufUrl: "https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF/resolve/807dfd9a6fadbf703207aac3bfb0b2b3040d077c/Qwen3.5-0.8B-Q8_0.gguf",
      ggufBytes: 833592096,
      tokenizerUrl: "https://huggingface.co/Qwen/Qwen3.5-0.8B/resolve/2fc06364715b967f1860aea9cf38778875588b17/tokenizer.json",
      tokenizerBytes: 12807982,
      cacheKey: "qwen3.5-0.8b-q8_0-807dfd9",
    },
  },
} as const satisfies Record<string, ModelSpec>

export type ModelId = keyof typeof MODELS
export const MODEL_IDS = Object.keys(MODELS) as ModelId[]
export const DEFAULT_MODEL: ModelId = "qwen3-0.6b"
export const downloadMB = (id: ModelId) => Math.round((MODELS[id].files.ggufBytes + MODELS[id].files.tokenizerBytes) / 1e6)
