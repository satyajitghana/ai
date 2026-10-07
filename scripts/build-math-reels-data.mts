// build-math-reels-data.mts — the data behind /math, the wall of math reels.
//
//   pnpm tsx scripts/build-math-reels-data.mts
//       re-derive data/math-wall/generated.ts from what is committed: the reel
//       specs (data/math-reels/*.json), the article's headings
//       (content/articles/openai-math.mdx) and the rendered reels that exist
//       under public/films/math/. Run it after rendering or deleting a reel, or
//       after editing the article's headings.
//
//   pnpm tsx scripts/build-math-reels-data.mts --import <reviews-dir> <families.json> <commit>
//       (re)build data/math-wall/notes.json, the committed snapshot of the
//       per-family review notes (*.jsonl, one JSON object per family) and the
//       release's own manuscript map (families.json: summary + papers per
//       family, parsed from openai/math's CONTENTS.md at <commit>). The review
//       notes and the clone live in a scratch directory; this snapshot is the
//       copy the site builds from.
//
// Why the reel list is a plain list in a generated module: pages must not read
// public/ with fs (it drags the whole directory into every function that can
// reach the read), and data/.generated/ is reserved for the films pipeline. So
// the question "does this family have a reel yet?" is answered here, at
// data-build time, and committed with the reel.

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { DISCIPLINES, FAMILIES, SECTION_ANCHORS } from "../components/articles/openai-math/catalogue-data"
import { texSpansToText, texToText } from "../lib/tex-text"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_DIR = join(ROOT, "data/math-wall")
const NOTES = join(OUT_DIR, "notes.json")
const GENERATED = join(OUT_DIR, "generated.ts")
const SPECS = join(ROOT, "data/math-reels")
const REELS = join(ROOT, "public/films/math")
const ARTICLE = join(ROOT, "content/articles/openai-math.mdx")

const IDS = new Set(FAMILIES.map((f) => f.id))

// Cut at the last sentence (or clause) end that fits, else at a word.
function clip(text: string, max: number): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  let end = 0
  for (const m of t.matchAll(/[.;](?=\s)/g)) {
    if (m.index + 1 > max) break
    end = m.index + 1
  }
  if (end >= max * 0.55) return t.slice(0, end).replace(/;$/, ".")
  const cut = t.slice(0, max - 1)
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:(—–-]+$/, "") + "…"
}

// The release's CONTENTS.md writes inline TeX as $`…`$, italics as <i>…</i>,
// scripts as <sup>/<sub>, and ends many summaries with "([Lean](lean/docs/…))".
const plain = (s: string) =>
  texSpansToText(s.replace(/<\/?i>/g, ""))
    .replace(/<sup>([^<]*)<\/sup>/g, (_, t: string) => texToText(`^{${t}}`))
    .replace(/<sub>([^<]*)<\/sub>/g, (_, t: string) => texToText(`_{${t}}`))
    .replace(/<[^>]+>/g, "")
    .replace(/\s*\(\[Lean\]\([^)]*\)\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

// ─── --import: snapshot the scratch review notes + manuscript map ────────────

type Review = {
  id: string
  explainer: string
  caveats: string
  lean: string
  pages: number | string
  significance: string
}
type ReleaseFamily = { id: string; title: string; summary: string; papers: { title: string; path: string }[] }

function importNotes(reviewsDir: string, familiesJson: string, commit: string) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`commit must be a full sha, got "${commit}"`)
  const reviews = new Map<string, Review>()
  // The two single-family deep dives (fft, matrix-multiplication) are written
  // after the discipline sweeps; read them last so they win on a duplicate id.
  const files = readdirSync(reviewsDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort((a, b) => Number(a === "fft.jsonl" || a === "matrix-multiplication.jsonl") - Number(b === "fft.jsonl" || b === "matrix-multiplication.jsonl") || a.localeCompare(b))
  for (const f of files) {
    for (const line of readFileSync(join(reviewsDir, f), "utf8").split("\n")) {
      if (!line.trim()) continue
      const r = JSON.parse(line) as Review
      if (IDS.has(r.id)) reviews.set(r.id, r)
    }
  }
  const release = new Map((JSON.parse(readFileSync(familiesJson, "utf8")) as ReleaseFamily[]).map((f) => [f.id, f]))
  const families: Record<string, unknown> = {}
  const missing: string[] = []
  for (const f of FAMILIES) {
    const r = reviews.get(f.id)
    const rel = release.get(f.id)
    if (!r || !rel) {
      missing.push(f.id)
      continue
    }
    const pages = Number(String(r.pages).replace(/[^0-9]/g, "")) || null
    families[f.id] = {
      explainer: clip(r.explainer, 900),
      caveats: clip(r.caveats, 560),
      lean: clip(r.lean, 320),
      pages,
      summary: clip(plain(rel.summary), 700),
      papers: rel.papers.map((p) => ({ title: plain(p.title), path: p.path })),
    }
  }
  if (missing.length) throw new Error(`no review or release entry for ${missing.join(", ")}`)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(
    NOTES,
    JSON.stringify(
      {
        $comment:
          "Snapshot for /math: per-family review notes (explainer, caveats, lean detail, pages) and openai/math's manuscript map (summary, papers) at `commit`. Written by scripts/build-math-reels-data.mts --import; the review grades themselves live in components/articles/openai-math/catalogue-data.ts.",
        commit,
        families,
      },
      null,
      0,
    ).replace(/,"(\d{3})":/g, ',\n"$1":') + "\n",
  )
  console.log(`notes: ${Object.keys(families).length} families → ${NOTES}`)
}

