"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Guidance fitting along the chain ∅ → T → TS, as written on the project page
// and in minimax_h3/streaming_sft.md ("guided" anchors):
//   u(∅)  = f(∅)
//   u(T)  = u(∅) + [f(T)  - f(∅)] / s0
//   u(TS) = u(T) + [f(TS) - f(T)] / s1
// so the full-condition training target is
//   u(TS) = f(TS)/s1 + (1/s0 - 1/s1) f(T) + (1 - 1/s0) f(∅)
// with f(T) and f(∅) under stop-gradient. The racing demo uses s0 = 1.5 (adds
// the caption) and s1 = 3.0 (adds the semantic video).

const C_TS = "oklch(0.62 0.17 255)"
const C_T = "oklch(0.70 0.15 70)"
const C_0 = "oklch(0.60 0.02 260)"

export function GuidanceFit() {
  const [s0, setS0] = useState(1.5)
  const [s1, setS1] = useState(3)
  const cTS = 1 / s1
  const cT = 1 / s0 - 1 / s1
  const c0 = 1 - 1 / s0
  const terms = [
    { key: "f(TS)", label: "full condition, trained", c: cTS, color: C_TS },
    { key: "f(T)", label: "caption only, stop-gradient", c: cT, color: C_T },
    { key: "f(∅)", label: "reference image only, stop-gradient", c: c0, color: C_0 },
  ]
  const W = 520
  const mid = 250
  const scale = 230

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        how three branch outputs combine into the quantity the loss sees
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-52 text-muted-foreground">caption step s0 = {s0.toFixed(2)}</span>
          <Range min={1} max={5} step={0.05} value={s0} onChange={(e) => setS0(Number(e.target.value))} accent={C_T} className="min-w-[160px] flex-1" aria-label="Caption guidance scale" />
        </label>
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-52 text-muted-foreground">semantic-video step s1 = {s1.toFixed(2)}</span>
          <Range min={1} max={5} step={0.05} value={s1} onChange={(e) => setS1(Number(e.target.value))} accent={C_TS} className="min-w-[160px] flex-1" aria-label="Semantic video guidance scale" />
        </label>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 120`} width={W} height={120} role="img" className="min-w-[460px] max-w-full">
            <title>
              {`Coefficients of the fitted target u(TS): ${cTS.toFixed(3)} times f(TS), ${cT.toFixed(3)} times f(T), ${c0.toFixed(3)} times f(empty).`}
            </title>
            <line x1={mid} y1={8} x2={mid} y2={104} stroke="currentColor" strokeOpacity={0.25} />
            <text x={mid} y={116} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              0
            </text>
            {terms.map((t, i) => {
              const y = 14 + i * 32
              const w = t.c * scale
              return (
                <g key={t.key}>
                  <text x={8} y={y + 12} fontSize={9} fill={t.color} fontFamily="ui-monospace, monospace">
                    {t.key}
                  </text>
                  <rect x={w >= 0 ? mid : mid + w} y={y} width={Math.max(1, Math.abs(w))} height={16} rx={2} fill={t.color} fillOpacity={0.8} />
                  <text x={w >= 0 ? mid + w + 6 : mid + w - 6} y={y + 12} fontSize={9} textAnchor={w >= 0 ? "start" : "end"} fill="currentColor" fontFamily="ui-monospace, monospace">
                    {t.c.toFixed(3)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          The bars are the weights that combine three network outputs into u(TS), the prediction the
          diffusion loss compares with the clean data. Only f(TS) gets a gradient. At the
          demo&rsquo;s 1.5 and 3.0 the weights are a third each, so u(TS) is the plain average of
          the three branches, and f(TS) is pushed to wherever that average is right: the answer
          three-call guidance would have given. Drag the semantic step
          below the caption step and the middle weight turns negative; the code allows any scale of
          at least 1, but the stronger push was put on the step that adds the structure.
        </p>
      </div>
    </figure>
  )
}
