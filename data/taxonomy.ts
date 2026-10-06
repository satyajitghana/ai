// The article taxonomy: what an article is about (topic), what it is (kind),
// who it is pitched at (level), what a reader needs to run its subject
// (runsOn), plus the tag hygiene the lists apply when they show tags.
//
// Pure data, no Node imports: the /articles client list reads it too. The
// frontmatter enums in lib/content/schema.ts are built from these ids, so an
// unknown topic or kind fails `pnpm validate` instead of becoming a chip
// nobody can find. The rubric, score and tiers that sit beside these are in
// lib/content/rating.ts; the authoring contract is in CLAUDE.md (articles row)
// and brand-crew/skills/new-article/SKILL.md.

export const TOPICS = [
  { id: "llm-architecture", label: "LLM architecture", blurb: "How language models are built: attention, mixture-of-experts, long context, new layer types." },
  { id: "training-rl", label: "Training & RL", blurb: "Pre-training, post-training, reinforcement learning and the recipes that make models better." },
  { id: "inference-serving", label: "Inference & serving", blurb: "Making models fast and cheap to run: engines, batching, KV caches, speculative decoding." },
  { id: "quantization", label: "Quantization & compression", blurb: "Fewer bits, smaller models: quantization formats, pruning, distillation." },
  { id: "agents", label: "Agents & harnesses", blurb: "Models that act: tool use, coding agents, memory and the harness around the model." },
  { id: "evals", label: "Evals & benchmarks", blurb: "How models are measured, and what the numbers do and do not say." },
  { id: "multimodal", label: "Vision & multimodal", blurb: "Models that see and read: vision encoders, VLMs, OCR and document understanding." },
  { id: "generative-media", label: "Image & video generation", blurb: "Diffusion, flow matching and world models that make pictures and video." },
  { id: "speech-audio", label: "Speech & audio", blurb: "Speech recognition, text-to-speech, voice agents and music." },
  { id: "spatial-3d", label: "3D & spatial", blurb: "Point clouds, SLAM, Gaussian splatting, depth and 3D perception." },
  { id: "robotics", label: "Robotics & embodied", blurb: "Policies, state estimation and models that move things in the world." },
  { id: "gpu-systems", label: "GPUs, kernels & systems", blurb: "Kernels, compilers, hardware and the systems work under every model." },
  { id: "security", label: "Security & safety", blurb: "Attacks, defences, alignment and what can go wrong." },
  { id: "interpretability", label: "Interpretability", blurb: "Looking inside models: probes, attribution, lenses and steering." },
  { id: "tools-infra", label: "Developer tools & infra", blurb: "Libraries, frameworks and infrastructure people build AI software with." },
  { id: "data", label: "Data & datasets", blurb: "Datasets, synthetic data, filtering and where training data comes from." },
] as const

export type TopicId = (typeof TOPICS)[number]["id"]
export const TOPIC_IDS = TOPICS.map((t) => t.id) as unknown as readonly [TopicId, ...TopicId[]]
export const topicById = (id: string) => TOPICS.find((t) => t.id === id)

export const KINDS = [
  { id: "paper", label: "Paper" },
  { id: "model", label: "Model" },
  { id: "tool", label: "Tool" },
  { id: "teardown", label: "Teardown" },
  { id: "roundup", label: "Roundup" },
  { id: "essay", label: "Essay" },
  { id: "guide", label: "Guide" },
  { id: "dataset", label: "Dataset" },
] as const
export type KindId = (typeof KINDS)[number]["id"]
export const KIND_IDS = KINDS.map((k) => k.id) as unknown as readonly [KindId, ...KindId[]]

export const LEVELS = [
  { id: "intro", label: "Intro" },
  { id: "practitioner", label: "Practitioner" },
  { id: "research", label: "Research" },
] as const
export type LevelId = (typeof LEVELS)[number]["id"]
export const LEVEL_IDS = LEVELS.map((l) => l.id) as unknown as readonly [LevelId, ...LevelId[]]

// Ordered by hardware, smallest first: "runs on my hardware ≤ X" keeps every
// entry up to and including X. `api` and `none` are not hardware and sit
// outside the ladder (`rank: null`); a hardware filter excludes them.
export const RUNS_ON = [
  { id: "browser", label: "Browser", rank: 0 },
  { id: "phone", label: "Phone", rank: 1 },
  { id: "cpu", label: "CPU / laptop", rank: 2 },
  { id: "consumer-gpu", label: "Consumer GPU", rank: 3 },
  { id: "workstation", label: "Workstation", rank: 4 },
  { id: "datacenter", label: "Datacenter", rank: 5 },
  { id: "api", label: "API only", rank: null },
  { id: "none", label: "Nothing to run", rank: null },
] as const
export type RunsOnId = (typeof RUNS_ON)[number]["id"]
export const RUNS_ON_IDS = RUNS_ON.map((r) => r.id) as unknown as readonly [RunsOnId, ...RunsOnId[]]
export const runsOnById = (id: string) => RUNS_ON.find((r) => r.id === id)

