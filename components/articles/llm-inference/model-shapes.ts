// Declared shapes for one concrete model, shared by the two cost figures in this
// article (arithmetic-intensity.tsx and latency-budget.tsx) so they can never
// disagree with each other.
//
// Llama-2 7B in fp16: 32 layers, d_model 4096, 32 KV heads of 128, FFN 11008,
// vocab 32000, untied embedding and lm_head. Nothing here is measured — it is
// arithmetic on the config, which is the only part of inference cost you can read
// off a model card.

export const L = 32
export const D = 4096
export const KV_HEADS = 32
export const HEAD_DIM = 128
export const FF = 11008
export const VOCAB = 32000
export const FP16 = 2

const PER_LAYER = 4 * D * D + 3 * D * FF + 2 * D

/** Every parameter, including both embedding tables. ~6.74B. */
export const PARAMS = 2 * VOCAB * D + L * PER_LAYER + D

/** The parameters a token is actually multiplied against. ~6.61B. */
export const MATMUL_PARAMS = L * (4 * D * D + 3 * D * FF) + VOCAB * D

/** Reading the whole model once, in fp16. ~13.48 GB. */
export const WEIGHT_BYTES = PARAMS * FP16

/** K and V for every layer, one token. 524,288 B = 0.5 MB. */
export const KV_PER_TOKEN = 2 * L * KV_HEADS * HEAD_DIM * FP16

/** Whole prompt through every layer: 2 FLOPs per weight per token, plus attention. */
export const prefillFlops = (t: number) => 2 * MATMUL_PARAMS * t + 4 * L * t * t * D

/** One token: the same weights again, plus one query against t cached keys. */
export const decodeFlops = (t: number) => 2 * MATMUL_PARAMS + 4 * L * t * D

/** Bytes off HBM for one pass: every weight once, plus the cache it touches. */
export const passBytes = (t: number, batch = 1) =>
  WEIGHT_BYTES + batch * KV_PER_TOKEN * t

/** Vendor peak bf16 dense FLOP/s over peak HBM bandwidth. */
export const A100_PEAK_FLOPS = 312e12
export const A100_PEAK_BW = 2039e9
export const A100_RIDGE = A100_PEAK_FLOPS / A100_PEAK_BW // ~153 FLOPs/byte
export const H100_RIDGE = 989.5e12 / 3350e9 // ~295 FLOPs/byte
