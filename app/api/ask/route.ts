import { generateText } from "ai"
import { z } from "zod"

import {
  buildSystemPrompt,
  chatModel,
  chatModelId,
  isChatOnline,
  offlinePayload,
} from "@/lib/chat"

// ask_satyajit for other people's agents: POST {question} → {answer, model}.
// Same grounded system prompt as /api/chat, non-streaming. Via the AI SDK.
export const maxDuration = 60

const bodySchema = z.object({ question: z.string().min(1).max(4000) })

export function GET() {
  return Response.json({
    online: isChatOnline(),
    model: chatModelId("fast"),
    usage: 'POST {"question": "..."} → {"answer": "...", "model": "..."}',
  })
}

export async function POST(req: Request) {
  if (!isChatOnline()) {
    return Response.json(offlinePayload, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 })
  }

  try {
    const { text } = await generateText({
      model: chatModel("fast"),
      system: await buildSystemPrompt(),
      prompt: parsed.data.question,
      maxOutputTokens: 1024,
    })
    return Response.json({ answer: text, model: chatModelId("fast") })
  } catch (error) {
    // Upstream (OpenAI) failure — surface it instead of a blank 500.
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { error: "upstream model error", detail: message },
      { status: 502 }
    )
  }
}
