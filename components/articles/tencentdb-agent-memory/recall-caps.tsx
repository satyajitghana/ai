"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The README says recall results are "further capped by item count, character
// budget, and timeout limits to prevent memory from overwhelming the context
// window." Three of those five knobs bind at their shipped defaults. Two —
// both character budgets — default to 0, and 0 means off:
//
//   MemoryCore/src/core/hooks/auto-recall.ts
//   if (!maxCharsPerMemory && !maxTotalRecallChars) { return lines }
//
// Values read from RecallConfig defaults in MemoryCore/src/config.ts.

const ON = "oklch(0.60 0.15 255)"
const OFF = "oklch(0.68 0.13 85)"

type Knob = { key: string; what: string; def: string; binds: boolean; note: string }

const KNOBS: Knob[] = [
  { key: "maxResults", what: "how many L1 memories are injected", def: "5", binds: true, note: "the cap that actually does the work" },
  { key: "scoreThreshold", what: "minimum retrieval score to qualify", def: "0.3", binds: true, note: "filters weak matches before the count cap" },
  { key: "timeoutMs", what: "give up and inject nothing", def: "5000", binds: true, note: "recall is skipped with a warning, not retried" },
  { key: "maxCharsPerMemory", what: "truncate one memory", def: "0", binds: false, note: "0 disables the per-memory limit" },
  { key: "maxTotalRecallChars", what: "truncate the whole injection", def: "0", binds: false, note: "0 disables the total limit" },
]

const TOOL_CALLS = 3

export function RecallCaps() {
  const [show, setShow] = useState<"defaults" | "configured">("defaults")

  const binding = KNOBS.filter((k) => show === "configured" || k.binds)

  const chip = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what actually bounds an injection</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setShow("defaults")} className={chip(show === "defaults")}>
            as shipped
          </button>
          <button type="button" onClick={() => setShow("configured")} className={chip(show === "configured")}>
            all knobs
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {KNOBS.map((k) => {
            const dim = show === "defaults" && !k.binds
            return (
              <div
                key={k.key}
                className={cn(
                  "grid grid-cols-1 items-center gap-x-3 gap-y-0.5 rounded-lg border bg-muted/15 px-3 py-2 transition-opacity sm:grid-cols-[minmax(0,11rem)_1fr_auto_auto]",
                  dim && "opacity-35",
                )}
              >
                <span className="truncate font-mono text-[11px]" style={{ color: k.binds ? ON : OFF }}>
                  {k.key}
                </span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">{k.what}</span>
                <span className="font-mono text-[11px] tabular-nums text-foreground">{k.def}</span>
                <span
                  className="w-fit rounded-full px-2 py-0.5 font-mono text-[9px] text-white"
                  style={{ background: k.binds ? ON : OFF }}
                >
                  {k.binds ? "binds" : "off by default"}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-background/60 px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              bounded automatically
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {binding.filter((k) => k.binds).length} of {KNOBS.length} knobs
            </div>
            <div className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">
              count, score and time — but not length
            </div>
          </div>
          <div className="rounded-lg border bg-background/60 px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              agent-initiated searches
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">{TOOL_CALLS} per turn, hard</div>
            <div className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">
              memory_search + conversation_search combined
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The README promises caps on &ldquo;item count, character budget, and timeout.&rdquo; Two of the three are
          live at the defaults; the <span className="text-foreground">character budget is implemented but ships
          disabled</span>, and the code short-circuits when both length limits are zero. In practice five results
          still bounds things — but five results of unbounded length is a different guarantee than the sentence
          implies, and a long L1 memory is exactly the case the budget exists for. Worth setting before you trust
          it.
        </p>
      </div>
    </figure>
  )
}
