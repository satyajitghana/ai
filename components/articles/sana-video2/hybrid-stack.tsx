"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// SANA-Video 2.0's backbone, drawn as a strip of layers. The 5B stack is 32
// layers grouped into four 8-layer blocks. Pure-linear attention is O(N) but
// its fixed-size state can't represent every token-token interaction, so it is
// rank-limited. The fix: keep three of every four layers linear and make every
// fourth a full-softmax "anchor" (25%), which restores full-rank interactions
// at fixed depths. Block Attention Residuals then route each completed block's
// summary forward into later linear layers, so the refreshed representations
// propagate across depth (paper: ~+12% deep-layer effective rank). Flip the
// regime; toggle AttnRes. Illustrative — layer count is the real 5B config.

const GREEN = "oklch(0.62 0.15 152)" // linear layers / accent
const AMBER = "oklch(0.70 0.14 70)" // softmax anchors

const NB = 32 // 5B: 32 layers
const BLK = 8 // one block = 8 layers
const W = 760
const H = 210
const MX = 34
const CW = 15
const GAP = (W - 2 * MX - NB * CW) / (NB - 1)
const LY = 78 // layer strip top
const LH = 34
const lx = (i: number) => MX + i * (CW + GAP)
const cx = (i: number) => lx(i) + CW / 2

type Regime = "linear" | "hybrid" | "softmax"

// which layers are softmax anchors under each regime
function isAnchor(i: number, regime: Regime) {
  if (regime === "softmax") return true
  if (regime === "linear") return false
  return i % 4 === 3 // every 4th → 25%
}

export function HybridStack() {
  const [regime, setRegime] = useState<Regime>("hybrid")
  const [attnRes, setAttnRes] = useState(true)

  const anchors = Array.from({ length: NB }, (_, i) => i).filter((i) => isAnchor(i, regime))
  const softmaxFrac = Math.round((anchors.length / NB) * 100)

  // AttnRes: after each completed block, route its summary forward into a mid
  // layer of the next block (curved arrow bumping below the strip).
  const routes = attnRes
    ? [0, 1, 2].map((b) => ({ from: (b + 1) * BLK - 1, to: (b + 1) * BLK + 3 }))
    : []

  const curveDown = (x1: number, x2: number) => {
    const y1 = LY + LH
    const dip = y1 + 40
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} C ${x1.toFixed(2)} ${dip.toFixed(2)}, ${x2.toFixed(2)} ${dip.toFixed(2)}, ${x2.toFixed(2)} ${(LY + LH).toFixed(2)}`
  }

  const costLabel = regime === "linear" ? "O(N) · rank-limited" : regime === "hybrid" ? "O(N) + anchors" : "O(N²) · exact"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the 32-layer hybrid backbone (5B)</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A 32-layer backbone in four 8-layer blocks. In the ${regime} regime, ${anchors.length} of 32 layers (${softmaxFrac}%) are full-softmax anchors and the rest are linear${attnRes ? "; Block Attention Residuals route completed-block summaries forward" : ""}.`}
        >
          <defs>
            <marker id="sv2-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GREEN} strokeWidth={1.5} />
            </marker>
            <filter id="sv2-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.16" />
            </filter>
          </defs>

          <text x={MX} y={30} className="fill-muted-foreground font-mono" fontSize={10}>patch-embedded tokens</text>
          <text x={W - MX} y={30} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>→ to output head</text>

          {/* block brackets */}
          {[0, 1, 2, 3].map((b) => {
            const x1 = lx(b * BLK)
            const x2 = lx(b * BLK + BLK - 1) + CW
            return (
              <g key={b}>
                <line x1={x1} x2={x2} y1={LY - 12} y2={LY - 12} stroke="currentColor" className="text-border" strokeWidth={1} />
                <text x={(x1 + x2) / 2} y={LY - 16} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>block {b + 1}</text>
              </g>
            )
          })}

          {/* AttnRes routing arrows */}
          {routes.map((r, i) => (
            <path
              key={i}
              d={curveDown(cx(r.from), cx(r.to))}
              fill="none"
              stroke={GREEN}
              strokeWidth={1.5}
              opacity={0.7}
              markerEnd="url(#sv2-arrow)"
            />
          ))}
          {attnRes ? (
            <text x={W / 2} y={LY + LH + 52} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: GREEN }}>
              AttnRes · completed-block summaries routed forward (+~12% deep-layer rank)
            </text>
          ) : null}

          {/* layer cells */}
          {Array.from({ length: NB }, (_, i) => {
            const anchor = isAnchor(i, regime)
            return (
              <g key={i}>
                <rect
                  x={lx(i)}
                  y={LY}
                  width={CW}
                  height={LH}
                  rx={4}
                  fill={anchor ? AMBER : GREEN}
                  opacity={anchor ? 0.95 : 0.85}
                  stroke={anchor ? AMBER : GREEN}
                  strokeWidth={1}
                  filter={anchor ? "url(#sv2-soft)" : undefined}
                  className="transition-all duration-300"
                />
              </g>
            )
          })}
        </svg>

        {/* legend + controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GREEN }} /> linear O(N)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: AMBER }} /> softmax anchor</span>
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            <span className="text-foreground">{anchors.length}</span>/32 softmax · {softmaxFrac}% · {costLabel}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">regime</span>
            {(["linear", "hybrid", "softmax"] as Regime[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegime(r)}
                aria-pressed={regime === r}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  regime === r ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r === "linear" ? "pure linear" : r === "hybrid" ? "hybrid 25%" : "full softmax"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAttnRes((v) => !v)}
            aria-pressed={attnRes}
            className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors"
            style={attnRes ? { borderColor: GREEN, color: GREEN } : undefined}
          >
            AttnRes {attnRes ? "on" : "off"}
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="text-foreground">Pure linear</span> is cheap but its fixed-size state is rank-limited — it
          cannot carry every token-to-token interaction. <span className="text-foreground">Hybrid</span> makes every
          fourth layer a full-softmax <span style={{ color: AMBER }}>anchor</span> (25%), restoring exact interactions at
          fixed depths, while <span style={{ color: GREEN }}>AttnRes</span> routes each completed block&apos;s summary
          forward so those refreshed features propagate. <span className="text-foreground">Full softmax</span> is exact
          everywhere — and quadratic everywhere.
        </p>
      </div>
    </figure>
  )
}
