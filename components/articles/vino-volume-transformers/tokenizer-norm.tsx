"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Token norm against how many of a patch's 125 voxel slots are occupied, for
// three ways of pooling a patch: Volt's weighted sum, VINO's average (divide by
// the occupied count n), and a divide-by-sqrt(n) control. Measured on
// Pointcept's demo room (sample1) at 2 cm voxels, P=5: 12,092 tokens, features
// = RGB + normal, projection weights drawn at Volt's init (truncated normal,
// std 0.02, seed 0). "Independent" is Volt's Linear(125*6 -> 384) as built: a
// separate weight block per slot. "Shared" ties every slot to the same block,
// the case where each occupied voxel pushes the token the same way.

const BINS = ["1", "2-3", "4-7", "8-15", "16-31", "32+"]
const COUNT = [642, 956, 1336, 3588, 4749, 821]

const DATA = {
  independent: {
    sum: { v: [0.5516, 0.8561, 1.2704, 1.8282, 2.4996, 3.5215], slope: 0.5 },
    mean: { v: [0.5516, 0.3524, 0.2417, 0.1553, 0.1181, 0.0904], slope: -0.5 },
    sqrt: { v: [0.5516, 0.5464, 0.5512, 0.5304, 0.5407, 0.5622], slope: 0.0 },
  },
  shared: {
    sum: { v: [0.5641, 1.3356, 2.8453, 6.0453, 10.7486, 17.2265], slope: 0.945 },
    mean: { v: [0.5641, 0.5389, 0.5308, 0.5041, 0.5007, 0.4406], slope: -0.055 },
    sqrt: { v: [0.5641, 0.844, 1.2224, 1.7379, 2.3088, 2.7444], slope: 0.445 },
  },
} as const

type Regime = keyof typeof DATA
type Pool = keyof (typeof DATA)["independent"]

const POOLS: { id: Pool; label: string }[] = [
  { id: "sum", label: "sum (Volt)" },
  { id: "mean", label: "÷ n (VINO)" },
  { id: "sqrt", label: "÷ √n (control)" },
]
const REGIMES: { id: Regime; label: string }[] = [
  { id: "independent", label: "per-slot weights (Volt at init)" },
  { id: "shared", label: "one shared weight block" },
]

const W = 640
const H = 210
const L = 40
const R = 14
const T = 16
const B = 40
const bw = (W - L - R) / BINS.length

function verdict(slope: number) {
  if (Math.abs(slope) < 0.1) return "flat: norm says nothing about occupancy"
  if (slope > 0) return "grows with occupancy"
  return "shrinks with occupancy"
}

export function TokenizerNorm() {
  const [regime, setRegime] = useState<Regime>("independent")
  const [pool, setPool] = useState<Pool>("sum")
  const d = DATA[regime][pool]
  const top = Math.max(...d.v) * 1.15
  const Y = (x: number) => T + (1 - x / top) * (H - T - B)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>token norm vs occupied slots · 12,092 tokens · measured at init</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap gap-1.5 font-mono text-[11px]">
          {POOLS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPool(o.id)}
              aria-pressed={pool === o.id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 transition-colors",
                pool === o.id ? "border-foreground/40 bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
          {REGIMES.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setRegime(o.id)}
              aria-pressed={regime === o.id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 transition-colors",
                regime === o.id ? "border-foreground/40 bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[520px]"
            role="img"
            aria-label={`Mean token norm per occupancy bin for ${pool} pooling with ${regime} weights: ${d.v.join(", ")}. Log-log slope ${d.slope}.`}
          >
            <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="currentColor" className="text-border" />
            {d.v.map((x, i) => {
              const bx = L + i * bw + 8
              return (
                <g key={BINS[i]}>
                  <rect x={bx} y={Y(x)} width={bw - 16} height={H - B - Y(x)} rx={3} fill="oklch(0.6 0.14 300)" fillOpacity={0.8} />
                  <text x={bx + (bw - 16) / 2} y={Y(x) - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>
                    {x.toFixed(2)}
                  </text>
                  <text x={bx + (bw - 16) / 2} y={H - B + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
                    {BINS[i]} of 125
                  </text>
                  <text x={bx + (bw - 16) / 2} y={H - B + 27} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
                    {COUNT[i].toLocaleString("en-US")} tokens
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="mt-2 grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">log-log slope of norm on n</div>
            <div className="text-foreground">
              {d.slope >= 0 ? "+" : ""}
              {d.slope.toFixed(2)}
            </div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">reading</div>
            <div className="text-foreground">{verdict(d.slope)}</div>
          </div>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          Norm of the 384-wide token before any Transformer block, mean per bin. Random weights, so this is the state
          &quot;early in training&quot; the paper describes, not a trained tokenizer. My re-implementation of Volt&apos;s
          Tokenizer, not its code.
        </p>
      </div>
    </figure>
  )
}
