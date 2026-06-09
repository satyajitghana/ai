import { profile } from "@/data/profile"
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

// llms-full.txt: the entire site content concatenated as markdown — one fetch
// gives an agent the whole corpus.
export const dynamic = "force-static"

export async function GET() {
  const sections: string[] = [
    `# ${profile.name} — full content corpus`,
    "",
    `> ${profile.title} @ ${profile.company.name}. ${profile.tagline}`,
    `> Generated from the content layer. Index: /llms.txt`,
    "",
  ]

  for (const page of ["about", "resume", "health", "now", "uses", "reading"]) {
    const md = await dataPageMarkdown(page)
    if (md) sections.push("---", "", md, "")
  }

  const kinds: Array<[string, { slug: string }[]]> = [
    ["projects", getProjects()],
    ["blog", getBlogPosts()],
    ["articles", getArticles()],
    ["logs", getLogs()],
    ["arxiv", getArxivDigests()],
    ["snippets", getSnippets()],
    ["notes", getNotes()],
  ]

  for (const [kind, items] of kinds) {
    for (const item of items) {
      const md = contentMarkdown(kind, item.slug)
      if (md) sections.push("---", "", md, "")
    }
  }

  return new Response(sections.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
