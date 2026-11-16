import { z } from "zod"

// ── Model architectures ───────────────────────────────────────────────────────
// A curated gallery of the distinct, popular *model architectures* behind modern
// models — each with its own vetted distill-style diagram (wired by slug in
// components/architectures/registry.tsx) and an editorial rating on two axes:
//   • interest    — how influential / conceptually interesting the idea is (1–5)
//   • uniqueness  — how novel / mechanistically distinct it is (1–5)
// Curation rule: only genuinely distinct architectures that warrant their own
// diagram live here — not kernels/serving tricks (FlashAttention, PagedAttention)
// or norm/activation variants. Multi-token prediction is in as an architecture,
// not as a loss: DeepSeek-V3-style MTP adds modules (a projection, a block, a
// shared head) that ship in the checkpoint and draft tokens at inference.
// Attention KV-cache variants (MHA/MQA/GQA/MLA) share one comparison diagram;
// MoE routing variants share the MoE diagram (latent MoE has its own, since it
// changes where the width changes, not how routing works). Hand-tuned,
// Zod-validated at import (a bad edit throws).

const FAMILIES = [
  "transformer",
  "attention",
  "moe",
  "ssm",
  "positional",
  "diffusion",
  "training",
  "other",
] as const

const architecture = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  family: z.enum(FAMILIES),
  year: z.number().int().min(2014).max(2027),
  tags: z.array(z.string()).default([]),
  interest: z.number().int().min(1).max(5),
  uniqueness: z.number().int().min(1).max(5),
  summary: z.string().min(1),
  article: z.string().optional(),
  paper: z.string().optional(),
})

export type Architecture = z.infer<typeof architecture>
export type ArchFamily = (typeof FAMILIES)[number]
export const ARCH_FAMILIES = FAMILIES

