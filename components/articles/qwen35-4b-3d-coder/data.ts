// Numbers for the Qwen3.5-4B-3D-Coder article. Every value was printed by a script run on the 213-row
// validation split of ccore/ThreeJS-3D-Scenes (token counts with the model's own tokenizer.json), or read
// from the checkpoint's config.json and safetensors headers. See the article for which is which.

export const LEVEL_ROWS = [
  { level: 1, n: 22, prompt: 106, think: 12523, code: 8292, max: 49653, over16: 16 },
  { level: 2, n: 21, prompt: 98, think: 14073, code: 10188, max: 37139, over16: 20 },
  { level: 3, n: 22, prompt: 117, think: 20527, code: 10370, max: 60865, over16: 17 },
  { level: 4, n: 21, prompt: 110, think: 15012, code: 10686, max: 43153, over16: 21 },
  { level: 5, n: 21, prompt: 121, think: 16018, code: 11604, max: 57524, over16: 21 },
  { level: 6, n: 22, prompt: 112, think: 13912, code: 13181, max: 35733, over16: 21 },
  { level: 7, n: 21, prompt: 115, think: 18961, code: 16518, max: 55889, over16: 21 },
  { level: 8, n: 21, prompt: 116, think: 18366, code: 14577, max: 52229, over16: 21 },
  { level: 9, n: 21, prompt: 118, think: 14415, code: 15727, max: 57249, over16: 21 },
  { level: 10, n: 21, prompt: 115, think: 16916, code: 17387, max: 63975, over16: 21 },
] as const

export const TOKEN_TOTALS = {
  mean: 29001,
  median: 26363,
  max: 63975,
  reportedMean: 28861, // 112,903,599 / 3,912, from the technical report
} as const

// Attention layout, from config.json: 32 layers, every fourth one full attention.
export const KV = {
  layers: 32,
  fullLayers: 8,
  linearLayers: 24,
  kvHeads: 4,
  headDim: 256,
  bytes: 2, // F16 KV cache, as in the report's evaluation
  // gated delta-rule state per linear layer: 32 value heads x 128 x 128 x 4 bytes (fp32, mamba_ssm_dtype)
  stateBytesPerLayer: 32 * 128 * 128 * 4,
} as const
