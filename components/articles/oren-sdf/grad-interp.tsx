"use client"

import { useState } from "react"

import { mhypot } from "@/lib/dmath"

// One octant, sitting between two obstacles — the case OREN's paper singles out.
// The ground-truth SDF along this slice is the distance to the nearer of two
// discs, so it dips to a valley in the middle (a medial axis: the set of points
// equidistant from both). The octant's two vertices both store small distances,
// because each is close to its own obstacle.
//
//   plain        — trilinear (here, 1D linear) interpolation of the two vertex
//                  SDF values. It averages two small numbers, so it badly
//                  UNDER-estimates the clearance in the middle. Error grows with
//                  the octant size L.
//   gradient-aug  — each vertex also stores the SDF gradient and extrapolates
//                  d_k(x) = d_k + g_k (x - x_k) first. Each extrapolation climbs
//                  toward the valley at the right slope, so the blend recovers
//                  the clearance. Error grows with L^2 (only the curvature is
//                  left over), the gap over plain widening as L grows.
//
// This is OREN's prior in miniature (Proposition 1): the gradient-augmented
// bound is 3 M L^2 / 8 against sqrt(3) L / 2 for plain trilinear, M bounding the
// Hessian spectral norm. The field is analytic, so SSR and the browser agree.

const P = 1.6 // obstacles at +/- P along the slice
const HH = 0.6 // disc centres sit this far below the slice
const R = 0.4 // disc radius
const SAMPLES = 90

const dl = (x: number) => mhypot(x + P, HH) - R
const dr = (x: number) => mhypot(x - P, HH) - R
const gt = (x: number) => Math.min(dl(x), dr(x))
const grad = (x: number) =>
  dl(x) < dr(x) ? (x + P) / mhypot(x + P, HH) : (x - P) / mhypot(x - P, HH)

export function GradInterp() {
  const [L, setL] = useState(1.2)

  const x0 = -L / 2
  const x1 = L / 2
  const d0 = gt(x0)
  const d1 = gt(x1)
  const g0 = grad(x0)
  const g1 = grad(x1)

  // inverse-distance weights reduce, for two vertices, to linear interpolation
  const plain = (x: number) => d0 + ((d1 - d0) * (x - x0)) / L
  // gradient-augmented: blend the two first-order extrapolations with the same
  // weights (w_k = 1/|x - x_k|)
  const gaug = (x: number) => {
    if (x <= x0) return d0
    if (x >= x1) return d1
    const w0 = 1 / (x - x0)
    const w1 = 1 / (x1 - x)
    const e0 = d0 + g0 * (x - x0)
    const e1 = d1 + g1 * (x - x1)
    return (w0 * e0 + w1 * e1) / (w0 + w1)
  }

  const xs: number[] = []
  for (let i = 0; i < SAMPLES; i++) xs.push(x0 + (L * i) / (SAMPLES - 1))
  let ePlain = 0
  let eGa = 0
  for (const x of xs) {
    const t = gt(x)
    ePlain = Math.max(ePlain, Math.abs(plain(x) - t))
    eGa = Math.max(eGa, Math.abs(gaug(x) - t))
  }
  const ratio = eGa > 1e-9 ? ePlain / eGa : 0

  const PW = 640
  const PH = 300
  const padL = 46
  const padR = 14
  const padT = 16
  const padB = 26
  const vals = xs.flatMap((x) => [gt(x), plain(x), gaug(x)])
  const vmin = Math.min(...vals)
  const vmax = Math.max(...vals)
  const span = vmax - vmin || 1
  const sx = (x: number) => padL + ((x - x0) / L) * (PW - padL - padR)
  const sy = (v: number) => padT + ((vmax - v) / span) * (PH - padT - padB)

  const path = (f: (x: number) => number) =>
    xs.map((x, i) => `${i === 0 ? "M" : "L"} ${sx(x).toFixed(2)} ${sy(f(x)).toFixed(2)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          octant between two obstacles, size L = {L.toFixed(2)} m
        </span>
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>octant size L</span>
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.05}
            value={L}
            onChange={(e) => setL(Number(e.target.value))}
            className="h-1 w-32 cursor-pointer accent-foreground"
          />
        </label>
      </div>

      <svg viewBox={`0 0 ${PW} ${PH}`} className="w-full">
        <line x1={padL} y1={sy(vmin)} x2={PW - padR} y2={sy(vmin)} stroke="currentColor" strokeWidth={1} opacity={0.15} />
        <line x1={padL} y1={padT} x2={padL} y2={sy(vmin)} stroke="currentColor" strokeWidth={1} opacity={0.15} />
        <text x={padL - 6} y={sy(vmax)} textAnchor="end" dominantBaseline="middle" className="fill-current font-mono" fontSize={10} opacity={0.5}>
          {(vmax * 100).toFixed(0)}
        </text>
        <text x={padL - 6} y={sy(vmin)} textAnchor="end" dominantBaseline="middle" className="fill-current font-mono" fontSize={10} opacity={0.5}>
          {(vmin * 100).toFixed(0)}
        </text>
        <text x={padL - 30} y={padT + (sy(vmin) - padT) / 2} textAnchor="middle" className="fill-current font-mono" fontSize={10} opacity={0.5} transform={`rotate(-90 ${padL - 30} ${padT + (sy(vmin) - padT) / 2})`}>
          distance (cm)
        </text>

        {/* ground truth */}
        <path d={path(gt)} fill="none" stroke="currentColor" strokeWidth={2.5} />
        {/* plain interpolation */}
        <path d={path(plain)} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" />
        {/* gradient-augmented */}
        <path d={path(gaug)} fill="none" stroke="#0f766e" strokeWidth={2.5} strokeDasharray="1 4" strokeLinecap="round" />

        {/* vertices with slope ticks */}
        {([[x0, d0, g0], [x1, d1, g1]] as const).map(([x, d, g], k) => (
          <g key={k}>
            <line x1={sx(x - 0.14)} y1={sy(d - 0.14 * g)} x2={sx(x + 0.14)} y2={sy(d + 0.14 * g)} stroke="#0f766e" strokeWidth={1.5} />
            <circle cx={sx(x)} cy={sy(d)} r={4} fill="currentColor" />
          </g>
        ))}
      </svg>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 bg-current" /> truth
        </span>
        <span className="mx-3 inline-flex items-center gap-1">
          <span className="inline-block h-[2px] w-4" style={{ background: "#dc2626" }} /> plain, max error{" "}
          <span className="text-foreground">{(ePlain * 100).toFixed(2)} cm</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[2px] w-4" style={{ background: "#0f766e" }} /> gradient-aug, max error{" "}
          <span className="text-foreground">{(eGa * 100).toFixed(2)} cm</span>
        </span>
        <span className="mt-1 block">
          gradient augmentation is {ratio.toFixed(1)}&times; more accurate here; plain interpolation averages two small
          vertex distances and sinks below the true clearance. The gap widens as L grows (linear vs quadratic).
        </span>
      </figcaption>
    </figure>
  )
}
