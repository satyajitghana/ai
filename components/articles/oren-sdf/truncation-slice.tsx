"use client"

import { useRef, useState } from "react"

import { mhypot } from "@/lib/dmath"

// A 2D floor plan with a few obstacles, rendered as a distance field. Drag the
// query dot anywhere. Two modes share the exact same geometry:
//
//   Euclidean  — the field is coloured by the true signed distance to the
//                nearest surface, everywhere, with no cutoff. This is what OREN
//                reconstructs: d(x) is meaningful in the middle of the room, not
//                just next to a wall.
//   TSDF       — the same field truncated to a band |d| < tau. Beyond the band
//                every cell collapses to one "unknown" grey. This is what a
//                truncated SDF (Voxblox-style, or H2-Mapping / PIN-SLAM near the
//                surface only) stores: fast and compact, but a planner standing
//                in open space cannot read its clearance off the map.
//
// The signed distance is computed analytically from discs and rounded boxes, so
// server and client agree bit-for-bit (mhypot rounds the one sqrt). Nothing here
// needs a network or a GPU; it is a toy field, drawn to make the truncation
// visible, not a reconstruction.

const W = 8.0 // metres
const H = 5.6
const COLS = 44
const ROWS = Math.round((COLS * H) / W) // 31
const CELL = W / COLS // 0.1818.. m
const MAXABS = 2.0 // colour saturates at +/- 2 m of clearance

type Disc = { cx: number; cy: number; r: number }
type RBox = { cx: number; cy: number; hx: number; hy: number; round: number }

const DISCS: Disc[] = [
  { cx: 1.75, cy: 1.95, r: 0.4 },
  { cx: 1.75, cy: 3.25, r: 0.4 },
]
const BOXES: RBox[] = [
  { cx: 4.35, cy: 2.8, hx: 0.85, hy: 0.5, round: 0.15 }, // central sofa
  { cx: 6.5, cy: 2.8, hx: 0.3, hy: 1.1, round: 0.1 }, // side cabinet
]

// Signed distance to the union of walls + obstacles, plus the outward gradient
// of whichever surface is nearest. Positive = free space, negative = inside an
// obstacle. Walls are the room border, so the centre of the room still has a
// real (large) distance — that is the whole point of a Euclidean SDF.
function sdf(x: number, y: number): { d: number; gx: number; gy: number } {
  let best = Infinity
  let gx = 0
  let gy = 0

  const consider = (d: number, nx: number, ny: number) => {
    if (d < best) {
      best = d
      gx = nx
      gy = ny
    }
  }

  // Walls: distance to the nearest of four borders (always >= 0 inside).
  const dl = x
  const dr = W - x
  const db = y
  const dt = H - y
  const wall = Math.min(dl, dr, db, dt)
  if (wall === dl) consider(wall, 1, 0)
  else if (wall === dr) consider(wall, -1, 0)
  else if (wall === db) consider(wall, 0, 1)
  else consider(wall, 0, -1)

  for (const o of DISCS) {
    const vx = x - o.cx
    const vy = y - o.cy
    const len = mhypot(vx, vy)
    const d = len - o.r
    const inv = len > 1e-6 ? 1 / len : 0
    consider(d, vx * inv, vy * inv)
  }

  for (const b of BOXES) {
    const px = Math.abs(x - b.cx) - (b.hx - b.round)
    const py = Math.abs(y - b.cy) - (b.hy - b.round)
    const ax = Math.max(px, 0)
    const ay = Math.max(py, 0)
    const outside = mhypot(ax, ay)
    const inside = Math.min(Math.max(px, py), 0)
    const d = outside + inside - b.round
    // Outward normal, same sign convention as the box SDF gradient.
    const sx = x - b.cx < 0 ? -1 : 1
    const sy = y - b.cy < 0 ? -1 : 1
    let nx: number
    let ny: number
    if (px > 0 || py > 0) {
      const l = mhypot(ax, ay)
      const inv = l > 1e-6 ? 1 / l : 0
      nx = sx * ax * inv
      ny = sy * ay * inv
    } else {
      // interior: push along the closer face
      if (px > py) {
        nx = sx
        ny = 0
      } else {
        nx = 0
        ny = sy
      }
    }
    consider(d, nx, ny)
  }

  return { d: best, gx, gy }
}

// Diverging ramp: teal for free space (deeper = more clearance), red for inside
// an obstacle, pale at the zero-level set (the surface).
function colour(d: number): string {
  const t = Math.max(-1, Math.min(1, d / MAXABS))
  if (t >= 0) {
    // 0 -> pale, 1 -> deep teal
    const r = Math.round(239 - t * (239 - 15))
    const g = Math.round(246 - t * (246 - 118))
    const b = Math.round(244 - t * (244 - 110))
    return `rgb(${r},${g},${b})`
  }
  const a = -t
  // 0 -> pale, 1 -> deep red
  const r = Math.round(246 - a * (246 - 150))
  const g = Math.round(235 - a * (235 - 24))
  const b = Math.round(235 - a * (235 - 40))
  return `rgb(${r},${g},${b})`
}

