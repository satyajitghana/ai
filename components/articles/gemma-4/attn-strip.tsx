"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The attention pattern Gemma 4 inherits and tunes: a repeating stack of cheap
// local sliding-window layers punctuated by one expensive global layer. Gemma 4
// keeps 5 local per 1 global for most models, and 4:1 for the smallest (E2B).
// The global layers are the only ones whose KV cache scales with the full
// context — and they're where "values = keys" applies (except E2B/E4B). This
// strip just makes the interleave legible; toggle the ratio to see it shift.
//
// SSR-SAFE: pure, deterministic first render. No timers/RNG. Fixed-length map.

const ACCENT = "oklch(0.62 0.17 255)" // global layer
const LAYERS = 30 // a slice of the stack, illustrative (multiple of 5 and 6)

const RATIOS = [
  { key: "5", label: "5:1 · most models", period: 6 },
  { key: "4", label: "4:1 · E2B", period: 5 },
] as const

export function AttnStrip() {
  const [ratioKey, setRatioKey] = useState<"5" | "4">("5")
  const period = RATIOS.find((r) => r.key === ratioKey)!.period

  // layer i is global when it closes a block (every `period`-th layer)
  const cells = Array.from({ length: LAYERS }, (_, i) => (i + 1) % period === 0)
  const globals = cells.filter(Boolean).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>local ↔ global attention interleave</span>
        <span className="text-muted-foreground/50">{globals}/{LAYERS} global</span>
      </div>

      <div className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {RATIOS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRatioKey(r.key)}
              aria-pressed={ratioKey === r.key}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                ratioKey === r.key ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={ratioKey === r.key ? { background: ACCENT } : undefined}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {cells.map((isGlobal, i) => (
            <div
              key={i}
              title={isGlobal ? `layer ${i + 1} · global (full context)` : `layer ${i + 1} · local (window)`}
              className="flex h-9 flex-1 items-center justify-center rounded-md text-[10px] font-mono transition-all duration-200"
              style={{
                minWidth: 22,
                background: isGlobal ? ACCENT : "var(--muted)",
                color: isGlobal ? "var(--background)" : "var(--muted-foreground)",
                opacity: isGlobal ? 0.95 : 0.6,
              }}
            >
              {isGlobal ? "G" : "·"}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} /> global · full-context KV, values=keys
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted" /> local · sliding-window KV
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Only <span className="text-foreground">{globals} of {LAYERS}</span> layers here attend over the whole
          context; the rest are bounded by a sliding window and cost the same at 8k or 128k. Push the ratio to 4:1
          (E2B) and one more layer per block goes global. Fewer global layers means a smaller cache to carry — which
          is exactly what the budget chart below measures.
        </p>
      </div>
    </figure>
  )
}
