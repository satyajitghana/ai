import { getAllContent } from "@/lib/content"

export type SearchResult = {
  kind: string
  slug: string
  title: string
  url: string
  field: string
  snippet: string
  score: number
}

// ---------------------------------------------------------------------------
// Corpus search: BM25 over *contextualized chunks*.
//
// This is the same pairing the site writes about — the BM25 ranking function
// (/articles/bm25) applied to chunks that first get the Contextual Retrieval
// treatment (/blog/contextual-retrieval): before indexing, every chunk is
// prefixed with the structural context it lost when the document was split
// (its title, description, tags, and nearest heading). Anthropic generates that
// context with a per-chunk Claude call; here the context is deterministic and
// free — the site's own frontmatter and headings — so it runs at request time
// with no model and no build step. The effect is the same: a chunk that reads
// "It grew 3% over the previous quarter" still carries which document and which
// section it came from, so a query for the entity or the section matches it.
//
// The corpus is one person's writing, so the whole index is built once, cached,
// and scored with a small postings map (only chunks that share a query term are
// touched). If it ever outgrows memory, this is the seam to move to a real store.
// ---------------------------------------------------------------------------

// Lucene's BM25 defaults, matched to the /articles/bm25 walkthrough.
const K1 = 1.2
const B = 0.75
// How much a chunk's prepended context counts vs. its own body. Kept below 1 so
// the body still drives the match and the shared title terms don't dominate.
const CONTEXT_WEIGHT = 0.5

type Chunk = {
  itemIdx: number
  heading: string // the section this chunk sits under ("" = intro / no heading)
  text: string // clean prose for the snippet
  tf: Map<string, number> // term -> weighted frequency (body + context)
  len: number // weighted length, for BM25 normalization
}

type Index = {
  items: Array<{
    kind: string
    slug: string
    title: string
    url: string
  }>
  chunks: Chunk[]
  postings: Map<string, number[]> // term -> chunk indices containing it
  df: Map<string, number> // term -> number of chunks containing it
  n: number // chunk count
  avgdl: number // average weighted chunk length
}

let cached: Index | undefined

// Tokenize to lowercase alphanumeric runs. Keeps identifiers whole (bm25, gpt4,
// k1) while dropping punctuation — the same bag-of-words shape BM25 assumes.
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

