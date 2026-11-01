"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { PLAN, YHIST } from "./data"

// Top-down density of the sample world's 7,276,512 splats (0.25 m cells) and
// the histogram of their heights. The slider sets how many splats a cell needs
// before it counts as "occupied"; the area readout is the number of such cells
// times 0.0625 m^2. Floor and ceiling are the two tallest height bands.

const CELL = 12
const MAXV = Math.max(...PLAN.rows.flat())
const shade = (v: number) => {
  if (v <= 0) return "transparent"
  const t = Math.min(1, Math.log10(1 + v) / Math.log10(1 + MAXV))
  return `oklch(${(0.93 - 0.55 * t).toFixed(3)} ${(0.04 + 0.1 * t).toFixed(3)} 255)`
}

const HMAX = Math.max(...YHIST.h)
const FLOOR_Y = 1.35
const CEIL_Y = -1.15

export function RoomScan() {
  const [thr, setThr] = useState(200)
  let cells = 0
  for (const r of PLAN.rows) for (const v of r) if (v >= thr) cells++
  const area = cells * PLAN.cell * PLAN.cell

  const PW = PLAN.nx * CELL
  const PH = PLAN.nz * CELL
  const HW = 190
  const bins = YHIST.h.length
  const bh = PH / bins

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          sample world · {PLAN.nx * PLAN.nz} cells of 0.25 m · measured from the SPZ
        </span>
        <span className="font-mono text-xs">
          ≥ {thr} splats per cell → {cells} cells → {area.toFixed(1)} m²
        </span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto]">
        <svg
          viewBox={`0 0 ${PW} ${PH}`}
          className="w-full rounded-md border bg-background"
          role="img"
          aria-label="Top-down density of splats in the sample room; cells with at least the chosen number of splats are outlined"
        >
          {PLAN.rows.map((row, i) =>
            row.map((v, j) => (
              <rect
                key={`${i}-${j}`}
                x={i * CELL}
                y={j * CELL}
                width={CELL}
                height={CELL}
                fill={shade(v)}
                stroke={v >= thr ? "oklch(0.62 0.16 35)" : "none"}
                strokeWidth={v >= thr ? 0.6 : 0}
              />
            )),
          )}
          <text x={4} y={PH - 5} fontSize={9} fill="currentColor" opacity={0.6}>
            x → (right)
          </text>
          <text x={PW - 4} y={10} fontSize={9} fill="currentColor" opacity={0.6} textAnchor="end">
            z (forward) ↓
          </text>
        </svg>
        <svg
          viewBox={`0 0 ${HW} ${PH}`}
          className="mx-auto h-auto w-full max-w-[190px] rounded-md border bg-background"
          role="img"
          aria-label="Histogram of splat heights with floor and ceiling bands marked"
        >
          {YHIST.h.map((v, k) => (
            <rect
              key={k}
              x={0}
              y={k * bh}
              width={(v / HMAX) * (HW - 52)}
              height={bh - 0.5}
              fill="oklch(0.60 0.15 255)"
            />
          ))}
          {[
            { y: CEIL_Y, t: "ceiling −1.15" },
            { y: FLOOR_Y, t: "floor +1.35" },
          ].map((m) => {
            const yy = ((m.y - YHIST.y0) / YHIST.step) * bh
            return (
              <g key={m.t}>
                <line x1={0} x2={HW} y1={yy} y2={yy} stroke="oklch(0.62 0.16 35)" strokeDasharray="3 3" />
                <text x={HW - 4} y={yy - 3} fontSize={9} textAnchor="end" fill="currentColor">
                  {m.t}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="border-t px-4 py-3">
        <label className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="whitespace-nowrap">cell threshold</span>
          <Range min={1} max={2000} step={1} value={thr} onChange={(e) => setThr(Number(e.target.value))} />
        </label>
        <p className="mt-2 text-sm text-muted-foreground">
          Floor to ceiling is 1.35 − (−1.15) = 2.5 m. The y axis points down in the SPZ the app exports, so the floor
          has the larger value.
        </p>
      </div>
    </figure>
  )
}
