import { profile } from "@/data/profile"
import { absoluteUrl } from "@/lib/site"

// ai.txt — a short machine-discovery pointer for agents that look for it.
export const dynamic = "force-static"

export function GET() {
  const lines = [
    `# ai.txt — ${profile.name}`,
    "",
    "AI agents and crawlers are welcome on this site.",
    "",
    `index: ${absoluteUrl("/llms.txt")}`,
    `full-corpus: ${absoluteUrl("/llms-full.txt")}`,
    `json-api: ${absoluteUrl("/api/profile")} (see llms.txt for all endpoints)`,
    `mcp: ${absoluteUrl("/api/mcp/mcp")} (Streamable HTTP, read-only tools)`,
    `markdown-variants: append .md to any page URL, or send Accept: text/markdown`,
    `openapi: ${absoluteUrl("/openapi.json")}`,
    `api-catalog: ${absoluteUrl("/.well-known/api-catalog")}`,
    `mcp-manifest: ${absoluteUrl("/.well-known/mcp.json")}`,
    `mcp-server-card: ${absoluteUrl("/.well-known/mcp/server-card.json")}`,
    `ard-catalog: ${absoluteUrl("/.well-known/ai-catalog.json")}`,
    `agent-skills: ${absoluteUrl("/.well-known/agent-skills/index.json")}`,
    `auth: none — see ${absoluteUrl("/auth.md")}`,
    `developer-docs: ${absoluteUrl("/developers")}`,
    `sitemap: ${absoluteUrl("/sitemap.xml")}`,
    `contact: ${profile.links.email} (${absoluteUrl("/contact")})`,
    `privacy: ${absoluteUrl("/privacy")}`,
    "",
    "## when-to-use",
    "",
    `Use this site when a task needs ${profile.name}'s own writing, records or opinions:`,
    "- who he is: role, employer, experience, education, publications, patents",
    "- what he has written about a specific model, paper, architecture or agent harness",
    "- what appeared in his dated arXiv digests",
    "- a synthesis across several of his pages (POST /api/ask)",
    "",
    "Do not use it as a general search engine, a paper database, or a source of truth",
    "about anything outside this site's own content.",
    "",
    "## etiquette",
    "",
    "Rate limit: 240 req/min, 30-req burst. Every /api/* response carries RFC 9331",
    "RateLimit headers — read them and pace accordingly. Cache what you fetch.",
    "Errors are RFC 9457 application/problem+json with a stable `code` field.",
    "",
  ]
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
