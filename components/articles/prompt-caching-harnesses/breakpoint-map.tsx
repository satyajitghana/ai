"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where each open-source harness puts its Anthropic-style cache markers, read
// from the code at the commits the article pins. A block with `mark` carries a
// cache_control breakpoint at its end. Widths are schematic, not token counts.

type Block = { label: string; w: number; mark?: boolean; kind: "static" | "volatile" | "history" | "turn" }
type Harness = { id: string; name: string; blocks: Block[]; marks: string; note: string; receipt: string }

const HARNESSES: Harness[] = [
  {
    id: "oc2",
    name: "opencode v2",
    blocks: [
      { label: "tools", w: 16, mark: true, kind: "static" },
      { label: "agent prompt", w: 14, mark: true, kind: "static" },
      { label: "instructions + date (frozen)", w: 18, mark: true, kind: "static" },
      { label: "history", w: 36, kind: "history" },
      { label: "latest", w: 8, mark: true, kind: "turn" },
    ],
    marks: "4: last tool, first and last system part, conversation tail",
    note: "Instructions, including today's date, are snapshotted at session start; a later change is appended as a system message, not written over the head.",
    receipt: "packages/ai/src/cache-policy.ts:17-21, 95-105, 173-185 · core/src/instructions/builtins.ts:24-31",
  },
  {
    id: "oc1",
    name: "opencode v1.x",
    blocks: [
      { label: "tools", w: 16, kind: "static" },
      { label: "system 1", w: 14, mark: true, kind: "static" },
      { label: "system 2 (env, date)", w: 18, mark: true, kind: "volatile" },
      { label: "history", w: 30, kind: "history" },
      { label: "prev", w: 7, mark: true, kind: "turn" },
      { label: "latest", w: 7, mark: true, kind: "turn" },
    ],
    marks: "4: first two system messages, last two non-system messages",
    note: "What Arpit describes. The environment block carries Today's date, so it changes once a day.",
    receipt: "v1.19.3 packages/opencode/src/provider/transform.ts:358-360 · session/system.ts:83",
  },
  {
    id: "pi",
    name: "pi",
    blocks: [
      { label: "tools", w: 16, mark: true, kind: "static" },
      { label: "system prompt", w: 26, mark: true, kind: "static" },
      { label: "history (+ appended system updates)", w: 42, kind: "history" },
      { label: "latest", w: 8, mark: true, kind: "turn" },
    ],
    marks: "3: system prompt, last tool, last user or tool-result block (4 with an OAuth identity block)",
    note: "No date in the prompt. On models that accept mid-conversation system messages, prompt and tool changes are appended after history.",
    receipt: "packages/ai/src/api/anthropic-messages.ts:1227-1252, 1264-1275, 1529-1555",
  },
  {
    id: "goose",
    name: "Goose",
    blocks: [
      { label: "tools", w: 16, mark: true, kind: "static" },
      { label: "system + extensions", w: 26, mark: true, kind: "static" },
      { label: "history (+ turn context)", w: 36, kind: "history" },
      { label: "prev user", w: 7, mark: true, kind: "turn" },
      { label: "latest", w: 7, mark: true, kind: "turn" },
    ],
    marks: "4: last tool, system, last two user messages",
    note: "Current time travels in a per-turn context block in the conversation; extensions are sorted by name for a stable prefix.",
    receipt: "crates/goose-provider-types/src/formats/anthropic.rs:525-545, 576-600",
  },
  {
    id: "cline",
    name: "Cline",
    blocks: [
      { label: "tools", w: 16, kind: "static" },
      { label: "system prompt", w: 26, kind: "static" },
      { label: "history", w: 42, kind: "history" },
      { label: "latest", w: 8, mark: true, kind: "turn" },
    ],
    marks: "1: the last text part of the latest user message",
    note: "One marker at the tail. Everything before it is one prefix, found again by the provider's lookback.",
    receipt: "sdk/packages/llms/src/providers/ai-sdk.ts:427-436",
  },
  {
    id: "aider",
    name: "Aider",
    blocks: [
      { label: "system (date)", w: 16, mark: true, kind: "volatile" },
      { label: "read-only + repo map", w: 22, mark: true, kind: "static" },
      { label: "history", w: 26, kind: "history" },
      { label: "chat files", w: 18, mark: true, kind: "volatile" },
      { label: "current", w: 10, kind: "turn" },
    ],
    marks: "3, only with --cache-prompts (off by default): system or examples, repo map, chat files",
    note: "Edited files sit after history, so an edit costs only what follows it. The system prompt carries the date.",
    receipt: "aider/coders/chat_chunks.py:16-41 · base_coder.py:1143-1144 · args.py:233-237",
  },
  {
    id: "continue",
    name: "Continue",
    blocks: [
      { label: "tools", w: 16, kind: "static" },
      { label: "system", w: 22, mark: true, kind: "static" },
      { label: "history", w: 32, kind: "history" },
      { label: "prev user", w: 11, mark: true, kind: "turn" },
      { label: "latest", w: 11, mark: true, kind: "turn" },
    ],
    marks: "3, opt-in through cacheBehavior: system, last two user messages",
    note: "Tool definitions get no marker of their own.",
    receipt: "core/llm/llms/Anthropic.ts:417-443 · openai-adapters/src/apis/AnthropicUtils.ts:99-120",
  },
  {
    id: "codex",
    name: "Codex CLI",
    blocks: [
      { label: "tools", w: 16, kind: "static" },
      { label: "base instructions", w: 26, kind: "static" },
      { label: "history (+ time reminders)", w: 42, kind: "history" },
      { label: "latest", w: 8, kind: "turn" },
    ],
    marks: "0: OpenAI caches automatically; Codex sends prompt_cache_key = the session id",
    note: "Base instructions are an input item with an id derived from the thread and its text, so the bytes repeat exactly.",
    receipt: "codex-rs/core/src/client.rs:646-658, 975-1005",
  },
]

