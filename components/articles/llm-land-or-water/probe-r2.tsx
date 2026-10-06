"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Gurnee & Tegmark (arXiv 2310.02207v3), Table 2: out-of-sample R^2 of a
// linear ridge probe vs a one-hidden-layer MLP probe (256 ReLU units) on the
// residual stream at 60% depth, for each Llama-2 size and dataset. Copied
// verbatim from the table. The point of the widget: the MLP, which can bend
// the read-out any way it likes, buys almost nothing over a straight line.

const DATASETS = ["World", "USA", "NYC", "Historical", "Entertainment", "Headlines"] as const

const TABLE: Record<string, { linear: number[]; mlp: number[] }> = {
  "Llama-2-7b": {
    linear: [0.881, 0.799, 0.219, 0.785, 0.788, 0.564],
    mlp: [0.897, 0.819, 0.204, 0.775, 0.746, 0.467],
  },
  "Llama-2-13b": {
    linear: [0.896, 0.825, 0.237, 0.804, 0.806, 0.645],
    mlp: [0.916, 0.824, 0.23, 0.818, 0.808, 0.656],
  },
  "Llama-2-70b": {
    linear: [0.911, 0.864, 0.359, 0.835, 0.885, 0.746],
    mlp: [0.926, 0.869, 0.312, 0.839, 0.884, 0.739],
  },
}
const MODELS = Object.keys(TABLE)

const W = 640
const rowH = 34
const padL = 104
const padR = 56
const padT = 8
const H = padT + DATASETS.length * rowH + 22
const sx = (v: number) => padL + v * (W - padL - padR)

const LIN = "oklch(0.62 0.14 250)"
const MLP = "oklch(0.7 0.13 60)"

export function ProbeR2() {
  const [model, setModel] = useState("Llama-2-70b")
  const row = TABLE[model]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">probe R² · straight line vs MLP · 60% depth</span>
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModel(m)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                model === m
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Linear vs MLP probe R squared for ${model}`}>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line x1={sx(g)} x2={sx(g)} y1={padT} y2={H - 18} className="stroke-border" strokeDasharray="2 3" />
              <text x={sx(g)} y={H - 6} textAnchor="middle" fontSize="9" className="fill-muted-foreground font-mono">
                {g.toFixed(2)}
              </text>
            </g>
          ))}
          {DATASETS.map((d, i) => {
            const y = padT + i * rowH
            const lin = row.linear[i]
            const mlp = row.mlp[i]
            return (
              <g key={d}>
                <text x={padL - 8} y={y + 17} textAnchor="end" fontSize="11" className="fill-foreground font-mono">
                  {d}
                </text>
                <rect x={sx(0)} y={y + 4} width={sx(lin) - sx(0)} height={11} rx={2} fill={LIN} />
                <rect x={sx(0)} y={y + 17} width={sx(mlp) - sx(0)} height={11} rx={2} fill={MLP} />
                <text x={sx(Math.max(lin, mlp)) + 6} y={y + 19} fontSize="10" className="fill-muted-foreground font-mono">
                  {(mlp - lin >= 0 ? "+" : "") + (mlp - lin).toFixed(3)}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-4 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: LIN }} />
            linear ridge probe
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: MLP }} />
            MLP probe, 256 units
          </span>
          <span>number = MLP minus linear</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Out-of-sample R² from Table 2 of Gurnee and Tegmark (2023). World, USA and NYC are the place
          datasets; the other three are time. Values copied from the paper, not re-run.
        </p>
      </div>
    </figure>
  )
}
