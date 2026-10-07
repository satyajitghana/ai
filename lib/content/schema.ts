import { z } from "zod"

import { KIND_IDS, LEVEL_IDS, LICENCE_SPECIAL, RUNS_ON_IDS, TOPIC_IDS } from "@/data/taxonomy"

// Frontmatter schemas (Zod 4). A malformed post fails `pnpm validate` / the build
// — this is the loud-failure safety net that lets agents edit content safely.

// gray-matter parses unquoted YAML dates (`date: 2026-06-03`) into JS Date objects.
// Accept either a Date or an ISO date string and normalize to "YYYY-MM-DD".
const dateString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.iso.date()
)

export const blogFrontmatter = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: dateString, // YYYY-MM-DD
  updated: dateString.optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  cover: z.string().optional(),
})
export type BlogFrontmatter = z.infer<typeof blogFrontmatter>

// Curated long-form articles on AI — essays/explainers, distinct from the
// personal build-log blog. Same shape as blog, plus `featured` to star the
// standout pieces, and the editorial metadata that organises /articles:
//
//   rating   8 rubric dimensions, 0–3 each, plus a one-line `why` (see
//            lib/content/rating.ts for the anchors). Score, tier and lens
//            keys are computed from it by lib/content/signals.ts.
//   topic    exactly one, from data/taxonomy.ts TOPICS
//   kind     paper | model | tool | teardown | roundup | essay | guide | dataset
//            (loaded as `articleKind`: items already carry `kind: "articles"`)
//   level    intro | practitioner | research
//   runsOn   the smallest hardware the subject runs on: browser < phone < cpu <
//            consumer-gpu < workstation < datacenter, or api / none
//   licence  SPDX id, or proprietary | mixed | source-available | non-commercial |
//            custom | unlicensed | n/a
//
// All optional while the corpus is being rated. `interest` / `helpful` (1–5)
// are the previous, inflated signal: still accepted, deprecated, and removed
// once every article carries `rating`.
const rubricScore = z.number().int().min(0).max(3)
export const ratingSchema = z.object({
  novelty: rubricScore,
  verification: rubricScore,
  runnable: rubricScore,
  explains: rubricScore,
  takeaway: rubricScore,
  durability: rubricScore,
  reach: rubricScore,
  unique: rubricScore,
  why: z.string().trim().min(1).max(160),
})

const licence = z
  .string()
  .refine(
    (v) => (LICENCE_SPECIAL as readonly string[]).includes(v) || /^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(v),
    "licence must be an SPDX id (e.g. Apache-2.0) or one of: " + LICENCE_SPECIAL.join(", "),
  )

// `kind` is the frontmatter name, but every loaded content item already has a
// `kind` (the content kind, "articles"), so the loader exposes this one as
// `articleKind`.
export const articleFrontmatter = blogFrontmatter
  .extend({
  featured: z.boolean().default(false),
  rating: ratingSchema.optional(),
  topic: z.enum(TOPIC_IDS).optional(),
  kind: z.enum(KIND_IDS).optional(),
  level: z.enum(LEVEL_IDS).optional(),
  runsOn: z.enum(RUNS_ON_IDS).optional(),
  licence: licence.optional(),
  /** @deprecated superseded by `rating` */
  interest: z.number().int().min(1).max(5).optional(),
  /** @deprecated superseded by `rating` */
  helpful: z.number().int().min(1).max(5).optional(),
  })
  .transform(({ kind, ...rest }) => ({ ...rest, articleKind: kind }))
export type ArticleFrontmatter = z.infer<typeof articleFrontmatter>

// Back-compat 1–5 signal (level + label), kept for the API's `signal` field and
// any caller written against it. Rated articles derive it from their tier
// (pass `tier`, from lib/content/signals.ts); unrated ones fall back to the old
// interest + helpful sum. Null when neither exists.
const SIGNAL_TIERS: { min: number; level: number; label: string }[] = [
  { min: 9, level: 5, label: "Essential" },
  { min: 8, level: 4, label: "High" },
  { min: 7, level: 3, label: "Notable" },
  { min: 6, level: 2, label: "Solid" },
  { min: 0, level: 1, label: "Niche" },
]

export type ArticleSignal = {
  /** Deprecated 1–5 axis from frontmatter; null once an article only has `rating`. */
  interest: number | null
  /** Deprecated 1–5 axis from frontmatter; null once an article only has `rating`. */
  helpful: number | null
  /** interest + helpful (2–10) when both exist, else null. Not the 0–100 score. */
  score: number | null
  /** 1–5, from the percentile tier when rated, else from interest + helpful. */
  level: number
  label: string
  source: "tier" | "legacy"
}

