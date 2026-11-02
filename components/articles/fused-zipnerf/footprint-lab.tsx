"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexpm1, mlog10, mpow, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { FOOT, type FootRow } from "./data"

// Toy 1 of the article: how well three ways of reading one iid-noise hash-grid level track the average of the same field
// over an interval's footprint (Gaussian-weighted, Monte Carlo, 384 points, 300 intervals per point).
//   A  one trilinear lookup at the interval's centre            (Instant-NGP)
//   B  mean of the six multisample lookups                      (supersampling)
//   C  mean of the six lookups, each scaled by erf(1 / (sqrt(8) sigma))   (Zip-NeRF, as featurize_common.cuh does it)
// The geometry and the weight are a numpy port of the repo's CUDA; the field is noise, which is what a fine level looks like
// before training gives it structure. The x axis is the mean multisample radius in cells of the level (scale x level size).

const N_LIST = [16, 64, 256, 1024, 4096]
const C_A = "oklch(0.60 0.18 25)"
const C_B = "oklch(0.60 0.14 250)"
const C_C = "oklch(0.60 0.16 150)"
const C_T = "oklch(0.55 0.02 260)"
const X_MIN = -2
const X_MAX = 1.3
const W = 520
const H = 230
const PL = 44
const PR = 12
const PT = 10
const PB = 28
const Y_MAX = 0.65

const PATTERN = [0, 2, 4, 3, 5, 1]

const px = (lg: number) => PL + ((lg - X_MIN) / (X_MAX - X_MIN)) * (W - PL - PR)
const py = (v: number) => PT + (1 - Math.min(Y_MAX, v) / Y_MAX) * (H - PT - PB)

// Zip-NeRF's weight: the code's approx_erf(1 / (sqrt(8) * scale * level_size)), with scale x level_size = sigma in cells.
function approxErf(x: number): number {
  return Math.sign(x) * Math.sqrt(-mexpm1(-(4 / Math.PI) * x * x))
}
const weight = (sigma: number) => approxErf(1 / (Math.sqrt(8) * sigma))

function interp(rows: FootRow[], lg: number, f: (r: FootRow) => number): number {
  const pts = rows.map((r) => [mlog10(r.sigma), f(r)] as const)
  if (lg <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (lg <= pts[i][0]) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      return y0 + ((y1 - y0) * (lg - x0)) / (x1 - x0)
    }
  }
  return pts[pts.length - 1][1]
}

function line(rows: FootRow[], f: (r: FootRow) => number): string {
  return rows.map((r, i) => `${i ? "L" : "M"}${px(mlog10(r.sigma)).toFixed(1)},${py(f(r)).toFixed(1)}`).join(" ")
}

