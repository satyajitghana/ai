"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number here was measured by me on 2026-10-23, on a shared 4-core Xeon
// @ 2.10 GHz cloud VM (16 GB, CPU only, load average 5 to 11 from other jobs),
// in headless Chromium 141.0.7390.37 driven by puppeteer-core. Versions:
// ondine@0.0.3, pele@1.6.0, mermaid@12.1.0, all from npm, bundled with esbuild
// and served from localhost. Each library and diagram got a fresh browser
// context: five warm-up renders, then 31 timed batches, each batch sized to run
// at least 20 ms (Mermaid: one async render per batch). "first render" is the
// median of five fresh contexts, from loading the library to the first SVG.
// "ondine" is the per-type size-optimized WebAssembly module a browser would
// load; "ondine fast" is the all-types speed-optimized module that Node uses.
// "native" is the same compiler built from source (rustc 1.97.0, release, fat
// LTO) and called from a small Rust harness: median of 31 batches, and the
// first render of a fresh process (median of 11 processes).

type Lane = "pele" | "ondine" | "fast" | "mermaid"
type Cell = [med: number, best: number, cold: number]
type Pass = Record<string, Record<Lane, Cell>>

const DIAGRAMS: { id: string; label: string }[] = [
  { id: "flowchart-small", label: "flowchart, 5 nodes" },
  { id: "flowchart-large", label: "flowchart, 100 nodes" },
  { id: "sequence", label: "sequence" },
  { id: "class", label: "class" },
  { id: "state", label: "state" },
  { id: "gantt", label: "gantt" },
  { id: "pie", label: "pie" },
  { id: "er", label: "entity relationship" },
]

const PASSES: Pass[] = [
  {
    "flowchart-small": { pele: [0.2931, 0.1207, 671.2], ondine: [0.3824, 0.1324, 293.8], fast: [0.1489, 0.1122, 307.8], mermaid: [64.6, 47.4, 3939] },
    "flowchart-large": { pele: [7.15, 3.8, 538.6], ondine: [7.5, 3.3, 169.7], fast: [9.25, 3.15, 296.9], mermaid: [811.1, 684.4, 2609] },
    sequence: { pele: [0.1176, 0.06081, 360], ondine: [0.1383, 0.06296, 188.7], fast: [0.1006, 0.05145, 304.3], mermaid: [30.1, 28.2, 758.9] },
    class: { pele: [0.5538, 0.2, 85.8], ondine: [0.2294, 0.1191, 161.4], fast: [0.2049, 0.123, 294.5], mermaid: [138.1, 116.4, 1414] },
    state: { pele: [0.6214, 0.2857, 79.9], ondine: [0.3407, 0.213, 40.4], fast: [0.2203, 0.1676, 146.7], mermaid: [135.9, 104.1, 878.2] },
    gantt: { pele: [0.1215, 0.06923, 54.5], ondine: [0.2129, 0.1257, 31.9], fast: [0.1219, 0.08021, 75.4], mermaid: [11, 9.6, 188.6] },
    pie: { pele: [0.03665, 0.02919, 52.7], ondine: [0.0587, 0.03043, 16.3], fast: [0.03932, 0.01823, 127.2], mermaid: [7.8, 6.2, 359] },
    er: { pele: [0.3607, 0.1179, 96.9], ondine: [0.2344, 0.1141, 39.9], fast: [0.165, 0.1138, 99.9], mermaid: [84.2, 62.3, 780.7] },
  },
  {
    "flowchart-small": { pele: [0.3577, 0.1308, 99], ondine: [0.1879, 0.1052, 41.5], fast: [0.1602, 0.09659, 112.8], mermaid: [59.7, 45.7, 837] },
    "flowchart-large": { pele: [5.067, 3.467, 144.7], ondine: [4.75, 3.25, 77.6], fast: [4.6, 3.133, 531.9], mermaid: [751.5, 647, 2049] },
    sequence: { pele: [0.1643, 0.0619, 245.9], ondine: [0.1067, 0.06404, 96.8], fast: [0.09571, 0.03558, 222.4], mermaid: [35.8, 28.3, 538.6] },
    class: { pele: [0.4, 0.172, 347.7], ondine: [0.1767, 0.1267, 130.9], fast: [0.1444, 0.09697, 237.1], mermaid: [144, 118, 1585] },
    state: { pele: [0.4308, 0.2769, 316.7], ondine: [0.2019, 0.163, 148.4], fast: [0.3075, 0.1567, 243.3], mermaid: [107.8, 101, 1422] },
    gantt: { pele: [0.0931, 0.07241, 96.6], ondine: [0.1727, 0.1303, 33.5], fast: [0.1193, 0.06897, 135.8], mermaid: [12.4, 10.6, 216.6] },
    pie: { pele: [0.0386, 0.02895, 85.9], ondine: [0.03818, 0.02955, 26.6], fast: [0.03951, 0.01811, 71.7], mermaid: [7.8, 6.6, 342.9] },
    er: { pele: [0.3189, 0.1378, 77.6], ondine: [0.1417, 0.09667, 36.9], fast: [0.105, 0.07, 147.8], mermaid: [84.9, 62.1, 691.2] },
  },
]

