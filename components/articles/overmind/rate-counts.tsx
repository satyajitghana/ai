"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Rates from Overmind's "When bigger isn't better" research post (contract clause
// detection chart, "Show data" table). Overmind gives the set only as "4,000+
// questions across 100+ contracts" and never the exact count, so n is a control.
// 4,182 is the size of CUAD's test split (102 contracts x 41 clause categories),
// which the description matches; that identification is my inference.
// Counts are rate x n; intervals are Wilson 95% (z = 1.96), using only
// + - * / and sqrt, which are exact on every engine.

const MODELS = [
  { name: "Overmind SFT", fab: 0.12, fa: 0.65, ours: true },
  { name: "Base model", fab: 3.36, fa: 2.46, ours: false },
  { name: "Frontier flagship", fab: 3.36, fa: 10.01, ours: false },
  { name: "Frontier mid-tier", fab: 2.81, fa: 11.72, ours: false },
]

type Metric = "fab" | "fa"

function wilson(p: number, n: number): [number, number] {
  const z2 = 1.96 * 1.96
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (1.96 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return [Math.max(0, centre - half), centre + half]
}

const fmt = (x: number) => (x * 100).toFixed(2)

export function RateCounts() {
  const [n, setN] = useState(4182)
  const [metric, setMetric] = useState<Metric>("fab")
  const max = metric === "fab" ? 4.5 : 13.5

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">percent of questions → questions</span>
        <span className="font-mono text-[10px] text-muted-foreground">rates: Overmind&apos;s post · n: your choice</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["fab", "Fabricated quote"],
              ["fa", "False alarm"],
            ] as [Metric, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 font-mono text-[10px]">
            <span className="text-muted-foreground">questions</span>
            <Range
              min={4000}
              max={4400}
              step={1}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              aria-label="Number of questions in the eval"
              className="w-28"
            />
            <span className="w-10 tabular-nums">{n.toLocaleString("en-US")}</span>
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {MODELS.map((m) => {
            const rate = metric === "fab" ? m.fab : m.fa
            const p = rate / 100
            const [lo, hi] = wilson(p, n)
            const count = Math.round(p * n)
            return (
              <div key={m.name}>
                <div className="flex items-baseline justify-between font-mono text-[10px]">
                  <span className={m.ours ? "text-orange-600 dark:text-orange-400" : ""}>{m.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {rate.toFixed(2)}% ≈ <span className="text-foreground">{count}</span> questions · 95% CI{" "}
                    {fmt(lo)}–{fmt(hi)}%
                  </span>
                </div>
                <div className="relative mt-1 h-4 rounded-sm bg-muted/40">
                  <div
                    className="absolute top-1 h-2 rounded-sm bg-foreground/15"
                    style={{ left: `${((lo * 100) / max) * 100}%`, width: `${(((hi - lo) * 100) / max) * 100}%` }}
                  />
                  <div
                    className={cn("absolute top-0 h-4 w-1 rounded-sm", m.ours ? "bg-orange-500" : "bg-foreground/60")}
                    style={{ left: `${(rate / max) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Both rates are per question, over every question, including those whose clause is absent and the right
          answer is to quote nothing. At 4,182 questions the fine-tune&apos;s 0.12% is about five fabricated quotes
          against about 140 for the flagship, and the intervals do not overlap. What no chart gives is the miss rate:
          how often a model said a clause was absent when it was there.
        </figcaption>
      </div>
    </figure>
  )
}
