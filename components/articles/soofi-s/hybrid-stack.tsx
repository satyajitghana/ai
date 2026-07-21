"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Soofi S's 52-layer hybrid backbone (the Nemotron 3 Nano reference design): 23 Mamba-2
// sequence-mixing layers, 23 granular MoE layers, and just 6 Grouped-Query Attention
// layers distributed sparsely through the depth. Only those 6 attention layers keep a
// growing KV cache; the Mamba-2 layers hold a fixed-size recurrent state. The exact
// interleave is illustrative — the report specifies the counts, not the precise order.

type Kind = "mamba" | "moe" | "gqa"
const COLOR: Record<Kind, string> = {
  mamba: "oklch(0.62 0.20 320)", // Soofi magenta-violet
  moe: "oklch(0.60 0.13 250)", // indigo
  gqa: "oklch(0.70 0.15 70)", // amber — the attention layers that hold a KV cache
}
const LABEL: Record<Kind, string> = { mamba: "Mamba-2", moe: "MoE", gqa: "GQA attention" }

// 52 layers: 6 GQA at sparse, roughly even depths; the rest alternate Mamba-2 / MoE
// to 23 each. Deterministic — no randomness.
const GQA_AT = new Set([4, 12, 21, 29, 38, 47])
const STACK: Kind[] = (() => {
  const out: Kind[] = []
  let flip = 0
  for (let i = 0; i < 52; i++) {
    if (GQA_AT.has(i)) out.push("gqa")
    else {
      out.push(flip % 2 === 0 ? "mamba" : "moe")
      flip++
    }
  }
  return out
})()

const N = STACK.length
const W = 760
const H = 168
const MX = 20
const TOP = 40
const CH = 74 // cell height
const GAP = 3
const CW = (W - 2 * MX - (N - 1) * GAP) / N
const cx = (i: number) => MX + i * (CW + GAP)

export function HybridStack() {
  const [sel, setSel] = useState(20)
  const [kvOnly, setKvOnly] = useState(false)

  const selKind = STACK[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>52-layer hybrid backbone · input (left) → output (right)</span>
        <span className="text-muted-foreground/60">interleave illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A stack of 52 layers: 23 Mamba-2, 23 MoE, and 6 GQA attention layers. Layer ${sel + 1} is a ${LABEL[selKind]} layer.`}>
          <defs>
            <filter id="soofi-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.16" />
            </filter>
          </defs>

          {STACK.map((k, i) => {
            const isSel = i === sel
            const dim = kvOnly && k !== "gqa"
            return (
              <g key={i}>
                <rect
                  x={cx(i)}
                  y={TOP}
                  width={CW}
                  height={CH}
                  rx={2.5}
                  fill={COLOR[k]}
                  opacity={dim ? 0.14 : isSel ? 1 : 0.82}
                  stroke={isSel ? "var(--foreground)" : "transparent"}
                  strokeWidth={isSel ? 1.5 : 0}
                  filter={isSel ? "url(#soofi-soft)" : undefined}
                  className="transition-all duration-200"
                />
              </g>
            )
          })}

          {/* selected-layer caret + label */}
          <path d={`M ${cx(sel) + CW / 2 - 4} ${TOP - 4} L ${cx(sel) + CW / 2 + 4} ${TOP - 4} L ${cx(sel) + CW / 2} ${TOP + 1} Z`} fill="var(--foreground)" />
          <text x={MX} y={TOP - 12} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            Layer {sel + 1} · {LABEL[selKind]}
          </text>
          <text x={W - MX} y={TOP - 12} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            {kvOnly ? "6 layers keep a KV cache" : "23 Mamba-2 · 23 MoE · 6 GQA"}
          </text>
          <text x={MX} y={TOP + CH + 18} className="fill-muted-foreground font-mono" fontSize={9}>layer 1</text>
          <text x={W - MX} y={TOP + CH + 18} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>layer 52</text>
        </svg>

        {/* legend + controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-3">
            {(["mamba", "moe", "gqa"] as Kind[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: COLOR[k] }} />
                {LABEL[k]}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setKvOnly((v) => !v)}
            aria-pressed={kvOnly}
            className={cn(
              "ml-auto cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
              kvOnly ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            highlight KV-cache layers
          </button>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">scrub layer (drag)</div>
          <Range min={0} max={N - 1} value={sel} onChange={(e) => setSel(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.62 0.20 320)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Most of the depth is <span style={{ color: COLOR.mamba }}>Mamba-2</span> (linear-time sequence mixing, a
          fixed-size recurrent state) and granular{" "}
          <a href="/articles/mixture-of-experts-from-scratch" className="text-foreground underline decoration-foreground/30 underline-offset-2">MoE</a>{" "}
          <span style={{ color: COLOR.moe }}>capacity</span>. Full{" "}
          <span style={{ color: COLOR.gqa }}>attention</span> appears in only 6 of 52 layers — those are the only
          ones whose cache grows with context. It is the same hybrid recipe as{" "}
          <a href="/articles/nemotron-nvfp4" className="text-foreground underline decoration-foreground/30 underline-offset-2">Nemotron</a>,
          reused deliberately so the German–English data recipe can be measured against an architecture-identical
          control.
        </p>
      </div>
    </figure>
  )
}
