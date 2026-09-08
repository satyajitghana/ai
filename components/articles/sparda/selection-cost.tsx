"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Section 4.1 "Forecast indexer": InfLLM-V2's baseline selector scores every
// candidate block with EVERY query head in a GQA group, sums the per-head
// scores, then applies softmax before top-k ranking (Section 3.1, "Three-stage
// block representation"). SparDA's Forecast is decoupled from the attention
// query entirely, so it drops straight to one score per GQA group -- "one
// Forecast head per KV head rather than one per query head, eliminating the
// per-query-head scoring loop" and "naturally skips the softmax operation ...
// since there is no need for score summation across multiple query heads."
//
// G (query heads per GQA group) is drawn as a slider because the paper states
// the mechanism -- G heads score, then sum+softmax -- without publishing
// MiniCPM4.1-8B's or NOSA-8B's exact head-count config, so this is a
// parametric illustration of the op-count shape, not a specific model's
// number. The real, measured payoff is the callout below the diagram: up to
// 2.50x less prefill selection time and >2x less decode selection time at
// 128K, read directly off Figure 3's per-layer attention wall-time breakdown.

const SEL = "oklch(0.60 0.15 255)"
const FORECAST = "oklch(0.55 0.16 155)"
const SUM = "oklch(0.68 0.13 85)"

export function SelectionCost() {
  const [g, setG] = useState(4)

  const W = 720
  const H = 240
  const headY = 34
  const headGap = 46
  const startX = 150
  const heads = Array.from({ length: g }, (_, i) => ({ x: startX + i * headGap, y: headY }))
  const sumX = startX + ((g - 1) * headGap) / 2
  const sumY = 118
  const topkY = 196

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">block-selection scoring, one GQA group</span>
        <span className="text-muted-foreground/50 font-mono text-[10px]">illustrative op-count · G is parametric</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label={`Baseline: ${g} query heads each score every candidate block, sum, then softmax. SparDA: one Forecast head scores directly, no softmax.`}>
            <defs>
              <marker id="sc-arrow" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke="currentColor" strokeWidth={1.4} className="text-muted-foreground" />
              </marker>
              <filter id="sc-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
              </filter>
            </defs>

            <text x={16} y={20} className="fill-muted-foreground font-mono" fontSize={10}>baseline (InfLLM-V2)</text>
            <text x={W - 16} y={20} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>SparDA</text>

            {/* baseline: G query heads -> sum -> softmax -> top-k */}
            {heads.map((h, i) => (
              <g key={i}>
                <path d={curve(h.x, h.y + 12, sumX, sumY - 14)} fill="none" stroke={SEL} strokeWidth={1.3} opacity={0.55} markerEnd="url(#sc-arrow)" />
                <rect x={h.x - 26} y={h.y - 12} width={52} height={24} rx={6} fill="var(--background)" stroke={SEL} strokeWidth={1.3} filter="url(#sc-soft)" />
                <text x={h.x} y={h.y + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>Q head {i + 1}</text>
              </g>
            ))}
            <rect x={sumX - 46} y={sumY - 14} width={92} height={28} rx={7} fill={SUM} fillOpacity={0.16} stroke={SUM} strokeWidth={1.3} />
            <text x={sumX} y={sumY + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>sum + softmax</text>
            <path d={curve(sumX, sumY + 14, sumX, topkY - 14)} fill="none" stroke={SUM} strokeWidth={1.4} markerEnd="url(#sc-arrow)" />
            <rect x={sumX - 46} y={topkY - 14} width={92} height={28} rx={7} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.3} />
            <text x={sumX} y={topkY + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>top-k blocks</text>
            <text x={sumX} y={topkY + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{g} score matmuls · 1 softmax</text>

            {/* SparDA: 1 forecast head -> top-k, no softmax */}
            {(() => {
              const fx = W - 190
              const fy = headY
              const tkX = W - 190
              const tkY = topkY
              return (
                <>
                  <rect x={fx - 34} y={fy - 12} width={68} height={24} rx={6} fill={FORECAST} fillOpacity={0.16} stroke={FORECAST} strokeWidth={1.3} filter="url(#sc-soft)" />
                  <text x={fx} y={fy + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>Forecast head</text>
                  <path d={curve(fx, fy + 12, tkX, tkY - 14)} fill="none" stroke={FORECAST} strokeWidth={1.6} markerEnd="url(#sc-arrow)" />
                  <rect x={tkX - 46} y={tkY - 14} width={92} height={28} rx={7} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.3} />
                  <text x={tkX} y={tkY + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>top-k blocks</text>
                  <text x={tkX} y={tkY + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>1 score matmul · no softmax</text>
                </>
              )
            })()}

            <line x1={W / 2} y1={4} x2={W / 2} y2={H - 4} stroke="currentColor" strokeOpacity={0.1} strokeDasharray="3 3" />
          </svg>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="w-32 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">query heads per group (G)</span>
          <Range min={2} max={8} step={1} value={g} onChange={(e) => setG(Number(e.target.value))} className="flex-1" accent={SEL} />
          <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{g}</span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <div className="mb-1 font-mono text-[10px] text-foreground">measured (paper, §5.3 / Figure 3, MiniCPM4.1-8B, 128K)</div>
          <p className="text-[12.5px] leading-5 text-muted-foreground">
            Selection cost drops <span style={{ color: FORECAST }}>up to 2.50×</span>{" "}during prefill and{" "}
            <span style={{ color: FORECAST }}>more than 2×</span>{" "}during decode, where selection — not attention —
            is the bottleneck once only one query token is in flight per step.
          </p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The baseline scores every candidate block with <span style={{ color: SEL }}>all {g} query heads</span> in
          the group, sums them, then runs softmax before ranking — the standard block-sparse selector shape shared
          by InfLLM-V2, MoBA, and NSA. Once selection no longer has to share the query&rsquo;s head layout, SparDA
          collapses that to <span style={{ color: FORECAST }}>one Forecast head per group</span> and drops the
          softmax entirely, since there is nothing left to sum across. The op-count above scales with G to show the
          shape of the saving; the exact 2.5×/2× numbers are what the paper actually measured, not derived from G.
        </p>
      </div>
    </figure>
  )
}