// Strip the MDX/markdown that would otherwise pollute the bag of words: fenced
// code, JSX tags, images/links (keep the visible text), and markup punctuation.
function toProse(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/<[^>]+>/g, " ") // JSX / HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> link text
    .replace(/[#>*_~|]/g, " ") // markdown punctuation
    .replace(/\$\$[\s\S]*?\$\$/g, " ") // display math
    .replace(/\$[^$]*\$/g, " ") // inline math
    .replace(/[ \t]+/g, " ")
}

// Split a document body into chunks on markdown headings, then pack paragraphs
// up to a soft word budget so a chunk is a coherent passage — never a single
// stranded sentence, never a whole long section.
const CHUNK_WORDS = 90

function chunkBody(body: string): Array<{ heading: string; text: string }> {
  const lines = body.split("\n")
  const chunks: Array<{ heading: string; text: string }> = []
  let heading = ""
  let buf: string[] = []
  let words = 0

  const flush = () => {
    const text = toProse(buf.join(" ")).trim()
    if (text) chunks.push({ heading, text })
    buf = []
    words = 0
  }

  for (const line of lines) {
    const h = /^#{1,6}\s+(.*)$/.exec(line.trim())
    if (h) {
      flush()
      heading = toProse(h[1]).trim()
      continue
    }
    if (!line.trim()) {
      // paragraph break: flush if we've reached the word budget
      if (words >= CHUNK_WORDS) flush()
      continue
    }
    buf.push(line)
    words += line.split(/\s+/).length
  }
  flush()
  return chunks
}

function buildIndex(): Index {
  const content = getAllContent()
  const items: Index["items"] = []
  const chunks: Chunk[] = []

  content.forEach((item) => {
    const title = String(item.title ?? item.slug)
    const itemIdx = items.length
    items.push({ kind: item.kind, slug: item.slug, title, url: item.url })

    // The context every chunk of this document inherits — its identity, lost
    // the moment the body was split. Weighted below body terms via CONTEXT_WEIGHT.
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : []
    const contextTokens = tokenize(
      [title, String(item.description ?? ""), tags.join(" ")].join(" ")
    )

    const pieces = chunkBody(item.body)
    // A document with no prose body (e.g. a papers digest) still gets one chunk
    // from its frontmatter, so it's findable by title/description/tags.
    if (pieces.length === 0) pieces.push({ heading: "", text: title })

    for (const piece of pieces) {
      const headingTokens = tokenize(piece.heading)
      const bodyTokens = tokenize(piece.text)
      const tf = new Map<string, number>()
      let len = 0
      const add = (term: string, w: number) => {
        tf.set(term, (tf.get(term) ?? 0) + w)
        len += w
      }
      for (const t of bodyTokens) add(t, 1)
      for (const t of headingTokens) add(t, 1) // heading is chunk-local: full weight
      for (const t of contextTokens) add(t, CONTEXT_WEIGHT)
      chunks.push({ itemIdx, heading: piece.heading, text: piece.text, tf, len })
    }
  })

  const postings = new Map<string, number[]>()
  const df = new Map<string, number>()
  chunks.forEach((chunk, ci) => {
    for (const term of chunk.tf.keys()) {
      const list = postings.get(term)
      if (list) list.push(ci)
      else postings.set(term, [ci])
      df.set(term, (df.get(term) ?? 0) + 1)
    }
  })

  const totalLen = chunks.reduce((s, c) => s + c.len, 0)
  const n = chunks.length
  return { items, chunks, postings, df, n, avgdl: n ? totalLen / n : 0 }
}

function getIndex(): Index {
  if (!cached) cached = buildIndex()
  return cached
}

// Lucene's non-negative IDF: ln(1 + (N - n + 0.5)/(n + 0.5)).
function idf(term: string, ix: Index): number {
  const n = ix.df.get(term) ?? 0
  return Math.log(1 + (ix.n - n + 0.5) / (n + 0.5))
}

function snippet(text: string, queryTerms: Set<string>, width = 240): string {
  const clean = text.replace(/\s+/g, " ").trim()
  // Center the window on the first query-term hit so the match is visible.
  const lower = clean.toLowerCase()
  let hit = -1
  for (const t of queryTerms) {
    const i = lower.indexOf(t)
    if (i !== -1 && (hit === -1 || i < hit)) hit = i
  }
  if (hit <= width / 2 || clean.length <= width) return clean.slice(0, width)
  const start = Math.max(0, hit - width / 2)
  return "…" + clean.slice(start, start + width)
}

export function searchContent(query: string, limit = 20): SearchResult[] {
  const q = query.trim()
  if (!q) return []
  const ix = getIndex()
  const terms = tokenize(q)
  if (terms.length === 0) return []
  const querySet = new Set(terms)

  // Score only the chunks that share a term with the query (postings union).
  const chunkScores = new Map<number, number>()
  for (const term of querySet) {
    const posting = ix.postings.get(term)
    if (!posting) continue
    const termIdf = idf(term, ix)
    for (const ci of posting) {
      const chunk = ix.chunks[ci]
      const f = chunk.tf.get(term) ?? 0
      const norm = K1 * (1 - B + (B * chunk.len) / (ix.avgdl || 1))
      const contribution = (termIdf * (f * (K1 + 1))) / (f + norm)
      chunkScores.set(ci, (chunkScores.get(ci) ?? 0) + contribution)
    }
  }

  // Collapse chunk scores to their parent document, keeping the best-scoring
  // chunk as the result's snippet + section label.
  const best = new Map<number, { score: number; chunkIdx: number }>()
  for (const [ci, score] of chunkScores) {
    const itemIdx = ix.chunks[ci].itemIdx
    const prev = best.get(itemIdx)
    if (!prev || score > prev.score) best.set(itemIdx, { score, chunkIdx: ci })
  }

  const results = [...best.entries()]
    .map(([itemIdx, { score, chunkIdx }]) => {
      const item = ix.items[itemIdx]
      const chunk = ix.chunks[chunkIdx]
      return {
        kind: item.kind,
        slug: item.slug,
        title: item.title,
        url: item.url,
        field: chunk.heading || "body",
        snippet: snippet(chunk.text, querySet),
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}
