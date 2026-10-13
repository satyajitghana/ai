"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Alex Whedon's launch post gives four end-to-end latencies for SubQ Snap:
// 80 ms at minimal context, 250 ms at 32K, 660 ms at 100K and 2.5 s at 384K.
// The model here is deliberately crude: keep the 80 ms as a fixed cost, split
// the remaining 170 ms at 32K into a part that grows linearly with context and
// a part that grows with its square, and project both to longer contexts. The
// slider is that quadratic share. It is not a measurement of Snap's internals;
// it asks how much quadratic work the published numbers leave room for.

const FIXED = 80
const BASE_N = 32768
const BASE_T = 250
const POINTS: [number, number, string][] = [
  [32768, 250, "32K"],
  [100000, 660, "100K"],
  [384000, 2500, "384K"],
]

function predict(n: number, f: number): number {
  const r = n / BASE_N
  const v = BASE_T - FIXED
  return FIXED + v * (1 - f) * r + v * f * r * r
}

// SVG geometry: x linear in context up to 400K, y linear in ms up to 5,000.
const W = 560
const H = 240
const PADL = 48
const PADB = 28
const XMAX = 400000
const YMAX = 5000
const sx = (n: number) => PADL + (n / XMAX) * (W - PADL - 12)
const sy = (t: number) => H - PADB - (Math.min(t, YMAX) / YMAX) * (H - PADB - 10)

export function LatencyBound() {
  const [pct, setPct] = useState(0)
  const f = pct / 100

  const path: string[] = []
  for (let i = 0; i <= 80; i++) {
    const n = (XMAX * i) / 80
    path.push(`${i === 0 ? "M" : "L"}${sx(n).toFixed(1)},${sy(predict(n, f)).toFixed(1)}`)
  }
  const at384 = predict(384000, f)
  const at100 = predict(100000, f)
  const dense384 = predict(384000, 1)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Snap&apos;s published latencies vs how much quadratic work they leave room for
      </div>

      <div className="border-b p-3">
        <label className="grid gap-1 font-mono text-[11px]">
          <span>
            share of the 32K request&apos;s variable time that grows with n²:{" "}
            <strong>{pct.toFixed(1)}%</strong>
          </span>
          <Range
            min={0}
            max={10}
            step={0.5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            aria-label="Quadratic share at 32K"
          />
        </label>
      </div>

      <div className="p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Latency against context length">
          {[0, 1000, 2000, 3000, 4000, 5000].map((t) => (
            <g key={t}>
              <line x1={PADL} x2={W - 12} y1={sy(t)} y2={sy(t)} className="stroke-muted-foreground/20" strokeWidth={1} />
              <text x={PADL - 6} y={sy(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                {t / 1000}s
              </text>
            </g>
          ))}
          {[0, 100000, 200000, 300000, 400000].map((n) => (
            <text key={n} x={sx(n)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
              {n / 1000}K
            </text>
          ))}
          <path d={path.join(" ")} fill="none" className="stroke-sky-500" strokeWidth={2} />
          {POINTS.map(([n, t, lab]) => (
            <g key={lab}>
              <circle cx={sx(n)} cy={sy(t)} r={4.5} className="fill-rose-500" />
              <text x={sx(n) - 8} y={sy(t) - 8} textAnchor="end" className="fill-foreground font-mono text-[9px]">
                {lab}: {t >= 1000 ? `${t / 1000} s` : `${t} ms`}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid gap-1 border-t p-3 font-mono text-[11px] sm:grid-cols-3">
        <p className="m-0">
          model at 100K: <strong>{Math.round(at100)} ms</strong> (published 660)
        </p>
        <p className="m-0">
          model at 384K: <strong>{(at384 / 1000).toFixed(2)} s</strong> (published 2.5)
        </p>
        <p className="m-0 text-muted-foreground">
          all of it quadratic: {(dense384 / 1000).toFixed(1)} s at 384K
        </p>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Red dots are the four figures in the launch post (the 80 ms floor is the fixed cost).
        At 0% the line is purely linear and lands at 2.07 s for 384K, under the published 2.5 s.
        At 2% it passes through all three points. Push past 5% and the 384K prediction overshoots
        by more than half a second. A crude two-term model, not a profile of the service.
      </figcaption>
    </figure>
  )
}
