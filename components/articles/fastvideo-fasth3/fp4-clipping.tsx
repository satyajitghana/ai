"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"

// Largest input to each block's MLP output projection (ff.fc_out) in FastH3 Trim,
// recovered from the released checkpoint itself: FastVideo stores one static
// activation scale per NVFP4 linear as `::_nvfp4_input_global_sf = 448 * 6 / amax`
// (scripts/checkpoint_conversion/convert_minimax_h3_modelopt_nvfp4_dit.py), so
// amax = 2688 / sf. Read by HTTP range request from
// FastVideo/FastVideo-FastH3-Trim-8-Step-NVFP4, transformer/nvfp4_weights.safetensors.
const AMAX = [
  7808, 12224, 7168, 6496, 11648, 16000, 3552, 2816, 5024, 1728, 1624, 3024, 11008, 3072, 7200, 10240, 4672, 10176,
  8960, 21248, 16256, 13248, 18816, 12032, 15168, 18560, 13952, 15168, 37120, 15232, 30080, 262144, 28160, 16320,
  19712, 28160, 148480, 368640, 47872, 43776, 62464, 141312,
]

// transformer/config.json `kept_block_indices`: Trim block i is H3 block KEPT[i].
const KEPT = [
  0, 1, 2, 3, 4, 5, 8, 10, 11, 12, 14, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
  39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
]

const LIMIT = 6 * 448 // largest E2M1 value x largest E4M3 block scale, with a unit global scale

const W = 700
const H = 230
const X0 = 46
const X1 = 690
const Y0 = 20
const Y1 = 190
const LMIN = 1000
const LMAX = 1_000_000

function py(v: number): number {
  const t = (mlog10(v) - mlog10(LMIN)) / (mlog10(LMAX) - mlog10(LMIN))
  return Y1 - t * (Y1 - Y0)
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

export function Fp4Clipping() {
  const [calibrated, setCalibrated] = useState(false)
  const [sel, setSel] = useState(37)
  const bw = (X1 - X0) / AMAX.length
  const amax = AMAX[sel]
  const over = amax > LIMIT
  const clippedCount = AMAX.filter((a) => a > LIMIT).length

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Activation scale:</span>
        {[
          { v: false, label: "unit (uncalibrated)" },
          { v: true, label: "calibrated per layer" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setCalibrated(o.v)}
            className={cn(
              "rounded-full border px-3 py-1 transition-colors",
              calibrated === o.v ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Largest MLP output-projection input per FastH3 Trim block, log scale, with the 2,688 unit-scale limit">
        {[1000, 10000, 100000, 1000000].map((v) => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={X0 - 6} y={py(v) + 3} textAnchor="end" fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              {v >= 1000000 ? "1M" : `${v / 1000}K`}
            </text>
          </g>
        ))}
        {AMAX.map((a, i) => {
          const x = X0 + i * bw + 1
          const top = py(a)
          const cut = py(LIMIT)
          const clips = !calibrated && a > LIMIT
          return (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
              <rect x={x} y={Y0} width={bw - 2} height={Y1 - Y0} fill="transparent" />
              {/* the part a unit scale can represent */}
              <rect
                x={x}
                y={clips ? cut : top}
                width={bw - 2}
                height={Y1 - (clips ? cut : top)}
                fill="oklch(0.55 0.12 250)"
                fillOpacity={i === sel ? 1 : 0.65}
              />
              {/* the part that is clamped away */}
              {clips && (
                <rect x={x} y={top} width={bw - 2} height={cut - top} fill="oklch(0.6 0.2 27)" fillOpacity={i === sel ? 0.95 : 0.6} />
              )}
              {calibrated && (
                <line x1={x - 1} x2={x + bw - 1} y1={top} y2={top} stroke="oklch(0.6 0.16 150)" strokeWidth={2} />
              )}
            </g>
          )
        })}
        {!calibrated && (
          <g>
            <line x1={X0} x2={X1} y1={py(LIMIT)} y2={py(LIMIT)} stroke="currentColor" strokeDasharray="4 3" strokeOpacity={0.7} />
            <text x={X1} y={py(LIMIT) - 4} textAnchor="end" fontSize={8} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
              2,688 = 6 × 448
            </text>
          </g>
        )}
        {[0, 10, 20, 30, 41].map((i) => (
          <text key={i} x={X0 + i * bw + bw / 2} y={Y1 + 12} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
            {i}
          </text>
        ))}
        <text x={(X0 + X1) / 2} y={Y1 + 28} textAnchor="middle" fontSize={8.5} fill="currentColor" fillOpacity={0.6}>
          Trim block (click one)
        </text>
      </svg>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground">Selected</div>
          <div className="font-mono">
            Trim block {sel} · H3 block {KEPT[sel]}
          </div>
          <div className="font-mono text-xs text-muted-foreground">largest input {fmt(amax)}</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground">{calibrated ? "Stored scale" : "Unit scale"}</div>
          {calibrated ? (
            <div className="font-mono text-xs">
              global sf = 2688 / {fmt(amax)} = {(LIMIT / amax).toPrecision(3)}; range now reaches {fmt(amax)}
            </div>
          ) : over ? (
            <div className="font-mono text-xs">
              clamped at 2,688: the peak is {(amax / LIMIT).toFixed(1)}× the limit, so it arrives at {((LIMIT / amax) * 100).toFixed(1)}% of
              its size
            </div>
          ) : (
            <div className="font-mono text-xs">fits under 2,688; nothing clipped</div>
          )}
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground">Across all 42 blocks</div>
          <div className="font-mono text-xs">
            {calibrated ? "0 blocks clip; 294 layers carry a stored scale" : `${clippedCount} of 42 blocks clip`}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Values recovered from the released Trim NVFP4 checkpoint: each fc_out layer stores 2688 / amax, so the amax can be read back
        from the file. The other 252 calibrated layers (q, k, v, out, gate, fc_in) all peak below 2,688.
      </figcaption>
    </figure>
  )
}
