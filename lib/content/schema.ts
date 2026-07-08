import { z } from "zod"

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
// standout pieces (a ★ in the index, and they float to the top of the list).
export const articleFrontmatter = blogFrontmatter.extend({
  featured: z.boolean().default(false),
})
export type ArticleFrontmatter = z.infer<typeof articleFrontmatter>

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

export type ContentKind =
  | "blog"
  | "articles"
  | "logs"
  | "projects"
  | "arxiv"
  | "snippets"
  | "notes"

// A loaded content item: validated frontmatter + slug + raw markdown body + derived fields.
export type ContentItem<T> = T & {
  kind: ContentKind
  slug: string
  body: string
  readingTimeMins: number
  url: string
}

export type BlogPost = ContentItem<BlogFrontmatter>
export type Article = ContentItem<ArticleFrontmatter>
export type Log = ContentItem<LogFrontmatter>
export type Project = ContentItem<ProjectFrontmatter>
export type PapersDigest = ContentItem<PapersDigestFrontmatter>
export type Snippet = ContentItem<SnippetFrontmatter>
export type Note = ContentItem<NoteFrontmatter>

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
