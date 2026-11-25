import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import {
  generateText,
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
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
// binding. Credentials: WORKERS_AI_ACCOUNT_ID + WORKERS_AI_API_TOKEN (a token
// with Workers AI read/run). Optional WORKERS_AI_GATEWAY_ID routes the calls
// through an AI Gateway for logs, caching and rate limits. Swapping provider is
// this one constructor: the routes and tools only see an AI SDK model.
//
// MODEL: glm-4.7-flash, on Workers AI's free allocation (10,000 Neurons a day on
// every plan; this model costs 5,500 Neurons per M input tokens), with tool
// calling and a 131K context. Of the free tool-calling models it was the only
// one that reliably read pages and cited them (llama-4-scout answered from
// snippets and leaked tool calls as text; gpt-oss-20b errored on tools), so
// there is no fallback model: an error is better than a wrong answer.
// Override with CHAT_MODEL.
//
// CHAT_PROVIDER=google switches to the Gemini API (GEMINI_API_KEY). Tested
// 25 Nov 2026 on the free tier: gemini-3.5-flash-lite gave the best answers of
// any model tried, but took 53-264 s per question and then failed with "high
// demand"; gemini-3.8-flash failed on quota every time. Free-tier Gemini input
// is also used to improve Google's products. Worth it on a paid key, not free.
//
// HARNESS, built to spend few tokens: the system prompt is a few hundred tokens
// (no site catalog; search finds pages), get_content returns one section or an
// outline instead of a whole page, MDX imports and widgets are stripped, the
// history is trimmed, and the loop is bounded. Each request logs its token usage.

// CHAT_PROVIDER picks the backend: "google" (Gemini API) or "workers-ai".
export const CHAT_PROVIDER = process.env.CHAT_PROVIDER === "google" ? "google" : "workers-ai"
const DEFAULT_MODEL = { google: "gemini-3.8-flash", "workers-ai": "@cf/zai-org/glm-4.7-flash" } as const
export const PRIMARY_MODEL = process.env.CHAT_MODEL ?? DEFAULT_MODEL[CHAT_PROVIDER]

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

// Not CLOUDFLARE_*: the cf CLI reads CLOUDFLARE_API_TOKEN from the environment,
// and the chat's token would override the CLI's own login.
const env = {
  account: () => process.env.WORKERS_AI_ACCOUNT_ID,
  token: () => process.env.WORKERS_AI_API_TOKEN,
  gateway: () => process.env.WORKERS_AI_GATEWAY_ID,
}

export function isChatOnline(): boolean {
  return CHAT_PROVIDER === "google"
    ? Boolean(process.env.GEMINI_API_KEY)
    : Boolean(env.account() && env.token())
}

export function modelChain(): string[] {
  return [PRIMARY_MODEL]
}

export function chatModelId(): string {
  return PRIMARY_MODEL
}

// Created per call so importing this module never throws when the credentials
// are absent (offline mode handles that).
function provider(): (id: string) => LanguageModel {
  if (CHAT_PROVIDER === "google") {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
    return (id) => google(id)
  }
  const account = env.account()
  const gateway = env.gateway()
  return createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1`,
    apiKey: env.token(),
    headers: gateway ? { "cf-aig-gateway-id": gateway } : undefined,
    includeUsage: true,
    // GLM reasons before answering by default, and the reasoning counts against
    // max tokens: answers came back cut off or empty. Retrieval answers don't
    // need it. (Ignored by models whose template has no such switch.)
    transformRequestBody: (body) => ({ ...body, chat_template_kwargs: { enable_thinking: false } }),
  })
}

// The last allowed step gets no tools at all (with tools merely disabled, GLM
// writes its call as text), and is told to answer, so a run that spent its
// budget searching still ends with an answer.
const FINAL_NOTE =
  "\n\nYou have no more tool calls. Answer now from what you have read; say what you could not find."
const finalStepAnswers =
  (system: string) =>
  ({ stepNumber, messages }: { stepNumber: number; messages: ModelMessage[] }) =>
    stepNumber >= AGENT_MAX_STEPS - 1
      ? {
          toolChoice: "none" as const,
          activeTools: [] as never[],
          system: system + FINAL_NOTE,
          messages: flattenToolTurns(messages),
        }
      : {}

// Tool calls and results as plain text: with no tool-call structure left in the
// history, a model has no call format to imitate on the answering step.
function flattenToolTurns(messages: ModelMessage[]): ModelMessage[] {
  const out: ModelMessage[] = []
  const notes: string[] = []
  const flush = () => {
    if (notes.length) out.push({ role: "user", content: `Here is what you read on the site. Answer the question from it now, in prose.\n\n${notes.join("\n\n---\n\n")}` })
    notes.length = 0
  }
  for (const m of messages) {
    if (m.role === "tool") {
      for (const part of m.content) {
        if (part.type !== "tool-result") continue
        const o = part.output as { type: string; value?: unknown }
        const v = o.type === "text" || o.type === "error-text" ? String(o.value) : JSON.stringify(o.value)
        notes.push(v)
      }
      continue
    }
    if (m.role === "assistant" && Array.isArray(m.content)) {
      const text = m.content.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("")
      if (text.trim()) {
        flush()
        out.push({ role: "assistant", content: text })
      }
      continue
    }
    flush()
    out.push(m)
  }
  flush()
  return out
}

// Defensive: drop any tool-call markup a model writes as text.
const stripToolMarkup = (t: string) => t.replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/g, "").trim()

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

// ── runners ─────────────────────────────────────────────────────────────────

export async function generateWithFallback(args: {
  question: string
  system: string
  maxOutputTokens?: number
}): Promise<{ text: string; model: string }> {
  const llm = provider()
  let lastErr: unknown
  for (const id of modelChain()) {
    const read = new Set<string>()
    try {
      const { text, totalUsage, steps } = await generateText({
        model: llm(id),
        system: args.system,
        prompt: args.question,
        tools: agentTools(read),
        stopWhen: stepCountIs(AGENT_MAX_STEPS),
        prepareStep: finalStepAnswers(args.system),
        maxOutputTokens: args.maxOutputTokens ?? 900,
      })
      logUsage("ask", id, totalUsage, steps.length)
      return { text: withSources(stripToolMarkup(text), read), model: id }
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
  const llm = provider()
  let lastErr: unknown
  for (const id of modelChain()) {
    const read = new Set<string>()
    let streamed = ""
    const result = streamText({
      model: llm(id),
      system: args.system,
      messages: args.messages,
      tools: agentTools(read),
      stopWhen: stepCountIs(AGENT_MAX_STEPS),
      prepareStep: finalStepAnswers(args.system),
      maxOutputTokens: args.maxOutputTokens ?? 1200,
    })
    let emitted = false
    try {
      for await (const chunk of result.textStream) {
        if (!emitted) {
          emitted = true
          args.onModel?.(id)
        }
        streamed += chunk
        yield chunk
      }
      const tail = withSources(streamed, read).slice(streamed.trimEnd().length)
      if (tail) yield tail
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

// Pages the agent actually read this request, appended as sources when the
// model's answer carries no links of its own (small models often skip them).
export function withSources(text: string, read: Set<string>): string {
  if (!read.size || /\]\(\/[a-z]/.test(text)) return text
  const list = [...read].slice(0, 5).map((p) => `[/${p}](/${p})`).join(" · ")
  return `${text.trimEnd()}\n\nSources: ${list}`
}

export function agentTools(read?: Set<string>) {
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
          if (md) read?.add(kind)
          return md ? pageForAgent(md, section) : { error: `no data page "${kind}"` }
        }
        if (!slug) return { error: `use kind/slug, e.g. articles/memonce` }
        const md = contentMarkdown(kind, slug)
        if (md) read?.add(`${kind}/${slug}`)
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
    "Rules: ground every claim in what you read this turn; read before relying on a snippet; if nothing covers it, say so and point to a relevant page. Never invent facts about him. Cite pages as markdown links to their site path (/kind/slug). Call tools silently: no \"let me check\" before a tool call; write only the answer. Be precise and brief, engineer to engineer. Answer in the visitor's language.",
  ].join("\n\n")
  return cachedSystemPrompt
}