/** Licence values that are not SPDX identifiers. */
export const LICENCE_SPECIAL = ["proprietary", "mixed", "source-available", "non-commercial", "custom", "unlicensed", "n/a"] as const

// Tag hygiene. The lists, the cards and the API's `topicTags` show tags through
// `displayTags()`: an alias folds a duplicate spelling into its canonical tag,
// and a dropped tag is hidden (see DROPPED_TAGS). Frontmatter is left as written, and the related-
// articles graph (lib/related.ts) still reads the raw tags, so this map can be
// extended without moving anyone's "Related articles" list. Plain object:
// add `"spelling": "canonical"`.
export const TAG_ALIASES: Record<string, string> = {
  moe: "mixture-of-experts",
  "inference-optimization": "inference",
  "efficient-inference": "inference",
  serving: "inference",
  "inference-time": "inference",
  rl: "reinforcement-learning",
  rlhf: "reinforcement-learning",
  evaluation: "benchmarks",
  "on-device-inference": "on-device",
  "edge-inference": "on-device",
  edge: "on-device",
  "edge-ai": "on-device",
  "local-inference": "on-device",
  "local-llm": "on-device",
  embedded: "on-device",
  "language-models": "llm",
  "code-llm": "code-generation",
  coding: "code-generation",
  "model-architecture": "architecture",
  "training-methods": "training",
  qlora: "lora",
  "knowledge-distillation": "distillation",
  "speech-recognition": "asr",
  whisper: "asr",
  vlm: "vision-language-models",
  "vision-language": "vision-language-models",
  vision: "computer-vision",
  generative: "generative-models",
  "3d-perception": "3d",
  "foundation-model": "foundation-models",
  "harness-optimization": "harness",
  agentic: "agents",
  "coding-agent": "agentic-coding",
  memory: "agent-memory",
  context: "context-management",
  "structured-generation": "constrained-decoding",
  "structured-output": "constrained-decoding",
  "tool-use": "tool-calling",
  "reward-models": "reward-design",
  verification: "verifiers",
  "verifiable-ai": "verifiers",
  "information-retrieval": "retrieval",
  rag: "retrieval",
  "recurrent-depth": "looped-transformers",
  recursion: "looped-transformers",
  environments: "rl-environments",
  openenv: "rl-environments",
  evolutionary: "evolutionary-search",
  scaling: "scaling-laws",
  drosophila: "connectomics",
  "echo-state-networks": "reservoir-computing",
  "theorem-proving": "formal-methods",
  "monocular-depth": "depth-estimation",
  pdf: "document-parsing",
  parsing: "document-parsing",
  bitnet: "ternary",
  "mixture-of-agents": "multi-agent",
  streaming: "realtime",
  cost: "pricing",
  "token-economics": "pricing",
  tooling: "developer-tools",
  mlops: "infrastructure",
  deployment: "infrastructure",
  "null-results": "reproducibility",
  "ablation-study": "reproducibility",
  measurement: "reproducibility",
  auditing: "reproducibility",
  "open-data": "datasets",
  "data-filtering": "datasets",
  efficiency: "performance",
  latency: "performance",
  "chain-of-thought": "reasoning",
  gqa: "attention",
  "attention-sinks": "attention",
}

// Tags too broad to tell one article from another (`explainer` was on 349 of
// 421, `llm` on 173), or that only restate the kind. Applied after aliasing.
export const DROPPED_TAGS = new Set<string>([
  "ai",
  "architecture",
  "deep-learning",
  "explainer",
  "flagship-models",
  "foundation-models",
  "from-scratch",
  "generative-models",
  "llm",
  "model-compression",
  "open-source",
  "open-weights",
  "paper",
  "product-analysis",
  "research",
  "systems",
])

/** Canonical, deduplicated tags for display and filtering, in written order. */
export function displayTags(tags: readonly string[]): string[] {
  const out: string[] = []
  for (const t of tags) {
    const c = TAG_ALIASES[t] ?? t
    if (DROPPED_TAGS.has(c) || out.includes(c)) continue
    out.push(c)
  }
  return out
}
