"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The headline, made tunable. A corpus of D-dimensional float32 embeddings costs
// dim×4 bytes each; turbovec quantizes each to 2–4 bits after a random rotation, so
// the same corpus fits in a fraction of the RAM — often the difference between
// "needs a server" and "fits on a laptop." Drag the corpus size and flip the
// bit-width; the SVG bars and the 16 GB budget line update live. Real compression
// ratios (d=768 OpenAI embeddings, measured in the repo's benchmarks).

const DIM = 768
const FP32_BYTES = DIM * 4 // 3072
// measured index sizes (incl. per-vector scale + calibration overhead)
const RATIO = { 2: 15.8, 4: 8.0 } as const
const BUDGET_GB = 16

const ACCENT = "oklch(0.72 0.15 195)"
const FP = "oklch(0.68 0.04 40)"
const OVER = "oklch(0.7 0.15 25)"

// scene geometry (viewBox units)
const W = 600
const H = 150
const BX0 = 86
const BX1 = 540

const fmt = (gb: number) => (gb < 1 ? `${(gb * 1000).toFixed(0)} MB` : `${gb.toFixed(1)} GB`)

export function MemoryFit() {
  const [millions, setMillions] = useState(10)
  const [bits, setBits] = useState<2 | 4>(4)

  const n = millions * 1_000_000
  const fp32GB = (n * FP32_BYTES) / 1e9
  const tvGB = fp32GB / RATIO[bits]
  const fits = tvGB <= BUDGET_GB
  const fp32Fits = fp32GB <= BUDGET_GB

  const maxGB = Math.max(fp32GB, BUDGET_GB * 1.15)
  const sx = (gb: number) => BX0 + Math.max(0, Math.min(1, gb / maxGB)) * (BX1 - BX0)
  const budgetX = sx(BUDGET_GB)

  const rows = [
    { label: "float32", gb: fp32GB, color: FP, fit: fp32Fits, y: 40 },
    { label: `turbovec ${bits}-bit`, gb: tvGB, color: ACCENT, fit: fits, y: 82 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">corpus in RAM · float32 vs turbovec ({DIM}-dim)</span>
        <div className="flex gap-1">
          {[2, 4].map((bw) => (
            <button
              key={bw}
              type="button"
              onClick={() => setBits(bw as 2 | 4)}
              aria-pressed={bits === bw}
              className={cn("cursor-pointer rounded px-2 py-1 font-mono text-[10px] transition-colors", bits === bw ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
              style={bits === bw ? { background: ACCENT } : undefined}
            >
              {bw}-bit
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${millions}M vectors, float32 needs ${fmt(fp32GB)} and turbovec ${bits}-bit needs ${fmt(tvGB)}; ${fits ? "fits" : "does not fit"} in ${BUDGET_GB} GB`}>
          <defs>
            <filter id="mf-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* budget line */}
          <line x1={budgetX} y1={24} x2={budgetX} y2={112} stroke={OVER} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.75} />
          <text x={budgetX} y={18} textAnchor="middle" className="font-mono" fontSize={10} fill={OVER}>{BUDGET_GB} GB budget</text>

          {/* baseline */}
          <line x1={BX0} y1={112} x2={BX1} y2={112} stroke="var(--border)" strokeWidth={1} />

          {/* bars */}
          {rows.map((row) => (
            <g key={row.label}>
              <text x={BX0 - 8} y={row.y + 17} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>{row.label}</text>
              <rect x={BX0} y={row.y} width={sx(row.gb) - BX0} height={24} rx={5} fill={row.fit ? row.color : OVER} opacity={row.fit ? 0.92 : 0.7} filter="url(#mf-soft)" className="transition-all duration-200" />
              <text x={Math.min(sx(row.gb) + 7, W - 46)} y={row.y + 17} className="fill-foreground font-mono tabular-nums" fontSize={11} fontWeight={600}>{fmt(row.gb)}</text>
            </g>
          ))}
          <text x={BX1} y={132} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>RAM footprint →</text>
        </svg>

        {/* corpus slider */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>corpus size</span>
            <span className="tabular-nums text-foreground">{millions}M vectors</span>
          </div>
          <input type="range" min={1} max={50} step={1} value={millions} onChange={(e) => setMillions(+e.target.value)} className="w-full cursor-pointer accent-[oklch(0.72_0.15_195)]" aria-label="corpus size in millions" />
        </div>

        {/* readout */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground">compression <span style={{ color: ACCENT }}>{RATIO[bits]}×</span></span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">fits in {BUDGET_GB} GB? <span style={{ color: fits ? ACCENT : OVER }}>turbovec {fits ? "yes" : "no"}</span> · fp32 {fp32Fits ? "yes" : "no"}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          At {millions}M vectors, float32 needs <span className="text-foreground">{fmt(fp32GB)}</span>{" "}
          — turbovec holds it in <span className="text-foreground">{fmt(tvGB)}</span>.
          The classic 10M-document corpus drops from ~31 GB (needs a big box) to ~4 GB (fits on a
          laptop), and the search runs on the packed codes directly — no decompression.
        </p>
      </div>
    </figure>
  )
}
