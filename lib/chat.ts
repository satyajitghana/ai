import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import {
  generateText,
  stepCountIs,
  streamText,
  tool,
  type LanguageModelUsage,
  type ModelMessage,
} from "ai"
import { z } from "zod"

import { profile } from "@/data/profile"
import { contentMarkdown, dataPageMarkdown } from "@/lib/markdown"
import { searchContent } from "@/lib/search"
import { siteUrl } from "@/lib/site"

// Shared chat plumbing for /api/chat (streaming), /api/ask (one-shot), and the
// MCP ask_satyajit tool.
//
// PROVIDER: Cloudflare Workers AI through its OpenAI-compatible endpoint
// (`@ai-sdk/openai-compatible`), so this runs from Vercel with no Workers
// binding. Credentials: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (a token
// with Workers AI read/run). Optional CLOUDFLARE_AI_GATEWAY_ID routes the calls
// through an AI Gateway for logs, caching and rate limits. Swapping provider is
// this one constructor: the routes and tools only see an AI SDK model.
//
// MODELS: free-tier models only (Workers AI gives 10,000 Neurons a day on every
// plan). glm-4.7-flash first (5,500 Neurons per M input tokens, tool calling,
// 131K context), llama-4-scout as the fallback. Override with CHAT_MODEL /
// CHAT_MODEL_FALLBACK.
//
// HARNESS, built to spend few tokens: the system prompt is a few hundred tokens
// (no site catalog; search finds pages), get_content returns one section or an
// outline instead of a whole page, MDX imports and widgets are stripped, the
// history is trimmed, and the loop is bounded. Each request logs its token usage.

export const PRIMARY_MODEL = process.env.CHAT_MODEL ?? "@cf/zai-org/glm-4.7-flash"
export const FALLBACK_MODEL =
  process.env.CHAT_MODEL_FALLBACK ?? "@cf/meta/llama-4-scout-17b-16e-instruct"

// search → read one or two sections → answer is 3-4 steps; 5 leaves one spare.
export const AGENT_MAX_STEPS = 5

// A page section handed to the model is capped at this many characters
// (about 2.5K tokens); longer pages come back as an outline to pick from.
const SECTION_CHARS = 9000
const WHOLE_PAGE_CHARS = 9000
const OUTLINE_MAX = 60

// History: the last few turns are enough context; older assistant turns are
// clipped hard, since the model can re-fetch anything it needs.
const HISTORY_MESSAGES = 8
const OLD_ASSISTANT_CHARS = 600

const DATA_PAGES = ["about", "resume", "health", "now", "uses", "reading"] as const

export function isChatOnline(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)
}

export function modelChain(): string[] {
  return PRIMARY_MODEL === FALLBACK_MODEL ? [PRIMARY_MODEL] : [PRIMARY_MODEL, FALLBACK_MODEL]
}

export function chatModelId(): string {
  return PRIMARY_MODEL
}

