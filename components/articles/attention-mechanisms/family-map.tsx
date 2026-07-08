"use client"

import { useState } from "react"

import { ATT, FigureCard, GLOBAL, IDX, IO, LOCAL, WARM } from "./shared"

// The field-guide map: seven families of attention laid along a rough axis from
// "exact & dense" to "sparse / linear / systems". Click a family to see its members
// and the one honest tradeoff. This is also where the shared colour language is
// introduced — the same accents recur in every diagram below. Purely presentational,
// deterministic, no timers.

type Family = {
  id: string
  name: string
  color: string
  members: string[]
  trade: string
  cost: string
}

const FAMILIES: Family[] = [
  {
    id: "core",
    name: "dense core",
    color: "var(--foreground)",
    members: ["scaled dot-product", "multi-head (MHA)", "causal mask", "cross-attention", "bidirectional"],
    trade: "Reads everything, exactly. The baseline every variant below is trying to make cheaper.",
    cost: "O(N²) compute · full KV cache",
  },
  {
    id: "kv",
    name: "KV-sharing",
    color: IDX,
    members: ["MQA", "GQA", "MLA (latent)"],
    trade: "Keep full attention, shrink the per-token KV cache so decoding stops being memory-bound.",
    cost: "O(N²) compute · KV cache ÷ group factor",
  },
  {
    id: "struct",
    name: "structured sparse",
    color: LOCAL,
    members: ["sliding-window", "sink / StreamingLLM", "dilated (LongNet)", "block-sparse (BigBird)"],
    trade: "A fixed, position-based pattern. Cheap and predictable, but blind to content.",
    cost: "O(N·w) or O(N) · bounded cache",
  },
  {
    id: "content",
    name: "content sparse",
    color: ATT,
    members: ["NSA", "MiniMax SA", "LongCat SA"],
    trade: "Score the past and read only the blocks that matter for this query. Chosen from content, not position.",
    cost: "O(N·k) · read set per query",
  },
  {
    id: "linear",
    name: "linear / kernelized",
    color: GLOBAL,
    members: ["linear attention", "Performer (FAVOR+)", "lightning / gated-linear"],
    trade: "Fold the past into a fixed-size running state. Linear time, constant memory — approximate softmax.",
    cost: "O(N) · d×d state (constant)",
  },
  {
    id: "systems",
    name: "IO-aware systems",
    color: IO,
    members: ["FlashAttention", "PagedAttention"],
    trade: "Not a new attention — the same math, computed with far fewer HBM / memory round-trips.",
    cost: "exact · fewer memory accesses",
  },
  {
    id: "denoise",
    name: "denoising",
    color: WARM,
    members: ["differential attention"],
    trade: "Subtract a second softmax map to cancel the attention mass wasted on irrelevant tokens.",
    cost: "O(N²) · sharper maps",
  },
]

const W = 720
const NY = 60
const NH = 40
const MX = 16
const NW = (W - 2 * MX - (FAMILIES.length - 1) * 10) / FAMILIES.length
const nx = (i: number) => MX + i * (NW + 10)

export function FamilyMap() {
  const [sel, setSel] = useState(0)
  const f = FAMILIES[sel]

  return (
    <FigureCard label="the attention zoo · seven families" right={<span className="text-muted-foreground/50">click a family</span>}>
      <svg viewBox={`0 0 ${W} 120`} className="w-full" role="img" aria-label="Seven families of attention from dense and exact to sparse, linear and systems-level. Selected: the dense core.">
        <defs>
          <filter id="fm-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
          </filter>
          <linearGradient id="fm-axis" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--foreground)" stopOpacity="0.35" />
            <stop offset="1" stopColor={IO} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* axis */}
        <line x1={MX} y1={NY + NH + 22} x2={W - MX} y2={NY + NH + 22} stroke="url(#fm-axis)" strokeWidth={2} />
        <text x={MX} y={NY + NH + 38} className="fill-muted-foreground font-mono" fontSize={9}>
          exact &amp; dense
        </text>
        <text x={W - MX} y={NY + NH + 38} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
          sparse · linear · systems →
        </text>
        <text x={MX} y={28} className="fill-muted-foreground font-mono" fontSize={10}>
          each family shares an accent colour, reused in every diagram below
        </text>

        {FAMILIES.map((fam, i) => {
          const on = i === sel
          return (
            <g key={fam.id} className="cursor-pointer" onClick={() => setSel(i)}>
              <rect
                x={nx(i)}
                y={NY}
                width={NW}
                height={NH}
                rx={7}
                fill={on ? fam.color : "var(--background)"}
                opacity={on ? 0.92 : 1}
                stroke={fam.color}
                strokeWidth={on ? 2 : 1.4}
                filter={on ? "url(#fm-soft)" : undefined}
                className="transition-all duration-300"
              />
              <text
                x={nx(i) + NW / 2}
                y={NY + NH / 2 + 3.5}
                textAnchor="middle"
                className="font-mono"
                fontSize={9.5}
                fontWeight={600}
                fill={on ? (fam.color === "var(--foreground)" ? "var(--background)" : "var(--background)") : fam.color}
              >
                {fam.name}
              </text>
              {/* connector dot on the axis */}
              <circle cx={nx(i) + NW / 2} cy={NY + NH + 22} r={on ? 4 : 2.5} fill={fam.color} className="transition-all duration-300" />
            </g>
          )
        })}
      </svg>

      <div className="mt-3 rounded-lg border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="h-3 w-3 rounded-[3px]" style={{ background: f.color }} />
          <span className="font-mono text-sm font-semibold" style={{ color: f.color === "var(--foreground)" ? undefined : f.color }}>
            {f.name}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{f.cost}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {f.members.map((m) => (
            <span key={m} className="rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground" style={{ borderColor: f.color === "var(--foreground)" ? undefined : f.color }}>
              {m}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{f.trade}</p>
      </div>
    </FigureCard>
  )
}
