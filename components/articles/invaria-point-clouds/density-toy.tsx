"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mhypot } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy, in 2D, of why point-cloud operators break when the sampling changes,
// and of what Invaria's receptive field calibration does and does not fix.
//
// The scene is a side view of a room: floor, wall, a chair and a table, drawn
// as line segments in centimetres. It is densified, then grid-sampled at the
// grid size you pick (one point per occupied cell, the one nearest the cell
// centre, which is what GridSample does in spirit), then optionally shrunk as a
// whole, keeping every point, the way the paper's scale test keeps the point
// count. A query point sits on the chair seat and four neighbourhood operators
// are drawn around it:
//
//   ball       a fixed metric radius, as in a PointNet++ ball query
//   k-NN       the k nearest points, as in Point Transformer v1/v2
//   grid       a 5 x 5 cell kernel at the declared grid size, as in sparse conv
//              or PTv3's grid coordinates
//   calibrated the same kernel on a grid measured from the points themselves:
//              the mean nearest-neighbour distance over a set of anchors
//              (Invaria's Eq. 4 with rho = mean, alpha = 1)
//
// Illustrative geometry; no number here is from the paper.

type Pt = { x: number; y: number }
type Mode = "ball" | "knn" | "grid" | "calib"

const SEGMENTS: [number, number, number, number][] = [
  [0, 0, 320, 0], // floor
  [0, 0, 0, 200], // wall
  [82, 0, 82, 95], // chair back leg + backrest
  [128, 0, 128, 45], // chair front leg
  [82, 45, 128, 45], // seat
  [82, 95, 94, 95], // top rail
  [200, 0, 200, 74], // table legs
  [290, 0, 290, 74],
  [195, 74, 295, 74], // table top
]
const CHAIR_W = 46
const QUERY: Pt = { x: 105, y: 45 }
const BALL_R = 12
const K = 8
const KERNEL_HALF = 2.5 // a 5 x 5 kernel spans 2.5 cells either side of its centre

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "ball", label: "ball, r = 12 cm", blurb: "fixed metric radius" },
  { id: "knn", label: `k-NN, k = ${K}`, blurb: "fixed point count" },
  { id: "grid", label: "5×5 grid kernel", blurb: "cells of the declared grid" },
  { id: "calib", label: "calibrated grid", blurb: "cells measured from the points" },
]

const ACCENT = "oklch(0.62 0.17 32)"
const CALM = "oklch(0.58 0.12 250)"

function densify(): Pt[] {
  const out: Pt[] = []
  for (const [x0, y0, x1, y1] of SEGMENTS) {
    const len = mhypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(len / 0.25))
    for (let i = 0; i <= n; i++) out.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n })
  }
  return out
}

const DENSE = densify()

function gridSample(tau: number): Pt[] {
  const best = new Map<string, { p: Pt; d: number }>()
  for (const p of DENSE) {
    const cx = Math.floor(p.x / tau)
    const cy = Math.floor(p.y / tau)
    const key = `${cx},${cy}`
    const d = mhypot(p.x - (cx + 0.5) * tau, p.y - (cy + 0.5) * tau)
    const cur = best.get(key)
    if (!cur || d < cur.d) best.set(key, { p, d })
  }
  return [...best.values()].map((v) => v.p)
}

function meanNN(pts: Pt[]): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < pts.length; i += 3) {
    let m = Infinity
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue
      const d = mhypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
      if (d > 0 && d < m) m = d
    }
    if (m < Infinity) {
      sum += m
      n++
    }
  }
  return n ? sum / n : 1
}

// viewBox mapping, world centimetres to SVG units (y up in the world)
const VW = 680
const VH = 400
const X0 = -12
const X1 = 332
const Y0 = -12
const Y1 = 212
const sx = (x: number) => ((x - X0) / (X1 - X0)) * VW
const sy = (y: number) => VH - ((y - Y0) / (Y1 - Y0)) * VH
const sl = (d: number) => (d / (X1 - X0)) * VW

