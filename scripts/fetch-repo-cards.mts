import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

// Snapshot GitHub repository facts for <RepoCard> into
// data/.generated/repo-cards.json. Machine-generated — do not hand-edit.
//
// Deliberately NOT part of `prebuild`, for the same reason as the model-card
// fetch: a page that hit api.github.com at build time would break whenever
// GitHub was slow or the build host was rate-limited, and would silently
// restate published numbers as repos change. Running this explicitly puts the
// numbers in a reviewable diff and pins them to a commit the card displays.
//
//   pnpm fetch:repos                 # refresh every repo referenced by an article
//   pnpm fetch:repos --check         # exit 1 if any referenced repo is missing
//   pnpm fetch:repos owner/name…     # refresh only these
//   pnpm fetch:repos --clones        # snapshot every clone sitting beside this repo
//
//   --api-only / --clone-only        # force one source instead of trying both
//   --force                          # ignore stored ETags (send no If-None-Match)
//   --clones-dir=<path>              # where clones live (default: the parent dir)
//
// TWO SOURCES, in this order:
//
//   1. The GitHub REST API. Conditional (ETag) requests, `GITHUB_TOKEN` when the
//      environment has one. This is the mode that works on a machine with open
//      network access, and it is the only source for stars, forks, topics and
//      the repo's own description.
//
//   2. A local clone at <clones-dir>/<owner>/<name>. This is the normal case
//      here: articles on this site are written by cloning the repo and reading
//      it, so the clone is already on disk, and the API is frequently
//      unreachable from the sandbox those articles are written in. A clone
//      yields the pinned commit and its date, the licence (parsed from the
//      licence file, conservatively — "custom" rather than a guess), the
//      tracked file count, a language breakdown by extension and whether tests
//      exist. Every one of those describes the tree the author actually read,
//      which is better evidence about a repository than its star count.
//
// The two are merged field by field, and every field records which source it
// came from and when (`sources`), so a card assembled from both still says
// where each number is from. Nothing is silently attributed.

import {
  formatBytes,
  sourceLabel,
  type RepoCardIndex,
  type RepoCardSnapshot,
  type RepoCardSource,
  type RepoLanguage,
  type RepoSourceKind,
} from "../lib/repo-cards"

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, "content")
const OUT_DIR = path.join(ROOT, "data", ".generated")
const OUT = path.join(OUT_DIR, "repo-cards.json")

const API = "https://api.github.com"
const TODAY = new Date().toISOString().slice(0, 10)

/** Matches `repo="owner/name"` on a RepoCard tag, single or double quoted. */
const REPOCARD_RE = /<RepoCard\b[^>]*?\brepo=["']([^"']+)["']/g

// ---------------------------------------------------------------------------
// Which repos to snapshot
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith(".mdx")) out.push(p)
  }
  return out
}

/** Every repo referenced by a <RepoCard> anywhere in content/. */
function referencedRepos(): Map<string, string[]> {
  const byRepo = new Map<string, string[]>()
  if (!fs.existsSync(CONTENT_DIR)) return byRepo
  for (const file of walk(CONTENT_DIR)) {
    const body = fs.readFileSync(file, "utf8")
    for (const m of body.matchAll(REPOCARD_RE)) {
      const repo = m[1].trim()
      const rel = path.relative(ROOT, file)
      const seen = byRepo.get(repo)
      if (seen) {
        if (!seen.includes(rel)) seen.push(rel)
      } else {
        byRepo.set(repo, [rel])
      }
    }
  }
  return byRepo
}

/** Every `<clones-dir>/<owner>/<name>/.git` on disk, as owner/name. */
function discoverClones(cloneRoot: string): string[] {
  const out: string[] = []
  let owners: fs.Dirent[]
  try {
    owners = fs.readdirSync(cloneRoot, { withFileTypes: true })
  } catch {
    return out
  }
  for (const owner of owners) {
    if (!owner.isDirectory() || owner.name.startsWith(".")) continue
    let names: fs.Dirent[]
    try {
      names = fs.readdirSync(path.join(cloneRoot, owner.name), {
        withFileTypes: true,
      })
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.isDirectory()) continue
      if (fs.existsSync(path.join(cloneRoot, owner.name, name.name, ".git"))) {
        out.push(`${owner.name}/${name.name}`)
      }
    }
  }
  return out.sort()
}

