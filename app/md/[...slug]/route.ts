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
import { NOT_FOUND_MARKDOWN_HEADERS, notFoundMarkdown } from "@/lib/not-found"

// Agent-facing markdown variants. Humans hit /blog/foo — agents hit /blog/foo.md,
// which next.config.ts rewrites to /md/blog/foo and lands here.
export const dynamic = "force-static"
// Unknown slugs have to reach the handler so it can return the markdown 404
// recovery document. With dynamicParams = false the router rejects them first
// and serves the HTML 404 instead, which is the wrong representation for a
// caller that just told us it wanted markdown. Known slugs are still
// prerendered from generateStaticParams below.
export const dynamicParams = true

const DATA_PAGES = ["home", "about", "resume", "health", "now", "uses", "reading"]

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
    // A 404 an agent can act on. A bare "not found" tells a crawler the path is
    // wrong but not where to go instead, so it either gives up or guesses; this
    // hands back the same recovery map the HTML 404 shows a human, in the
    // markdown the caller already said it wanted.
    return new Response(notFoundMarkdown(`/${slug.join("/")}`), {
      status: 404,
      headers: { ...NOT_FOUND_MARKDOWN_HEADERS },
    })
  }

  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept, Accept-Encoding",
      // Cloudflare's Markdown-for-Agents convention: tell the caller roughly how
      // much context this document will cost before it decides to spend it. A
      // ~4-chars-per-token estimate, which is close enough for budgeting and
      // cheap enough to compute on every response.
      "x-markdown-tokens": String(Math.ceil(markdown.length / 4)),
    },
  })
}
