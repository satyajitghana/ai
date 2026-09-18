import fs from "node:fs"
import path from "node:path"

import fg from "fast-glob"
import matter from "gray-matter"
import type { ZodType } from "zod"

import { absoluteUrl } from "@/lib/site"
import {
  articleFrontmatter,
  blogFrontmatter,
  logFrontmatter,
  noteFrontmatter,
  papersDigestFrontmatter,
  projectFrontmatter,
  snippetFrontmatter,
  type Article,
  type BlogPost,
  type ContentItem,
  type ContentKind,
  type Log,
  type Note,
  type PapersDigest,
  type Project,
  type Snippet,
} from "./schema"

// Re-export the content types so consumers can `import type { Note } from "@/lib/content"`.
export type {
  Article,
  ArticleFrontmatter,
  ArticleSignal,
  BlogFrontmatter,
  BlogPost,
  ContentItem,
  ContentKind,
  Log,
  LogFrontmatter,
  Note,
  NoteFrontmatter,
  PaperEntry,
  PapersDigest,
  Project,
  ProjectFrontmatter,
  Snippet,
  SnippetFrontmatter,
} from "./schema"
export { articleSignal, paperLinks } from "./schema"

const CONTENT_DIR = path.join(process.cwd(), "content")

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// Article MDX may import its own colocated components at the top of the body
// (after frontmatter). Those ESM import lines are for the rendered page only —
// strip them from the `body` we expose so the `.md` agent variants and the
// reading-time count stay clean prose. Only removes the leading import block.
function stripLeadingImports(body: string): string {
  const lines = body.split("\n")
  let i = 0
  while (
    i < lines.length &&
    (lines[i].trim() === "" || /^import\s.+\sfrom\s.+$/.test(lines[i].trim()))
  ) {
    i++
  }
  return lines.slice(i).join("\n").replace(/^\n+/, "")
}

// Content is read off disk and is immutable for the lifetime of a deployment,
// but `load` was re-globbing, re-reading, re-parsing and re-Zod-validating every
// file of a kind on every call — measured at ~142 ms for the 238 articles, and
// `getArticle(slug)` pays it in full to return one item. A page render calls it
// several times (page + generateMetadata + JSON-LD), the build does that for
// every article, its OG image and its .md variant, and the dynamic routes
// (/search, /api/search, /api/ask, /api/chat, /api/mcp) paid it per request.
//
// So memoize per kind. Skipped in development, where the files change under us
// and re-reading is the point. Callers get a shallow copy: several `return
// load(...)` straight through, and one in-place sort by a caller would corrupt
// the entry for every later reader.
const MEMOIZE = process.env.NODE_ENV !== "development"
const loaded = new Map<ContentKind, unknown[]>()

// Load + validate every file of one kind. Throws (with the file path) on bad
// frontmatter so the build / `pnpm validate` fails loudly.
function load<T>(kind: ContentKind, schema: ZodType<T>): ContentItem<T>[] {
  if (MEMOIZE) {
    const hit = loaded.get(kind)
    if (hit) return (hit as ContentItem<T>[]).slice()
  }
  const dir = path.join(CONTENT_DIR, kind)
  if (!fs.existsSync(dir)) return []

  const files = fg.sync("*.mdx", { cwd: dir, absolute: true })
  const items = files.map((file) => {
    const raw = fs.readFileSync(file, "utf8")
    const { data, content } = matter(raw)
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      const rel = path.relative(process.cwd(), file)
      throw new Error(
        `Invalid frontmatter in ${rel}:\n${JSON.stringify(parsed.error.format(), null, 2)}`
      )
    }
    const slug = path.basename(file, ".mdx")
    const body = stripLeadingImports(content)
    // Every kind has `date`; only blog/articles/notes may also have `updated`.
    // `lastUpdated` folds those into one always-present "last touched" signal.
    const fm = parsed.data as unknown as { date: string; updated?: string }
    return {
      ...parsed.data,
      kind,
      slug,
      body,
      readingTimeMins: readingTime(body),
      url: absoluteUrl(`/${kind}/${slug}`),
      lastUpdated: fm.updated ?? fm.date,
    } as ContentItem<T>
  })

  // Newest first by `lastUpdated`, tie-broken by `date` (kinds without an
  // `updated` field have lastUpdated === date, so their order is unchanged).
  const lastUpdatedOf = (i: ContentItem<T>) =>
    String((i as unknown as { lastUpdated: string }).lastUpdated)
  const dateOf = (i: ContentItem<T>) =>
    String((i as unknown as { date: string }).date)
  const sorted = items.sort(
    (a, b) => lastUpdatedOf(b).localeCompare(lastUpdatedOf(a)) || dateOf(b).localeCompare(dateOf(a))
  )
  if (MEMOIZE) loaded.set(kind, sorted)
  return sorted.slice()
}

export function getBlogPosts({ includeDrafts = false } = {}): BlogPost[] {
  const posts = load("blog", blogFrontmatter)
  return includeDrafts ? posts : posts.filter((p) => !p.draft)
}

export function getLogs(): Log[] {
  return load("logs", logFrontmatter)
}

export function getProjects(): Project[] {
  return load("projects", projectFrontmatter)
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return getBlogPosts({ includeDrafts: true }).find((p) => p.slug === slug)
}

// Curated long-form AI articles.
export function getArticles({ includeDrafts = false } = {}): Article[] {
  const items = load("articles", articleFrontmatter)
  return includeDrafts ? items : items.filter((a) => !a.draft)
}

export function getArticle(slug: string): Article | undefined {
  return getArticles({ includeDrafts: true }).find((a) => a.slug === slug)
}

export function getLog(slug: string): Log | undefined {
  return getLogs().find((l) => l.slug === slug)
}

export function getProject(slug: string): Project | undefined {
  return getProjects().find((p) => p.slug === slug)
}

// Daily arXiv digests — slug is the date (YYYY-MM-DD), newest first.
// Lives at /arxiv on the site; content dir is content/arxiv.
export function getArxivDigests(): PapersDigest[] {
  return load("arxiv", papersDigestFrontmatter)
}

export function getArxivDigest(slug: string): PapersDigest | undefined {
  return getArxivDigests().find((d) => d.slug === slug)
}

export function getSnippets(): Snippet[] {
  return load("snippets", snippetFrontmatter)
}

export function getSnippet(slug: string): Snippet | undefined {
  return getSnippets().find((s) => s.slug === slug)
}

export function getNotes(): Note[] {
  return load("notes", noteFrontmatter)
}

export function getNote(slug: string): Note | undefined {
  return getNotes().find((n) => n.slug === slug)
}

// Flat corpus for /llms-full.txt, search index, and the RAG chat.
export function getAllContent(): Array<ContentItem<Record<string, unknown>>> {
  return [
    ...getBlogPosts(),
    ...getArticles(),
    ...getLogs(),
    ...getProjects(),
    ...getArxivDigests(),
    ...getSnippets(),
    ...getNotes(),
  ] as Array<ContentItem<Record<string, unknown>>>
}
