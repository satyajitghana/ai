"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The few-step sampler of one chunk, from rtcwm/model/sampler.py.
//
// - schedule(): steps + 1 levels, linspace(1, 0), flow-shifted by
//   s*t / (1 + (s-1)*t) (rtcwm/model/objectives.py shift()).
// - rule "x0": each step predicts the clean chunk x0 = x + sigma * v, then
//   re-noises it to the next level with fresh noise; the last step returns x0.
// - HISTORY_FROM_LAST_STEP (default when sampling with --kv-reuse): the keys and
//   values cached for later chunks are the ones the chunk's rows had in its last
//   step, whose input sits at sigma[-2]. No extra clean forward.
// - The 4-step student is sampled at shift 5 (README: --shift 5; distill.py
//   STUDENT_SHIFT); the 35-step model uses the released Euler sampler at shift 12
//   (cwm_h3_inference.constants VIDEO_SHIFT).

const shiftOf = (t: number, s: number) => (s * t) / (1 + (s - 1) * t)
const levels = (n: number, s: number) => Array.from({ length: n + 1 }, (_, i) => shiftOf(1 - i / n, s))

const C_STEP = "oklch(0.66 0.17 300)"
const C_HIST = "oklch(0.72 0.16 85)"
const C_REF = "oklch(0.70 0.04 260)"

// Two geometries: the wide track for sm and up, and a narrow one for a phone
// column (~330 px), drawn near 1:1. On the narrow one the level labels
// alternate between two rows and the reference caption wraps, so nothing
// collides or leaves the box.
type Geo = { W: number; H: number; X0: number; X1: number; fs: number; small: number; narrow: boolean }
const WIDE: Geo = { W: 660, H: 170, X0: 40, X1: 620, fs: 10, small: 9, narrow: false }
const NARROW: Geo = { W: 340, H: 186, X0: 20, X1: 318, fs: 10.5, small: 10.5, narrow: true }

