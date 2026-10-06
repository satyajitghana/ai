// The article rubric, score weights, tiers and lens names — the parts of the
// scoring system both the server (lib/content/signals.ts) and the browser
// (/articles list, the "Why read this" panel, the API) need. Pure data and types, no
// Node imports.
//
// A rating scores the SUBJECT plus OUR PAGE as a reader experiences it, 0–3 per
// dimension, and is meant to be stingy: the expected corpus mean is about 1.5,
// and `pnpm validate:ratings` fails once 50 articles are rated if any
// dimension's mean passes 2.2. Tiers are percentiles over the rated corpus, so
// they cannot inflate however the raw numbers drift.

import { KINDS, type KindId, LEVELS, type LevelId, type RunsOnId } from "@/data/taxonomy"

export const RUBRIC = [
  { key: "novelty", q: "Is it new?", label: "Novelty", asks: "Is this actually new?", weight: 1.0, anchors: ["repackaging or news of a known thing", "an incremental tweak", "a real new idea, method or capability", "changes how the field does something"] },
  { key: "verification", q: "Can I trust it?", label: "Verification", asks: "Can I trust it?", weight: 1.2, anchors: ["restates claims", "spot-checks a few numbers", "measures key facts from files, code or configs", "reproduces the headline result, or shows from primary files it is wrong"] },
  { key: "runnable", q: "Can I run it?", label: "Runnable", asks: "Can I use it?", weight: 0.8, anchors: ["closed, nothing to run", "API-only, gated or restrictive licence", "open code or weights with real limits", "open, permissive, runs on reader hardware with instructions"] },
  { key: "explains", q: "Will I understand it?", label: "Explains", asks: "Will I understand how it works?", weight: 1.0, anchors: ["describes, no mechanism", "partial mechanism", "mechanism from first principles with figures", "mechanism carried by interactives built from real code or data"] },
  { key: "takeaway", q: "Can I act on it?", label: "Takeaway", asks: "Can I act on it?", weight: 1.0, anchors: ["nothing to act on", "general advice", "a concrete recipe, numbers or comparison", "a decision guide a practitioner can follow today"] },
  { key: "durability", q: "Will it last?", label: "Durability", asks: "Will this matter next year?", weight: 0.8, anchors: ["news that expires in weeks", "relevant for months", "a reference for a year or more", "evergreen fundamentals"] },
  { key: "reach", q: "Does it affect many?", label: "Reach", asks: "Does it affect many readers?", weight: 0.8, anchors: ["a niche paper or one-off repo", "a specialist community", "a widely used model, tool or lab release", "something most practitioners touch"] },
  { key: "unique", q: "Only here?", label: "Unique", asks: "Why read it here?", weight: 1.0, anchors: ["same as the press release", "some original analysis", "a teardown or measurement few others did", "the only place this analysis exists"] },
] as const

export type RubricKey = (typeof RUBRIC)[number]["key"]
export const RUBRIC_KEYS = RUBRIC.map((r) => r.key) as RubricKey[]

export type Rating = Record<RubricKey, number> & { why: string }

/** Corpus mean above which a dimension counts as inflated (once enough are rated). */
export const INFLATION_MEAN = 2.2
export const INFLATION_MIN_RATED = 50

// Fixed shares, best first, summing to 1. An article's tier is the band its
// rank midpoint falls in, so the shares hold whatever the scores are.
export const TIERS = [
  { id: "essential", label: "Essential", level: 5, share: 0.1 },
  { id: "high", label: "High", level: 4, share: 0.2 },
  { id: "notable", label: "Notable", level: 3, share: 0.3 },
  { id: "solid", label: "Solid", level: 2, share: 0.25 },
  { id: "niche", label: "Niche", level: 1, share: 0.15 },
] as const
export type TierId = (typeof TIERS)[number]["id"]

export const LENSES = [
  { id: "must-read", label: "Must read", blurb: "The best pages here, by overall score." },
  { id: "run-it", label: "Run it yourself", blurb: "Open, runnable, with steps and numbers to act on." },
  { id: "learn", label: "Learn the idea", blurb: "Clear mechanisms that will still be true next year." },
  { id: "new", label: "What's new", blurb: "New ideas with wide reach, freshest first." },
  { id: "deep", label: "Deep dives", blurb: "Measured, verified, analysis you won't find elsewhere." },
  { id: "newest", label: "Newest", blurb: "Everything, most recently updated first." },
] as const
export type LensId = (typeof LENSES)[number]["id"]
/** Lenses with a computed key; `newest` is plain lastUpdated order. */
export type ScoredLensId = Exclude<LensId, "newest">

