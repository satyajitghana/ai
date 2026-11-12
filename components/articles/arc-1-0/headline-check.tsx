"use client"

import { useState } from "react"

import { HEADLINE_QUALITY, PREFER_LOCAL, SAGE, type Row } from "./data"

// "97.5% of Opus 5.5's quality": the card says quality "averages per-benchmark ratios". This recomputes that
// average four ways from the card's own two tables, so a reader can see which (if any) lands on the headline.

type Method = { id: string; label: string; table: Row[]; f: (rows: Row[]) => number; note: string }

const meanRatio = (rows: Row[]) => (rows.reduce((s, r) => s + r.arc / r.opus, 0) / rows.length) * 100
const cappedRatio = (rows: Row[]) => (rows.reduce((s, r) => s + Math.min(1, r.arc / r.opus), 0) / rows.length) * 100
const ratioOfMeans = (rows: Row[]) => (rows.reduce((s, r) => s + r.arc, 0) / rows.reduce((s, r) => s + r.opus, 0)) * 100

const METHODS: Method[] = [
  { id: "pl-mean", label: "prefer-local · mean of ratios", table: PREFER_LOCAL, f: meanRatio, note: "What the card says it does, on the table it says the headline comes from." },
  { id: "pl-cap", label: "prefer-local · ratios capped at 100%", table: PREFER_LOCAL, f: cappedRatio, note: "Beating Opus on a benchmark earns nothing; only shortfalls count." },
  { id: "pl-pool", label: "prefer-local · ratio of means", table: PREFER_LOCAL, f: ratioOfMeans, note: "Pool the success rates first, then divide." },
  { id: "sage-mean", label: "Sage · mean of ratios", table: SAGE, f: meanRatio, note: "The same rule on the cloud-only Sage table, which the headline does not cite." },
]

export function HeadlineCheck() {
  const [id, setId] = useState("pl-mean")
  const m = METHODS.find((x) => x.id === id) ?? METHODS[0]
  const value = m.f(m.table)
  const gap = value - HEADLINE_QUALITY

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">&quot;97.5% of Opus quality&quot;, recomputed from the card</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Averaging method">
          {METHODS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              aria-pressed={id === x.id}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] ${id === x.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="font-mono text-sm">
          {value.toFixed(1)}% <span className="text-muted-foreground">against the headline&apos;s {HEADLINE_QUALITY}% ({gap >= 0 ? "+" : "−"}{Math.abs(gap).toFixed(1)} points)</span>
        </p>
        <p className="text-xs text-muted-foreground">{m.note}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">Benchmark</th>
                <th className="py-1 pr-2 text-right font-normal">Opus 5.5</th>
                <th className="py-1 pr-2 text-right font-normal">ARC</th>
                <th className="py-1 pr-2 text-right font-normal">ratio</th>
                <th className="py-1 text-right font-normal">cost / Opus</th>
              </tr>
            </thead>
            <tbody>
              {m.table.map((r) => {
                const ratio = (r.arc / r.opus) * 100
                return (
                  <tr key={r.bench} className="border-t border-border/50">
                    <td className="py-1 pr-2">{r.bench}</td>
                    <td className="py-1 pr-2 text-right font-mono">{r.opus.toFixed(1)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{r.arc.toFixed(1)}</td>
                    <td className={`py-1 pr-2 text-right font-mono ${ratio < 97 ? "text-red-600 dark:text-red-400" : ""}`}>{ratio.toFixed(1)}%</td>
                    <td className="py-1 text-right font-mono">{r.cost}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Success and cost are the card&apos;s tables; the ratios and averages are arithmetic on them. The Opus 5.5 column differs between the two tables on Terminal-Bench 2.1 and GPQA Diamond.
        </p>
      </div>
    </figure>
  )
}
