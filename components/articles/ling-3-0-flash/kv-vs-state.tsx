"use client"

import { useState } from "react"

// KDA's constant-size recurrent state vs a growing KV cache, as an SVG chart.
// Ling-3.0-flash interleaves KDA (linear, constant state) with Gated MLA
// (full attention, growing cache) at a 5:1 ratio — so its effective KV memory
// grows at ~1/6 the slope of an all-attention model. Numbers are illustrative
// (order-of-magnitude), to show the shape, not to claim exact GB.
// SSR-safe: fixed initial state, no Date / random.

const MAXTOK = 1048576 // 1M tokens
const RATIO = 6 // 5 KDA : 1 MLA  →  1 in 6 layers keeps a cache
const FULL_AT_1M = 336 // GB, illustrative full-attention cache at 1M tokens
const KDA_STATE = 3 // GB, illustrative constant recurrent-state footprint

// chart geometry
const W = 720
const H = 320
const PADL = 58
const PADR = 132
const PADT = 20
const PADB = 46
const PLOTW = W - PADL - PADR
const PLOTH = H - PADT - PADB
const YMAX = 360

const x = (tok: number) => PADL + (tok / MAXTOK) * PLOTW
const y = (gb: number) => PADT + (1 - gb / YMAX) * PLOTH

const fullMem = (tok: number) => (tok / MAXTOK) * FULL_AT_1M
const hybridMem = (tok: number) => (tok / MAXTOK) * (FULL_AT_1M / RATIO) + KDA_STATE

function fmtTok(tok: number) {
  if (tok >= 1000000) return `${(tok / 1048576).toFixed(2)}M`
  if (tok >= 1000) return `${Math.round(tok / 1024)}K`
  return `${Math.round(tok)}`
}

export function KvVsState() {
  const [pct, setPct] = useState(62)
  const tok = Math.round((pct / 100) * MAXTOK)
  const full = fullMem(tok)
  const hybrid = hybridMem(tok)
  const save = hybrid > 0 ? full / hybrid : 0

  const grid = [0, 90, 180, 270, 360]
  const xticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * MAXTOK)

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Chart: full-attention KV cache grows linearly with context length, while Ling-3.0-flash's hybrid KDA/MLA memory grows at one-sixth the slope on top of a constant KDA state.">
        {/* y gridlines + labels */}
        {grid.map((g) => (
          <g key={g}>
            <line x1={PADL} y1={y(g)} x2={PADL + PLOTW} y2={y(g)} stroke="var(--border)" strokeWidth={1} />
            <text x={PADL - 10} y={y(g) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">{g}</text>
          </g>
        ))}
        <text x={16} y={PADT + PLOTH / 2} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" transform={`rotate(-90 16 ${PADT + PLOTH / 2})`}>
          KV memory (GB, illustrative)
        </text>
        {/* x ticks */}
        {xticks.map((t) => (
          <text key={t} x={x(t)} y={H - PADB + 20} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{fmtTok(t)}</text>
        ))}
        <text x={PADL + PLOTW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">context length (tokens)</text>

        {/* full-attention line */}
        <line x1={x(0)} y1={y(0)} x2={x(MAXTOK)} y2={y(FULL_AT_1M)} stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 4" />
        {/* hybrid line (fill under it) */}
        <path d={`M ${x(0)} ${y(hybridMem(0))} L ${x(MAXTOK)} ${y(hybridMem(MAXTOK))} L ${x(MAXTOK)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="var(--primary)" opacity={0.08} />
        <line x1={x(0)} y1={y(hybridMem(0))} x2={x(MAXTOK)} y2={y(hybridMem(MAXTOK))} stroke="var(--primary)" strokeWidth={2.4} />

        {/* marker */}
        <line x1={x(tok)} y1={PADT} x2={x(tok)} y2={PADT + PLOTH} stroke="var(--foreground)" strokeWidth={1} opacity={0.35} />
        <circle cx={x(tok)} cy={y(full)} r={4.5} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={2} />
        <circle cx={x(tok)} cy={y(hybrid)} r={5} fill="var(--primary)" stroke="var(--background)" strokeWidth={1.5} />

        {/* inline legend at right */}
        <g>
          <line x1={PADL + PLOTW + 14} y1={PADT + 10} x2={PADL + PLOTW + 34} y2={PADT + 10} stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 4" />
          <text x={PADL + PLOTW + 38} y={PADT + 14} fontSize={10.5} fill="var(--muted-foreground)">full attention</text>
          <line x1={PADL + PLOTW + 14} y1={PADT + 30} x2={PADL + PLOTW + 34} y2={PADT + 30} stroke="var(--primary)" strokeWidth={2.4} />
          <text x={PADL + PLOTW + 38} y={PADT + 34} fontSize={10.5} fill="var(--foreground)">Ling hybrid</text>
          <text x={PADL + PLOTW + 38} y={PADT + 48} fontSize={10.5} fill="var(--muted-foreground)">(KDA:MLA 5:1)</text>
        </g>
      </svg>

      <div className="mt-2 px-1">
        <input
          type="range" min={1} max={100} value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
          aria-label="context length"
        />
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>context: <strong className="text-foreground">{fmtTok(tok)}</strong> tokens</span>
          <span>full-attn KV: <strong className="text-foreground">{full.toFixed(0)} GB</strong></span>
          <span>Ling hybrid: <strong className="text-foreground">{hybrid.toFixed(0)} GB</strong></span>
          <span>≈ <strong className="text-foreground">{save.toFixed(1)}×</strong> smaller</span>
        </div>
      </div>
    </figure>
  )
}
