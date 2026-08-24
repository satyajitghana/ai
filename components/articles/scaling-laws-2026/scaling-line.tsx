"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The power law, on both sets of axes, plus what a point on it costs.
//
// Kaplan et al. (arXiv:2001.08361) report three separate fits, each of the form
// L = (X_c / X)^alpha:
//
//   parameters    alpha_N = 0.076    N_c = 8.8e13
//   data          alpha_D = 0.095    D_c = 5.4e13
//   compute       alpha_C = 0.050    C_c = 3.1e8 PF-days
//
// The exponents are the whole story and they are all small. The slider exists
// to make that concrete: a curve this shallow only moves when its input moves
// by factors of ten, which is the entire reason the industry became a race to
// add zeros.
//
// The cost side is the other identity everyone uses: C = 6ND FLOPs, two per
// parameter for the forward pass and about four for the backward.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"

const FITS = [
  { k: "C", label: "compute", alpha: 0.05, unit: "PF-days", lo: 2, hi: 10 },
  { k: "N", label: "parameters", alpha: 0.076, unit: "params", lo: 6, hi: 13 },
  { k: "D", label: "tokens", alpha: 0.095, unit: "tokens", lo: 8, hi: 14 },
] as const

// Known runs, for the 6ND readout. Params and tokens as published.
const RUNS = [
  { name: "GPT-3", N: 175e9, D: 300e9 },
  { name: "Chinchilla", N: 70e9, D: 1.4e12 },
  { name: "Llama 3 70B", N: 70e9, D: 15e12 },
  { name: "LFM2.5-350M", N: 0.354e9, D: 28e12 },
]

// Unicode superscripts rather than a <tspan>: this string goes into an SVG
// <text>, and keeping it a single text node avoids the server/client node-split
// that a mixed text-plus-element child causes.
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹"
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[Number(d)])

const fmt = (v: number) => {
  const e = Math.floor(mlog10(v))
  const m = v / mpow(10, e)
  return `${m.toFixed(2)}×10${sup(e)}`
}

