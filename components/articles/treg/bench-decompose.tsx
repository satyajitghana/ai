"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the "% answered correctly" bars on treg.to/people-search are made of.
// The three per-category dimensions for Lessie, Exa, Claude Code and Juicebox
// are LessieAI/people-search-bench's data/scores/<platform>/summary.json
// (commit f1afbb9). Each bar treg's page shows for a competitor is the plain mean
// of the three, which is how the benchmark defines "overall". treg's own four
// numbers (80.0, 78.2, 76.3, 62.9) are hard-coded in treg's people-search.html
// and routers/web.py; no per-dimension breakdown, run log or submission for them
// exists in either repository, so the widget can show them only as a total.
//
// Pure function of the controls.

type Dims = [number, number, number] // relevance precision, effective coverage, information utility

type Cat = "recruiting" | "b2b" | "deterministic" | "influencer"

const CATS: { key: Cat; label: string; treg: number }[] = [
  { key: "recruiting", label: "Recruiting", treg: 80.0 },
  { key: "b2b", label: "B2B prospecting", treg: 78.2 },
  { key: "deterministic", label: "Deterministic", treg: 76.3 },
  { key: "influencer", label: "Influencer", treg: 62.9 },
]

const PLATFORMS: { name: string; onTregPage: boolean; dims: Record<Cat, Dims> }[] = [
  {
    name: "Lessie",
    onTregPage: true,
    dims: {
      recruiting: [74.8, 75.6, 54.3],
      b2b: [62.8, 63.5, 55.5],
      deterministic: [79.0, 75.2, 57.1],
      influencer: [65.2, 62.8, 58.9],
    },
  },
  {
    name: "Exa",
    onTregPage: true,
    dims: {
      recruiting: [66.2, 73.8, 54.0],
      b2b: [50.0, 58.5, 57.0],
      deterministic: [61.6, 69.0, 52.9],
      influencer: [37.4, 39.3, 48.0],
    },
  },
  {
    name: "Claude Code",
    onTregPage: true,
    dims: {
      recruiting: [59.0, 46.7, 45.8],
      b2b: [43.0, 42.3, 43.6],
      deterministic: [69.6, 62.9, 38.5],
      influencer: [46.9, 39.3, 43.4],
    },
  },
  {
    name: "Juicebox",
    onTregPage: false,
    dims: {
      recruiting: [66.1, 75.3, 55.8],
      b2b: [46.1, 52.7, 55.4],
      deterministic: [39.0, 46.9, 46.8],
      influencer: [26.6, 22.8, 44.0],
    },
  },
]

const DIM_LABEL = ["nDCG@10", "coverage", "utility"]
const DIM_COLOR = ["bg-sky-500/70", "bg-violet-500/70", "bg-amber-500/70"]

const mean = (d: Dims) => (d[0] + d[1] + d[2]) / 3

export function BenchDecompose() {
  const [cat, setCat] = useState<Cat>("b2b")
  const [showJuicebox, setShowJuicebox] = useState(false)
  const c = CATS.find((x) => x.key === cat)!
  const rows = PLATFORMS.filter((p) => p.onTregPage || showJuicebox)
    .map((p) => ({ name: p.name, dims: p.dims[cat], total: mean(p.dims[cat]), onTregPage: p.onTregPage }))
    .sort((a, b) => b.total - a.total)

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {CATS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setCat(x.key)}
            className={cn(
              "border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs",
              cat === x.key && "bg-muted font-semibold",
            )}
          >
            {x.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs">
          <input type="checkbox" checked={showJuicebox} onChange={(e) => setShowJuicebox(e.target.checked)} />
          <span>Juicebox (in the benchmark, left off treg&apos;s chart)</span>
        </label>
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-xs">
          <span className="font-semibold">treg</span>
          <div className="bg-muted relative h-5 overflow-hidden rounded">
            <div
              className="h-full rounded bg-emerald-600/70"
              style={{ width: `${c.treg.toFixed(1)}%` }}
            />
            <span className="text-foreground absolute inset-y-0 left-2 flex items-center font-mono text-[10px]">
              total only: no breakdown published
            </span>
          </div>
          <span className="text-right font-mono">{c.treg.toFixed(1)}</span>
        </div>
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-xs">
            <span className={cn(!r.onTregPage && "text-muted-foreground")}>{r.name}</span>
            <div className="bg-muted flex h-5 overflow-hidden rounded">
              {r.dims.map((d, i) => (
                <div
                  key={i}
                  className={cn("h-full", DIM_COLOR[i])}
                  style={{ width: `${(d / 3).toFixed(2)}%` }}
                  title={`${DIM_LABEL[i]} ${d.toFixed(1)}`}
                />
              ))}
            </div>
            <span className="text-right font-mono">{r.total.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap gap-3 text-[11px]">
        {DIM_LABEL.map((l, i) => (
          <span key={l} className="flex items-center gap-1">
            <i className={cn("inline-block h-2.5 w-2.5 rounded-sm", DIM_COLOR[i])} />
            {l} ÷ 3
          </span>
        ))}
      </div>

      <figcaption className="text-muted-foreground mt-3 text-xs">
        Each competitor bar is the mean of three 0-100 scores from LessieAI&apos;s published{" "}
        <code>summary.json</code>: padded nDCG@10, effective coverage and information utility. None of them is a
        percentage of tasks answered correctly, which is how treg&apos;s page labels the chart. treg&apos;s own bar
        appears in neither repository with its components or a run log.
      </figcaption>
    </figure>
  )
}
