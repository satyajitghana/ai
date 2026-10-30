// Every number in this file was computed from files, not typed from a post:
//  - parameter counts: the 1,395 tensor shapes in the safetensors header of
//    nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B (read by HTTP range request,
//    no weights downloaded), summed per component;
//  - the 52-layer pattern: layers_block_type in llm_backbone/config.json;
//  - file sizes: the Hub's blob sizes for the BF16, FP8 and NVFP4 repositories;
//  - tokens per word: the real tokenizer.json run on one sentence per language
//    that I wrote (a small sample, not a corpus; see the article).

export const TOTAL = 33697781031
export const LAYERS = ["mamba", "moe", "mamba", "moe", "mamba", "attention", "moe", "mamba", "moe", "mamba", "moe", "mamba", "attention", "moe", "mamba", "moe", "mamba", "moe", "mamba", "attention", "moe", "mamba", "moe", "mamba", "moe", "mamba", "attention", "moe", "mamba", "moe", "mamba", "moe", "mamba", "attention", "moe", "mamba", "moe", "mamba", "moe", "mamba", "moe", "mamba", "attention", "moe", "mamba", "moe", "mamba", "moe", "mamba", "moe", "mamba", "moe"] as const
export type LayerType = "mamba" | "moe" | "attention"

export const P = {
  mamba: 891132608,
  attention: 140394240,
  routed: 29374808064,
  shared: 458981376,
  router: 7916416,
  embed: 352321536,
  lmHead: 352321536,
  mtp: 1335325952,
  asr: 630887424,
  diar: 99262880,
  ctc: 50885287,
  proj: 3443328,
  other: 100384,
} as const

export const N_EXPERTS = 128
export const TOP_K = 6
export const N_MOE = 23
export const N_MAMBA = 23
export const N_ATTN = 6
// 2 x 2688 x 1856: a relu^2 expert has one up projection and one down projection.
export const EXPERT_PARAMS = 9_977_856

// Bytes per original parameter, from the repositories' file sizes divided by 33.698 B.
export const BYTES_PER_PARAM = { BF16: 2.003, FP8: 1.029, NVFP4: 0.64 } as const
export const FILE_GB = { BF16: 67.5, FP8: 34.67, NVFP4: 21.56 } as const

// Audio side.
export const AUDIO_TOK_PER_S = 12.5
export const CHUNK_S = 30
export const CHUNK_TOKENS = 376 // 3,001 log-mel frames, stacked by 8, rounded up: measured on a synthetic clip
export const CONTEXT = 65_536
export const KV_BYTES_PER_TOKEN = 6144 // 6 attention layers x K and V x 2 KV heads x 128 x 2 bytes
export const KV_ALL_ATTENTION = 53_248 // the same shape in all 52 layers (hypothetical)
export const SSM_STATE_MB = 48.2 // 23 layers x 64 heads x 64 x 128 x 4 bytes (fp32)

export const LANGS = [
  { id: "en", name: "English", words: 14, tokens: 17 },
  { id: "de", name: "German", words: 13, tokens: 17 },
  { id: "fr", name: "French", words: 17, tokens: 23 },
  { id: "es", name: "Spanish", words: 17, tokens: 21 },
  { id: "vi", name: "Vietnamese", words: 20, tokens: 29 },
  { id: "ar", name: "Arabic", words: 12, tokens: 18 },
  { id: "ru", name: "Russian", words: 12, tokens: 28 },
  { id: "hi", name: "Hindi", words: 14, tokens: 32 },
] as const
