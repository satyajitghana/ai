"use client"

import { useState } from "react"

import { TILE_ROWS, type TileRow } from "./data"

// Our measurement, not the paper's: for random Gaussians under the real FIORD Hall_In lens, how often does the
// rectangle 3DGUT builds from unscented-transform sigma points (rule read in gutProjector.cuh) cover every pixel
// whose ray reaches the Gaussian? 25 Gaussians per cell, exact support = minimum Mahalanobis distance <= 3.
// The toy does not apply 3DGUT's 160 degree crop; the last metric shows how much support that crop would remove.

type Metric = { id: string; label: string; note: string; get: (r: TileRow) => number; fmt: (v: number) => string; good: "high" | "low" }
const METRICS: Metric[] = [
  { id: "recall", label: "pixel recall", note: "share of exactly-supported pixels inside the rectangle (mean)", get: (r) => r.recall, fmt: (v) => `${(v * 100).toFixed(1)}%`, good: "high" },
  { id: "missed", label: "Gaussians with a missed pixel", note: "share of Gaussians whose support has at least one pixel outside the rectangle", get: (r) => r.missedGauss, fmt: (v) => `${(v * 100).toFixed(0)}%`, good: "low" },
  { id: "tile", label: "tiles missed", note: "share of 16×16 tiles holding supported pixels that fall outside the tile range (mean)", get: (r) => r.tileMiss, fmt: (v) => `${(v * 100).toFixed(1)}%`, good: "low" },
  { id: "beyond", label: "support past 80°", note: "share of the exactly-supported pixels more than 80° off axis: what a 160° crop removes", get: (r) => r.beyond80, fmt: (v) => `${(v * 100).toFixed(0)}%`, good: "low" },
]

const commas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const ANGLES = [0, 20, 40, 60, 80, 90, 100]
const SIZES = [0.05, 0.1, 0.2]

export function AdmissionMiss() {
  const [mid, setMid] = useState("missed")
  const [sel, setSel] = useState<{ theta: number; size: number }>({ theta: 90, size: 0.2 })
  const metric = METRICS.find((m) => m.id === mid) ?? METRICS[0]
  const cell = (theta: number, size: number) => TILE_ROWS.find((r) => r.theta === theta && r.size === size)
  const chosen = cell(sel.theta, sel.size)
  const values = TILE_ROWS.map((r) => metric.get(r))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const shade = (v: number) => {
    const t = hi > lo ? (v - lo) / (hi - lo) : 0
    const bad = metric.good === "high" ? 1 - t : t
    return `oklch(${(0.95 - 0.35 * bad).toFixed(3)} ${(0.02 + 0.13 * bad).toFixed(3)} ${(240 - 215 * bad).toFixed(1)})`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">projected rectangle vs. ray support · measured, 25 Gaussians per cell</span>
        <div role="tablist" aria-label="Metric" className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={m.id === mid}
              onClick={() => setMid(m.id)}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] ${m.id === mid ? "bg-foreground text-background" : "bg-background"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <p className="mb-2 text-xs text-muted-foreground">{metric.note}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1 font-mono text-[11px]">
            <thead>
              <tr>
                <th className="text-left font-normal text-muted-foreground">Gaussian size ÷ distance</th>
                {ANGLES.map((a) => (
                  <th key={a} className="font-normal text-muted-foreground">
                    {a}°
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIZES.map((s) => (
                <tr key={s}>
                  <th scope="row" className="text-left font-normal">
                    σ = {s}
                  </th>
                  {ANGLES.map((a) => {
                    const r = cell(a, s)
                    if (!r) return <td key={a} />
                    const on = sel.theta === a && sel.size === s
                    return (
                      <td key={a} className="p-0">
                        <button
                          onClick={() => setSel({ theta: a, size: s })}
                          aria-pressed={on}
                          aria-label={`${metric.label} at ${a} degrees, size ${s}: ${metric.fmt(metric.get(r))}`}
                          className={`w-full rounded px-1 py-2 text-center ${on ? "ring-2 ring-foreground" : ""}`}
                          style={{ background: shade(metric.get(r)) }}
                        >
                          {metric.fmt(metric.get(r))}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chosen && (
          <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
            {[
              ["selected", `${chosen.theta}° off axis, σ = ${chosen.size}·d`],
              ["worst single Gaussian recall", `${(chosen.recallMin * 100).toFixed(1)}%`],
              ["median supported pixels", commas(chosen.supportPx)],
              ["tiles missed (mean)", `${(chosen.tileMiss * 100).toFixed(1)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border px-2.5 py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </figure>
  )
}
