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
import { absoluteUrl } from "@/lib/site"

// llms.txt (https://llmstxt.org): the curated index an agent reads first.
export const dynamic = "force-static"

export function GET() {
  const posts = getBlogPosts()
  const articles = getArticles()
  const logs = getLogs().slice(0, 14)
  const projects = getProjects()
  const digests = getArxivDigests().slice(0, 14)
  const snippets = getSnippets()
  const notes = getNotes()

  const lines = [
    `# ${profile.name}`,
    "",
    `> ${profile.title} @ ${profile.company.name} (${profile.location}). ${profile.tagline} This site is dual-native: every page has a markdown variant (append .md), a JSON API (/api/*), and an MCP endpoint. It is maintained by a crew of Claude agents.`,
    "",
    "## How to read this site",
    "",
    `- Markdown variant of any page: append \`.md\` (e.g. ${absoluteUrl("/blog")}/<slug>.md)`,
    `- Full content corpus in one file: ${absoluteUrl("/llms-full.txt")}`,
    `- JSON API: ${absoluteUrl("/api/profile")}, /api/resume, /api/projects, /api/posts, /api/articles, /api/arxiv, /api/publications, /api/patents, /api/health, /api/search?q=`,
    `- MCP endpoint (Streamable HTTP, read-only tools): ${absoluteUrl("/api/mcp/mcp")}`,
    `- OpenAPI spec of the JSON API: ${absoluteUrl("/openapi.json")} · plugin manifest: ${absoluteUrl("/.well-known/ai-plugin.json")}`,
    `- Ask a grounded question: POST ${absoluteUrl("/api/ask")} {"question": "..."} (503 when offline)`,
    `- Resume: ${absoluteUrl("/resume.md")} · ${absoluteUrl("/resume.json")} (JSON Resume) · ${absoluteUrl("/satyajit-ghana-resume.pdf")} (PDF)`,
    `- Feed: ${absoluteUrl("/feed.xml")}`,
    "",
    "## Core",
    "",
    `- [About](${absoluteUrl("/about.md")}): who he is, experience, education`,
    `- [Resume](${absoluteUrl("/resume.md")}): full CV`,
    `- [Health](${absoluteUrl("/health.md")}): biomarker panel (quantified self)`,
    `- [Now](${absoluteUrl("/now.md")}): current focus`,
    `- [Uses](${absoluteUrl("/uses.md")}): gear and tooling`,
    `- [Reading](${absoluteUrl("/reading.md")}): papers and books`,
    "",
    "## Projects",
    "",
    ...projects.map(
      (p) =>
        `- [${p.title}](${absoluteUrl(`/projects/${p.slug}.md`)}): ${p.description}`
    ),
    "",
    "## Blog",
    "",
    ...posts.map(
      (p) =>
        `- [${p.title}](${absoluteUrl(`/blog/${p.slug}.md`)}): ${p.description} (${p.date})`
    ),
    "",
    "## Articles",
    "",
    ...articles.map(
      (a) =>
        `- [${a.title}](${absoluteUrl(`/articles/${a.slug}.md`)}): ${a.description} (${a.date})`
    ),
    "",
    "## Daily logs (latest)",
    "",
    ...logs.map(
      (l) =>
        `- [${l.title ?? l.date}](${absoluteUrl(`/logs/${l.slug}.md`)}) (${l.date})`
    ),
    "",
    "## arXiv digests (latest)",
    "",
    ...digests.map(
      (d) =>
        `- [${d.date} — ${d.papers.length} papers](${absoluteUrl(`/arxiv/${d.slug}.md`)})${d.papers.some((p) => p.standout) ? " ★" : ""}`
    ),
    "",
    "## Snippets",
    "",
    ...snippets.map(
      (s) =>
        `- [${s.title}](${absoluteUrl(`/snippets/${s.slug}.md`)}) (${s.lang})`
    ),
    "",
    "## Notes",
    "",
    ...notes.map(
      (n) => `- [${n.title}](${absoluteUrl(`/notes/${n.slug}.md`)})`
    ),
    "",
    "## Optional",
    "",
    `- [Publications](${absoluteUrl("/api/publications")}): peer-reviewed papers (JSON)`,
    `- [Patents](${absoluteUrl("/api/patents")}): two pending USPTO applications (JSON)`,
    `- [GitHub stats](${absoluteUrl("/api/github")}): repos, stars, languages (JSON)`,
    `- [Colophon](${absoluteUrl("/colophon")}): how this site works`,
    "",
  ]

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