export function ScalingLine() {
  const [fit, setFit] = useState<(typeof FITS)[number]["k"]>("C")
  const [alpha, setAlpha] = useState(50) // ×1000
  const [logAxes, setLogAxes] = useState(true)
  const [run, setRun] = useState(0)

  const f = FITS.find((x) => x.k === fit)!
  const a = alpha / 1000

  const W = 700
  const H = 210
  const X0 = 54
  const X1 = 470
  const Y0 = 18
  const Y1 = 158

  // L(x) = x^(-alpha), normalised so the left edge of the window sits at 1.
  const loss = (logx: number) => mpow(10, -a * (logx - f.lo))

  const PX = (logx: number) =>
    logAxes
      ? X0 + ((logx - f.lo) / (f.hi - f.lo)) * (X1 - X0)
      : X0 + (mpow(10, logx - f.hi) * (X1 - X0))
  const lossAt = (logx: number) => loss(logx)
  const lo = lossAt(f.hi)
  const PY = (l: number) =>
    logAxes
      ? Y1 - ((mlog10(l) - mlog10(lo)) / (0 - mlog10(lo))) * (Y1 - Y0)
      : Y1 - ((l - lo) / (1 - lo)) * (Y1 - Y0)

  const curve = (() => {
    let d = ""
    for (let i = 0; i <= 90; i++) {
      const lx = f.lo + ((f.hi - f.lo) * i) / 90
      d += `${i === 0 ? "M" : "L"} ${PX(lx).toFixed(2)} ${PY(lossAt(lx)).toFixed(2)} `
    }
    return d
  })()

  // what one more order of magnitude actually buys
  const gainPerDecade = 1 - mpow(10, -a)

  const r = RUNS[run]
  const flops = 6 * r.N * r.D

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          L = (X<sub>c</sub> / X)<sup>α</sup> — a straight line only once both axes are logarithmic
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          α = {a.toFixed(3)} · one decade buys {(gainPerDecade * 100).toFixed(1)}%
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {FITS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => {
                setFit(x.k)
                setAlpha(Math.round(x.alpha * 1000))
              }}
              aria-pressed={fit === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                fit === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label} · α={x.alpha}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLogAxes((v) => !v)}
            aria-pressed={logAxes}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              logAxes
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {logAxes ? "log–log axes" : "linear axes"}
          </button>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            {/* One expression, not text-plus-interpolation: React serialises a
                mixed text node into several nodes on the server and one in the
                browser, and inside an SVG <title> that is a hydration
                mismatch. */}
            <title>
              {`Loss plotted against ${f.label}. On logarithmic axes the power law is a straight line; switching to linear axes bends it into a curve that flattens almost immediately.`}
            </title>

            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />

            <text x={8} y={14} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              loss (bits/token)
            </text>
            <text
              x={(X0 + X1) / 2}
              y={H - 6}
              fontSize={8.5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.45}
              fontFamily="ui-monospace, monospace"
            >
              {f.label} ({f.unit}) — {logAxes ? "log scale" : "linear scale"}
            </text>

            {Array.from({ length: f.hi - f.lo + 1 }, (_, i) => f.lo + i).map((lx) => (
              <g key={lx}>
                <line x1={PX(lx)} y1={Y1} x2={PX(lx)} y2={Y1 + 4} stroke="currentColor" strokeOpacity={0.25} />
                <text
                  x={PX(lx)}
                  y={Y1 + 14}
                  fontSize={7.5}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.4}
                  fontFamily="ui-monospace, monospace"
                >
                  10<tspan fontSize={6} dy={-3}>{lx}</tspan>
                </text>
              </g>
            ))}

            <path d={curve} fill="none" stroke={ACCENT} strokeWidth={2.4} />

            {/* one decade of progress, marked */}
            {(() => {
              const from = f.lo + (f.hi - f.lo) * 0.45
              const to = from + 1
              if (to > f.hi) return null
              return (
                <g>
                  <line x1={PX(from)} y1={PY(lossAt(from))} x2={PX(to)} y2={PY(lossAt(from))} stroke={WARM} strokeDasharray="3 2" />
                  <line x1={PX(to)} y1={PY(lossAt(from))} x2={PX(to)} y2={PY(lossAt(to))} stroke={WARM} strokeWidth={2} />
                  <circle cx={PX(from)} cy={PY(lossAt(from))} r={3} fill={WARM} />
                  <circle cx={PX(to)} cy={PY(lossAt(to))} r={3} fill={WARM} />
                  <text
                    x={PX(to) + 7}
                    y={(PY(lossAt(from)) + PY(lossAt(to))) / 2 + 3}
                    fontSize={9}
                    fill={WARM}
                    fontFamily="ui-monospace, monospace"
                  >
                    ×10 → −{(gainPerDecade * 100).toFixed(1)}%
                  </text>
                </g>
              )
            })()}

            {/* the cost identity */}
            <g fontFamily="ui-monospace, monospace">
              <text x={512} y={30} fontSize={9} fill="currentColor" fillOpacity={0.45}>
                what a point costs
              </text>
              <text x={512} y={50} fontSize={13} fill="currentColor">
                C = 6ND
              </text>
              <text x={512} y={70} fontSize={8.5} fill="currentColor" fillOpacity={0.45}>
                2 FLOPs/param forward
              </text>
              <text x={512} y={82} fontSize={8.5} fill="currentColor" fillOpacity={0.45}>
                ≈4 backward
              </text>

              <text x={512} y={108} fontSize={9} fill={ACCENT}>
                {r.name}
              </text>
              <text x={512} y={124} fontSize={8.5} fill="currentColor" fillOpacity={0.7}>
                N = {fmt(r.N)}
              </text>
              <text x={512} y={137} fontSize={8.5} fill="currentColor" fillOpacity={0.7}>
                D = {fmt(r.D)}
              </text>
              <text x={512} y={155} fontSize={11} fill={WARM}>
                {fmt(flops)} FLOPs
              </text>
            </g>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              exponent α
            </span>
            <Range
              min={10}
              max={400}
              step={5}
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              className="flex-1"
              aria-label="the power-law exponent"
              accent={WARM}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {a.toFixed(3)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {RUNS.map((x, i) => (
              <button
                key={x.name}
                type="button"
                onClick={() => setRun(i)}
                aria-pressed={run === i}
                className={cn(
                  "cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[9px] transition-colors",
                  run === i
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {x.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          the three reported exponents are 0.050 (compute), 0.076 (parameters), 0.095 (tokens) ·
          drag α higher to see what the curve would look like if scaling were generous
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch to linear axes and the famous straight line is a disappointing hook that flattens
          almost at once. That is not a different claim — it is the same numbers, and it is the more
          honest picture of what buying scale feels like.{" "}
          <span className="text-foreground">
            An exponent near 0.05 means a tenfold increase in compute removes about {(gainPerDecade * 100).toFixed(0)}%
            of the remaining loss
          </span>
          , and then you need another tenfold for the next slice.
          <br />
          <br />
          The line being straight is what makes the spending rational; the line being{" "}
          <em>shallow</em>{" "}is what makes it enormous. Both facts come from the same small number,
          and almost every retelling of scaling laws quotes the first and skips the second.
        </p>
      </div>
    </figure>
  )
}
