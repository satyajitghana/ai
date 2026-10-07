"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A toy of the paper's factorisation p(c, y | x) = p(c | x) · p(y | x, c),
// with the base model's own continuation held fixed and only the opening
// probability moved. Inputs are the paper's (arXiv 2610.06851, Olmo-3-7B,
// RL-Zero prompt, MATH-500): 77.9% pass@1 with ".\n\nOkay" forced and 42.2%
// with no cue (Table 6), 0.138 mean probability of the cue (Table 1), 0.65 after
// RL (Figure 3) and 75.0% for the RL-Zero model (Table 7). The 36.5% for every
// other opening is my arithmetic: (42.2 - 0.138 * 77.9) / (1 - 0.138).

const ACC_CUE = 77.9
const ACC_NONE = 42.2
const P_BASE = 0.138
const P_RL = 0.65
const ACC_RL = 75.0
const ACC_OTHER = (ACC_NONE - P_BASE * ACC_CUE) / (1 - P_BASE)

export function OpeningMixture() {
  const [p, setP] = useState(P_BASE)
  const acc = p * ACC_CUE + (1 - p) * ACC_OTHER
  const x = (v: number) => `${(v * 100).toFixed(1)}%`
  const y = (a: number) => `${(100 - (a / 100) * 100).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">move only p(cue | prompt) · base continuation fixed</span>
        <span className="font-mono text-xs tabular-nums">expected pass@1 {acc.toFixed(1)}%</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="relative h-36 rounded-md border bg-background/60">
          <div className="absolute inset-x-3 top-3 bottom-6">
            <div className="absolute inset-x-0 border-t border-dashed border-sky-500/70" style={{ top: y(ACC_RL) }}>
              <span className="absolute -top-4 right-0 font-mono text-[10px] text-sky-600 dark:text-sky-400">
                RL-Zero model {ACC_RL.toFixed(1)}%
              </span>
            </div>
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line
                x1={0}
                y1={100 - ACC_OTHER}
                x2={100}
                y2={100 - ACC_CUE}
                stroke="currentColor"
                strokeOpacity={0.5}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {[
              { v: P_BASE, t: "base 0.138" },
              { v: P_RL, t: "after RL 0.65" },
            ].map((mk) => (
              <div key={mk.t} className="absolute top-0 bottom-0 border-l border-muted-foreground/30" style={{ left: x(mk.v) }}>
                <span className="absolute -bottom-5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-muted-foreground">{mk.t}</span>
              </div>
            ))}
            <div
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-amber-500 shadow"
              style={{ left: x(p), top: y(acc) }}
            />
          </div>
        </div>
        <div className="pt-3">
          <Range
            min={0}
            max={1}
            step={0.01}
            value={p}
            onChange={(e) => setP(Number(e.target.value))}
            aria-label="Probability that the base model opens with the cue"
            accent="oklch(0.75 0.15 75)"
          />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>p(.\n\n Okay | prompt) = {p.toFixed(2)}</span>
            <span>other openings {ACC_OTHER.toFixed(1)}% · cue {ACC_CUE.toFixed(1)}%</span>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A straight line, because the only thing moving is how often the model picks the good branch. At the base
          model&apos;s own 0.138 it lands on the measured 42.2%; it reaches the RL model only as the probability nears 1,
          which is roughly what the RL model does: 99% of its rollouts follow the first blank line with Okay. The other
          openings&apos; 36.5% is my arithmetic from the paper&apos;s numbers, not a measured value.
        </p>
      </div>
    </figure>
  )
}
