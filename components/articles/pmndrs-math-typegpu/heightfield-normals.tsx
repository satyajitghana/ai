"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, msin } from "@/lib/dmath"

// One slice through a heightfield. The terrain is a sum of two sines standing
// in for two octaves of noise (the second at 2.3x the frequency and 0.4x the
// amplitude, the ratios pmndrs/math's terrain example uses). Samples sit on a
// grid of spacing `dx`; at each one the widget draws the exact normal, from the
// derivative, and the central-difference normal a grid mesher computes from its
// two neighbours: (h[i-1] - h[i+1], 2 dx), normalised. Trig goes through
// lib/dmath so the server and the browser print the same digits.

const W = 640
const H = 250
const X0 = 0
const X1 = 8
const SX = W / (X1 - X0)
const SY = 88
const CY = 140
const A = 0.55
const K = 1.6
const P1 = 0.3
const P2 = 1.1
const NORMAL_LEN = 0.42
const ACCENT = "oklch(0.62 0.16 45)"
const EXACT = "oklch(0.6 0.12 250)"

const h = (x: number) => A * msin(K * x + P1) + 0.4 * A * msin(2.3 * K * x + P2)
const dh = (x: number) => A * K * mcos(K * x + P1) + 0.4 * A * 2.3 * K * mcos(2.3 * K * x + P2)

const px = (x: number) => Math.round((x - X0) * SX * 100) / 100
const py = (y: number) => Math.round((CY - y * SY) * 100) / 100

// the true curve, sampled finely once
const CURVE = (() => {
  const pts: string[] = []
  for (let i = 0; i <= 320; i++) {
    const x = X0 + ((X1 - X0) * i) / 320
    pts.push(`${px(x)},${py(h(x))}`)
  }
  return pts.join(" ")
})()

type Sample = { x: number; y: number; ex: number; ey: number; cx: number; cy: number; err: number }

function sampleGrid(dx: number): { samples: Sample[]; maxErr: number; meanErr: number } {
  const samples: Sample[] = []
  let maxErr = 0
  let sum = 0
  const n = Math.floor((X1 - X0) / dx)
  for (let i = 1; i < n; i++) {
    const x = X0 + i * dx
    const y = h(x)
    // exact: (-h', 1), normalised
    const s = dh(x)
    const el = Math.sqrt(1 + s * s)
    // central difference: (h(x - dx) - h(x + dx), 2 dx), normalised
    const nx = h(x - dx) - h(x + dx)
    const ny = 2 * dx
    const cl = Math.sqrt(nx * nx + ny * ny)
    const exact = matan2(-s, 1)
    const approx = matan2(nx, ny)
    const err = (Math.abs(exact - approx) * 180) / Math.PI
    maxErr = Math.max(maxErr, err)
    sum += err
    samples.push({ x, y, ex: -s / el, ey: 1 / el, cx: nx / cl, cy: ny / cl, err })
  }
  return { samples, maxErr, meanErr: samples.length ? sum / samples.length : 0 }
}

const sinc = (t: number) => (t === 0 ? 1 : msin(t) / t)

export function HeightfieldNormals() {
  const [dx, setDx] = useState(0.3)
  const grid = useMemo(() => sampleGrid(dx), [dx])

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      aria-label="A slice through a heightfield with exact normals and central-difference normals at a grid spacing you choose"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Grid spacing ${dx.toFixed(2)}: central-difference normals are off by at most ${grid.maxErr.toFixed(1)} degrees`}
      >
        <polyline points={CURVE} fill="none" stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={2} />
        {grid.samples.map((s) => (
          <g key={s.x}>
            <line
              x1={px(s.x)}
              y1={py(s.y)}
              x2={px(s.x + s.ex * NORMAL_LEN)}
              y2={py(s.y + s.ey * NORMAL_LEN)}
              stroke={EXACT}
              strokeWidth={2}
            />
            <line
              x1={px(s.x)}
              y1={py(s.y)}
              x2={px(s.x + s.cx * NORMAL_LEN)}
              y2={py(s.y + s.cy * NORMAL_LEN)}
              stroke={ACCENT}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
            <circle cx={px(s.x)} cy={py(s.y)} r={3} fill="var(--foreground)" />
          </g>
        ))}
        <text x={12} y={20} fontSize={12} fill={EXACT} className="font-mono">
          solid: exact normal, from the derivative
        </text>
        <text x={12} y={38} fontSize={12} fill={ACCENT} className="font-mono">
          dashed: (h[i-1] − h[i+1], 2·dx), normalised
        </text>
      </svg>

      <div className="space-y-2 border-t px-4 py-3 font-mono text-xs text-muted-foreground">
        <label className="flex items-center gap-3">
          <span className="w-36 shrink-0">grid spacing {dx.toFixed(2)}</span>
          <Range min={0.05} max={0.8} step={0.05} value={dx} onChange={(e) => setDx(Number(e.currentTarget.value))} accent={ACCENT} aria-label="grid spacing" className="w-full" />
        </label>
        <div className="grid grid-cols-[14rem_1fr] gap-x-4 gap-y-1 text-[11px] tabular-nums">
          <span>normal error, worst sample</span>
          <span className="text-foreground">{grid.maxErr.toFixed(2)}°</span>
          <span>normal error, mean</span>
          <span className="text-foreground">{grid.meanErr.toFixed(2)}°</span>
          <span>slope kept, octave 1</span>
          <span className="text-foreground">
            sin(kΔ)/kΔ = {sinc(K * dx).toFixed(3)}
          </span>
          <span>slope kept, octave 2</span>
          <span className="text-foreground">
            sin(2.3kΔ)/2.3kΔ = {sinc(2.3 * K * dx).toFixed(3)}
          </span>
        </div>
      </div>
    </figure>
  )
}