// ─── default: anchors, reel specs, rendered reels ────────────────────────────

// github-slugger, as rehype-slug runs it (before KaTeX, so inline math is its
// TeX source): lowercase, drop everything that is not a letter, mark, number,
// connector, space or hyphen (a subscript ₂ goes too), spaces to hyphens,
// de-duplicate with -1, -2.
function slugger() {
  const seen = new Map<string, number>()
  return (text: string) => {
    let s = text.toLowerCase().replace(/[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc} -]/gu, "").replace(/ /g, "-")
    const base = s
    let n = seen.get(base) ?? 0
    while (seen.has(s)) s = `${base}-${++n}`
    seen.set(base, n)
    seen.set(s, 0)
    return s
  }
}

type Heading = { level: number; text: string; slug: string; line: number; end: number }

function headings(src: string): Heading[] {
  const lines = src.split("\n")
  const slug = slugger()
  const out: Heading[] = []
  let fence = false
  let front = lines[0] === "---"
  lines.forEach((raw, i) => {
    if (front) {
      if (i > 0 && raw === "---") front = false
      return
    }
    if (/^\s*(```|~~~)/.test(raw)) fence = !fence
    if (fence) return
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(raw)
    if (!m) return
    // the text node of the heading: markdown emphasis, links and inline-code
    // markers gone, inline math kept as its TeX source
    const text = m[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\$([^$]*)\$/g, "$1")
      .replace(/\\\$/g, "$")
    out.push({ level: m[1].length, text, slug: slug(text), line: i, end: lines.length })
  })
  for (let i = 0; i < out.length; i++) out[i].end = out[i + 1]?.line ?? lines.length
  return out
}

// Mentions of a family in prose: "family 107", "families 002, 006, 010",
// "families 252 and 257", or a bare "(107)" after a result's name.
function mentions(text: string): string[] {
  const ids: string[] = []
  for (const m of text.matchAll(/famil(?:y|ies)\s+((?:\d{3}(?:'s)?(?:,\s*|\s+and\s+|\s*)?)+)/gi))
    for (const d of m[1].matchAll(/\d{3}/g)) ids.push(d[0])
  for (const m of text.matchAll(/\((\d{3})\)/g)) ids.push(m[1])
  return ids.filter((id) => IDS.has(id))
}

// "The results that matter most": heading text (as slugged, TeX source kept)
// → the family it is about.
const HEADLINES: [string, string][] = [
  ["Matrix multiplication: ω", "107"],
  ["The FFT is not optimal", "130"],
  ["The Unique Games Conjecture, claimed", "102"],
  ["L = BPL", "103"],
  ["L(\\mathbb F_2) \\cong L(\\mathbb F_3)", "287"],
  ["The Mahler conjectures, twice over", "087"],
  ["\\theta(p_c) = 0", "213"],
  ["Donaldson's tamed-to-compatible", "342"],
  ["Kadison's similarity problem", "288"],
  ["The crossing number of", "165"],
  ["Kakeya in three and four dimensions", "074"],
  ["Hadwiger's conjecture", "157"],
  ["Erdős's $5000", "159"],
]

function anchors(): Record<string, string> {
  const src = readFileSync(ARTICLE, "utf8")
  const lines = src.split("\n")
  const hs = headings(src)
  // Only the results half of the article: the opening sections (how the
  // release was made, what Lean checks, the trust tiers) cite families as
  // examples, which is not where a reader wants to land.
  const start = hs.findIndex((h) => /^The results that matter most/.test(h.text))
  if (start < 0) throw new Error("no 'The results that matter most' heading in the article")
  const results = hs.slice(start)
  const disc = new Set(SECTION_ANCHORS)
  const out: Record<string, string> = {}

  // 1. a heading that names the family, or one of the headline sections,
  //    whose headings name the result instead of its number
  for (const h of results) {
    for (const id of mentions(h.text)) out[id] ??= h.slug
    for (const [prefix, id] of HEADLINES) if (h.text.startsWith(prefix)) out[id] ??= h.slug
  }
  for (const [prefix, id] of HEADLINES)
    if (!results.some((h) => h.text.startsWith(prefix))) throw new Error(`no heading starts with "${prefix}" (family ${id})`)

  // 2. the section (h3/h4, or a discipline h2) that mentions it most, its
  //    subsections included; a tie goes to the deeper section
  const count = (h: Heading, id: string) => {
    // cumulative: up to the next heading at this level or above
    const next = results.find((x) => x.line > h.line && x.level <= h.level)
    // JSX elements (figure alt text: "families 001 to 028") are not prose
    const body = lines
      .slice(h.line + 1, next ? next.line : lines.length)
      .join("\n")
      .replace(/<[A-Z][\s\S]*?\/>/g, "")
    return mentions(body).filter((x) => x === id).length
  }
  const candidates = results.filter((h) => h.level >= 3 || (h.level === 2 && disc.has(h.slug)))
  for (const f of FAMILIES) {
    if (out[f.id]) continue
    let best: Heading | null = null
    let bestN = 0
    for (const h of candidates) {
      const n = count(h, f.id)
      // ties: the deeper section, then the later one (the by-discipline
      // walkthrough comes after the headline results that cite its families)
      if (n > bestN || (n === bestN && n > 0 && best && h.level >= best.level)) {
        best = h
        bestN = n
      }
    }
    // 3. the family's discipline section, which the catalogue also links to
    out[f.id] = best ? best.slug : SECTION_ANCHORS[f.d]
  }

  const slugs = new Set(hs.map((h) => h.slug))
  for (const [id, a] of Object.entries(out)) if (!slugs.has(a)) throw new Error(`family ${id}: anchor #${a} is not a heading slug`)
  return out
}

type Spec = { id: string; short?: string; title?: { title?: string; subtitle?: string } }

function specs() {
  const out: Record<string, { short?: string; title?: string; subtitle?: string }> = {}
  if (!existsSync(SPECS)) return out
  for (const f of readdirSync(SPECS).filter((f) => f.endsWith(".json")).sort()) {
    const s = JSON.parse(readFileSync(join(SPECS, f), "utf8")) as Spec
    if (!IDS.has(s.id)) throw new Error(`${f}: unknown family id "${s.id}"`)
    out[s.id] = { short: s.short, title: s.title?.title, subtitle: s.title?.subtitle }
  }
  return out
}

function probe(file: string): { duration: number | null; width: number | null; height: number | null } {
  try {
    const j = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file], {
        encoding: "utf8",
      }),
    )
    return {
      duration: Math.round(Number(j.format?.duration) * 10) / 10 || null,
      width: j.streams?.[0]?.width ?? null,
      height: j.streams?.[0]?.height ?? null,
    }
  } catch {
    return { duration: null, width: null, height: null }
  }
}

function committedDate(file: string): string {
  try {
    const d = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: ROOT, encoding: "utf8" }).trim()
    if (d) return d
  } catch {}
  return new Date(statSync(file).mtimeMs).toISOString().slice(0, 10)
}

