// Every number here is from a file or a script run for the article: the
// safetensors headers of nace-ai/drex-max-v1 (read by HTTP range request), its
// config.json and decision_config.json, the repo's README, and my own
// range-request comparison of sampled tensor slices (measured). Labels follow
// the article: measured / reported / reasoned.

export type Group = { id: string; label: string; params: number; note: string; tone: "mlp" | "linear" | "full" | "embed" | "vision" | "readout" | "norm" }

export const GROUPS: Group[] = [
  { id: "mlp", label: "MLP, 64 layers", params: 17_112_760_320, tone: "mlp", note: "gate, up and down projections, 5,120 by 17,408 each: 267,386,880 per layer" },
  { id: "linear", label: "Gated DeltaNet attention, 48 layers", params: 5_562_051_072, tone: "linear", note: "in_proj_qkv, in_proj_z, in_proj_a/b, a width-4 convolution and out_proj: 115,876,064 per layer" },
  { id: "full", label: "Full attention, 16 layers", params: 1_677_729_792, tone: "full", note: "24 query heads and 4 key-value heads of width 256, with an output gate: 104,858,112 per layer" },
  { id: "embed", label: "Token embedding", params: 1_271_398_400, tone: "embed", note: "248,320 by 5,120. A lookup, not a matrix multiply, and there is no separate LM head" },
  { id: "vision", label: "Vision tower", params: 460_730_096, tone: "vision", note: "27 blocks of width 1,152 and a merger into 5,120. Not touched by a text-only request" },
  { id: "readout", label: "Readout head", params: 1_305_600, tone: "readout", note: "255 by 5,120, bf16, no bias, in readout.safetensors" },
  { id: "norm", label: "Norms", params: 660_480, tone: "norm", note: "RMSNorm weights, including the final norm" },
]

export const TOTAL_PARAMS = 26_086_635_760
export const TEXT_PARAMS = 25_624_600_064
export const MATMUL_PARAMS = 24_352_541_184

// Layer pattern from config.json layer_types: every fourth layer is full attention.
export const FULL_ATTENTION_LAYERS = Array.from({ length: 16 }, (_, i) => 4 * i + 3)

// Relative distance, in percent, between sampled tensor slices (first 8 MiB of
// each tensor, 4,194,304 elements), ||A - B|| / ||B||. Measured.
export type DistRow = { tensor: string; d3: number; turbo: number; drex: number; drexVsD3: number; drexVsTurbo: number; turboVsD3: number; cosDrexD3: number; cosDrexTurbo: number; cosD3Turbo: number }
export const DISTANCES: DistRow[] = [
  { tensor: "layer 0 mlp.up_proj", d3: 0.687, turbo: 0.944, drex: 1.87, drexVsD3: 1.86, drexVsTurbo: 1.962, turboVsD3: 0.617, cosDrexD3: 0.198, cosDrexTurbo: 0.152, cosD3Turbo: 0.757 },
  { tensor: "layer 3 self_attn.q_proj", d3: 0.457, turbo: 0.564, drex: 1.493, drexVsD3: 1.491, drexVsTurbo: 1.525, turboVsD3: 0.314, cosDrexD3: 0.158, cosDrexTurbo: 0.132, cosD3Turbo: 0.831 },
  { tensor: "layer 31 self_attn.q_proj", d3: 0.526, turbo: 0.701, drex: 1.501, drexVsD3: 1.494, drexVsTurbo: 1.559, turboVsD3: 0.434, cosDrexD3: 0.189, cosDrexTurbo: 0.15, cosD3Turbo: 0.787 },
  { tensor: "layer 31 mlp.down_proj", d3: 0.606, turbo: 0.861, drex: 1.061, drexVsD3: 1.039, drexVsTurbo: 1.191, turboVsD3: 0.565, cosDrexD3: 0.322, cosDrexTurbo: 0.246, cosD3Turbo: 0.757 },
  { tensor: "layer 63 self_attn.k_proj", d3: 0.674, turbo: 0.952, drex: 1.36, drexVsD3: 1.317, drexVsTurbo: 1.5, turboVsD3: 0.709, cosDrexD3: 0.311, cosDrexTurbo: 0.195, cosD3Turbo: 0.668 },
  { tensor: "layer 0 linear_attn.in_proj_qkv", d3: 0.465, turbo: 0.612, drex: 1.26, drexVsD3: 1.255, drexVsTurbo: 1.313, turboVsD3: 0.383, cosDrexD3: 0.195, cosDrexTurbo: 0.154, cosD3Turbo: 0.78 },
  { tensor: "token embedding (first 8 MiB)", d3: 0.419, turbo: 0.573, drex: 0.325, drexVsD3: 0.31, drexVsTurbo: 0.489, turboVsD3: 0.367, cosDrexD3: 0.678, cosDrexTurbo: 0.523, cosD3Turbo: 0.769 },
  { tensor: "vision block 0 attn.qkv", d3: 0, turbo: 0, drex: 0.007, drexVsD3: 0.007, drexVsTurbo: 0.007, turboVsD3: 0, cosDrexD3: 0, cosDrexTurbo: 0, cosD3Turbo: 0 },
]

