"use client"

import { useState } from "react"

// The idea in one control. Every layer's MLP hidden width is drawn as a bar. At
// taper 0 the model is the usual uniform stack — every layer identical. Drag the
// taper up and a cosine schedule shifts width toward the early layers and away from
// the late ones, while the TOTAL parameter budget (the sum of the widths) stays
// fixed. Same params, front-loaded. Renders meaningfully without JS at the default.

const L = 12

// cosine taper: f(l) runs 1 (layer 0) -> 0 (layer L-1); (2f-1) has ~zero mean over
// the stack, so scaling width by (1 + s*(2f-1)) preserves the total width budget.
function widths(s: number) {
  const f = (l: number) => 0.5 * (1 + Math.cos((Math.PI * l) / (L - 1)))
  return Array.from({ length: L }, (_, l) => 1 + s * (2 * f(l) - 1))
}

const hue = (l: number) => 250 - (l / (L - 1)) * 60 // early = violet, late = teal

// scene geometry (viewBox units)
const W = 600
const H = 236
const padL = 30
const padR = 16
const padT = 22
const padB = 34
const VMAX = 1.9
const slot = (W - padL - padR) / L
const baseY = H - padB
const sy = (v: number) => padT + (1 - v / VMAX) * (H - padT - padB)

export function TaperSchedule() {
  const [s, setS] = useState(0.5) // 3:1 early:late — the paper's optimal 1.5×/0.5× config
  const w = widths(s)
  const total = w.reduce((a, b) => a + b, 0)
  const relTotal = (total / L).toFixed(2) // 1.00 at any taper — budget is conserved
  const ratio = (w[0] / w[L - 1]).toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        MLP width across depth · same total budget, redistributed
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`MLP hidden width by layer depth. Taper strength ${s.toFixed(2)} gives an early-to-late width ratio of ${ratio} to 1, with the total budget conserved at ${relTotal} times uniform.`}>
          <defs>
            <filter id="ts-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* gridlines */}
          {[0.5, 1, 1.5].map((v) => (
            <line key={v} x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="currentColor" strokeOpacity="0.08" />
          ))}
          {/* uniform reference */}
          <line x1={padL} y1={sy(1)} x2={W - padR} y2={sy(1)} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 4" />
          <text x={W - padR} y={sy(1) - 5} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize="9">uniform width</text>

          {/* baseline */}
          <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="currentColor" strokeOpacity="0.25" />

          {/* bars */}
          {w.map((width, l) => {
            const bw = slot * 0.6
            const x = padL + l * slot + (slot - bw) / 2
            const y = sy(width)
            return (
              <rect key={l} x={x} y={y} width={bw} height={baseY - y} rx={3} fill={`oklch(0.7 0.13 ${hue(l)})`} opacity={0.92} filter="url(#ts-soft)" className="transition-all duration-300" />
            )
          })}

          {/* x labels */}
          {[0, 3, 6, 9, 11].map((l) => (
            <text key={l} x={padL + l * slot + slot / 2} y={baseY + 14} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">L{l}</text>
          ))}
          <text x={W / 2} y={H - 3} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">layer depth →</text>
        </svg>

        {/* control */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>taper strength</span>
            <span className="tabular-nums text-foreground">{s === 0 ? "uniform" : `${ratio}:1 early:late`}</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.7}
            step={0.02}
            value={s}
            onChange={(e) => setS(Number(e.target.value))}
            className="w-full cursor-pointer accent-[oklch(0.7_0.13_250)]"
            aria-label="taper strength"
          />
        </div>

        {/* readout */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>total MLP params <span className="text-foreground">{relTotal}×</span> — held fixed</span>
          <span>early : late width <span className="text-foreground">{s === 0 ? "1.0 : 1.0" : `${ratio} : 1`}</span></span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {s === 0
            ? "Uniform: every layer gets identical MLP width — the default no one questions."
            : "Tapered: a cosine schedule pours width into the early layers and thins the late ones. The total stays exactly the same — this is a redistribution of a fixed budget, not extra parameters, so FLOPs and param count don't change."}
        </p>
      </div>
    </figure>
  )
}
