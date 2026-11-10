"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

import { E3 } from "./real-data"

// Three ways to reach the same 16-view solve with the released block. MEASURED on CPU with my re-implementation and
// the released weights (fp32, 2 threads), 16 drone photos from the repo's park sample. Reference: the joint 48-call
// solve of all 16. "restart": all 16 from their encodings. "continue": 8 views solved for 16 calls, then the other 8
// join from their encodings (the old ones keep their states). "blocks of 8": each sweep splits the 16 at random into
// two halves and updates one half at a time against a key/value cache of the other (Gauss-Seidel), so every view gets
// one call per sweep and no call holds more than 8 views' queries. The y axis is the mean pairwise relative-rotation
// disagreement with the reference, in degrees: agreement with the joint answer, not accuracy against ground truth.

const W = 560
const H = 220
const PAD = { l: 44, r: 12, t: 12, b: 28 }
const LO = -2
const HI = 1.6
const XMAX = 24
const sx = (k: number) => PAD.l + ((k - 1) / (XMAX - 1)) * (W - PAD.l - PAD.r)
const sy = (d: number) => {
  const v = Math.min(HI, Math.max(LO, mlog10(Math.max(d, 1e-4))))
  return PAD.t + ((HI - v) / (HI - LO)) * (H - PAD.t - PAD.b)
}
const TICKS: [number, string][] = [
  [0.01, "0.01°"],
  [0.1, "0.1°"],
  [1, "1°"],
  [10, "10°"],
]

const SERIES = [
  { key: "restart", label: "restart all 16", color: "oklch(0.62 0.16 35)", pts: E3.restart },
  { key: "continue", label: "8 solved + 8 join", color: "oklch(0.58 0.15 255)", pts: E3.cont },
  { key: "bcd", label: "blocks of 8, cached", color: "oklch(0.60 0.14 150)", pts: E3.bcd },
] as const

function at(pts: readonly (readonly [number, number])[], k: number) {
  let best = pts[0]
  for (const p of pts) if (p[0] <= k) best = p
  return best
}

export function BlockSolve() {
  const [k, setK] = useState(8)
  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        16 real photos, three routes to one solve · disagreement with the joint 48-call answer · measured on CPU
      </div>
      <div className="px-2 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Rotation disagreement against calls per view">
          {TICKS.map(([v, label]) => (
            <g key={label}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                {label}
              </text>
            </g>
          ))}
          {[1, 4, 8, 12, 16, 24].map((x) => (
            <text key={x} x={sx(x)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
              {x}
            </text>
          ))}
          <text x={W - PAD.r} y={H - 1} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
            calls per view (since the join, for the continued solve)
          </text>
          <line x1={sx(k)} x2={sx(k)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.3} />
          {SERIES.map((s) => (
            <g key={s.key}>
              <path
                d={s.pts.map(([x, d], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(d).toFixed(1)}`).join("")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
              />
              {s.pts.map(([x, d]) => (
                <circle key={x} cx={sx(x)} cy={sy(d)} r={2.6} fill={s.color} />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="space-y-2 px-4 pb-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">calls per view</span>
          <Range min={1} max={XMAX} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="calls per view" className="w-full" />
          <span className="w-10 shrink-0 text-right font-mono tabular-nums">{k}</span>
        </label>
        <div className="grid grid-cols-1 gap-1 font-mono text-[11px] sm:grid-cols-3">
          {SERIES.map((s) => {
            const [x, d] = at(s.pts, k)
            return (
              <span key={s.key}>
                <span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: s.color }} />
                {s.label}: <b className="tabular-nums">{d.toFixed(2)}°</b>
                <span className="text-muted-foreground"> (at {x})</span>
              </span>
            )
          })}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Measured: the released weights through my re-implementation, fp32, 2 CPU threads; measured at the marked calls
        only, and the readout holds the last measured point. The continued solve&apos;s first 8 views had already had 16
        calls on their own before the join. The joint 48-call solve is the reference, so a perfect route reaches 0°; the
        joint solve&apos;s own call 16 sits {E3.joint16.toFixed(2)}° from its call 48.
      </figcaption>
    </figure>
  )
}
