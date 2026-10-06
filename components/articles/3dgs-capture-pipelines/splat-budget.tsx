"use client"

// Two budgets a capture pipeline has to fit, as plain arithmetic.
//
// 1. Size and training memory vs splat count and SH degree (REASONED).
//    A 3DGS PLY stores per splat: xyz 3, normals 3, f_dc 3, f_rest 3*((d+1)^2 - 1),
//    opacity 1, scale 3, rotation 4 float32s. d = 0..3 gives 17, 26, 41, 62 floats,
//    i.e. 68, 104, 164, 248 bytes (248 B at SH3 matches the site's SOG article).
//    Training holds the parameters (no normals: 14, 23, 38, 59 floats) four times
//    over in fp32 — value, gradient, Adam m, Adam v — which is a naive count:
//    LichtFeld Studio quantises the higher-order SH by default (LFS_SH_VALUE_QUANT), and image buffers,
//    rasteriser scratch and the densification bookkeeping come on top.
//
// 2. Frame time on a Pixel 7 Pro in Chrome/WebGPU (REPORTED by @slimbuck7):
//    stochastic rendering 7.5 ms for the whole frame, against 19.5 ms for the
//    sort alone in the sorted path. Refresh budgets are 1000/Hz.
//
// SSR-safe: only + - * / on numbers, no Math.pow/exp/log.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

const PLY_FLOATS = [17, 26, 41, 62]
const TRAIN_FLOATS = [14, 23, 38, 59]
const HZ = [60, 90, 120]

const A = "oklch(0.62 0.15 200)"
const B = "oklch(0.66 0.16 40)"
const MUTED = "oklch(0.62 0.03 255)"

function gb(bytes: number) {
  return (bytes / 1e9).toFixed(2)
}

export function SplatBudget() {
  const [millions, setMillions] = useState(15)
  const [sh, setSh] = useState(2)
  const [hz, setHz] = useState(60)

  const n = millions * 1e6
  const plyB = PLY_FLOATS[sh] * 4
  const trainB = TRAIN_FLOATS[sh] * 4 * 4
  const ply = n * plyB
  const train = n * trainB

  // bars for the four SH degrees at the chosen count, in GB of training state
  const maxTrain = n * TRAIN_FLOATS[3] * 16
  const W = 640
  const BAR_X = 70
  const BAR_W = 470

  const budget = 1000 / hz
  const FT_MAX = 22
  const ftScale = BAR_W / FT_MAX

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>splat budget: bytes on disk, bytes in training, ms per frame</span>
        <span className="text-muted-foreground/60">reasoned · reported</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-xs text-muted-foreground">
            splats: <span className="text-foreground">{millions.toFixed(1)} M</span>
            <Range min={1} max={20} step={0.5} value={millions} onChange={(e) => setMillions(Number(e.target.value))} accent={A} className="mt-1 w-full" />
          </label>
          <div className="font-mono text-xs text-muted-foreground">
            SH degree
            <div className="mt-1 flex gap-1.5">
              {[0, 1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSh(d)}
                  aria-pressed={sh === d}
                  className={"rounded border px-2.5 py-0.5 " + (sh === d ? "text-background" : "bg-background/50")}
                  style={sh === d ? { background: A, borderColor: A } : undefined}
                >
                  SH{d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} 150`} className="w-full" role="img" aria-label={`Naive fp32 training state at ${millions.toFixed(1)} million splats for SH degree 0 to 3. Selected SH${sh}: ${gb(train)} GB of training state and a ${gb(ply)} GB PLY.`}>
          <text x={BAR_X} y={14} fontSize={10} className="fill-muted-foreground font-mono">
            training state, fp32 value + grad + Adam m + v (GB)
          </text>
          {[0, 1, 2, 3].map((d) => {
            const v = n * TRAIN_FLOATS[d] * 16
            const y = 24 + d * 28
            const on = d === sh
            return (
              <g key={d} onClick={() => setSh(d)} style={{ cursor: "pointer" }}>
                <text x={12} y={y + 14} fontSize={11} className="fill-foreground font-mono" fillOpacity={on ? 1 : 0.6}>
                  SH{d}
                </text>
                <rect x={BAR_X} y={y + 2} width={(v / maxTrain) * BAR_W} height={18} rx={2} fill={on ? A : MUTED} fillOpacity={on ? 0.85 : 0.4} />
                <text x={BAR_X + (v / maxTrain) * BAR_W + 6} y={y + 15} fontSize={10} className="fill-muted-foreground font-mono">
                  {gb(v)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          SH{sh}: <span className="text-foreground">{plyB} B/splat</span> in a float PLY →{" "}
          <span className="text-foreground">{gb(ply)} GB</span> on disk; <span className="text-foreground">{trainB} B/splat</span> of
          optimiser state → <span className="text-foreground">{gb(train)} GB</span> before images, rasteriser scratch or
          densification bookkeeping. A naive count: LichtFeld Studio quantises the higher-order SH by default.
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
            <span>Pixel 7 Pro, Chrome / WebGPU (ms)</span>
            <span className="flex gap-1.5">
              {HZ.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHz(h)}
                  aria-pressed={hz === h}
                  className={"rounded border px-2 py-0.5 " + (hz === h ? "text-background" : "bg-background/50")}
                  style={hz === h ? { background: B, borderColor: B } : undefined}
                >
                  {h} Hz
                </button>
              ))}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} 96`} className="mt-1 w-full" role="img" aria-label={`Stochastic rendering takes 7.5 milliseconds for a whole frame; the sort alone in the sorted path takes 19.5 milliseconds. The ${hz} hertz frame budget is ${budget.toFixed(1)} milliseconds.`}>
            {[
              { label: "stochastic", sub: "whole frame", v: 7.5, c: A },
              { label: "sorted", sub: "sort alone", v: 19.5, c: MUTED },
            ].map((r, k) => {
              const y = 8 + k * 32
              return (
                <g key={r.label}>
                  <text x={12} y={y + 14} fontSize={11} className="fill-foreground font-mono">
                    {r.label}
                  </text>
                  <rect x={BAR_X + 16} y={y + 2} width={r.v * ftScale} height={18} rx={2} fill={r.c} fillOpacity={0.8} />
                  <text x={BAR_X + 16 + r.v * ftScale + 6} y={y + 15} fontSize={10} className="fill-muted-foreground font-mono">
                    {r.v} ms · {r.sub}
                  </text>
                </g>
              )
            })}
            <line x1={BAR_X + 16 + budget * ftScale} x2={BAR_X + 16 + budget * ftScale} y1={4} y2={74} stroke={B} strokeWidth={2} strokeDasharray="4 3" />
            <text x={BAR_X + 16 + budget * ftScale} y={88} fontSize={10} textAnchor="middle" fill={B} className="font-mono">
              {hz} Hz budget {budget.toFixed(1)} ms
            </text>
          </svg>
          <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">
            {19.5 > budget ? "The sort alone overruns this budget" : "The sort alone fits this budget"};{" "}
            {7.5 <= budget ? "the stochastic frame fits it." : "the stochastic frame does not."}
          </p>
        </div>
      </div>
    </figure>
  )
}
