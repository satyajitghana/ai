import { createGoogleGenerativeAI } from "@ai-sdk/google"

import { profile } from "@/data/profile"
import { getAllContent } from "@/lib/content"
import { contentMarkdown, dataPageMarkdown } from "@/lib/markdown"
import { siteUrl } from "@/lib/site"

// Shared chat plumbing for /api/chat (streaming) and /api/ask (one-shot).
//
// PROVIDER: routed through the Vercel AI SDK so the model/provider is a one-line
// swap. Currently Google Gemini (`@ai-sdk/google`); switching to OpenAI/Anthropic
// later means changing only the provider + model ids here, nothing downstream.
//
// CONTEXT DESIGN: the system prompt is ONE static block — persona + rules + the
// full content corpus — byte-identical until the next deploy. The corpus is
// small (one person's writing), so we ship ALL of it rather than per-request
// retrieval; the provider's context caching then discounts the repeated prefix.
// Volatile content (the user's question, history) goes in `messages`. If the
// corpus ever approaches ~100K tokens, switch to retrieval over /api/search.

// Two model tiers, provider-abstracted via the AI SDK. "main" powers the
// interactive chat; "fast" (cheaper/quicker) powers one-shot agent calls like
// /api/ask and the MCP ask_satyajit tool. Swap either via env — no code change.
export type ModelTier = "main" | "fast"

const MODELS: Record<ModelTier, string> = {
  main: process.env.CHAT_MODEL ?? "gemini-3.1-flash-lite",
  fast: process.env.CHAT_MODEL_FAST ?? "gemini-3.1-flash-lite",
}

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

let cachedSystemPrompt: string | undefined

export async function buildSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt

  const sections: string[] = []
  for (const page of ["about", "resume", "health", "now", "uses", "reading"]) {
    const md = await dataPageMarkdown(page)
    if (md) sections.push(md)
  }
  for (const item of getAllContent()) {
    const md = contentMarkdown(item.kind, item.slug)
    if (md) sections.push(md)
  }

  cachedSystemPrompt = [
    `You are the AI assistant embedded on ${siteUrl} — the personal site of ${profile.name} (${profile.title} @ ${profile.company.name}, ${profile.location}).`,
    "",
    "Rules:",
    "- Answer questions about Satyajit — his work, projects, articles, daily arXiv digests, resume, patents, health panel — grounded ONLY in the corpus below.",
    "- Cite sources as markdown links to the site page the fact came from (the canonical URLs appear in each document header).",
    "- If something is not in the corpus, say so plainly and point to a relevant page or his contact links. Never invent facts about him.",
    "- Voice: precise, engineer-first, concise. No marketing fluff.",
    "- You may answer in any language the visitor uses.",
    "",
    "=== CONTENT CORPUS (generated from the site's content layer) ===",
    "",
    sections.join("\n\n---\n\n"),
  ].join("\n")

  return cachedSystemPrompt
}