// ---------------------------------------------------------------------------
// Licence detection — conservative on purpose
// ---------------------------------------------------------------------------

const LICENSE_FILE_RE = /^(licen[sc]e|copying)(-[\w.]+)?(\.(md|txt|rst))?$/i

/**
 * SPDX identifier when the text is unmistakable, `"custom"` when there is a
 * licence file that matches nothing known. Never a guess: the difference
 * between Apache-2.0 and "a bespoke research licence that forbids commercial
 * use" is exactly the kind of claim an article gets held to.
 */
function detectLicense(raw: string): string {
  const t = raw.slice(0, 6000).toLowerCase().replace(/\s+/g, " ")

  if (/gnu affero general public license,? version 3/.test(t)) return "AGPL-3.0"
  if (/gnu lesser general public license,? version 3/.test(t)) return "LGPL-3.0"
  if (/gnu lesser general public license,? version 2\.1/.test(t))
    return "LGPL-2.1"
  if (/gnu general public license,? version 3/.test(t)) return "GPL-3.0"
  if (/gnu general public license,? version 2/.test(t)) return "GPL-2.0"
  if (/apache license,? version 2\.0/.test(t)) return "Apache-2.0"
  if (/mozilla public license,? version 2\.0/.test(t)) return "MPL-2.0"
  if (
    /permission to use, copy, modify, and\/or distribute this software for any purpose/.test(
      t
    )
  )
    return "ISC"
  if (
    /^mit license/.test(t) ||
    (/permission is hereby granted, free of charge/.test(t) &&
      /without restriction, including without limitation the rights/.test(t))
  )
    return "MIT"
  if (/redistribution and use in source and binary forms/.test(t)) {
    if (/all advertising materials mentioning features/.test(t))
      return "BSD-4-Clause"
    if (/neither the name of/.test(t)) return "BSD-3-Clause"
    return "BSD-2-Clause"
  }
  if (/this is free and unencumbered software released into the public/.test(t))
    return "Unlicense"
  if (/cc0 1\.0 universal/.test(t)) return "CC0-1.0"
  if (/attribution-noncommercial-sharealike 4\.0 international/.test(t))
    return "CC-BY-NC-SA-4.0"
  if (/attribution-noncommercial 4\.0 international/.test(t))
    return "CC-BY-NC-4.0"
  if (/attribution-sharealike 4\.0 international/.test(t)) return "CC-BY-SA-4.0"
  if (/attribution 4\.0 international/.test(t)) return "CC-BY-4.0"

  return "custom"
}

// ---------------------------------------------------------------------------
// Language attribution by extension
// ---------------------------------------------------------------------------

type LangKind = "code" | "prose" | "data"

