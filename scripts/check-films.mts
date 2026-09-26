// pnpm validate:films [--only=slug,architectures/slug] [--storyboards]
//
// Explainer films (brand-crew/skills/explainer-films) explain how the thing an
// article is about works, in the article's own terms, and every article gets a
// thumbnail painted from its storyboard. For every data/films/<slug>.json:
//
//   shape    the storyboard parses against the schema below, with the length
//            limits that keep a film readable at phone width and a narration
//            budget that keeps it under two minutes
//   explain  it has a mechanism scene (diagram, stack, steps, grid, equation or
//            compare) — a film that only quotes numbers is not an explainer —
//            and exactly one takeaway; diagrams have no overlapping nodes and
//            keep clear of the side the host presents from
//   facts    every digit string a viewer sees or hears appears in the article's
//            MDX (thousands separators and number words both count), a key
//            figure sits near words from its own label, a quote is a
//            contiguous run of the article's own words, and every mark sits
//            inside the text it marks
//   host     every film has its own mascot (cat, dog, fox, bunny, capybara or
//            fish): no two storyboards share a name or the same look
//   fresh    a rendered film and every thumbnail carry a hash of the
//            storyboard, the article's date and the engine; if it no longer
//            matches, the committed file is stale and this fails
//   files    rendered films have mp4, poster and captions; every storyboard has
//            a thumbnail; nothing in public/films or public/thumbs is unaccounted
// A storyboard with no film is fine: films ship for a chosen set.
//
// Namespaces (hash.mjs NAMESPACES). Articles are keyed by their bare slug.
// Every other kind that gets films is keyed `<kind>/<slug>`: its storyboard is
// data/films/<kind>/<slug>.json, "the article" in everything above is
// content/<kind>/<slug>.mdx, and its files are public/films/<kind>/<slug>.* and
// public/thumbs/<kind>/<slug>.jpg under the same manifest key. Hosts are unique
// across every namespace. Every doc that exists in a namespace needs a
// storyboard and a thumbnail, as every article does.
//
// It cannot tell whether an explanation is right. That part is the author's,
// and SKILL.md says how.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { NAMESPACES, articleDate, filmSha, fontsSha, sourceOf, splitKey, storyboardKeys } from "../brand-crew/skills/explainer-films/hash.mjs"

const ROOT = process.cwd()
const SB_DIR = join(ROOT, "data", "films")
const FILMS = join(ROOT, "public", "films")
const THUMBS = join(ROOT, "public", "thumbs")
const MAN = join(ROOT, "data", ".generated", "films.json")
const TMAN = join(ROOT, "data", ".generated", "thumbs.json")
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",")
// --storyboards: shape, explanation and facts only, for authoring before anything is rendered
const sbOnly = process.argv.includes("--storyboards")

const words = (s: string) => String(s).split(/\s+/).filter(Boolean).length
const str = (n: number) => z.string().min(1).refine((s) => words(s) <= n, `≤ ${n} words`)
const numeric = z.string().regex(/^-?[\d,]*\.?\d+$/, "a plain number, e.g. 387 or 14.1")
const stamp = z.enum(["measured", "reported", "reasoned", "holds", "does not hold", "half true"]).optional()
const note = str(14).optional()
const say = str(34).optional()      // one beat of narration
const sayReq = str(34)
const id = z.string().regex(/^[a-z0-9_-]+$/, "lowercase id")
const pct = z.number().min(0).max(100)
const tone = z.enum(["a", "b", "hi", "light"]).optional()

