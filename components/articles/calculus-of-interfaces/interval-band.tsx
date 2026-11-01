"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { SUBDIV, SWEEP, TRUE_RANGE } from "./baked"

// OURS, measured. H(W) of the twelve-card grid (the curve), and the interval-arithmetic bound on H over W in [320,1920]
// when we cut the range into `pieces` equal pieces and union the bounds. The bound is sound at every setting and stops
// improving at 1,806 px wide, against a true spread of 800 px, because a piece that straddles a jump bounds a blended
// value as [0, max].
export function IntervalBand() {
  const [ix, setIx] = useState(0)
  const s = SUBDIV[ix]
  const W = 640
  const H = 260
  const L = 44
  const R = 10
  const T = 12
  const B = 30
  const ymin = -3500
  const ymax = 6200
  const sx = (x: number) => L + ((x - 320) / 1600) * (W - L - R)
  const sy = (y: number) => H - B - ((y - ymin) / (ymax - ymin)) * (H - B - T)
  const clampY = (y: number) => Math.min(ymax, Math.max(ymin, y))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        ours, measured: a proof that the page is never shorter than the bound says, and how loose it is
      </div>
      <div className="px-4 pt-3">
        <label className="block">
          <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>pieces the viewport range is cut into</span>
            <span className="text-foreground">{s.pieces}</span>
          </span>
          <Range min={0} max={SUBDIV.length - 1} step={1} value={ix} onChange={(e) => setIx(Number(e.target.value))} aria-label="pieces" />
        </label>
      </div>
      <div className="px-3 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Page height against viewport width. The proved bound is ${s.lo} to ${s.hi} pixels; the true range is ${TRUE_RANGE[0]} to ${TRUE_RANGE[1]}.`}>
          <rect x={L} y={sy(clampY(s.hi))} width={W - L - R} height={Math.max(1, sy(clampY(s.lo)) - sy(clampY(s.hi)))} fill="oklch(0.60 0.17 30)" fillOpacity={0.14} />
          <line x1={L} x2={W - R} y1={sy(s.hi)} y2={sy(s.hi)} stroke="oklch(0.60 0.17 30)" strokeWidth={1.5} />
          <line x1={L} x2={W - R} y1={sy(s.lo)} y2={sy(s.lo)} stroke="oklch(0.60 0.17 30)" strokeWidth={1.5} />
          <polyline
            fill="none"
            stroke="oklch(0.55 0.15 250)"
            strokeWidth={1.8}
            points={SWEEP.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")}
          />
          {[0, 2000, 4000, 6000].map((y) => (
            <text key={y} x={L - 4} y={sy(y) + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.6}>
              {y}
            </text>
          ))}
          {[320, 800, 1280, 1760].map((x) => (
            <text key={x} x={sx(x)} y={H - B + 13} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.6}>
              {x}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.7}>
            viewport width W (px)
          </text>
        </svg>
      </div>
      <div className="grid gap-1 border-t px-4 py-2.5 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
        <span>
          proved: <span className="text-foreground">{s.lo.toLocaleString("en-US")} to {s.hi.toLocaleString("en-US")}</span> px
        </span>
        <span>
          true over all 1,601 widths: <span className="text-foreground">{TRUE_RANGE[0]} to {TRUE_RANGE[1]}</span> px
        </span>
        <span>
          slack: <span className="text-foreground">{(s.hi - s.lo - (TRUE_RANGE[1] - TRUE_RANGE[0])).toLocaleString("en-US")}</span> px
        </span>
      </div>
    </figure>
  )
}
