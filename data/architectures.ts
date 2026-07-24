import { z } from "zod"

// ── Model architectures ───────────────────────────────────────────────────────
// A curated gallery of the distinct, popular *model architectures* behind modern
// models — each with its own vetted distill-style diagram (wired by slug in
// components/architectures/registry.tsx) and an editorial rating on two axes:
//   • interest    — how influential / conceptually interesting the idea is (1–5)
//   • uniqueness  — how novel / mechanistically distinct it is (1–5)
// Curation rule: only genuinely distinct architectures that warrant their own
// diagram live here — not kernels/serving tricks (FlashAttention, PagedAttention),
// training objectives (MTP), or norm/activation variants. Attention KV-cache
// variants (MHA/MQA/GQA/MLA) share one comparison diagram; MoE routing variants
// share the MoE diagram. Hand-tuned, Zod-validated at import (a bad edit throws).

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