const TRUNC = "#9aa0a6" // "unknown" grey for truncated cells

export function TruncationSlice() {
  const [mode, setMode] = useState<"euclid" | "tsdf">("tsdf")
  const [tau, setTau] = useState(0.3)
  const [q, setQ] = useState({ x: 5.4, y: 4.25 })
  const svgRef = useRef<SVGSVGElement | null>(null)

  const PX = 640 // viewBox width in px
  const PY = (PX * H) / W
  const toPx = (x: number) => (x / W) * PX
  const toPy = (y: number) => PY - (y / H) * PY // flip so y points up

  const field = sdf(q.x, q.y)
  const truncated = mode === "tsdf" && Math.abs(field.d) > tau
  const shown = mode === "tsdf" ? Math.max(-tau, Math.min(tau, field.d)) : field.d

  // gradient arrow (points away from the nearest surface, i.e. +d direction)
  const arrowLen = 0.9
  const ax = q.x + field.gx * arrowLen
  const ay = q.y + field.gy * arrowLen

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0 && e.type === "pointermove") return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const y = H - ((e.clientY - rect.top) / rect.height) * H
    setQ({
      x: Math.max(0.05, Math.min(W - 0.05, x)),
      y: Math.max(0.05, Math.min(H - 0.05, y)),
    })
  }

  const cells = []
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const cx = (i + 0.5) * CELL
      const cy = (j + 0.5) * CELL
      const d = sdf(cx, cy).d
      const fill = mode === "tsdf" && Math.abs(d) > tau ? TRUNC : colour(d)
      cells.push(
        <rect
          key={`${i}-${j}`}
          x={toPx(i * CELL)}
          y={toPy((j + 1) * CELL)}
          width={PX / COLS + 0.6}
          height={PY / ROWS + 0.6}
          fill={fill}
        />
      )
    }
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5">
        <div className="inline-flex overflow-hidden rounded-md border text-xs font-mono">
          <button
            type="button"
            onClick={() => setMode("tsdf")}
            className={
              "px-3 py-1 transition-colors " +
              (mode === "tsdf"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            truncated (TSDF)
          </button>
          <button
            type="button"
            onClick={() => setMode("euclid")}
            className={
              "px-3 py-1 transition-colors " +
              (mode === "euclid"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Euclidean (OREN)
          </button>
        </div>
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>
            truncation band &tau; = {tau.toFixed(2)} m
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={tau}
            disabled={mode === "euclid"}
            onChange={(e) => setTau(Number(e.target.value))}
            className="h-1 w-28 cursor-pointer accent-foreground disabled:opacity-40"
          />
        </label>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${PX} ${PY}`}
        className="w-full touch-none select-none"
        style={{ cursor: "crosshair" }}
        onPointerDown={move}
        onPointerMove={move}
      >
        {cells}

        {/* obstacle outlines (the zero-level set / surfaces) */}
        {DISCS.map((o, k) => (
          <circle
            key={`d${k}`}
            cx={toPx(o.cx)}
            cy={toPy(o.cy)}
            r={(o.r / W) * PX}
            fill="none"
            stroke="#7f1d1d"
            strokeWidth={1.5}
          />
        ))}
        {BOXES.map((b, k) => (
          <rect
            key={`b${k}`}
            x={toPx(b.cx - b.hx)}
            y={toPy(b.cy + b.hy)}
            width={(2 * b.hx * PX) / W}
            height={(2 * b.hy * PY) / H}
            rx={(b.round / W) * PX}
            fill="none"
            stroke="#7f1d1d"
            strokeWidth={1.5}
          />
        ))}

        {/* gradient arrow, only when the field is readable here */}
        {!truncated && (
          <line
            x1={toPx(q.x)}
            y1={toPy(q.y)}
            x2={toPx(ax)}
            y2={toPy(ay)}
            stroke="#0f172a"
            strokeWidth={2}
            markerEnd="url(#oren-arrow)"
          />
        )}
        <defs>
          <marker
            id="oren-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
          </marker>
        </defs>

        {/* query dot */}
        <circle cx={toPx(q.x)} cy={toPy(q.y)} r={6} fill="#0f172a" stroke="#fff" strokeWidth={2} />
      </svg>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">query ({q.x.toFixed(2)}, {q.y.toFixed(2)}) m: </span>
        {truncated ? (
          <>
            map reads <span className="text-foreground">|d| &ge; &tau;</span> &rarr; clamped at{" "}
            {shown >= 0 ? "+" : "−"}
            {Math.abs(shown).toFixed(2)} m.{" "}
            <span className="text-destructive">true clearance {field.d.toFixed(2)} m is not stored.</span>
          </>
        ) : (
          <>
            distance to nearest surface{" "}
            <span className="text-foreground">
              {field.d >= 0 ? "+" : "−"}
              {Math.abs(field.d).toFixed(2)} m
            </span>
            {field.d >= 0 ? " of clearance; arrow points away from the surface." : " — inside an obstacle."}
          </>
        )}{" "}
        Drag anywhere. Red outlines are the surfaces (the zero-level set).
      </figcaption>
    </figure>
  )
}
