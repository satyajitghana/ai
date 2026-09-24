// pnpm validate:films [--only=slug,slug]
//
// Receipts films (brand-crew/skills/receipt-films) put an article's numbers on
// screen, so they are held to the article. For every data/films/<slug>.json:
//
//   shape   the storyboard parses against the schema below, with the length
//           limits that keep a film readable at phone width
//   facts   every digit string on screen or in the narration appears in the
//           article's MDX (thousands separators and number words both count),
//           a scene's key figures sit near words from their own label, every
//           claim.quote is a contiguous run of the article's own words, and
//           every mark sits inside the text it marks
//   fresh   for a film that has been rendered, data/.generated/films.json
//           carries a hash of the storyboard, the article's date and the
//           engine (painter, scenes, character, sound); if it no longer
//           matches, the committed video is stale and this fails
//   files   every rendered film has its mp4, poster and captions in
//           public/films, and nothing in public/films is unaccounted for
// A storyboard with no render is fine: it is checked, and waits for build.mjs.
//
// It cannot tell whether a paraphrased headline is faithful. That part is the
// author's, and SKILL.md says how.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { articleDate, filmSha } from "../brand-crew/skills/receipt-films/hash.mjs"

const ROOT = process.cwd()
const SB_DIR = join(ROOT, "data", "films")
const FILMS = join(ROOT, "public", "films")
const MAN = join(ROOT, "data", ".generated", "films.json")
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",")
// --storyboards: shape and facts only, for authoring before anything is rendered
const sbOnly = process.argv.includes("--storyboards")

const words = (s: string) => s.split(/\s+/).filter(Boolean).length
const maxWords = (n: number) => (s: string) => words(s) <= n
const str = (n: number, what = "words") => z.string().min(1).refine(maxWords(n), `≤ ${n} ${what}`)
const numeric = z.string().regex(/^-?[\d,]*\.?\d+$/, "a plain number, e.g. 387 or 14.1")
const stamp = z.enum(["measured", "reported", "reasoned", "holds", "does not hold", "half true"]).optional()
const note = str(12).optional()
// what the narrator says for this scene, when the generated line reads badly
const say = str(45).optional()

const Scene = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), punch: z.array(str(4)).min(2).max(4), headline: str(10), sub: str(12).optional(), say }).strict(),
  z.object({ type: z.literal("claim"), quote: str(30), label: str(3).optional(), source: str(5).optional(), mark: z.string().optional(), markStyle: z.enum(["circle", "underline", "strike", "highlight"]).optional(), stamp, note, say }).strict(),
  z.object({ type: z.literal("stat"), value: z.string().min(1).max(20), label: str(14), from: numeric.optional(), stamp, note, say }).strict(),
  z.object({ type: z.literal("versus"), label: str(12), a: z.object({ label: str(5), value: numeric }).strict(), b: z.object({ label: str(5), value: numeric }).strict(), unit: z.string().max(4).optional(), ratio: z.string().max(6).optional(), stamp, note, say }).strict(),
  z.object({ type: z.literal("tally"), label: str(12), of: z.number().int().min(2).max(300), rows: z.array(z.object({ label: str(8), n: z.number().int().min(0) }).strict()).min(1).max(3), stamp, note, say }).strict(),
  z.object({ type: z.literal("list"), label: str(8).optional(), items: z.array(z.object({ text: str(8), mark: z.enum(["yes", "no"]).optional() }).strict()).min(2).max(3), say }).strict(),
  z.object({ type: z.literal("verdict"), text: str(16), mark: z.string().optional(), stamp, say }).strict(),
  z.object({ type: z.literal("end") }).strict(),
])
const PALETTES = ["pink-blue", "orange-fblue", "red-marine", "green-pink", "purple-sun", "teal-flame", "blue-orange", "flame-grape"] as const
const Storyboard = z.object({
  slug: z.string(),
  kicker: str(6),
  palette: z.enum(PALETTES),
  scenes: z.array(Scene).min(4).max(8),
  receipt: z.array(z.tuple([z.string().min(1).max(34), z.string().min(1).max(14)])).min(2).max(6),
  total: str(10),
}).strict()
type SB = z.infer<typeof Storyboard>

