import { convertToModelMessages, type UIMessage } from "ai"
import { z } from "zod"

import {
  buildSystemPrompt,
  chatModelId,
  isChatOnline,
  modelChain,
  offlinePayload,
  routeTier,
  streamWithFallback,
} from "@/lib/chat"
import { CHAT_LIMIT, clientKey, rateLimit, tooMany } from "@/lib/rate-limit"

// Streaming RAG chat via the Vercel AI SDK (OpenAI provider).
// The latest user turn is routed to a GPT-5.4-family model, with fallback down
// the ladder if a model errors before emitting any text.
// NO-KEY MODE: returns 503 + a pointer to the static agent surfaces.
export const maxDuration = 60

// The console UI posts a plain {messages:[{role,content}]} shape, plus an
// optional {context} describing the page the user is currently on.
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(24),
  context: z
    .object({
      path: z.string().max(400).optional(),
      title: z.string().max(400).optional(),
    })
    .optional(),
})

// Lets the UI (and curious agents) check availability without spending tokens.
export function GET() {
  return Response.json({ online: isChatOnline(), model: chatModelId("mini") })
}

export async function POST(req: Request) {
  const rl = rateLimit(`chat:${clientKey(req)}`, CHAT_LIMIT)
  if (!rl.ok) return tooMany(rl)

  if (!isChatOnline()) {
    return Response.json(offlinePayload, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 })
  }

  const system = await buildSystemPrompt()

  // Page context rides in the volatile `messages` channel (not the cached system
  // prefix): prepend a short note to the latest user turn so the model knows where
  // the reader is and can resolve "this page / this article / here".
  const messages = parsed.data.messages.map((m) => ({ ...m }))
  const ctx = parsed.data.context
  if (ctx && (ctx.path || ctx.title)) {
    let lastUser = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUser = i
        break
      }
    }
    if (lastUser !== -1) {
      const where = ctx.title ? `"${ctx.title}"` : "a page"
      const at = ctx.path ? ` (${ctx.path})` : ""
      const note = `[The reader is currently on ${where}${at}. If they say "this page", "this article", "here", or similar, they mean that.]`
      messages[lastUser] = {
        ...messages[lastUser],
        content: `${note}\n\n${messages[lastUser].content}`,
      }
    }
  }

  const uiMessages: UIMessage[] = messages.map((m, i) => ({
    id: String(i),
    role: m.role,
    parts: [{ type: "text", text: m.content }],
  }))

  // Route on the reader's latest question (not the context-annotated copy).
  const lastQuestion =
    parsed.data.messages.filter((m) => m.role === "user").at(-1)?.content ?? ""
  const tier = routeTier(lastQuestion)
  const modelMessages = await convertToModelMessages(uiMessages)

  // Manual text stream so an upstream failure (quota / model access) becomes
  // visible text instead of a silent empty reply; streamWithFallback drops to
  // the next model if one errors before any token is emitted.
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamWithFallback({
          tier,
          system,
          messages: modelMessages,
          maxOutputTokens: 1500,
        })) {
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error("[chat] stream error:", message)
        controller.enqueue(encoder.encode(`\n[chat error] ${message}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-model": modelChain(tier)[0],
      "x-routed-tier": tier,
    },
  })
}