// Only `code` reaches the breakdown. A repo that reads "70% JSON" because it
// ships fixtures tells a reader nothing about what is in it; Linguist excludes
// prose and data from repo stats for the same reason.
const EXT_LANG: Record<string, [string, LangKind]> = {
  ".py": ["Python", "code"],
  ".pyi": ["Python", "code"],
  ".pyx": ["Cython", "code"],
  ".ipynb": ["Jupyter Notebook", "code"],
  ".ts": ["TypeScript", "code"],
  ".tsx": ["TypeScript", "code"],
  ".mts": ["TypeScript", "code"],
  ".cts": ["TypeScript", "code"],
  ".js": ["JavaScript", "code"],
  ".jsx": ["JavaScript", "code"],
  ".mjs": ["JavaScript", "code"],
  ".cjs": ["JavaScript", "code"],
  ".rs": ["Rust", "code"],
  ".go": ["Go", "code"],
  ".c": ["C", "code"],
  ".h": ["C", "code"],
  ".cc": ["C++", "code"],
  ".cpp": ["C++", "code"],
  ".cxx": ["C++", "code"],
  ".hpp": ["C++", "code"],
  ".hh": ["C++", "code"],
  ".hxx": ["C++", "code"],
  ".cu": ["CUDA", "code"],
  ".cuh": ["CUDA", "code"],
  ".metal": ["Metal", "code"],
  ".wgsl": ["WGSL", "code"],
  ".glsl": ["GLSL", "code"],
  ".comp": ["GLSL", "code"],
  ".m": ["Objective-C", "code"],
  ".mm": ["Objective-C++", "code"],
  ".swift": ["Swift", "code"],
  ".java": ["Java", "code"],
  ".kt": ["Kotlin", "code"],
  ".kts": ["Kotlin", "code"],
  ".scala": ["Scala", "code"],
  ".cs": ["C#", "code"],
  ".rb": ["Ruby", "code"],
  ".php": ["PHP", "code"],
  ".sh": ["Shell", "code"],
  ".bash": ["Shell", "code"],
  ".zsh": ["Shell", "code"],
  ".ps1": ["PowerShell", "code"],
  ".lua": ["Lua", "code"],
  ".pl": ["Perl", "code"],
  ".r": ["R", "code"],
  ".jl": ["Julia", "code"],
  ".dart": ["Dart", "code"],
  ".zig": ["Zig", "code"],
  ".nim": ["Nim", "code"],
  ".hs": ["Haskell", "code"],
  ".ml": ["OCaml", "code"],
  ".mli": ["OCaml", "code"],
  ".ex": ["Elixir", "code"],
  ".exs": ["Elixir", "code"],
  ".erl": ["Erlang", "code"],
  ".clj": ["Clojure", "code"],
  ".sql": ["SQL", "code"],
  ".proto": ["Protocol Buffers", "code"],
  ".css": ["CSS", "code"],
  ".scss": ["SCSS", "code"],
  ".html": ["HTML", "code"],
  ".vue": ["Vue", "code"],
  ".svelte": ["Svelte", "code"],
  ".tex": ["TeX", "prose"],
  ".md": ["Markdown", "prose"],
  ".mdx": ["MDX", "prose"],
  ".rst": ["reStructuredText", "prose"],
  ".txt": ["Text", "prose"],
  ".json": ["JSON", "data"],
  ".jsonl": ["JSON", "data"],
  ".yaml": ["YAML", "data"],
  ".yml": ["YAML", "data"],
  ".toml": ["TOML", "data"],
  ".csv": ["CSV", "data"],
  ".xml": ["XML", "data"],
}

const FILENAME_LANG: Record<string, [string, LangKind]> = {
  makefile: ["Makefile", "code"],
  dockerfile: ["Dockerfile", "code"],
  "cmakelists.txt": ["CMake", "code"],
  ".cmake": ["CMake", "code"],
}

// Tracked-but-not-ours: a vendored dependency tree is not this project's code.
const VENDORED_DIR =
  /(^|\/)(node_modules|vendor|third_party|thirdparty|external|\.yarn)(\/|$)/

const TEST_DIR = /(^|\/)(tests?|__tests__|specs?|testing)(\/|$)/i
const TEST_FILE =
  /(^|\/)(conftest\.py|test_[^/]+\.(py|cc|cpp|c)|[^/]+_test\.(py|go|rs|cc|cpp|ts|js)|[^/]+\.(test|spec)\.(ts|tsx|js|jsx|mjs)|[^/]+Tests?\.(java|cs|kt|swift))$/

// ---------------------------------------------------------------------------
// Source 2: a local clone
// ---------------------------------------------------------------------------

function git(dir: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return null
  }
}

/** `https://github.com/o/n.git`, `git@github.com:o/n.git`, … → `o/n`. */
function remoteToId(url: string): string | null {
  const m = url
    .trim()
    .replace(/\.git$/, "")
    .match(/github\.com[:/]+([^/]+)\/([^/]+?)\/?$/i)
  return m ? `${m[1]}/${m[2]}` : null
}

type SourceResult =
  { data: Partial<RepoCardSnapshot>; detail: string } | { error: string }

