"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// llamAmpere's AI+ weight code, re-implemented in numpy (scripts in the article) from ggml/src/ggml-ai4.h:
//   level(state) = ((sum of the 4 bytes of (state * C mod 2^32)) + 2 >> 2) - 128,  state = 16-bit trellis window
// C per rate: k=2 0xC3CCD12D, k=3 0x87D8D12D, k=4 0xAA73876B (lay_mul in ggml-cuda/ai4-kern.cuh).
//
// HIST: the 65,536 levels of each rate in 32 bins of width 8 over [-128, 128). Measured.
// MSE: a Viterbi search over that trellis (16-bit state, k bits per weight) on 4 sequences of 1,024 i.i.d.
// N(0, 1) samples, best of a few global scales, start state free (worth at most 16 bits a sequence, so the
// Shannon bound is given at rate k + 16/1024). "uniform" is the best-clipped 2^k-level grid on the same samples;
// Lloyd-Max is the optimal scalar quantizer for a Gaussian (Max, 1960). Measured, except Lloyd-Max and Shannon.

type Rate = 2 | 3 | 4

const HIST: Record<Rate, number[]> = {
  2: [3, 12, 35, 86, 196, 377, 633, 1003, 1557, 2110, 2825, 3611, 4217, 4922, 5375, 5626, 5613, 5426, 5003, 4304, 3695, 2907, 2166, 1572, 1017, 631, 357, 174, 68, 15, 0, 0],
  3: [3, 11, 43, 122, 246, 449, 707, 1177, 1567, 2268, 2930, 3523, 4247, 4761, 5199, 5389, 5473, 5161, 4796, 4279, 3590, 2938, 2278, 1625, 1145, 760, 419, 270, 106, 46, 7, 1],
  4: [1, 6, 42, 120, 248, 433, 752, 1107, 1634, 2250, 2897, 3579, 4230, 4777, 5156, 5445, 5412, 5198, 4805, 4244, 3604, 2933, 2266, 1632, 1144, 742, 444, 254, 116, 48, 13, 4],
}
const STD: Record<Rate, number> = { 2: 35.53, 3: 36.96, 4: 36.97 }
const MEAN: Record<Rate, number> = { 2: -0.4, 3: -0.38, 4: -0.36 }

const MSE: Record<Rate, { uniform: number; lloyd: number; trellis: number; shannon: number }> = {
  2: { uniform: 0.1142, lloyd: 0.1175, trellis: 0.0669, shannon: 0.0612 },
  3: { uniform: 0.0361, lloyd: 0.0345, trellis: 0.017, shannon: 0.0153 },
  4: { uniform: 0.0112, lloyd: 0.0095, trellis: 0.00434, shannon: 0.00382 },
}

const C_BAR = "oklch(0.55 0.16 250)"
const C_CURVE = "oklch(0.60 0.17 30)"
const C_TR = "oklch(0.62 0.15 150)"

const W = 360
const H = 170
const PB = 22

export function TrellisCodes() {
  const [k, setK] = useState<Rate>(4)
  const hist = HIST[k]
  const total = hist.reduce((s, v) => s + v, 0)
  const maxH = Math.max(...hist)
  const bw = W / hist.length
  const sd = STD[k]
  const mu = MEAN[k]
  // Gaussian with the measured mean and std, scaled to counts per 8-wide bin
  const curve = Array.from({ length: 65 }, (_, i) => {
    const v = -128 + i * 4
    const dens = (total * 8 * mexp(-((v - mu) * (v - mu)) / (2 * sd * sd))) / (sd * 2.5066282746)
    return [((v + 128) / 256) * W, H - PB - (dens / maxH) * (H - PB - 8)] as const
  })
  const path = curve.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const m = MSE[k]
  const rows = [
    { n: `uniform ${2 ** k}-level grid`, v: m.uniform, c: "oklch(0.70 0.02 250)" },
    { n: "Lloyd-Max (best scalar)", v: m.lloyd, c: "oklch(0.70 0.02 250)" },
    { n: "AI+ trellis, Viterbi", v: m.trellis, c: C_TR },
    { n: "Shannon bound", v: m.shannon, c: "oklch(0.55 0.02 250)" },
  ]
  const maxM = Math.max(...rows.map((r) => r.v))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        llamAmpere&apos;s AI+ code · levels and Viterbi MSE measured on a CPU re-implementation
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">bits per weight</span>
        {([2, 3, 4] as Rate[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setK(r)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              k === r ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            k = {r}
          </button>
        ))}
      </div>
      <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">all 65,536 states: the level each one decodes to</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Histogram of the 1MAD levels at ${k} bits per weight: mean ${mu}, standard deviation ${sd}, close to a Gaussian.`}>
            {hist.map((v, i) => {
              const h = (v / maxH) * (H - PB - 8)
              return <rect key={i} x={i * bw + 0.5} y={H - PB - h} width={bw - 1} height={h} fill={C_BAR} fillOpacity={0.7} />
            })}
            <path d={path} fill="none" stroke={C_CURVE} strokeWidth={1.5} />
            {[-128, -64, 0, 64, 127].map((t) => (
              <text key={t} x={((t + 128) / 256) * W} y={H - 6} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
                {t}
              </text>
            ))}
          </svg>
          <div className="font-mono text-[10px] text-muted-foreground">
            bars: measured levels · line: a Gaussian with their mean and standard deviation ({sd.toFixed(1)})
          </div>
        </div>
        <div>
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">mean squared error on N(0, 1) weights, lower is better</div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.n} className="font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{r.n}</span>
                  <span className="tabular-nums">{r.v.toFixed(r.v < 0.01 ? 5 : 4)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded bg-muted" role="img" aria-label={`${r.n}: ${r.v}`}>
                  <div className="h-full" style={{ width: `${((r.v / maxM) * 100).toFixed(1)}%`, background: r.c }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 font-mono text-[10px] text-muted-foreground">
            trellis / uniform = {(m.trellis / m.uniform).toFixed(2)} · trellis / Shannon = {(m.trellis / m.shannon).toFixed(2)}
          </div>
        </div>
      </div>
    </figure>
  )
}
