"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2, mlog10, mpow } from "@/lib/dmath"

// Why DeepGEMM scales FP8 per 128 elements instead of per tensor.
//
// E4M3 is floating point, so its *relative* precision does not depend on the
// scale you pick: three mantissa bits are three mantissa bits anywhere in range.
// What the scale buys is range. Once the group maximum is pinned to 448, the
// format reaches down to the smallest subnormal 2^-9, a span of 229,376:1, and
// only the top 28,672:1 of that keeps a full mantissa. A single outlier a few
// decades above the rest drags everything else through that floor.
//
// A toy row of 32 values with log-uniform magnitudes and one outlier. The real
// kernel uses 1x128 tiles on activations and 128x128 blocks on weights; 32
// values is the same arithmetic at a size you can see.

const FP8_MAX = 448 // largest finite E4M3 magnitude
const FP8_MIN_SUB = mpow(2, -9) // smallest subnormal step
const FP8_MIN_NORM = mpow(2, -6) // below this, mantissa bits start going
const MANT_BITS = 3

const COLD = "oklch(0.62 0.13 250)" // per-group
const WARM = "oklch(0.68 0.17 45)" // per-tensor

function q_e4m3(x: number): number {
  const a = Math.abs(x)
  if (a === 0) return 0
  if (a >= FP8_MAX) return Math.sign(x) * FP8_MAX
  const e = Math.floor(mlog2(a))
  const step = Math.max(mpow(2, e - MANT_BITS), FP8_MIN_SUB)
  return Math.sign(x) * Math.round(a / step) * step
}

// deterministic, SSR-safe row: log-uniform magnitudes over three decades
function row(n: number): number[] {
  const out: number[] = []
  let s = 20250225
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    const u = s / 2147483648
    s = (s * 1103515245 + 12345) % 2147483648
    const sign = s / 2147483648 < 0.5 ? -1 : 1
    out.push(sign * mpow(10, -3 * u))
  }
  return out
}

const N = 32
const OUT_IDX = 11
const VALUES = row(N)
const WEIGHTS = row(N).map((w, i) => (i % 2 ? w : -w))