// The readout head against Qwen3.8-27B's own lm_head rows at the 255 code token ids. Measured.
export const READOUT = [
  { model: "d3", dtype: "F32", cosine: 1.0, movedPct: 0.283 },
  { model: "d3-turbo", dtype: "F32", cosine: 0.9999, movedPct: 1.099 },
  { model: "Drex Max", dtype: "BF16", cosine: 0.9998, movedPct: 1.406 },
]

// A decision call's cost, in TFLOP, from the real config (reasoned: 2 FLOPs per
// weight per token, 4 N^2 d per full-attention layer, vision by patch count).
export type Case = { id: string; label: string; tokens: number; imagePx: number; matmul: number; attention: number; vision: number; note: string }
export const CASES: Case[] = [
  { id: "t300", label: "300 text tokens", tokens: 300, imagePx: 0, matmul: 14.61, attention: 0.04, vision: 0, note: "a ticket and five options" },
  { id: "t2k", label: "2,048 text tokens", tokens: 2048, imagePx: 0, matmul: 99.75, attention: 1.65, vision: 0, note: "the context the README uses on a 48 GB Mac" },
  { id: "photo", label: "1.64 MP photo + 120 text tokens", tokens: 1720, imagePx: 1_638_400, matmul: 83.77, attention: 1.16, vision: 10.5, note: "one image token per 32 by 32 pixels: 1,600 tokens" },
  { id: "photo4", label: "4.19 MP photo + 120 text tokens", tokens: 4216, imagePx: 4_194_304, matmul: 205.34, attention: 6.99, vision: 47.23, note: "the loader's per-image pixel limit: 4,096 tokens" },
  { id: "cap", label: "16,384 tokens (default cap)", tokens: 16384, imagePx: 0, matmul: 797.98, attention: 105.55, vision: 0, note: "attention is 11.7% of the work" },
  { id: "window", label: "262,144 tokens (full window)", tokens: 262144, imagePx: 0, matmul: 12767.75, attention: 27021.6, vision: 0, note: "attention is 67.8%; the keys and values alone are 16 GiB" },
]

// Memory for the weights, GiB, from file sizes (measured) and the README's stated machines (reported).
export const MEMORY = [
  { id: "bf16", label: "bf16 safetensors", gib: 48.59, note: "52,173,413,928 bytes, 16 bits per weight. README: 48.6 GiB loaded on an H100 80 GB", readme: "H100 80 GB" },
  { id: "q8", label: "Q8_0 GGUF, text only", gib: 25.38, note: "27,250,125,216 bytes, 8.507 bits per weight. README: needs a 48 GB Mac, with --context 2048", readme: "48 GB Mac" },
  { id: "q4", label: "affine Q4, safetensors", gib: 13.46, note: "14,451,748,024 bytes, 4.512 bits per weight. README: Macs with 24 GB or more", readme: "24 GB Mac" },
]
export const MACHINES = [16, 24, 32, 48, 64]