function fromClone(id: string, dir: string, label: string): SourceResult {
  if (!fs.existsSync(path.join(dir, ".git")))
    return { error: `no clone at ${dir}` }

  // A clone whose origin is a different repository would attribute one repo's
  // facts to another. Refuse rather than guess from the directory name.
  const remote = git(dir, ["remote", "get-url", "origin"])
  const remoteId = remote ? remoteToId(remote) : null
  if (remoteId && remoteId.toLowerCase() !== id.toLowerCase())
    return { error: `clone at ${dir} has origin ${remoteId}` }

  const head = git(dir, ["rev-parse", "HEAD"])?.trim()
  const commitDate = git(dir, ["log", "-1", "--format=%cI"])?.trim()
  const branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"])?.trim()
  const shallow =
    git(dir, ["rev-parse", "--is-shallow-repository"])?.trim() === "true"

  const listed = git(dir, ["ls-files", "-z"])
  if (listed === null) return { error: `not a readable git repo: ${dir}` }
  const files = listed.split("\0").filter(Boolean)

  // Languages, by bytes of tracked source. Sizes come from the working tree,
  // which is the checked-out pinned commit; a file we cannot stat (LFS pointer,
  // sparse checkout) is skipped rather than counted as zero.
  const byLang = new Map<string, RepoLanguage>()
  let testFileCount = 0
  for (const rel of files) {
    if (TEST_DIR.test(rel) || TEST_FILE.test(rel)) testFileCount++
    if (VENDORED_DIR.test(rel)) continue
    const base = path.basename(rel).toLowerCase()
    if (base.endsWith(".min.js") || base.endsWith(".min.css")) continue
    const ext = path.extname(rel).toLowerCase()
    const entry = EXT_LANG[ext] ?? FILENAME_LANG[base]
    if (!entry || entry[1] !== "code") continue
    let size = 0
    try {
      size = fs.statSync(path.join(dir, rel)).size
    } catch {
      continue
    }
    const prev = byLang.get(entry[0])
    if (prev) {
      prev.bytes += size
      prev.files = (prev.files ?? 0) + 1
    } else {
      byLang.set(entry[0], { name: entry[0], bytes: size, files: 1 })
    }
  }
  const languages = [...byLang.values()]
    .filter((l) => l.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
    .slice(0, 8)

  // Licence, from the file at the root of the pinned tree.
  let license: string | undefined
  let licenseFile: string | undefined
  for (const rel of files) {
    if (rel.includes("/")) continue
    if (!LICENSE_FILE_RE.test(rel)) continue
    try {
      license = detectLicense(fs.readFileSync(path.join(dir, rel), "utf8"))
      licenseFile = rel
    } catch {
      /* unreadable — leave undefined rather than assert a licence */
    }
    break
  }

  const data: Partial<RepoCardSnapshot> = {
    license,
    licenseFile,
    branch,
    commit: head?.slice(0, 7),
    commitDate,
    shallow: shallow || undefined,
    fileCount: files.length,
    languages: languages.length ? languages : undefined,
    hasTests: testFileCount > 0,
    testFileCount: testFileCount || undefined,
  }
  return { data, detail: remoteId ? label : `${label} (no origin remote)` }
}

// ---------------------------------------------------------------------------
// Source 1: the GitHub REST API
// ---------------------------------------------------------------------------

type ApiResult =
  | { kind: "ok"; json: Record<string, unknown>; etag?: string }
  | { kind: "not-modified" }
  | { kind: "error"; error: string }

async function ghGet(
  pathname: string,
  etag?: string,
  force?: boolean
): Promise<ApiResult> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "ai.thesatyajit.com repo-card snapshot",
  }
  if (token) headers.authorization = `Bearer ${token}`
  // Conditional request: a 304 costs no rate-limit quota and leaves the
  // committed numbers exactly as they are.
  if (etag && !force) headers["if-none-match"] = etag

  let res: Response
  try {
    res = await fetch(`${API}${pathname}`, { headers })
  } catch (err) {
    return { kind: "error", error: `network: ${(err as Error).message}` }
  }

  if (res.status === 304) return { kind: "not-modified" }
  if (res.ok) {
    return {
      kind: "ok",
      json: (await res.json()) as Record<string, unknown>,
      etag: res.headers.get("etag") ?? undefined,
    }
  }

  // Say precisely what went wrong: "403" alone has sent people hunting for a
  // deleted repository when the real answer was an exhausted rate limit.
  const remaining = res.headers.get("x-ratelimit-remaining")
  const reset = res.headers.get("x-ratelimit-reset")
  if ((res.status === 403 || res.status === 429) && remaining === "0") {
    const at = reset
      ? new Date(Number(reset) * 1000).toISOString().replace(".000Z", "Z")
      : "an unknown time"
    return {
      kind: "error",
      error: `rate limited until ${at}${
        process.env.GITHUB_TOKEN ? "" : " — set GITHUB_TOKEN to raise the limit"
      }`,
    }
  }
  if (res.status === 403)
    return {
      kind: "error",
      error: "403 forbidden — network policy or token scope blocks this host",
    }
  if (res.status === 401)
    return { kind: "error", error: "401 — GITHUB_TOKEN was rejected" }
  if (res.status === 404)
    return {
      kind: "error",
      error: `404 — no such repository${
        process.env.GITHUB_TOKEN ? "" : " (private? set GITHUB_TOKEN)"
      }`,
    }
  return { kind: "error", error: `HTTP ${res.status}` }
}