/** Facts computed from the page itself — never hand-entered. */
export type ArticleFacts = {
  words: number
  readingTimeMins: number
  figures: number
  interactives: number
  film: boolean
  citations: number
  cards: number
  measured: number
  inbound: number
  lastUpdated: string
}

/** Everything the scoring system knows about one article. */
export type ArticleScore = {
  facts: ArticleFacts
  /** 0–100, one decimal; null when unrated. */
  score: number | null
  /** Rank-based tier among rated articles; null when unrated. */
  tier: { id: TierId; label: string; level: number } | null
  /** Rank among rated articles, 1 = best; null when unrated. */
  rank: number | null
  /** Sort keys, higher is better; null when unrated. */
  lenses: Record<ScoredLensId, number> | null
}

// Tier colours: one hue ramp that reads in both themes (mid lightness, used for
// a small mark and its text on the page background).
export const TIER_COLOR: Record<TierId, string> = {
  essential: "oklch(0.68 0.16 150)",
  high: "oklch(0.66 0.12 175)",
  notable: "oklch(0.64 0.11 235)",
  solid: "oklch(0.62 0.05 255)",
  niche: "oklch(0.6 0.02 260)",
}

/** What a lens comparison needs to know about an article. */
export type LensSortable = {
  slug: string
  lastUpdated: string
  score: number | null
  lenses: Record<ScoredLensId, number> | null
}

/**
 * Order by a lens: rated articles by the lens key (higher first), then score,
 * then lastUpdated, then slug; unrated ones after them, newest first.
 * `newest` is lastUpdated order for everyone. Shared by the server (initial
 * order, API) and the /articles list, so both sort identically.
 */
export function compareLens(lens: LensId) {
  return (a: LensSortable, b: LensSortable): number => {
    const byDate = b.lastUpdated.localeCompare(a.lastUpdated) || a.slug.localeCompare(b.slug)
    if (lens === "newest") return byDate
    const ka = a.lenses?.[lens]
    const kb = b.lenses?.[lens]
    if (ka == null && kb == null) return byDate
    if (ka == null) return 1
    if (kb == null) return -1
    return kb - ka || (b.score ?? 0) - (a.score ?? 0) || byDate
  }
}

// ── how a rating is said to a reader ─────────────────────────────────────────
//
// The rubric is the editor's tool; a reader wants to know what the page does
// for them. These turn a rating into plain-language highlights, a tier into the
// band it stands for, and the taxonomy fields into one line of practical facts.
// One place, so the /articles cards, the article page, /api/articles and
// llms.txt all say the same thing.

/** Smallest hardware, said as a reader would. */
export const RUNS_ON_PHRASE: Record<RunsOnId, string> = {
  browser: "Runs in a browser",
  phone: "Runs on a phone",
  cpu: "Runs on a laptop CPU",
  "consumer-gpu": "Runs on a consumer GPU",
  workstation: "Needs a workstation GPU",
  datacenter: "Needs datacenter GPUs",
  api: "API only",
  none: "Nothing to run",
}

// What a 3 and a 2 on each dimension promise a reader. A 2 is common (the
// corpus mean is about 1.5), so its phrase is softer. `runnable` is said
// through the hardware when the subject runs on what a reader owns.
export const HIGHLIGHT_PHRASES: Record<RubricKey, { 3: string; 2: string }> = {
  novelty: { 3: "Genuinely new idea", 2: "A new technique" },
  verification: { 3: "Checked against the source", 2: "Facts measured from source" },
  runnable: { 3: "Open and runnable", 2: "Open code or weights" },
  explains: { 3: "Interactive explanations", 2: "Explained from first principles" },
  takeaway: { 3: "A guide you can follow today", 2: "Concrete numbers to act on" },
  durability: { 3: "Evergreen reference", 2: "A lasting reference" },
  reach: { 3: "Something most practitioners use", 2: "Widely used" },
  unique: { 3: "Analysis found nowhere else", 2: "Original analysis" },
}
/** What a card says when an article is both a 3 on trust and a 3 on "only here?". */
export const ANALYSIS_BOTH = "Original, source-checked analysis"
const OWNED_HARDWARE: readonly RunsOnId[] = ["browser", "phone", "cpu", "consumer-gpu"]

