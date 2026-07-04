"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// IndexShare, GLM 5.2's trick for cheap 1M-context sparse attention, drawn as a layer
// stack. DeepSeek Sparse Attention runs a small "indexer" every layer to pick which
// tokens each query attends to. But adjacent layers pick 70–100% of the SAME tokens — so
// GLM 5.2 computes the indexer once per group of layers and REUSES its top-k for the rest,
// skipping the indexer in 3 of every 4 layers. Curved arrows show the reuse. Toggle it.

const LAYERS = 8
const GROUP = 4
const ACCENT = "oklch(0.62 0.15 195)"

// scene geometry (viewBox units)
const W = 680
const TOP = 34
const ROW = 34
const NH = 26
const IX = 96 // indexer node left
const IW = 210 // indexer width
const AX = 356 // attention node left
const AW = 280 // attention width
const cy = (i: number) => TOP + i * ROW + ROW / 2
const H = TOP + LAYERS * ROW + 14

export function IndexShare() {
  const [share, setShare] = useState(true)
  const passes = share ? LAYERS / GROUP : LAYERS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">sparse-attention indexer, per layer</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "standard DSA" },
            { v: true, label: "IndexShare" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setShare(o.v)}
              aria-pressed={share === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                share === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Eight transformer layers; ${share ? "the indexer computes once per group of 4 and the other 3 reuse its top-k token selection" : "the indexer recomputes at every layer"}`}>
          <defs>
            <marker id="ix-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="ix-arr-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="ix-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* column headers */}
          <text x={IX} y={20} className="fill-muted-foreground font-mono" fontSize={10}>indexer · top-k search</text>
          <text x={AX} y={20} className="fill-muted-foreground font-mono" fontSize={10}>sparse attention</text>

          {/* share connectors (behind nodes): head indexer → each reused layer */}
          {share &&
            Array.from({ length: LAYERS }, (_, k) => {
              const isHead = k % GROUP === 0
              if (isHead) return null
              const head = k - (k % GROUP)
              const y0 = cy(head)
              const y1 = cy(k)
              return (
                <path
                  key={`s${k}`}
                  d={`M ${IX - 4} ${y0 + 8} C ${IX - 34} ${y0 + 18}, ${IX - 34} ${y1 - 16}, ${IX - 4} ${y1}`}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={1.5}
                  markerEnd="url(#ix-arr)"
                  opacity={0.7}
                />
              )
            })}

          {/* rows */}
          {Array.from({ length: LAYERS }, (_, k) => {
            const isHead = k % GROUP === 0
            const computes = !share || isHead
            const head = k - (k % GROUP)
            const y = cy(k)
            return (
              <g key={k}>
                {/* layer label */}
                <text x={14} y={y + 4} className="fill-muted-foreground font-mono" fontSize={11}>L{k}</text>

                {/* indexer node */}
                <rect
                  x={IX}
                  y={y - NH / 2}
                  width={IW}
                  height={NH}
                  rx={7}
                  fill={computes ? ACCENT : "var(--muted)"}
                  fillOpacity={computes ? 1 : 0.35}
                  stroke={computes ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  strokeDasharray={computes ? undefined : "4 3"}
                  filter={computes ? "url(#ix-soft)" : undefined}
                  className="transition-all duration-300"
                />
                {computes ? (
                  // lightning bolt
                  <path
                    d={`M ${IX + 18} ${y - 6} L ${IX + 12} ${y + 1} L ${IX + 17} ${y + 1} L ${IX + 14} ${y + 7} L ${IX + 23} ${y - 2} L ${IX + 18} ${y - 2} Z`}
                    fill="var(--background)"
                  />
                ) : null}
                <text
                  x={IX + (computes ? 32 : 14)}
                  y={y + 4}
                  className="font-mono"
                  fontSize={10.5}
                  fill={computes ? "var(--background)" : "var(--muted-foreground)"}
                >
                  {computes ? "compute top-k indices" : `reuse L${head} indices`}
                </text>

                {/* indices → attention connector */}
                <path
                  d={`M ${IX + IW + 2} ${y} C ${IX + IW + 24} ${y}, ${AX - 24} ${y}, ${AX - 2} ${y}`}
                  fill="none"
                  stroke={computes ? ACCENT : "var(--muted-foreground)"}
                  strokeWidth={1.5}
                  markerEnd={`url(#${computes ? "ix-arr" : "ix-arr-m"})`}
                  opacity={0.7}
                />

                {/* attention node — always runs */}
                <rect x={AX} y={y - NH / 2} width={AW} height={NH} rx={7} fill="var(--muted)" fillOpacity={0.4} stroke="var(--border)" strokeWidth={1.5} />
                <text x={AX + AW / 2} y={y + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10.5}>sparse attention</text>
              </g>
            )
          })}
        </svg>

        {/* meter */}
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">indexer passes</div>
            <div className="font-medium text-foreground">
              {passes} / {LAYERS}
              {share ? <span className="text-muted-foreground"> (¾ skipped)</span> : null}
            </div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">per-token FLOPs @ 1M ctx</div>
            <div className="font-medium text-foreground">{share ? "2.9× lower" : "baseline"}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {share
            ? "The indexer runs once per group of 4 layers; the other 3 reuse its token selection. Because adjacent layers pick 70–100% of the same tokens, the reuse is almost lossless — and at a 1M-token context it cuts per-token FLOPs by 2.9×."
            : "Standard DeepSeek Sparse Attention recomputes the indexer at every layer — the top-k token search dominates cost as the context grows toward 1M tokens."}
        </p>
      </div>
    </figure>
  )
}