// Native Rust, same compiler, same eight sources: [median, best, first render in a fresh process].
const NATIVE: Record<string, Cell> = {
  "flowchart-small": [0.04816, 0.04749, 0.273],
  "flowchart-large": [1.87069, 1.81903, 2.1872],
  sequence: [0.03366, 0.03201, 0.186],
  class: [0.07623, 0.06917, 0.2821],
  state: [0.10906, 0.1033, 0.3468],
  gantt: [0.04353, 0.04065, 0.1669],
  pie: [0.01404, 0.01352, 0.1374],
  er: [0.06556, 0.05653, 0.2448],
}

const METRICS = [
  { id: 0, label: "median render", note: "Warm renders, median of 31 batches. Compare Pele with either Ondine column." },
  { id: 1, label: "best render", note: "Fastest batch. Less sensitive to the other jobs on the machine than the median." },
  { id: 2, label: "first render", note: "Library load to first SVG, median of five fresh pages. The fast module is a 3.7 MB file to compile, so it starts slower." },
] as const

const COLUMNS: { id: Lane | "native"; label: string }[] = [
  { id: "pele", label: "Pele" },
  { id: "ondine", label: "Ondine" },
  { id: "fast", label: "Ondine fast" },
  { id: "native", label: "Ondine native" },
  { id: "mermaid", label: "Mermaid" },
]

function fmt(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)} µs`
  if (ms < 10) return `${ms.toFixed(2)} ms`
  return `${Math.round(ms)} ms`
}

export function OndineBench() {
  const [pass, setPass] = useState(1)
  const [metric, setMetric] = useState<0 | 1 | 2>(0)
  const data = PASSES[pass]
  const note = METRICS[metric].note

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          ondine@0.0.3 vs pele@1.6.0 vs mermaid@12.1.0 · Chromium 141 · same 8 diagrams
        </span>
        <div className="flex gap-1" role="group" aria-label="Benchmark pass">
          {[0, 1].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPass(p)}
              aria-pressed={pass === p}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[10px]",
                pass === p ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              pass {p + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Metric">
          {METRICS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setMetric(x.id)}
              aria-pressed={metric === x.id}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                metric === x.id ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="mt-2 mb-3 text-xs leading-5 text-muted-foreground">{note}</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse font-mono text-[11px] tabular-nums">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1.5 pr-2 text-left font-normal">diagram</th>
                {COLUMNS.map((c) => (
                  <th key={c.id} className="px-1.5 py-1.5 text-right font-normal">
                    {c.label}
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-right font-normal">Pele ÷ best Ondine</th>
              </tr>
            </thead>
            <tbody>
              {DIAGRAMS.map((d) => {
                const row = data[d.id]
                const browserBest = Math.min(row.ondine[metric], row.fast[metric])
                const ratio = row.pele[metric] / browserBest
                return (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-1.5 pr-2 text-left">{d.label}</td>
                    {COLUMNS.map((c) => {
                      const v = c.id === "native" ? NATIVE[d.id][metric] : row[c.id][metric]
                      const win = c.id !== "native" && c.id !== "mermaid" && c.id !== "pele" && v === browserBest && ratio > 1
                      const peleWin = c.id === "pele" && ratio < 1
                      return (
                        <td
                          key={c.id}
                          className={cn(
                            "px-1.5 py-1.5 text-right",
                            (win || peleWin) && "font-semibold text-foreground",
                            c.id === "native" && "text-muted-foreground",
                          )}
                        >
                          {fmt(v)}
                        </td>
                      )
                    })}
                    <td className={cn("py-1.5 pl-2 text-right", ratio < 1 ? "text-muted-foreground" : "text-foreground")}>
                      {ratio.toFixed(2)}×
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 mb-0 text-xs leading-5 text-muted-foreground">
          Bold marks the faster browser renderer of Pele and Ondine. The native column is Ondine&rsquo;s compiler called from
          Rust with no WebAssembly or JavaScript around it. Ondine does not ship that: its CLI and Node compiler run the
          fast WebAssembly module, so the column is a ceiling, not a product. Two passes on a machine shared with other jobs: where they disagree, neither is the answer.
        </p>
      </div>
    </figure>
  )
}
