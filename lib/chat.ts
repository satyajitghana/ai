import { createOpenAI } from "@ai-sdk/openai"
import {
  generateText,
  stepCountIs,
  streamText,
  tool,
  type ModelMessage,
} from "ai"
import { z } from "zod"

import { profile } from "@/data/profile"
import { getAllContent } from "@/lib/content"
import { contentMarkdown, dataPageMarkdown } from "@/lib/markdown"
import { searchContent } from "@/lib/search"
import { siteUrl } from "@/lib/site"

// Shared chat plumbing for /api/chat (streaming), /api/ask (one-shot), and the
// MCP ask_satyajit tool.
//
// PROVIDER: routed through the Vercel AI SDK (`@ai-sdk/openai`). A small router
// picks one of the OpenAI GPT-5.4 family (nano / mini / 5.4) per question, and
// every call falls back down the ladder on error. Override the per-tier models
// with CHAT_MODEL_NANO / CHAT_MODEL / CHAT_MODEL_MAIN and the key with
// OPENAI_API_KEY.
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

// A mix of the OpenAI GPT-5.4 family, cheap → strong. A small router picks the
// starting tier from the question (no extra LLM round-trip — just a heuristic),
// and every call falls back down the ladder if a model errors (rate limit,
// transient 5xx, access), so one bad model never takes the agent offline.
export type ModelTier = "nano" | "mini" | "main"

const LADDER = ["gpt-5.4-nano", "gpt-5.4-mini", "gpt-5.4"] as const

const TIER_MODEL: Record<ModelTier, string> = {
  nano: process.env.CHAT_MODEL_NANO ?? "gpt-5.4-nano",
  mini: process.env.CHAT_MODEL ?? "gpt-5.4-mini",
  main: process.env.CHAT_MODEL_MAIN ?? "gpt-5.4",
}

// The agent loop is bounded: search → read a page or two → (think) → answer is
// ~4 steps; 6 leaves headroom without letting a confused run spin.
export const AGENT_MAX_STEPS = 6

// Data pages aren't in the content layer but are fetchable by the same tool.
const DATA_PAGES = ["about", "resume", "health", "now", "uses", "reading"] as const

export function isChatOnline(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

// The router: a cheap, deterministic heuristic. Short factual lookups go to
// nano; comparative / explanatory / long or multi-part questions to the strong
// model; everything else to mini. Deliberately not an LLM call — routing should
// cost nothing.
export function routeTier(question: string): ModelTier {
  const q = question.trim()
  const complex =
    /\b(compare|compared|versus|vs\.?|why|how|explain|deriv|prove|trade-?off|differ|difference|relationship|walk through|architecture|design|reason|implication|nuance)\b/i.test(
      q,
    )
  const multiPart = (q.match(/\?/g)?.length ?? 0) > 1 || /\band\b[^.?!]*\band\b/i.test(q)
  if (q.length > 320 || (complex && multiPart)) return "main"
  if (q.length < 90 && !complex) return "nano"
  return "mini"
}

// The fallback chain for a tier: the routed model first, then the rest of the
// ladder (deduped), so an error drops to the next-best model.
export function modelChain(tier: ModelTier): string[] {
  const start = TIER_MODEL[tier]
  const chain = [start]
  for (const m of LADDER) if (m !== start) chain.push(m)
  return chain
}

export function chatModelId(tier: ModelTier = "mini"): string {
  return TIER_MODEL[tier]
}

// A configured LanguageModel for the AI SDK. Created lazily so importing this
// module never throws when the key is absent (offline mode handles that).
export function chatModel(tier: ModelTier = "mini") {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai(TIER_MODEL[tier])
}

// ── router + fallback runners ─────────────────────────────────────────────────

// One-shot answer (/api/ask, MCP ask_satyajit): route by the question, then walk
// the fallback chain until a model succeeds. Returns the answer and the model
// that actually produced it.
export async function generateWithFallback(args: {
  question: string
  system: string
  maxOutputTokens?: number
}): Promise<{ text: string; model: string }> {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const chain = modelChain(routeTier(args.question))
  let lastErr: unknown
  for (const id of chain) {
    try {
      const { text } = await generateText({
        model: openai(id),
        system: args.system,
        prompt: args.question,
        tools: agentTools(),
        stopWhen: stepCountIs(AGENT_MAX_STEPS),
        maxOutputTokens: args.maxOutputTokens ?? 1024,
      })
      return { text, model: id }
    } catch (err) {
      lastErr = err
      console.warn(
        `[chat] model ${id} failed, falling back:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all models failed")
}

// Streaming answer (/api/chat): route by `tier`, walk the chain, and only fall
// back if a model errors *before* emitting any text — once tokens are on the
// wire we can't safely restart, so a mid-stream error propagates. `onModel`
// reports which model actually answered (first successful chunk).
export async function* streamWithFallback(args: {
  tier: ModelTier
  system: string
  messages: ModelMessage[]
  maxOutputTokens?: number
  onModel?: (id: string) => void
}): AsyncGenerator<string> {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const chain = modelChain(args.tier)
  let lastErr: unknown
  for (const id of chain) {
    const result = streamText({
      model: openai(id),
      system: args.system,
      messages: args.messages,
      tools: agentTools(),
      stopWhen: stepCountIs(AGENT_MAX_STEPS),
      maxOutputTokens: args.maxOutputTokens ?? 1500,
    })
    let emitted = false
    try {
      for await (const chunk of result.textStream) {
        if (!emitted) {
          emitted = true
          args.onModel?.(id)
        }
        yield chunk
      }
      return
    } catch (err) {
      lastErr = err
      if (emitted) throw err // tokens already sent — can't restart on another model
      console.warn(
        `[chat] stream model ${id} failed pre-output, falling back:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all models failed")
}

export const offlinePayload = {
  error: "chat offline",
  detail:
    "The chat is offline right now. The site is still fully agent-readable: start at /llms.txt, fetch any page as .md, or use the /api/* JSON endpoints.",
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
