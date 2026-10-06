"use client"

import { useState } from "react"

// Table 5 and Table 6 of the RSR paper, as reported. Three views:
//  - pass@3 (three attempts per task, any pass counts),
//  - mean per-run pass rate over the same three runs,
//  - the base model with no training, run once under each discovery harness
//    (Table 6), which is the yardstick the training gains should be read
//    against.
// All numbers are the paper's; nothing here is re-run.

type Row = { bench: string; n: number; vals: number[] }
type View = {
  id: string
  label: string
  series: string[]
  rows: Row[]
  note: string
}

const TRAIN = ["Base", "Direct SFT", "RSR"]

const VIEWS: View[] = [
  {
    id: "p3",
    label: "pass@3",
    series: TRAIN,
    rows: [
      { bench: "TB 2", n: 89, vals: [57.0, 53.4, 74.2] },
      { bench: "TB 3", n: 74, vals: [0.0, 5.4, 9.5] },
      { bench: "TB 4", n: 66, vals: [1.5, 4.5, 9.1] },
      { bench: "TBH", n: 100, vals: [39.0, 56.0, 63.0] },
      { bench: "SWR100", n: 100, vals: [3.0, 3.0, 6.0] },
    ],
    note: "All three models evaluated under plain Terminus 2. Direct SFT on the raw multi-harness successes loses 3.6 points on TB 2; RSR gains 17.2 over Base.",
  },
  {
    id: "mean",
    label: "mean of 3 runs",
    series: TRAIN,
    rows: [
      { bench: "TB 2", n: 89, vals: [51.7, 43.8, 70.1] },
      { bench: "TB 3", n: 74, vals: [0.0, 1.4, 6.8] },
      { bench: "TB 4", n: 66, vals: [0.0, 3.2, 6.1] },
      { bench: "TBH", n: 100, vals: [31.0, 42.5, 54.0] },
      { bench: "SWR100", n: 100, vals: [3.0, 3.0, 5.0] },
    ],
    note: "The per-run mean is the closer match to a single deployment. On TB 2 Direct SFT falls 7.9 points below Base; RSR sits 18.4 above it.",
  },
  {
    id: "harness",
    label: "base model, harness swapped",
    series: ["Terminus 2", "RSRT", "StateM", "Union"],
    rows: [
      { bench: "TB 2", n: 89, vals: [51.7, 55.1, 58.4, 68.5] },
      { bench: "TBH", n: 100, vals: [33.0, 66.0, 46.0, 70.0] },
      { bench: "TB 3", n: 74, vals: [0.0, 4.1, 1.3, 4.3] },
    ],
    note: "No training at all, one run each (Table 6). The untrained model under RSRT scores 66.0 on TBH, above the trained RSR model's 54.0 mean and 63.0 pass@3 under Terminus 2. The table prints the TB 3 union as 4.3% of 74 with 3 tasks; 3 of 74 is 4.1%.",
  },
]

const COLORS = [
  "oklch(0.62 0.02 260)",
  "oklch(0.66 0.14 60)",
  "oklch(0.58 0.15 250)",
  "oklch(0.60 0.15 150)",
]

export function ResultsBoard() {
  const [v, setV] = useState("p3")
  const view = VIEWS.find((x) => x.id === v) ?? VIEWS[0]
  const max = Math.max(...view.rows.flatMap((r) => r.vals), 1)
  const top = Math.ceil(max / 10) * 10

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">
          Qwen-3.8-27B on terminal benchmarks
        </div>
        <div className="font-mono text-xs text-muted-foreground">reported · paper Tables 5 and 6</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {VIEWS.map((x) => {
          const on = x.id === v
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              onClick={() => setV(x.id)}
              className="rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors"
              style={{
                background: on ? COLORS[2] : "transparent",
                borderColor: on ? COLORS[2] : undefined,
                color: on ? "white" : undefined,
              }}
            >
              {x.label}
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {view.series.map((s, k) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] }} />
            {s}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {view.rows.map((r) => (
          <div key={r.bench}>
            <div className="mb-1 font-mono text-xs">
              {r.bench} <span className="text-muted-foreground">({r.n} tasks)</span>
            </div>
            <div className="space-y-1">
              {r.vals.map((val, k) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="h-3 flex-1 rounded-sm bg-muted">
                    <div
                      className="h-3 rounded-sm"
                      style={{
                        width: `${((val / top) * 100).toFixed(2)}%`,
                        minWidth: val > 0 ? 2 : 0,
                        background: COLORS[k],
                      }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums">
                    {val.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{view.note}</p>
    </div>
  )
}
