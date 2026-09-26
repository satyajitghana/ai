"use client"

import { useState } from "react"

// Two honest averages of the same twelve rows. BottleCap's headline, 37.2%, is
// the mean of the per-benchmark reductions: every benchmark counts once, so
// MMMLU (1,656 thinking tokens) weighs as much as Terminal-Bench 2.1 (72,871).
// Pool the tokens instead (ratio of the mean columns) and the reduction is
// 22.8%, because the longest-running rows shrink least. Neither is wrong; they
// answer different questions. Rows are copied from the blog post's table
// (mean thinking tokens, xhigh, base -> ThinkingCap, and the accuracy delta).

const ROWS = [
  { name: "AIME 2026", base: 15663, tc: 10934, dAcc: -3.85 },
  { name: "HMMT Feb 2026", base: 23211, tc: 18099, dAcc: -1.14 },
  { name: "HMMT Nov 2025", base: 14443, tc: 10037, dAcc: -1.04 },
  { name: "GPQA-Diamond", base: 12772, tc: 7267, dAcc: -1.89 },
  { name: "LiveCodeBench v6", base: 28395, tc: 22645, dAcc: 0.07 },
  { name: "MMLU-Pro", base: 3725, tc: 1591, dAcc: -0.86 },
  { name: "MMMLU", base: 1656, tc: 571, dAcc: -1.29 },
  { name: "IFBench", base: 7961, tc: 4266, dAcc: -0.04 },
  { name: "RealWorldQA", base: 992, tc: 492, dAcc: -0.92 },
  { name: "AA-LCR", base: 2550, tc: 1565, dAcc: 2.25 },
  { name: "τ²-bench", base: 4584, tc: 3168, dAcc: -1.01 },
  { name: "Terminal-Bench 2.1", base: 72871, tc: 65092, dAcc: -0.56 },
]

const SUM_BASE = ROWS.reduce((s, r) => s + r.base, 0)
const SUM_TC = ROWS.reduce((s, r) => s + r.tc, 0)
const MAX_BASE = Math.max(...ROWS.map((r) => r.base))
const MACRO = ROWS.reduce((s, r) => s + (r.base - r.tc) / r.base, 0) / ROWS.length
const POOLED = (SUM_BASE - SUM_TC) / SUM_BASE

const GREY = "oklch(0.62 0.02 250)"
const TEAL = "oklch(0.62 0.14 175)"

type Mode = "bench" | "token"

export function TokenWeights() {
  const [mode, setMode] = useState<Mode>("bench")
  const headline = mode === "bench" ? MACRO : POOLED

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          ThinkingCap vs Qwen3.8-27B · mean thinking tokens at xhigh
        </span>
        <div className="flex gap-1.5" role="group" aria-label="averaging mode">
          <button
            type="button"
            aria-pressed={mode === "bench"}
            onClick={() => setMode("bench")}
            className={
              "rounded-md border px-2 py-0.5 font-mono text-[11px] " +
              (mode === "bench" ? "bg-foreground/10 text-foreground" : "text-muted-foreground")
            }
          >
            each benchmark counts once
          </button>
          <button
            type="button"
            aria-pressed={mode === "token"}
            onClick={() => setMode("token")}
            className={
              "rounded-md border px-2 py-0.5 font-mono text-[11px] " +
              (mode === "token" ? "bg-foreground/10 text-foreground" : "text-muted-foreground")
            }
          >
            each token counts once
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-baseline gap-3">
          <span className="font-mono text-3xl font-semibold tabular-nums" style={{ color: TEAL }}>
            −{(100 * headline).toFixed(1)}%
          </span>
          <span className="font-mono text-[11px] leading-snug text-muted-foreground">
            {mode === "bench"
              ? "mean of the twelve per-benchmark reductions (the headline)"
              : "total thinking tokens across the twelve mean rows, pooled"}
          </span>
        </div>

        <div className="space-y-1">
          {ROWS.map((r) => {
            const red = (r.base - r.tc) / r.base
            const weight = mode === "bench" ? 1 / ROWS.length : r.base / SUM_BASE
            return (
              <div key={r.name} className="grid grid-cols-[7.5rem_1fr_3.2rem_3.2rem] items-center gap-2 font-mono text-[10px] sm:grid-cols-[9rem_1fr_3.6rem_3.6rem] sm:text-[11px]">
                <span className="truncate text-foreground">{r.name}</span>
                <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-3 w-full" role="img" aria-label={`${r.name}: ${r.base} to ${r.tc} thinking tokens, ${(100 * red).toFixed(1)} percent fewer`}>
                  <rect x={0} y={0} width={(100 * r.base) / MAX_BASE} height={6} fill={GREY} opacity={0.35} />
                  <rect x={0} y={0} width={(100 * r.tc) / MAX_BASE} height={6} fill={TEAL} />
                </svg>
                <span className="text-right tabular-nums text-foreground">−{(100 * red).toFixed(1)}%</span>
                <span className="text-right tabular-nums text-muted-foreground" title="weight in the average">
                  {(100 * weight).toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-2 grid grid-cols-[7.5rem_1fr_3.2rem_3.2rem] gap-2 font-mono text-[10px] text-muted-foreground sm:grid-cols-[9rem_1fr_3.6rem_3.6rem]">
          <span />
          <span>grey: base · teal: ThinkingCap · common scale</span>
          <span className="text-right">cut</span>
          <span className="text-right">weight</span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Counted per benchmark, MMMLU&apos;s 65.5% cut and Terminal-Bench&apos;s 10.7% get the
        same vote. Counted per token, Terminal-Bench alone is{" "}
        {((100 * ROWS[11].base) / SUM_BASE).toFixed(1)}% of the weight and pulls the figure
        down to {(100 * POOLED).toFixed(1)}%. BottleCap&apos;s card states which one its
        headline is.
      </figcaption>
    </figure>
  )
}
