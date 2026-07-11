// fetch-arxiv.mts — standalone arXiv candidate fetcher for the paper-scout / the
// /papers (add-papers-digest) skill. No new deps: queries the free arXiv Atom API,
// parses the XML with a small regex-based reader, and scores each entry against the
// keyword weights in data/interests.ts.
//
//   pnpm tsx scripts/fetch-arxiv.mts
//
// Prints the top 15 candidates as a JSON array to stdout:
//   { arxivId, title, authors[], categories[], abstract, score, published }
//
// The agent then reads abs/HTML (links derived via lib/content paperLinks — never a
// stored PDF), writes a "take" for the chosen ~5–10, and saves the digest to
// content/papers/<date>.mdx. This script only proposes candidates; the human + agent curate.

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { interests } from "../data/interests"

const ARXIV_API = "https://export.arxiv.org/api/query"
const MAX_RESULTS = 100
const TOP_N = 15

type Candidate = {
  arxivId: string
  title: string
  authors: string[]
  categories: string[]
  abstract: string
  score: number
  published: string
}

// --- tiny Atom helpers --------------------------------------------------------
// arXiv Atom is well-formed and predictable; a focused regex reader is robust
// enough and avoids pulling in an XML parser dependency.

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function collapse(s: string): string {
  return decodeEntities(s).replace(/\s+/g, " ").trim()
}

function firstTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return m ? m[1] : ""
}

function allTags(block: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi")
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) out.push(m[1])
  return out
}

// <category term="cs.CV" .../> — self-closing, attribute-only.
function categories(block: string): string[] {
  const out: string[] = []
  const re = /<category\b[^>]*\bterm="([^"]+)"[^>]*\/?>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) out.push(m[1])
  return out
}

// arxivId from <id>http://arxiv.org/abs/2606.05162v1</id>.
function arxivId(block: string): string {
  const id = firstTag(block, "id")
  const m = id.match(/abs\/([^<\s]+)/)
  return m ? m[1].trim() : ""
}

function parseEntries(xml: string): Candidate[] {
  const blocks = allTags(xml, "entry")
  const out: Candidate[] = []
  for (const block of blocks) {
    const id = arxivId(block)
    if (!id) continue
    const title = collapse(firstTag(block, "title"))
    const abstract = collapse(firstTag(block, "summary"))
    const published = collapse(firstTag(block, "published")).slice(0, 10)
    const authors = allTags(block, "author")
      .map((a) => collapse(firstTag(a, "name")))
      .filter(Boolean)
    const cats = categories(block)
    out.push({
      arxivId: id,
      title,
      authors,
      categories: cats,
      abstract,
      score: 0,
      published,
    })
  }
  return out
}

// --- scoring ------------------------------------------------------------------
// Mechanical keyword match against title+abstract; title hits count double.

function score(c: Candidate): number {
  const title = c.title.toLowerCase()
  const text = `${c.title} ${c.abstract}`.toLowerCase()
  let s = 0
  for (const { term, weight } of interests.keywords) {
    const t = term.toLowerCase()
    if (text.includes(t)) s += weight
    if (title.includes(t)) s += weight // title bonus
  }
  return s
}

// --- dedup + date window ------------------------------------------------------
// arXiv ids carry a version suffix (…v1, …v2); dedup on the base id so a revised
// resubmission of a paper we already covered still counts as a duplicate.
const baseId = (id: string) => id.replace(/v\d+$/, "")

// Every arxivId already published in a digest under content/arxiv/, so we never
// propose a paper twice. Resolved relative to this script, not the cwd.
function existingArxivIds(): Set<string> {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "arxiv")
  const ids = new Set<string>()
  let files: string[] = []
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".mdx"))
  } catch {
    return ids // no digests yet
  }
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8")
    for (const m of text.matchAll(/arxivId:\s*"?([^"\s]+)"?/g)) {
      ids.add(baseId(m[1]))
    }
  }
  return ids
}

// The day before a YYYY-MM-DD date (UTC).
function dayBefore(d: string): string {
  const t = Date.parse(`${d}T00:00:00Z`) - 24 * 60 * 60 * 1000
  return new Date(t).toISOString().slice(0, 10)
}

async function main() {
  const catQuery = interests.categories.map((c) => `cat:${c}`).join("+OR+")
  const params = new URLSearchParams({
    search_query: `(${catQuery})`,
    sortBy: "submittedDate",
    sortOrder: "descending",
    start: "0",
    max_results: String(MAX_RESULTS),
  })
  // URLSearchParams encodes '+' and ':' — arXiv wants them literal in the query.
  const url = `${ARXIV_API}?${params
    .toString()
    .replace(/cat%3A/g, "cat:")
    .replace(/%2BOR%2B/g, "+OR+")
    .replace(/search_query=%28/g, "search_query=(")
    .replace(/%29&/g, ")&")}`

  const res = await fetch(url, {
    headers: { "User-Agent": "ai.thesatyajit.com paper-scout (mailto:satyajitghana7@gmail.com)" },
  })
  if (!res.ok) {
    throw new Error(`arXiv API ${res.status} ${res.statusText}`)
  }
  const xml = await res.text()

  // Drop anything we've already covered in a previous digest (by base id).
  const seen = existingArxivIds()
  const fresh = parseEntries(xml)
    .map((c) => ({ ...c, score: score(c) }))
    .filter((c) => !seen.has(baseId(c.arxivId)))

  // Anchor the window to the newest submission arXiv actually returned rather than
  // the local clock — the machine clock can run ahead of arXiv's latest and drop
  // everything. Keep the newest submission day plus the day before it.
  const newest = fresh.reduce((m, c) => (c.published > m ? c.published : m), "")
  const from = newest ? dayBefore(newest) : ""
  const candidates = fresh
    .filter((c) => !from || c.published >= from)
    .sort((a, b) => b.score - a.score || b.published.localeCompare(a.published))
    .slice(0, TOP_N)

  process.stdout.write(JSON.stringify(candidates, null, 2) + "\n")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
