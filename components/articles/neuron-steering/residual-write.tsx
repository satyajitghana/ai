"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { COL_NORM_MEDIAN, NEURON_A, RESID_MEDIAN } from "./data"

// The geometry of one steering write. Every number comes from the run on
// Qwen3-0.6B (28 layers): RESID_MEDIAN[l] is the median norm of the residual
// stream leaving layer l over 140 short prompts (tokens 1: only), and
// COL_NORM_MEDIAN[l] is the median L2 norm of the columns of that layer's
// down_proj. The push is dose x RESID_MEDIAN[l] along one unit column of
// W_down; the activation shift it needs is that push divided by the column's
// own norm, which is what the recipe's denominator is.

const ACCENT = "oklch(0.62 0.16 35)"
const STREAM = "oklch(0.60 0.15 255)"
const FIXED_PUSH = 20

type Mode = "relative" | "fixed"

const LAYERS = RESID_MEDIAN.length
const LMIN = mlog10(RESID_MEDIAN[0])
const LMAX = mlog10(RESID_MEDIAN[LAYERS - 1])

function barLen(norm: number, max: number) {
  const t = (mlog10(Math.max(norm, 1)) - LMIN + 0.25) / (LMAX - LMIN + 0.25)
  return Math.max(2, Math.min(1, t) * max)
}

export function ResidualWrite() {
  const [layer, setLayer] = useState(16)
  const [dosePct, setDosePct] = useState(30)
  const [mode, setMode] = useState<Mode>("relative")

  const dose = dosePct / 100
  const resid = RESID_MEDIAN[layer]
  const push = mode === "relative" ? dose * resid : FIXED_PUSH
  const ratio = push / resid
  const colMed = COL_NORM_MEDIAN[layer]
  const actShift = push / colMed
  const isA = layer === NEURON_A.layer
  const actShiftA = push / NEURON_A.colNorm

  // vector panel geometry: the residual arrow is always 150 px, the push scales with the ratio
  const VX = 470
  const VY = 250
  const R = 150
  const rawLen = ratio * R
  const clipped = rawLen > 215
  const pushLen = Math.min(rawLen, 215)
  const px = VX + pushLen * 0.6
  const py = VY - pushLen * 0.8

  const BAR_X = 48
  const BAR_W = 230
  const ROW = 15.4

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one down_proj write · Qwen3-0.6B, 28 layers · measured
        </span>
        <div className="flex gap-1">
          {(["relative", "fixed"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "relative" ? "dose x residual norm" : `fixed push of ${FIXED_PUSH}`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 720 470" role="img" className="h-auto w-full">
          <title>
            Left: the median residual norm leaving each of the 28 layers, on a log scale, with the size of the current
            push marked on every row. Right: at the chosen layer, the residual vector as a fixed-length arrow and the
            pushed vector drawn at its true ratio to it.
          </title>
          {RESID_MEDIAN.map((r, i) => {
            const y = 16 + i * ROW
            const on = i === layer
            return (
              <g key={i}>
                <text x={BAR_X - 8} y={y + 8} textAnchor="end" fontSize={8.5} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={on ? 1 : 0.45}>
                  L{i}
                </text>
                <rect x={BAR_X} y={y} width={barLen(r, BAR_W)} height={ROW - 4} rx={2} fill={STREAM} fillOpacity={on ? 0.9 : 0.25} />
                {/* push marker at this layer under the current convention */}
                <circle
                  cx={BAR_X + barLen(mode === "relative" ? dose * r : FIXED_PUSH, BAR_W)}
                  cy={y + (ROW - 4) / 2}
                  r={on ? 3.6 : 2.4}
                  fill={ACCENT}
                  fillOpacity={on ? 1 : 0.7}
                />
                {on && (
                  <text x={BAR_X + BAR_W + 12} y={y + 9} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor">
                    ‖resid‖ {r.toFixed(1)}
                  </text>
                )}
              </g>
            )
          })}
          <text x={BAR_X} y={462} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.5}>
            bar = median residual norm (log); dot = the push under the chosen rule
          </text>

          {/* vector panel */}
          <line x1={VX - 40} y1={VY} x2={VX + R} y2={VY} stroke={STREAM} strokeWidth={3} />
          <polygon points={`${VX + R},${VY} ${VX + R - 9},${VY - 5} ${VX + R - 9},${VY + 5}`} fill={STREAM} />
          <text x={VX + R / 2 - 20} y={VY + 18} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.7}>
            residual, norm {resid.toFixed(1)} (drawn at 150 px)
          </text>
          <line x1={VX} y1={VY} x2={px} y2={py} stroke={ACCENT} strokeWidth={3} strokeDasharray={clipped ? "7 4" : undefined} />
          <circle cx={px} cy={py} r={4.5} fill={ACCENT} />
          <text x={VX + 12} y={VY - 126} fontSize={10} fontFamily="ui-monospace, monospace" fill={ACCENT}>
            + push along W_down[:, n]
          </text>
          <text x={VX + 12} y={VY - 112} fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.7}>
            {clipped ? "off scale: " : ""}
            {ratio.toFixed(2)} x the residual
          </text>
        </svg>

        <div className="mt-2 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <label className="flex items-center gap-3">
            <span className="w-14 text-muted-foreground">layer</span>
            <Range min={0} max={LAYERS - 1} step={1} value={layer} onChange={(e) => setLayer(Number(e.target.value))} aria-label="Layer" />
            <span className="w-8 text-right">L{layer}</span>
          </label>
          <label className={cn("flex items-center gap-3", mode === "fixed" && "opacity-40")}>
            <span className="w-14 text-muted-foreground">dose</span>
            <Range min={0} max={150} step={5} value={dosePct} disabled={mode === "fixed"} onChange={(e) => setDosePct(Number(e.target.value))} aria-label="Dose" accent={ACCENT} />
            <span className="w-8 text-right">{dose.toFixed(2)}</span>
          </label>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["push norm", push.toFixed(1)],
            ["push / residual", ratio.toFixed(2)],
            ["median ‖W_down col‖", colMed.toFixed(2)],
            ["activation shift, median neuron", actShift.toFixed(1)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {isA
            ? `At L${NEURON_A.layer} the neuron N${NEURON_A.n} has a column norm of ${NEURON_A.colNorm.toFixed(2)}, so this push moves its activation by ${actShiftA.toFixed(1)}. `
            : "Slide to layer 16 to see the neuron this article steers. "}
          A fixed push of {FIXED_PUSH} is {(FIXED_PUSH / RESID_MEDIAN[0]).toFixed(1)} x the residual at L0 and{" "}
          {(FIXED_PUSH / RESID_MEDIAN[LAYERS - 1]).toFixed(2)} x at L{LAYERS - 1}; the relative dose is the same fraction everywhere.
        </p>
      </div>
    </figure>
  )
}
