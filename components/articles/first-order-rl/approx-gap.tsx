"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The paper's central formulation, drawn as a scene. The sequence-level IS weight
// πθ(y|x)/µθold(y|x) = ∏ₜ(1+δₜ) is the object we truly want to optimize, but its
// huge dynamic range makes it intractable. The token-level surrogate REINFORCE
// actually optimizes is 1 + ∑ₜδₜ — the FIRST-ORDER (linear) part of that product.
// The two agree only when every per-token ratio rₜ = 1+δₜ sits near 1, i.e. when
// the train–inference discrepancy and policy staleness are both small. Drive the
// two gap sources; watch the true product and the linear surrogate diverge as the
// dropped O(δ²) mass grows. SSR-safe: deterministic, ≤2dp, no Date/random.

const ACCENT = "oklch(0.62 0.15 255)" // indigo — the surrogate / "holds" state
const WARN = "oklch(0.66 0.17 35)" // warm — the "breaks down" state
const N = 10

// deterministic per-token base magnitude in [0.45, 1.0]
const base = (t: number) => 0.45 + 0.55 * Math.abs(Math.sin(t * 0.8 + 0.7))

// scene geometry (viewBox units)
const W = 760
const H = 300
const MX = 60
const YBASE = 120 // ratio = 1 baseline
const SCALE = 470 // δ → px bar height
const BW = 22
const GAP = (W - 2 * MX - N * BW) / (N - 1)
const bx = (t: number) => MX + t * (BW + GAP)
const cx = (t: number) => bx(t) + BW / 2

export function ApproxGap() {
  const [ti, setTi] = useState(3) // train–inference gap, 0..10
  const [stale, setStale] = useState(3) // policy staleness, 0..10

  const amp = 0.008 + ((ti + stale) / 20) * 0.11
  const deltas = Array.from({ length: N }, (_, t) => amp * base(t))
  const sumDelta = deltas.reduce((a, d) => a + d, 0)
  const product = deltas.reduce((a, d) => a * (1 + d), 1)
  const linear = 1 + sumDelta
  const gap = product - linear
  const relErr = gap / product // fraction of the true weight the surrogate drops
  const holds = relErr < 0.04

  const state = relErr < 0.04 ? "holds" : relErr < 0.09 ? "drifting" : "breaks down"
  const stateColor = holds ? ACCENT : WARN

  // two connectors fan from the aggregate point down to the two result nodes
  const curve = (x2: number, y2: number) => {
    const x1 = W / 2
    const y1 = 150
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  const LNODE = { x: 92, w: 248, cx: 216 }
  const RNODE = { x: 420, w: 248, cx: 544 }
  const NODE_Y = 208
  const NODE_H = 66

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>first-order approximation · one sequence</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Per-token ratios near 1 aggregate two ways: the true sequence product is ${product.toFixed(2)} times and the linear token surrogate is ${linear.toFixed(2)} times; the first-order approximation ${state}.`}
        >
          <defs>
            <marker id="fo-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={stateColor} strokeWidth={1.5} />
            </marker>
            <filter id="fo-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={34} className="fill-muted-foreground font-mono" fontSize={11}>
            per-token ratio · rₜ = πθ(yₜ)/µθ(yₜ) = 1 + δₜ
          </text>

          {/* baseline: ratio = 1 */}
          <line x1={MX} y1={YBASE} x2={W - MX} y2={YBASE} stroke="var(--border)" strokeWidth={1} />
          <text x={W - MX} y={YBASE - 5} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>
            rₜ = 1
          </text>

          {/* per-token deviation bars */}
          {deltas.map((d, t) => {
            const h = d * SCALE
            const op = 0.35 + 0.5 * (d / (amp || 1))
            return (
              <g key={t}>
                <rect
                  x={bx(t)}
                  y={YBASE - h}
                  width={BW}
                  height={Math.max(h, 0.5)}
                  rx={3}
                  fill={stateColor}
                  opacity={op}
                  className="transition-all duration-300"
                />
                <text x={cx(t)} y={YBASE + 13} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={8}>
                  {t + 1}
                </text>
              </g>
            )
          })}

          {/* aggregate label + fan-out */}
          <text x={W / 2} y={146} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            aggregate ↓
          </text>
          <path d={curve(LNODE.cx, NODE_Y)} fill="none" stroke={stateColor} strokeWidth={1.5} markerEnd="url(#fo-arrow)" opacity={0.75} />
          <path d={curve(RNODE.cx, NODE_Y)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#fo-arrow)" opacity={0.75} />

          {/* LEFT — true sequence product */}
          <g>
            <rect x={LNODE.x} y={NODE_Y} width={LNODE.w} height={NODE_H} rx={9} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#fo-soft)" />
            <text x={LNODE.cx} y={NODE_Y + 17} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              true sequence ratio · what RL wants
            </text>
            <text x={LNODE.cx} y={NODE_Y + 36} textAnchor="middle" className="fill-foreground font-mono" fontSize={12}>
              ∏ₜ (1 + δₜ)
            </text>
            <text x={LNODE.cx} y={NODE_Y + 56} textAnchor="middle" className="fill-foreground font-mono" fontSize={15} fontWeight={600} style={{ fill: stateColor }}>
              {product.toFixed(2)}×
            </text>
          </g>

          {/* RIGHT — linear token surrogate */}
          <g>
            <rect x={RNODE.x} y={NODE_Y} width={RNODE.w} height={NODE_H} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#fo-soft)" />
            <text x={RNODE.cx} y={NODE_Y + 17} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              token surrogate · what REINFORCE optimizes
            </text>
            <text x={RNODE.cx} y={NODE_Y + 36} textAnchor="middle" className="fill-foreground font-mono" fontSize={12}>
              1 + ∑ₜ δₜ
            </text>
            <text x={RNODE.cx} y={NODE_Y + 56} textAnchor="middle" className="font-mono" fontSize={15} fontWeight={600} style={{ fill: ACCENT }}>
              {linear.toFixed(2)}×
            </text>
          </g>

          {/* center relation symbol */}
          <text x={W / 2} y={NODE_Y + 44} textAnchor="middle" className="font-mono" fontSize={26} fontWeight={700} style={{ fill: stateColor }}>
            {holds ? "≈" : "≠"}
          </text>
        </svg>

        {/* controls */}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>train–inference gap</span>
              <span>{ti}</span>
            </div>
            <Range min={0} max={10} value={ti} onChange={(e) => setTi(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>policy staleness</span>
              <span>{stale}</span>
            </div>
            <Range min={0} max={10} value={stale} onChange={(e) => setStale(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
          <span className="rounded-md px-2 py-1" style={{ background: `color-mix(in oklch, ${stateColor} 15%, transparent)`, color: stateColor }}>
            first-order approximation: {state}
          </span>
          <span className="text-muted-foreground">
            dropped O(δ²) mass · gap = <span style={{ color: stateColor }}>{gap.toFixed(2)}</span> ({(relErr * 100).toFixed(1)}%)
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The surrogate keeps only the <span className="text-foreground">linear</span> term of the product. When every
          ratio hugs 1, the two agree ({" "}
          <span style={{ color: ACCENT }}>≈</span>) and improving the cheap token objective improves the true reward.
          Widen either gap and the neglected second-order terms pile up — the surrogate stops tracking the objective (
          <span style={{ color: WARN }}>≠</span>), which is what training instability looks like.
        </p>
      </div>
    </figure>
  )
}
