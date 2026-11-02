// Every constant in this file was read or counted from primary files; the source is named beside each.

export const fmt = (n: number) => n.toLocaleString("en-US")

// tencent/WeVisOne-VL-4B model.safetensors header: 714 tensors, 4,830,581,248 bf16 values (measured).
export const MODEL_PARAMS = [
  { id: "layers", label: "text layers (36)", n: 3_633_509_376, note: "36 x 100,930,816: attention 32 heads / 8 KV heads, head_dim 128, MLP 9,728" },
  { id: "embed", label: "token embeddings", n: 390_860_800, note: "152,680 rows x 2,560" },
  { id: "head", label: "lm_head (untied)", n: 390_860_800, note: "a second 152,680 x 2,560 matrix; Qwen3-VL-4B ties it to the embedding" },
  { id: "vit-blocks", label: "ViT blocks (24)", n: 302_309_376, note: "hidden 1,024, 16 heads, MLP 4,096, patch 16" },
  { id: "vit-deep", label: "3 DeepStack mergers", n: 81_833_472, note: "inject ViT layers 5, 11, 17 into the first LLM layers" },
  { id: "vit-merger", label: "final merger", n: 27_271_680, note: "2x2 spatial merge to the LLM width 2,560" },
  { id: "vit-pos", label: "ViT position table", n: 2_359_296, note: "2,304 positions x 1,024" },
  { id: "vit-patch", label: "ViT patch embed", n: 1_573_888, note: "3 x 2 x 16 x 16 -> 1,024" },
  { id: "norm", label: "final norm", n: 2_560, note: "" },
] as const

export const SAFETENSORS_TOTAL = 4_830_581_248
export const DECODER_TOTAL = 9_609_764 // mask_decoder.pt, 296 fp32 tensors (measured), outside the safetensors file

// mask_decoder.pt: parameters by top-level module (measured by reading the pickle's tensor table without loading it).
export const DECODER_MODULES = [
  { id: "transformer", label: "query decoder (6 blocks)", n: 3_560_832 },
  { id: "pixel_fusion", label: "pixel fusion", n: 3_184_896 },
  { id: "visual_encoder", label: "visual feature adapter", n: 1_794_432 },
  { id: "query_builder", label: "query builder", n: 578_880 },
  { id: "highres_refine", label: "alpha cascade S/4, S/2, S/1", n: 441_123 },
  { id: "mask_predictor", label: "dynamic mask head", n: 49_601 },
] as const

// Qwen/Qwen3-VL-4B-Instruct: 4,437,815,808 values, vocab 151,936, tied embeddings (measured from its header and config).
export const BASE_PARAMS = 4_437_815_808
export const BASE_VOCAB = 151_936
export const NEW_VOCAB = 152_680
export const HIDDEN = 2_560
export const UNTIE_COST = BASE_VOCAB * HIDDEN // 388,956,160: the separate lm_head that the base shares with its embedding
export const NEW_ROWS_COST = (NEW_VOCAB - BASE_VOCAB) * HIDDEN * 2 // 3,809,280: 744 new rows in both matrices

// tokenizer.json: new tokens occupy ids 151,669..152,678.
export const NEW_TOKENS = {
  coordFirst: 151_669,
  coordLast: 152_669,
  coordCount: 1_001,
  tags: [
    { id: 152_670, text: "<ref>" },
    { id: 152_671, text: "</ref>" },
    { id: 152_672, text: "<box>" },
    { id: 152_673, text: "</box>" },
    { id: 152_674, text: "<point>" },
    { id: 152_675, text: "</point>" },
    { id: 152_676, text: "<polygon>" },
    { id: 152_677, text: "</polygon>" },
    { id: 152_678, text: "<OBJ>" },
  ],
} as const

// Cost model constants, from config.json (text_config, vision_config) and the decoder shapes.
export const LLM = {
  layers: 36,
  kvHeads: 8,
  headDim: 128,
  heads: 32,
  bodyParams: 3_633_509_376,
  headParams: 390_860_800,
}
export const KV_BYTES_PER_TOKEN = 2 * LLM.layers * LLM.kvHeads * LLM.headDim * 2 // 147,456 bytes
export const VIT = { depth: 24, d: 1024, ffn: 4096, patch: 16, merge: 2 }

// Per-instance FLOPs of the S/4, S/2, S/1 alpha cascade on the decoder's 1,024 x 1,024 canvas.
// Reasoned from the conv shapes in mask_decoder.pt (2 x out x in x k^2 x pixels); not timed.
export const CASCADE_GFLOPS = { s4: 16.8, s2: 70.0, s1: 197.0, semantic: 3.6 }
export const CASCADE_TOTAL_GFLOPS = 287.5
export const DECODER_CANVAS = 1024

// engine.py defaults.
export const ENGINE = { minTokens: 16, maxTokens: 2025, decoderBatch: 16, maxNewTokens: 4096 }

export const vitFlops = (patches: number) => {
  const perLayer = patches * 2 * (4 * VIT.d * VIT.d + 2 * VIT.d * VIT.ffn) + 4 * patches * patches * VIT.d
  const patchEmbed = patches * 2 * 1536 * VIT.d
  const mergers = (patches / 4) * 2 * (27_271_680 + 81_833_472)
  return VIT.depth * perLayer + patchEmbed + mergers
}

export const llmPrefillFlops = (tokens: number) => {
  const dense = tokens * 2 * LLM.bodyParams
  const attention = 4 * LLM.layers * (LLM.heads * LLM.headDim) * (tokens * tokens) / 2
  return dense + attention
}

export const imageTokens = (side: number) => Math.round(side / 32) ** 2
