"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// "Rich Content", the depth axis. Horizontal expansion asks how many parallel
// things fit on one canvas; depth asks whether the model can nest interfaces
// inside each other and keep every layer's own style intact. The blog's demo
// renders, outer→inner, a VSCode window → a Qwen Chat window → a WeChat chat →
// a pour-over-coffee poster — a "picture-in-picture-in-picture". Drag the depth.

const ACCENT = "oklch(0.62 0.19 300)"
const LAYERS = [
  { label: "VSCode window", tint: "oklch(0.55 0.03 250)" },
  { label: "Qwen Chat", tint: "oklch(0.62 0.19 300)" },
  { label: "WeChat thread", tint: "oklch(0.6 0.12 150)" },
  { label: "coffee poster", tint: "oklch(0.62 0.13 55)" },
]

const W = 360
const H = 232

export function NestedUI() {
  const [depth, setDepth] = useState(4)
  const inset = 22

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        depth · one instruction, interfaces nested inside interfaces
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Nested-interface diagram ${depth} layers deep.`}>
          {LAYERS.slice(0, depth).map((layer, i) => {
            const pad = i * inset
            const x = pad
            const y = pad
            const w = W - pad * 2
            const h = H - pad * 2
            const last = i === depth - 1
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={8}
                  fill={last ? layer.tint : "var(--background)"}
                  fillOpacity={last ? 0.16 : 1}
                  stroke={layer.tint}
                  strokeWidth={last ? 2 : 1.5}
                />
                {/* title bar */}
                <rect x={x} y={y} width={w} height={16} rx={8} fill={layer.tint} fillOpacity={0.9} />
                <rect x={x} y={y + 8} width={w} height={8} fill={layer.tint} fillOpacity={0.9} />
                <text x={x + 8} y={y + 11.5} className="font-mono" fontSize="8" fill="white">
                  {layer.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-4 grid grid-cols-2 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">nesting depth</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>{depth}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">innermost layer</div>
            <div className="mt-0.5 truncate text-sm tabular-nums text-foreground">{LAYERS[depth - 1].label}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>layers deep</span>
            <span className="tabular-nums text-foreground">{depth}</span>
          </div>
          <Range
            min={1}
            max={4}
            step={1}
            value={depth}
            onChange={(e) => setDepth(+e.target.value)}
            className="w-full"
            aria-label="nesting depth"
            accent={ACCENT}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each frame keeps its own chrome — window controls, chat bubbles, poster type — so the model
          has to hold four distinct UI grammars at once and place them <span style={{ color: ACCENT }}>inside</span>{" "}
          one another. That&rsquo;s logical nesting, not collage.
        </p>
      </div>
    </figure>
  )
}