export function ScaleGranularity() {
  const [dec, setDec] = useState(3) // outlier: 10^dec times the row's own max
  const [g, setG] = useState(8) // values per scale

  const m = useMemo(() => {
    const x = VALUES.slice()
    const rowMax = Math.max(...x.map(Math.abs))
    x[OUT_IDX] = rowMax * mpow(10, dec)

    const quant = (lo: number, hi: number) => {
      let amax = 0
      for (let i = lo; i < hi; i++) amax = Math.max(amax, Math.abs(x[i]))
      const s = amax / FP8_MAX
      const out: number[] = []
      for (let i = lo; i < hi; i++) out.push(q_e4m3(x[i] / s) * s)
      return out
    }

    const perTensor = quant(0, N)
    const perGroup: number[] = []
    for (let i = 0; i < N; i += g) perGroup.push(...quant(i, Math.min(i + g, N)))

    const errs = (y: number[]) =>
      x.map((v, i) => (v === 0 ? 0 : Math.abs(y[i] - v) / Math.abs(v)))
    const rms = (e: number[]) => {
      const s = e.filter((_, i) => i !== OUT_IDX)
      return Math.sqrt(s.reduce((a, v) => a + v * v, 0) / s.length)
    }
    const zeroed = (y: number[]) => y.filter((v, i) => i !== OUT_IDX && v === 0).length
    const dot = (y: number[]) => y.reduce((a, v, i) => a + v * WEIGHTS[i], 0)
    const exact = dot(x)

    const eT = errs(perTensor)
    const eG = errs(perGroup)
    return {
      x,
      eT,
      eG,
      rmsT: rms(eT),
      rmsG: rms(eG),
      zT: zeroed(perTensor),
      zG: zeroed(perGroup),
      dotT: Math.abs(dot(perTensor) - exact) / Math.abs(exact),
      dotG: Math.abs(dot(perGroup) - exact) / Math.abs(exact),
      numScales: Math.ceil(N / g),
    }
  }, [dec, g])

  const W = 720
  const CELL = 19
  const X0 = 118
  const TOP = 8
  const BARH = 44

  // magnitudes on a log axis, 8 decades deep
  const magY = (v: number) => {
    const a = Math.abs(v)
    const t = Math.min(1, Math.max(0, (mlog10(a + 1e-12) + 8) / 9))
    return TOP + (1 - t) * BARH
  }
  const cellFill = (e: number) => {
    const t = Math.min(1, Math.max(0, (mlog10(e + 1e-6) + 4) / 3))
    return `oklch(${(0.93 - 0.3 * t).toFixed(3)} ${(0.02 + 0.17 * t).toFixed(3)} ${(250 - 205 * t).toFixed(1)})`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>FP8 E4M3 · one scale for the row vs one per group</span>
        <span className="text-muted-foreground/50">toy: 32 values, 1 outlier</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} 160`}
          className="w-full"
          role="img"
          aria-label={`With the outlier 10 to the ${dec} times the row maximum, one scale for all 32 values leaves ${m.zT} of the other 31 at zero and an RMS relative error of ${(m.rmsT * 100).toFixed(1)} percent; one scale per ${g} values leaves ${m.zG} at zero and ${(m.rmsG * 100).toFixed(1)} percent.`}
        >
          <text x={X0 - 10} y={TOP + 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            magnitude
          </text>
          <text x={X0 - 10} y={TOP + 26} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={8}>
            (log)
          </text>
          {m.x.map((v, i) => (
            <rect
              key={`v${i}`}
              x={X0 + i * CELL + 3}
              y={magY(v)}
              width={CELL - 6}
              height={Math.max(1, TOP + BARH - magY(v))}
              fill={i === OUT_IDX ? WARM : "var(--muted-foreground)"}
              opacity={i === OUT_IDX ? 0.95 : 0.45}
            />
          ))}

          {[
            { key: "t", label: "one scale", e: m.eT, y: TOP + BARH + 14, span: N },
            { key: "g", label: `per ${g}`, e: m.eG, y: TOP + BARH + 56, span: g },
          ].map((r) => (
            <g key={r.key}>
              <text x={X0 - 10} y={r.y + 21} textAnchor="end" className="fill-foreground font-mono" fontSize={11}>
                {r.label}
              </text>
              {r.e.map((e, i) => (
                <rect
                  key={`${r.key}${i}`}
                  x={X0 + i * CELL}
                  y={r.y}
                  width={CELL - 1.5}
                  height={30}
                  rx={2}
                  fill={cellFill(e)}
                  stroke={i === OUT_IDX ? WARM : "none"}
                  strokeWidth={i === OUT_IDX ? 1.5 : 0}
                />
              ))}
              {Array.from({ length: Math.ceil(N / r.span) - 1 }, (_, k) => (
                <line
                  key={`d${r.key}${k}`}
                  x1={X0 + (k + 1) * r.span * CELL - 1}
                  x2={X0 + (k + 1) * r.span * CELL - 1}
                  y1={r.y - 3}
                  y2={r.y + 33}
                  stroke={COLD}
                  strokeWidth={1.5}
                />
              ))}
            </g>
          ))}

          <text x={X0} y={152} className="fill-muted-foreground font-mono" fontSize={9}>
            pale = the value survived the cast · hot = it was flattened, or lost entirely
          </text>
        </svg>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>outlier size (drag)</span>
              <span className="text-foreground">10^{dec} x the row max</span>
            </div>
            <Range min={0} max={5} value={dec} onChange={(e) => setDec(Number(e.target.value))} className="w-full cursor-pointer" accent={WARM} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>group size (drag)</span>
              <span className="text-foreground">{g} values, {m.numScales} scales</span>
            </div>
            <Range min={2} max={32} step={2} value={g} onChange={(e) => setG(Number(e.target.value))} className="w-full cursor-pointer" accent={COLD} />
          </div>
        </div>

        <div className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2">
            <div style={{ color: WARM }}>one scale for the row</div>
            <div className="mt-1 text-foreground">{(m.rmsT * 100).toFixed(1)}% RMS error · {m.zT}/31 zeroed</div>
            <div className="text-muted-foreground">dot product off by {(m.dotT * 100).toFixed(2)}%</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div style={{ color: COLD }}>one scale per {g}</div>
            <div className="mt-1 text-foreground">{(m.rmsG * 100).toFixed(1)}% RMS error · {m.zG}/31 zeroed</div>
            <div className="text-muted-foreground">dot product off by {(m.dotG * 100).toFixed(2)}%</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag the outlier up and watch where the damage comes from. It is not the mantissa: E4M3 is floating point, so three
          mantissa bits give the same {"~"}3% relative error wherever a value sits, and at small outliers the two schemes are
          within a few tenths of a percent of each other. It is the <span className="text-foreground">range</span>. Pinning the
          group maximum to 448 puts the smallest normal value at{" "}
          <span className="text-foreground">{FP8_MIN_NORM}</span>{" "}and the smallest subnormal an eighth of that again, so
          anything more than 28,672x below the maximum starts
          shedding mantissa bits and anything more than 229,376x below it is gone. One outlier three decades up drops a third
          of this row through that floor; giving each run of{" "}
          <span style={{ color: COLD }}>{g}</span>{" "}its own scale confines the loss to the outlier{"'"}s own group. Errors are
          RMS over the 31 other values.
        </p>
      </div>
    </figure>
  )
}
