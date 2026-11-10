"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the API does with a continue request that differs from the create
// request in one way. Every outcome is taken from the message-threads docs page
// (platform.claude.com/docs/en/build-with-claude/message-threads); the quoted
// lines are the docs' own words.

type Case = {
  id: string
  label: string
  status: string
  code?: string
  tone: "ok" | "bad" | "warn"
  says: string
  doc: string
}

const CASES: Case[] = [
  {
    id: "ok",
    label: "new messages + previous_message_id",
    status: "200",
    tone: "ok",
    says: "The API rebuilds the conversation from the thread and the new messages, then runs the model on all of it.",
    doc: "Send only the messages since the previous response",
  },
  {
    id: "system",
    label: "send system or tools again",
    status: "400",
    tone: "bad",
    says: "Rejected before the model runs. This 400 carries no error_code. The thread keeps the values from the create request.",
    doc: "Sending either one on a continue request, even as `null`, returns a 400 error.",
  },
  {
    id: "model",
    label: "change model, thinking or tool_choice",
    status: "400",
    code: "thread_fingerprint_mismatch",
    tone: "bad",
    says: "These are fixed fields. The thread stores a fingerprint of them and checks every request against it; the message names the fields that differ.",
    doc: "A different value returns a 400 error with the code `thread_fingerprint_mismatch`",
  },
  {
    id: "max",
    label: "change max_tokens or stream",
    status: "200",
    tone: "ok",
    says: "Free fields. max_tokens, stop_sequences, stream, metadata and service_tier can change from turn to turn.",
    doc: "These can change from turn to turn.",
  },
  {
    id: "older",
    label: "continue from an older response id",
    status: "400",
    code: "thread_already_continued",
    tone: "bad",
    says: "A thread is append-only and each response id can be continued once. Branching means a new create request.",
    doc: "Each response `id` can be continued once.",
  },
  {
    id: "early",
    label: "continue before message_stop arrives",
    status: "404",
    code: "thread_not_found",
    tone: "warn",
    says: "The id arrives in message_start, but the thread only holds the turn once the response is finished.",
    doc: "continue from it only after you receive the `message_stop` event",
  },
  {
    id: "resend",
    label: "send the previous reply again",
    status: "400 or a duplicate",
    tone: "warn",
    says: "The API does not diff your messages against what it holds. A repeated message can land twice in the conversation.",
    doc: "A message you send again can appear twice in the conversation, or the request can return an error.",
  },
  {
    id: "bp",
    label: "a fifth cache_control breakpoint",
    status: "400",
    code: "thread_unsupported_request",
    tone: "bad",
    says: "At most 4 per threaded request. The top-level cache_control counts as one, and breakpoints on the create request's system and tools count again on every continue.",
    doc: "One breakpoint too many returns a 400 error with the code `thread_unsupported_request`.",
  },
  {
    id: "idle",
    label: "continue after 6 idle minutes",
    status: "404",
    code: "thread_not_found",
    tone: "warn",
    says: "The thread expired. Replay the whole conversation from your own copy in a new create request.",
    doc: "It expires 5 minutes after its last request",
  },
  {
    id: "count",
    label: "count_tokens with thread",
    status: "400",
    tone: "bad",
    says: "Token counting does not take a thread. Count the full conversation, with system and tools.",
    doc: "A token counting request that includes `thread` returns a 400 error.",
  },
]

export function ContinueChecker() {
  const [id, setId] = useState("ok")
  const c = CASES.find((x) => x.id === id) ?? CASES[0]
  const color = c.tone === "ok" ? "oklch(0.66 0.13 150)" : c.tone === "warn" ? "oklch(0.74 0.14 75)" : "oklch(0.63 0.18 28)"
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        a continue request, changed one way · from the docs
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:p-4">
        <div className="flex flex-col gap-1">
          {CASES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              aria-pressed={x.id === id}
              className={cn(
                "rounded-md border px-2 py-1 text-left font-mono text-[11px] transition-colors",
                x.id === id ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-lg border px-3 py-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="rounded px-1.5 py-0.5 font-mono text-sm text-white" style={{ background: color }}>
              {c.status}
            </span>
            {c.code ? <code className="font-mono text-[12px]">{c.code}</code> : null}
          </div>
          <p className="text-[13px] leading-snug">{c.says}</p>
          <blockquote className="border-l-2 pl-3 text-[12px] italic text-muted-foreground">{c.doc}</blockquote>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Outcomes as the message-threads documentation states them; the italic line is quoted from it. I did not send
        these requests: there was no API key in this sandbox.
      </figcaption>
    </figure>
  )
}