export function FourSteps() {
  const [steps, setSteps] = useState(4)
  const [shift, setShift] = useState(5)
  const [lastStep, setLastStep] = useState(true)
  const sig = levels(steps, shift)
  const ref = levels(35, 12)
  const histSigma = lastStep ? sig[steps - 1] : 0
  const forwards = steps + (lastStep ? 0 : 1)

  const track = (g: Geo) => {
    const { W, H, X0, X1, fs, small, narrow } = g
    const xOf = (sigma: number) => X0 + (1 - sigma) * (X1 - X0)
    // narrow: odd level labels drop to a second row; everything below shifts down
    const labY = (i: number) => (narrow && i % 2 === 1 ? 85 : 72)
    const histY = narrow ? 102 : 88
    const refY = narrow ? 172 : 140
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        className={narrow ? "mx-auto block w-full max-w-md sm:hidden" : "hidden w-full max-w-[660px] sm:block"}
      >
        <title>
          {`Noise levels of a ${steps}-step schedule at shift ${shift}: ${sig.map((v) => v.toFixed(3)).join(", ")}. ${
            lastStep
              ? `The chunk enters the cache with the keys and values of its last step, whose input is at noise level ${histSigma.toFixed(3)}.`
              : "The finished chunk is run once more, clean, to fill the cache."
          } Below, the 35-step schedule at shift 12 for comparison.`}
        </title>
        <text x={X0 - (narrow ? 6 : 0)} y={14} className="fill-current font-mono" fontSize={fs} opacity={0.6}>
          noise 1 (pure noise)
        </text>
        <text x={X1 + (narrow ? 6 : 0)} y={14} textAnchor="end" className="fill-current font-mono" fontSize={fs} opacity={0.6}>
          0 (clean)
        </text>
        <line x1={X0} x2={X1} y1={50} y2={50} stroke="currentColor" strokeOpacity={0.25} />
        {sig.slice(0, -1).map((s, i) => {
          const s2 = sig[i + 1]
          const isLast = i === steps - 1
          return (
            <g key={i}>
              <path
                d={`M ${xOf(s)} 48 C ${(xOf(s) + xOf(s2)) / 2} 22, ${(xOf(s) + xOf(s2)) / 2} 22, ${xOf(s2)} 48`}
                fill="none"
                stroke={C_STEP}
                strokeWidth={1.5}
              />
              <circle
                cx={xOf(s)}
                cy={50}
                r={6}
                fill={lastStep && isLast ? C_HIST : C_STEP}
                stroke="currentColor"
                strokeOpacity={0.4}
              />
              <text x={xOf(s)} y={labY(i)} textAnchor="middle" className="fill-current font-mono" fontSize={small}>
                {s.toFixed(3)}
              </text>
              <text x={(xOf(s) + xOf(s2)) / 2} y={30} textAnchor="middle" className="fill-current font-mono" fontSize={small} opacity={0.75}>
                {i + 1}
              </text>
            </g>
          )
        })}
        <circle cx={xOf(0)} cy={50} r={6} fill="transparent" stroke="currentColor" strokeOpacity={0.6} />
        <text x={xOf(0)} y={labY(steps)} textAnchor={narrow ? "end" : "middle"} dx={narrow ? 6 : 0} className="fill-current font-mono" fontSize={small}>
          x0
        </text>
        {lastStep && (
          <text
            x={narrow ? Math.min(X1 - 52, Math.max(X0 + 52, xOf(histSigma))) : xOf(histSigma)}
            y={histY}
            textAnchor="middle"
            className="font-mono"
            fontSize={small}
            fill={C_HIST}
          >
            cached as history
          </text>
        )}

        {narrow ? (
          <text x={X0} y={refY - 32} className="fill-current font-mono" fontSize={fs} opacity={0.6}>
            35 Euler steps, shift 12
            <tspan x={X0} dy={fs * 1.3}>
              (the streaming diffusion-forcing model)
            </tspan>
          </text>
        ) : (
          <text x={X0} y={118} className="fill-current font-mono" fontSize={fs} opacity={0.6}>
            35 Euler steps, shift 12 (the streaming diffusion-forcing model)
          </text>
        )}
        <line x1={X0} x2={X1} y1={refY} y2={refY} stroke="currentColor" strokeOpacity={0.25} />
        {ref.map((s, i) => (
          <line key={i} x1={xOf(s)} x2={xOf(s)} y1={refY - 7} y2={refY + 7} stroke={C_REF} strokeWidth={1.2} />
        ))}
      </svg>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one chunk, x0 rule: predict clean, re-noise, repeat (rtcwm/model/sampler.py)
        </span>
        <div className="flex gap-1.5">
          {(
            [
              [true, "history = last step"],
              [false, "history = clean pass"],
            ] as const
          ).map(([v, name]) => (
            <button
              key={name}
              type="button"
              onClick={() => setLastStep(v)}
              aria-pressed={lastStep === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                lastStep === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-40 text-muted-foreground">student steps: {steps}</span>
          <Range
            min={1}
            max={8}
            step={1}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            accent={C_STEP}
            className="min-w-[160px] flex-1"
            aria-label="Number of sampling steps"
          />
        </label>
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-40 text-muted-foreground">flow shift: {shift}</span>
          <Range
            min={1}
            max={12}
            step={1}
            value={shift}
            onChange={(e) => setShift(Number(e.target.value))}
            accent={C_STEP}
            className="min-w-[160px] flex-1"
            aria-label="Flow shift of the schedule"
          />
        </label>

        {track(WIDE)}
        {track(NARROW)}

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          <p>
            <span className="text-muted-foreground">transformer passes per chunk:</span> {forwards}
          </p>
          <p>
            <span className="text-muted-foreground">history noise level:</span> {histSigma.toFixed(3)}
          </p>
          <p>
            <span className="text-muted-foreground">vs 35 steps:</span> {(35 / forwards).toFixed(1)}x fewer passes
          </p>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          Passes over the chunk&apos;s own rows. When the span slides, the condition rows (caption, start image, proxy) are
          also re-run once.
        </p>
      </div>
    </figure>
  )
}
