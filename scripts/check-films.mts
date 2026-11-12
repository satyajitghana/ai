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
//            and exactly one takeaway; diagrams have no overlapping nodes, no
//            arrow drawn backwards between two boxes set too close, and
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
// The story format. A storyboard with "format": "story" is a long film told
// in chapters (SKILL.md, "Story format"): 10-24 scenes, 400-750 words of
// narration, an arc (a cold open, then the problem, the idea, the mechanism in
// depth, the evidence, the limits, the takeaway), and six scene types only it
// may use: chapter, hook, chart, trace, code and inset. Any of its beats may
// carry a `term` lower-third. Everything above holds for it, with its own
// limits; every digit those new scenes draw (a chart's points and ticks, a
// trace's values) is held to the article like any other, and a code scene's
// lines must each be the article's own.
//
// --file=<path.json> checks one storyboard that is not in data/films yet (a
// draft) as if it were there, under the key in its slug field. Shape, layout
// and facts only.
//
// It cannot tell whether an explanation is right. That part is the author's,
// and SKILL.md says how.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { MEDIA_MAP, mediaExists } from "./media-files"
import { z } from "zod"
import { NAMESPACES, articleDate, customModules, filmSha, fontsSha, isStory, sourceOf, splitKey, storyboardKeys } from "../brand-crew/skills/explainer-films/hash.mjs"

