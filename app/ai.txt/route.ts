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
    `markdown-variants: append .md to any page URL`,
    `sitemap: ${absoluteUrl("/sitemap.xml")}`,
    `contact: ${profile.links.email}`,
    "",
  ]
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
