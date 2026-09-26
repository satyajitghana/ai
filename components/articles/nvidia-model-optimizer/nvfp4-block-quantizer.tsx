"use client"

import { useMemo, useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// An NVFP4 block quantizer that follows Model Optimizer's own arithmetic
// (modelopt/torch/quantization/qtensor/nvfp4_tensor.py and
// kernels/quantization/common/nvfp4_quant.py):
//
//   g   = amax(W) / (6 * 448)                          the FP32 per-tensor scale
//   s_b = E4M3( amax(block) / (6 * g) ) * g            the FP8 per-16 block scale
//   q   = E2M1( |w| / s_b )  in {0, .5, 1, 1.5, 2, 3, 4, 6}, sign kept
//
// "MSE" replaces the max rule with Model Optimizer's sweep: every one of the
// 126 positive finite E4M3 values is tried as the block's scale code and the
// one with the least squared error in that block wins (nvfp4_fp8_sweep.py).
// FP8 is per-tensor E4M3 (scale = amax / 448); INT4 is symmetric with one
// scale (amax / 7) shared by all 32 values, levels -8..7.
//
// Everything here is +, -, *, /, sqrt, floor and comparisons, which are exact
// on every engine, so server and client render the same digits. The 32
// weights come from a seeded integer PRNG, never Math.random.

const N = 32
const BLOCK = 16
const E2M1_MAX = 6
const E4M3_MAX = 448
const E4M3_MIN_NORMAL = 0.015625 // 2^-6
const E4M3_SUB_STEP = 0.001953125 // 2^-9, the subnormal step and the smallest positive value
const OUT = 5 // the index that becomes the outlier

const C_NV = "oklch(0.64 0.17 145)"
const C_FP8 = "oklch(0.62 0.15 255)"
const C_INT4 = "oklch(0.68 0.17 50)"
const C_A = "oklch(0.64 0.17 145)"
const C_B = "oklch(0.62 0.15 255)"

// round half to even, as torch.round and the FP8 cast do
function rne(v: number): number {
  const f = Math.floor(v)
  const d = v - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

// nearest E4M3 (the FN variant: no infinities, max 448) for a positive value
function toE4M3(x: number): number {
  if (!(x > 0)) return 0
  if (x >= E4M3_MAX) return E4M3_MAX
  if (x < E4M3_MIN_NORMAL) return rne(x / E4M3_SUB_STEP) * E4M3_SUB_STEP
  let p = 1
  while (p * 2 <= x) p *= 2
  while (p > x) p /= 2
  const step = p / 8 // three mantissa bits
  return Math.min(E4M3_MAX, rne(x / step) * step)
}

// the 126 positive finite E4M3 values: 7 subnormals, then 15 binades of 8, minus the NaN code
const E4M3_CODES: number[] = (() => {
  const out: number[] = []
  for (let m = 1; m < 8; m++) out.push(m * E4M3_SUB_STEP)
  let p = E4M3_MIN_NORMAL
  for (let e = 1; e <= 15; e++) {
    for (let m = 0; m < 8; m++) {
      if (e === 15 && m === 7) continue
      out.push(p * (1 + m / 8))
    }
    p *= 2
  }
  return out
})()

// E2M1 magnitude rounding, with the same tie rules as fp4_round_magnitude
function e2m1(a: number): number {
  if (a <= 0.25) return 0
  if (a < 0.75) return 0.5
  if (a <= 1.25) return 1
  if (a < 1.75) return 1.5
  if (a <= 2.5) return 2
  if (a < 3.5) return 3
  if (a <= 5) return 4
  return 6
}

function mulberry32(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeWeights(seed: number, outlier: number): number[] {
  const r = mulberry32(seed * 7919 + 17)
  const v: number[] = []
  for (let i = 0; i < N; i++) {
    const g = r() + r() + r() + r() - 2 // Irwin-Hall: bell-shaped, mean 0
    v.push(g * (i < BLOCK ? 1 : 0.6))
  }
  let next = 0
  for (let i = 0; i < BLOCK; i++) if (i !== OUT) next = Math.max(next, Math.abs(v[i]))
  v[OUT] = (v[OUT] >= 0 ? 1 : -1) * next * outlier
  return v
}

const amaxOf = (v: number[]) => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0)
const sgn = (x: number) => (x < 0 ? -1 : 1)

type Nv = { deq: number[]; scaled: number[]; g: number; codes: number[]; blockMax: number[] }

function nvfp4(v: number[], rule: "max" | "mse"): Nv {
  const g = amaxOf(v) / (E2M1_MAX * E4M3_MAX)
  const deq: number[] = new Array(N).fill(0)
  const scaled: number[] = new Array(N).fill(0)
  const codes: number[] = []
  const blockMax: number[] = []
  for (let b = 0; b < N / BLOCK; b++) {
    const blk = v.slice(b * BLOCK, (b + 1) * BLOCK)
    const bmax = amaxOf(blk)
    let code: number
    if (rule === "max") {
      // clamp to [2^-9, 448] and cast, as _cast_per_block_scale_to_fp8 does
      code = toE4M3(Math.max(bmax / (E2M1_MAX * g), E4M3_SUB_STEP))
    } else {
      let best = Infinity
      code = E4M3_CODES[0]
      for (const c of E4M3_CODES) {
        const s = c * g
        let sse = 0
        for (const x of blk) {
          const a = Math.abs(x)
          const d = a - e2m1(a / s) * s
          sse += d * d
        }
        if (sse < best) {
          best = sse
          code = c
        }
      }
    }
    const s = code * g
    codes.push(code)
    blockMax.push(bmax / s)
    for (let i = 0; i < BLOCK; i++) {
      const x = blk[i]
      scaled[b * BLOCK + i] = Math.abs(x) / s
      deq[b * BLOCK + i] = sgn(x) * e2m1(Math.abs(x) / s) * s
    }
  }
  return { deq, scaled, g, codes, blockMax }
}

function fp8(v: number[]): number[] {
  const s = amaxOf(v) / E4M3_MAX
  return v.map((x) => sgn(x) * toE4M3(Math.abs(x) / s) * s)
}

function int4(v: number[]): number[] {
  const s = amaxOf(v) / 7
  return v.map((x) => Math.min(7, Math.max(-8, rne(x / s))) * s)
}

// relative RMS error over [from, to), in percent
function relErr(v: number[], q: number[], from = 0, to = N): number {
  let e = 0
  let r = 0
  for (let i = from; i < to; i++) {
    e += (v[i] - q[i]) * (v[i] - q[i])
    r += v[i] * v[i]
  }
  return r > 0 ? (Math.sqrt(e) / Math.sqrt(r)) * 100 : 0
}

const fmtScale = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 1 ? x.toFixed(3).replace(/\.?0+$/, "") : x.toPrecision(3))

const W = 720
const H = 356
const X0 = 48
const X1 = 704
const SLOT = (X1 - X0) / N
const MID = 150
const HALF = 92
const GRID = [0, 0.5, 1, 1.5, 2, 3, 4, 6]
const GX = (a: number) => X0 + (Math.min(a, 8) / 8) * (X1 - X0)

type Fmt = "nvfp4" | "fp8" | "int4"
const FMT: Record<Fmt, { name: string; color: string }> = {
  nvfp4: { name: "NVFP4", color: C_NV },
  fp8: { name: "FP8", color: C_FP8 },
  int4: { name: "INT4", color: C_INT4 },
}

export function Nvfp4BlockQuantizer() {
  const [outlier, setOutlier] = useState(6)
  const [rule, setRule] = useState<"max" | "mse">("max")
  const [fmt, setFmt] = useState<Fmt>("nvfp4")
  const [seed, setSeed] = useState(1)

  const v = useMemo(() => makeWeights(seed, outlier), [seed, outlier])
  const nv = useMemo(() => nvfp4(v, rule), [v, rule])
  const q8 = useMemo(() => fp8(v), [v])
  const q4 = useMemo(() => int4(v), [v])
  const amax = amaxOf(v)
  const overlay = fmt === "nvfp4" ? nv.deq : fmt === "fp8" ? q8 : q4
  const y = (x: number) => MID - (x / amax) * HALF

  const rows = [
    { key: "nvfp4" as Fmt, label: `NVFP4 · ${rule === "max" ? "max" : "MSE"} scales`, bits: "4.5", all: relErr(v, nv.deq), b: relErr(v, nv.deq, BLOCK, N) },
    { key: "fp8" as Fmt, label: "FP8 E4M3 · one scale", bits: "8", all: relErr(v, q8), b: relErr(v, q8, BLOCK, N) },
    { key: "int4" as Fmt, label: "INT4 · one scale", bits: "4 + scale", all: relErr(v, q4), b: relErr(v, q4, BLOCK, N) },
  ]

  const summary = `With the outlier at ${outlier} times its block's next-largest value, NVFP4 with ${rule === "max" ? "max" : "MSE"} scales has ${rows[0].all.toFixed(1)}% relative RMS error, FP8 ${rows[1].all.toFixed(1)}% and single-scale INT4 ${rows[2].all.toFixed(1)}%. On the untouched block B the errors are ${rows[0].b.toFixed(1)}%, ${rows[1].b.toFixed(1)}% and ${rows[2].b.toFixed(1)}%.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>NVFP4 block quantizer · 32 weights, two blocks of 16</span>
        <span className="text-muted-foreground/50">ModelOpt&apos;s arithmetic</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
          {/* block backgrounds */}
          {[0, 1].map((b) => {
            const bx = X0 + b * BLOCK * SLOT
            return (
              <g key={b}>
                <rect x={bx + 2} y={42} width={BLOCK * SLOT - 4} height={HALF * 2 + 16} rx={8} fill={b === 0 ? C_A : C_B} opacity={0.07} />
                <text x={bx + 10} y={24} className="font-mono" fontSize={11} fontWeight={600} style={{ fill: b === 0 ? C_A : C_B }}>
                  block {b === 0 ? "A" : "B"}
                </text>
                <text x={bx + 10} y={37} className="fill-muted-foreground font-mono" fontSize={9.5}>
                  E4M3 code {fmtScale(nv.codes[b])} · s = code × g · max |w|/s {nv.blockMax[b].toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* zero line */}
          <line x1={X0} x2={X1} y1={MID} y2={MID} stroke="currentColor" opacity={0.25} />

          {/* weights: bar = original, tick = dequantized */}
          {v.map((x, i) => {
            const cx = X0 + (i + 0.5) * SLOT
            const yo = y(x)
            const yq = y(overlay[i])
            return (
              <g key={i}>
                <rect
                  x={cx - SLOT * 0.22}
                  y={Math.min(yo, MID)}
                  width={SLOT * 0.44}
                  height={Math.max(0.5, Math.abs(yo - MID))}
                  rx={1.5}
                  fill="var(--muted-foreground)"
                  opacity={0.35}
                />
                <line x1={cx - SLOT * 0.4} x2={cx + SLOT * 0.4} y1={yq} y2={yq} stroke={FMT[fmt].color} strokeWidth={2.5} strokeLinecap="round" />
              </g>
            )
          })}
          <text x={X0 - 6} y={MID - HALF + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            +{amax.toFixed(2)}
          </text>
          <text x={X0 - 6} y={MID + HALF + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            −{amax.toFixed(2)}
          </text>
          <text x={X0 + OUT * SLOT + SLOT / 2} y={v[OUT] >= 0 ? y(v[OUT]) - 6 : y(v[OUT]) + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            outlier
          </text>

          {/* the E2M1 grid, where |w| / s lands before rounding */}
          <text x={X0} y={268} className="fill-muted-foreground font-mono" fontSize={10}>
            NVFP4: |w| / s before rounding, on the E2M1 grid (values past 6 clip to 6)
          </text>
          {GRID.map((gv) => (
            <g key={gv}>
              <line x1={GX(gv)} x2={GX(gv)} y1={278} y2={326} stroke="currentColor" opacity={gv === 6 ? 0.45 : 0.18} strokeDasharray={gv === 6 ? undefined : "3 3"} />
              <text x={GX(gv)} y={340} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {gv}
              </text>
            </g>
          ))}
          <rect x={GX(6)} y={278} width={GX(8) - GX(6)} height={48} fill="var(--muted)" opacity={0.25} />
          <text x={X0 - 6} y={295} textAnchor="end" className="font-mono" fontSize={9} style={{ fill: C_A }}>
            A
          </text>
          <text x={X0 - 6} y={315} textAnchor="end" className="font-mono" fontSize={9} style={{ fill: C_B }}>
            B
          </text>
          {nv.scaled.map((a, i) => (
            <circle key={i} cx={GX(a)} cy={i < BLOCK ? 292 : 312} r={3.2} fill={i < BLOCK ? C_A : C_B} opacity={0.8} />
          ))}
        </svg>

        {/* controls */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>outlier in block A (drag)</span>
            <span>
              <span className="text-foreground">{outlier}×</span>{" "}the block&apos;s next-largest value
            </span>
          </div>
          <Range min={1} max={16} step={0.5} value={outlier} onChange={(e) => setOutlier(Number(e.target.value))} className="w-full cursor-pointer" accent={C_NV} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">block scale</span>
            {(["max", "mse"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setRule(k)}
                aria-pressed={rule === k}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  rule === k ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={rule === k ? { background: C_NV } : undefined}
              >
                {k === "max" ? "max (default)" : "MSE, 126 FP8 codes"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">overlay</span>
            {(Object.keys(FMT) as Fmt[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFmt(k)}
                aria-pressed={fmt === k}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  fmt === k ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={fmt === k ? { background: FMT[k].color } : undefined}
              >
                {FMT[k].name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSeed((s) => (s % 6) + 1)}
            className="cursor-pointer rounded-md bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            new weights ({seed}/6)
          </button>
        </div>

        {/* readout */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-normal">format</th>
                <th className="py-1 pr-3 font-normal">bits / weight</th>
                <th className="py-1 pr-3 font-normal">rel. RMS error, all 32</th>
                <th className="py-1 font-normal">block B only</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="py-1 pr-3" style={{ color: FMT[r.key].color }}>
                    {r.label}
                  </td>
                  <td className="py-1 pr-3 text-foreground">{r.bits}</td>
                  <td className="py-1 pr-3 text-foreground">{r.all.toFixed(1)}%</td>
                  <td className="py-1 text-foreground">{r.b.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {summary} The per-tensor scale is g = {nv.g.toPrecision(3)}, which is amax / (6 × 448). Under max
          scaling each block&apos;s largest value lands at 6, give or take the rounding of its FP8 scale code, so
          block B keeps a fine grid however large the outlier in A grows. INT4 here shares one scale across all 32
          values, which is kinder to it than the 128-value blocks of the real recipe.
        </p>
      </div>
    </figure>
  )
}
