// Hosted MCP server for ai.thesatyajit.com — a read-only "satyajit-ai" server.
//
// mcp-handler (v1.1.x) exports the route handler directly; it owns the
// [transport] convention and Next 16's Promise-wrapped route params. With
// basePath "/api/mcp" and this file at app/api/mcp/[transport]/route.ts, the
// Streamable HTTP endpoint clients connect to is /api/mcp/mcp.
//
// All tool implementations live in lib/mcp.ts to keep this file thin.

import { createMcpHandler } from "mcp-handler"
import { z } from "zod"

import {
  askSatyajitPayload,
  getHealthPayload,
  getArxivDigestPayload,
  getPostPayload,
  getProfilePayload,
  getProjectPayload,
  getResumePayload,
  json,
  listPapersPayload,
  listPatentsPayload,
  listPostsPayload,
  listProjectsPayload,
  listPublicationsPayload,
  searchContentPayload,
  searchSnippetsPayload,
} from "@/lib/mcp"

// Vercel function budget for streaming MCP requests.
export const maxDuration = 60

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_profile",
      {
        title: "Get profile",
        description:
          "Satyajit's identity: name, title, company, location, tagline, bio, social links, GitHub handle, seed stats, and research interests.",
        inputSchema: {},
      },
      async () => json(await getProfilePayload())
    )

    server.registerTool(
      "get_resume",
      {
        title: "Get resume",
        description:
          "Structured resume: contact, summary, experience, education, skills, projects, publications, and patents.",
        inputSchema: {},
      },
      async () => getResumePayload()
    )

    server.registerTool(
      "list_projects",
      {
        title: "List projects",
        description:
          "List Satyajit's projects (slug, title, description, stack, repo/demo links, featured flag).",
        inputSchema: {},
      },
      async () => listProjectsPayload()
    )

    server.registerTool(
      "get_project",
      {
        title: "Get project",
        description:
          "Full project by slug, including the markdown body. Use list_projects for slugs.",
        inputSchema: { slug: z.string().min(1) },
      },
      async ({ slug }) => getProjectPayload(slug)
    )

    server.registerTool(
      "list_posts",
      {
        title: "List posts",
        description:
          "List blog posts or logs (newest first). type defaults to 'blog'. Optional limit caps the count.",
        inputSchema: {
          type: z.enum(["blog", "logs"]).optional(),
          limit: z.number().int().positive().optional(),
        },
      },
      async ({ type, limit }) => listPostsPayload(type ?? "blog", limit)
    )

    server.registerTool(
      "get_post",
      {
        title: "Get post",
        description:
          "Full blog post or log by type + slug, including the markdown body.",
        inputSchema: {
          type: z.enum(["blog", "logs"]),
          slug: z.string().min(1),
        },
      },
      async ({ type, slug }) => getPostPayload(type, slug)
    )

    server.registerTool(
      "search_content",
      {
        title: "Search content",
        description:
          "BM25 search over contextualized chunks of ALL content (articles, blog, logs, projects, papers, snippets, notes). Ranked, not first-substring. Returns kind, slug, url, the matching section, a snippet, and a score.",
        inputSchema: {
          query: z.string().min(1),
          limit: z.number().int().positive().optional(),
        },
      },
      async ({ query, limit }) => searchContentPayload(query, limit)
    )

    server.registerTool(
      "list_publications",
      {
        title: "List publications",
        description:
          "Satyajit's academic publications (title, publisher, date, DOI/URL).",
        inputSchema: {},
      },
      async () => listPublicationsPayload()
    )

    server.registerTool(
      "list_patents",
      {
        title: "List patents",
        description:
          "Satyajit's patents (title, status, application number, filed date, assignee).",
        inputSchema: {},
      },
      async () => listPatentsPayload()
    )

    server.registerTool(
      "get_health",
      {
        title: "Get health",
        description:
          "Biomarker panel + wearable/supplement stack, with DERIVED per-marker status (optimal/borderline/low/elevated).",
        inputSchema: {},
      },
      async () => getHealthPayload()
    )

    server.registerTool(
      "list_papers",
      {
        title: "List papers digests",
        description:
          "Daily arXiv digests (newest first): date, paper titles + arxivIds, and standout flags. Optional limit.",
        inputSchema: { limit: z.number().int().positive().optional() },
      },
      async ({ limit }) => listPapersPayload(limit)
    )

    server.registerTool(
      "get_papers_digest",
      {
        title: "Get papers digest",
        description:
          "Full daily arXiv digest by date (YYYY-MM-DD): per-paper abstract, Satyajit's take, standout flag, and derived arXiv links (abs/pdf/html/ar5iv).",
        inputSchema: { date: z.string().min(1) },
      },
      async ({ date }) => getArxivDigestPayload(date)
    )

    server.registerTool(
      "search_snippets",
      {
        title: "Search snippets",
        description:
          "Code snippets (CUDA/PyTorch/C++/etc.) with full body. Optional query filters by title/description/lang/tags/body; omit to list all.",
        inputSchema: { query: z.string().optional() },
      },
      async ({ query }) => searchSnippetsPayload(query)
    )

    server.registerTool(
      "ask_satyajit",
      {
        title: "Ask Satyajit",
        description:
          "Ask a natural-language question about Satyajit. Runs a small retrieval agent (BM25 search + page fetch) grounded only in the site; returns a cited answer. Needs a server API key — if unavailable, use search_content + get_post directly.",
        inputSchema: { question: z.string().min(1) },
      },
      async ({ question }) => askSatyajitPayload(question)
    )
  },
  {
    serverInfo: { name: "satyajit-ai", version: "1.0.0" },
  },
  {
    // Must match where [transport] lives: app/api/mcp/[transport]/route.ts.
    // Derives the Streamable HTTP endpoint at /api/mcp/mcp.
    basePath: "/api/mcp",
    maxDuration: 60,
    // Stateless reads: no Redis, no SSE resumability.
    disableSse: true,
  }
)

export { handler as GET, handler as POST }
