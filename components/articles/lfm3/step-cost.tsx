"use client"

import { useState } from "react"

import { mlog2 } from "@/lib/dmath"

import { BENCH, BENCH_FIXED } from "./data"

// Decode-step cost against context length, on CPU, from public/articles/lfm3/bench_layers.py (measured). Random
// weights of the real shapes, int8 dynamic linears, fp32 attention, 2 threads, on a shared 4-vCPU box whose load
// average was about 10 to 12, so the milliseconds are inflated and noisy and the ratio is the thing to read. Each
// primitive is the best of three runs. The all-full line is a hypothetical stack of 24 full-attention layers.

const C_LFM = "oklch(0.62 0.17 35)"
const C_REF = "oklch(0.6 0.02 260)"

const W = 560
const H = 220
const PAD = { l: 52, r: 16, t: 14, b: 34 }

export function StepCost() {
  const [i, setI] = useState(BENCH.length - 1)
  const row = BENCH[i]
  const maxMs = Math.max(...BENCH.map((r) => r.all_full_24_step_ms)) * 1.05
  const x0 = mlog2(BENCH[0].context)
  const x1 = mlog2(BENCH[BENCH.length - 1].context)
  const X = (n: number) => PAD.l + ((mlog2(n) - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
  const Y = (ms: number) => H - PAD.b - (ms / maxMs) * (H - PAD.t - PAD.b)
  const path = (key: "lfm3_step_ms" | "all_full_24_step_ms") => BENCH.map((r, k) => `${k === 0 ? "M" : "L"}${X(r.context).toFixed(1)},${Y(r[key]).toFixed(1)}`).join(" ")
  const fmtCtx = (n: number) => (n >= 1024 ? `${n / 1024}K` : String(n))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one decode step vs context · CPU microbenchmark, measured</span>
        <span className="flex gap-3 font-mono text-xs">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: C_LFM }} />
            LFM3 layout
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: C_REF }} />
            24 full layers
          </span>
        </span>
      </div>
      <div className="space-y-3 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Decode step time against context length for the LFM3 layer layout and a stack of 24 full-attention layers">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(maxMs * f)} y2={Y(maxMs * f)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={PAD.l - 6} y={Y(maxMs * f) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
                {Math.round(maxMs * f)}
              </text>
            </g>
          ))}
          {BENCH.map((r) => (
            <text key={r.context} x={X(r.context)} y={H - 14} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              {fmtCtx(r.context)}
            </text>
          ))}
          <text x={12} y={12} className="fill-muted-foreground" fontSize={10}>
            ms per token
          </text>
          <path d={path("all_full_24_step_ms")} fill="none" stroke={C_REF} strokeWidth={2} />
          <path d={path("lfm3_step_ms")} fill="none" stroke={C_LFM} strokeWidth={2.5} />
          {BENCH.map((r, k) => (
            <g key={r.context}>
              <circle cx={X(r.context)} cy={Y(r.all_full_24_step_ms)} r={k === i ? 5 : 3} fill={C_REF} />
              <circle cx={X(r.context)} cy={Y(r.lfm3_step_ms)} r={k === i ? 5.5 : 3.5} fill={C_LFM} />
            </g>
          ))}
        </svg>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Context length">
          {BENCH.map((r, k) => (
            <button
              key={r.context}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={k === i}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${k === i ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {fmtCtx(r.context)}
            </button>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">LFM3 layout</dt>
            <dd className="text-sm">{row.lfm3_step_ms} ms</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">24 full layers</dt>
            <dd className="text-sm">{row.all_full_24_step_ms} ms</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">attention core, 1 layer</dt>
            <dd className="text-sm">{row.attn_core_ms} ms</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">ratio</dt>
            <dd className="text-sm">{row.ratio.toFixed(2)}x</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Fixed cost per layer, best of three: {BENCH_FIXED.conv} ms for a convolution layer, {BENCH_FIXED.attn} ms for an attention layer before its attention core, {BENCH_FIXED.head} ms for the output layer. The box was loaded, so treat the absolute numbers as inflated and the shape as the result.
        </p>
      </div>
    </figure>
  )
}