// the styles and their palettes (engine/styles.js), and the host's wardrobe (engine/mascot.js)
const STYLES: Record<string, string[]> = {
  watercolour: ["pink-blue", "orange-blue", "red-marine", "green-pink", "purple-sun", "teal-flame"],
  chalkboard: ["green", "slate", "night"],
  blueprint: ["cobalt", "navy", "teal"],
  neon: ["club", "ocean", "sunset"],
  notebook: ["yellow", "pink", "green"],
  riso: ["pink-blue", "orange-teal", "yellow-violet", "green-red"],
  pixel: ["pico", "night", "wine"],
  crayon: ["primary", "garden", "berry"],
  pastel: ["slate", "umber", "moss"],
  ballpoint: ["bic", "sketch"],
  pencil: ["meadow", "dusk", "sea"],
  marker: ["pop", "tropic"],
  charcoal: ["ember", "cobalt"],
  sumi: ["ink", "indigo"],
  engraving: ["bank", "chart"],
  stipple: ["duotone", "ink"],
  calligraphy: ["ink", "emerald"],
  spray: ["concrete", "brick"],
}
const MASCOT = z.object({
  species: z.enum(["cat", "dog", "fox", "bunny", "capybara", "fish"]),
  name: z.string().regex(/^[A-Z][a-z]{2,11}$/, "one capitalised word"),
  fur: z.enum(["white", "cream", "grey", "brown", "chocolate", "black", "caramel", "orange", "ginger", "gold", "lilac", "mint", "peach", "sky", "rose", "coral", "teal", "blue"]),
  ears: z.enum(["up", "lop", "one-down", "tall", "short"]),
  hat: z.enum(["none", "hardhat", "beret", "wizard", "cap", "headphones", "crown", "goggles", "party", "chef", "beanie", "flower", "tophat", "bandana", "yuzu"]),
  glasses: z.enum(["none", "round", "square", "shades", "monocle"]),
  outfit: z.enum(["none", "scarf", "bowtie", "labcoat", "hoodie", "cape", "vest", "overalls", "tie"]),
  prop: z.enum(["pointer", "clipboard", "wrench", "magnifier", "book", "carrot", "pencil", "flag", "none"]),
  patch: z.enum(["none", "eye", "belly", "spots", "socks"]),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
}).strict()

