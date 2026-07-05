"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The core idea, made visible. A transformer is a grid of layers (rows) × heads
// (columns), drawn as a composed field of nodes. Standard hybrids interleave WHOLE
// LAYERS of full attention (FA) and linear attention (LA) — every node in a row is
// all-or-nothing. HydraHead's finding is that heads inside one layer specialize
// differently, so it hybridizes along the HEAD axis: keep costly FA (the highlighted
// nodes) only for the few retrieval-critical heads, run the rest as cheap LA. Toggle
// the strategy and watch where FA lands. Static-friendly default render.

const LAYERS = 8
const HEADS = 8

// layer-wise: whole layers are FA (here 1 in 4 → a 3:1 LA:FA layer ratio)
const layerFA = (l: number) => l % 4 === 3

// head-wise (HydraHead): a small set of retrieval-critical heads keep FA,
// scattered across layers — deterministic pattern standing in for the paper's
// interpretability-driven selection. ~1 in 8 heads → a 7:1 LA:FA head ratio.
const headFA = (l: number, h: number) => (l * 3 + h * 5) % 8 === 0

const FA = "oklch(0.64 0.18 25)"
const LA = "oklch(0.60 0.13 205)"

// scene geometry
const AX = 42 // left axis gutter
const TOP = 18
const CELL = 38
const GAP = 8
const cellX = (h: number) => AX + h * (CELL + GAP)
const cellY = (l: number) => TOP + l * (CELL + GAP)
const GRIDW = HEADS * CELL + (HEADS - 1) * GAP
const GRIDH = LAYERS * CELL + (LAYERS - 1) * GAP
const W = AX + GRIDW + 8
const H = TOP + GRIDH + 26

export function HeadVsLayer() {
  const [headWise, setHeadWise] = useState(true)

  const isFA = (l: number, h: number) => (headWise ? headFA(l, h) : layerFA(l))
  let fa = 0
  for (let l = 0; l < LAYERS; l++) for (let h = 0; h < HEADS; h++) if (isFA(l, h)) fa++
  const total = LAYERS * HEADS
  const ratio = ((total - fa) / fa).toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">attention hybridization · where full attention lives</span>
        <div className="flex gap-1">
          {[
            { k: false, label: "layer-wise" },
            { k: true, label: "head-wise" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setHeadWise(o.k)}
              aria-pressed={headWise === o.k}
              className={cn(
                "cursor-pointer rounded px-2 py-1 font-mono text-xs transition-colors",
                headWise === o.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-sm" role="img" aria-label={`${headWise ? "Head-wise" : "Layer-wise"} hybridization: ${fa} of ${total} attention units are full attention, an LA:FA ratio of about ${ratio} to 1`}>
          <defs>
            <filter id="hvl-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* axis labels */}
          <text x={12} y={TOP + GRIDH / 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10} transform={`rotate(-90 12 ${TOP + GRIDH / 2})`}>layers →</text>
          <text x={AX + GRIDW / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>heads →</text>

          {/* node grid */}
          {Array.from({ length: LAYERS }).map((_, l) =>
            Array.from({ length: HEADS }).map((_, h) => {
              const faHere = isFA(l, h)
              return (
                <rect
                  key={`${l}-${h}`}
                  x={cellX(h)}
                  y={cellY(l)}
                  width={CELL}
                  height={CELL}
                  rx={7}
                  fill={faHere ? FA : LA}
                  opacity={faHere ? 0.95 : 0.28}
                  stroke={faHere ? FA : "transparent"}
                  strokeWidth={1.5}
                  filter={faHere ? "url(#hvl-soft)" : undefined}
                  className="transition-all duration-300"
                >
                  <title>{faHere ? "full attention" : "linear attention"}</title>
                </rect>
              )
            })
          )}
        </svg>

        {/* legend + stats */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px]">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-[4px]" style={{ background: FA }} /> full attention (FA)</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-[4px]" style={{ background: LA, opacity: 0.4 }} /> linear attention (LA)</span>
          <span className="text-muted-foreground">FA units <span className="text-foreground">{fa}/{total}</span></span>
          <span className="text-muted-foreground">LA:FA ≈ <span className="text-foreground">{ratio}:1</span></span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {headWise
            ? "Head-wise: full attention is kept only for the handful of retrieval-critical heads, scattered wherever they occur. The same long-context quality falls out of far less FA — a leaner LA:FA ratio at equal capability."
            : "Layer-wise: whole layers are full attention or nothing. It works, but it's a blunt granularity — every head in an FA layer pays the quadratic cost, even the ones doing local, LA-friendly work."}
        </p>
      </div>
    </figure>
  )
}
