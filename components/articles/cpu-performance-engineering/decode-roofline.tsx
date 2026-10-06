"use client"

import { useState } from "react"
import { mlog10 } from "@/lib/dmath"

// Batch-one decode placed on the roofs that usamahz/cpu-performance-engineering
// measured on its Apple M4 Pro (misc/benchmarks/06-roofline, results table):
//   1 thread:   FMA peak 143.7 GFLOP/s, read bandwidth 92.7 GB/s
//   10 threads: FMA peak 1231.1 GFLOP/s, read bandwidth 246.3 GB/s
// Decode at batch one does two flops (a multiply and an add) per weight and reads
// every weight once, so intensity = 2 / bytes-per-weight. Bytes per weight come from
// ggml's block structs (ggml-common.h): q8_0 is 34 bytes per 32 weights, q4_0 is 18.
// The int8 path multiplies the fp32 FMA roof by four, the per-instruction ratio the
// repo's benchmark 13 measures for sdot against fmla; it ignores the nibble unpacking
// a real q4_0 kernel also does, so it is an upper bound. Everything here is
// arithmetic on those measured roofs (reasoned), and it ignores the KV cache,
// attention and activations, so every tok/s figure is a ceiling.

const ACCENT = "oklch(0.62 0.16 250)"
const WARN = "oklch(0.66 0.17 45)"

const ROOFS = {
  1: { peak: 143.7, bw: 92.7, label: "1 thread" },
  10: { peak: 1231.1, bw: 246.3, label: "10 threads" },
} as const

const FORMATS = [
  { id: "f32", label: "f32", bpw: 4 },
  { id: "f16", label: "f16", bpw: 2 },
  { id: "q8_0", label: "q8_0", bpw: 34 / 32 },
  { id: "q4_0", label: "q4_0", bpw: 18 / 32 },
] as const

const PARAMS = [1, 3, 7, 14, 32, 70] as const

const W = 640
const H = 280
const PL = 52
const PR = 16
const PT = 16
const PB = 40
const X0 = -1 // 0.1 flop/B
const X1 = 2 // 100 flop/B
const Y0 = 0 // 1 GFLOP/s
const Y1 = 4 // 10,000 GFLOP/s

const sx = (v: number) => PL + ((mlog10(v) - X0) / (X1 - X0)) * (W - PL - PR)
const sy = (v: number) => H - PB - ((mlog10(v) - Y0) / (Y1 - Y0)) * (H - PT - PB)

const f1 = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1))

