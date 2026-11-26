"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog10 } from "@/lib/dmath"

// fast_expf_avx2 (shared/math.asm): k = round(x * log2e), r = x - k*ln2 (Cody-Waite, two
// constants), exp(x) = 2^k * p(r), p = Taylor polynomial 1 + r + r^2/2 + ... + r^6/720,
// 2^k built by shifting (k + 127) into the float exponent field.
// The curve is the polynomial's truncation error alone, in double precision. The real
// kernel adds float32 rounding on top; the README measures 1.394e-7 at 64 test points, below the
// polynomial's own worst case at r = -ln2/2 (about 1.6e-7 relative).

const LN2 = 0.6931471805599453
const LOG2E = 1.4426950408889634
const HALF = LN2 / 2
const W = 560
const H = 220
const PAD = { l: 52, r: 12, t: 12, b: 30 }
const YMIN = -11
const YMAX = -1

function taylor(r: number, deg: number) {
  let p = 1
  let term = 1
  for (let i = 1; i <= deg; i++) {
    term = (term * r) / i
    p += term
  }
  return p
}

export function ExpfPoly() {
  const [deg, setDeg] = useState(6)
  const [x10, setX10] = useState(-37)
  const x = x10 / 10

  const path = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 160; i++) {
      const r = -HALF + (2 * HALF * i) / 160
      const e = Math.abs(taylor(r, deg) - mexp(r)) / mexp(r)
      const ly = e > 0 ? Math.max(YMIN, mlog10(e)) : YMIN
      const px = PAD.l + ((r + HALF) / (2 * HALF)) * (W - PAD.l - PAD.r)
      const py = PAD.t + ((YMAX - ly) / (YMAX - YMIN)) * (H - PAD.t - PAD.b)
      pts.push(`${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
    }
    return pts.join(" ")
  }, [deg])

  const yOf = (ly: number) => PAD.t + ((YMAX - ly) / (YMAX - YMIN)) * (H - PAD.t - PAD.b)
  const ulp = yOf(mlog10(2 ** -24))
  const meas = yOf(mlog10(1.394e-7))
  const worst = Math.max(
    Math.abs(taylor(HALF, deg) - mexp(HALF)) / mexp(HALF),
    Math.abs(taylor(-HALF, deg) - mexp(-HALF)) / mexp(-HALF),
  )

  const k = Math.round(x * LOG2E)
  const r = x - k * LN2
  const p = taylor(r, 6)

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">How many Taylor terms expf needs after range reduction</figcaption>
      <label className="block">
        <span className="text-muted-foreground">
          Polynomial degree: <span className="font-mono text-foreground">{deg}</span> {deg === 6 && "(what llm.asm uses)"}
        </span>
        <Range min={3} max={9} step={1} value={deg} onChange={(e) => setDeg(Number(e.target.value))} className="w-full" aria-label="Degree" />
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Relative truncation error of the Taylor polynomial over the reduced range">
        {[-11, -9, -7, -5, -3, -1].map((ly) => (
          <g key={ly}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(ly)} y2={yOf(ly)} className="stroke-border" strokeWidth={0.5} />
            <text x={PAD.l - 6} y={yOf(ly) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
              1e{ly}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={ulp} y2={ulp} stroke="currentColor" strokeDasharray="4 3" className="text-emerald-600" />
        <text x={W - PAD.r} y={ulp - 4} textAnchor="end" className="fill-emerald-700 text-[10px] dark:fill-emerald-400">
          float32 half-ulp, 2^-24
        </text>
        <line x1={PAD.l} x2={W - PAD.r} y1={meas} y2={meas} stroke="currentColor" strokeDasharray="2 3" className="text-rose-500" />
        <text x={PAD.l + 4} y={meas - 4} className="fill-rose-600 text-[10px] dark:fill-rose-400">
          README: 1.394e-7 measured
        </text>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.8} className="text-sky-600 dark:text-sky-400" />
        <text x={PAD.l} y={H - 8} className="fill-muted-foreground text-[10px]">
          r = -ln2/2
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
          r = +ln2/2
        </text>
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Worst truncation error at degree {deg}: <span className="font-mono">{worst.toExponential(2)}</span>. At degree 6 the negative end of
        the range is above the README&apos;s measured 1.394e-7, so its 64-point test never hit the worst case; degree 7 would drop
        truncation below what float32 can store.
      </p>

      <label className="mt-4 block">
        <span className="text-muted-foreground">
          Try an input: <span className="font-mono text-foreground">x = {x.toFixed(1)}</span>
        </span>
        <Range min={-870} max={880} step={1} value={x10} onChange={(e) => setX10(Number(e.target.value))} className="w-full" aria-label="x" />
      </label>
      <div className="mt-2 grid gap-2 font-mono text-xs sm:grid-cols-3">
        <div className="rounded border border-border p-2">k = round(x · log2 e) = {k}</div>
        <div className="rounded border border-border p-2">r = x − k·ln2 = {r.toFixed(6)}</div>
        <div className="rounded border border-border p-2">
          2^{k} · p(r), p(r) = {p.toFixed(7)}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Whatever x is, r lands within ±0.3466 and the exponent does the rest. Softmax and SiLU only ever ask for inputs the clamp at
        −87.34 and +88.38 lets through.
      </p>
    </figure>
  )
}