// Created per call so importing this module never throws when the credentials
// are absent (offline mode handles that).
function provider() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const gateway = process.env.CLOUDFLARE_AI_GATEWAY_ID
  return createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1`,
    apiKey: process.env.CLOUDFLARE_API_TOKEN,
    headers: gateway ? { "cf-aig-gateway-id": gateway } : undefined,
    includeUsage: true,
  })
}

function logUsage(route: string, model: string, usage: LanguageModelUsage | undefined, steps: number) {
  if (!usage) return
  console.log(
    `[chat] ${route} model=${model} steps=${steps} in=${usage.inputTokens ?? "?"} out=${usage.outputTokens ?? "?"} cached=${usage.inputTokenDetails?.cacheReadTokens ?? 0}`,
  )
}

// Keep the last few messages; clip older assistant replies.
export function trimHistory<T extends { role: string; content: string }>(messages: T[]): T[] {
  const tail = messages.slice(-HISTORY_MESSAGES)
  return tail.map((m, i) =>
    m.role === "assistant" && i < tail.length - 2 && m.content.length > OLD_ASSISTANT_CHARS
      ? { ...m, content: `${m.content.slice(0, OLD_ASSISTANT_CHARS)} …` }
      : m,
  )
}

// ── fallback runners ──────────────────────────────────────────────────────────

export async function generateWithFallback(args: {
  question: string
  system: string
  maxOutputTokens?: number
}): Promise<{ text: string; model: string }> {
  const cf = provider()
  let lastErr: unknown
  for (const id of modelChain()) {
    try {
      const { text, totalUsage, steps } = await generateText({
        model: cf(id),
        system: args.system,
        prompt: args.question,
        tools: agentTools(),
        stopWhen: stepCountIs(AGENT_MAX_STEPS),
        maxOutputTokens: args.maxOutputTokens ?? 900,
      })
      logUsage("ask", id, totalUsage, steps.length)
      return { text, model: id }
    } catch (err) {
      lastErr = err
      console.warn(`[chat] model ${id} failed, falling back:`, err instanceof Error ? err.message : err)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all models failed")
}

// Streaming: fall back only if a model errors before emitting any text; once
// tokens are on the wire a mid-stream error propagates.
export async function* streamWithFallback(args: {
  system: string
  messages: ModelMessage[]
  maxOutputTokens?: number
  onModel?: (id: string) => void
}): AsyncGenerator<string> {
  const cf = provider()
  let lastErr: unknown
  for (const id of modelChain()) {
    const result = streamText({
      model: cf(id),
      system: args.system,
      messages: args.messages,
      tools: agentTools(),
      stopWhen: stepCountIs(AGENT_MAX_STEPS),
      maxOutputTokens: args.maxOutputTokens ?? 1200,
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
      const [usage, steps] = await Promise.all([result.totalUsage, result.steps])
      logUsage("chat", id, usage, steps.length)
      return
    } catch (err) {
      lastErr = err
      if (emitted) throw err
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
  type: "https://ai.satyajit.si/developers#error-service_unavailable",
  title: "Service Unavailable",
  status: 503,
  code: "service_unavailable",
  hint: "No model is configured. Use the static surfaces instead: /llms.txt, any page + .md, or the /api/* JSON endpoints — none of them need a model.",
  docs: "https://ai.satyajit.si/openapi.json",
} as const

// ── page text for the model ──────────────────────────────────────────────────

// MDX → prose the model can use: drop import/export lines, replace self-closing
// JSX (widgets, figures, cards) with its caption or alt text when it has one.
export function agentText(md: string): string {
  return md
    .replace(/^(import|export)\s.*$/gm, "")
    .replace(/<([A-Z][A-Za-z0-9.]*)\b(?:[^>"]|"[^"]*")*?\/>/g, (tag) => {
      const cap = tag.match(/\b(?:caption|alt|title)=(?:"([^"]*)"|\{`([^`]*)`\})/)
      const text = cap?.[1] ?? cap?.[2]
      return text ? `[figure: ${text}]` : ""
    })
    .replace(/\n{3,}/g, "\n\n")
}

type Section = { heading: string; level: number; text: string }

