import {
  getArticles,
  getArxivDigests,
  getBlogPosts,
  getLogs,
  getNotes,
  getProjects,
  getSnippets,
} from "@/lib/content"
import { contentMarkdown, dataPageMarkdown } from "@/lib/markdown"

// Agent-facing markdown variants. Humans hit /blog/foo — agents hit /blog/foo.md,
// which next.config.ts rewrites to /md/blog/foo and lands here.
export const dynamic = "force-static"
export const dynamicParams = false

const DATA_PAGES = ["about", "resume", "health", "now", "uses", "reading"]

export function generateStaticParams() {
  return [
    ...getBlogPosts({ includeDrafts: true }).map((p) => ({
      slug: ["blog", p.slug],
    })),
    ...getArticles({ includeDrafts: true }).map((a) => ({
      slug: ["articles", a.slug],
    })),
    ...getLogs().map((l) => ({ slug: ["logs", l.slug] })),
    ...getProjects().map((p) => ({ slug: ["projects", p.slug] })),
    ...getArxivDigests().map((d) => ({ slug: ["arxiv", d.slug] })),
    ...getSnippets().map((s) => ({ slug: ["snippets", s.slug] })),
    ...getNotes().map((n) => ({ slug: ["notes", n.slug] })),
    ...DATA_PAGES.map((page) => ({ slug: [page] })),
  ]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params

  const markdown =
    slug.length === 1
      ? await dataPageMarkdown(slug[0])
      : slug.length === 2
        ? contentMarkdown(slug[0], slug[1])
        : undefined

  if (!markdown) {
    return new Response("not found", { status: 404 })
  }

  return new Response(markdown, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  })
}
