import { z } from "zod"

// ── Model architectures ───────────────────────────────────────────────────────
// A curated gallery of the building-block architectures behind modern models,
// each with an editorial rating on two axes:
//   • interest    — how influential / conceptually interesting the idea is (1–5)
//   • uniqueness  — how novel / mechanistically distinct it is (1–5)
// Hand-tuned, Zod-validated at import (a bad edit throws). The derived signal
// level drives the filter + sort on /architectures. Where we've written a full
// explainer, `article` links to it; some entries also carry a distill-style
// diagram (wired by slug → component in components/architectures/registry.tsx).

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
    name: "Transformer (vanilla)",
    family: "transformer",
    year: 2017,
    tags: ["self-attention", "foundational", "seq-model"],
    interest: 5,
    uniqueness: 5,
    summary:
      "The 2017 sequence model that replaced recurrence and convolution with stacked self-attention and feed-forward blocks, letting every token attend to every other in parallel. It is the template all later language and vision transformers specialize.",
    article: "how-transformers-attention-works",
    paper: "https://arxiv.org/abs/1706.03762",
  },
  {
    slug: "gpt-decoder-only",
    name: "GPT (decoder-only Transformer)",
    family: "transformer",
    year: 2018,
    tags: ["decoder-only", "causal-lm", "llm"],
    interest: 5,
    uniqueness: 3,
    summary:
      "A transformer using only the decoder stack with causal left-to-right masking, trained to predict the next token. It is the architecture behind the GPT line and most modern LLMs.",
    article: "how-llm-inference-works",
  },
  {
    slug: "bert-encoder",
    name: "BERT (encoder-only Transformer)",
    family: "transformer",
    year: 2018,
    tags: ["encoder-only", "masked-lm", "representations"],
    interest: 4,
    uniqueness: 3,
    summary:
      "A transformer using only the encoder stack with fully bidirectional attention, pretrained by masked-language-modeling (predicting randomly masked tokens) for representation learning rather than generation.",
  },
  {
    slug: "encoder-decoder-seq2seq",
    name: "Encoder-decoder (seq2seq Transformer)",
    family: "transformer",
    year: 2017,
    tags: ["seq2seq", "cross-attention", "translation"],
    interest: 4,
    uniqueness: 3,
    summary:
      "Two transformer stacks — an encoder that reads the input and a decoder that generates output while cross-attending to the encoder's representations. This is the seq2seq form used by translation models, T5 and BART.",
  },
  {
    slug: "mixture-of-experts",
    name: "Mixture-of-Experts (sparse FFN)",
    family: "moe",
    year: 2017,
    tags: ["sparse", "routing", "conditional-compute"],
    interest: 5,
    uniqueness: 4,
    summary:
      "Replaces the dense feed-forward layer with many expert FFNs and a router that sends each token to only a few, so total parameters grow while per-token compute stays fixed. It is the basis of most frontier sparse models.",
    article: "mixture-of-experts-from-scratch",
  },
  {
    slug: "switch-transformer",
    name: "Switch Transformer",
    family: "moe",
    year: 2021,
    tags: ["top-1-routing", "sparse", "load-balancing"],
    interest: 3,
    uniqueness: 3,
    summary:
      "A Mixture-of-Experts variant that routes each token to exactly one expert instead of two, cutting router and communication cost, with a capacity limit and load-balancing loss to keep top-1 routing stable.",
    article: "switch-transformer",
  },
  {
    slug: "deepseek-moe",
    name: "DeepSeekMoE (shared + routed experts)",
    family: "moe",
    year: 2024,
    tags: ["fine-grained-experts", "shared-experts", "sparse"],
    interest: 4,
    uniqueness: 3,
    summary:
      "A Mixture-of-Experts design that splits experts into many fine-grained routed experts plus a few always-on shared experts, improving specialization and load balance. It is now a common template for open MoE models.",
  },
  {
    slug: "mixture-of-depths",
    name: "Mixture-of-Depths",
    family: "other",
    year: 2024,
    tags: ["conditional-compute", "layer-routing", "dynamic-depth"],
    interest: 3,
    uniqueness: 4,
    summary:
      "Adds a per-layer router that lets each token either pass through the block or skip it, spending compute only where needed and giving a token-dependent effective depth under a fixed budget.",
  },
  {
    slug: "multi-head-attention",
    name: "Multi-head Attention (MHA)",
    family: "attention",
    year: 2017,
    tags: ["attention", "heads", "scaled-dot-product"],
    interest: 4,
    uniqueness: 3,
    summary:
      "Runs several scaled-dot-product attention heads in parallel, each with its own query/key/value projections, then concatenates them so different heads can attend to different relationships. It is the standard attention layer.",
    article: "attention-mechanisms",
  },
  {
    slug: "multi-query-attention",
    name: "Multi-Query Attention (MQA)",
    family: "attention",
    year: 2019,
    tags: ["kv-cache", "attention", "inference"],
    interest: 3,
    uniqueness: 3,
    summary:
      "A multi-head attention variant where all heads share a single key and value projection, shrinking the KV cache and speeding decoding at some quality cost.",
    article: "attention-mechanisms",
  },
  {
    slug: "grouped-query-attention",
    name: "Grouped-Query Attention (GQA)",
    family: "attention",
    year: 2023,
    tags: ["kv-cache", "attention", "inference"],
    interest: 4,
    uniqueness: 2,
    summary:
      "Interpolates between multi-head and multi-query attention by sharing each key/value projection across a small group of query heads, trading a little memory for most of MHA's quality. It is near-universal in modern LLMs.",
    article: "attention-mechanisms",
  },
  {
    slug: "multi-head-latent-attention",
    name: "Multi-head Latent Attention (MLA)",
    family: "attention",
    year: 2024,
    tags: ["kv-cache", "low-rank", "attention"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Compresses keys and values into a small shared latent vector that is cached instead of full per-head K/V, cutting KV-cache memory while keeping multi-head expressivity. It was introduced with DeepSeek-V2.",
    article: "attention-mechanisms",
  },
  {
    slug: "flash-attention",
    name: "FlashAttention",
    family: "attention",
    year: 2022,
    tags: ["io-aware", "kernel", "exact-attention"],
    interest: 5,
    uniqueness: 4,
    summary:
      "An exact-attention algorithm that tiles the computation and never materializes the full attention matrix in memory, fusing the softmax into one IO-aware GPU kernel for large speed and memory gains.",
    article: "attention-mechanisms",
  },
  {
    slug: "paged-attention",
    name: "PagedAttention",
    family: "attention",
    year: 2023,
    tags: ["kv-cache", "serving", "memory"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Stores the KV cache in fixed-size non-contiguous blocks managed like operating-system virtual-memory pages, eliminating fragmentation and enabling sharing across sequences. It is the serving technique behind vLLM.",
    article: "attention-mechanisms",
  },
  {
    slug: "sliding-window-attention",
    name: "Sliding-window attention",
    family: "attention",
    year: 2020,
    tags: ["local-attention", "long-context", "sparse"],
    interest: 3,
    uniqueness: 2,
    summary:
      "Restricts each token to attend only to a fixed-size local window of recent tokens, making attention linear in sequence length; stacking layers still propagates information over long ranges.",
    article: "attention-mechanisms",
  },
  {
    slug: "native-sparse-attention",
    name: "Native Sparse Attention (NSA)",
    family: "attention",
    year: 2025,
    tags: ["sparse", "trainable", "long-context"],
    interest: 4,
    uniqueness: 4,
    summary:
      "A natively trainable sparse attention that compresses, selects, and locally windows the context in hardware-aligned blocks, so the model learns which blocks to read instead of attending to everything.",
    article: "attention-mechanisms",
  },
  {
    slug: "linear-attention",
    name: "Linear attention",
    family: "attention",
    year: 2020,
    tags: ["kernel", "linear-time", "recurrent"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Replaces the softmax with a kernel feature map so attention becomes a running sum, turning cost from quadratic to linear in sequence length and giving an RNN-like recurrent form.",
    article: "attention-mechanisms",
  },
  {
    slug: "differential-attention",
    name: "Differential Attention",
    family: "attention",
    year: 2024,
    tags: ["noise-cancellation", "attention", "dual-softmax"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Computes two separate softmax attention maps and subtracts one from the other, cancelling common-mode attention noise so the layer focuses more sharply on relevant context.",
    article: "motif-2-6b",
  },
  {
    slug: "minimax-sparse-attention",
    name: "MiniMax Sparse Attention (MSA)",
    family: "attention",
    year: 2026,
    tags: ["sparse", "block-selection", "long-context"],
    interest: 3,
    uniqueness: 3,
    summary:
      "A content-based sparse attention where a lightweight index scores past key/value blocks and each query attends only its top-scoring few, kept exact but cheap, with different heads selecting different blocks.",
    article: "minimax-sparse-attention",
  },
  {
    slug: "hydrahead-hybrid-attention",
    name: "Head-level hybrid attention (HydraHead)",
    family: "attention",
    year: 2026,
    tags: ["hybrid-attention", "retrieval-heads", "long-context"],
    interest: 3,
    uniqueness: 4,
    summary:
      "Hybridizes full and linear attention at the head level within a layer, keeping expensive full attention only for the few heads that do long-range retrieval and using linear attention for the rest.",
    article: "hydrahead",
  },
  {
    slug: "kimi-delta-attention",
    name: "Kimi Delta Attention (KDA)",
    family: "attention",
    year: 2026,
    tags: ["linear-attention", "delta-rule", "gated-state"],
    interest: 3,
    uniqueness: 3,
    summary:
      "A gated delta-rule linear-attention variant that updates a recurrent state with a learned forgetting and correction term, used as the cheap attention in Kimi K3's hybrid stack.",
    article: "kimi-k3",
  },
  {
    slug: "attention-residuals",
    name: "Block Attention Residuals (AttnRes)",
    family: "transformer",
    year: 2026,
    tags: ["residual", "cross-depth", "gated-skip"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Replaces the single skip connection with a learnable gate that can mix in the output of every earlier block, not just the one below — turning the residual stream into a cross-depth read, used in Kimi K3.",
    article: "kimi-k3",
  },
  {
    slug: "rope",
    name: "Rotary Position Embedding (RoPE)",
    family: "positional",
    year: 2021,
    tags: ["relative-position", "rotation", "positional"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Encodes position by rotating each query and key vector by an angle proportional to its position, so their dot product depends only on relative distance. It is the dominant positional scheme in modern LLMs.",
    article: "grape-position-encoding",
  },
  {
    slug: "alibi",
    name: "ALiBi (Attention with Linear Biases)",
    family: "positional",
    year: 2021,
    tags: ["relative-position", "extrapolation", "positional"],
    interest: 4,
    uniqueness: 3,
    summary:
      "Adds a fixed linear penalty to attention scores proportional to the distance between tokens instead of using position embeddings, which helps models extrapolate to longer sequences than seen in training.",
    article: "grape-position-encoding",
  },
  {
    slug: "mamba-selective-ssm",
    name: "Mamba (selective state space model)",
    family: "ssm",
    year: 2023,
    tags: ["state-space", "selective", "attention-free"],
    interest: 5,
    uniqueness: 5,
    summary:
      "A selective state-space model whose state-transition parameters depend on the input, letting it route or forget information content-adaptively, computed with a hardware-aware parallel scan in linear time. It is a leading attention-free alternative.",
  },
  {
    slug: "rwkv",
    name: "RWKV",
    family: "ssm",
    year: 2023,
    tags: ["rnn", "linear-attention", "attention-free"],
    interest: 4,
    uniqueness: 4,
    summary:
      "An architecture that trains like a transformer but runs like an RNN, using a linear-attention-style recurrence with time-decay so inference is constant-memory per token with no KV cache.",
  },
  {
    slug: "looped-transformer",
    name: "Looped / recurrent-depth Transformer",
    family: "transformer",
    year: 2018,
    tags: ["weight-tying", "recurrent-depth", "latent-reasoning"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Reuses the same transformer layers for several passes to gain effective depth without more parameters; recurrent-depth and looped-padded variants use the extra passes to reason in latent space.",
    article: "lotus-latent-reasoning",
  },
  {
    slug: "multi-token-prediction",
    name: "Multi-Token Prediction (MTP)",
    family: "training",
    year: 2024,
    tags: ["objective", "speculative-decoding", "draft-model"],
    interest: 4,
    uniqueness: 3,
    summary:
      "Trains the model to predict several future tokens at once via extra heads or modules, which improves the main model and provides a built-in draft model for faster speculative decoding.",
    article: "multi-token-prediction",
  },
  {
    slug: "diffusion-transformer-dit",
    name: "Diffusion Transformer (DiT)",
    family: "diffusion",
    year: 2022,
    tags: ["diffusion", "image-gen", "adaln"],
    interest: 4,
    uniqueness: 3,
    summary:
      "A diffusion model that replaces the usual U-Net denoiser with a transformer operating on latent image patches, conditioned through adaptive layer norm. It is the backbone of modern image and video generators.",
  },
  {
    slug: "mmdit",
    name: "MMDiT (multimodal Diffusion Transformer)",
    family: "diffusion",
    year: 2024,
    tags: ["diffusion", "multimodal", "text-to-image"],
    interest: 3,
    uniqueness: 3,
    summary:
      "A multimodal diffusion transformer that carries text and image tokens in separate streams with their own weights but lets them attend jointly, improving text-image alignment. It is used in Stable Diffusion 3 and Mage-Flow.",
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
      "A non-autoregressive language model that generates by iteratively unmasking tokens under bidirectional attention, denoising a fully masked sequence over several steps instead of left-to-right.",
    article: "illada-diffusion-language-model",
  },
  {
    slug: "set-diffusion",
    name: "Set Diffusion",
    family: "diffusion",
    year: 2026,
    tags: ["diffusion", "any-order", "kv-cache"],
    interest: 4,
    uniqueness: 4,
    summary:
      "Factorizes generation over flexible-position, flexible-length token sets, recovering autoregression, block diffusion, and any-order diffusion as special cases while keeping a usable KV cache and infilling.",
    article: "set-diffusion",
  },
  {
    slug: "polynorm",
    name: "PolyNorm (polynomial normalization)",
    family: "other",
    year: 2024,
    tags: ["normalization", "activation", "nonlinearity"],
    interest: 2,
    uniqueness: 3,
    summary:
      "A learned polynomial activation and normalization that combines several powers of the normalized input with learned coefficients, giving a more expressive nonlinearity than a fixed activation.",
    article: "motif-2-6b",
  },
  {
    slug: "tapered-language-model",
    name: "Tapered Language Model",
    family: "transformer",
    year: 2026,
    tags: ["width-allocation", "non-uniform", "scaling"],
    interest: 3,
    uniqueness: 3,
    summary:
      "Breaks the usual uniform-width transformer by pouring more feed-forward width into early layers and tapering later ones under a fixed parameter budget, improving perplexity at no extra cost.",
    article: "tapered-language-models",
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
