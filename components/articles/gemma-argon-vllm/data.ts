// Weight multiply-accumulates per token, computed from the safetensors header of
// google/gemma-4-E2B-it (tensor shapes only; no weights downloaded). Counts the
// q/o projections, the k/v projections of layers that own a KV cache, and the
// gated MLP. Excludes attention-score FLOPs, norms, the PLE side path and the LM head.
export const N_LAYERS = 35
export const N_OWN = 15 // layers 0-14 write their own KV cache
export const N_SHARED = 20 // layers 15-34 read a donor layer's KV (num_kv_shared_layers = 20)
export const MACS_OWN_15 = 552_075_264
export const MACS_SHARED_20 = 1_283_457_024
// Layer types from config.json: every fifth layer is full attention (head_dim 512), the rest sliding (head_dim 256, window 512).
export const IS_GLOBAL = (i: number) => (i + 1) % 5 === 0

export type Cat = "kernel" | "sched" | "graph" | "memory" | "batch" | "config"
export const CATS: { id: Cat; label: string; blurb: string }[] = [
  { id: "kernel", label: "Kernel", blurb: "A GPU kernel is fused, retuned or replaced." },
  { id: "sched", label: "Skip work", blurb: "Some tokens or layers are not computed at all." },
  { id: "graph", label: "Graph capture", blurb: "More of the step runs inside one captured CUDA graph." },
  { id: "memory", label: "Memory traffic", blurb: "Fewer bytes written to and read back from HBM." },
  { id: "batch", label: "Host and batching", blurb: "Python, launches and per-request loops on the CPU side." },
  { id: "config", label: "Tuned config", blurb: "Lookup tables chosen per GPU and shape." },
]

export type Pr = {
  n: number
  title: string
  state: "open" | "closed"
  cats: Cat[]
  e2b: "yes" | "partly" | "no"
  what: string
  reported: string
}
// state: as returned by the GitHub search on 2026-10-27. "reported" text is the PR author's own claim.
export const PRS: Pr[] = [
  {
    n: 60445,
    title: "KV-sharing fast prefill and decode metadata",
    state: "open",
    cats: ["sched", "graph", "batch"],
    e2b: "yes",
    what: "Turns fast prefill on by default when a model has KV-shared layers. The 20 shared layers of E2B run only on the rows that need logits. Also: cross-decoder norm moved inside the compiled region, five metadata kernel launches replaced by one arange, per-step class creation cached.",
    reported: "E2B: 1.34-2.06x on prefill-heavy, 1.04-1.21x on decode-heavy, 100% token match.",
  },
  {
    n: 60674,
    title: "Fused Triton kernels: QKV norm and RoPE, FFN norms, PLE, MoE routing",
    state: "open",
    cats: ["kernel", "memory"],
    e2b: "yes",
    what: "One launch for QKV split, three RMSNorms and RoPE; fused residual-add and norm epilogues; fused PLE projections. Fewer launches, fewer round trips through HBM.",
    reported: "E2B on A100: up to 1.90x prefill (67,488.9 vs 35,480.8 tok/s, BS=4, 1k prompt), 1.06x decode, 100% token match.",
  },
  {
    n: 60317,
    title: "Triton unified attention for head_dim=512 and sliding-window decode",
    state: "open",
    cats: ["kernel", "sched"],
    e2b: "yes",
    what: "Tile and warp choices for head_dim 512 and 256 on SM80+ shared memory; sliding-window decode starts its tile loop at the window edge instead of the sequence start and picks the 2D kernel when sequences times KV heads reaches 128.",
    reported: "E2B: 1.02-1.12x end to end; up to 4.29x on one sliding-window decode microbenchmark.",
  },
  {
    n: 60689,
    title: "MTP speculative decoding: sparse gather-GEMV head, one-token draft graph",
    state: "open",
    cats: ["kernel", "graph", "memory"],
    e2b: "partly",
    what: "Replaces a gather plus einsum over candidate LM-head rows with a Triton kernel that never materialises the (T, S, H) tensor. Runs all draft steps in one 1-token CUDA graph. Adds an opt-in lossy mode. Fast prefill is auto-disabled when speculation is on, so this is a separate path.",
    reported: "E2B with MTP, gamma=4, BS=1: 651.1 tok/s, 1.08x over main, 100% token match.",
  },
  {
    n: 60504,
    title: "Tuned FusedMoE configs for Gemma 4 26B-A4B",
    state: "open",
    cats: ["config"],
    e2b: "no",
    what: "269 JSON tile configs for 128 experts across 21 accelerators. E2B has no MoE block.",
    reported: "Not an E2B change.",
  },
  {
    n: 60478,
    title: "Batched vision pooler, fused vision/audio RMSNorm and 2D RoPE",
    state: "open",
    cats: ["batch", "kernel"],
    e2b: "no",
    what: "Image, video and audio preprocessing for all five Gemma 4 sizes. A text-only throughput run does not touch it.",
    reported: "Up to 27.60x on multi-frame video pooling.",
  },
  {
    n: 60643,
    title: "Gemma4Unified 2D position embedding and batched image/video embedder",
    state: "closed",
    cats: ["batch"],
    e2b: "no",
    what: "Vision path of the 12B unified model. Closed when searched.",
    reported: "Not an E2B change.",
  },
  {
    n: 60663,
    title: "DiffusionGemma fused kernels and zero-sync batching",
    state: "open",
    cats: ["kernel", "batch"],
    e2b: "no",
    what: "A different model (block diffusion), self-conditioning MLP kernels.",
    reported: "Not an E2B change.",
  },
]
