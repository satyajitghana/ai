"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { VARIANTS, type Variant } from "./round2-data"

// Measured: lol_toy.py, second round. Five ways to train the same L = 4 tied
// router on the same task. "Separation" is how well the chosen block identifies
// the primitive: for each step, the share of examples whose block's most common
// primitive is their own primitive (0.25 when blocks ignore the primitive, 1
// when each block serves exactly one). The heatmap is the share of trained-
// program examples sent to each block.

const PRIMS = ["inc", "rev", "rot", "mul3"]
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const pct = (v: number) => `${(100 * v).toFixed(1)}%`

function Heat({ v, seed }: { v: Variant; seed: number }) {
  const t = v.tables[seed]
  if (!t) return null
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {t.map((step, si) => (
        <div key={si}>
          <div className="mb-1 text-muted-foreground">{`step ${si + 1}`}</div>
          <table className="w-full border-separate border-spacing-0.5 text-center">
            <thead>
              <tr>
                <th />
                {step[0].map((_, j) => <th key={j} className="font-normal text-muted-foreground">{`E${j + 1}`}</th>)}
              </tr>
            </thead>
            <tbody>
              {step.map((row, q) => (
                <tr key={q}>
                  <td className="pr-1 text-left text-muted-foreground">{PRIMS[q]}</td>
                  {row.map((share, j) => (
                    <td key={j} className="rounded-sm text-[10px]"
                      style={{ background: `oklch(0.7 0.14 250 / ${(0.08 + 0.92 * share).toFixed(3)})` }}>
                      {share >= 0.05 ? Math.round(100 * share) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

export function RouterTraining() {
  const [sel, setSel] = useState(VARIANTS[0]?.id ?? "code")
  const [seed, setSeed] = useState(0)
  const v = VARIANTS.find((x) => x.id === sel) ?? VARIANTS[0]
  const W = 560
  const rowH = 34
  const padL = 190
  const H = VARIANTS.length * rowH + 26
  const x = (val: number) => padL + (W - padL - 46) * val

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">training the router five ways · measured</span>
        <span className="flex gap-3 font-mono text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "oklch(0.75 0.15 60)" }} />held-out, top-1</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "oklch(0.7 0.13 230)" }} />separation</span>
        </span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[480px]" role="img"
            aria-label="Held-out accuracy and block-primitive separation for five router training schemes">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={4} y2={H - 18} className="stroke-muted-foreground/20" />
                <text x={x(t)} y={H - 5} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">{`${t * 100}%`}</text>
              </g>
            ))}
            {VARIANTS.map((r, i) => {
              const y = 6 + i * rowH
              const bars: [string, number[], string][] = [
                ["held", r.held, "oklch(0.75 0.15 60)"],
                ["sep", r.separation, "oklch(0.7 0.13 230)"],
              ]
              return (
                <g key={r.id} onClick={() => setSel(r.id)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y - 2} width={W} height={rowH - 3} rx={4}
                    className={cn(sel === r.id ? "fill-muted/60" : "fill-transparent")} />
                  <text x={6} y={y + 12} fontSize={10.5} className="fill-foreground font-mono">{r.label}</text>
                  {bars.map(([k, vals, col], j) => {
                    const m = mean(vals)
                    return (
                      <g key={k}>
                        <rect x={padL} y={y + 2 + j * 12} width={Math.max(1, x(m) - padL)} height={9} rx={2} fill={col} />
                        {vals.map((val, si) => <circle key={si} cx={x(val)} cy={y + 6.5 + j * 12} r={2} className="fill-foreground/70" />)}
                        <text x={Math.min(W - 40, Math.max(x(m), x(Math.max(...vals))) + 6)} y={y + 10 + j * 12} fontSize={8.5} className="fill-muted-foreground font-mono">
                          {k === "held" ? pct(m) : m.toFixed(2)}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>
        <div className="space-y-3 rounded-lg border px-3 py-3 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">{v.label}: {v.detail}</span>
            <span className="flex gap-1">
              {v.tables.map((_, s) => (
                <button key={s} type="button" onClick={() => setSeed(s)}
                  className={cn("rounded border px-2 py-0.5", seed === s ? "bg-muted text-foreground" : "text-muted-foreground")}>
                  {`seed ${s}`}
                </button>
              ))}
            </span>
          </div>
          <div className="text-muted-foreground">
            trained {v.train.map(pct).join(" · ")} · held-out {v.held.map(pct).join(" · ")}
            {v.heldSoft ? ` · held-out with the soft mixture kept at test: ${v.heldSoft.map(pct).join(" · ")}` : ""}
          </div>
          <Heat v={v} seed={Math.min(seed, v.tables.length - 1)} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Rows are primitives, columns are library blocks, cells are the percentage of examples with that primitive at
          that step sent to that block. A router that had found the primitives would show one dark cell per row and a
          different column for each row, the same at every step.
        </p>
      </div>
    </figure>
  )
}
