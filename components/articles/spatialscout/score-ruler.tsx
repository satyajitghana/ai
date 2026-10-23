"use client"

// Table 3 of the SpatialScout paper next to a ruler made of synthetic maps.
// Model rows are REPORTED (paper Table 3, object-micro, 80 scenes, percent).
// Ruler rows are MEASURED: the released scorer (spatialscout/evaluation/iou.py)
// run on the 80 released ground-truth files with every centre jittered by
// isotropic Gaussian noise of the given sigma per axis (seed 0), full coverage,
// on a shared 4-core cloud VM, CPU only.
// Implied coverage C = all-target value / submitted value is REASONED; the
// paper's own Eq. 6 says it must be the same for all four columns.
//
// SSR-safe: plain state, no effects. Only + - * / and abs are used.

import { useState } from "react"

type Row = { name: string; all: number[]; sub?: number[]; ruler?: boolean }

const MODELS: Row[] = [
  { name: "Claude Opus 5.5", all: [41.71, 77.36, 47.23, 3.25], sub: [46.69, 86.6, 52.87, 3.64] },
  { name: "GPT-6 Astra (xhigh)", all: [33.16, 67.79, 35.15, 1.62], sub: [41.16, 83.86, 42.69, 2.09] },
  { name: "Claude Sonnet 5.5", all: [32.26, 67.13, 33.6, 1.4], sub: [38.99, 81.14, 40.61, 1.69] },
  { name: "GPT-6 Astra (medium)", all: [31.18, 67.73, 31.55, 1.27], sub: [37.16, 80.72, 37.6, 1.52] },
  { name: "GPT-6 Sol", all: [20.83, 51.85, 18.95, 0.48], sub: [28.65, 71.31, 26.06, 0.66] },
  { name: "Qwen3.8 Max", all: [6.8, 24.36, 4.52, 0], sub: [12.14, 43.49, 8.07, 0] },
  { name: "Kimi-K3", all: [4.22, 19.36, 2.77, 0], sub: [6.55, 30.03, 4.29, 0] },
  { name: "DeepSeek V4.1 Flash", all: [3.48, 19.04, 0.92, 0], sub: [5.8, 31.74, 1.54, 0] },
]

const RULER: Row[] = [
  { name: "every centre ±1 cm", all: [69.62, 94.33, 78.6, 31.85], ruler: true },
  { name: "every centre ±2 cm", all: [56.42, 87.99, 62.93, 13.57], ruler: true },
  { name: "every centre ±5 cm", all: [37.19, 74.87, 40.38, 2.29], ruler: true },
  { name: "every centre ±10 cm", all: [23.42, 59.71, 20.76, 0.48], ruler: true },
  { name: "every centre ±20 cm", all: [12.11, 43.6, 6.91, 0.03], ruler: true },
  { name: "all at the origin", all: [0.11, 1.37, 0.03, 0], ruler: true },
]

const COLS = ["mean IoU", "> 0", "> 0.5", "> 0.9"]
const MODEL_C = "oklch(0.58 0.13 250)"
const RULER_C = "oklch(0.66 0.02 250)"
const FLAG = "oklch(0.6 0.17 25)"

export function ScoreRuler() {
  const [col, setCol] = useState(0)
  const [showRuler, setShowRuler] = useState(true)

  const rows = [...MODELS, ...(showRuler ? RULER : [])].sort((a, b) => b.all[col] - a.all[col])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>all-target scores, 80 scenes, 3,140 targets</span>
        <span className="text-muted-foreground/70">models reported (Table 3) · ruler measured</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Column">
          {COLS.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => setCol(i)}
              aria-pressed={i === col}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${i === col ? "border-foreground/40 bg-muted" : "text-muted-foreground"}`}
            >
              {c}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 font-mono text-[11px]">
            <input type="checkbox" checked={showRuler} onChange={(e) => setShowRuler(e.target.checked)} />
            synthetic ruler
          </label>
        </div>

        <ol className="mt-4 space-y-1.5">
          {rows.map((r) => {
            const v = r.all[col]
            const cs = r.sub ? r.all.map((a, i) => (r.sub![i] > 0 ? (a / r.sub![i]) * 100 : -1)).filter((x) => x >= 0) : []
            const spread = cs.length ? Math.max(...cs) - Math.min(...cs) : 0
            const odd = spread > 1
            return (
              <li
                key={r.name}
                className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2 font-mono text-[11px] sm:grid-cols-[11rem_1fr_3.5rem_7.5rem]"
              >
                <span className={`truncate ${r.ruler ? "text-muted-foreground italic" : ""}`}>{r.name}</span>
                <span className="flex h-3.5 overflow-hidden rounded bg-muted/50" aria-hidden="true">
                  <span style={{ width: `${v.toFixed(2)}%`, background: r.ruler ? RULER_C : MODEL_C }} />
                </span>
                <span className="text-right tabular-nums">{v.toFixed(2)}</span>
                <span
                  className="hidden text-right text-[10px] tabular-nums sm:block"
                  style={odd ? { color: FLAG } : { color: "var(--muted-foreground)" }}
                  title="Implied coverage: all-target / submitted, per column"
                >
                  {cs.length ? `C ${Math.min(...cs).toFixed(1)}–${Math.max(...cs).toFixed(1)}%` : r.ruler ? "C 100%" : ""}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Grey rows are maps I built: every target submitted, each centre moved by Gaussian noise with that sigma on each
        axis, scored by the released scorer. The right-hand column is coverage implied by dividing each all-target
        score by its submitted-object twin; it should be one number per row. It is, to within 0.3 points of rounding,
        for every row except GPT-6 Astra (xhigh), where the four columns imply 77.5% to 82.3%.
      </figcaption>
    </figure>
  )
}
