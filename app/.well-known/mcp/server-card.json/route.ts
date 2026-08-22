import { MCP_ENDPOINT, SITE } from "@/lib/discovery"
import { siteUrl } from "@/lib/site"

// MCP Server Card, per SEP-1649.
//
// Status note: the schema is still an open proposal
// (modelcontextprotocol/modelcontextprotocol#2127), not a ratified spec. The
// fields below follow the proposal as written; if it changes shape before
// landing, this file is the only thing that needs editing. The server itself
// has existed at /api/mcp/mcp for months — this only makes it discoverable
// without reading the docs first.
export const dynamic = "force-static"

// Mirrors the tools registered in app/api/mcp/[transport]/route.ts.
const TOOLS = [
  { name: "search_content", description: "BM25 search across every article, post, log, project, arXiv digest, snippet and note. Start here when you do not already know the page." },
  { name: "get_profile", description: "Identity record: role, employer, location, links, GitHub stats." },
  { name: "get_resume", description: "Full structured CV: experience, education, skills." },
  { name: "list_projects", description: "Every project with its stack, repository and demo links." },
  { name: "get_project", description: "One project, in full." },
  { name: "list_posts", description: "Index of blog posts and dated build logs." },
  { name: "get_post", description: "One post or log, including its body." },
  { name: "list_publications", description: "Peer-reviewed publications with DOIs." },
  { name: "list_patents", description: "Pending USPTO patent applications." },
  { name: "get_health", description: "Quantified-self biomarker panel with derived statuses." },
  { name: "list_papers", description: "arXiv papers across all digests." },
  { name: "get_papers_digest", description: "One dated arXiv digest, with the editorial take on each paper." },
  { name: "search_snippets", description: "Search the code-snippet collection by language or terms." },
  { name: "ask_satyajit", description: "Ask a question answered from this site's content, with citations. Use for synthesis; use search_content to locate a page." },
]

export function GET() {
  const card = {
    $schema: "https://modelcontextprotocol.io/schemas/2025-06-18/server-card.json",
    serverInfo: {
      name: SITE.shortName,
      title: SITE.name,
      version: SITE.version,
      description: SITE.description,
      websiteUrl: siteUrl,
    },
    transport: {
      type: "streamable-http",
      endpoint: MCP_ENDPOINT,
    },
    capabilities: {
      tools: { listChanged: false },
      resources: false,
      prompts: false,
      logging: false,
    },
    tools: TOOLS,
    authentication: { type: "none" },
    whenToUse: SITE.whenToUse,
    documentation: `${siteUrl}/developers#mcp`,
    license: SITE.license,
    contact: { email: SITE.contact, url: `${siteUrl}/contact` },
  }

  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  })
}