const KINDS = ["box", "pill", "stack", "db", "op", "grid", "doc", "chip", "user", "cloud"] as const
const PATTERN = /^(dense|none|causal|diagonal|quant|sliding:\d+|block:\d+|sparse:0?\.\d+|topk:\d+|pages:\d+|rows:[\d,]+|cols:[\d,]+)$/
const Scene = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), punch: z.array(str(4)).max(3).optional(), headline: str(10), sub: str(14).optional(), say }).strict(),
  z.object({ type: z.literal("idea"), label: str(5).optional(), text: str(28), mark: z.string().optional(), say }).strict(),
  z.object({
    type: z.literal("diagram"), title: str(8),
    nodes: z.array(z.object({ id, label: str(5), sub: str(5).optional(), kind: z.enum(KINDS).optional(), tone, at: z.tuple([pct, pct]) }).strict()).min(2).max(9),
    edges: z.array(z.object({ from: id, to: id, label: str(3).optional(), dashed: z.boolean().optional(), bend: z.number().min(-1).max(1).optional() }).strict()).max(12).optional(),
    groups: z.array(z.object({ label: str(4), nodes: z.array(id).min(1), tone }).strict()).max(3).optional(),
    steps: z.array(z.object({ show: z.array(z.string()).optional(), flow: z.array(z.string()).optional(), focus: z.array(id).optional(), highlight: z.array(id).optional(), note, say: sayReq }).strict()).min(1).max(6),
  }).strict(),
  z.object({
    type: z.literal("stack"), title: str(10), input: str(3).optional(), output: str(3).optional(),
    layers: z.array(z.object({ label: str(5), tone }).strict()).min(2).max(7),
    repeat: z.object({ from: z.number().int().min(0), to: z.number().int().min(0), label: z.string().min(1).max(8) }).strict().optional(),
    side: z.object({ label: str(6), to: z.number().int().min(0) }).strict().optional(),
    steps: z.array(z.object({ show: z.number().int().min(1).optional(), highlight: z.array(z.number().int().min(0)).optional(), side: z.boolean().optional(), flow: z.boolean().optional(), note, say: sayReq }).strict()).min(1).max(5),
  }).strict(),
  z.object({ type: z.literal("steps"), title: str(8), say, items: z.array(z.object({ text: str(7), sub: str(5).optional(), say }).strict()).min(2).max(5) }).strict(),
  z.object({
    type: z.literal("compare"), title: str(8).optional(),
    left: z.object({ title: str(5), items: z.array(str(10)).min(1).max(3), say }).strict(),
    right: z.object({ title: str(5), items: z.array(str(10)).min(1).max(3), say }).strict(),
  }).strict(),
  z.object({
    type: z.literal("grid"), title: str(8), rows: z.number().int().min(2).max(16), cols: z.number().int().min(2).max(16), rowLabel: str(2).optional(), colLabel: str(2).optional(),
    steps: z.array(z.object({ pattern: z.string().regex(PATTERN, "a grid pattern (see SKILL.md)"), label: str(10).optional(), note, say: sayReq }).strict()).min(1).max(5),
  }).strict(),
  z.object({ type: z.literal("equation"), title: str(8).optional(), text: z.string().min(3).max(48), say, parts: z.array(z.object({ match: z.string().min(1), note: str(12), say }).strict()).min(1).max(4) }).strict(),
  z.object({
    type: z.literal("figure"), title: str(8).optional(),
    src: z.string().regex(new RegExp(`^/(${["articles", ...NAMESPACES].join("|")})/[^\\s"]+$`), "a path under /articles/ (or a namespace's /<kind>/) that the article itself shows"),
    credit: str(10), clip: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
    steps: z.array(z.object({ focus: z.tuple([pct, pct, pct, pct]).optional(), note, say: sayReq }).strict()).min(1).max(4),
  }).strict(),
  z.object({ type: z.literal("stat"), value: z.string().min(1).max(20), label: str(14), note, stamp, say }).strict(),
  z.object({ type: z.literal("bars"), title: str(10), unit: z.string().max(4).optional(), items: z.array(z.object({ label: str(5), value: numeric, hl: z.boolean().optional() }).strict()).min(2).max(5), note, stamp, say }).strict(),
  z.object({ type: z.literal("tally"), label: str(10), of: z.number().int().min(2).max(300), rows: z.array(z.object({ label: str(6), n: z.number().int().min(0) }).strict()).min(1).max(3), note, say }).strict(),
  z.object({ type: z.literal("quote"), quote: str(30), label: str(4).optional(), source: str(5).optional(), mark: z.string().optional(), stamp, say }).strict(),
  z.object({ type: z.literal("takeaway"), label: str(4).optional(), text: str(22), mark: z.string().optional(), say }).strict(),
  z.object({ type: z.literal("end"), recap: z.array(str(10)).min(2).max(3), say }).strict(),
])
const Storyboard = z.object({
  slug: z.string(),
  kicker: str(6),
  style: z.enum(Object.keys(STYLES) as [string, ...string[]]),
  palette: z.string().optional(),
  mascot: MASCOT,
  thumb: z.object({ scene: z.number().int().min(0) }).strict().optional(),
  scenes: z.array(Scene).min(5).max(12),
}).strict()
type SB = z.infer<typeof Storyboard>
type Sc = SB["scenes"][number]
const MECH = new Set(["diagram", "stack", "steps", "grid", "equation", "compare"])
const NUMERIC = new Set(["stat", "bars", "tally"])

// ---- the article, normalised for comparison ----
const NUMWORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 }
// digit runs, as the comparable token: "1,776" → "1776", "14.1" → "14.1", "0.8B" → "0.8"
const numTokens = (s: string) => (String(s).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""))
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

// Only what a viewer sees or hears is a fact. Layout (`at`, `bend`, layer
// indices, grid sizes, patterns), ids and the mascot are not.
const TEXT_KEYS = new Set(["kicker", "headline", "sub", "say", "text", "label", "note", "quote", "source", "mark", "title", "value", "unit", "input", "output", "match", "colLabel", "rowLabel", "of", "n", "credit"])
const TEXT_ARRAYS = new Set(["punch", "recap", "items"])
const SKIP = new Set(["mascot", "style", "palette", "type", "kind", "tone", "pattern", "at", "bend", "from", "to", "show", "flow", "focus", "highlight", "hl", "dashed", "id", "thumb", "rows", "cols", "side", "repeat", "slug", "nodes", "src", "clip"])
function strings(v: unknown, key = "", out: string[] = []): string[] {
  if (v == null) return out
  if (typeof v === "string" || typeof v === "number") { if (TEXT_KEYS.has(key)) out.push(String(v)); return out }
  if (Array.isArray(v)) { for (const x of v) (typeof x === "string" && TEXT_ARRAYS.has(key)) ? out.push(x) : strings(x, key, out); return out }
  if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (k === "rows" && Array.isArray(x)) { strings(x, "", out); continue }            // tally rows are shown; grid rows are a size
    if (k === "nodes" && Array.isArray(x) && x.length && typeof x[0] === "object") { strings(x, "", out); continue }
    if (k === "side" || k === "repeat") { if (x && typeof x === "object") out.push(String((x as { label?: string }).label ?? "")); continue }
    if (SKIP.has(k)) continue
    strings(x, k, out)
  }
  return out
}

