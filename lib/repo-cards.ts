import fs from "node:fs"
import path from "node:path"

// GitHub repository facts, snapshotted rather than fetched at render time.
//
// The same reasoning as lib/model-cards.ts, for the other half of the corpus:
// articles here cite far more GitHub repos than Hugging Face models, and the
// claims made about them — this is Apache-2.0, it is 500 files, it ships tests,
// the benchmark lives at this commit — are exactly the ones that rot. Reading
// them from the repo itself is the fix. Doing it live would make a page depend
// on api.github.com being up and reachable, spend a reader's rate limit, and
// quietly restate published prose every time someone pushes to main.
//
// So the fetch is an explicit, committed step (scripts/fetch-repo-cards.mts →
// data/.generated/repo-cards.json). The snapshot lands in a PR diff where the
// numbers are reviewed like any other content, and each card renders the date it
// was taken and the commit it was pinned at. Missing data yields null rather
// than throwing: an article whose repo isn't in the snapshot still builds, and
// <RepoCard> degrades to a link.
//
// Two things differ from the model-card snapshot, both on purpose:
//
//  1. There are two sources. api.github.com is the obvious one, and the one that
//     works on a machine with unrestricted network access. The other is a local
//     clone — which is how articles here are actually written, by cloning the
//     repo and reading it. A clone yields the pinned commit, the licence text,
//     the tracked file count, the language mix and whether tests exist, none of
//     which depend on anyone's API being reachable, and all of which are closer
//     to what the author of the article actually read than a star count is.
//
//  2. Because a snapshot can therefore be assembled from more than one source,
//     it records provenance PER FIELD (`sources`), and the card says so. A
//     number whose origin is unstated is a number a reader has to take on faith.

export type RepoSourceKind = "github-api" | "local-clone"

export type RepoCardSource = {
  kind: RepoSourceKind
  /** ISO date (YYYY-MM-DD) this source was read. */
  at: string
  /**
   * Where exactly: `api.github.com (token)` / `(unauthenticated)`, or the clone
   * path relative to the clone root. Recorded for review in the diff; the card
   * prints the kind and the date, not the local path.
   */
  detail?: string
  /** The snapshot fields this source supplied. This is the per-field provenance. */
  fields: string[]
}

export type RepoLanguage = {
  name: string
  /** Bytes of source attributed to this language. */
  bytes: number
  /** Files attributed to it — kept because "one 4 MB generated file" is a real case. */
  files?: number
}

export type RepoCardSnapshot = {
  /** Canonical `owner/name`. */
  id: string
  owner: string
  name: string
  description?: string
  homepage?: string
  /**
   * SPDX identifier when it could be recognised with confidence, the literal
   * string `custom` when a licence file exists but does not match a known text,
   * and absent when no licence file was found. Never a guess.
   */
  license?: string
  /** The file the licence was read from, when it came from a clone. */
  licenseFile?: string
  stars?: number
  forks?: number
  openIssues?: number
  /** Repository topics, as GitHub reports them. */
  topics?: string[]
  /** Default branch (API), or the branch that was checked out (clone). */
  branch?: string
  /** Short sha the snapshot is pinned at — every other field describes this tree. */
  commit?: string
  /** ISO timestamp of that commit. */
  commitDate?: string
  /** True when the clone was shallow: history-derived figures are unavailable. */
  shallow?: boolean
  /** Tracked files at the pinned commit. */
  fileCount?: number
  /** Source bytes per language, largest first. Prose and data files excluded. */
  languages?: RepoLanguage[]
  /** Whether the tree contains anything recognisable as a test, and how much. */
  hasTests?: boolean
  testFileCount?: number
  createdAt?: string
  pushedAt?: string
  archived?: boolean
  /** Per-endpoint ETags, so the next API refresh can be a conditional request. */
  etags?: Record<string, string>
  /** Which source supplied which fields, and when. */
  sources: RepoCardSource[]
  /** ISO date of the most recent source read — what the card prints. */
  fetchedAt: string
  /** Set when every source failed and nothing was known; the card renders a link. */
  error?: string
}

export type RepoCardIndex = {
  generatedAt: string
  repos: Record<string, RepoCardSnapshot>
}

const SNAPSHOT = path.join(
  process.cwd(),
  "data",
  ".generated",
  "repo-cards.json"
)

let cache: RepoCardIndex | null = null

function load(): RepoCardIndex {
  if (cache) return cache
  try {
    const raw = fs.readFileSync(SNAPSHOT, "utf8")
    cache = JSON.parse(raw) as RepoCardIndex
  } catch {
    // No snapshot yet (fresh clone before the first fetch, or a partial
    // checkout). Every consumer treats this as "no data" rather than an error.
    cache = { generatedAt: "", repos: {} }
  }
  return cache
}

/** Look up one repo. Case-insensitive on the owner/name pair, like GitHub. */
export function getRepoCard(repo: string): RepoCardSnapshot | null {
  const { repos } = load()
  const direct = repos[repo]
  if (direct) return direct
  const lower = repo.toLowerCase()
  const hit = Object.keys(repos).find((k) => k.toLowerCase() === lower)
  return hit ? repos[hit] : null
}

export function getAllRepoCards(): RepoCardIndex {
  return load()
}

/** Which source supplied a given field, if any. */
export function sourceForField(
  snap: RepoCardSnapshot,
  field: keyof RepoCardSnapshot
): RepoCardSource | undefined {
  return snap.sources?.find((s) => s.fields.includes(field as string))
}

/** Human label for a source, used by the card and by the fetch script's log. */
export function sourceLabel(kind: RepoSourceKind): string {
  return kind === "github-api" ? "GitHub REST API" : "local clone"
}

export const REPO_HOST = "https://github.com"

export function repoUrl(id: string): string {
  return `${REPO_HOST}/${id}`
}

// ---------------------------------------------------------------------------
// Formatting. Shared with <ModelCard> on purpose: two cards on the same page
// disagreeing about what "1.2 MB" means would be worse than the coupling.
// ---------------------------------------------------------------------------

export { formatBytes, formatCount } from "@/lib/model-cards"