// ---- the article, normalised for comparison ----
const NUMWORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 }
// digit runs, as the comparable token: "1,776" → "1776", "14.1" → "14.1", "0.8B" → "0.8"
const numTokens = (s: string) => (s.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""))
function articleNumbers(src: string): Set<string> {
  const out = new Set(numTokens(src))
  for (const w of src.toLowerCase().match(/[a-z]+/g) ?? []) if (w in NUMWORDS) out.add(String(NUMWORDS[w]))
  return out
}
// prose for quote matching: markdown and MDX escapes out, quotes unified, whitespace collapsed
const prose = (s: string) =>
  s
    .replace(/^>\s?/gm, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|[\s(])[*_](\S)/g, "$1$2")
    .replace(/(\S)[*_](?=[\s).,;:!?]|$)/g, "$1")
    .replace(/\\([$<>*_])/g, "$1")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")

function strings(sb: SB): string[] {
  const out: string[] = [sb.kicker, sb.total, ...sb.receipt.flat()]
  for (const s of sb.scenes) {
    for (const [k, v] of Object.entries(s)) {
      if (k === "type" || k === "markStyle" || k === "stamp") continue
      if (typeof v === "string") out.push(v)
      else if (typeof v === "number") out.push(String(v))
      else if (Array.isArray(v)) for (const x of v) out.push(typeof x === "string" ? x : Object.values(x).map(String).join(" "))
      else if (v && typeof v === "object") out.push(Object.values(v).map(String).join(" "))
    }
  }
  return out
}

// Presence anywhere is weak evidence for a small number: a 700-line article
// contains "15" somewhere. So a scene's key figures (a stat's value, a
// versus's two values, a tally's counts) must also sit within ~160
// characters of at least one word from their own label.
const STOP = new Set("the and for with that this from into over than then when what which while were was are has have had its per not but all any one two out off how why who our your their there here each more most less only just also very".split(" "))
const labelWords = (...ls: (string | undefined)[]) =>
  [...new Set(ls.filter(Boolean).join(" ").toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [])].filter((w) => !STOP.has(w)).map((w) => w.slice(0, 6))
function numbered(src: string): string {
  let t = src.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, "$1")
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/g, (w) => String(NUMWORDS[w]))
  return t
}
function nearLabel(norm: string, n: string, ws: string[]): boolean {
  if (!ws.length) return true
  const re = new RegExp(`(?<![\\d.])${n.replace(/\./g, "\\.")}(?![\\d])`, "g")
  for (const m of norm.matchAll(re)) {
    const win = norm.slice(Math.max(0, m.index! - 160), m.index! + 160)
    if (ws.some((w) => new RegExp(`(?<![a-z])${w.replace(/[^a-z-]/g, "")}`).test(win))) return true
  }
  return false
}

const errors: string[] = []
const fail = (slug: string, msg: string) => errors.push(`${slug}: ${msg}`)

const files = readdirSync(SB_DIR).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort()
const manifest: { films: Record<string, { sha: string; duration: number; mp4Bytes: number; posterBytes: number; vttBytes?: number }> } =
  existsSync(MAN) ? JSON.parse(readFileSync(MAN, "utf8")) : { films: {} }