export function FootprintLab() {
  const [n, setN] = useState(256)
  const [lg, setLg] = useState(0.1)
  const [flip, setFlip] = useState(false)
  const rows = FOOT.filter((r) => r.n === n).sort((a, b) => a.sigma - b.sigma)
  const sigma = mpow(10, lg)
  const eA = interp(rows, lg, (r) => r.errA)
  const eB = interp(rows, lg, (r) => r.errB)
  const eC = interp(rows, lg, (r) => r.errC)
  const tr = interp(rows, lg, (r) => r.truth)
  const w = weight(sigma)
  const wCurve = Array.from({ length: 61 }, (_, i) => {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / 60
    return `${i ? "L" : "M"}${px(x).toFixed(1)},${py(weight(mpow(10, x)) * Y_MAX).toFixed(1)}`
  }).join(" ")
  const ticks = [-2, -1, 0, 1]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        toy: three ways to read one noisy grid level · our numpy port of the repo&apos;s geometry · not a GPU measurement
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">level resolution</span>
        {N_LIST.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setN(v)}
            aria-pressed={n === v}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              n === v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v}³
          </button>
        ))}
      </div>
      <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.6fr_1fr]">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" className="w-full" aria-label={`RMS error against the footprint average for a ${n} cubed level, as a function of footprint size in cells. A stays near 0.5, B near 0.2, C falls toward zero as the footprint grows.`}>
            {[0, 0.2, 0.4, 0.6].map((v) => (
              <g key={v}>
                <line x1={PL} x2={W - PR} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity={0.12} />
                <text x={PL - 6} y={py(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={px(t)} x2={px(t)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.1} />
                <text x={px(t)} y={H - PB + 13} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>
                  {mpow(10, t)}
                </text>
              </g>
            ))}
            <text x={(PL + W - PR) / 2} y={H - 3} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>
              footprint radius, in cells of this level (log scale)
            </text>
            <path d={wCurve} fill="none" stroke="oklch(0.70 0.14 80)" strokeWidth={1.2} strokeDasharray="4 3" />
            <path d={line(rows, (r) => r.truth)} fill="none" stroke={C_T} strokeWidth={1.2} strokeDasharray="2 3" />
            <path d={line(rows, (r) => r.errA)} fill="none" stroke={C_A} strokeWidth={2} />
            <path d={line(rows, (r) => r.errB)} fill="none" stroke={C_B} strokeWidth={2} />
            <path d={line(rows, (r) => r.errC)} fill="none" stroke={C_C} strokeWidth={2} />
            {rows.map((r) => (
              <g key={r.sigma}>
                <circle cx={px(mlog10(r.sigma))} cy={py(r.errA)} r={2} fill={C_A} />
                <circle cx={px(mlog10(r.sigma))} cy={py(r.errB)} r={2} fill={C_B} />
                <circle cx={px(mlog10(r.sigma))} cy={py(r.errC)} r={2} fill={C_C} />
              </g>
            ))}
            <line x1={px(lg)} x2={px(lg)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 2" />
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
            <span style={{ color: C_A }}>A single lookup</span>
            <span style={{ color: C_B }}>B six-point mean</span>
            <span style={{ color: C_C }}>C six-point mean × erf weight</span>
            <span style={{ color: C_T }}>dotted: RMS of the true footprint average</span>
            <span style={{ color: "oklch(0.70 0.14 80)" }}>dashed: the weight (0 to 1, drawn on the 0 to 0.65 axis)</span>
          </div>
          <label className="mt-3 flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 font-mono text-muted-foreground">footprint radius</span>
            <Range min={X_MIN} max={X_MAX} step={0.01} value={lg} onChange={(e) => setLg(Number(e.target.value))} aria-label="Footprint radius in cells, log scale" className="w-full" />
            <span className="w-24 shrink-0 text-right font-mono tabular-nums">{sigma.toFixed(2)} cells</span>
          </label>
          <dl className="mt-2 grid grid-cols-5 gap-2 font-mono text-[11px]">
            {[
              ["error A", eA, C_A],
              ["error B", eB, C_B],
              ["error C", eC, C_C],
              ["true RMS", tr, C_T],
              ["weight", w, "oklch(0.70 0.14 80)"],
            ].map(([k, v, c]) => (
              <div key={String(k)} className="rounded border px-2 py-1">
                <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{String(k)}</dt>
                <dd className="tabular-nums" style={{ color: String(c) }}>
                  {Number(v).toFixed(3)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>the six multisamples of one interval</span>
            <button type="button" onClick={() => setFlip((f) => !f)} aria-pressed={flip} className="rounded border px-1.5 py-0.5 hover:bg-muted">
              {flip ? "flipped" : "not flipped"}
            </button>
          </div>
          <svg viewBox="-60 -60 120 120" role="img" className="mx-auto w-full max-w-[220px]" aria-label="Cross-section of the hexagonal multisample pattern: six points on a circle, visited in the order 0, 2, 4, 3, 5, 1 times sixty degrees">
            <circle r={44} fill="none" stroke="currentColor" strokeOpacity={0.2} />
            {Array.from({ length: 6 }, (_, j) => {
              const idx = flip ? 5 - j : j
              const th = (Math.PI / 3) * PATTERN[idx]
              const x = 44 * mcos(th)
              const y = -44 * msin(th)
              return (
                <g key={j}>
                  <circle cx={x} cy={y} r={7} fill="oklch(0.62 0.16 285)" fillOpacity={0.85} />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize={9} fill="white">
                    {j}
                  </text>
                </g>
              )
            })}
          </svg>
          <p className="mt-2 text-xs text-muted-foreground">
            Angles are (π/3) × (0, 2, 4, 3, 5, 1), reversed when flipped, plus a random rotation in training; along the ray the six sit at
            (0.4 j − 1) × 3/√7 times a frustum moment. READ from <code>multisample()</code> in <code>featurize_common.cuh</code>.
          </p>
        </div>
      </div>
    </figure>
  )
}
