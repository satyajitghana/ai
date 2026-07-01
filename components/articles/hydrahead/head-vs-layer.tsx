"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The core idea, made visible. A transformer is a grid of layers (rows) × heads
// (columns). Standard hybrids interleave WHOLE LAYERS of full attention (FA) and
// linear attention (LA) — every block is all-or-nothing. HydraHead's finding is
// that heads inside one layer specialize differently, so it hybridizes along the
// HEAD axis: keep costly FA only for the few retrieval-critical heads, run the rest
// as cheap LA. Toggle the strategy and watch where FA (the expensive part) lands.
// Static-friendly: the default render is meaningful without JS.

const LAYERS = 8
const HEADS = 8

// layer-wise: whole layers are FA (here 1 in 4 → a 3:1 LA:FA layer ratio)
const layerFA = (l: number) => l % 4 === 3

// head-wise (HydraHead): a small set of retrieval-critical heads keep FA,
// scattered across layers — deterministic pattern standing in for the paper's
// interpretability-driven selection. ~1 in 8 heads → a 7:1 LA:FA head ratio.
const headFA = (l: number, h: number) => (l * 3 + h * 5) % 8 === 0

export function HeadVsLayer() {
  const [headWise, setHeadWise] = useState(true)

  const isFA = (l: number, h: number) => (headWise ? headFA(l, h) : layerFA(l))
  let fa = 0
  for (let l = 0; l < LAYERS; l++) for (let h = 0; h < HEADS; h++) if (isFA(l, h)) fa++
  const total = LAYERS * HEADS
  const ratio = ((total - fa) / fa).toFixed(1)

  const FA = "oklch(0.72 0.15 25)"
  const LA = "oklch(0.72 0.13 195)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">attention hybridization · where full attention lives</span>
        <div className="flex gap-1">
          {[
            { k: false, label: "layer-wise" },
            { k: true, label: "head-wise (HydraHead)" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setHeadWise(o.k)}
              aria-pressed={headWise === o.k}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                headWise === o.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-3">
          {/* y label */}
          <div className="flex flex-col items-center justify-center">
            <span className="font-mono text-[9px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">layers →</span>
          </div>
          <div className="flex-1">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${HEADS}, 1fr)` }}>
              {Array.from({ length: LAYERS }).map((_, l) =>
                Array.from({ length: HEADS }).map((_, h) => {
                  const faHere = isFA(l, h)
                  return (
                    <div
                      key={`${l}-${h}`}
                      className="aspect-square rounded-[3px] transition-colors"
                      style={{ background: faHere ? FA : LA, opacity: faHere ? 0.95 : 0.35 }}
                      title={faHere ? "full attention" : "linear attention"}
                    />
                  )
                })
              )}
            </div>
            <div className="mt-1 text-center font-mono text-[9px] text-muted-foreground">heads →</div>
          </div>
        </div>

        {/* legend + stats */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px]">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px]" style={{ background: FA }} /> full attention (FA)</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px]" style={{ background: LA, opacity: 0.4 }} /> linear attention (LA)</span>
          <span className="text-muted-foreground">FA units: <span className="text-foreground">{fa}/{total}</span></span>
          <span className="text-muted-foreground">LA:FA ratio ≈ <span className="text-foreground">{ratio}:1</span></span>
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