const FILL: Record<Block["kind"], string> = {
  static: "color-mix(in oklch, var(--background), oklch(0.68 0.13 150) 28%)",
  volatile: "color-mix(in oklch, var(--background), oklch(0.75 0.14 75) 34%)",
  history: "var(--muted)",
  turn: "color-mix(in oklch, var(--background), oklch(0.62 0.12 255) 26%)",
}

export function BreakpointMap() {
  const [id, setId] = useState("oc2")
  const h = HARNESSES.find((x) => x.id === id) ?? HARNESSES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        where the cache markers go · one request, left to right
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {HARNESSES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              aria-pressed={x.id === id}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                x.id === id ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {x.name}
            </button>
          ))}
        </div>

        <div className="flex w-full gap-0.5 pt-4">
          {h.blocks.map((b) => (
            <div key={b.label} className="relative" style={{ width: `${b.w}%` }}>
              {b.mark ? (
                <span
                  className="absolute -top-4 right-0 font-mono text-[11px] leading-none"
                  style={{ color: "oklch(0.58 0.19 25)" }}
                  aria-hidden="true"
                >
                  ▼
                </span>
              ) : null}
              <div
                className={cn(
                  "flex h-12 items-center justify-center rounded-sm px-1 text-center font-mono text-[10px] leading-tight",
                  b.mark && "border-r-2",
                )}
                style={{ background: FILL[b.kind], borderColor: b.mark ? "oklch(0.58 0.19 25)" : undefined }}
              >
                {b.label}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1 font-mono text-[11px]">
          <div>
            <span className="text-muted-foreground">markers </span>
            {h.marks}
          </div>
          <div className="text-muted-foreground">{h.note}</div>
          <div className="break-words text-[10px] text-muted-foreground">{h.receipt}</div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        ▼ marks a cache breakpoint at the end of a block. Green blocks hold still; amber ones change during a
        session. Read from each repository at the commit the article pins; Claude Code is closed and not shown.
      </figcaption>
    </figure>
  )
}
