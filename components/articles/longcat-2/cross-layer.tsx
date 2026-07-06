"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Cross-Layer Indexing (CLI) — the second LSA cost cut, on a different axis from the
// per-query selection. A sparse-attention layer normally pays for its own index pass
// (scoring the past to decide what to read). CLI exploits the empirical stability of
// attention saliency across adjacent layers: one index pass is *shared* across a group
// of consecutive layers, so half the layers reuse a neighbour's selection instead of
// recomputing it. LongCat shares an index every 2 layers; the 3 MTP draft steps share
// a single pass. Flip the mode to collapse the per-layer index passes. Illustrative.

const ACC = "oklch(0.62 0.16 150)" // LongCat green
const IDX = "oklch(0.60 0.15 255)" // index pass (blue)

const L = 6 // transformer layers shown
const W = 760
const H = 300
const TOP = 52
const LH = 30
const LGAP = 12
const LAYER_X = 452
const LAYER_W = 250
const IDX_X = 70
const IDX_W = 168

const layerY = (i: number) => TOP + i * (LH + LGAP)

type Mode = "per" | "cli"

export function CrossLayer() {
  const [mode, setMode] = useState<Mode>("cli")

  // per-layer: one index node per layer. cli: one node per pair, serving 2 layers.
  const groups =
    mode === "per"
      ? Array.from({ length: L }, (_, i) => [i])
      : Array.from({ length: Math.ceil(L / 2) }, (_, g) => [g * 2, g * 2 + 1].filter((i) => i < L))

  const passes = groups.length

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cross-layer indexing · one pass, several layers</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${passes} index passes serving ${L} attention layers in ${mode === "cli" ? "cross-layer shared" : "per-layer"} mode.`}>
          <defs>
            <marker id="cl-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={IDX} strokeWidth={1.5} />
            </marker>
            <filter id="cl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.15" />
            </filter>
          </defs>

          <text x={IDX_X} y={34} className="fill-muted-foreground font-mono" fontSize={11}>index passes</text>
          <text x={LAYER_X} y={34} className="fill-muted-foreground font-mono" fontSize={11}>attention layers (depth ↓)</text>

          {/* connectors */}
          {groups.map((g, gi) => {
            const gy = (layerY(g[0]) + layerY(g[g.length - 1]) + LH) / 2
            return g.map((li) => (
              <path
                key={`${gi}-${li}`}
                d={curve(IDX_X + IDX_W, gy, LAYER_X, layerY(li) + LH / 2)}
                fill="none"
                stroke={IDX}
                strokeWidth={1.5}
                markerEnd="url(#cl-arr)"
                opacity={0.65}
                className="transition-all duration-300"
              />
            ))
          })}

          {/* index pass nodes */}
          {groups.map((g, gi) => {
            const gy = (layerY(g[0]) + layerY(g[g.length - 1]) + LH) / 2
            return (
              <g key={gi}>
                <rect x={IDX_X} y={gy - 15} width={IDX_W} height={30} rx={7} fill="var(--background)" stroke={IDX} strokeWidth={1.5} filter="url(#cl-soft)" />
                <text x={IDX_X + IDX_W / 2} y={gy + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
                  {mode === "cli" && g.length > 1 ? `index · layers ${g[0] + 1}–${g[g.length - 1] + 1}` : `index · layer ${g[0] + 1}`}
                </text>
              </g>
            )
          })}

          {/* layers */}
          {Array.from({ length: L }, (_, i) => {
            const shared = mode === "cli" && i % 2 === 1
            return (
              <g key={i}>
                <rect
                  x={LAYER_X}
                  y={layerY(i)}
                  width={LAYER_W}
                  height={LH}
                  rx={6}
                  fill={ACC}
                  opacity={shared ? 0.16 : 0.9}
                  stroke={ACC}
                  strokeWidth={1.5}
                  filter="url(#cl-soft)"
                  className="transition-all duration-300"
                />
                <text
                  x={LAYER_X + 12}
                  y={layerY(i) + LH / 2 + 4}
                  className={shared ? "fill-foreground font-mono" : "font-mono"}
                  fontSize={10}
                  fontWeight={600}
                  fill={shared ? undefined : "var(--background)"}
                >
                  layer {i + 1}
                </text>
                <text
                  x={LAYER_X + LAYER_W - 12}
                  y={layerY(i) + LH / 2 + 4}
                  textAnchor="end"
                  className="font-mono"
                  fontSize={9}
                  fill={shared ? "var(--muted-foreground)" : "var(--background)"}
                  opacity={shared ? 1 : 0.85}
                >
                  {shared ? "reuses index" : "own index"}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">mode</span>
            <button
              type="button"
              onClick={() => setMode("per")}
              aria-pressed={mode === "per"}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                mode === "per" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === "per" ? { background: IDX } : undefined}
            >
              index per layer
            </button>
            <button
              type="button"
              onClick={() => setMode("cli")}
              aria-pressed={mode === "cli"}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                mode === "cli" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === "cli" ? { background: ACC } : undefined}
            >
              cross-layer (every 2)
            </button>
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            <span style={{ color: mode === "cli" ? ACC : IDX }}>{passes}</span> index passes for {L} layers
            {mode === "cli" ? " · 2× fewer" : ""}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Selecting which tokens to read costs an <span style={{ color: IDX }}>index pass</span> per layer. Because attention saliency
          barely moves between adjacent layers, LongCat reuses one selection across a group — <span className="text-foreground">one index every 2 layers</span>,
          halving the indexer work, taught by cross-layer distillation during training. The same trick collapses the 3-step
          Multi-Token-Prediction draft into a single shared pass for speculative decoding. (Note: the SGLang deployment drops the separate
          hierarchical stage for simplicity — CLI is the part that ships.)
        </p>
      </div>
    </figure>
  )
}
