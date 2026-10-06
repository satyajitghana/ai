"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One row of 32 weights pushed through the four ComfyUI encoders in
// quantui-rs, using the arithmetic read from its source:
//
//   INT8 block   quant.rs:133-188       scale = max(amax/127, 1e-8), round half to even, clamp ±127
//   FP8 block    quant_fp8.rs:83-85     quant_scale = 448 * (1/amax), E4M3 round-to-nearest-even
//   MXFP8        quant_mxfp8.rs:86-106  e8m0 = ceil(log2(amax/448)) + 127 (comfy-kitchen); the OCP
//                                       spec's floor(log2(amax)) - 8 is the toggle
//   NVFP4        quant_nvfp4.rs:187-264 per-tensor s_T = amax_T/(448*6); per-16 block byte =
//                                       E4M3(min((bmax/6)/s_T, 448)); codes = E2M1(v/(s_T*byte))
//   nvfp4_l2     quant_nvfp4.rs:633-677 per-block search over the anchor byte ±4 (the s_T refit is
//                                       left out here; it moves every block at once)
//
// f32 is emulated with Math.fround after every operation. No transcendental
// functions are used: powers of two are built by repeated doubling, so every
// number that reaches the DOM is exact IEEE arithmetic.
//
// The weights are two fixed draws (seeded numpy): a Gaussian row with std 0.02
// and a Laplace row with scale 0.014. Element 7 can be boosted into an outlier.
// INT8 and FP8 in quantui-rs scale a 128x128 tile; here the tile's absmax is
// taken to be this row's absmax, which is the case where the row holds the
// tile's largest value.

const PRESETS: Record<string, { label: string; w: number[] }> = {
  gauss: {
    label: "Gaussian row",
    w: [
      0.0, 0.006, -0.0055, -0.0178, -0.0091, -0.0198, 0.0012, 0.0268, -0.0098, -0.0124, 0.0098,
      0.0071, 0.0021, -0.0186, -0.0006, 0.0139, -0.0269, -0.0092, -0.038, -0.0258, -0.0368,
      -0.0047, -0.0253, 0.0054, 0.0031, -0.0037, -0.0503, -0.0108, -0.001, 0.0023, -0.0306,
      -0.0096,
    ],
  },
  laplace: {
    label: "heavy-tailed row",
    w: [
      -0.0134, 0.0068, -0.0128, -0.0042, -0.0686, 0.0151, -0.0164, -0.0088, 0.02, 0.0003, 0.0166,
      0.0046, 0.0093, -0.0238, 0.0012, 0.0002, 0.019, -0.0045, 0.0031, -0.0299, -0.0036, -0.0061,
      -0.0168, 0.014, -0.0039, 0.0442, 0.0028, 0.0033, 0.0045, 0.0061, -0.0168, -0.0018,
    ],
  },
}

const OUTLIER_INDEX = 7
// Absmax of the whole tensor, which sets NVFP4's FP32 per-tensor scale. A real
// layer's largest weight sits far above any one row's; 0.12 is a plausible
// stand-in for a matrix of std 0.02.
const TENSOR_AMAX = 0.12

const f = Math.fround

function pow2(e: number): number {
  let v = 1
  if (e >= 0) for (let i = 0; i < e; i++) v *= 2
  else for (let i = 0; i < -e; i++) v /= 2
  return v
}

// E4M3 (float8_e4m3fn) positive finite values, codes 0..126.
const E4M3: number[] = Array.from({ length: 127 }, (_, c) => {
  const e = c >> 3
  const m = c & 7
  return e === 0 ? (m / 8) * pow2(-6) : (1 + m / 8) * pow2(e - 7)
})

// Round-to-nearest-even onto a sorted grid; ties go to the even index.
function nearestEven(grid: number[], a: number): number {
  if (a <= grid[0]) return 0
  const last = grid.length - 1
  if (a >= grid[last]) return last
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (grid[mid] <= a) lo = mid
    else hi = mid
  }
  const dl = a - grid[lo]
  const dh = grid[hi] - a
  if (dl < dh) return lo
  if (dh < dl) return hi
  return lo % 2 === 0 ? lo : hi
}