// Presence anywhere is weak evidence for a small number: a 700-line article
// contains "15" somewhere. So a scene's key figures must also sit within ~160
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

// ---- narration: what each beat will say (mirrors engine/explainer.js beats()) ----
function beatLines(sc: Sc): string[] {
  switch (sc.type) {
    case "title": return [sc.say ?? `Hi, I'm Name! ${sc.headline}. ${sc.sub ?? ""}`]
    case "diagram": case "stack": case "grid": case "figure": return sc.steps.map((s) => s.say)
    case "steps": return (sc.say ? [sc.say] : []).concat(sc.items.map((i) => i.say ?? i.text))
    case "compare": return [sc.left.say ?? sc.left.title, sc.right.say ?? sc.right.title]
    case "equation": return [sc.say ?? "Here is the formula."].concat(sc.parts.map((p) => p.say ?? p.note))
    case "stat": return [sc.say ?? `${sc.value} ${sc.label}`]
    case "bars": return [sc.say ?? sc.title]
    case "tally": return [sc.say ?? sc.rows.map((r) => `${r.n} of ${sc.of} ${r.label}`).join("; ")]
    case "quote": return [sc.say ?? `${sc.source ?? "The claim"} says: ${sc.quote}`]
    case "idea": case "takeaway": return [sc.say ?? sc.text]
    case "end": return [sc.say ?? `To recap: ${sc.recap.join("; ")}.`, "Every source is in the full article. I'm Name. Bye!"]
  }
}
const BUDGET = 280   // narration words: about 90 s of speech at Kokoro 1.1x, a film of ~105 s

// ---- diagram geometry (mirrors engine/explainer.js layoutDiagram) ----
// Text is sized from each style's real glyph advances (metrics.json, written
// by `node render.mjs metrics`), wrapped and fitted the way type.js does it,
// so a node is as wide here as it will be on screen. Summing single-glyph
// advances ignores kerning, which only ever narrows a word: the error is on
// the safe side.
const METRICS = join(ROOT, "brand-crew", "skills", "explainer-films", "metrics.json")
type Role = { k: number; caps: boolean; adv: number[] }
type Met = { fonts: string; styles: Record<string, { ls: number; minPx: number; roles: Record<string, Role> }> }
const MET: Met | null = existsSync(METRICS) ? JSON.parse(readFileSync(METRICS, "utf8")) : null
if (!MET) console.warn("! films: no metrics.json, so node sizes are guessed; run node brand-crew/skills/explainer-films/render.mjs metrics")
else if (MET.fonts !== fontsSha()) console.warn("! films: metrics.json predates a font or style change; run node brand-crew/skills/explainer-films/render.mjs metrics")

type Fit = { px: number; lines: number[] }
function fitR(style: string, role: string, s: string, maxPx: number, minPx: number, maxW: number, maxLines: number): Fit {
  const S = MET!.styles[style], R = S.roles[role] ?? S.roles.body
  const txt = R.caps ? s.toUpperCase() : s
  const avg = R.adv.slice(65, 91).reduce((a, b) => a + b, 0) / 26   // a glyph outside ASCII: an average lowercase one
  const width = (w: string, size: number) => [...w].reduce((a, ch) => { const c = ch.charCodeAt(0); return a + (c >= 32 && c < 127 ? R.adv[c - 32] : avg) * size / 100 + S.ls }, 0)
  const wrap = (size: number) => {
    const sp = width(" ", size), lines: number[] = []
    let cw = -1
    for (const w of txt.split(/\s+/).filter(Boolean)) {
      const ww = width(w, size)
      if (cw >= 0 && cw + sp + ww > maxW) { lines.push(cw); cw = -1 }
      cw = cw < 0 ? ww : cw + sp + ww
    }
    if (cw >= 0) lines.push(cw)
    return lines
  }
  const sizeOf = (px: number) => Math.round(Math.max(px * R.k, S.minPx))   // the font size F() asks for
  for (let px = maxPx; px >= minPx; px -= 2) {
    const lines = wrap(sizeOf(px))
    if (lines.length <= maxLines && lines.every((l) => l <= maxW)) return { px: Math.max(px * R.k, S.minPx), lines }
  }
  return { px: Math.max(minPx * R.k, S.minPx), lines: wrap(sizeOf(minPx)) }
}

