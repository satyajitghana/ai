import { profile } from "@/data/profile"
import {
  getArchitectureDocs,
  getArticles,
  getArxivDigests,
  getBlogPosts,
  getLogs,
  getNotes,
  getProjects,
  getSnippets,
} from "@/lib/content"
import { contentMarkdown, dataPageMarkdown } from "@/lib/markdown"
import { absoluteUrl } from "@/lib/site"

// llms-full.txt: the site's content concatenated as markdown. One fetch gives
// an agent the corpus up to a size budget, and links for the rest.
export const dynamic = "force-static"

export async function GET() {
  const sections: string[] = [
    `# ${profile.name} — full content corpus`,
    "",
    `> ${profile.title} @ ${profile.company.name}. ${profile.tagline}`,
    `> Generated from the content layer. Index: /llms.txt`,
    `> Newest first, in full, up to about 16 MB; older entries are listed at the end with links to their markdown.`,
    "",
  ]

  for (const page of ["about", "resume", "health", "now", "uses", "reading"]) {
    const md = await dataPageMarkdown(page)
    if (md) sections.push("---", "", md, "")
  }

  const kinds: Array<[string, { slug: string }[]]> = [
    ["projects", getProjects()],
    ["blog", getBlogPosts()],
    ["architectures", getArchitectureDocs()],
    ["logs", getLogs()],
    ["arxiv", getArxivDigests()],
    ["snippets", getSnippets()],
    ["notes", getNotes()],
    // Last: articles are most of the corpus, and they are what the budget cuts.
    ["articles", getArticles()],
  ]

  // A prerendered response over 20 MB is refused at deploy (Vercel's ISR
  // limit), and the corpus passed it at about 740 articles. Everything goes in
  // whole, newest first, until the budget is spent; what is left is listed with
  // the address of its .md twin, so nothing is unreachable from this file.
  const BUDGET = 16_000_000
  const encoder = new TextEncoder()
  let used = encoder.encode(sections.join("\n")).length
  const overflow: string[] = []

  for (const [kind, items] of kinds) {
    for (const item of items) {
      const md = contentMarkdown(kind, item.slug)
      if (!md) continue
      const size = encoder.encode(md).length + 8
      if (used + size > BUDGET) {
        const title = (item as { title?: string }).title ?? item.slug
        overflow.push(`- [${title}](${absoluteUrl(`/${kind}/${item.slug}.md`)})`)
        continue
      }
      used += size
      sections.push("---", "", md, "")
    }
  }

  if (overflow.length) {
    sections.push(
      "---",
      "",
      `# Older entries, by link (${overflow.length})`,
      "",
      "These did not fit in this file. Each link is the entry's full markdown.",
      "",
      ...overflow,
      "",
    )
  }

  return new Response(sections.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
