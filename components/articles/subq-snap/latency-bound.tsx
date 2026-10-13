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
// Two drawings: wide for sm and up, and a narrow one for phones, where an
// 11-unit label in a 340-wide viewBox lands at about 10.5 px. On the narrow
// one the 32K and 100K labels sit below and right of their dots, clear of the
// y-axis labels they would otherwise run into.
type Geo = { w: number; h: number; padL: number; padB: number; fs: number; below: Set<string> }
const WIDE: Geo = { w: 560, h: 240, padL: 48, padB: 28, fs: 10, below: new Set() }
const NARROW: Geo = { w: 340, h: 250, padL: 38, padB: 28, fs: 11, below: new Set(["32K", "100K"]) }
const XMAX = 400000
const YMAX = 5000
const sxOf = (g: Geo, n: number) => g.padL + (n / XMAX) * (g.w - g.padL - 12)
const syOf = (g: Geo, t: number) => g.h - g.padB - (Math.min(t, YMAX) / YMAX) * (g.h - g.padB - 10)

export function LatencyBound() {
  const [pct, setPct] = useState(0)
  const f = pct / 100

  const pathOf = (g: Geo) => {
    const path: string[] = []
    for (let i = 0; i <= 80; i++) {
      const n = (XMAX * i) / 80
      path.push(`${i === 0 ? "M" : "L"}${sxOf(g, n).toFixed(1)},${syOf(g, predict(n, f)).toFixed(1)}`)
    }
    return path.join(" ")
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
        {([WIDE, NARROW] as const).map((g) => (
          <svg
            key={g.w}
            viewBox={`0 0 ${g.w} ${g.h}`}
            className={g === WIDE ? "hidden h-auto w-full sm:block" : "mx-auto block h-auto w-full max-w-[480px] sm:hidden"}
            role="img"
            aria-label="Latency against context length"
          >
            {[0, 1000, 2000, 3000, 4000, 5000].map((t) => (
              <g key={t}>
                <line x1={g.padL} x2={g.w - 12} y1={syOf(g, t)} y2={syOf(g, t)} className="stroke-muted-foreground/20" strokeWidth={1} />
                <text x={g.padL - 6} y={syOf(g, t) + 3.5} textAnchor="end" fontSize={g.fs} className="fill-muted-foreground font-mono">
                  {t / 1000}s
                </text>
              </g>
            ))}
            {[0, 100000, 200000, 300000, 400000].map((n) => (
              <text key={n} x={sxOf(g, n)} y={g.h - 10} textAnchor={n === XMAX ? "end" : "middle"} dx={n === XMAX ? 12 : 0} fontSize={g.fs} className="fill-muted-foreground font-mono">
                {n / 1000}K
              </text>
            ))}
            <path d={pathOf(g)} fill="none" className="stroke-sky-500" strokeWidth={2} />
            {POINTS.map(([n, t, lab]) => {
              const below = g.below.has(lab)
              return (
                <g key={lab}>
                  <circle cx={sxOf(g, n)} cy={syOf(g, t)} r={4.5} className="fill-rose-500" />
                  <text
                    x={sxOf(g, n) + (below ? 7 : -8)}
                    y={syOf(g, t) + (below ? 15 : -8)}
                    textAnchor={below ? "start" : "end"}
                    fontSize={g.fs}
                    className="fill-foreground font-mono"
                  >
                    {lab}: {t >= 1000 ? `${t / 1000} s` : `${t} ms`}
                  </text>
                </g>
              )
            })}
          </svg>
        ))}
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