export function DecodeRoofline() {
  const [threads, setThreads] = useState<1 | 10>(1)
  const [fmt, setFmt] = useState(3)
  const [pi, setPi] = useState(2)
  const [int8, setInt8] = useState(false)

  const roof = ROOFS[threads]
  const f = FORMATS[fmt]
  const quant = f.id === "q8_0" || f.id === "q4_0"
  const useInt8 = quant && int8
  const peak = roof.peak * (useInt8 ? 4 : 1)
  const P = PARAMS[pi]
  const intensity = 2 / f.bpw
  const ridge = peak / roof.bw
  const attain = Math.min(peak, intensity * roof.bw)
  const gbPerToken = P * f.bpw
  const memTok = roof.bw / gbPerToken
  const cmpTok = peak / (2 * P)
  const memBound = memTok <= cmpTok
  const tok = Math.min(memTok, cmpTok)

  // roof polyline: memory slope up to the ridge, flat after
  const xa = 0.1
  const xr = Math.min(Math.max(ridge, xa), 100)
  const roofPath = `M ${sx(xa).toFixed(1)} ${sy(xa * roof.bw).toFixed(1)} L ${sx(xr).toFixed(1)} ${sy(xr * roof.bw).toFixed(1)} L ${sx(100).toFixed(1)} ${sy(peak).toFixed(1)}`
  const fp32Path =
    useInt8
      ? `M ${sx(roof.peak / roof.bw).toFixed(1)} ${sy(roof.peak).toFixed(1)} L ${sx(100).toFixed(1)} ${sy(roof.peak).toFixed(1)}`
      : null

  const btn = (on: boolean) =>
    `rounded-md border px-2 py-1 font-mono text-xs transition-colors ${on ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>batch-one decode on the repo&apos;s measured M4 Pro roofs</span>
        <span>reasoned &middot; log-log</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">cores</span>
          {([1, 10] as const).map((t) => (
            <button key={t} type="button" className={btn(threads === t)} onClick={() => setThreads(t)}>
              {ROOFS[t].label}
            </button>
          ))}
          <span className="ml-2 font-mono text-xs text-muted-foreground">weights</span>
          {FORMATS.map((x, i) => (
            <button key={x.id} type="button" className={btn(fmt === i)} onClick={() => setFmt(i)}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">model</span>
          {PARAMS.map((p, i) => (
            <button key={p} type="button" className={btn(pi === i)} onClick={() => setPi(i)}>
              {p}B
            </button>
          ))}
          <span className="ml-2 font-mono text-xs text-muted-foreground">arithmetic</span>
          <button type="button" className={btn(!useInt8)} onClick={() => setInt8(false)}>
            fp32 fmla
          </button>
          <button
            type="button"
            className={btn(useInt8)}
            disabled={!quant}
            onClick={() => setInt8(true)}
            title={quant ? "int8 sdot: four times the multiply-adds per instruction" : "only for q8_0 and q4_0"}
          >
            int8 sdot
          </button>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Roofline for ${roof.label}: memory roof ${roof.bw} gigabytes per second, compute roof ${f1(peak)} gigaflops per second, ridge at ${ridge.toFixed(2)} flops per byte. A ${P} billion parameter model in ${f.label} has an intensity of ${intensity.toFixed(2)} flops per byte, so decode is ${memBound ? "memory" : "compute"} bound at about ${f1(tok)} tokens per second.`}
        >
          {[1, 10, 100, 1000, 10000].map((v) => (
            <g key={`y${v}`}>
              <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={PL - 6} y={sy(v) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {v >= 1000 ? `${v / 1000}k` : v}
              </text>
            </g>
          ))}
          {[0.1, 1, 10, 100].map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={PT} y2={H - PB} stroke="var(--border)" strokeWidth={1} />
              <text x={sx(v)} y={H - PB + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
                {v}
              </text>
            </g>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            arithmetic intensity, flop per byte of weights
          </text>
          <text x={PL + 4} y={PT + 10} fontSize={10} className="fill-muted-foreground font-mono">
            GFLOP/s
          </text>

          {fp32Path ? <path d={fp32Path} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="4 3" /> : null}
          <path d={roofPath} fill="none" stroke="var(--foreground)" strokeWidth={2} />
          <line x1={sx(xr)} x2={sx(xr)} y1={sy(peak)} y2={H - PB} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 3" />
          <text x={sx(xr) + 4} y={H - PB - 6} fontSize={9.5} className="fill-muted-foreground font-mono">
            ridge {ridge.toFixed(2)}
          </text>
          <text x={W - PR - 4} y={sy(peak) - 6} textAnchor="end" fontSize={10} className="fill-foreground font-mono">
            {useInt8 ? "int8 roof" : "fp32 FMA roof"} {peak.toFixed(1)}
          </text>

          <line x1={sx(intensity)} x2={sx(intensity)} y1={sy(attain)} y2={H - PB} stroke={memBound ? ACCENT : WARN} strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={sx(intensity)} cy={sy(attain)} r={6} fill={memBound ? ACCENT : WARN} />
          <text x={sx(intensity) + (intensity > 20 ? -10 : 10)} y={sy(attain) + 18} textAnchor={intensity > 20 ? "end" : "start"} fontSize={10.5} fontWeight={700} className="font-mono" style={{ fill: memBound ? ACCENT : WARN }}>
            {f.label}: {intensity.toFixed(2)} flop/B
          </text>
        </svg>

        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">bytes per token</div>
            <div className="text-foreground">{gbPerToken.toFixed(2)} GB</div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">memory ceiling</div>
            <div className="text-foreground">{f1(memTok)} tok/s</div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">compute ceiling</div>
            <div className="text-foreground">{f1(cmpTok)} tok/s</div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">binding roof</div>
            <div style={{ color: memBound ? ACCENT : WARN }}>{memBound ? "memory" : "compute"}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Decode at batch one does two flops per weight and reads each weight once, so its intensity is two divided by
          the bytes per weight. On ten cores the ridge sits at about five flops per byte and every format here is left
          of it: only bytes matter. On one core the ridge drops to 1.55, and a q8_0 or q4_0 model computed with fp32
          FMAs lands right of it. That is why llama.cpp quantizes the activations to q8_0 and multiplies with integer
          dot products. These are ceilings: no KV cache, no attention, no unpacking cost.
        </p>
      </div>
    </figure>
  )
}
