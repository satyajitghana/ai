"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// What it takes to train a 2.8T-A50B model, from first principles. Training compute
// for an MoE is ~6 x (active params) x (tokens); at ~50B active that is a lot of FLOPs.
// Drag the token budget and pick a cluster size to read off the estimated GPU-hours and
// wall-clock. Assumptions are labeled and honest — Moonshot has not published K3's exact
// token count or cluster, so this is an order-of-magnitude estimate (K2 trained on 15.5T
// tokens, shown as a reference).

const ACCENT = "oklch(0.58 0.15 265)"

const ACTIVE = 50e9 // active params per token
const TOTAL = 2.8e12 // total params
const PER_ACCEL = 4e14 // effective FLOP/s per H-class accelerator (~40% MFU)
const FP4_BYTES = 0.5 // MXFP4 = 4-bit weights = 0.5 byte/param

const W = 760
const H = 430

// wall-clock bar
const BAR_X = 60
const BAR_W = 640
const BAR_Y = 300
const DAY_MAX = 90
const DAY_TICKS = [15, 30, 60, 90]

const CLUSTERS = [2048, 4096, 8192]

// representative chip grid inside the cluster box
const CHIP_COLS = 14
const CHIP_ROWS = 5

function fmtFlops(f: number): string {
  return (f / 1e24).toFixed(1) + " ×10²⁴"
}
function fmtHours(h: number): string {
  return (h / 1e6).toFixed(1) + "M"
}

export function TrainingCost() {
  const [tokensT, setTokensT] = useState(15.5) // trillions of tokens
  const [nAccel, setNAccel] = useState(4096)

  const D = tokensT * 1e12
  const flops = 6 * ACTIVE * D
  const gpuSeconds = flops / PER_ACCEL
  const gpuHours = gpuSeconds / 3600
  const days = gpuSeconds / nAccel / 86400
  const fillW = Math.round(Math.min(1, days / DAY_MAX) * BAR_W * 100) / 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what it takes to train · 6·(active)·(tokens)</span>
        <span className="text-muted-foreground/50">order-of-magnitude estimate</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Training ${tokensT.toFixed(1)} trillion tokens on ${nAccel} accelerators costs about ${gpuHours.toExponential(1)} GPU-hours, roughly ${days.toFixed(0)} days of wall-clock.`}>
          <defs>
            <marker id="tc-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="tc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* data node */}
          <rect x={40} y={72} width={150} height={54} rx={10} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} filter="url(#tc-soft)" />
          <text x={115} y={95} textAnchor="middle" className="fill-foreground font-mono" fontSize={14} fontWeight={600}>{tokensT.toFixed(1)}T</text>
          <text x={115} y={112} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>training tokens</text>

          {/* cluster box + chips */}
          <rect x={250} y={56} width={300} height={86} rx={12} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#tc-soft)" />
          {Array.from({ length: CHIP_COLS * CHIP_ROWS }, (_, i) => {
            const c = i % CHIP_COLS
            const r = Math.floor(i / CHIP_COLS)
            return <rect key={i} x={266 + c * 19} y={70 + r * 11} width={13} height={7} rx={1.5} fill={ACCENT} fillOpacity={0.35 + 0.5 * ((i * 37) % 5) / 5} />
          })}
          <text x={400} y={136} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{nAccel.toLocaleString()} accelerators · ~0.4 PFLOP/s eff. each</text>

          {/* model node */}
          <rect x={610} y={72} width={126} height={54} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#tc-soft)" />
          <text x={673} y={94} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Kimi K3</text>
          <text x={673} y={111} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>2.8T · 50B active</text>

          {/* flow arrows */}
          <path d={`M 190 99 C 220 99, 220 99, 248 99`} fill="none" stroke={ACCENT} strokeWidth={1.6} markerEnd="url(#tc-arrow)" opacity={0.8} />
          <path d={`M 550 99 C 580 99, 580 99, 608 99`} fill="none" stroke={ACCENT} strokeWidth={1.6} markerEnd="url(#tc-arrow)" opacity={0.8} />

          {/* wall-clock bar */}
          <text x={BAR_X} y={BAR_Y - 30} className="fill-muted-foreground font-mono" fontSize={11}>estimated wall-clock (days)</text>
          <rect x={BAR_X} y={BAR_Y - 14} width={BAR_W} height={18} rx={5} fill="var(--muted)" opacity={0.5} />
          <rect x={BAR_X} y={BAR_Y - 14} width={fillW} height={18} rx={5} fill={ACCENT} filter="url(#tc-soft)" />
          <text x={BAR_X + fillW + (fillW > BAR_W - 90 ? -8 : 8)} y={BAR_Y - 1} textAnchor={fillW > BAR_W - 90 ? "end" : "start"} className="font-mono" fontSize={11} fontWeight={600} fill={fillW > BAR_W - 90 ? "var(--background)" : ACCENT}>
            ≈ {days.toFixed(0)} days
          </text>
          {DAY_TICKS.map((d) => (
            <g key={d}>
              <line x1={BAR_X + (d / DAY_MAX) * BAR_W} y1={BAR_Y + 6} x2={BAR_X + (d / DAY_MAX) * BAR_W} y2={BAR_Y + 12} stroke="var(--border)" strokeWidth={1} />
              <text x={BAR_X + (d / DAY_MAX) * BAR_W} y={BAR_Y + 24} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{d}</text>
            </g>
          ))}

          {/* readout line */}
          <text x={BAR_X} y={BAR_Y + 56} className="fill-muted-foreground font-mono" fontSize={10}>
            compute ≈ <tspan fill={ACCENT}>{fmtFlops(flops)}</tspan> FLOPs
          </text>
          <text x={BAR_X + 250} y={BAR_Y + 56} className="fill-muted-foreground font-mono" fontSize={10}>
            ≈ <tspan className="fill-foreground">{fmtHours(gpuHours)}</tspan> GPU-hours
          </text>
          <text x={BAR_X + 470} y={BAR_Y + 56} className="fill-muted-foreground font-mono" fontSize={10}>
            FP4 weights ≈ <tspan className="fill-foreground">{((TOTAL * FP4_BYTES) / 1e12).toFixed(1)} TB</tspan>
          </text>
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">cluster</span>
            {CLUSTERS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNAccel(n)}
                aria-pressed={nAccel === n}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (nAccel === n ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            assumptions: 6·N·D · active = 50B · ~0.4 PFLOP/s/accel (~40% MFU)
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">token budget (K2 trained on 15.5T — drag)</div>
          <Range min={5} max={30} step={0.5} value={tokensT} onChange={(e) => setTokensT(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.58 0.15 265)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The MoE sparsity that makes K3 cheap to <span className="text-foreground">serve</span> also makes it cheaper to{" "}
          <span style={{ color: ACCENT }}>train</span>: compute scales with the ~50B <span className="text-foreground">active</span>{" "}
          params, not the full 2.8T. Even so, a frontier token budget on a few thousand accelerators is weeks of wall-clock and
          millions of GPU-hours — and the 2.8T weights still fit in <span className="text-foreground">~1.4 TB</span> only because
          they are trained MXFP4-native. Numbers are a first-principles estimate; Moonshot has not published K3's exact recipe.
        </p>
      </div>
    </figure>
  )
}