const ROOT = process.cwd()
const SB_DIR = join(ROOT, "data", "films")
const FILMS = join(ROOT, "public", "films")
const THUMBS = join(ROOT, "public", "thumbs")
const MAN = join(ROOT, "data", ".generated", "films.json")
const TMAN = join(ROOT, "data", ".generated", "thumbs.json")
// --file: a draft storyboard outside data/films, checked under its own slug
const draftPath = process.argv.find((a) => a.startsWith("--file="))?.slice(7)
const draft = draftPath ? (JSON.parse(readFileSync(draftPath, "utf8")) as { slug: string }) : null
const only = draft ? [draft.slug] : process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",")
// --storyboards: shape, explanation and facts only, for authoring before anything is rendered
const sbOnly = process.argv.includes("--storyboards") || !!draft

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
// The scenes, as a factory: the legacy schema is exactly what it always was
// (story: false), and the story format's (story: true) adds `term` to every
// beat, allows a few more steps and words, and adds its own scene types.
type Lim = { story: boolean }
function sceneTypes({ story }: Lim) {
  const say = str(story ? 40 : 34).optional()
  const sayReq = str(story ? 40 : 34)
  const term = story ? { term: str(10).refine((t) => !t.includes(":") || words(t.split(":")[0]) <= 3, "a term is \"Word: what it means\", the word part ≤ 3 words").optional() } : {}
  const more = (legacy: number, longer: number) => (story ? longer : legacy)
  return [
  z.object({ type: z.literal("title"), punch: z.array(str(4)).max(3).optional(), headline: str(10), sub: str(14).optional(), say }).strict(),
  z.object({ type: z.literal("idea"), label: str(5).optional(), text: str(28), mark: z.string().optional(), say, ...term }).strict(),
  z.object({
    type: z.literal("diagram"), title: str(8),
    nodes: z.array(NODE).min(2).max(more(9, 10)),
    edges: z.array(EDGE).max(more(12, 14)).optional(),
    groups: z.array(z.object({ label: str(4), nodes: z.array(id).min(1), tone }).strict()).max(3).optional(),
    steps: z.array(z.object({ show: z.array(z.string()).optional(), flow: z.array(z.string()).optional(), focus: z.array(id).optional(), highlight: z.array(id).optional(), note, say: sayReq, ...term }).strict()).min(1).max(more(6, 8)),
  }).strict(),
  z.object({
    type: z.literal("stack"), title: str(10), input: str(3).optional(), output: str(3).optional(),
    layers: z.array(z.object({ label: str(5), tone }).strict()).min(2).max(7),
    repeat: z.object({ from: z.number().int().min(0), to: z.number().int().min(0), label: z.string().min(1).max(8) }).strict().optional(),
    side: z.object({ label: str(6), to: z.number().int().min(0) }).strict().optional(),
    steps: z.array(z.object({ show: z.number().int().min(1).optional(), highlight: z.array(z.number().int().min(0)).optional(), side: z.boolean().optional(), flow: z.boolean().optional(), note, say: sayReq, ...term }).strict()).min(1).max(more(5, 6)),
  }).strict(),
  z.object({ type: z.literal("steps"), title: str(8), say, items: z.array(z.object({ text: str(7), sub: str(5).optional(), say, ...term }).strict()).min(2).max(more(5, 6)) }).strict(),
  z.object({
    type: z.literal("compare"), title: str(8).optional(),
    left: z.object({ title: str(5), items: z.array(str(10)).min(1).max(3), say }).strict(),
    right: z.object({ title: str(5), items: z.array(str(10)).min(1).max(3), say }).strict(),
  }).strict(),
  z.object({
    type: z.literal("grid"), title: str(8), rows: z.number().int().min(2).max(16), cols: z.number().int().min(2).max(16), rowLabel: str(2).optional(), colLabel: str(2).optional(),
    steps: z.array(z.object({ pattern: z.string().regex(PATTERN, "a grid pattern (see SKILL.md)"), label: str(10).optional(), note, say: sayReq, ...term }).strict()).min(1).max(more(5, 6)),
  }).strict(),
  z.object({ type: z.literal("equation"), title: str(8).optional(), text: z.string().min(3).max(48), say, ...term, parts: z.array(z.object({ match: z.string().min(1), note: str(12), say, ...term }).strict()).min(1).max(more(4, 5)) }).strict(),
  z.object({
    type: z.literal("figure"), title: str(8).optional(),
    src: z.string().regex(new RegExp(`^/(${["articles", ...NAMESPACES].join("|")})/[^\\s"]+$`), "a path under /articles/ (or a namespace's /<kind>/) that the article itself shows"),
    credit: str(10), clip: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
    steps: z.array(z.object({ focus: z.tuple([pct, pct, pct, pct]).optional(), note, say: sayReq, ...term }).strict()).min(1).max(more(4, 5)),
  }).strict(),
  z.object({ type: z.literal("stat"), value: z.string().min(1).max(20), label: str(14), note, stamp, say, ...term }).strict(),
  z.object({ type: z.literal("bars"), title: str(10), unit: z.string().max(4).optional(), items: z.array(z.object({ label: str(5), value: numeric, hl: z.boolean().optional() }).strict()).min(2).max(5), note, stamp, say }).strict(),
  z.object({ type: z.literal("tally"), label: str(10), of: z.number().int().min(2).max(300), rows: z.array(z.object({ label: str(6), n: z.number().int().min(0) }).strict()).min(1).max(3), note, say }).strict(),
  z.object({ type: z.literal("quote"), quote: str(30), label: str(4).optional(), source: str(5).optional(), mark: z.string().optional(), stamp, say }).strict(),
  z.object({ type: z.literal("takeaway"), label: str(4).optional(), text: str(22), mark: z.string().optional(), say }).strict(),
  z.object({ type: z.literal("end"), recap: z.array(str(10)).min(2).max(3), say }).strict(),
  ] as const
}
const NODE = z.object({ id, label: str(5), sub: str(5).optional(), kind: z.enum(KINDS).optional(), tone, at: z.tuple([pct, pct]) }).strict()
const EDGE = z.object({ from: id, to: id, label: str(3).optional(), dashed: z.boolean().optional(), bend: z.number().min(-1).max(1).optional() }).strict()
const Scene = z.discriminatedUnion("type", [...sceneTypes({ story: false })])