const e4m3Code = (a: number) => nearestEven(E4M3, Math.min(Math.abs(a), 448))
const E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6]

function roundHalfEven(x: number): number {
  const fl = Math.floor(x)
  const d = x - fl
  if (d < 0.5) return fl
  if (d > 0.5) return fl + 1
  return fl % 2 === 0 ? fl : fl + 1
}

const absmax = (xs: number[]) => xs.reduce((a, v) => Math.max(a, Math.abs(v)), 0)

type Scale = { label: string; byte?: string; value: string }
type Result = { rec: number[]; scales: Scale[]; clipped: boolean[]; bpw: string; note: string }

const hex = (b: number) => "0x" + b.toString(16).toUpperCase().padStart(2, "0")

function encInt8(w: number[]): Result {
  const s = f(Math.max(f(absmax(w) / 127), 1e-8))
  const rec = w.map((v) => {
    const q = Math.max(-127, Math.min(127, roundHalfEven(f(v / s))))
    return f(q * s)
  })
  return {
    rec,
    scales: [{ label: "tile scale (F32)", value: s.toExponential(3) }],
    clipped: w.map(() => false),
    bpw: "8.00",
    note: "255 evenly spaced levels between ±absmax; the step is absmax/127 everywhere.",
  }
}

function encFp8(w: number[]): Result {
  const qs = f(448 * f(1 / Math.max(absmax(w), 1e-12)))
  const deq = f(1 / qs)
  const rec = w.map((v) => {
    const x = f(v * qs)
    const c = e4m3Code(x)
    return f(Math.sign(x) * E4M3[c] * deq)
  })
  return {
    rec,
    scales: [{ label: "tile scale (F32, stored as 1/quant_scale)", value: deq.toExponential(3) }],
    clipped: w.map(() => false),
    bpw: "8.00",
    note: "A float grid: 8 steps per octave, so small weights keep relative precision.",
  }
}

function encMxfp8(w: number[], rule: "ceil" | "floor"): Result {
  const amax = absmax(w)
  let e: number
  if (rule === "ceil") {
    // smallest e with 2^e >= amax/448
    const need = f(amax / 448)
    e = 0
    while (pow2(e) < need) e++
    while (e > -127 && pow2(e - 1) >= need) e--
  } else {
    // OCP MX v1.0: floor(log2(amax)) - emax(E4M3 = 8)
    let k = 0
    while (pow2(k) > amax) k--
    while (pow2(k + 1) <= amax) k++
    e = k - 8
  }
  const scale = pow2(e)
  const clipped: boolean[] = []
  const rec = w.map((v) => {
    const x = f(v / scale)
    clipped.push(Math.abs(x) > 448)
    const c = e4m3Code(x)
    return f(Math.sign(x) * E4M3[c] * scale)
  })
  return {
    rec,
    scales: [{ label: "block scale (E8M0)", byte: hex(e + 127), value: `2^${e}` }],
    clipped,
    bpw: "8.25",
    note:
      rule === "ceil"
        ? "Rounding the exponent up guarantees the block max lands at or under 448: nothing clips, but up to one octave of range goes unused."
        : "The spec's floor rule uses the full range, and any value past 448 saturates.",
  }
}

function nvBlock(block: number[], pts: number, search: boolean) {
  const bmax = absmax(block)
  const scaled = Math.min(f(f(bmax / 6) / pts), 448)
  const anchor = e4m3Code(scaled)
  const encodeAt = (byte: number) => {
    const total = f(pts * E4M3[byte])
    let sse = 0
    const rec: number[] = []
    const clip: boolean[] = []
    for (const v of block) {
      if (total === 0) {
        rec.push(0)
        clip.push(false)
        sse += v * v
        continue
      }
      const d = f(v / total)
      clip.push(Math.abs(d) > 6)
      const q = Math.sign(d) * E2M1[nearestEven(E2M1, Math.min(Math.abs(d), 6))]
      const r = f(q * total)
      rec.push(r)
      sse += (v - r) * (v - r)
    }
    return { byte, total, rec, clip, sse }
  }
  let best = encodeAt(anchor)
  if (search) {
    for (let b = Math.max(0, anchor - 4); b <= Math.min(126, anchor + 4); b++) {
      if (b === anchor) continue
      const c = encodeAt(b)
      if (c.sse < best.sse) best = c
    }
  }
  return { anchor, ...best }
}

