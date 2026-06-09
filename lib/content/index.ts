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
export { paperLinks } from "./schema"

const CONTENT_DIR = path.join(process.cwd(), "content")

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// Load + validate every file of one kind. Throws (with the file path) on bad
// frontmatter so the build / `pnpm validate` fails loudly.
function load<T>(kind: ContentKind, schema: ZodType<T>): ContentItem<T>[] {
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
    return {
      ...parsed.data,
      kind,
      slug,
      body: content,
      readingTimeMins: readingTime(content),
      url: absoluteUrl(`/${kind}/${slug}`),
    } as ContentItem<T>
  })

  // Newest first by `date` (all kinds carry a date field).
  const dateOf = (i: ContentItem<T>) =>
    String((i as unknown as { date: string }).date)
  return items.sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
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