function reels() {
  const out: Record<string, { duration: number | null; width: number | null; height: number | null; date: string }> = {}
  if (!existsSync(REELS)) return out
  for (const f of readdirSync(REELS).filter((f) => /^\d{3}\.mp4$/.test(f)).sort()) {
    const id = f.slice(0, 3)
    if (!IDS.has(id)) throw new Error(`public/films/math/${f}: unknown family id`)
    if (!existsSync(join(REELS, `${id}-poster.webp`))) {
      console.warn(`skip ${id}: ${f} has no ${id}-poster.webp`)
      continue
    }
    out[id] = { ...probe(join(REELS, f)), date: committedDate(join(REELS, f)) }
  }
  return out
}

function generate() {
  if (!existsSync(NOTES)) throw new Error(`${NOTES} is missing; run with --import first`)
  const a = anchors()
  const s = specs()
  const r = reels()
  const body = `// GENERATED by scripts/build-math-reels-data.mts from data/math-reels/*.json,
// content/articles/openai-math.mdx and the files under public/films/math/.
// Do not hand-edit; re-run the script after rendering a reel.

/** Families with a rendered reel (public/films/math/<id>.mp4 + <id>-poster.webp). */
export const REELS: Record<string, { duration: number | null; width: number | null; height: number | null; date: string }> = ${JSON.stringify(r, null, 2)}

/** Reel spec titles, for families that have a spec. */
export const SPEC_TITLES: Record<string, { short?: string; title?: string; subtitle?: string }> = ${JSON.stringify(s, null, 2)}

/** The heading of /articles/openai-math that discusses each family. */
export const ARTICLE_ANCHORS: Record<string, string> = ${JSON.stringify(a)}
`
  writeFileSync(GENERATED, body)
  const byAnchor = new Set(Object.values(a)).size
  console.log(
    `math wall: ${FAMILIES.length} families, ${Object.keys(r).length} reels, ${Object.keys(s).length} specs, ${byAnchor} distinct article anchors (${DISCIPLINES.length} disciplines) → ${GENERATED}`,
  )
}

const args = process.argv.slice(2)
if (args[0] === "--import") {
  const [, dir, fam, commit] = args
  if (!dir || !fam || !commit) throw new Error("usage: --import <reviews-dir> <families.json> <commit>")
  importNotes(dir, fam, commit)
}
generate()
