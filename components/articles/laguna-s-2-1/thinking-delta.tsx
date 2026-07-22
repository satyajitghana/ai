"use client"

import { useState } from "react"

// The "second axis." Laguna S 2.1's biggest lever isn't size — it's test-time
// compute. Of every model poolside has trained, S 2.1 has the largest gap
// between no-thinking and max-thinking. Flip the switch: max thinking lifts
// Terminal-Bench 2.1 from 60.4 to 70.2 (+9.8) and DeepSWE from 16.5 to 40.4
// (+23.9 — it more than doubles). Numbers: poolside, 21 Jul 2026.

const ACCENT = "oklch(0.65 0.15 200)"

const ROWS = [
  { name: "Terminal-Bench 2.1", off: 60.4, max: 70.2 },
  { name: "DeepSWE v1.1", off: 16.5, max: 40.4 },
]

export function ThinkingDelta() {
  const [thinking, setThinking] = useState(true)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">thinking effort · score delta</span>
        <button
          type="button"
          onClick={() => setThinking((t) => !t)}
          className="flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-xs transition-colors hover:bg-muted/50"
        >
          thinking:
          <span
            className="rounded px-1.5 py-0.5 tabular-nums"
            style={thinking ? { background: ACCENT, color: "white" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            {thinking ? "max" : "off"}
          </span>
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-4">
          {ROWS.map((r) => {
            const v = thinking ? r.max : r.off
            const delta = r.max - r.off
            return (
              <div key={r.name}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">{r.name}</span>
                  <span className="tabular-nums">
                    <span className="text-lg text-foreground">{v.toFixed(1)}</span>
                    <span className="text-muted-foreground">/100</span>
                  </span>
                </div>
                <div className="relative h-6 overflow-hidden rounded bg-muted/40">
                  {/* off baseline marker */}
                  <div className="absolute top-0 h-full border-r border-dashed border-foreground/30" style={{ left: `${r.off}%` }} />
                  <div
                    className="h-full rounded transition-all duration-500 ease-out"
                    style={{ width: `${v}%`, background: ACCENT, opacity: thinking ? 1 : 0.55 }}
                  />
                  {thinking ? (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold text-foreground"
                      style={{ left: `calc(${r.off}% + 4px)` }}
                    >
                      +{delta.toFixed(1)}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The dashed line is the no-thinking baseline. On DeepSWE — the least saturated of these benchmarks —
          the internal monologue <span style={{ color: ACCENT }}>more than doubles</span> the score. poolside
          ships max thinking on by default and lets the model pick its own budget; it says it&rsquo;s watched
          coherent reasoning run for hours and hundreds of thousands of tokens.
        </p>
      </div>
    </figure>
  )
}