async function fromApi(
  id: string,
  prev: RepoCardSnapshot | undefined,
  force: boolean
): Promise<SourceResult | { unchanged: true }> {
  const etags = { ...(prev?.etags ?? {}) }

  const repo = await ghGet(`/repos/${id}`, etags.repo, force)
  if (repo.kind === "error") return { error: repo.error }

  const data: Partial<RepoCardSnapshot> = {}
  let changed = false

  if (repo.kind === "ok") {
    changed = true
    if (repo.etag) etags.repo = repo.etag
    const d = repo.json
    const license = d.license as { spdx_id?: string | null } | null
    const spdx = license?.spdx_id ?? undefined
    data.description = (d.description as string | null) ?? undefined
    data.homepage = (d.homepage as string | null) || undefined
    // GitHub says NOASSERTION when its own detector could not place the file —
    // the same honest answer this script's clone reader gives as "custom".
    data.license = spdx === "NOASSERTION" ? "custom" : (spdx ?? undefined)
    data.stars = d.stargazers_count as number | undefined
    data.forks = d.forks_count as number | undefined
    data.openIssues = d.open_issues_count as number | undefined
    data.topics = ((d.topics as string[] | undefined) ?? []).slice(0, 8)
    if (!data.topics.length) delete data.topics
    data.branch = d.default_branch as string | undefined
    data.createdAt = d.created_at as string | undefined
    data.pushedAt = d.pushed_at as string | undefined
    data.archived = (d.archived as boolean | undefined) || undefined
  }

  const branch = data.branch ?? prev?.branch ?? "HEAD"

  const langs = await ghGet(`/repos/${id}/languages`, etags.languages, force)
  if (langs.kind === "ok") {
    changed = true
    if (langs.etag) etags.languages = langs.etag
    const entries = Object.entries(langs.json as Record<string, number>)
      .filter(([, bytes]) => bytes > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
    if (entries.length)
      data.languages = entries.map(([name, bytes]) => ({ name, bytes }))
  }

  const commit = await ghGet(
    `/repos/${id}/commits/${branch}`,
    etags.commit,
    force
  )
  if (commit.kind === "ok") {
    changed = true
    if (commit.etag) etags.commit = commit.etag
    const c = commit.json
    data.commit = (c.sha as string | undefined)?.slice(0, 7)
    const committer = (
      c.commit as { committer?: { date?: string } } | undefined
    )?.committer
    data.commitDate = committer?.date
  }

  if (!changed) return { unchanged: true }

  const detail = `api.github.com (${
    process.env.GITHUB_TOKEN ? "token" : "unauthenticated"
  })`
  return { data: { ...data, etags }, detail }
}

// ---------------------------------------------------------------------------
// Merge: per-field provenance
// ---------------------------------------------------------------------------

// Fixed emission order, so a refresh that changes one number produces a
// one-line diff instead of a reshuffled object.
const FIELD_ORDER: (keyof RepoCardSnapshot)[] = [
  "id",
  "owner",
  "name",
  "description",
  "homepage",
  "license",
  "licenseFile",
  "stars",
  "forks",
  "openIssues",
  "topics",
  "branch",
  "commit",
  "commitDate",
  "shallow",
  "fileCount",
  "languages",
  "hasTests",
  "testFileCount",
  "createdAt",
  "pushedAt",
  "archived",
  "etags",
  "sources",
  "fetchedAt",
  "error",
]

// Bookkeeping, not facts about the repository — these never appear in a
// source's field list.
const NOT_A_FIELD = new Set([
  "id",
  "owner",
  "name",
  "etags",
  "sources",
  "fetchedAt",
  "error",
])

function mergeSource(
  id: string,
  prev: RepoCardSnapshot | undefined,
  kind: RepoSourceKind,
  data: Partial<RepoCardSnapshot>,
  detail: string
): RepoCardSnapshot {
  const [owner, name] = id.split("/")
  const supplied = Object.keys(data).filter(
    (k) =>
      !NOT_A_FIELD.has(k) && data[k as keyof RepoCardSnapshot] !== undefined
  )

  // Fields this source now owns are taken off every other source's list; a
  // source left owning nothing drops out entirely.
  const others: RepoCardSource[] = (prev?.sources ?? [])
    .filter((s) => s.kind !== kind)
    .map((s) => ({
      ...s,
      fields: s.fields.filter((f) => !supplied.includes(f)),
    }))
    .filter((s) => s.fields.length)

  const sources: RepoCardSource[] = supplied.length
    ? [...others, { kind, at: TODAY, detail, fields: supplied.sort() }]
    : others

  const merged: RepoCardSnapshot = {
    ...(prev ?? {}),
    ...data,
    id,
    owner,
    name,
    sources: sources.sort((a, b) => a.kind.localeCompare(b.kind)),
    fetchedAt: sources.reduce((max, s) => (s.at > max ? s.at : max), ""),
  }
  delete merged.error

  const ordered: Record<string, unknown> = {}
  for (const k of FIELD_ORDER) {
    const v = merged[k]
    if (v !== undefined) ordered[k] = v
  }
  return ordered as unknown as RepoCardSnapshot
}

// ---------------------------------------------------------------------------

function describe(snap: RepoCardSnapshot): string {
  const bits: string[] = []
  if (snap.commit) bits.push(`@${snap.commit}`)
  if (typeof snap.stars === "number") bits.push(`${snap.stars} stars`)
  if (typeof snap.fileCount === "number") bits.push(`${snap.fileCount} files`)
  if (snap.license) bits.push(snap.license)
  const top = snap.languages?.[0]
  if (top) bits.push(`${top.name} ${formatBytes(top.bytes)}`)
  if (snap.hasTests !== undefined)
    bits.push(
      snap.hasTests ? `${snap.testFileCount ?? 0} test files` : "no tests"
    )
  return bits.join(" · ")
}

async function main() {
  const args = process.argv.slice(2)
  const flag = (n: string) => args.includes(`--${n}`)
  const checkOnly = flag("check")
  const apiOnly = flag("api-only")
  const cloneOnly = flag("clone-only")
  const force = flag("force")
  const cloneRoot = path.resolve(
    args
      .find((a) => a.startsWith("--clones-dir="))
      ?.slice("--clones-dir=".length) ??
      process.env.REPO_CARD_CLONES ??
      path.join(ROOT, "..")
  )
  const explicit = args.filter((a) => !a.startsWith("--"))

  const referenced = referencedRepos()

  let existing: RepoCardIndex = { generatedAt: "", repos: {} }
  try {
    existing = JSON.parse(fs.readFileSync(OUT, "utf8")) as RepoCardIndex
  } catch {
    /* first run */
  }

  if (checkOnly) {
    const missing = [...referenced.keys()].filter((r) => !existing.repos[r])
    if (missing.length) {
      console.error(
        `✗ ${missing.length} repo(s) referenced by a <RepoCard> but absent from the snapshot:`
      )
      for (const r of missing) {
        console.error(`    ${r}  (${referenced.get(r)!.join(", ")})`)
      }
      console.error("  run: pnpm fetch:repos")
      process.exit(1)
    }
    console.log(
      `✓ repo-card snapshot covers all ${referenced.size} referenced repo(s)`
    )
    return
  }

  const targets = flag("clones")
    ? discoverClones(cloneRoot)
    : explicit.length
      ? explicit
      : [...referenced.keys()]

  if (!targets.length) {
    console.log(
      flag("clones")
        ? `no clones found under ${cloneRoot} — nothing to snapshot`
        : "no <RepoCard repo=…> references found — nothing to fetch"
    )
    return
  }

  const repos: Record<string, RepoCardSnapshot> = { ...existing.repos }
  const used: Record<RepoSourceKind, number> = {
    "github-api": 0,
    "local-clone": 0,
  }
  let unchanged = 0
  let failed = 0

  // Sequential on purpose: this is a courtesy crawl of someone else's API, and
  // the list is small enough that parallelism buys nothing worth the rudeness.
  for (const id of targets) {
    const prev = repos[id]
    const cloneDir = path.join(cloneRoot, ...id.split("/"))
    let apiError: string | undefined

    if (!cloneOnly) {
      const api = await fromApi(id, prev, force)
      if ("unchanged" in api) {
        unchanged++
        console.log(`  = ${id} — unchanged (304, ${sourceLabel("github-api")})`)
        continue
      }
      if ("data" in api) {
        const snap = mergeSource(id, prev, "github-api", api.data, api.detail)
        repos[id] = snap
        used["github-api"]++
        console.log(
          `  ✓ ${id} — ${sourceLabel("github-api")} · ${describe(snap)}`
        )
        continue
      }
      apiError = api.error
    }

    if (apiOnly) {
      failed++
      console.warn(`  ! ${id} — ${apiError}`)
      if (!prev) repos[id] = errorSnapshot(id, apiError!)
      continue
    }

    const clone = fromClone(
      id,
      cloneDir,
      path.relative(cloneRoot, cloneDir) || cloneDir
    )
    if ("data" in clone) {
      const snap = mergeSource(
        id,
        prev,
        "local-clone",
        clone.data,
        clone.detail
      )
      repos[id] = snap
      used["local-clone"]++
      const why = apiError ? `  (api: ${apiError})` : ""
      console.log(
        `  ✓ ${id} — ${sourceLabel("local-clone")} · ${describe(snap)}${why}`
      )
      continue
    }

    failed++
    const reason = [apiError, clone.error].filter(Boolean).join("; ")
    console.warn(`  ! ${id} — ${reason}`)
    // Never clobber a good committed snapshot with a transient failure: an
    // unreachable API should not delete numbers that were reviewed in a PR.
    if (!prev) repos[id] = errorSnapshot(id, reason)
  }

  const index: RepoCardIndex = {
    generatedAt: TODAY,
    // Stable key order keeps the committed diff readable.
    repos: Object.fromEntries(
      Object.keys(repos)
        .sort()
        .map((k) => [k, repos[k]])
    ),
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + "\n")
  console.log(
    `✓ repo-card snapshot — ${used["github-api"]} via ${sourceLabel("github-api")}, ` +
      `${used["local-clone"]} via ${sourceLabel("local-clone")}, ` +
      `${unchanged} unchanged, ${failed} failed, ` +
      `${Object.keys(index.repos).length} total → ${path.relative(ROOT, OUT)}`
  )
}

function errorSnapshot(id: string, error: string): RepoCardSnapshot {
  const [owner, name] = id.split("/")
  return { id, owner, name, sources: [], fetchedAt: TODAY, error }
}

await main()