// Trust and "only here?" describe this site's own work, and most of the best
// pages score 3 on both, so on their own they would put the same two phrases
// on every top card. They share one slot (the analysis highlight); the other
// slots go to what the page gives a reader about its subject, rarest-useful
// first. 3s before 2s throughout.
const SUBJECT_STRONG: readonly RubricKey[] = ["runnable", "explains", "takeaway", "novelty", "durability", "reach"]
const SUBJECT_SOFT: readonly RubricKey[] = ["reach", "durability", "novelty", "takeaway", "runnable", "explains"]

export type Highlight = { key: string; text: string; strong: boolean }

function analysisHighlight(r: Record<RubricKey, number>): Highlight | null {
  const v = r.verification
  const u = r.unique
  if (v >= 3 && u >= 3) return { key: "analysis", text: ANALYSIS_BOTH, strong: true }
  if (v >= 3) return { key: "verification", text: HIGHLIGHT_PHRASES.verification[3], strong: true }
  if (u >= 3) return { key: "unique", text: HIGHLIGHT_PHRASES.unique[3], strong: true }
  if (u === 2) return { key: "unique", text: HIGHLIGHT_PHRASES.unique[2], strong: false }
  if (v === 2) return { key: "verification", text: HIGHLIGHT_PHRASES.verification[2], strong: false }
  return null
}

/**
 * Up to `max` reader-facing highlights from a rating's strongest answers: at
 * most one about the analysis (trust, only here?), the rest about what the
 * subject gives a reader; strong (3) before soft (2). An article with nothing
 * above 1 gets none, which is the honest answer.
 */
export function highlights(
  r: Record<RubricKey, number>,
  runsOn: RunsOnId | null | undefined,
  max = 3,
): Highlight[] {
  const owned = !!runsOn && OWNED_HARDWARE.includes(runsOn)
  const say = (key: RubricKey, v: 2 | 3) =>
    key === "runnable" && owned ? RUNS_ON_PHRASE[runsOn!] : HIGHLIGHT_PHRASES[key][v]
  const strong = SUBJECT_STRONG.filter((k) => r[k] >= 3).map((k) => ({ key: k, text: say(k, 3), strong: true }))
  // A soft "runnable" that names the reader's own hardware is concrete enough
  // to lead the soft ones.
  const softOrder = owned ? (["runnable", ...SUBJECT_SOFT.filter((k) => k !== "runnable")] as RubricKey[]) : SUBJECT_SOFT
  const soft = softOrder.filter((k) => r[k] === 2).map((k) => ({ key: k, text: say(k, 2), strong: false }))
  const analysis = analysisHighlight(r)
  const ordered = analysis?.strong
    ? [analysis, ...strong, ...soft]
    : [...strong, ...(analysis ? [analysis] : []), ...soft]
  return ordered.slice(0, max)
}

const LICENCE_PHRASE: Record<string, string | null> = {
  proprietary: "Proprietary",
  mixed: "Mixed licences",
  "source-available": "Source-available",
  "non-commercial": "Non-commercial licence",
  custom: "Custom licence",
  unlicensed: "No licence",
  "n/a": null,
}

/**
 * One line of practical facts, in reading order: what it runs on, its licence,
 * and who it is for ("Practitioner teardown"). Empty parts are left out.
 */
export function practicalFacts(m: {
  runsOn?: RunsOnId | null
  licence?: string | null
  level?: LevelId | null
  kind?: KindId | null
}): string[] {
  const out: string[] = []
  if (m.runsOn) out.push(RUNS_ON_PHRASE[m.runsOn])
  if (m.licence) {
    const l = m.licence in LICENCE_PHRASE ? LICENCE_PHRASE[m.licence] : m.licence
    if (l) out.push(l)
  }
  const level = m.level ? LEVELS.find((x) => x.id === m.level)?.label : undefined
  const kind = m.kind ? KINDS.find((x) => x.id === m.kind)?.label : undefined
  if (level && kind) out.push(`${level} ${kind.toLowerCase()}`)
  else if (level || kind) out.push((level ?? kind)!)
  return out
}

/** The band a tier stands for, said from the top: "Top 10%", "Top 30%", …, "Last 15%". */
export function tierBand(id: TierId): { short: string; long: string } {
  let cum = 0
  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i]
    const share = Math.round(t.share * 100)
    cum += share
    if (t.id !== id) continue
    if (i === 0) return { short: `Top ${cum}%`, long: `in the top ${cum}% of rated articles` }
    if (i === TIERS.length - 1) return { short: `Last ${share}%`, long: `in the last ${share}% of rated articles` }
    return { short: `Top ${cum}%`, long: `in the top ${cum}% of rated articles` }
  }
  return { short: "", long: "" }
}
