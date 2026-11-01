// Every number here was computed from the 54 safetensors headers of
// mistralai/Mistral-Large-4-1T-A52B (HTTP range reads of the first 8 + N bytes
// of each shard; no tensor data downloaded), from config.json and params.json.
// Parameter counts exclude the FP32 block-scale tensors (63.8M values).

export const GROUPS = [
  { id: "routed", label: "Routed experts", params: 1029181538304, bytes: 1029181538304, active: 4 / 128, note: "71 layers x 128 experts x 3 matrices of 6144 x 6144, FP8" },
  { id: "attention", label: "Attention", params: 9109051648, bytes: 9863049728, active: 1, note: "q, o, kv projections and the indexer, 72 layers" },
  { id: "shared", label: "Shared expert", params: 8040480768, bytes: 8040480768, active: 1, note: "one expert per sparse layer, always on" },
  { id: "lm_head", label: "Output head", params: 1258291200, bytes: 2516582400, active: 1, note: "204,800 x 6,144, BF16" },
  { id: "embed", label: "Token embedding", params: 1258291200, bytes: 2516582400, active: 0, note: "a table lookup: one 12 KB row per token" },
  { id: "dense0", label: "Layer-0 dense FFN", params: 452984832, bytes: 452984832, active: 1, note: "the only non-MoE feed-forward block" },
  { id: "small", label: "Norms, gates, scalings", params: 56727584, bytes: 113455168, active: 1, note: "router gates (128 x 6144), norms, ssmax, lerope" },
  { id: "vision", label: "Vision encoder", params: 1704218624, bytes: 3408437248, active: 0, note: "30-layer Pixtral-style encoder; idle on text-only prompts" },
  { id: "draft", label: "DSpark draft head", params: 2099969024, bytes: 4199938048, active: 0, note: "3 dense MLA layers in BF16; used only when speculating" },
] as const

export const TOTAL_PARAMS = 1053161553184
export const TOTAL_BYTES_FP8 = 1060548427328 // = total_size in the index = sum of the headers
export const ROUTED_BYTES = 1029181538304
export const ROUTED_SCALE_BYTES = 251265024
export const NONROUTED_BYTES = TOTAL_BYTES_FP8 - ROUTED_BYTES - ROUTED_SCALE_BYTES // 31,115,624,000
export const EXPERT_PARAMS = 3 * 6144 * 6144 // 113,246,208
export const SPARSE_LAYERS = 71
export const N_EXPERTS = 128
export const TOPK = 4
// bytes always read per step for a text request: everything but routed experts,
// the embedding table, the vision encoder and the draft head
export const ALWAYS_READ_BYTES = 8040480768 + 9863049728 + 2516582400 + 452984832 + 113455168 // 20,986,552,896

// Own KV cache: 63 of 72 layers (9 layers read layer 35's), 576 = 512 latent + 64 rope per token, FP8 cache.
export const KV_LAYERS = 63
export const KV_PER_LAYER = 576
export const INDEXER_LAYERS = 44
export const INDEXER_KEY = 128
export const KV_BYTES_PER_TOKEN = KV_LAYERS * KV_PER_LAYER + INDEXER_LAYERS * INDEXER_KEY // 41,920
// Plain multi-head attention in BF16: 72 layers x 64 heads x (K 128 + V 128) x 2 bytes
export const MHA_BYTES_PER_TOKEN = 72 * 64 * 256 * 2 // 2,359,296
export const MAX_CONTEXT = 1048576

export const NVFP4_REPO_BYTES = 610096072460 // usedStorage of ...-NVFP4, from the Hub API
export const BITS_PER_NVFP4 = 4.5 // 4-bit value + 8-bit scale per block of 16

export const FORMATS = [
  { id: "bf16", label: "BF16 (derived)", bytes: TOTAL_PARAMS * 2, kind: "reasoned" },
  { id: "fp8", label: "FP8 (as released)", bytes: TOTAL_BYTES_FP8, kind: "measured" },
  { id: "nvfp4", label: "NVFP4 (as released)", bytes: NVFP4_REPO_BYTES, kind: "measured" },
  { id: "q2", label: "2-bit (idealised)", bytes: TOTAL_PARAMS * 0.25, kind: "reasoned" },
] as const

// nominal vendor numbers, GB of HBM per GPU and TB/s; reasoned, not measured
export const NODES = [
  { id: "8h100", label: "8 x H100 80 GB", gb: 640, tbs: 8 * 3.35 },
  { id: "8h200", label: "8 x H200 141 GB", gb: 1128, tbs: 8 * 4.8 },
  { id: "8b200", label: "8 x B200 192 GB", gb: 1536, tbs: 8 * 8 },
  { id: "4b300", label: "4 x B300 288 GB", gb: 1152, tbs: 4 * 8 },
  { id: "1x96", label: "1 x 96 GB card", gb: 96, tbs: 1.8 },
] as const
