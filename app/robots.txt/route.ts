import { absoluteUrl } from "@/lib/site"

// robots.txt, hand-rolled rather than via Next's MetadataRoute.Robots, because
// the metadata helper can only emit the classic directives and this file needs
// Content-Signal lines (contentsignals.org / draft-romm-aipref-contentsignals).
//
// The policy below is deliberate and matches what the site says everywhere else:
//   search=yes    — index it, link to it, that is the point of publishing.
//   ai-input=yes  — this site is built to be read by agents at inference time;
//                   /llms.txt, the .md twins and the MCP server exist for exactly
//                   that, so declaring otherwise would contradict the product.
//   ai-train=yes  — the content is CC BY 4.0. Training on it is already permitted
//                   by the licence; saying "no" here would be inconsistent with
//                   the licence the site actually ships.
//
// Content-Signal is a preference expression, not an access control. The
// permissive stance here is a choice, not a default — flip any of the three if
// the licensing position changes.
export const dynamic = "force-static"

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
]

const CONTENT_SIGNAL = "ai-train=yes, search=yes, ai-input=yes"

export function GET() {
  const lines = [
    "# ai.thesatyajit.com — everyone is welcome, agents especially.",
    "# Machine-readable index: /llms.txt · full corpus: /llms-full.txt",
    "# API: /openapi.json · MCP: /api/mcp/mcp · docs: /developers",
    "",
    "User-agent: *",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    "Allow: /",
    "",
    ...AI_CRAWLERS.flatMap((ua) => [
      `User-agent: ${ua}`,
      `Content-Signal: ${CONTENT_SIGNAL}`,
      "Allow: /",
      "",
    ]),
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ]

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  })
}