function encNvfp4(w: number[], search: boolean): Result {
  const tAmax = Math.max(TENSOR_AMAX, absmax(w))
  const pts = f(tAmax / f(448 * 6))
  const a = nvBlock(w.slice(0, 16), pts, search)
  const b = nvBlock(w.slice(16), pts, search)
  const fmt = (blk: typeof a, i: number): Scale => ({
    label: `block ${i} scale (E4M3)`,
    byte: blk.byte === blk.anchor ? hex(blk.byte) : `${hex(blk.anchor)} → ${hex(blk.byte)}`,
    value: `${E4M3[blk.byte]} × s_T`,
  })
  return {
    rec: [...a.rec, ...b.rec],
    scales: [
      { label: "tensor scale s_T (F32)", value: pts.toExponential(3) },
      fmt(a, 0),
      fmt(b, 1),
    ],
    clipped: [...a.clip, ...b.clip],
    bpw: "4.50",
    note: search
      ? "nvfp4_l2: each block tries the eight E4M3 bytes around its anchor and keeps the one with the lowest squared error."
      : "Parity path: the block scale is rounded to the nearest E4M3 value, so about half the time it rounds down and the block max clips at 6.",
  }
}

const FORMATS = [
  { key: "int8", label: "INT8 block" },
  { key: "fp8", label: "FP8 E4M3 block" },
  { key: "mxfp8", label: "MXFP8" },
  { key: "nvfp4", label: "NVFP4" },
] as const
type Fmt = (typeof FORMATS)[number]["key"]

const COLOR: Record<Fmt, string> = {
  int8: "oklch(0.58 0.13 250)",
  fp8: "oklch(0.6 0.13 160)",
  mxfp8: "oklch(0.6 0.15 70)",
  nvfp4: "oklch(0.58 0.17 25)",
}

