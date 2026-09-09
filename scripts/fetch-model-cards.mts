import fs from "node:fs"
import path from "node:path"

// Snapshot Hugging Face model metadata for <ModelCard> into
// data/.generated/model-cards.json. Machine-generated — do not hand-edit.
//
// Deliberately NOT part of `prebuild`. A page that fetched the Hub at build time
// would break whenever huggingface.co was slow, and would silently restate
// published numbers as repos change. Running this explicitly puts the numbers in
// a reviewable diff and pins them to a date the card displays.
//
//   pnpm fetch:models              # refresh every repo referenced by an article
//   pnpm fetch:models --check      # exit 1 if any referenced repo is missing
//   pnpm fetch:models owner/name…  # refresh only these
//
// The repo list is derived from the articles themselves — every
// `<ModelCard repo="owner/name" />` in content/**.mdx — so adding a card to an
// article and re-running is the whole workflow. Nothing to keep in sync by hand.

import {
  formatBytes,
  formatParams,
  type ModelCardIndex,
  type ModelCardSnapshot,
} from "../lib/model-cards"

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, "content")
const OUT_DIR = path.join(ROOT, "data", ".generated")
const OUT = path.join(OUT_DIR, "model-cards.json")

const API = "https://huggingface.co/api/models"

/** Matches `repo="owner/name"` on a ModelCard tag, single or double quoted. */
const MODELCARD_RE = /<ModelCard\b[^>]*?\brepo=["']([^"']+)["']/g

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith(".mdx")) out.push(p)
  }
  return out
}

/** Every repo referenced by a <ModelCard> anywhere in content/. */
function referencedRepos(): Map<string, string[]> {
  const byRepo = new Map<string, string[]>()
  for (const file of walk(CONTENT_DIR)) {
    const body = fs.readFileSync(file, "utf8")
    for (const m of body.matchAll(MODELCARD_RE)) {
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

async function fetchOne(repo: string): Promise<ModelCardSnapshot> {
  const fetchedAt = new Date().toISOString().slice(0, 10)
  try {
    const res = await fetch(`${API}/${repo}?blobs=true`, {
      headers: { accept: "application/json" },
    })
    if (!res.ok) {
      return { id: repo, fetchedAt, error: `HTTP ${res.status}` }
    }
    const d = (await res.json()) as Record<string, unknown>
    const safetensors = d.safetensors as
      | { parameters?: Record<string, number>; total?: number }
      | undefined
    const config = d.config as
      | { architectures?: string[]; model_type?: string }
      | undefined
    const siblings = d.siblings as
      | { rfilename: string; size?: number }[]
      | undefined
    const cardData = d.cardData as
      | {
          license?: string
          base_model?: string | string[]
          language?: string | string[]
          tags?: string[]
        }
      | undefined
    const tags = (d.tags as string[] | undefined) ?? []

    // `license:mit` shows up as a tag even when cardData omits it.
    const licenseTag = tags.find((t) => t.startsWith("license:"))

    // The Hub emits both `base_model:<id>` and `base_model:<kind>:<id>`; the
    // three-part form is the one that carries the relation.
    const relTag = tags.find(
      (t) => t.startsWith("base_model:") && t.split(":").length >= 3
    )
    const baseModelRelation = relTag?.split(":")[1]
    const rawBase = cardData?.base_model
    const baseModel = Array.isArray(rawBase) ? rawBase[0] : rawBase

    const asArray = (v: string | string[] | undefined) =>
      Array.isArray(v) ? v : v ? [v] : undefined

    // Card topics minus the machine-generated namespaces, which are noise on a
    // card that already shows licence, library and pipeline as their own fields.
    const topics = (cardData?.tags ?? [])
      .filter((t) => !t.includes(":") && t.length < 28)
      .slice(0, 8)

    const named = (ext: string) =>
      siblings?.filter((s) => s.rfilename.toLowerCase().endsWith(ext)).length
    const largestFile = siblings?.length
      ? Math.max(...siblings.map((s) => s.size ?? 0))
      : undefined

    return {
      id: (d.id as string) ?? repo,
      author: d.author as string | undefined,
      parameters: safetensors?.parameters,
      totalParameters: safetensors?.total,
      usedStorage: d.usedStorage as number | undefined,
      library: d.library_name as string | undefined,
      architecture: config?.architectures?.[0],
      modelType: config?.model_type,
      pipelineTag: d.pipeline_tag as string | undefined,
      license: cardData?.license ?? licenseTag?.slice("license:".length),
      gated: (d.gated as string | false | undefined) ?? false,
      downloads: d.downloads as number | undefined,
      likes: d.likes as number | undefined,
      fileCount: siblings?.length,
      shardCount: named(".safetensors") || undefined,
      ggufCount: named(".gguf") || undefined,
      largestFile: largestFile || undefined,
      baseModel,
      baseModelRelation,
      languages: asArray(cardData?.language)?.slice(0, 6),
      topics: topics.length ? topics : undefined,
      createdAt: d.createdAt as string | undefined,
      lastModified: d.lastModified as string | undefined,
      revision: (d.sha as string | undefined)?.slice(0, 7),
      fetchedAt,
    }
  } catch (err) {
    return { id: repo, fetchedAt, error: (err as Error).message }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes("--check")
  const explicit = args.filter((a) => !a.startsWith("--"))

  const referenced = referencedRepos()

  let existing: ModelCardIndex = { generatedAt: "", models: {} }
  try {
    existing = JSON.parse(fs.readFileSync(OUT, "utf8")) as ModelCardIndex
  } catch {
    /* first run */
  }

  if (checkOnly) {
    const missing = [...referenced.keys()].filter((r) => !existing.models[r])
    if (missing.length) {
      console.error(
        `✗ ${missing.length} repo(s) referenced by a <ModelCard> but absent from the snapshot:`
      )
      for (const r of missing) {
        console.error(`    ${r}  (${referenced.get(r)!.join(", ")})`)
      }
      console.error("  run: pnpm fetch:models")
      process.exit(1)
    }
    console.log(
      `✓ model-card snapshot covers all ${referenced.size} referenced repo(s)`
    )
    return
  }

  const targets = explicit.length ? explicit : [...referenced.keys()]
  if (!targets.length) {
    console.log("no <ModelCard repo=…> references found — nothing to fetch")
    return
  }

  const models: Record<string, ModelCardSnapshot> = { ...existing.models }
  let ok = 0
  let failed = 0

  // Sequential on purpose: this is a courtesy crawl of someone else's API, and
  // the list is small enough that parallelism buys nothing worth the rudeness.
  for (const repo of targets) {
    const snap = await fetchOne(repo)
    models[repo] = snap
    if (snap.error) {
      failed++
      console.warn(`  ! ${repo} — ${snap.error}`)
    } else {
      ok++
      const params = snap.totalParameters
        ? formatParams(snap.totalParameters)
        : "?"
      const size = snap.usedStorage ? formatBytes(snap.usedStorage) : "?"
      console.log(`  ✓ ${repo} — ${params} params, ${size}`)
    }
  }

  const index: ModelCardIndex = {
    generatedAt: new Date().toISOString().slice(0, 10),
    // Stable key order keeps the committed diff readable.
    models: Object.fromEntries(
      Object.keys(models)
        .sort()
        .map((k) => [k, models[k]])
    ),
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + "\n")
  console.log(
    `✓ model-card snapshot — ${ok} ok, ${failed} failed, ${Object.keys(index.models).length} total → ${path.relative(ROOT, OUT)}`
  )
}

await main()
