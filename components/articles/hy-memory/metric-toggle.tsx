"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { HARNESSES, MATRIX, METRICS } from "./data"

// Recompute the paper's headline from its own per-metric tables (arXiv
// 2610.22196, Tables 7-10): each harness score is the equal-weight mean of the
// metrics you keep, the overall is the mean of the four harnesses. Untick a
// metric to see how much of the lead over Claude Opus 5 it carries.

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

export function MetricToggle() {
  const [on, setOn] = useState<boolean[]>(() => METRICS.map(() => true))
  const idx = METRICS.map((_, k) => k).filter((k) => on[k])

  const rows = HARNESSES.map((h) => {
    const m = MATRIX[h.key]
    const hy = mean(idx.map((k) => m.hy[k]))
    const opus = mean(idx.map((k) => m.opus[k]))
    return { ...h, hy, opus, d: hy - opus }
  })
  const hyAll = mean(rows.map((r) => r.hy))
  const opusAll = mean(rows.map((r) => r.opus))
  const lead = hyAll - opusAll

  let wins = 0
  let losses = 0
  let ties = 0
  for (const h of HARNESSES) {
    for (const k of idx) {
      const a = MATRIX[h.key].hy[k]
      const b = MATRIX[h.key].opus[k]
      if (a > b) wins++
      else if (a < b) losses++
      else ties++
    }
  }

  const span = 4
  const pos = (d: number) => `${(50 + (Math.max(-span, Math.min(span, d)) / span) * 50).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the paper&apos;s Tables 7-10, recomputed: Hy-Memory-30B-A3B minus Claude Opus 5, per harness
      </div>

      <div className="flex flex-wrap gap-2 border-b p-3" role="group" aria-label="Metrics in the average">
        {METRICS.map((m, k) => (
          <button
            key={m}
            type="button"
            aria-pressed={on[k]}
            onClick={() => setOn((o) => (o.filter(Boolean).length === 1 && o[k] ? o : o.map((x, j) => (j === k ? !x : x))))}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              on[k] ? "bg-foreground text-background" : "text-muted-foreground line-through hover:bg-muted"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="grid gap-2 p-3">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 font-mono text-[11px]">
            <span>
              {r.label}
              {r.heldOut ? <span className="text-muted-foreground"> (held out)</span> : null}
            </span>
            <div className="relative h-4 rounded-sm bg-muted">
              <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
              <div
                className={cn("absolute inset-y-0.5 rounded-sm", r.d >= 0 ? "bg-sky-600" : "bg-amber-600")}
                style={r.d >= 0 ? { left: "50%", right: `calc(100% - ${pos(r.d)})` } : { left: pos(r.d), right: "50%" }}
              />
            </div>
            <span className={cn("text-right", r.d >= 0 ? "text-sky-700 dark:text-sky-400" : "text-amber-700 dark:text-amber-400")}>
              {r.d >= 0 ? "+" : ""}
              {r.d.toFixed(2)}
            </span>
          </div>
        ))}
        <div className="grid grid-cols-[6.5rem_1fr_4.5rem] gap-2 font-mono text-[10px] text-muted-foreground">
          <span />
          <div className="flex justify-between">
            <span>Opus 5 ahead</span>
            <span>Hy-Memory ahead</span>
          </div>
          <span />
        </div>
      </div>

      <figcaption className="grid gap-1 border-t px-3 py-2 font-mono text-[11px]">
        <span>
          overall: Hy-Memory-30B-A3B <strong>{hyAll.toFixed(2)}</strong>, Opus 5 <strong>{opusAll.toFixed(2)}</strong> ·{" "}
          <span className={lead >= 0 ? "text-sky-700 dark:text-sky-400" : "text-amber-700 dark:text-amber-400"}>
            {lead >= 0 ? "Hy-Memory leads by " : "Opus 5 leads by "}
            {Math.abs(lead).toFixed(2)}
          </span>
        </span>
        <span className="text-muted-foreground">
          cells kept: {wins} won, {losses} lost, {ties} tied. Bars are clipped at ±{span} points. With all six metrics on, this
          reproduces the paper&apos;s 55.49 and 54.62 to rounding.
        </span>
      </figcaption>
    </figure>
  )
}
