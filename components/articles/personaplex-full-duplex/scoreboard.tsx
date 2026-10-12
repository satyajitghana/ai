"use client"

import { useState } from "react"

// Full-Duplex-Bench as the PersonaPlex paper reports it (arXiv 2602.06053v1).
// Baseline rows and the experimental PersonaPlex row: Table 2. Released
// checkpoint row: Table 6, identical to the Hugging Face model card's table.
// Every number is the paper's own run; the paper notes that Qwen-2.5-Omni was
// evaluated with Freeze-Omni's VAD because none was provided. "In the chart"
// marks the columns that feed the model card's three bar charts
// (figures/results_*.png); the backchannel columns appear in the tables only.

type Col = { id: string; group: string; label: string; lower: boolean; inChart: boolean }

const COLS: Col[] = [
  { id: "pSyn", group: "Pause", label: "synthetic TOR", lower: true, inChart: true },
  { id: "pCan", group: "Pause", label: "Candor TOR", lower: true, inChart: true },
  { id: "bcTor", group: "Backchannel", label: "TOR", lower: true, inChart: false },
  { id: "bcFreq", group: "Backchannel", label: "freq", lower: false, inChart: false },
  { id: "bcJsd", group: "Backchannel", label: "JSD", lower: true, inChart: false },
  { id: "sttTor", group: "Turn taking", label: "TOR", lower: false, inChart: true },
  { id: "sttLat", group: "Turn taking", label: "latency s", lower: true, inChart: true },
  { id: "uiTor", group: "Interruption", label: "TOR", lower: false, inChart: true },
  { id: "uiGpt", group: "Interruption", label: "GPT-4o", lower: false, inChart: true },
  { id: "uiLat", group: "Interruption", label: "latency s", lower: true, inChart: true },
]

type Row = { name: string; vals: (number | null)[] }

const PAPER: Row = { name: "PersonaPlex (paper, Table 2)", vals: [0.584, 0.662, 0.327, 0.025, 0.649, 0.992, 0.07, 1.0, 4.21, 0.4] }
const RELEASED: Row = { name: "PersonaPlex (released, Table 6)", vals: [0.358, 0.431, 0.273, 0.042, 0.662, 0.908, 0.17, 0.95, 4.29, 0.24] }

const BASE: Row[] = [
  { name: "Qwen-2.5-Omni", vals: [null, null, null, null, null, null, null, null, 4.59, 2.74] },
  { name: "Freeze-Omni", vals: [0.642, 0.481, 0.636, 0.001, 0.997, 0.336, 0.953, 0.867, 3.615, 1.409] },
  { name: "Gemini Live", vals: [0.255, 0.31, 0.091, 0.012, 0.896, 0.655, 1.301, 0.891, 3.376, 1.183] },
  { name: "Moshi", vals: [0.985, 0.98, 1.0, 0.001, 0.957, 0.941, 0.265, 1.0, 0.765, 0.257] },
  { name: "dGSLM", vals: [0.934, 0.935, 0.691, 0.015, 0.934, 0.975, 0.352, 0.917, 0.201, 2.531] },
]

function bestIn(rows: Row[], c: number, lower: boolean) {
  const vs = rows.map((r) => r.vals[c]).filter((v): v is number => v !== null)
  return lower ? Math.min(...vs) : Math.max(...vs)
}

function fmt(v: number) {
  return v.toFixed(3)
}

export function Scoreboard() {
  const [which, setWhich] = useState<"released" | "paper">("released")
  const [onlyChart, setOnlyChart] = useState(false)
  const pp = which === "released" ? RELEASED : PAPER
  const rows = [pp, ...BASE]
  const cols = COLS.map((c, idx) => ({ ...c, idx })).filter((c) => !onlyChart || c.inChart)

  const winners = cols.map((c) => {
    const b = bestIn(rows, c.idx, c.lower)
    return rows.filter((r) => r.vals[c.idx] === b).map((r) => r.name)
  })
  const ppWins = winners.filter((w) => w.includes(pp.name)).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Full-Duplex-Bench, every column the paper reports</span>
        <span className="font-mono text-[10px] text-muted-foreground">paper Tables 2 and 6 (self-run)</span>
      </div>

      <div className="flex flex-wrap gap-2 px-3 pt-3 sm:px-4">
        {(["released", "paper"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWhich(w)}
            aria-pressed={which === w}
            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              which === w ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            {w === "released" ? "released checkpoint" : "paper's experimental model"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOnlyChart((v) => !v)}
          aria-pressed={onlyChart}
          className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
            onlyChart ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
          }`}
        >
          {onlyChart ? "showing the card's chart columns" : "show only the card's chart columns"}
        </button>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr>
              <th className="py-1 pr-2 text-left font-normal text-muted-foreground">model</th>
              {cols.map((c) => (
                <th key={c.id} className="px-1.5 py-1 text-right align-bottom font-normal leading-tight text-muted-foreground">
                  <div>{c.group}</div>
                  <div>
                    {c.label} {c.lower ? "↓" : "↑"}
                  </div>
                  {!c.inChart ? <div className="text-[9px] text-amber-700 dark:text-amber-400">not charted</div> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.name} className={`border-t ${ri === 0 ? "font-semibold" : ""}`}>
                <td className="whitespace-nowrap py-1 pr-2">{r.name}</td>
                {cols.map((c, ci) => {
                  const v = r.vals[c.idx]
                  const win = winners[ci].includes(r.name)
                  return (
                    <td
                      key={c.id}
                      className={`px-1.5 py-1 text-right tabular-nums ${win ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-50" : ""}`}
                    >
                      {v === null ? "–" : fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 px-3 pb-3 text-sm sm:px-4">
        <p>
          {pp.name.split(" (")[0]} ({which === "released" ? "released" : "paper"}) is best, or tied for best, in{" "}
          <strong>
            {ppWins} of {cols.length}
          </strong>{" "}
          columns shown. Green marks the best value in each column.
        </p>
        <p className="text-xs text-muted-foreground">
          TOR is takeover rate: how often the model takes the turn. Lower is right for pauses and backchannels, higher for turn ends and interruptions. A model that always grabs the floor scores 1.000 on the interruption
          TOR and can still answer badly, which is why Moshi&rsquo;s 1.000 sits next to a GPT-4o score of 0.765.
        </p>
      </div>
    </figure>
  )
}
