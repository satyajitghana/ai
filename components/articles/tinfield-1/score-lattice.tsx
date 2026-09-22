"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Which scores are even reachable, and what that tells you about "k=5".
//
// Terminal-Bench 4.0 has 66 tasks. Two reporting conventions are in circulation:
//
//   best-of-k   score = (tasks solved at least once) / 66        → multiples of 1/66
//   mean-of-k   score = (solves across all runs) / (66 · k)      → multiples of 1/(66k)
//
// The lattices are different, so a printed score is itself evidence about the
// convention. 33.0 is not on the best-of-5 lattice — 21/66 is 31.82, 22/66 is
// 33.33, nothing lands on 33.0 — but 109/330 is 33.03, which prints as 33.0.
// Both boards Tinfield cites report "pass@1 averaged over N repeats", which is
// the mean-of-k lattice, so the lattices and the boards agree.
//
// The slider is over k, not over the score, because k is the thing the card
// leaves ambiguous and the reader is trying to pin down.

const TASKS = 66
const REPORTED = 33.0
const BASE = 29.0

export function ScoreLattice() {
  const [k, setK] = useState(5)
  const [mode, setMode] = useState<"best" | "mean">("mean")

  const denom = mode === "best" ? TASKS : TASKS * k
  const step = 100 / denom
  // Ticks near the reported score, so the lattice is legible rather than a smear.
  const lo = 26
  const hi = 40
  const first = Math.ceil((lo / 100) * denom)
  const last = Math.floor((hi / 100) * denom)
  const ticks: number[] = []
  for (let i = first; i <= last && ticks.length < 400; i++)
    ticks.push((i / denom) * 100)

  const nearest = ticks.reduce(
    (best, t) =>
      Math.abs(t - REPORTED) < Math.abs(best - REPORTED) ? t : best,
    ticks[0] ?? 0
  )
  const gap = Math.abs(nearest - REPORTED)
  const reachable = gap < 0.05

  const x = (v: number) => ((v - lo) / (hi - lo)) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">
          convention
        </span>
        {(["mean", "best"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={m === mode}
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-xs transition-colors",
              m === mode
                ? "border-foreground/40 bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {m === "mean" ? "mean-of-k" : "best-of-k"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <label
          htmlFor="lattice-k"
          className="font-mono text-xs text-muted-foreground"
        >
          k = {k}
        </label>
        <Range
          id="lattice-k"
          min={1}
          max={10}
          step={1}
          value={k}
          onChange={(e) => setK(Number(e.currentTarget.value))}
          className="min-w-40 flex-1"
        />
        <span className="font-mono text-xs text-muted-foreground">
          {denom.toLocaleString()} outcomes · step {step.toFixed(3)} pt
        </span>
      </div>

      <div className="px-4 pt-5 pb-2">
        <div className="relative h-16">
          {/* lattice */}
          <div
            className="absolute inset-x-0 top-8 h-px bg-border"
            aria-hidden
          />
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-5 h-6 w-px bg-muted-foreground/45"
              style={{ left: `${x(t).toFixed(4)}%` }}
              aria-hidden
            />
          ))}
          {/* the printed score */}
          <span
            className="absolute top-1 h-14 w-0.5 bg-[var(--hg-accent,oklch(0.72_0.15_195))]"
            style={{ left: `${x(REPORTED).toFixed(4)}%` }}
            aria-hidden
          />
          <span
            className="absolute top-0 -translate-x-1/2 font-mono text-xs whitespace-nowrap text-[var(--hg-accent,oklch(0.72_0.15_195))]"
            style={{ left: `${x(REPORTED).toFixed(4)}%` }}
          >
            33.0
          </span>
          <span
            className="absolute top-11 -translate-x-1/2 font-mono text-xs whitespace-nowrap text-muted-foreground"
            style={{ left: `${x(BASE).toFixed(4)}%` }}
          >
            29.0
          </span>
          <span
            className="absolute top-5 h-6 w-px bg-muted-foreground"
            style={{ left: `${x(BASE).toFixed(4)}%` }}
            aria-hidden
          />
        </div>
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          <span>{lo}</span>
          <span>{hi}</span>
        </div>
      </div>

      <div className="border-t px-4 py-3 font-mono text-xs">
        <span className="text-foreground">
          nearest reachable score: {nearest.toFixed(3)}
        </span>
        <span className="text-muted-foreground">
          {" "}
          · {gap < 0.001 ? "exact" : `${gap.toFixed(3)} pt from 33.0`} ·{" "}
          {reachable
            ? "prints as 33.0"
            : "cannot print as 33.0 — this k and convention are ruled out"}
        </span>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        66 tasks, the full Terminal-Bench 4.0 set. Ticks are the scores the
        denominator admits; the accent line is the score Tinfield 1 prints.
        Under best-of-5 the closest reachable values are 31.82 and 33.33.
      </figcaption>
    </figure>
  )
}