let checked = 0, unrendered = 0
for (const slug of files) {
  if (only && !only.includes(slug)) continue
  checked++
  const mdxPath = join(ROOT, "content", "articles", `${slug}.mdx`)
  if (!existsSync(mdxPath)) { fail(slug, "no article content/articles/" + slug + ".mdx"); continue }
  let raw: unknown
  try { raw = JSON.parse(readFileSync(join(SB_DIR, `${slug}.json`), "utf8")) } catch (e) { fail(slug, `not JSON: ${(e as Error).message}`); continue }
  const parsed = Storyboard.safeParse(raw)
  if (!parsed.success) {
    for (const i of parsed.error.issues) fail(slug, `${i.path.join(".") || "(root)"}: ${i.message}`)
    continue
  }
  const sb = parsed.data
  if (sb.slug !== slug) fail(slug, `slug field is "${sb.slug}"`)
  const types = sb.scenes.map((s) => s.type)
  if (types[0] !== "title") fail(slug, "first scene must be title")
  if (types[types.length - 1] !== "end" || types.filter((t) => t === "end").length !== 1) fail(slug, "end must be the last scene, once")
  if (types.filter((t) => t === "title").length !== 1) fail(slug, "exactly one title")
  const beats = types.filter((t) => !["title", "verdict", "end"].includes(t)).length
  if (beats < 2 || beats > 4) fail(slug, `${beats} beats between title and verdict; want 2-4`)
  if (types.filter((t) => t === "list").length > 1) fail(slug, "at most one list: lists are the slowest scene to read")
  if (types.filter((t) => t === "verdict").length !== 1) fail(slug, "exactly one verdict")

  const src = readFileSync(mdxPath, "utf8")
  const nums = articleNumbers(src)
  const body = prose(src)
  for (const s of strings(sb)) for (const n of numTokens(s)) if (!nums.has(n)) fail(slug, `"${n}" (in "${s}") does not appear in the article`)
  const norm = numbered(src)
  const keyed = (vals: string[], ...ls: (string | undefined)[]) => {
    const ws = labelWords(...ls)
    for (const v of vals) for (const n of numTokens(v)) if (nums.has(n) && !nearLabel(norm, n, ws)) fail(slug, `"${n}" appears in the article, but nowhere near "${ls.filter(Boolean).join(" / ")}"`)
  }
  for (const sc of sb.scenes) {
    if (sc.type === "stat") keyed([sc.value], sc.label)
    if (sc.type === "versus") { keyed([sc.a.value], sc.a.label, sc.label); keyed([sc.b.value], sc.b.label, sc.label) }
    if (sc.type === "tally") for (const r of sc.rows) keyed([String(r.n), String(sc.of)], r.label, sc.label)
    if (sc.type === "claim") {
      const q = prose(sc.quote).trim()
      if (!body.includes(q)) fail(slug, `quote is not verbatim in the article: "${sc.quote}"`)
      if (sc.mark && !q.toLowerCase().includes(prose(sc.mark).trim().toLowerCase())) fail(slug, `mark "${sc.mark}" is not inside the quote`)
    }
    if (sc.type === "verdict" && sc.mark && !sc.text.toLowerCase().includes(sc.mark.toLowerCase())) fail(slug, `mark "${sc.mark}" is not inside the verdict`)
    if (sc.type === "tally") for (const r of sc.rows) if (r.n > sc.of) fail(slug, `tally row "${r.label}" has n ${r.n} > of ${sc.of}`)
    if (sc.type === "versus" && Number(sc.a.value.replace(/,/g, "")) <= 0 && Number(sc.b.value.replace(/,/g, "")) <= 0) fail(slug, "versus needs a positive value")
  }

  // fresh + files
  if (sbOnly) continue
  const m = manifest.films[slug]
  // Not every storyboard is rendered: films ship for a chosen set of articles,
  // and the rest wait, checked, for `build.mjs <slug>`. Only a film that exists
  // is held to its storyboard.
  if (!m) { unrendered++; continue }
  const want = filmSha(raw, articleDate(slug))
  if (m.sha !== want) fail(slug, `stale render (manifest ${m.sha}, storyboard+date+engine ${want}): re-run build.mjs ${slug}`)
  for (const f of [`${slug}.mp4`, `${slug}-poster.webp`, `${slug}.vtt`]) {
    const p = join(FILMS, f)
    if (!existsSync(p)) fail(slug, `missing public/films/${f}`)
    else if (f.endsWith(".mp4") && statSync(p).size !== m.mp4Bytes) fail(slug, `public/films/${f} is not the file the manifest describes`)
  }
}

if (!only && !sbOnly) {
  for (const slug of Object.keys(manifest.films)) if (!files.includes(slug)) fail(slug, "in the manifest but has no storyboard")
  if (existsSync(FILMS))
    for (const f of readdirSync(FILMS)) {
      const slug = f.replace(/(-poster)?\.(mp4|webp|vtt)$/, "")
      if (!manifest.films[slug]) fail(slug, `public/films/${f} is not in the manifest`)
    }
}

if (errors.length) {
  console.error(`✗ films: ${errors.length} problem(s)`)
  for (const e of errors) console.error("  " + e)
  process.exit(1)
}
const total = Object.values(manifest.films).reduce((a, m) => a + m.mp4Bytes + m.posterBytes + (m.vttBytes || 0), 0)
const secs = Object.values(manifest.films).reduce((a, m) => a + m.duration, 0)
console.log(`✓ films OK — ${checked} storyboard(s) checked against their articles; ${Object.keys(manifest.films).length} rendered (${(secs / 60).toFixed(1)} min, ${(total / 1048576).toFixed(1)} MB)${unrendered ? `, ${unrendered} not yet rendered` : ""}`)