function nodeBox(style: string, n: { label: string; sub?: string; kind?: string; at: [number, number] }) {
  const cx = 160 + (n.at[0] / 100) * 1100, cy = 300 + (n.at[1] / 100) * 590
  if (!MET) return guessBox(n, cx, cy)
  // an operator circle grows to hold its word
  if (n.kind === "op") { const lb = fitR(style, "head", n.label, 46, 26, 150, 1), r = Math.max(48, lb.lines[0] / 2 + 20); return { x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r } }
  const lb = fitR(style, "body", n.label, 32, 24, 250, 2)
  // a sub-label takes one line if it fits at any size, two only if it doesn't
  let sb = n.sub ? fitR(style, "mono", n.sub, 25, 19, 300, 1) : null
  if (sb && sb.lines.length > 1) sb = fitR(style, "mono", n.sub!, 25, 19, 300, 2)
  let w = Math.max(150, Math.max(...lb.lines, ...(sb ? sb.lines : [0])) + 60) + (n.kind === "grid" ? 64 : 0)
  let h = lb.lines.length * lb.px * 1.15 + 44 + (sb ? sb.px * (0.3 + sb.lines.length) : 0)
  if (n.kind === "user") { w = Math.max(w - 40, 130); h += 70 }
  if (n.kind === "db") h += 24
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 }
}
// without the table: a flat guess of 17px a letter, 14 for a sub-label
function guessBox(n: { label: string; sub?: string; kind?: string }, cx: number, cy: number) {
  if (n.kind === "op") { const r = Math.max(48, Math.min(150, n.label.length * 25) / 2 + 20); return { x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r } }
  const chars = n.label.length, lines = Math.min(2, Math.ceil((chars * 17) / 250))
  const subW = n.sub ? Math.min(300, n.sub.length * 14) : 0, subLines = n.sub ? Math.min(2, Math.ceil((n.sub.length * 14) / 300)) : 0
  let w = Math.max(150, Math.min(250, chars * 17 / lines) + 60, subW ? subW + 60 : 0) + (n.kind === "grid" ? 64 : 0)
  let h = lines * 37 + 44 + (n.sub ? 25 * (0.3 + subLines) : 0)
  if (n.kind === "user") { w = Math.max(w - 40, 130); h += 70 }
  if (n.kind === "db") h += 24
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 }
}

const errors: string[] = []
const fail = (slug: string, msg: string) => errors.push(`${slug}: ${msg}`)

// every storyboard key: article slugs, then `<kind>/<slug>` for each namespace
const files = storyboardKeys()
// a directory under data/films that is not a namespace would be silently skipped
for (const d of readdirSync(SB_DIR, { withFileTypes: true })) if (d.isDirectory() && !NAMESPACES.includes(d.name)) fail(d.name, `data/films/${d.name}/ is not a film namespace (${NAMESPACES.join(", ")})`)
type Man = { films: Record<string, { sha: string; duration: number; mp4Bytes: number; posterBytes: number; vttBytes?: number }> }
const manifest: Man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, "utf8")) : { films: {} }
const thumbs: { thumbs: Record<string, { sha: string; bytes: number }> } = existsSync(TMAN) ? JSON.parse(readFileSync(TMAN, "utf8")) : { thumbs: {} }
const names = new Map<string, string>(), outfits = new Map<string, string>()