export function articleSignal(
  fm: { interest?: number; helpful?: number },
  rated?: { tier: { level: number; label: string } | null } | null,
): ArticleSignal | null {
  const legacy = fm.interest != null && fm.helpful != null ? fm.interest + fm.helpful : null
  if (rated?.tier) {
    return {
      interest: fm.interest ?? null,
      helpful: fm.helpful ?? null,
      score: legacy,
      level: rated.tier.level,
      label: rated.tier.label,
      source: "tier",
    }
  }
  if (legacy === null) return null
  const tier = SIGNAL_TIERS.find((t) => legacy >= t.min) ?? SIGNAL_TIERS[SIGNAL_TIERS.length - 1]
  return { interest: fm.interest!, helpful: fm.helpful!, score: legacy, level: tier.level, label: tier.label, source: "legacy" }
}

export const logFrontmatter = z.object({
  title: z.string().min(1).optional(),
  date: dateString,
  tags: z.array(z.string()).default([]),
})
export type LogFrontmatter = z.infer<typeof logFrontmatter>

export const projectFrontmatter = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: dateString,
  stack: z.array(z.string()).default([]),
  repo: z.url().optional(),
  demo: z.url().optional(),
  featured: z.boolean().default(false),
  cover: z.string().optional(),
})
export type ProjectFrontmatter = z.infer<typeof projectFrontmatter>

// Daily arXiv digest (arxiv-sanity-style, personalized). Links are DERIVED from
// arxivId (abs/pdf/HTML-view) — we never store or mirror PDFs.
export const paperEntry = z.object({
  arxivId: z.string().regex(/^\d{4}\.\d{4,5}(v\d+)?$/),
  title: z.string().min(1),
  authors: z.array(z.string()).min(1),
  categories: z.array(z.string()).default([]),
  abstract: z.string().min(1),
  take: z.string().min(1), // 1–3 sentence personal take, in Satyajit's voice
  standout: z.boolean().default(false), // "crazy paper" → amplify/blog candidate
})
export type PaperEntry = z.infer<typeof paperEntry>

export const papersDigestFrontmatter = z.object({
  date: dateString,
  papers: z.array(paperEntry).min(1),
})
export type PapersDigestFrontmatter = z.infer<typeof papersDigestFrontmatter>

// Snippets: small copy-paste-able code pieces (CUDA/PyTorch/C++ tricks).
export const snippetFrontmatter = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: dateString,
  lang: z.string().min(1), // e.g. "cuda", "python", "cpp", "bash"
  tags: z.array(z.string()).default([]),
})
export type SnippetFrontmatter = z.infer<typeof snippetFrontmatter>

// Digital-garden notes: evergreen, interlinked with [[wikilinks]] in the body.
export const noteFrontmatter = z.object({
  title: z.string().min(1),
  date: dateString,
  updated: dateString.optional(),
  tags: z.array(z.string()).default([]),
})
export type NoteFrontmatter = z.infer<typeof noteFrontmatter>

// Architecture explainers: one long-form doc per entry of the /architectures
// gallery, at content/architectures/<slug>.mdx, rendered at
// /architectures/<slug>. <slug> must be a slug in data/architectures.ts
// (validate-content fails otherwise): the architecture's name, family, year,
// tags, paper and related article live there, and its diagram in
// components/architectures/registry.tsx; the frontmatter describes the doc.
// Each doc also gets an explainer-film storyboard, data/films/architectures/<slug>.json.
export const architectureDocFrontmatter = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: dateString,
  updated: dateString.optional(),
  tags: z.array(z.string()).default([]),
})
export type ArchitectureDocFrontmatter = z.infer<typeof architectureDocFrontmatter>

export type ContentKind =
  | "blog"
  | "articles"
  | "logs"
  | "projects"
  | "arxiv"
  | "snippets"
  | "notes"
  | "architectures"

// A loaded content item: validated frontmatter + slug + raw markdown body + derived fields.
// `lastUpdated` is always present (`updated ?? date`) so every kind has a single,
// reliable "last touched" signal to sort/display by, even when `updated` is unset.
export type ContentItem<T> = T & {
  kind: ContentKind
  slug: string
  body: string
  readingTimeMins: number
  url: string
  lastUpdated: string
}

export type BlogPost = ContentItem<BlogFrontmatter>
export type Article = ContentItem<ArticleFrontmatter>
export type Log = ContentItem<LogFrontmatter>
export type Project = ContentItem<ProjectFrontmatter>
export type PapersDigest = ContentItem<PapersDigestFrontmatter>
export type Snippet = ContentItem<SnippetFrontmatter>
export type Note = ContentItem<NoteFrontmatter>
export type ArchitectureDoc = ContentItem<ArchitectureDocFrontmatter>

// Derived, never stored: human/abs, pdf, and HTML-view links for a paper.
// arXiv serves native HTML for most modern papers; ar5iv is the fallback renderer.
export function paperLinks(arxivId: string) {
  const bare = arxivId.replace(/v\d+$/, "")
  return {
    abs: `https://arxiv.org/abs/${bare}`,
    pdf: `https://arxiv.org/pdf/${bare}`,
    html: `https://arxiv.org/html/${arxivId.includes("v") ? arxivId : `${bare}v1`}`,
    ar5iv: `https://ar5iv.labs.arxiv.org/html/${bare}`,
  }
}