export function DensityToy() {
  const [tau, setTau] = useState(2)
  const [scaleIdx, setScaleIdx] = useState(0)
  const [mode, setMode] = useState<Mode>("ball")
  const scale = [1, 0.5, 1 / 3][scaleIdx]

  const pts = useMemo(() => {
    return gridSample(tau).map((p) => ({ x: p.x * scale, y: p.y * scale }))
  }, [tau, scale])

  const g = useMemo(() => meanNN(pts), [pts])
  const q = { x: QUERY.x * scale, y: QUERY.y * scale }

  const dist = pts.map((p) => mhypot(p.x - q.x, p.y - q.y))

  let inside: boolean[]
  let reach: number // full width of the neighbourhood, cm
  let shape: "circle" | "square"
  if (mode === "ball") {
    inside = dist.map((d) => d <= BALL_R)
    reach = 2 * BALL_R
    shape = "circle"
  } else if (mode === "knn") {
    const sorted = [...dist].sort((a, b) => a - b)
    const r = sorted[Math.min(K, sorted.length - 1)]
    inside = dist.map((d) => d <= r)
    reach = 2 * r
    shape = "circle"
  } else {
    const cell = mode === "grid" ? tau : g
    const h = KERNEL_HALF * cell
    inside = pts.map((p) => Math.abs(p.x - q.x) <= h && Math.abs(p.y - q.y) <= h)
    reach = 2 * h
    shape = "square"
  }
  const count = inside.filter(Boolean).length
  const share = reach / (CHAIR_W * scale)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one neighbourhood, four operators · toy 2D scene</span>
        <span className="text-muted-foreground/60">illustrative geometry</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                mode === m.id
                  ? "border-foreground/40 bg-foreground/5 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={mode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full"
          role="img"
          aria-label={`A side view of a room sampled at a ${tau} cm grid${scale < 1 ? `, shrunk to ${scale === 0.5 ? "half" : "a third"} size` : ""}. The ${MODES.find((m) => m.id === mode)?.label} neighbourhood around a point on the chair seat holds ${count} points and spans ${reach.toFixed(1)} cm, ${(share * 100).toFixed(0)}% of the chair's width.`}
        >
          {SEGMENTS.map(([x0, y0, x1, y1], i) => (
            <line
              key={i}
              x1={sx(x0 * scale)}
              y1={sy(y0 * scale)}
              x2={sx(x1 * scale)}
              y2={sy(y1 * scale)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
          ))}

          {shape === "circle" ? (
            <circle
              cx={sx(q.x)}
              cy={sy(q.y)}
              r={sl(reach / 2)}
              fill={ACCENT}
              fillOpacity={0.1}
              stroke={ACCENT}
              strokeWidth={1.4}
              strokeDasharray="4 3"
            />
          ) : (
            <rect
              x={sx(q.x) - sl(reach / 2)}
              y={sy(q.y) - sl(reach / 2)}
              width={sl(reach)}
              height={sl(reach)}
              fill={ACCENT}
              fillOpacity={0.1}
              stroke={ACCENT}
              strokeWidth={1.4}
              strokeDasharray="4 3"
            />
          )}

          {pts.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={inside[i] ? 2.4 : 1.6}
              fill={inside[i] ? ACCENT : CALM}
              fillOpacity={inside[i] ? 1 : 0.55}
            />
          ))}

          <circle cx={sx(q.x)} cy={sy(q.y)} r={3.6} fill="none" stroke="currentColor" className="text-foreground" strokeWidth={1.5} />
          <text x={VW - 8} y={18} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>
            {pts.length} points in the scene
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">points inside</div>
            <div className="text-base tabular-nums text-foreground">{count}</div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">physical width</div>
            <div className="text-base tabular-nums text-foreground">{reach.toFixed(1)} cm</div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">share of chair seen</div>
            <div className="text-base tabular-nums text-foreground">{(share * 100).toFixed(0)}%</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>grid size τ</span>
              <span className="tabular-nums text-foreground">{tau.toFixed(1)} cm</span>
            </div>
            <Range
              min={1}
              max={6}
              step={0.5}
              value={tau}
              onChange={(e) => setTau(Number(e.target.value))}
              className="w-full cursor-pointer"
              accent={ACCENT}
              aria-label="Grid size in centimetres"
            />
          </label>
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">scene scale (same points)</div>
            <div className="flex gap-1.5">
              {["×1", "×1/2", "×1/3"].map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScaleIdx(i)}
                  aria-pressed={scaleIdx === i}
                  className={cn(
                    "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                    scaleIdx === i
                      ? "border-foreground/40 bg-foreground/5 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {mode === "ball" &&
            "The reach never moves, so the count tracks the density: push τ from 2 to 6 and the seat's neighbourhood loses more than half of its points."}
          {mode === "knn" &&
            "The count is fixed by construction, so the reach has to grow as the points thin out. A coarser cloud makes every neighbourhood physically bigger."}
          {mode === "grid" &&
            "The kernel counts cells, and a cell is τ wide. Coarsen τ and the kernel sees more chair; shrink the scene at a fixed τ and it sees more chair too. Either way the object looks smaller to the model."}
          {mode === "calib" &&
            `The cell is measured from the points (mean nearest-neighbour distance ${g.toFixed(2)} cm here). Shrink the scene and the cell shrinks with it, so the share of chair seen stays put. Coarsen τ and it still grows: calibration fixes scale, not density.`}
        </p>
      </div>
    </figure>
  )
}
