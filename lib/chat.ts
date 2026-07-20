import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { stepCountIs, tool } from "ai"
import { z } from "zod"

import { profile } from "@/data/profile"
import { getAllContent } from "@/lib/content"
import { contentMarkdown, dataPageMarkdown } from "@/lib/markdown"
import { searchContent } from "@/lib/search"
import { siteUrl } from "@/lib/site"

// Shared chat plumbing for /api/chat (streaming), /api/ask (one-shot), and the
// MCP ask_satyajit tool.
//
// PROVIDER: routed through the Vercel AI SDK so the model/provider is a one-line
// swap. Currently Google Gemini (`@ai-sdk/google`).
//
// HARNESS: this is a small tool-using agent, not a corpus dump. Earlier the whole
// content corpus rode inside the system prompt on every request; now the prompt
// carries only a compact *catalog* (titles + slugs) and the agent pulls the bodies
// it needs through tools. Three tools, deliberately few (cf. the pi coding agent's
// "four tools are all you need"): search_content (BM25 retrieval), get_content
// (fetch one page's markdown), and think (a reasoning scratchpad, per Anthropic's
// "think tool"). Loading context on demand instead of upfront is the Kimi
// dynamic-loading idea applied to *context*: fewer tokens per turn, and the model
// sees only what's relevant to the question instead of the entire site.

export type ModelTier = "main" | "fast"

const MODELS: Record<ModelTier, string> = {
  main: process.env.CHAT_MODEL ?? "gemini-3.1-flash-lite",
  fast: process.env.CHAT_MODEL_FAST ?? "gemini-3.1-flash-lite",
}

// The agent loop is bounded: search → read a page or two → (think) → answer is
// ~4 steps; 6 leaves headroom without letting a confused run spin.
export const AGENT_MAX_STEPS = 6

// Data pages aren't in the content layer but are fetchable by the same tool.
const DATA_PAGES = ["about", "resume", "health", "now", "uses", "reading"] as const

export function isChatOnline(): boolean {
  return Boolean(process.env.GOOGLE_API_KEY)
}

export function chatModelId(tier: ModelTier = "main"): string {
  return MODELS[tier]
}

// A configured LanguageModel for the AI SDK. Created lazily so importing this
// module never throws when the key is absent (offline mode handles that).
export function chatModel(tier: ModelTier = "main") {
  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY })
  return google(MODELS[tier])
}

export const offlinePayload = {
  error: "chat offline",
  detail:
    "No GOOGLE_API_KEY is configured. The site is still fully agent-readable: start at /llms.txt, fetch any page as .md, or use the /api/* JSON endpoints.",
} as const

// ── the tool set ────────────────────────────────────────────────────────────

// Built fresh per request; the closures are cheap and hold no request state.
export function agentTools() {
  return {
    search_content: tool({
      description:
        "Search the whole site — articles, blog, logs, projects, arXiv digests, snippets, notes — with BM25 over contextualized chunks. Returns ranked matches, each with the matching section heading and a snippet. Start here when you don't already know the exact page from the catalog.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("keywords or a natural-language query"),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async ({ query, limit }) => {
        const results = searchContent(query, limit ?? 6)
        return {
          count: results.length,
          results: results.map((r) => ({
            kind: r.kind,
            slug: r.slug,
            url: r.url,
            section: r.field,
            snippet: r.snippet,
            score: Number(r.score.toFixed(2)),
          })),
        }
      },
    }),

    get_content: tool({
      description:
        "Fetch the full markdown of one page. `kind` is a content kind (articles, blog, logs, projects, arxiv, snippets, notes) plus its `slug`, OR a data page (about, resume, health, now, uses, reading) — for data pages the slug is ignored. Read the actual page with this before you rely on its details; don't answer from the snippet alone.",
      inputSchema: z.object({
        kind: z.string().describe("content kind or data-page name"),
        slug: z.string().optional().describe("page slug; omit for data pages"),
      }),
      execute: async ({ kind, slug }) => {
        if ((DATA_PAGES as readonly string[]).includes(kind)) {
          const md = await dataPageMarkdown(kind)
          return md ? { markdown: md } : { error: `no data page "${kind}"` }
        }
        if (!slug) return { error: `slug is required for kind "${kind}"` }
        const md = contentMarkdown(kind, slug)
        return md
          ? { markdown: md }
          : { error: `no ${kind}/${slug} — check the catalog or search_content` }
      },
    }),

    think: tool({
      description:
        "Think out loud: plan which pages to fetch, note what the site does and doesn't cover, or check a draft answer against the sources you've read. It records the thought and returns nothing new — use it to reason between tool calls, not to answer the user. Especially useful for multi-part questions.",
      inputSchema: z.object({
        thought: z.string().describe("a thought to reason through"),
      }),
      execute: async ({ thought }) => ({ ok: true, thought }),
    }),
  }
}

// ── the system prompt: persona + rules + a compact catalog ───────────────────

let cachedCatalog: string | undefined

function buildCatalog(): string {
  if (cachedCatalog) return cachedCatalog
  const byKind = new Map<string, string[]>()
  for (const item of getAllContent()) {
    const title = String(item.title ?? item.slug)
    const desc = String(
      (item as { description?: unknown }).description ?? ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140)
    const line = `- ${item.kind}/${item.slug} — ${title}${desc ? ` · ${desc}` : ""}`
    const list = byKind.get(item.kind)
    if (list) list.push(line)
    else byKind.set(item.kind, [line])
  }
  const sections = [...byKind.entries()].map(
    ([kind, lines]) => `### ${kind} (${lines.length})\n${lines.join("\n")}`
  )
  const dataPages =
    "### data pages\n" +
    DATA_PAGES.map((p) => `- ${p} (get_content kind="${p}")`).join("\n")
  cachedCatalog = [dataPages, ...sections].join("\n\n")
  return cachedCatalog
}

let cachedSystemPrompt: string | undefined

export async function buildSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt

  cachedSystemPrompt = [
    `You are the AI assistant embedded on ${siteUrl} — the personal site of ${profile.name} (${profile.title} @ ${profile.company.name}, ${profile.location}).`,
    "",
    "You answer questions about Satyajit — his work, projects, articles, daily arXiv digests, resume, patents, health panel. The site's content is NOT in this prompt; you retrieve it with tools.",
    "",
    "Tools:",
    "- search_content(query): BM25 search across everything. Use it when you don't already know the exact page.",
    "- get_content(kind, slug): read one page's full markdown. Fetch before you rely on specifics.",
    "- think(thought): reason between steps — plan what to fetch, or check a draft answer against what you read.",
    "",
    "Rules:",
    "- Ground every claim in content you fetched THIS turn. Prefer fetching 1–3 pages over guessing. If search + get_content don't cover it, say so plainly and point to a relevant page or his contact links. Never invent facts about him.",
    "- Cite sources as markdown links to the site page (the canonical URL is in each fetched page's header, and every catalog entry is `kind/slug` → `/kind/slug`).",
    "- Use think() for multi-part questions or when you must reconcile several sources.",
    "- Voice: precise, engineer-first, concise. No marketing fluff. Answer in whatever language the visitor uses.",
    "",
    "Catalog of everything on the site (titles + slugs; fetch bodies with get_content):",
    "",
    buildCatalog(),
  ].join("\n")

  return cachedSystemPrompt
}