function sections(md: string): Section[] {
  const out: Section[] = []
  let cur: Section = { heading: "(top)", level: 1, text: "" }
  let inFence = false
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) inFence = !inFence
    const h = !inFence && line.match(/^(#{2,4})\s+(.*)$/)
    if (h) {
      out.push(cur)
      cur = { heading: h[2].trim(), level: h[1].length, text: `${line}\n` }
    } else cur.text += `${line}\n`
  }
  out.push(cur)
  return out.filter((s) => s.text.trim())
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// A whole short page, one requested section, or a long page's opening plus its
// outline, never more than SECTION_CHARS.
export function pageForAgent(md: string, section?: string): Record<string, unknown> {
  const text = agentText(md)
  if (!section && text.length <= WHOLE_PAGE_CHARS) return { markdown: text }
  const secs = sections(text)
  if (section) {
    const want = norm(section)
    const hit =
      secs.find((s) => norm(s.heading) === want) ??
      secs.find((s) => norm(s.heading).includes(want) || want.includes(norm(s.heading)))
    if (hit) {
      // include the subsections that belong to it
      const i = secs.indexOf(hit)
      let body = hit.text
      for (let j = i + 1; j < secs.length && secs[j].level > hit.level; j++) body += secs[j].text
      const clipped = body.length > SECTION_CHARS
      return { section: hit.heading, markdown: body.slice(0, SECTION_CHARS), ...(clipped ? { clipped: true } : {}) }
    }
  }
  // A very long page lists only its top-level headings (capped); any heading,
  // including a deeper one search returned, still works as `section`.
  let heads = secs.slice(1)
  if (heads.length > OUTLINE_MAX) heads = heads.filter((s) => s.level === 2)
  const more = Math.max(0, heads.length - OUTLINE_MAX)
  return {
    ...(section ? { note: `no section matching "${section}"` } : {}),
    opening: secs[0]?.text.slice(0, 2500) ?? "",
    outline: heads.slice(0, OUTLINE_MAX).map((s) => `${"  ".repeat(Math.max(0, s.level - 2))}${s.heading}`),
    ...(more ? { more: `${more} more headings; search_content finds sections directly` } : {}),
    hint: "Long page: call get_content again with `section` set to one heading from the outline.",
  }
}

// ── the tool set ────────────────────────────────────────────────────────────

export function agentTools() {
  return {
    search_content: tool({
      description:
        "BM25 search over every page on the site (articles, blog, logs, projects, arXiv digests, snippets, notes). Returns kind/slug, the matching section heading and a snippet.",
      inputSchema: z.object({
        query: z.string().min(1).describe("keywords or a short question"),
        limit: z.number().int().min(1).max(8).optional(),
      }),
      execute: async ({ query, limit }) => ({
        results: searchContent(query, limit ?? 5).map((r) => ({
          page: `${r.kind}/${r.slug}`,
          section: r.field,
          snippet: r.snippet,
        })),
      }),
    }),

    get_content: tool({
      description:
        "Read a page. `page` is kind/slug from search (e.g. articles/memonce) or a data page (about, resume, health, now, uses, reading). Pass `section` (a heading, e.g. the one search returned) to read just that part; long pages without a section return an outline to choose from.",
      inputSchema: z.object({
        page: z.string().describe("kind/slug, or a data page name"),
        section: z.string().optional().describe("a heading on that page"),
      }),
      execute: async ({ page, section }) => {
        const [kind, ...rest] = page.replace(/^\/+/, "").split("/")
        const slug = rest.join("/")
        if ((DATA_PAGES as readonly string[]).includes(kind)) {
          const md = await dataPageMarkdown(kind)
          return md ? pageForAgent(md, section) : { error: `no data page "${kind}"` }
        }
        if (!slug) return { error: `use kind/slug, e.g. articles/memonce` }
        const md = contentMarkdown(kind, slug)
        return md ? pageForAgent(md, section) : { error: `no page ${kind}/${slug}; search first` }
      },
    }),
  }
}

// ── the system prompt ─────────────────────────────────────────────────────────

let cachedSystemPrompt: string | undefined

export async function buildSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt
  cachedSystemPrompt = [
    `You answer questions on ${siteUrl}, the personal site of ${profile.name} (${profile.title} at ${profile.company.name}, ${profile.location}): his articles, projects, papers digests, resume, patents and health panel.`,
    "The site's content is not in this prompt. Use search_content to find pages, then get_content to read the part you need (pass the section heading search gave you). Data pages: about, resume, health, now, uses, reading.",
    "Rules: ground every claim in what you read this turn; read before relying on a snippet; if nothing covers it, say so and point to a relevant page. Never invent facts about him. Cite pages as markdown links to their site path (/kind/slug). Be precise and brief, engineer to engineer. Answer in the visitor's language.",
  ].join("\n\n")
  return cachedSystemPrompt
}