export function BlockLab() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>("gauss")
  const [fmt, setFmt] = useState<Fmt>("nvfp4")
  const [boost, setBoost] = useState(1)
  const [mxRule, setMxRule] = useState<"ceil" | "floor">("ceil")
  const [search, setSearch] = useState(false)

  const w = useMemo(() => {
    const base = PRESETS[preset].w.slice()
    base[OUTLIER_INDEX] = f(base[OUTLIER_INDEX] * boost)
    return base
  }, [preset, boost])

  const res = useMemo(() => {
    if (fmt === "int8") return encInt8(w)
    if (fmt === "fp8") return encFp8(w)
    if (fmt === "mxfp8") return encMxfp8(w, mxRule)
    return encNvfp4(w, search)
  }, [fmt, w, mxRule, search])

  const sse = w.reduce((a, v, i) => a + (v - res.rec[i]) * (v - res.rec[i]), 0)
  const energy = w.reduce((a, v) => a + v * v, 0)
  const rel = Math.sqrt(sse / energy)
  const nClip = res.clipped.filter(Boolean).length

  const W = 640
  const H = 236
  const x0 = 34
  const step = (W - x0 - 10) / 32
  const mid = 104
  const ymax = absmax(w) * 1.08
  const Y = (v: number) => mid - (v / ymax) * 92
  const errs = w.map((v, i) => Math.abs(v - res.rec[i]))
  const emax = Math.max(...errs, 1e-9)
  const col = COLOR[fmt]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          32 weights through quantui-rs&apos;s encoders
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {FORMATS.find((x) => x.key === fmt)?.label} · {res.bpw} bits/weight
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Bar chart of 32 weights, original as outlines and the ${fmt} reconstruction as filled bars, with the absolute error of each weight drawn underneath.`}
        >
          <line x1={x0} y1={mid} x2={W - 8} y2={mid} stroke="var(--border)" />
          {fmt === "nvfp4" && (
            <>
              <line x1={x0 + 16 * step} y1={8} x2={x0 + 16 * step} y2={H - 44} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <text x={x0 + 4} y={14} className="fill-muted-foreground font-mono text-[9px]">block 0 (16)</text>
              <text x={x0 + 16 * step + 4} y={14} className="fill-muted-foreground font-mono text-[9px]">block 1 (16)</text>
            </>
          )}
          {fmt === "mxfp8" && (
            <text x={x0 + 4} y={14} className="fill-muted-foreground font-mono text-[9px]">one MX block (32), one E8M0 exponent</text>
          )}
          {w.map((v, i) => {
            const cx = x0 + i * step
            const r = res.rec[i]
            return (
              <g key={i}>
                <rect x={cx + 2} y={Math.min(Y(v), mid)} width={step - 4} height={Math.max(0.5, Math.abs(Y(v) - mid))}
                  fill="none" stroke="var(--foreground)" strokeOpacity={0.55} />
                <rect x={cx + 5} y={Math.min(Y(r), mid)} width={step - 10} height={Math.max(0.5, Math.abs(Y(r) - mid))}
                  fill={col} fillOpacity={0.8} />
                {res.clipped[i] && (
                  <text x={cx + step / 2} y={v >= 0 ? Y(v) - 3 : Y(v) + 10} textAnchor="middle" className="font-mono text-[9px]" fill={col}>
                    clip
                  </text>
                )}
                <rect x={cx + 3} y={H - 34 - (errs[i] / emax) * 22} width={step - 6} height={(errs[i] / emax) * 22 + 0.5}
                  fill="var(--muted-foreground)" fillOpacity={0.5} />
              </g>
            )
          })}
          <text x={x0 + OUTLIER_INDEX * step + step / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            #7
          </text>
          <text x={4} y={H - 22} className="fill-muted-foreground font-mono text-[9px]">|err|</text>
          <text x={4} y={mid + 3} className="fill-muted-foreground font-mono text-[9px]">0</text>
        </svg>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FORMATS.map((x) => (
            <button key={x.key} type="button" onClick={() => setFmt(x.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                x.key === fmt && "bg-muted/40 text-foreground"
              )}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} type="button" onClick={() => setPreset(k)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                k === preset && "bg-muted/40 text-foreground"
              )}>
              {p.label}
            </button>
          ))}
          {fmt === "mxfp8" && (
            <button type="button" onClick={() => setMxRule(mxRule === "ceil" ? "floor" : "ceil")}
              className="rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30">
              exponent: {mxRule === "ceil" ? "ceil (comfy-kitchen)" : "floor (OCP spec)"}
            </button>
          )}
          {fmt === "nvfp4" && (
            <button type="button" onClick={() => setSearch(!search)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                search && "bg-muted/40 text-foreground"
              )}>
              {search ? "nvfp4_l2 search on" : "nvfp4 (parity)"}
            </button>
          )}
        </div>

        <label className="mt-3 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-28 shrink-0">weight #7 × {boost.toFixed(1)}</span>
          <Range min={1} max={12} step={0.5} value={boost} accent={col}
            onChange={(e) => setBoost(Number(e.target.value))} className="flex-1" />
        </label>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] sm:grid-cols-4">
          {res.scales.map((s) => (
            <div key={s.label}>
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="tabular-nums">{s.byte ? `${s.byte} = ${s.value}` : s.value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-muted-foreground">relative L2 error</dt>
            <dd className="tabular-nums">{(rel * 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">clipped weights</dt>
            <dd className="tabular-nums">{nClip}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{res.note}</p>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        Outlines are the input weights, filled bars the decoded values, grey bars underneath the per-weight error.
        The encoders are re-implementations of quantui-rs&apos;s arithmetic in f32; the rows are fixed random draws,
        not weights from a real model.
      </figcaption>
    </figure>
  )
}