// ---- the story format's own scenes ----
const sayS = str(40), termS = str(10).refine((t) => !t.includes(":") || words(t.split(":")[0]) <= 3, "a term is \"Word: what it means\", the word part ≤ 3 words").optional()
const AXIS = z.object({
  label: str(5), ticks: z.array(z.number()).max(8).optional(), tickLabels: z.array(z.string().min(1).max(8)).max(8).optional(),
  log: z.boolean().optional(), zero: z.boolean().optional(),
}).strict()
const StoryOnly = [
  z.object({ type: z.literal("chapter"), title: str(6), sub: str(14).optional(), say: sayS.optional() }).strict(),
  z.object({ type: z.literal("hook"), text: str(24), mark: z.string().optional(), sub: str(14).optional(), say: sayS.optional() }).strict(),
  z.object({
    type: z.literal("chart"), title: str(8), kind: z.enum(["line", "scatter"]).optional(), x: AXIS, y: AXIS,
    series: z.array(z.object({ label: str(5), points: z.array(z.tuple([z.number(), z.number()])).min(2).max(24), hl: z.boolean().optional(), dashed: z.boolean().optional() }).strict()).min(1).max(4),
    illustrative: z.boolean().optional(), stamp,
    steps: z.array(z.object({ show: z.array(z.number().int().min(0)).optional(), mark: z.object({ series: z.number().int().min(0), point: z.number().int().min(0), label: str(6) }).strict().optional(), note, say: sayS, term: termS }).strict()).min(1).max(5),
  }).strict(),
  z.object({
    type: z.literal("trace"), title: str(8),
    stages: z.array(z.object({ label: str(4), sub: str(5).optional() }).strict()).min(2).max(6),
    steps: z.array(z.object({ at: z.number().int().min(0), value: z.string().min(1).max(32).refine((v) => words(v) <= 6, "≤ 6 words"), note, say: sayS, term: termS }).strict()).min(2).max(8),
  }).strict(),
  z.object({
    type: z.literal("code"), title: str(8).optional(), credit: str(10).optional(),
    code: z.array(z.string().max(64, "≤ 64 characters a line")).min(2).max(14),
    steps: z.array(z.object({ lines: z.tuple([z.number().int().min(1), z.number().int().min(1)]), note, say: sayS, term: termS }).strict()).min(1).max(5),
  }).strict(),
  z.object({
    type: z.literal("inset"), title: str(8), open: id,
    nodes: z.array(NODE).min(2).max(8), edges: z.array(EDGE).max(12).optional(),
    groups: z.array(z.object({ label: str(4), nodes: z.array(id).min(1), tone }).strict()).max(3).optional(),
    inner: z.object({ title: str(6).optional(), nodes: z.array(NODE).min(2).max(8), edges: z.array(EDGE).max(12).optional() }).strict(),
    steps: z.array(z.object({ inner: z.boolean().optional(), show: z.array(z.string()).optional(), flow: z.array(z.string()).optional(), highlight: z.array(id).optional(), note, say: sayS, term: termS }).strict()).min(2).max(9),
  }).strict(),
  // a bespoke scene: drawn by the film's own module, custom/<key>/<module>.js
  z.object({
    type: z.literal("custom"), module: z.string().regex(/^[a-z][a-z0-9-]*$/, "a module name: lowercase, digits, hyphens"),
    title: str(8).optional(), mechanism: z.boolean().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    steps: z.array(z.object({ say: sayS, note, term: termS }).passthrough()).min(1).max(8),
  }).strict(),
] as const
const StoryScene = z.discriminatedUnion("type", [...sceneTypes({ story: true }), ...StoryOnly])
// Story storyboards written before bespoke scenes existed. Every other story
// film needs at least one bespoke mechanism scene.
const BESPOKE_EXEMPT = new Set(["nex-n2-6", "raon-1-nano"])
const base = {
  slug: z.string(),
  kicker: str(6),
  style: z.enum(Object.keys(STYLES) as [string, ...string[]]),
  palette: z.string().optional(),
  mascot: MASCOT,
  thumb: z.object({ scene: z.number().int().min(0) }).strict().optional(),
}
const Legacy = z.object({ ...base, scenes: z.array(Scene).min(5).max(12) }).strict()
const Story = z.object({ ...base, format: z.literal("story"), scenes: z.array(StoryScene).min(10).max(24) }).strict()
type SB = z.infer<typeof Story>
type Sc = SB["scenes"][number]
const MECH = new Set(["diagram", "stack", "steps", "grid", "equation", "compare"])
const MECH_STORY = new Set([...MECH, "trace", "inset", "code"])
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
// (`term`, `tickLabels` and `code` are the story format's; a legacy storyboard cannot have them)
const TEXT_KEYS = new Set(["kicker", "headline", "sub", "say", "text", "label", "note", "quote", "source", "mark", "title", "value", "unit", "input", "output", "match", "colLabel", "rowLabel", "of", "n", "credit", "term"])
const TEXT_ARRAYS = new Set(["punch", "recap", "items", "tickLabels", "code"])
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
    case "chapter": return [sc.say ?? sc.title]
    case "hook": return [sc.say ?? sc.text]
    case "chart": case "trace": case "code": case "inset": case "custom": return sc.steps.map((s) => s.say)
  }
}
const BUDGET = 280   // narration words: about 90 s of speech at Kokoro 1.1x, a film of ~105 s
// the story format: about 2.5 to 4.5 minutes of speech, a film of 3 to 5 minutes
const STORY_BUDGET = [400, 750] as const

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

