"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MoA's quality is bought with compute. Depth L and width n set the model-call budget —
// n proposers per layer across L layers, plus the final aggregator — while quality climbs
// with diminishing returns and latency grows with depth. The scene draws the actual budget
// (every node is a model call) on the left and the quality you get on the right gauge;
// drag both and watch the trade. The quality curve is an illustrative stand-in (saturating
// in both L and n), not a measured surface.

const ACCENT = "oklch(0.72 0.15 195)"

function quality(L: number, n: number) {
  // base single-model ~57; gains saturate in depth and width
  const widthGain = 10 * (1 - Math.exp(-(n - 1) / 2.2))
  const depthGain = 8 * (1 - Math.exp(-L / 1.6))
  return Math.min(72, 57 + widthGain + depthGain * (n > 1 ? 1 : 0))
}

// scene geometry (viewBox units)
const W = 680
const H = 276
const GRID_L = 52 // node grid left
const GRID_R = 392 // node grid right
const GRID_MID = (GRID_L + GRID_R) / 2
const ROW_TOP = 40
const ROW_BOT = 196
const AGG_Y = 244
const Q_X = 476 // gauge left
const Q_W = 52
const Q_TOP = 40
const Q_BOT = 240
const Q_H = Q_BOT - Q_TOP
const Q_MIN = 40
const Q_MAX = 72

export function MoACost() {
  const [L, setL] = useState(2)
  const [n, setN] = useState(4)

  const calls = L * n + 1 // proposers across layers + final aggregator
  const q = quality(L, n)
  const latency = L + 1 // sequential layers + aggregate step (relative units)

  const rowY = (li: number) => (L === 1 ? 118 : ROW_TOP + (li * (ROW_BOT - ROW_TOP)) / (L - 1))
  const cw = (GRID_R - GRID_L) / n
  const nodeX = (pi: number) => GRID_L + (pi + 0.5) * cw
  const nodeW = Math.min(44, cw - 6)
  const nodeH = 15

  const link = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  const qy = (v: number) => Q_TOP + (1 - (v - Q_MIN) / (Q_MAX - Q_MIN)) * Q_H
  const qFillY = qy(q)
  const baseY = qy(57)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cost vs quality · depth L × width n</span>
        <span className="text-muted-foreground/60">stand-in · illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${L} layer${L === 1 ? "" : "s"} of ${n} proposer${n === 1 ? "" : "s"} plus an aggregator — ${calls} model calls — reaching ${q.toFixed(1)} percent stand-in quality`}>
          <defs>
            <marker id="mc-arrow" viewBox="0 -5 10 10" markerWidth="5" markerHeight="5" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="mc-soft" x="-40%" y="-50%" width="180%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodOpacity="0.16" />
            </filter>
          </defs>

          <text x={GRID_L - 12} y={ROW_TOP - 18} className="fill-muted-foreground font-mono" fontSize={9.5}>the compute you pay ({calls} model calls)</text>

          {/* all-to-all connectors between consecutive layers */}
          {Array.from({ length: Math.max(0, L - 1) }).flatMap((_, li) =>
            Array.from({ length: n }).flatMap((_, a) =>
              Array.from({ length: n }).map((__, b) => (
                <path key={`e-${li}-${a}-${b}`} d={link(nodeX(a), rowY(li) + nodeH / 2, nodeX(b), rowY(li + 1) - nodeH / 2)} fill="none" stroke={ACCENT} strokeWidth={1} opacity={0.16} />
              )),
            ),
          )}
          {/* last layer -> aggregator */}
          {Array.from({ length: n }).map((_, pi) => (
            <path key={`a-${pi}`} d={link(nodeX(pi), rowY(L - 1) + nodeH / 2, GRID_MID, AGG_Y - 12)} fill="none" stroke={ACCENT} strokeWidth={1.2} opacity={0.32} markerEnd="url(#mc-arrow)" />
          ))}

          {/* proposer nodes */}
          {Array.from({ length: L }).map((_, li) => (
            <g key={li}>
              <text x={GRID_L - 12} y={rowY(li) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8.5}>L{li + 1}</text>
              {Array.from({ length: n }).map((_, pi) => (
                <rect key={pi} x={nodeX(pi) - nodeW / 2} y={rowY(li) - nodeH / 2} width={nodeW} height={nodeH} rx={4} fill={ACCENT} opacity={0.82} filter="url(#mc-soft)" className="transition-all duration-200" />
              ))}
            </g>
          ))}

          {/* aggregator */}
          <rect x={GRID_MID - 46} y={AGG_Y - 12} width={92} height={24} rx={7} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#mc-soft)" />
          <text x={GRID_MID} y={AGG_Y + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>aggregator</text>

          {/* divider */}
          <line x1={430} x2={430} y1={ROW_TOP - 6} y2={AGG_Y + 12} stroke="currentColor" className="text-border" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />

          {/* quality gauge */}
          <text x={Q_X + Q_W / 2} y={Q_TOP - 22} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>the quality</text>
          <text x={Q_X + Q_W / 2} y={Q_TOP - 9} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>you get</text>
          <rect x={Q_X} y={Q_TOP} width={Q_W} height={Q_H} rx={9} fill="var(--muted)" opacity={0.5} />
          <rect x={Q_X} y={qFillY} width={Q_W} height={Q_BOT - qFillY} rx={9} fill={ACCENT} className="transition-all duration-300" />
          {/* single-model baseline */}
          <line x1={Q_X - 6} x2={Q_X + Q_W + 40} y1={baseY} y2={baseY} stroke="currentColor" className="text-muted-foreground" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <text x={Q_X + Q_W + 8} y={baseY - 4} className="fill-muted-foreground font-mono" fontSize={8.5}>single model · 57%</text>
          {/* current value */}
          <text x={Q_X + Q_W + 8} y={qFillY + 4} className="fill-foreground font-mono" fontSize={13} fontWeight={600}>{q.toFixed(1)}%</text>
          <text x={Q_X + Q_W / 2} y={Q_BOT + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>ceiling ≈ 72%</text>
        </svg>

        {/* sliders */}
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>layers L</span>
              <span className="text-foreground tabular-nums">{L}</span>
            </div>
            <input type="range" min={1} max={4} step={1} value={L} onChange={(e) => setL(parseInt(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.72_0.15_195)]" aria-label="number of layers" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>proposers n</span>
              <span className="text-foreground tabular-nums">{n}</span>
            </div>
            <input type="range" min={1} max={6} step={1} value={n} onChange={(e) => setN(parseInt(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.72_0.15_195)]" aria-label="proposers per layer" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="model calls" value={`${calls}`} />
          <Stat label="latency (depth)" value={`${latency}×`} />
          <Stat label="quality (stand-in)" value={`${q.toFixed(1)}%`} highlight />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {n === 1
            ? "With a single proposer there's nothing to aggregate — you're back to one model. Width is where collaborativeness lives."
            : calls >= 13
              ? "Deep and wide buys the top of the quality curve, but you're paying ~" +
                calls +
                " model calls and " +
                latency +
                "× the depth-latency per answer. Past here the curve is nearly flat — diminishing returns."
              : "A shallow, wide stack captures most of the gain cheaply: a couple of layers and a handful of diverse proposers. Quality saturates fast, so more depth mostly costs latency."}
        </p>
      </div>
    </figure>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium", highlight ? "text-foreground" : "text-foreground")} style={highlight ? { color: ACCENT } : undefined}>
        {value}
      </div>
    </div>
  )
}
