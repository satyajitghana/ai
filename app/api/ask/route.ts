import { problem } from "@/lib/api-error"
import { z } from "zod"

import {
  buildSystemPrompt,
  chatModelId,
  generateWithFallback,
  isChatOnline,
  offlinePayload,
} from "@/lib/chat"
import { ASK_LIMIT, clientKey, rateLimit, tooMany } from "@/lib/rate-limit"

// ask_satyajit for other people's agents: POST {question} → {answer, model}.
// Same grounded agent as /api/chat (Cloudflare Workers AI, lib/chat.ts),
// non-streaming.
export const maxDuration = 60

const bodySchema = z.object({ question: z.string().min(1).max(4000) })

export function GET() {
  return Response.json({
    online: isChatOnline(),
    model: chatModelId(),
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
      maxOutputTokens: 900,
    })
    return Response.json({ answer: text, model })
  } catch (error) {
    // Upstream (Workers AI) failure.
    const message = error instanceof Error ? error.message : String(error)
    return problem({
      code: "bad_gateway",
      detail: `Upstream model error: ${message}`,
      hint: "Retry after a short backoff. The static content APIs under /api/* and the markdown twins do not depend on a model and stay available.",
      instance: "/api/ask",
    })
  }
}
