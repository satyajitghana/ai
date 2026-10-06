// The article rubric, score weights, tiers and lens names — the parts of the
// scoring system both the server (lib/content/signals.ts) and the browser
// (/articles list, the "What you get" card) need. Pure data and types, no
// Node imports.
//
// A rating scores the SUBJECT plus OUR PAGE as a reader experiences it, 0–3 per
// dimension, and is meant to be stingy: the expected corpus mean is about 1.5,
// and `pnpm validate:ratings` fails once 50 articles are rated if any
// dimension's mean passes 2.2. Tiers are percentiles over the rated corpus, so
// they cannot inflate however the raw numbers drift.

export const RUBRIC = [
  { key: "novelty", label: "Novelty", asks: "Is this actually new?", weight: 1.0, anchors: ["repackaging or news of a known thing", "an incremental tweak", "a real new idea, method or capability", "changes how the field does something"] },
  { key: "verification", label: "Verification", asks: "Can I trust it?", weight: 1.2, anchors: ["restates claims", "spot-checks a few numbers", "measures key facts from files, code or configs", "reproduces the headline result, or shows from primary files it is wrong"] },
  { key: "runnable", label: "Runnable", asks: "Can I use it?", weight: 0.8, anchors: ["closed, nothing to run", "API-only, gated or restrictive licence", "open code or weights with real limits", "open, permissive, runs on reader hardware with instructions"] },
  { key: "explains", label: "Explains", asks: "Will I understand how it works?", weight: 1.0, anchors: ["describes, no mechanism", "partial mechanism", "mechanism from first principles with figures", "mechanism carried by interactives built from real code or data"] },
  { key: "takeaway", label: "Takeaway", asks: "Can I act on it?", weight: 1.0, anchors: ["nothing to act on", "general advice", "a concrete recipe, numbers or comparison", "a decision guide a practitioner can follow today"] },
  { key: "durability", label: "Durability", asks: "Will this matter next year?", weight: 0.8, anchors: ["news that expires in weeks", "relevant for months", "a reference for a year or more", "evergreen fundamentals"] },
  { key: "reach", label: "Reach", asks: "Does it affect many readers?", weight: 0.8, anchors: ["a niche paper or one-off repo", "a specialist community", "a widely used model, tool or lab release", "something most practitioners touch"] },
  { key: "unique", label: "Unique", asks: "Why read it here?", weight: 1.0, anchors: ["same as the press release", "some original analysis", "a teardown or measurement few others did", "the only place this analysis exists"] },
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
