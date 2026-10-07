// Every number here is copied from a primary file, read on 7 October 2026.
//
// LATENCY: the d1-3B model card's "Speed" tables (huggingface.co/LiquidAI/d1-3B,
// README.md), which the Open d1 blog post repeats. Warm calls, one request at
// a time. The GPU rows are bf16, median of 20 runs; the RTX 4090 row uses
// `model.compile(mode="reduce-overhead")` (CUDA graphs) and the card gives
// 16 ms for one question without it. The card does not say which runtime or
// precision the Jetson and Apple rows use.
//
// PARAMS: my own sums over the safetensors headers of LiquidAI/d1-3B and
// LiquidAI/d1-omni-600M (HTTP range requests, every tensor's shape multiplied
// out and grouped by name prefix).

export type Workload = "one" | "three" | "long" | "image" | "packed"

export type Device = {
  id: string
  label: string
  kind: "edge" | "gpu"
  one: number
  three: number
  long: number
  image: number
  packed: number // states per second, 64 packed into one pass
}

export const DEVICES: Device[] = [
  { id: "4090", label: "NVIDIA RTX 4090", kind: "gpu", one: 8, three: 21, long: 102, image: 17, packed: 475 },
  { id: "mi325x", label: "AMD MI325X", kind: "gpu", one: 9, three: 14, long: 44, image: 18, packed: 1106 },
  { id: "thor", label: "Jetson AGX Thor", kind: "edge", one: 16, three: 20, long: 220, image: 35, packed: 262 },
  { id: "orin", label: "Jetson AGX Orin 64 GB", kind: "edge", one: 26, three: 35, long: 560, image: 83, packed: 110 },
  { id: "m5", label: "Apple M5 Pro", kind: "edge", one: 30, three: 41, long: 640, image: 62, packed: 78 },
  { id: "nano", label: "Jetson Orin Nano", kind: "edge", one: 50, three: 73, long: 1640, image: 202, packed: 38 },
]

// One question on the 4090 without CUDA graphs, from the same card.
export const RTX4090_EAGER_ONE = 16

export const WORKLOADS: { id: Workload; label: string; detail: string }[] = [
  { id: "one", label: "one question", detail: "a single question over a short text state" },
  { id: "three", label: "3 questions", detail: "three questions over one state, one call" },
  { id: "long", label: "3.4k-token state", detail: "one question over a 3.4k-token text state" },
  { id: "image", label: "384 px image", detail: "one question over a 384 px image" },
  { id: "packed", label: "64 states packed", detail: "64 single-question states packed into one pass; time is per state" },
]

// Weights on the Hub, in bytes, from the repositories' file listings.
export const FILES = [
  { label: "safetensors, bf16", model: 6_246_967_776, mmproj: 0 },
  { label: "GGUF Q8_0 + mmproj Q8_0", model: 2_874_780_960, mmproj: 583_109_728 },
  { label: "GGUF Q4_K_M + mmproj Q8_0", model: 1_674_456_352, mmproj: 583_109_728 },
]

// Parameter groups from the safetensors headers.
export const PARAMS = {
  d13b: {
    total: 3_123_483_888,
    language: 2_697_198_592, // 30 LFM2 blocks + the 128,000-row embedding, tied to the output layer
    vision: 412_649_712, // SigLIP2 NaFlex, 27 layers
    projector: 13_635_584,
  },
  omni: {
    total: 587_161_089,
    trunk: 354_483_968, // LFM2.5-Encoder-350M shape, 16 bidirectional blocks
    head: 26_248_193, // type embedding, 2 transformer layers, MLP scorer
    vision: 94_234_880, // SigLIP2 tower (12 layers) + projector
    audio: 112_194_048, // FastConformer (17 layers) + adapter + residual
  },
}
