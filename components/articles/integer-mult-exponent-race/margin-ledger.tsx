"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The seven assembly margins g1..g7 (each cost row is p^(1-g_i) per bit) for three
// witnesses, as log2(g_i). kappa must sit strictly below the smallest margin.
// Exact rationals, then log2, computed with Python fractions from:
//   OpenAI:  upstream/build/sections/08-assembly.tex, eq. (fixed-parameters) and
//            (margin-list): eps = 2^-75, c = 2^-56, tau = 1 - 2^-50, lambda' = 1 - 2^-54,
//            delta = 1/16. min g = g2 = 2^-181 = 2 kappa.
//   2^-30:   certificates/ternary-side.json, assembly_control.margins (main @ 1a74950).
//   PR #13:  certificates/source-frame-network.json (PR head 3ef246f), regenerated
//            locally and recomputed by hand; g5 there is fast_margins' 1 - delta - 2 eps.
// What each row charges is from Table "costs" in 08-assembly.tex.

type Witness = { id: string; label: string; kappa: string; l2kappa: number; g: number[] }

const ROWS = [
  { name: "g1", what: "prefix-slot moves, single butterfly rounds", formula: "1 − ε(1+c)" },
  { name: "g2", what: "chunk exchanges for transform layout", formula: "ε·c·(1−τ)" },
  { name: "g3", what: "simultaneous butterfly rounds", formula: "ε·(1−λ′)" },
  { name: "g4", what: "CRT and axis layouts", formula: "1−τ−ε(2−τ) → (1−τ)(1−ε)" },
  { name: "g5", what: "Gaussian line maps", formula: "1/4−δ−3ε/2 → 1−δ−2ε" },
  { name: "g6", what: "chirps, twists, scalar products", formula: "1−δ−ε" },
  { name: "g7", what: "packed polynomial products", formula: "ε" },
]

const WITNESSES: Witness[] = [
  { id: "oai", label: "OpenAI manuscript", kappa: "2^-182", l2kappa: -182, g: [0, -181, -129, -50, -2.415, -0.093, -75] },
  { id: "c30", label: "Colkitt 2^-30 checkpoint", kappa: "2^-30", l2kappa: -30, g: [-0.736, -29.997, -29.997, -27.996, -12.977, -0.322, -2.323] },
  { id: "pr13", label: "PR #13 (eumemic)", kappa: "7699/10^10", l2kappa: -20.309, g: [-18.932, -20.309, -20.309, -20.309, -18.932, -1, -1] },
]

const W = 640
const ROW_H = 30
const LABEL = 96
const PAD = 16
const SCALE_MIN = -190

const bx = (l2: number) => LABEL + ((l2 - SCALE_MIN) / -SCALE_MIN) * (W - LABEL - PAD)

export function MarginLedger() {
  const [id, setId] = useState("c30")
  const w = WITNESSES.find((v) => v.id === id) ?? WITNESSES[0]
  const minL2 = Math.min(...w.g)
  const H = ROWS.length * ROW_H + 40

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        The seven margins below one · log₂ g, longer bar = bigger margin
      </figcaption>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Choose a witness">
        {WITNESSES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setId(v.id)}
            aria-pressed={id === v.id}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs",
              id === v.id ? "border-foreground text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Seven margins for the ${w.label}, on a log base 2 scale. The smallest, at 2 to the ${minL2}, caps kappa, which is ${w.kappa}.`}
      >
        {[-180, -120, -60, 0].map((t) => (
          <g key={t}>
            <line x1={bx(t)} x2={bx(t)} y1={8} y2={H - 24} stroke="var(--border)" strokeWidth={0.6} />
            <text x={bx(t)} y={H - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {t === 0 ? "1" : `2^${t}`}
            </text>
          </g>
        ))}
        <line x1={bx(w.l2kappa)} x2={bx(w.l2kappa)} y1={4} y2={H - 24} stroke="oklch(0.55 0.2 25)" strokeDasharray="4 3" strokeWidth={1.4} />
        <text x={bx(w.l2kappa) + 4} y={14} fontSize={10} fill="oklch(0.55 0.2 25)" className="font-mono">
          κ = {w.kappa}
        </text>
        {ROWS.map((r, i) => {
          const v = w.g[i]
          const binding = v === minL2
          const yy = 22 + i * ROW_H
          return (
            <g key={r.name}>
              <text x={8} y={yy + 13} fontSize={11} className="fill-foreground font-mono">
                {r.name}
              </text>
              <rect
                x={bx(SCALE_MIN)}
                y={yy}
                width={Math.max(1, bx(v) - bx(SCALE_MIN))}
                height={18}
                rx={3}
                fill={binding ? "oklch(0.55 0.2 25)" : "oklch(0.62 0.16 150)"}
                opacity={binding ? 0.9 : 0.55}
              />
              <text
                x={v > -25 ? bx(v) - 4 : bx(v) + 4}
                y={yy + 13}
                textAnchor={v > -25 ? "end" : "start"}
                fontSize={10}
                className={v > -25 ? "fill-background font-mono" : "fill-muted-foreground font-mono"}
              >
                2^{v.toFixed(1)}
              </text>
            </g>
          )
        })}
      </svg>
      <ul className="mt-2 grid grid-cols-1 gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        {ROWS.map((r) => (
          <li key={r.name}>
            {r.name}: {r.what} · {r.formula}
          </li>
        ))}
      </ul>
    </figure>
  )
}
