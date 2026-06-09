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

// --- date window: yesterday + today (UTC) ------------------------------------
function dateWindow(): { from: string; to: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const y = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const yesterday = y.toISOString().slice(0, 10)
  return { from: yesterday, to: today }
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

  const { from } = dateWindow()
  const candidates = parseEntries(xml)
    .map((c) => ({ ...c, score: score(c) }))
    // Keep recent submissions (yesterday+today); arXiv returns newest first.
    .filter((c) => c.published >= from)
    .sort((a, b) => b.score - a.score || b.published.localeCompare(a.published))
    .slice(0, TOP_N)

  process.stdout.write(JSON.stringify(candidates, null, 2) + "\n")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
