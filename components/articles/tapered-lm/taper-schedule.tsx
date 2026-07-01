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

export function TaperSchedule() {
  const [s, setS] = useState(0.5) // 3:1 early:late — the paper's optimal 1.5×/0.5× config
  const w = widths(s)
  const total = w.reduce((a, b) => a + b, 0)
  const relTotal = (total / L).toFixed(2) // 1.00 at any taper — budget is conserved
  const ratio = (w[0] / w[L - 1]).toFixed(1)

  const hue = (l: number) => 250 - (l / (L - 1)) * 60 // early = violet, late = teal

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        MLP width across depth · same total budget, redistributed
      </div>
      <div className="p-4">
        <div className="space-y-1">
          {w.map((width, l) => (
            <div key={l} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right font-mono text-[10px] text-muted-foreground">layer {l}</span>
              <div className="flex-1">
                <div
                  className="h-4 rounded-[3px] transition-all duration-300"
                  style={{ width: `${(width / 1.7) * 100}%`, background: `oklch(0.7 0.13 ${hue(l)})`, opacity: 0.9 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
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
            className="w-full accent-foreground"
            aria-label="taper strength"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">total MLP params (relative)</div>
            <div className="font-medium text-foreground">{relTotal}× — held fixed</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">early : late width</div>
            <div className="font-medium text-foreground">{s === 0 ? "1.0 : 1.0" : `${ratio} : 1`}</div>
          </div>
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
