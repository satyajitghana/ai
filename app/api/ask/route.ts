import { problem } from "@/lib/api-error"
import { z } from "zod"

import {
  buildSystemPrompt,
  chatModelId,
  generateWithFallback,
  isChatOnline,
  offlinePayload,
  routeTier,
} from "@/lib/chat"
import { ASK_LIMIT, clientKey, rateLimit, tooMany } from "@/lib/rate-limit"

// ask_satyajit for other people's agents: POST {question} → {answer, model}.
// Same grounded system prompt as /api/chat, non-streaming. The question is
// routed to a GPT-5.4-family model and falls back down the ladder on error.
export const maxDuration = 60

const bodySchema = z.object({ question: z.string().min(1).max(4000) })

export function GET() {
  return Response.json({
    online: isChatOnline(),
    model: chatModelId("mini"),
    usage: 'POST {"question": "..."} → {"answer": "...", "model": "..."}',
  })
}

export async function POST(req: Request) {
  const rl = rateLimit(`ask:${clientKey(req)}`, ASK_LIMIT)
  if (!rl.ok) return tooMany(rl)

  if (!isChatOnline()) {
    return Response.json(offlinePayload, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return problem({
      code: "invalid_request",
      detail: "Request body must be JSON of the form {\"question\": string} with question at most 4000 characters.",
      hint: 'POST {"question": "..."} with content-type: application/json. See /openapi.json#/paths/~1api~1ask.',
      instance: "/api/ask",
    })
  }

  try {
    const { text, model } = await generateWithFallback({
      question: parsed.data.question,
      system: await buildSystemPrompt(),
      maxOutputTokens: 1024,
    })
    return Response.json({ answer: text, model, routed: routeTier(parsed.data.question) })
  } catch (error) {
    // Upstream (OpenAI) failure after exhausting the fallback chain.
    const message = error instanceof Error ? error.message : String(error)
    return problem({
      code: "bad_gateway",
      detail: `Upstream model error after exhausting the fallback chain: ${message}`,
      hint: "Retry after a short backoff. The static content APIs under /api/* and the markdown twins do not depend on a model and stay available.",
      instance: "/api/ask",
    })
  }
}