let checked = 0, unrendered = 0
for (const slug of files) {
  let raw: unknown
  try { raw = JSON.parse(readFileSync(join(SB_DIR, `${slug}.json`), "utf8")) } catch (e) { fail(slug, `not JSON: ${(e as Error).message}`); continue }
  // mascots are unique across the whole set, so read every one even under --only
  const m0 = (raw as { mascot?: z.infer<typeof MASCOT> }).mascot
  if (m0?.name) { const o = names.get(m0.name); if (o && (!only || only.includes(slug) || only.includes(o))) fail(slug, `mascot name "${m0.name}" is already ${o}'s`); names.set(m0.name, slug) }
  if (m0) { const k = [m0.species, m0.fur, m0.ears, m0.hat, m0.glasses, m0.outfit, m0.prop].join("/"); const o = outfits.get(k); if (o && (!only || only.includes(slug) || only.includes(o))) fail(slug, `mascot looks exactly like ${o}'s (${k}); change one thing`); outfits.set(k, slug) }
  if (only && !only.includes(slug)) continue
  checked++
  const mdxPath = sourceOf(slug)
  if (!existsSync(mdxPath)) { fail(slug, splitKey(slug).ns ? `no doc ${mdxPath.slice(ROOT.length + 1)}` : "no article content/articles/" + slug + ".mdx"); continue }
  const parsed = Storyboard.safeParse(raw)
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 8)) fail(slug, `${i.path.join(".") || "(root)"}: ${i.message}`)
    continue
  }
  const sb = parsed.data
  if (sb.slug !== slug) fail(slug, `slug field is "${sb.slug}"; it must be the film's key, "${slug}"`)
  if (sb.palette && !STYLES[sb.style].includes(sb.palette)) fail(slug, `palette "${sb.palette}" is not one of ${sb.style}'s: ${STYLES[sb.style].join(", ")}`)
  const types = sb.scenes.map((s) => s.type)
  if (types[0] !== "title") fail(slug, "first scene must be title")
  if (types[types.length - 1] !== "end" || types.filter((t) => t === "end").length !== 1) fail(slug, "end must be the last scene, once")
  if (types.filter((t) => t === "title").length !== 1) fail(slug, "exactly one title")
  if (!types.some((t) => MECH.has(t))) fail(slug, "no mechanism scene: an explainer needs a diagram, stack, steps, grid, equation or compare")
  if (types.filter((t) => t === "takeaway").length !== 1) fail(slug, "exactly one takeaway")
  if (types.filter((t) => t === "quote").length > 1) fail(slug, "at most one quote")
  if (types.filter((t) => NUMERIC.has(t)).length > 3) fail(slug, "more than three number scenes: explain, don't tabulate")
  if (types.filter((t) => t === "figure").length > 2) fail(slug, "at most two figure scenes")
  if (sb.thumb && sb.thumb.scene >= sb.scenes.length) fail(slug, `thumb.scene ${sb.thumb.scene} is past the last scene`)
  const narration = sb.scenes.flatMap(beatLines).reduce((a, l) => a + words(l), 0)
  if (narration > BUDGET) fail(slug, `narration is ${narration} words; the budget is ${BUDGET} (about 105 s of film). Cut words, not scenes`)

  const src = readFileSync(mdxPath, "utf8")
  const nums = articleNumbers(src)
  const body = prose(src)
  for (const s of strings(sb.scenes).concat(sb.kicker)) for (const n of numTokens(s)) if (!nums.has(n)) fail(slug, `"${n}" (in "${s}") does not appear in the article`)
  const norm = numbered(src)
  const keyed = (vals: string[], ...ls: (string | undefined)[]) => {
    const ws = labelWords(...ls)
    for (const v of vals) for (const n of numTokens(v)) if (nums.has(n) && !nearLabel(norm, n, ws)) fail(slug, `"${n}" appears in the article, but nowhere near "${ls.filter(Boolean).join(" / ")}"`)
  }
  const inside = (mark: string | undefined, text: string, where: string) => { if (mark && !text.toLowerCase().includes(mark.toLowerCase())) fail(slug, `mark "${mark}" is not inside the ${where}`) }
  sb.scenes.forEach((sc, si) => {
    const at = `scene ${si} (${sc.type})`
    if (sc.type === "stat") keyed([sc.value], sc.label)
    if (sc.type === "bars") for (const it of sc.items) keyed([it.value], it.label, sc.title)
    if (sc.type === "tally") for (const r of sc.rows) { keyed([String(r.n), String(sc.of)], r.label, sc.label); if (r.n > sc.of) fail(slug, `${at}: row "${r.label}" has n ${r.n} > of ${sc.of}`) }
    if (sc.type === "quote") {
      const q = prose(sc.quote).trim()
      if (!body.includes(q)) fail(slug, `${at}: quote is not verbatim in the article: "${sc.quote}"`)
      inside(sc.mark && prose(sc.mark).trim(), q, "quote")
    }
    if (sc.type === "idea" || sc.type === "takeaway") inside(sc.mark, sc.text, sc.type)
    if (sc.type === "equation") for (const p of sc.parts) if (!sc.text.includes(p.match)) fail(slug, `${at}: part "${p.match}" is not in the formula`)
    if (sc.type === "figure") {
      // the article's own picture or clip: committed, and shown by the article itself
      const video = !/\.(png|jpe?g|webp|gif|avif)$/i.test(sc.src), base = sc.src.replace(/\.(mp4|webm|mov)$/i, "")
      const file = join(ROOT, "public", sc.src), exists = video && base === sc.src ? [".mp4", ".webm"].some((e) => existsSync(file + e)) : existsSync(file)
      if (!exists) fail(slug, `${at}: ${sc.src} is not a committed file under public/`)
      const shows = [sc.src, base].some((p) => src.includes(`"${p}"`))
      if (!shows) fail(slug, `${at}: the article does not show ${sc.src}; a film uses only the article's own figures and clips`)
      if (sc.clip && (!video || sc.clip[1] <= sc.clip[0])) fail(slug, `${at}: clip is [from, to] seconds of a video`)
      for (const st of sc.steps) if (st.focus) {
        const [x, y, w, h] = st.focus
        if (w < 8 || h < 8 || x + w > 100.01 || y + h > 100.01) fail(slug, `${at}: focus [${st.focus}] must lie inside the picture (x+w, y+h ≤ 100) and be at least 8 wide and tall`)
      }
    }
    if (sc.type === "stack") {
      const n = sc.layers.length
      if (sc.repeat && (sc.repeat.from >= n || sc.repeat.to >= n || sc.repeat.from > sc.repeat.to)) fail(slug, `${at}: repeat must span layers 0..${n - 1}, from ≤ to`)
      if (sc.side && sc.side.to >= n) fail(slug, `${at}: side.to ${sc.side.to} is not a layer`)
      for (const s of sc.steps) { for (const h of s.highlight ?? []) if (h >= n) fail(slug, `${at}: highlight ${h} is not a layer`); if (s.show && s.show > n) fail(slug, `${at}: show ${s.show} > ${n} layers`) }
      if (sc.steps.some((s) => s.side) && !sc.side) fail(slug, `${at}: a step shows the side component but there is none`)
    }
    if (sc.type === "diagram") {
      const ids = new Set(sc.nodes.map((n) => n.id))
      if (ids.size !== sc.nodes.length) fail(slug, `${at}: duplicate node id`)
      const keys = new Set((sc.edges ?? []).map((e) => `${e.from}>${e.to}`))
      for (const e of sc.edges ?? []) if (!ids.has(e.from) || !ids.has(e.to)) fail(slug, `${at}: edge ${e.from}>${e.to} names a missing node`)
      for (const g of sc.groups ?? []) for (const x of g.nodes) if (!ids.has(x)) fail(slug, `${at}: group "${g.label}" names missing node ${x}`)
      for (const s of sc.steps) {
        for (const x of s.show ?? []) if (!ids.has(x) && !keys.has(x)) fail(slug, `${at}: step shows "${x}", which is neither a node nor an edge`)
        for (const x of s.flow ?? []) if (!keys.has(x)) fail(slug, `${at}: flow "${x}" is not an edge (write from>to)`)
        for (const x of [...(s.highlight ?? []), ...(s.focus ?? [])]) if (!ids.has(x)) fail(slug, `${at}: "${x}" is not a node`)
      }
      const boxes = sc.nodes.map((n) => ({ id: n.id, ...nodeBox(sb.style, n) }))
      for (const b of boxes) {
        if (b.x0 < 100 || b.x1 > 1420 || b.y0 < 240 || b.y1 > 950) fail(slug, `${at}: node "${b.id}" runs off the diagram area (x 0-100 and y 0-100 are node centres; wide nodes need room, and the host stands right of x ~1420)`)
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        if (a.x0 < b.x1 + 24 && b.x0 < a.x1 + 24 && a.y0 < b.y1 + 24 && b.y0 < a.y1 + 24) fail(slug, `${at}: nodes "${a.id}" and "${b.id}" overlap; move them apart`)
      }
    }
  })

  if (sbOnly) continue
  const want = filmSha(raw, articleDate(slug))
  const t = thumbs.thumbs[slug]
  if (!t) fail(slug, "no thumbnail: run build.mjs --thumbs " + slug)
  else if (t.sha !== want) fail(slug, `stale thumbnail: run build.mjs --thumbs ${slug}`)
  else if (!existsSync(join(THUMBS, `${slug}.jpg`))) fail(slug, `missing public/thumbs/${slug}.jpg`)
  const m = manifest.films[slug]
  // Films ship for a chosen set; only a film that exists is held to its storyboard.
  if (!m) { unrendered++; continue }
  if (m.sha !== want) fail(slug, `stale render (manifest ${m.sha}, storyboard+date+engine ${want}): re-run build.mjs ${slug}`)
  for (const f of [`${slug}.mp4`, `${slug}-poster.webp`, `${slug}.vtt`]) {
    const p = join(FILMS, f)
    if (!existsSync(p)) fail(slug, `missing public/films/${f}`)
    else if (f.endsWith(".mp4") && statSync(p).size !== m.mp4Bytes) fail(slug, `public/films/${f} is not the file the manifest describes`)
  }
}

