import { siteUrl } from "@/lib/site"

// Machine-readable spec of the JSON API so agents can auto-discover it
// (advertised from /.well-known/ai-plugin.json and /llms.txt).
export const dynamic = "force-static"

const listGet = (summary: string) => ({
  get: { summary, responses: { "200": { description: "OK (JSON)" } } },
})

export function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Satyajit Ghana — site API",
      description:
        "Read-only JSON API over the site's content layer. Also available: markdown variants (append .md to any page URL), /llms.txt index, and an MCP endpoint at /api/mcp/mcp.",
      version: "1.0.0",
      contact: { email: "satyajitghana7@gmail.com" },
    },
    servers: [{ url: siteUrl }],
    paths: {
      "/api/profile": listGet("Profile, links, and seed stats"),
      "/api/resume": listGet("Full structured resume"),
      "/api/projects": listGet("Projects with descriptions and stack"),
      "/api/posts": listGet("Blog posts and daily logs"),
      "/api/articles": listGet("Curated long-form articles and explainers"),
      "/api/posts/{slug}": {
        get: {
          summary: "One blog post or log, with body",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "OK" }, "404": { description: "Unknown slug" } },
        },
      },
      "/api/arxiv": listGet("Daily arXiv digests with takes and links"),
      "/api/publications": listGet("Peer-reviewed publications"),
      "/api/patents": listGet("Pending USPTO patent applications"),
      "/api/health": listGet("Biomarker panel with derived statuses"),
      "/api/now": listGet("Current focus"),
      "/api/uses": listGet("Gear and tooling"),
      "/api/reading": listGet("Reading list"),
      "/api/snippets": listGet("Code snippets"),
      "/api/notes": listGet("Digital-garden notes"),
      "/api/github": listGet("GitHub stats (live or seed)"),
      "/api/search": {
        get: {
          summary: "Substring search across all content",
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", maximum: 50 } },
          ],
          responses: { "200": { description: "OK" }, "400": { description: "Missing q" } },
        },
      },
      "/api/ask": {
        post: {
          summary:
            "Ask Satyajit's site AI a question (grounded, cited). 503 when chat is offline.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["question"],
                  properties: { question: { type: "string", maxLength: 4000 } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Answer with model + cache info" },
            "503": { description: "Chat offline (no API key configured)" },
          },
        },
      },
    },
  }

  return Response.json(spec)
}
