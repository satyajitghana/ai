"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The two "everyone assumes this helps" design choices, set against what the
// controlled ablations actually measured. Toggle between the folk belief (why
// people reach for these) and IFM Research's numbers. Random state init: two
// gains, four losses of unspecified-but->1pt size (the source gives the sign
// and a lower bound, not the exact figure — rendered as a hatched, open-ended
// bar rather than invented precision). Shared H/L hierarchy: only counts are
// given (gains on 3 benchmarks, losses on 3, MATH500 named as the worst), so
// it is drawn as a 10-cell benchmark grid, not named per-benchmark bars.

type View = "assumed" | "measured"

const UP = "oklch(0.60 0.14 155)"
const DOWN = "oklch(0.62 0.19 25)"

const RANDOM_INIT_BARS: { label: string; text: string; dir: "up" | "boundedDown" }[] = [
  { label: "ARC-C", text: "+3.34", dir: "up" },
  { label: "GSM8K", text: "+1.22", dir: "up" },
  { label: "MMLU", text: "worse, >1pt", dir: "boundedDown" },
  { label: "MATH500", text: "worse, >1pt", dir: "boundedDown" },
  { label: "HumanEval+", text: "worse, >1pt", dir: "boundedDown" },
  { label: "MBPP+", text: "worse, >1pt", dir: "boundedDown" },
]

// 10-benchmark grid for the H/L hierarchy result: only the counts (3 up / 3
// down / 4 roughly flat) and one named casualty (MATH500) are reported.
const HL_GRID: { dir: "up" | "down" | "flat"; label: string }[] = [
  { dir: "down", label: "MATH500" },
  { dir: "down", label: "benchmark" },
  { dir: "down", label: "benchmark" },
  { dir: "flat", label: "benchmark" },
  { dir: "flat", label: "benchmark" },
  { dir: "flat", label: "benchmark" },
  { dir: "flat", label: "benchmark" },
  { dir: "up", label: "benchmark" },
  { dir: "up", label: "benchmark" },
  { dir: "up", label: "benchmark" },
]

export function MythVsMeasured() {
  const [view, setView] = useState<View>("measured")
  const measured = view === "measured"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>believed-important vs. measured effect</span>
        <span className="text-muted-foreground/50">Q3, recurrent-state design</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-1.5">
          {([["what's assumed", "assumed"], ["what was measured", "measured"]] as [string, View][]).map(([label, v]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                view === v ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* panel 1: random state init */}
        <div className="mt-4">
          <div className="font-mono text-xs font-medium text-foreground">random state init vs. direct init (z₀ = e)</div>
          {!measured ? (
            <div className="mt-2 rounded-md border border-dashed px-3 py-2.5 font-mono text-xs text-muted-foreground">
              assumed: necessary for path-independence, inherited from deep-equilibrium models — expected to help broadly
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              {RANDOM_INIT_BARS.map((b) => {
                const isBounded = b.dir === "boundedDown"
                const pct = isBounded ? 55 : Math.min(100, 20 + Number(b.text.replace("+", "")) * 12)
                return (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-right font-mono text-xs text-muted-foreground">{b.label}</span>
                    <div className="relative h-5 flex-1">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                      <div
                        className={cn("absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm", isBounded && "border border-dashed")}
                        style={{
                          [b.dir === "up" ? "left" : "right"]: "50%",
                          width: `${pct / 2}%`,
                          background: isBounded ? "transparent" : b.dir === "up" ? UP : DOWN,
                          borderColor: isBounded ? DOWN : undefined,
                        }}
                      />
                    </div>
                    <span className={cn("w-24 shrink-0 font-mono text-[11px] tabular-nums", b.dir === "up" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                      {b.text}
                    </span>
                  </div>
                )
              })}
              <p className="pt-1 font-mono text-[10px] text-muted-foreground">
                dashed bars: source reports only the direction and that the loss exceeds 1 point, not the exact value
              </p>
            </div>
          )}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {measured
              ? "Direct init wins 6 of 10 benchmarks and skips the random sampling step entirely — cheaper, and net ahead."
              : "Toggle to “measured” to see the actual per-benchmark result."}
          </p>
        </div>

        {/* panel 2: shared H/L hierarchy */}
        <div className="mt-5 border-t pt-4">
          <div className="font-mono text-xs font-medium text-foreground">shared H/L hierarchy (HRM/TRM-style) vs. flat loop</div>
          {!measured ? (
            <div className="mt-2 rounded-md border border-dashed px-3 py-2.5 font-mono text-xs text-muted-foreground">
              assumed: a fast/slow two-timescale state should add reasoning capacity — expected to help
            </div>
          ) : (
            <div className="mt-2 flex gap-1">
              {HL_GRID.map((c, i) => (
                <div
                  key={i}
                  title={c.label}
                  className="h-6 flex-1 rounded-sm"
                  style={{
                    background: c.dir === "up" ? UP : c.dir === "down" ? DOWN : "var(--muted)",
                    opacity: c.dir === "flat" ? 1 : 0.85,
                  }}
                />
              ))}
            </div>
          )}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {measured
              ? "Gains over 1 point on 3 benchmarks, losses over 1 point on 3 — MATH500 hit hardest — and roughly flat on the rest. “No consistent benefit,” in the report's own words, at least for a shared-weight H/L split."
              : "Toggle to “measured” to see the actual spread across the 10-benchmark suite."}
          </p>
        </div>
      </div>
    </figure>
  )
}
