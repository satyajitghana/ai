"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The turn/step lifecycle, transcribed from docs/architecture.md's own flow
// block at 47f9438 and cross-checked against the event kinds it names.
//
// Three facts the doc states that this diagram keeps honest:
//   - `turn/*`, `step/*`, `user/message`, `assistant/*`, `tool/*` are DURABLE
//     session events; everything else is a live extension point.
//   - `agent/pre-step`, `agent/request`, `llm/stream` and the three `tools/*`
//     events are WATERFALLS — a listener must call next() to delegate, and
//     returning without next() short-circuits.
//   - `agent/turn-stopping` is serial and has NO next().

type Kind = "durable" | "waterfall" | "live"

type Row = {
  name: string
  kind: Kind
  depth: number
  note: string
}

const ROWS: Row[] = [
  { name: "turn/start", kind: "durable", depth: 0, note: "A turn opens before its first input is claimed. It closes once nothing is owed — so a turn is zero or more steps, not exactly one." },
  { name: "claim input", kind: "live", depth: 1, note: "The driver claims the next-step input plus one queued message from a single inbox. Some messages wake it immediately; injected context waits until another message does." },
  { name: "assemble prompt + tool schemas", kind: "live", depth: 1, note: "Each step reads the prompt sections and tool schemas that plugins registered. Change the preset and this is what changes." },
  { name: "agent/pre-step", kind: "waterfall", depth: 1, note: "Decides what the model sees. A listener may rewrite the claimed messages or reject them outright. A rejected — or empty first — claim still closes a durable turn that spent no step, so the log records the attempt rather than forgetting it." },
  { name: "step/start", kind: "durable", depth: 2, note: "A step is one model request plus the tools it calls." },
  { name: "user/message", kind: "durable", depth: 2, note: "The entered messages are appended to the log. Model history is then derived from the log — not from the thing that was just in memory." },
  { name: "agent/request", kind: "waterfall", depth: 2, note: "The last point at which the call configuration can be swapped. It cannot mutate messages: model-visible content has to arrive through logged channels." },
  { name: "llm/stream", kind: "waterfall", depth: 2, note: "The adapter seam. This is also where the agent-loop invariant listens, with prepend so a short-circuiting replay listener cannot silence it." },
  { name: "assistant/chunk*", kind: "durable", depth: 3, note: "Raw chunks are kept, not just the assembled message, which is what makes replay and UI fidelity possible after a reload." },
  { name: "assistant/message", kind: "durable", depth: 3, note: "The assembled assistant turn." },
  { name: "tool/call*", kind: "durable", depth: 2, note: "Each call the model asked for." },
  { name: "tools/pre-execute", kind: "waterfall", depth: 3, note: "Policy and approval live here — the guarded execution pipeline, not the tool implementation." },
  { name: "tools/execute", kind: "waterfall", depth: 3, note: "The execution itself, wrappable end to end." },
  { name: "tools/post-execute", kind: "waterfall", depth: 3, note: "Result shaping and observation policy." },
  { name: "tool/result*", kind: "durable", depth: 2, note: "The recorded outcome." },
  { name: "step/end", kind: "durable", depth: 2, note: "If tools owe another request, or next-step input arrived, the driver claims again and runs another step inside the same turn." },
  { name: "agent/turn-stopping", kind: "live", depth: 1, note: "Serial, and the one interception point here with no next(). This is where a turn gets stopped." },
  { name: "turn/end", kind: "durable", depth: 0, note: "Nothing is owed." },
]

const COLORS: Record<Kind, string> = {
  durable: "oklch(0.60 0.15 255)",
  waterfall: "oklch(0.68 0.13 85)",
  live: "oklch(0.62 0.03 250)",
}

const LABELS: Record<Kind, string> = {
  durable: "durable session event",
  waterfall: "waterfall (must call next)",
  live: "live extension point",
}

export function TurnFlow() {
  const [sel, setSel] = useState(7)
  const [filter, setFilter] = useState<Kind | "all">("all")

  const row = ROWS[sel]
  const lit = (r: Row) => filter === "all" || r.kind === filter

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one turn · docs/architecture.md</span>
        <div className="flex flex-wrap gap-1">
          {(["all", "durable", "waterfall", "live"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                filter === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "all" ? null : (
                <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: COLORS[k] }} />
              )}
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-0.5">
          {ROWS.map((r, i) => {
            const on = i === sel
            const dim = !lit(r)
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={on}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors",
                  on ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                  dim ? "opacity-30" : "",
                )}
                style={{ paddingLeft: `${0.5 + r.depth * 0.85}rem` }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: COLORS[r.kind] }}
                />
                <span className="truncate font-mono text-[11px] text-foreground">{r.name}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-foreground">{row.name}</span>
            <span className="font-mono text-[10px]" style={{ color: COLORS[row.kind] }}>
              {LABELS[row.kind]}
            </span>
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{row.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The shape worth noticing is which events are which colour. Everything the model produced or consumed is
          durable — it is in the log, and the log is what the next request is rebuilt from. Everything that lets you
          intervene is live, and most of it is around-middleware: a listener wraps the call and delegates with{" "}
          <span className="font-mono text-foreground">next()</span>, or owns the decision and returns without it.
          There is no place in this diagram where you patch the loop, because the loop is a plugin like the rest and
          the extension points are the API.
        </p>
      </div>
    </figure>
  )
}
