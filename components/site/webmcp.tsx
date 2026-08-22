"use client"

import { useEffect } from "react"

// WebMCP (webmachinelearning.github.io/webmcp) — expose this page's useful
// actions as tools an in-browser agent can call directly.
//
// The two tools below are the same two things the site's own console does:
// search the corpus, and ask a grounded question. They hit the public JSON API,
// so a browser agent gets structured results instead of scraping the DOM.
//
// Feature-detected and completely inert where the API is absent, which today is
// almost everywhere — it ships behind a flag in Chrome's origin trial. Nothing
// renders; this component exists only for its effect.

type WebMcpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>
}

type ModelContext = {
  provideContext: (ctx: { tools: WebMcpTool[] }) => void | Promise<void>
}

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
})

const TOOLS: WebMcpTool[] = [
  {
    name: "search_site",
    description:
      "Search Satyajit Ghana's writing — 140+ long-form explainers on model architectures, inference and agent harnesses, plus blog posts, build logs, projects, arXiv digests, snippets and notes. Returns ranked matches with the matching heading and a snippet. Use this to find the right page before reading it.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Search terms." },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Maximum results." },
      },
    },
    async execute({ query, limit }) {
      const params = new URLSearchParams({ q: String(query ?? "") })
      if (limit) params.set("limit", String(limit))
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) return text(`Search failed: ${res.status}. ${await res.text()}`)
      return text(await res.json())
    },
  },
  {
    name: "ask_satyajit",
    description:
      "Ask a question answered from the content of this site, with citations to the pages used. Use for synthesis across several pages; use search_site when you only need to locate one. Returns a 503 when the model is offline, in which case fall back to search_site.",
    inputSchema: {
      type: "object",
      required: ["question"],
      properties: {
        question: {
          type: "string",
          maxLength: 4000,
          description: "A natural-language question about Satyajit, his writing, or his work.",
        },
      },
    },
    async execute({ question }) {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: String(question ?? "") }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        return text(
          body?.detail
            ? `${body.code ?? res.status}: ${body.detail}${body.hint ? `\n\nHint: ${body.hint}` : ""}`
            : `Request failed: ${res.status}`,
        )
      }
      return text(body)
    },
  },
]

export function WebMcp() {
  useEffect(() => {
    const nav = navigator as Navigator & { modelContext?: ModelContext }
    if (!nav.modelContext?.provideContext) return

    try {
      void nav.modelContext.provideContext({ tools: TOOLS })
    } catch {
      // A page that fails to register tools should still be a working page.
    }
  }, [])

  return null
}