// A diagram's ids, its steps' references, and its layout: nodes inside the
// area and clear of the host, no two overlapping, no arrow drawn backwards.
// (An inset is two diagrams, each held to the same.)
type DNode = z.infer<typeof NODE>
type DEdge = z.infer<typeof EDGE>
type DStep = { show?: string[]; flow?: string[]; highlight?: string[]; focus?: string[] }
function diagramChecks(slug: string, at: string, style: string, nodes: DNode[], edges: DEdge[], groups: { label: string; nodes: string[] }[], steps: DStep[]) {
      const ids = new Set(nodes.map((n) => n.id))
      if (ids.size !== nodes.length) fail(slug, `${at}: duplicate node id`)
      const keys = new Set(edges.map((e) => `${e.from}>${e.to}`))
      for (const e of edges) if (!ids.has(e.from) || !ids.has(e.to)) fail(slug, `${at}: edge ${e.from}>${e.to} names a missing node`)
      for (const g of groups) for (const x of g.nodes) if (!ids.has(x)) fail(slug, `${at}: group "${g.label}" names missing node ${x}`)
      for (const s of steps) {
        for (const x of s.show ?? []) if (!ids.has(x) && !keys.has(x)) fail(slug, `${at}: step shows "${x}", which is neither a node nor an edge`)
        for (const x of s.flow ?? []) if (!keys.has(x)) fail(slug, `${at}: flow "${x}" is not an edge (write from>to)`)
        for (const x of [...(s.highlight ?? []), ...(s.focus ?? [])]) if (!ids.has(x)) fail(slug, `${at}: "${x}" is not a node`)
      }
      const boxes = nodes.map((n) => ({ id: n.id, ...nodeBox(style, n) }))
      for (const b of boxes) {
        if (b.x0 < 100 || b.x1 > 1420 || b.y0 < 240 || b.y1 > 950) fail(slug, `${at}: node "${b.id}" runs off the diagram area (x 0-100 and y 0-100 are node centres; wide nodes need room, and the host stands right of x ~1420)`)
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        if (a.x0 < b.x1 + 24 && b.x0 < a.x1 + 24 && a.y0 < b.y1 + 24 && b.y0 < a.y1 + 24) fail(slug, `${at}: nodes "${a.id}" and "${b.id}" overlap; move them apart`)
      }
      // An edge runs from 12px outside its source box to 12px outside its target
      // (engine/explainer.js edgePath). Two boxes close together along the edge
      // put those two points past each other, and the line then runs backwards:
      // the arrowhead lands on the source, pointing the wrong way.
      const byId = new Map(nodes.map((n, i) => [n.id, { ...boxes[i], op: n.kind === "op" }]))
      for (const e of edges) {
        const A = byId.get(e.from), B = byId.get(e.to)
        if (!A || !B) continue
        const ax = (A.x0 + A.x1) / 2, ay = (A.y0 + A.y1) / 2, bx = (B.x0 + B.x1) / 2, by = (B.y0 + B.y1) / 2
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, bend = (e.bend ?? 0) * L * 0.35
        const Cx = (ax + bx) / 2 - (dy / L) * bend, Cy = (ay + by) / 2 + (dx / L) * bend
        const end = (N: typeof A, x: number, y: number) => {
          const tx = Cx - x, ty = Cy - y, d = Math.hypot(tx, ty) || 1, ux = tx / d, uy = ty / d
          const t = N.op ? (N.x1 - N.x0) / 2 + 10 : Math.min(Math.abs(ux) > 1e-6 ? ((N.x1 - N.x0) / 2 + 12) / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? ((N.y1 - N.y0) / 2 + 12) / Math.abs(uy) : 1e9)
          return [x + ux * t, y + uy * t]
        }
        const [p0x, p0y] = end(A, ax, ay), [p2x, p2y] = end(B, bx, by)
        const run = ((p2x - p0x) * dx + (p2y - p0y) * dy) / L
        // A short run still reads (the head sits in the gap); a negative one never does.
        if (run < 0) fail(slug, `${at}: edge ${e.from}>${e.to} runs ${Math.round(run)}px, so its arrow is drawn backwards; move the two nodes further apart along it, or bend it`)
      }
}

