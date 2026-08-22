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
    "## When to use this site",
    "",
    "Reach for these surfaces when a task needs any of the following:",
    "",
    `- **Who ${profile.name} is** — role, employer, experience, education, publications, patents. Start at ${absoluteUrl("/api/profile")} or ${absoluteUrl("/about.md")}.`,
    "- **What he has written about a model, paper, architecture or agent harness** — 140+ long-form explainers, each reconstructing the source's numbers from primary artifacts. Search first: `GET " + absoluteUrl("/api/search") + "?q=<terms>`, then fetch the `.md` twin of the page it returns.",
    `- **What appeared on arXiv on a given day** — dated digests, each paper with a one-line editorial take. ${absoluteUrl("/api/arxiv")}.`,
    `- **A synthesis across several pages** — POST ${absoluteUrl("/api/ask")} with {"question": "..."}; it answers grounded in this site's content, with citations.`,
    `- **How to call any of this programmatically** — ${absoluteUrl("/developers")}.`,
    "",
    "Do **not** use it as a general search engine, a paper database, or a source of truth about anything outside this site's own content. It is one person's writing and records, not a reference corpus.",
    "",
    "## How to read this site",
    "",
    `- Markdown variant of any page: append \`.md\` (e.g. ${absoluteUrl("/blog")}/<slug>.md)`,
    `- Full content corpus in one file: ${absoluteUrl("/llms-full.txt")}`,
    `- JSON API: ${absoluteUrl("/api/profile")}, /api/resume, /api/projects, /api/posts, /api/articles, /api/arxiv, /api/publications, /api/patents, /api/health, /api/search?q=`,
    `- MCP endpoint (Streamable HTTP, read-only tools): ${absoluteUrl("/api/mcp/mcp")}`,
    `- OpenAPI spec of the JSON API: ${absoluteUrl("/openapi.json")} · plugin manifest: ${absoluteUrl("/.well-known/ai-plugin.json")} · MCP manifest: ${absoluteUrl("/.well-known/mcp.json")}`,
    `- API catalog (RFC 9727 linkset): ${absoluteUrl("/.well-known/api-catalog")}`,
    `- MCP server card (SEP-1649): ${absoluteUrl("/.well-known/mcp/server-card.json")}`,
    `- Capability manifest (ARD): ${absoluteUrl("/.well-known/ai-catalog.json")}`,
    `- Agent skills index: ${absoluteUrl("/.well-known/agent-skills/index.json")}`,
    `- Auth: there is none — ${absoluteUrl("/auth.md")} says so explicitly`,
    `- Every response carries RFC 8288 \`Link\` headers pointing at the above`,
    `- Developer documentation (endpoints, errors, rate limits, versioning): ${absoluteUrl("/developers")}`,
    `- Versioned API base path — pin this: ${absoluteUrl("/api/v1")}`,
    `- Markdown by content negotiation: send \`Accept: text/markdown\` to any canonical page URL (responses carry \`Vary: Accept\`)`,
    `- Errors: every non-2xx JSON response is RFC 9457 \`application/problem+json\` with a stable \`code\` field`,
    `- Rate limits: every /api/* response carries RFC 9331 \`RateLimit\` and \`RateLimit-Policy\` headers`,
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
    `- [Developers](${absoluteUrl("/developers")}): API, MCP server, errors, rate limits, versioning`,
    `- [Contact](${absoluteUrl("/contact")}): how to reach him, and what he responds to`,
    `- [Privacy](${absoluteUrl("/privacy")}): what the site collects (almost nothing)`,
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
