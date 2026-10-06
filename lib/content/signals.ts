import type { Article } from "@/lib/content"
import { getArticles, getContentImports } from "@/lib/content"
import {
  type ArticleFacts,
  type ArticleScore,
  compareLens,
  highlights,
  type LensId,
  RUBRIC,
  type Rating,
  type ScoredLensId,
  TIERS,
} from "@/lib/content/rating"
import { mpow } from "@/lib/dmath"
import { getFilm } from "@/lib/films"
import { citationsFromBody } from "@/lib/jsonld"
import { linkPlan } from "@/lib/related"

// Computed signals for every article: the facts read off the page itself, the
// 0–100 score, the percentile tier and the lens sort keys. Server-only (it
// reads the corpus); the browser gets the results as props or from
// /api/articles, never recomputes them.
//
// Computed once over the whole corpus and memoised, because a tier is a rank
// and a rank is a property of the corpus, not of one page. Every step is
// deterministic — fixed tie-breaks (score, then lastUpdated, then slug), and
// "recency" anchored to the newest article rather than the wall clock — so two
// builds of the same commit emit identical HTML and JSON.

// ── facts ────────────────────────────────────────────────────────────────────

const FIGURE = /<Figure\b/g
const CARD = /<(?:ModelCard|RepoCard)\b/g
const MEASURED = /\bmeasured\b/gi
const INTERACTIVE = /^@\/components\/articles\/(?!ui\/)/

const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0

function factsOf(a: Article, inbound: number): ArticleFacts {
  return {
    words: a.body.split(/\s+/).filter(Boolean).length,
    readingTimeMins: a.readingTimeMins,
    figures: count(a.body, FIGURE),
    interactives: new Set(getContentImports("articles", a.slug).filter((m) => INTERACTIVE.test(m))).size,
    film: getFilm(a.slug) !== null,
    citations: citationsFromBody(a.body, Number.POSITIVE_INFINITY).length,
    cards: count(a.body, CARD),
    measured: count(a.body, MEASURED),
    inbound,
    lastUpdated: a.lastUpdated,
  }
}

// ── score ────────────────────────────────────────────────────────────────────

const WEIGHT_SUM = RUBRIC.reduce((s, r) => s + r.weight, 0)
const round = (v: number, places: number) => {
  const k = 10 ** places
  return Math.round(v * k) / k
}

/** Diminishing returns: n/(n+k) climbs fast and flattens, and is exact arithmetic. */
const dim = (n: number, k: number) => n / (n + k)

/** The evidence bonus, capped at +6: what the page shows, not what it claims. */
export function evidenceBonus(f: ArticleFacts): number {
  const b =
    1.5 * dim(f.figures, 2) +
    1.5 * dim(f.interactives, 1) +
    1.5 * dim(f.measured, 3) +
    0.75 * dim(f.cards, 1) +
    (f.film ? 0.75 : 0)
  return Math.min(6, b)
}

/** 0–100: the weighted rubric, normalised, plus the evidence bonus; one decimal. */
export function scoreOf(r: Rating, f: ArticleFacts): number {
  const weighted = RUBRIC.reduce((s, d) => s + d.weight * r[d.key], 0)
  const base = (weighted / (3 * WEIGHT_SUM)) * 100
  return round(Math.min(100, base + evidenceBonus(f)), 1)
}

// ── lenses ───────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const ageDays = (iso: string, ref: string) => Math.max(0, (Date.parse(ref) - Date.parse(iso)) / DAY_MS)
const LEVEL_BONUS: Record<string, number> = { intro: 1, practitioner: 0.5 }

function lensesOf(a: Article, r: Rating, f: ArticleFacts, score: number, newest: string): Record<ScoredLensId, number> {
  // Worth up to 3 on the day, half that a month later.
  const recency = 3 * mpow(0.5, ageDays(f.lastUpdated, newest) / 30)
  return {
    "must-read": score,
    "run-it": round(r.runnable * 2 + r.takeaway * 1.5 + r.verification, 3),
    learn: round(r.explains * 2 + r.durability * 1.5 + (LEVEL_BONUS[a.level ?? ""] ?? 0), 3),
    new: round(r.novelty * 1.5 + r.reach + recency, 3),
    deep: round(r.verification * 2 + r.unique * 2 + Math.min(f.measured, 10) * 0.2, 3),
  }
}