// every storyboard key: article slugs, then `<kind>/<slug>` for each namespace
const files = storyboardKeys()
if (draft && !files.includes(draft.slug)) files.push(draft.slug)
// a directory under data/films that is not a namespace would be silently skipped
for (const d of readdirSync(SB_DIR, { withFileTypes: true })) if (d.isDirectory() && !NAMESPACES.includes(d.name)) fail(d.name, `data/films/${d.name}/ is not a film namespace (${NAMESPACES.join(", ")})`)
type Man = { films: Record<string, { sha: string; duration: number; mp4Bytes: number; posterBytes: number; vttBytes?: number }> }
const manifest: Man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, "utf8")) : { films: {} }
const thumbs: { thumbs: Record<string, { sha: string; bytes: number }> } = existsSync(TMAN) ? JSON.parse(readFileSync(TMAN, "utf8")) : { thumbs: {} }
const names = new Map<string, string>(), outfits = new Map<string, string>()

let checked = 0, unrendered = 0
for (const slug of files) {
  let raw: unknown
  try { raw = draft && slug === draft.slug ? draft : JSON.parse(readFileSync(join(SB_DIR, `${slug}.json`), "utf8")) } catch (e) { fail(slug, `not JSON: ${(e as Error).message}`); continue }
  // mascots are unique across the whole set, so read every one even under --only
  const m0 = (raw as { mascot?: z.infer<typeof MASCOT> }).mascot
  if (m0?.name) { const o = names.get(m0.name); if (o && (!only || only.includes(slug) || only.includes(o))) fail(slug, `mascot name "${m0.name}" is already ${o}'s`); names.set(m0.name, slug) }
  if (m0) { const k = [m0.species, m0.fur, m0.ears, m0.hat, m0.glasses, m0.outfit, m0.prop].join("/"); const o = outfits.get(k); if (o && (!only || only.includes(slug) || only.includes(o))) fail(slug, `mascot looks exactly like ${o}'s (${k}); change one thing`); outfits.set(k, slug) }
  if (only && !only.includes(slug)) continue
  checked++
  const mdxPath = sourceOf(slug)
  if (!existsSync(mdxPath)) { fail(slug, splitKey(slug).ns ? `no doc ${mdxPath.slice(ROOT.length + 1)}` : "no article content/articles/" + slug + ".mdx"); continue }
  const story = isStory(raw)
  const parsed = (story ? Story : Legacy).safeParse(raw)
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 8)) fail(slug, `${i.path.join(".") || "(root)"}: ${i.message}`)
    continue
  }
  const sb = parsed.data as SB
  if (sb.slug !== slug) fail(slug, `slug field is "${sb.slug}"; it must be the film's key, "${slug}"`)
  if (sb.palette && !STYLES[sb.style].includes(sb.palette)) fail(slug, `palette "${sb.palette}" is not one of ${sb.style}'s: ${STYLES[sb.style].join(", ")}`)
  const types: string[] = sb.scenes.map((s) => s.type)
  const count = (t: string) => types.filter((x) => x === t).length
  if (!story) {
    if (types[0] !== "title") fail(slug, "first scene must be title")
    if (types[types.length - 1] !== "end" || count("end") !== 1) fail(slug, "end must be the last scene, once")
    if (count("title") !== 1) fail(slug, "exactly one title")
    if (!types.some((t) => MECH.has(t))) fail(slug, "no mechanism scene: an explainer needs a diagram, stack, steps, grid, equation or compare")
    if (count("takeaway") !== 1) fail(slug, "exactly one takeaway")
    if (count("quote") > 1) fail(slug, "at most one quote")
    if (types.filter((t) => NUMERIC.has(t)).length > 3) fail(slug, "more than three number scenes: explain, don't tabulate")
    if (count("figure") > 2) fail(slug, "at most two figure scenes")
  } else {
    // the arc: an optional cold open, the title, chapters, the mechanism in depth, one takeaway, the end
    const t0 = types[0] === "hook" ? 1 : 0
    if (types[t0] !== "title") fail(slug, "the title comes first, or second after a hook (the cold open)")
    if (count("hook") > 1 || (count("hook") === 1 && types[0] !== "hook")) fail(slug, "a hook is the cold open: at most one, and only as the first scene")
    if (types[types.length - 1] !== "end" || count("end") !== 1) fail(slug, "end must be the last scene, once")
    if (count("title") !== 1) fail(slug, "exactly one title")
    // a bespoke scene counts as a mechanism scene when it says so, each module its own kind
    const mech = sb.scenes.flatMap((sc) => (MECH_STORY.has(sc.type) ? [sc.type] : sc.type === "custom" && sc.mechanism ? [`custom:${sc.module}`] : []))
    if (!BESPOKE_EXEMPT.has(slug) && !sb.scenes.some((sc) => sc.type === "custom" && sc.mechanism)) fail(slug, "a story film needs at least one bespoke mechanism scene (type custom, mechanism: true), designed from the article's own widget, figure or idea; see SKILL.md, \"Bespoke scenes\"")
    if (mech.length < 3 || new Set(mech).size < 2) fail(slug, `a story film explains in depth: at least three mechanism scenes of at least two kinds (${[...MECH_STORY].join(", ")}); this has ${mech.length}`)
    if (count("takeaway") !== 1) fail(slug, "exactly one takeaway")
    if (count("quote") > 2) fail(slug, "at most two quotes")
    if (types.filter((t) => NUMERIC.has(t) || t === "chart").length > 4) fail(slug, "more than four number scenes (stat, bars, tally, chart): explain, don't tabulate")
    if (count("figure") > 4) fail(slug, "at most four figure scenes")
    const ch = types.flatMap((t, i) => (t === "chapter" ? [i] : []))
    if (ch.length === 1 || ch.length > 6) fail(slug, `chapters: none, or two to six (this has ${ch.length})`)
    if (ch.length && ch[0] !== t0 + 1) fail(slug, "the first chapter card comes right after the title")
    for (const i of ch) if (types[i + 1] === "chapter" || types[i + 1] === "end" || types[i + 1] === "takeaway") fail(slug, `scene ${i} (chapter): a chapter card needs a scene of its own after it`)
    // a lower-third and a caption would sit in the same place
    sb.scenes.forEach((sc, si) => {
      const steps = (sc as { steps?: { note?: string; term?: string }[] }).steps ?? (sc as { items?: { note?: string; term?: string }[] }).items ?? (sc as { parts?: { note?: string; term?: string }[] }).parts ?? []
      steps.forEach((st, j) => { if (st.note && st.term) fail(slug, `scene ${si} (${sc.type}) step ${j}: note or term, not both (they share the bottom of the frame)`) })
      const own = sc as { note?: string; term?: string }
      if (own.note && own.term) fail(slug, `scene ${si} (${sc.type}): note or term, not both (they share the bottom of the frame)`)
    })
  }
  if (sb.thumb && sb.thumb.scene >= sb.scenes.length) fail(slug, `thumb.scene ${sb.thumb.scene} is past the last scene`)
  const narration = sb.scenes.flatMap(beatLines).reduce((a, l) => a + words(l), 0)
  if (!story && narration > BUDGET) fail(slug, `narration is ${narration} words; the budget is ${BUDGET} (about 105 s of film). Cut words, not scenes`)
  if (story && (narration < STORY_BUDGET[0] || narration > STORY_BUDGET[1])) fail(slug, `narration is ${narration} words; a story film's budget is ${STORY_BUDGET[0]}-${STORY_BUDGET[1]} (about 3 to 5 minutes of film)`)

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
      const exists = video && base === sc.src ? [".mp4", ".webm"].some((e) => mediaExists(sc.src + e)) : mediaExists(sc.src)
      if (!exists) fail(slug, `${at}: ${sc.src} is neither pushed to R2 nor on disk (pnpm media:push)`)
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
    if (sc.type === "diagram") diagramChecks(slug, at, sb.style, sc.nodes, sc.edges ?? [], sc.groups ?? [], sc.steps)
    // ---- the story format's scenes ----
    if (sc.type === "hook") inside(sc.mark, sc.text, "hook")
    if (sc.type === "chart") {
      // every digit it draws: the points' values, the ticks (or their labels; those are text, checked above)
      // a value matches the article's number however it is written: 2.3 is the article's "2.30"
      const asNum = new Set([...nums].map(Number))
      const has = (v: number) => asNum.has(Math.abs(v)) || numTokens(String(v)).every((n) => nums.has(n))
      for (const [ax, name] of [[sc.x, "x"], [sc.y, "y"]] as const) {
        if (ax.tickLabels && ax.tickLabels.length !== (ax.ticks ?? []).length) fail(slug, `${at}: ${name}.tickLabels must match ${name}.ticks one for one`)
        ;(ax.ticks ?? []).forEach((v, i) => { if (!ax.tickLabels?.[i] && !has(v)) fail(slug, `${at}: ${name} tick ${v} is drawn as a number the article does not have; give it a tickLabel from the article`) })
        if (ax.log && [...(ax.ticks ?? []), ...sc.series.flatMap((s) => s.points.map((p) => p[name === "x" ? 0 : 1]))].some((v) => v <= 0)) fail(slug, `${at}: a log ${name} axis needs positive values`)
      }
      const xt = new Set(sc.x.ticks ?? [])
      if (!sc.illustrative) for (const se of sc.series) for (const [x, y] of se.points) {
        if (!has(y)) fail(slug, `${at}: series "${se.label}" plots ${y}, which the article does not have (mark the chart illustrative if the shape is the point, not the numbers)`)
        if (!xt.has(x) && !has(x)) fail(slug, `${at}: series "${se.label}" sits at x = ${x}, neither an x tick nor a number in the article`)
      }
      sc.steps.forEach((st, j) => {
        for (const i of st.show ?? []) if (i >= sc.series.length) fail(slug, `${at} step ${j}: shows series ${i}, and there are ${sc.series.length}`)
        if (st.mark && !sc.series[st.mark.series]?.points[st.mark.point]) fail(slug, `${at} step ${j}: mark names a point that does not exist`)
      })
      if (sc.illustrative && sc.stamp) fail(slug, `${at}: an illustrative chart is stamped Illustrative; drop the stamp`)
    }
    if (sc.type === "trace") sc.steps.forEach((st, j) => { if (st.at >= sc.stages.length) fail(slug, `${at} step ${j}: at ${st.at} is not a stage (0-${sc.stages.length - 1})`) })
    if (sc.type === "code") {
      // quoted code: every line is the article's own, as a quote is
      for (const line of sc.code) if (line.trim() && !src.includes(line.trim())) fail(slug, `${at}: code line is not in the article: "${line.trim()}"`)
      sc.steps.forEach((st, j) => { const [a, b] = st.lines; if (a > b || b > sc.code.length) fail(slug, `${at} step ${j}: lines [${a}, ${b}] must run forward within 1-${sc.code.length}`) })
    }
    if (sc.type === "custom") {
      // the module: there, defining itself, deterministic, offline
      const mod = customModules(sb).find((m: { name: string; file: string }) => m.name === sc.module)!
      if (!existsSync(mod.file)) fail(slug, `${at}: no module ${mod.file.slice(ROOT.length + 1)}`)
      else {
        const code = readFileSync(mod.file, "utf8")
        if (!/BESPOKE\.define\s*\(/.test(code)) fail(slug, `${at}: ${sc.module}.js never calls BESPOKE.define({ draw })`)
        for (const [re, what] of [[/Math\.random/, "Math.random (use k.rng)"], [/Date\.now|new Date|performance\.now/, "the clock"], [/\bfetch\s*\(|XMLHttpRequest|WebSocket|\bimport\s*\(/, "the network"]] as const)
          if (re.test(code)) fail(slug, `${at}: ${sc.module}.js uses ${what}; a frame is a pure function of time`)
        if (code.length > 60000) fail(slug, `${at}: ${sc.module}.js is over 60 KB`)
      }
      // everything it may show: every string in its title, params and steps
      const texts: string[] = []
      const walk = (v: unknown, key = "") => {
        if (typeof v === "string") { if (key !== "say") texts.push(v) }
        else if (Array.isArray(v)) v.forEach((x) => walk(x, key))
        else if (v && typeof v === "object") for (const [kk, x] of Object.entries(v)) walk(x, kk)
      }
      walk(sc.params ?? {}); walk(sc.steps)
      for (const t of texts) {
        if (words(t) > 14) fail(slug, `${at}: "${t.slice(0, 40)}…" is over 14 words; a bespoke scene's labels are labels`)
        for (const n of numTokens(t)) if (!nums.has(n)) fail(slug, `${at}: "${n}" (in "${t}") does not appear in the article`)
      }
      // "data": "article" says the numbers it plots are the article's: then every one must be
      if ((sc.params as { data?: unknown } | undefined)?.data === "article") {
        const asNum = new Set([...nums].map(Number))
        const each = (v: unknown, path: string) => {
          if (typeof v === "number") { if (!asNum.has(Math.abs(v))) fail(slug, `${at}: params${path} is ${v}, which the article does not print; drop "data": "article" (the scene is then stamped Illustrative) or use the article's numbers`) }
          else if (Array.isArray(v)) v.forEach((x, i) => each(x, `${path}[${i}]`))
          else if (v && typeof v === "object") for (const [kk, x] of Object.entries(v)) each(x, `${path}.${kk}`)
        }
        each(sc.params, "")
      }
    }
    if (sc.type === "inset") {
      if (!sc.nodes.some((n) => n.id === sc.open)) fail(slug, `${at}: open "${sc.open}" is not a node of the outer diagram`)
      if (sc.steps[0].inner) fail(slug, `${at}: the first step shows the outside; open the node on a later one`)
      if (!sc.steps.some((st) => st.inner)) fail(slug, `${at}: no step goes inside "${sc.open}" (inner: true)`)
      const outer = sc.steps.map((st) => (st.inner ? { say: st.say } : st)), inner = sc.steps.map((st) => (st.inner ? st : { say: st.say }))
      diagramChecks(slug, `${at} outside`, sb.style, sc.nodes, sc.edges ?? [], sc.groups ?? [], outer)
      diagramChecks(slug, `${at} inside`, sb.style, sc.inner.nodes, sc.inner.edges ?? [], [], inner)
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
  // the mp4 and poster live in R2 (a fresh clone has neither); the captions are committed
  for (const f of [`${slug}.mp4`, `${slug}-poster.webp`, `${slug}.vtt`]) {
    const p = join(FILMS, f)
    if (f.endsWith(".vtt") ? !existsSync(p) : !mediaExists(`/films/${f}`)) fail(slug, `missing public/films/${f}${f.endsWith(".vtt") ? "" : " (in R2 or on disk)"}`)
    else if (f.endsWith(".mp4") && existsSync(p) && statSync(p).size !== m.mp4Bytes) fail(slug, `public/films/${f} is not the file the manifest describes`)
  }
}

if (!only && !sbOnly) {
  for (const slug of Object.keys(manifest.films)) if (!files.includes(slug)) fail(slug, "in the film manifest but has no storyboard")
  for (const slug of Object.keys(thumbs.thumbs)) if (!files.includes(slug)) fail(slug, "in the thumbnail manifest but has no storyboard")
  // Folders under public/thumbs that are not film thumbnails (pages: the home page's explore-card screenshots)
  const NON_FILM_THUMB_DIRS = new Set(["pages"])
  // every file, the top level and one directory per namespace, named by its key
  const listed = (dir: string) => {
    const out: string[] = []
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) out.push(d.name)
      else if (NAMESPACES.includes(d.name)) out.push(...readdirSync(join(dir, d.name)).map((f) => `${d.name}/${f}`))
      // public/films/math holds the math reels: their own manifest and checker (validate:reels)
      else if (dir.endsWith(join("public", "films")) && d.name === "math") continue
      // public/thumbs/pages holds screenshots of the special pages for the home page's explore cards, not film thumbnails
      else if (dir.endsWith(join("public", "thumbs")) && NON_FILM_THUMB_DIRS.has(d.name)) continue
      else fail(d.name, `${dir.slice(ROOT.length + 1)}/${d.name}/ is not a film namespace`)
    }
    return out
  }
  if (existsSync(FILMS))
    for (const f of listed(FILMS)) { const slug = f.replace(/(-poster)?\.(mp4|webp|vtt)$/, ""); if (!manifest.films[slug]) fail(slug, `public/films/${f} is not in the manifest`) }
  // and the same for what was pushed to R2, which a fresh clone does not have on disk
  for (const path of Object.keys(MEDIA_MAP)) {
    if (!path.startsWith("/films/") || path.startsWith("/films/math/")) continue
    const slug = path.slice("/films/".length).replace(/(-poster)?\.(mp4|webp)$/, "")
    if (!manifest.films[slug]) fail(slug, `${path} is in R2 (lib/media-map.json) but not in the film manifest`)
  }
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
