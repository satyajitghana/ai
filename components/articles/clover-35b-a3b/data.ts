// Everything in this file is read from Clover-35B-A3B-Preview's own files (safetensors headers by range request,
// config.json, modeling_clover_moe.py at the Hub revision of 2026-10-28) or from DiffuSpace's launch blog; each block says which.

// MEASURED: parameter counts by role, summed from the 813 tensor shapes in the 26 shards and two small side files.
// The total, 34,661,350,848, matches the Hub's own safetensors count.
export const PARAMS = {
  total: 34_661_350_848,
  parts: [
    { key: "routed", label: "routed experts", n: 32_212_254_720, note: "256 experts x 40 layers, 3 x 2048 x 512 each" },
    { key: "gdn", label: "Gated DeltaNet layers", n: 1_011_553_920, note: "30 layers" },
    { key: "embed", label: "token embedding", n: 508_559_360, note: "248,320 x 2048, a table lookup" },
    { key: "head", label: "output head", n: 508_559_360, note: "248,320 x 2048, untied, read every step" },
    { key: "attn", label: "full attention", n: 272_634_880, note: "10 layers" },
    { key: "shared", label: "shared expert", n: 125_911_040, note: "1 per layer, always on" },
    { key: "router", label: "routers", n: 20_971_520, note: "256 x 2048 per layer" },
    { key: "bidir", label: "bidirectional additions", n: 740_160, note: "right-conv weights and softmax controls" },
    { key: "other", label: "norms and the rest", n: 165_888, note: "" },
  ],
} as const

// MEASURED (from the shapes): one routed expert = gate and up (2 x 2048 x 512) plus down (512 x 2048).
export const EXPERT_PARAMS = 3_145_728
export const LAYERS = 40
export const EXPERTS = 256
export const TOP_K = 8
// MEASURED: everything a decode step reads that is not a routed expert: all the rows above except the routed
// experts and the embedding table (a lookup reads 2048 values, not 508 million).
export const DENSE_PARAMS = 1_940_536_768
// MEASURED: dense + 8 experts x 40 layers = the "3B active" of the model name.
export const ACTIVE_PARAMS = 2_947_169_728

// REPORTED (DiffuSpace launch blog, 2026-10-28; Chinese text, our translation): the three speed claims.
// Every row is one GPU, batch size 1, and says what was decoded.
export const CLAIMS = [
  { key: "gb300", gpu: "NVIDIA GB300", precision: "BF16", tps: 680, note: "internal agent-scenario data", gbps: 8000, gbpsNote: "about 8 TB/s per GPU, NVIDIA's published figure (not re-checked here)" },
  { key: "h200", gpu: "NVIDIA H200", precision: "BF16", tps: 515, note: "agent tasks; the blog lists 365 for Qwen with DFlash2", gbps: 4800, gbpsNote: "4.8 TB/s, NVIDIA's published figure (not re-checked here)" },
  { key: "rtx", gpu: "RTX 5070 Ti, 16 GB", precision: "INT4", tps: 101.8, note: "MATH-500; the blog lists 48.5 for comparable models", gbps: 896, gbpsNote: "896 GB/s, the card's published figure (not re-checked here)" },
] as const
