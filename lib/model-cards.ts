import fs from "node:fs"
import path from "node:path"

// Hugging Face model metadata, snapshotted rather than fetched at render time.
//
// Every article on this site opens by reciting a model's parameter count, size
// and licence, and those numbers are exactly the ones upstream announcements get
// wrong. Reading them from the Hub's own API is the fix — but doing it live
// would make a page depend on huggingface.co being up, rate-limit real readers,
// and quietly change published prose whenever a repo is edited.
//
// So the fetch is an explicit, committed step (scripts/fetch-model-cards.mts →
// data/.generated/model-cards.json). The snapshot lands in a PR diff where the
// numbers can be reviewed like any other content, and each card renders the date
// it was taken. Missing data yields null rather than throwing: an article whose
// repo isn't in the snapshot still builds, and <ModelCard> degrades to a link.

export type ModelCardSnapshot = {
  /** Canonical `owner/name` as the Hub reports it. */
  id: string
  /** Org or user that owns the repo. */
  author?: string
  /** `safetensors.parameters`, keyed by dtype (BF16, F8_E4M3, U8, …). */
  parameters?: Record<string, number>
  /** `safetensors.total` — not always the sum of `parameters` for packed formats. */
  totalParameters?: number
  /** `usedStorage`, in bytes. */
  usedStorage?: number
  library?: string
  /** `config.architectures[0]`, when the repo exposes one. */
  architecture?: string
  modelType?: string
  pipelineTag?: string
  license?: string
  /** `false`, or the gate kind ("auto"/"manual") the Hub reports. */
  gated?: string | false
  downloads?: number
  likes?: number
  /** Number of files in the repo, when the sibling list was reachable. */
  fileCount?: number
  /** Count of `*.safetensors` shards — the weights, as distinct from configs. */
  shardCount?: number
  /** Count of `*.gguf` files, for quant repos that ship no safetensors. */
  ggufCount?: number
  /** Largest single file in bytes — the practical "can I download one shard" number. */
  largestFile?: number
  /** `cardData.base_model` — set when the repo declares a parent. */
  baseModel?: string
  /** "finetune" / "quantized" / "merge" / "adapter", from the base_model:<kind>: tag. */
  baseModelRelation?: string
  /** Languages the card declares. */
  languages?: string[]
  /** Curated card tags, with the machine-generated prefixes stripped. */
  topics?: string[]
  /** ISO timestamps from the Hub. */
  createdAt?: string
  lastModified?: string
  /** Short commit sha the snapshot describes — the numbers are pinned to this. */
  revision?: string
  /** ISO date the snapshot was taken. */
  fetchedAt: string
  /** Set when the API call failed; the card still renders as a link. */
  error?: string
}

export type ModelCardIndex = {
  generatedAt: string
  models: Record<string, ModelCardSnapshot>
}

const SNAPSHOT = path.join(
  process.cwd(),
  "data",
  ".generated",
  "model-cards.json"
)

let cache: ModelCardIndex | null = null

function load(): ModelCardIndex {
  if (cache) return cache
  try {
    const raw = fs.readFileSync(SNAPSHOT, "utf8")
    cache = JSON.parse(raw) as ModelCardIndex
  } catch {
    // No snapshot yet (fresh clone before the first fetch, or a partial
    // checkout). Every consumer treats this as "no data" rather than an error.
    cache = { generatedAt: "", models: {} }
  }
  return cache
}

/** Look up one repo. Case-insensitive on the owner/name pair, like the Hub. */
export function getModelCard(repo: string): ModelCardSnapshot | null {
  const { models } = load()
  const direct = models[repo]
  if (direct) return direct
  const lower = repo.toLowerCase()
  const hit = Object.keys(models).find((k) => k.toLowerCase() === lower)
  return hit ? models[hit] : null
}

export function getAllModelCards(): ModelCardIndex {
  return load()
}

// ---------------------------------------------------------------------------
// Formatting helpers. Shared with the fetch script so the snapshot and the card
// agree on what "2.52B" means.
// ---------------------------------------------------------------------------

/**
 * Parameter counts, in the units model cards actually use. 2,516,756,480 → "2.52B".
 * Deliberately not rounded to a single significant figure: the gap between a
 * stated "2B" and a measured 2.52B is the sort of thing this site points out.
 */
export function formatParams(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—"
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

/**
 * Storage, in decimal units — the Hub reports `usedStorage` in bytes and states
 * sizes in GB, so GiB conversions are left to prose that needs them. The GB/GiB
 * distinction has already caught out one release this site covered.
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—"
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TB`
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  return `${(n / 1e3).toFixed(1)} kB`
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—"
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}