if (!only && !sbOnly) {
  for (const slug of Object.keys(manifest.films)) if (!files.includes(slug)) fail(slug, "in the film manifest but has no storyboard")
  for (const slug of Object.keys(thumbs.thumbs)) if (!files.includes(slug)) fail(slug, "in the thumbnail manifest but has no storyboard")
  // every file, the top level and one directory per namespace, named by its key
  const listed = (dir: string) => {
    const out: string[] = []
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) out.push(d.name)
      else if (NAMESPACES.includes(d.name)) out.push(...readdirSync(join(dir, d.name)).map((f) => `${d.name}/${f}`))
      else fail(d.name, `${dir.slice(ROOT.length + 1)}/${d.name}/ is not a film namespace`)
    }
    return out
  }
  if (existsSync(FILMS))
    for (const f of listed(FILMS)) { const slug = f.replace(/(-poster)?\.(mp4|webp|vtt)$/, ""); if (!manifest.films[slug]) fail(slug, `public/films/${f} is not in the manifest`) }
  if (existsSync(THUMBS))
    for (const f of listed(THUMBS)) { const slug = f.replace(/\.jpg$/, ""); if (!thumbs.thumbs[slug]) fail(slug, `public/thumbs/${f} is not in the thumbnail manifest`) }
  const arts = readdirSync(join(ROOT, "content", "articles")).filter((f) => f.endsWith(".mdx")).map((f) => f.slice(0, -4))
  for (const a of arts) if (!files.includes(a)) fail(a, "article has no storyboard in data/films/ (every article gets a thumbnail)")
  // a namespace's docs are held to the same rule, for the docs that exist
  for (const ns of NAMESPACES) {
    const dir = join(ROOT, "content", ns)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
      const key = `${ns}/${f.slice(0, -4)}`
      if (!files.includes(key)) fail(key, `content/${ns}/${f} has no storyboard data/films/${key}.json (every doc gets a thumbnail)`)
    }
  }
}

if (errors.length) {
  console.error(`✗ films: ${errors.length} problem(s)`)
  for (const e of errors.slice(0, 200)) console.error("  " + e)
  process.exit(1)
}
const total = Object.values(manifest.films).reduce((a, m) => a + m.mp4Bytes + m.posterBytes + (m.vttBytes || 0), 0)
const secs = Object.values(manifest.films).reduce((a, m) => a + m.duration, 0)
const tb = Object.values(thumbs.thumbs).reduce((a, t) => a + t.bytes, 0)
console.log(`✓ films OK — ${checked} storyboard(s) checked against their articles; ${Object.keys(manifest.films).length} film(s) (${(secs / 60).toFixed(1)} min, ${(total / 1048576).toFixed(1)} MB)${unrendered ? `, ${unrendered} storyboard(s) without a film` : ""}; ${Object.keys(thumbs.thumbs).length} thumbnail(s) (${(tb / 1048576).toFixed(1)} MB)`)