const RAW: Architecture[] = [
  {
    slug: "transformer",
    name: "Transformer (decoder block)",
    family: "transformer",
    year: 2017,
    tags: ["self-attention", "residual", "foundational"],
    interest: 5,
    uniqueness: 5,
    summary:
      "The self-attention block that replaced recurrence: pre-norm → multi-head self-attention → residual, then pre-norm → MLP → residual, stacked N deep with a causal mask. Every architecture below is a variation on it.",
    article: "how-transformers-attention-works",
    paper: "https://arxiv.org/abs/1706.03762",
  },
  {
    slug: "encoder-bert",
    name: "Bidirectional encoder (BERT)",
    family: "transformer",
    year: 2018,
    tags: ["masked-lm", "bidirectional", "representations"],
    interest: 4,
    uniqueness: 3,
    summary:
      "An encoder-only stack with full (non-causal) attention, pretrained by masking tokens and predicting them — so every position sees the whole sequence. Still the default for embeddings and classification.",
    paper: "https://arxiv.org/abs/1810.04805",
  },
  {
    slug: "encoder-decoder",
    name: "Encoder–decoder (seq2seq)",
    family: "transformer",
    year: 2017,
    tags: ["cross-attention", "seq2seq", "translation"],
    interest: 4,
    uniqueness: 3,
    summary:
      "Two stacks: an encoder that reads the source bidirectionally, and a decoder that generates while cross-attending into the encoder's representations. The seq2seq form behind translation, T5 and BART.",
    article: "how-transformers-attention-works",
  },
  {
    slug: "mixture-of-experts",
    name: "Mixture-of-Experts (sparse FFN)",
    family: "moe",
    year: 2017,
    tags: ["sparse", "router", "conditional-compute"],
    interest: 5,
    uniqueness: 4,
    summary:
      "Replace the dense FFN with many expert FFNs and a router that sends each token to only a few (plus an optional always-on shared expert). Parameters scale up while per-token compute stays flat.",
    article: "mixture-of-experts-from-scratch",
  },
  {
    slug: "attention-kv",
    name: "Attention & KV-cache (MHA → MLA)",
    family: "attention",
    year: 2019,
    tags: ["kv-cache", "kv-sharing", "mla", "inference"],
    interest: 5,
    uniqueness: 4,
    summary:
      "How the Key/Value side collapses to shrink the KV cache: MHA (one KV per query head) → MQA (one shared) → GQA (a few groups) → MLA (a single compressed latent up-projected on the fly), at near-equal quality.",
    article: "attention-mechanisms",
  },
  {
    slug: "rope",
    name: "Rotary Position Embedding (RoPE)",
    family: "positional",
    year: 2021,
    tags: ["relative", "rotation", "positional"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Encode position by rotating each query/key vector by an angle proportional to its index, so the attention score depends only on the relative offset. The de-facto positional scheme in modern LLMs.",
    article: "grape-position-encoding",
  },
  {
    slug: "mamba-ssm",
    name: "Mamba / selective state space (SSM)",
    family: "ssm",
    year: 2023,
    tags: ["recurrent", "selective", "linear-time", "attention-free"],
    interest: 5,
    uniqueness: 5,
    summary:
      "A selective state-space model: a fixed-size state carried by a linear-time recurrence whose transition parameters depend on the input, giving content-based routing of information — a leading attention-free alternative.",
    paper: "https://arxiv.org/abs/2312.00752",
  },
  {
    slug: "looped-transformer",
    name: "Looped / recurrent-depth Transformer",
    family: "transformer",
    year: 2018,
    tags: ["weight-sharing", "recurrent-depth", "latent-reasoning"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Reuse the same block for several passes to buy effective depth (and latent reasoning) without adding parameters — depth paid in FLOPs, not weights.",
    article: "lotus-latent-reasoning",
  },
  {
    slug: "mixture-of-depths",
    name: "Mixture-of-Depths",
    family: "other",
    year: 2024,
    tags: ["conditional-compute", "token-routing", "dynamic-depth"],
    interest: 3,
    uniqueness: 4,
    summary:
      "A per-layer router lets each token either pass through the block or skip it via the residual, so compute is spent only where needed and effective depth becomes token-dependent under a fixed budget.",
    paper: "https://arxiv.org/abs/2404.02258",
  },
  {
    slug: "diffusion-transformer",
    name: "Diffusion Transformer (DiT / MMDiT)",
    family: "diffusion",
    year: 2022,
    tags: ["diffusion", "adaln", "joint-attention", "image-gen"],
    interest: 4,
    uniqueness: 4,
    summary:
      "A diffusion denoiser that is a Transformer over image latent patches, conditioned on the timestep and text through adaptive LayerNorm; MMDiT carries text and image tokens in separate streams that attend jointly.",
    article: "mage-flow",
  },
  {
    slug: "masked-diffusion-lm",
    name: "Masked-diffusion language model",
    family: "diffusion",
    year: 2025,
    tags: ["diffusion", "non-autoregressive", "bidirectional"],
    interest: 4,
    uniqueness: 4,
    summary:
      "A non-autoregressive language model that generates by iteratively unmasking tokens under bidirectional attention — denoising a fully masked sequence over several steps instead of left-to-right.",
    article: "illada-diffusion-language-model",
  },
  {
    slug: "kimi-k3",
    name: "Kimi K3 hybrid block + AttnRes",
    family: "attention",
    year: 2026,
    tags: ["linear-attention", "hybrid", "cross-depth-residual"],
    interest: 5,
    uniqueness: 5,
    summary:
      "A hybrid block — KDA (gated delta-rule linear attention) interleaved with Gated MLA (full attention) and Stable LatentMoE — plus Block Attention Residuals: each residual add reads a gated mix of every earlier block.",
    article: "kimi-k3",
  },
  {
    slug: "gated-deltanet-hybrid",
    name: "Gated DeltaNet hybrid (3 linear : 1 full)",
    family: "ssm",
    year: 2024,
    tags: ["linear-attention", "delta-rule", "hybrid", "fixed-state"],
    interest: 5,
    uniqueness: 4,
    summary:
      "Three layers in four swap attention for Gated DeltaNet: a fixed-size matrix memory per head that decays, erases what it held for the current key and writes the new value. Every fourth layer keeps full attention for exact recall. The 3:1 shape of Qwen3.8 and of small models like KLM.",
    article: "klm-1-6",
    paper: "https://arxiv.org/abs/2412.06464",
  },
  {
    slug: "sliding-window-attention",
    name: "Sliding-window attention (local + global)",
    family: "attention",
    year: 2020,
    tags: ["local-attention", "kv-cache", "attention-sink", "hybrid"],
    interest: 4,
    uniqueness: 3,
    summary:
      "Most layers attend only to the last W tokens, so their cache stops growing; a global layer every few layers reads the whole past. Stacked windows reach further than one, and many models keep an attention sink. The pattern in Gemma, gpt-oss and MiMo.",
    article: "mimo-v2-flash",
    paper: "https://arxiv.org/abs/2004.05150",
  },
  {
    slug: "sparse-attention-indexer",
    name: "Index-selected sparse attention (DSA)",
    family: "attention",
    year: 2025,
    tags: ["sparse-attention", "indexer", "top-k", "long-context"],
    interest: 5,
    uniqueness: 4,
    summary:
      "A small, low-precision indexer scores every cached token for each query, and the real attention reads only the top k, 2,048 in DeepSeek-V3.2. The cache keeps everything; what shrinks is what each query reads. Most open models without full attention are this.",
    article: "latent-sparse-attention",
    paper: "https://arxiv.org/abs/2512.02556",
  },
  {
    slug: "ngram-memory",
    name: "Hashed n-gram memory (Engram)",
    family: "other",
    year: 2026,
    tags: ["lookup-table", "hashing", "conditional-memory", "offload"],
    interest: 4,
    uniqueness: 5,
    summary:
      "Hash the last few tokens, reduce the hash modulo a different prime per head, and fetch one row per head from a table of hundreds of millions of rows; the rows are gated into the residual stream. Parameters that cost a lookup, not a matmul, and can live on the CPU or an SSD.",
    article: "tinfield-1",
    paper: "https://arxiv.org/abs/2601.07372",
  },
  {
    slug: "latent-moe",
    name: "Latent mixture-of-experts",
    family: "moe",
    year: 2026,
    tags: ["moe", "latent-projection", "expert-size"],
    interest: 3,
    uniqueness: 3,
    summary:
      "The router reads the full-width token, but routed experts work in a narrower latent: one shared down-projection before them, one up-projection after. Each expert gets smaller, so a layer can hold and route to more of them, at the price of two dense projections every token pays for.",
    article: "edge0-145b",
    paper: "https://arxiv.org/abs/2601.18089",
  },
  {
    slug: "hyper-connections",
    name: "Hyper-connections (HC / mHC)",
    family: "transformer",
    year: 2024,
    tags: ["residual", "multi-stream", "sinkhorn", "stability"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Widen the residual stream into N parallel streams with three small learned maps around each sublayer: a weighted read, a weighted write and a stream mixer. DeepSeek's mHC keeps the mixer doubly stochastic so its product over depth cannot blow up.",
    article: "xhc-residual-connections",
    paper: "https://arxiv.org/abs/2409.19606",
  },
  {
    slug: "multi-token-prediction",
    name: "Multi-token prediction modules",
    family: "training",
    year: 2024,
    tags: ["mtp", "speculative-decoding", "draft-model"],
    interest: 4,
    uniqueness: 3,
    summary:
      "Extra modules that predict tokens further ahead: DeepSeek-V3's each take the previous depth's hidden state and the next token's embedding, run one block and share the output head. They add training signal, then draft tokens for self-speculative decoding.",
    article: "multi-token-prediction",
    paper: "https://arxiv.org/abs/2404.19737",
  },
]

z.array(architecture).parse(RAW)
export const architectures: Architecture[] = RAW

// Derived 1–5 signal from interest + uniqueness (sum 2–10), mirroring the
// article signal tiers.
const TIERS: { min: number; level: number; label: string }[] = [
  { min: 9, level: 5, label: "Essential" },
  { min: 8, level: 4, label: "High" },
  { min: 7, level: 3, label: "Notable" },
  { min: 6, level: 2, label: "Solid" },
  { min: 0, level: 1, label: "Niche" },
]

export type ArchSignal = { score: number; level: number; label: string }

export function architectureSignal(a: Architecture): ArchSignal {
  const score = a.interest + a.uniqueness
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]
  return { score, level: tier.level, label: tier.label }
}
