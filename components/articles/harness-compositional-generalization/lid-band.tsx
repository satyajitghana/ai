"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The central claim, made draggable: train the harness on SHORT tasks, then
// evaluate on tasks 1–32x longer. A base Transformer sees the whole long task
// in one context — most of which is now OUT of the length distribution it
// trained on, so accuracy rots. An RLM decomposes the same task into sub-calls,
// each of which stays within the trained (short) length band — "locally
// in-distribution" — so it keeps working as the task grows. Drag the length
// multiplier and watch the two eval-reward readouts diverge.

const IN = "oklch(0.64 0.15 155)" // in-distribution (green)
const OOD = "oklch(0.62 0.19 25)" // out-of-distribution (red)

const MULTS = [1, 2, 4, 8, 16, 32]

export function LidBand() {
  const [idx, setIdx] = useState(3) // 8x
  const mult = MULTS[idx]

  // base Transformer: one call sees the whole task; the fraction beyond 1x is OOD
  const inDistFrac = 1 / mult
  // eval reward decays as more of the context leaves the trained length regime
  const rBase = 0.88 / (1 + 0.62 * Math.log2(mult))
  // RLM: task is chopped into `mult` in-distribution sub-calls; eval ~ tracks train
  const rRlm = 0.86 - 0.012 * Math.log2(mult)
  const lift = rRlm / rBase

  const cells = Math.min(mult, 32)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        train short · evaluate long · one context vs. locally in-distribution calls
      </div>
      <div className="p-3 sm:p-4">
        {/* base transformer: single context, mostly OOD */}
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>base Transformer — one LM call sees the whole {mult}× task</span>
          <span className="tabular-nums" style={{ color: mult > 1 ? OOD : IN }}>
            {(inDistFrac * 100).toFixed(0)}% in-distribution
          </span>
        </div>
        <div className="mb-4 flex h-9 w-full overflow-hidden rounded-md">
          <div
            className="flex items-center justify-center font-mono text-[10px] text-white"
            style={{ width: `${inDistFrac * 100}%`, background: IN, minWidth: mult > 8 ? 2 : undefined }}
          >
            {mult <= 4 ? "seen" : ""}
          </div>
          <div
            className="flex items-center justify-center font-mono text-[10px]"
            style={{
              width: `${(1 - inDistFrac) * 100}%`,
              background: `repeating-linear-gradient(135deg, ${OOD}, ${OOD} 6px, oklch(0.62 0.19 25 / 0.7) 6px, oklch(0.62 0.19 25 / 0.7) 12px)`,
              color: "white",
            }}
          >
            {mult > 1 ? "unseen length — context rot" : ""}
          </div>
        </div>

        {/* RLM: many in-distribution sub-calls */}
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>RLM — {mult} sub-calls, each ≤ the trained length</span>
          <span className="tabular-nums" style={{ color: IN }}>
            100% in-distribution
          </span>
        </div>
        <div className="flex h-9 w-full gap-[2px]">
          {Array.from({ length: cells }, (_, i) => (
            <div
              key={i}
              className="h-full flex-1 rounded-[3px]"
              style={{ background: IN, opacity: 0.55 + 0.45 * ((i % 3) / 2) }}
              title={`sub-call ${i + 1}: in-distribution`}
            />
          ))}
        </div>

        {/* readouts */}
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">base eval reward</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: OOD }}>{rBase.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">RLM eval reward</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: IN }}>{rRlm.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">eval lift</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{lift.toFixed(1)}×</div>
          </div>
        </div>

        {/* control */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>evaluate at {mult}× the trained task length</span>
            <span className="tabular-nums text-foreground">{mult}×</span>
          </div>
          <Range
            min={0}
            max={MULTS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(+e.target.value)}
            className="w-full"
            aria-label="evaluation length multiplier"
            accent={IN}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The full trajectory is <span style={{ color: OOD }}>unseen</span> — no model trained on 32k-token
          tasks has been asked to handle a 2M-token one. But every <span style={{ color: IN }}>individual
          call</span> the RLM makes stays inside the length regime it was trained on, so the pieces keep
          working even as the whole gets far longer. That is <span className="text-foreground">locally
          in-distribution</span>: the harness, not the weights, carries the generalization.
        </p>
      </div>
    </figure>
  )
}