// ── the corpus pass ──────────────────────────────────────────────────────────

const MEMOIZE = process.env.NODE_ENV !== "development"
let CACHED: Map<string, ArticleScore> | null = null

/** Tier index for rank r (0-based) of n: the band the rank's midpoint falls in. */
function tierIndex(r: number, n: number): number {
  const p = (r + 0.5) / n
  let cum = 0
  for (let i = 0; i < TIERS.length; i++) {
    cum += TIERS[i].share
    if (p < cum) return i
  }
  return TIERS.length - 1
}

/** slug → score, tier, lenses and facts, for every article including drafts. */
export function articleScores(): Map<string, ArticleScore> {
  if (MEMOIZE && CACHED) return CACHED

  const all = getArticles({ includeDrafts: true })
  const { inbound } = linkPlan()
  const newest = all.reduce((m, a) => (a.lastUpdated > m ? a.lastUpdated : m), "1970-01-01")

  const out = new Map<string, ArticleScore>()
  for (const a of all) {
    const facts = factsOf(a, inbound.get(a.slug) ?? 0)
    const score = a.rating ? scoreOf(a.rating, facts) : null
    out.set(a.slug, {
      facts,
      score,
      tier: null,
      rank: null,
      lenses: a.rating && score !== null ? lensesOf(a, a.rating, facts, score, newest) : null,
    })
  }

  // Tiers rank published, rated articles only: a draft does not take a slot.
  const ranked = all
    .filter((a) => !a.draft && out.get(a.slug)!.score !== null)
    .sort(
      (x, y) =>
        out.get(y.slug)!.score! - out.get(x.slug)!.score! ||
        y.lastUpdated.localeCompare(x.lastUpdated) ||
        x.slug.localeCompare(y.slug),
    )
  ranked.forEach((a, i) => {
    const t = TIERS[tierIndex(i, ranked.length)]
    const s = out.get(a.slug)!
    s.rank = i + 1
    s.tier = { id: t.id, label: t.label, level: t.level }
  })

  if (MEMOIZE) CACHED = out
  return out
}

const EMPTY: ArticleScore = {
  facts: { words: 0, readingTimeMins: 0, figures: 0, interactives: 0, film: false, citations: 0, cards: 0, measured: 0, inbound: 0, lastUpdated: "" },
  score: null,
  tier: null,
  rank: null,
  lenses: null,
}

export function getArticleScore(slug: string): ArticleScore {
  return articleScores().get(slug) ?? EMPTY
}

/** Order articles by a lens (see compareLens in lib/content/rating.ts). */
export function compareByLens(lens: LensId, scores = articleScores()) {
  const cmp = compareLens(lens)
  const view = (a: Pick<Article, "slug" | "lastUpdated">) => {
    const s = scores.get(a.slug)
    return { slug: a.slug, lastUpdated: a.lastUpdated, score: s?.score ?? null, lenses: s?.lenses ?? null }
  }
  return (a: Pick<Article, "slug" | "lastUpdated">, b: Pick<Article, "slug" | "lastUpdated">) => cmp(view(a), view(b))
}

/** Published articles in lens order. */
export function articlesByLens(lens: LensId): Article[] {
  return getArticles().sort(compareByLens(lens))
}

/**
 * The scoring fields /api/articles and the MCP `list_articles` tool add to an
 * article, with explicit nulls for anything unset so every record has the same
 * shape. `articleKind` is the frontmatter `kind` (paper, model, …); the item's
 * own `kind` stays the content kind, "articles".
 */
export function articleApiFields(a: Article) {
  const s = getArticleScore(a.slug)
  return {
    rating: a.rating ?? null,
    topic: a.topic ?? null,
    articleKind: a.articleKind ?? null,
    level: a.level ?? null,
    runsOn: a.runsOn ?? null,
    licence: a.licence ?? null,
    facts: s.facts,
    score: s.score,
    tier: s.tier,
    rank: s.rank,
    lenses: s.lenses,
    highlights: a.rating ? highlights(a.rating, a.runsOn).map((h) => h.text) : [],
  }
}
