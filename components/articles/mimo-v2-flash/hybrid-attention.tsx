"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// MiMo-V2-Flash's hybrid block, one layer at a time, as a composed SVG scene. Each block is 5
// Sliding-Window Attention layers (each token sees only a small local window) followed by 1 Global
// Attention layer (each token sees everything). The trick: stacked SWA layers COMPOUND their reach —
// after 5 of them the effective receptive field is ~5 windows wide, even though every layer only ever
// looked one window back — and the periodic global layer then mixes across the whole sequence. Cheap
// local layers most of the time, full reach once per block. Auto-advances through the 6 layers; the
// shaded span on the token strip is what the query token can reach so far. Illustrative; real window
// is 128 tokens.

const N = 30 // token cells (a stand-in for a long context)
const WIN = 4 // window in cells (stands in for 128 tokens)
const LAYERS = [
  { type: "SWA", i: 1 },
  { type: "SWA", i: 2 },
  { type: "SWA", i: 3 },
  { type: "SWA", i: 4 },
  { type: "SWA", i: 5 },
  { type: "GA", i: 1 },
] as const

const SWA = "oklch(0.72 0.14 195)"
const GA = "oklch(0.72 0.15 40)"

// scene geometry
const W = 720
const H = 208
const ML = 18
const AVAIL = W - 2 * ML
const NODE_W = 90
const NODE_GAP = (AVAIL - LAYERS.length * NODE_W) / (LAYERS.length - 1)
const NODE_Y = 24
const NODE_H = 30
const nodeX = (i: number) => ML + i * (NODE_W + NODE_GAP)
const CELL_GAP = 2
const CELL_W = (AVAIL - (N - 1) * CELL_GAP) / N
const CELL_H = 30
const STRIP_Y = 120
const cellX = (t: number) => ML + t * (CELL_W + CELL_GAP)

export function HybridAttention() {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 1) % LAYERS.length), 1800)
    return () => clearInterval(id)
  }, [playing])

  const layer = LAYERS[k]
  const q = N - 1
  const swaCount = LAYERS.slice(0, k + 1).filter((l) => l.type === "SWA").length
  const reach = layer.type === "GA" ? N : Math.min(N, swaCount * WIN + 1)
  const first = q - reach + 1
  const c = layer.type === "GA" ? GA : SWA

  // curved connector from the active layer node down to the start of its reachable span
  const spanStart = cellX(first)
  const drop = () => {
    const x1 = nodeX(k) + NODE_W / 2
    const y1 = NODE_Y + NODE_H
    const x2 = spanStart + CELL_W / 2
    const y2 = STRIP_Y - 2
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one hybrid block · 5× sliding-window + 1× global</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Hybrid block of 5 sliding-window layers then 1 global layer. At layer ${k + 1} the query token reaches ${reach >= N ? "the whole sequence" : `${reach} cells`}.`}>
          <defs>
            <marker id="ha-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={c} strokeWidth={1.5} />
            </marker>
            <marker id="ha-arr-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="ha-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* connectors between stacked layers */}
          {LAYERS.slice(0, -1).map((_, idx) => (
            <path
              key={idx}
              d={`M ${nodeX(idx) + NODE_W} ${NODE_Y + NODE_H / 2} C ${nodeX(idx) + NODE_W + NODE_GAP / 2} ${NODE_Y + NODE_H / 2}, ${nodeX(idx) + NODE_W + NODE_GAP / 2} ${NODE_Y + NODE_H / 2}, ${nodeX(idx + 1)} ${NODE_Y + NODE_H / 2}`}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.2}
              opacity={0.45}
              markerEnd="url(#ha-arr-m)"
            />
          ))}

          {/* layer nodes */}
          {LAYERS.map((l, i) => {
            const lc = l.type === "GA" ? GA : SWA
            const on = i === k
            return (
              <g key={i} className="cursor-pointer" onClick={() => setK(i)}>
                <rect x={nodeX(i)} y={NODE_Y} width={NODE_W} height={NODE_H} rx={7} fill={on ? lc : "var(--background)"} opacity={on ? 0.95 : 1} stroke={lc} strokeWidth={on ? 2 : 1.5} filter={on ? "url(#ha-soft)" : undefined} className="transition-all duration-300" />
                <text x={nodeX(i) + NODE_W / 2} y={NODE_Y + NODE_H / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={on ? "var(--background)" : lc}>
                  {l.type}{l.type === "SWA" ? ` ${l.i}` : ""}
                </text>
              </g>
            )
          })}

          {/* connector: active layer → its reachable span */}
          <path d={drop()} fill="none" stroke={c} strokeWidth={1.5} opacity={0.75} markerEnd="url(#ha-arr)" className="transition-all duration-300" />

          {/* token strip */}
          {Array.from({ length: N }).map((_, t) => {
            const inReach = t >= first && t <= q
            const isQuery = t === q
            return (
              <rect
                key={t}
                x={cellX(t)}
                y={STRIP_Y}
                width={CELL_W}
                height={CELL_H}
                rx={2.5}
                fill={isQuery ? "var(--foreground)" : inReach ? c : "var(--muted)"}
                opacity={isQuery ? 1 : inReach ? 0.85 : 0.35}
                className="transition-all duration-300"
              >
                <title>{isQuery ? "query token" : inReach ? "reachable" : "not yet reachable"}</title>
              </rect>
            )
          })}

          {/* span bracket + labels */}
          <line x1={spanStart} y1={STRIP_Y + CELL_H + 6} x2={cellX(q) + CELL_W} y2={STRIP_Y + CELL_H + 6} stroke={c} strokeWidth={1.5} opacity={0.7} className="transition-all duration-300" />
          <text x={ML} y={STRIP_Y - 6} className="font-mono" fontSize={9} fill="var(--muted-foreground)">← earlier tokens</text>
          <text x={W - ML} y={STRIP_Y - 6} textAnchor="end" className="font-mono" fontSize={9} fill="var(--muted-foreground)">query ↑</text>
          <text x={(spanStart + cellX(q) + CELL_W) / 2} y={STRIP_Y + CELL_H + 18} textAnchor="middle" className="font-mono" fontSize={9} fill={c}>
            {reach >= N ? "whole sequence" : `effective reach: ${reach} cells`}
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>this layer: <span style={{ color: c }}>{layer.type === "GA" ? "global attention" : `sliding window (${WIN}-cell)`}</span></span>
          <span className="ml-auto">reach so far: <span className="text-foreground">{reach >= N ? "whole sequence" : `${reach} cells`}</span></span>
        </div>

        {/* every layer's paragraph overlaid in one grid cell so the block sizes to the
            tallest and the page never reflows as layers auto-advance */}
        <div className="mt-3 grid">
          {LAYERS.map((l, li) => {
            const swaC = LAYERS.slice(0, li + 1).filter((x) => x.type === "SWA").length
            return (
              <p
                key={li}
                aria-hidden={li !== k}
                className={cn(
                  "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
                  li === k ? "opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                {l.type === "GA"
                  ? "The 6th layer is global: every token attends to the entire sequence, mixing information the local layers couldn't reach directly. One global layer per block restores full context at a fraction of the cost of making every layer global."
                  : `Sliding-window layer ${l.i}: each token attends only to its local window (128 tokens in the real model). But stacking them compounds the reach — after ${swaC} SWA layer${swaC > 1 ? "s" : ""} the query effectively sees ~${swaC} windows back, with a KV cache bounded by the window, not the context length.`}
              </p>
            )
          })}
        </div>
      </div>
    </figure>
  )
}
