"use client"

import { useState } from "react"

import { CELLS } from "@/components/articles/softmax-fix/rowsum-data"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The row sum of dS in an attention backward, measured (not simulated live):
// every number comes from rowsum-data.ts, which exp/rowsum.py printed. Pick the
// kind of row, the format the gradient operands are rounded to, and round to
// nearest or stochastically. Three ways to get D = rowsum(P * dP) are compared:
// the stored output D = <dO, O>, the high-precision auxiliary product
// D = <dO, P V>, and the per-draw rule D = <P, dP_hat> from the rounded row.

const ROWS = [
  { k: "diffuse", label: "diffuse row" },
  { k: "sink6", label: "sink, +6 logit" },
  { k: "sink12", label: "sink, +12 logit" },
]
const FMTS = ["bf16", "fp8", "fp4"]

const METHODS = [
  { k: "stored", label: "stored output  D = <dO, O>", color: "oklch(0.66 0.17 40)" },
  { k: "aux", label: "auxiliary product  D = <dO, P V>", color: "oklch(0.70 0.13 85)" },
  { k: "perdraw", label: "per-draw  D = <P, dP̂>", color: "oklch(0.60 0.15 255)" },
] as const

const LO = -10
const HI = -1

function Pick({ items, value, onPick }: { items: { k: string; label: string }[]; value: string; onPick: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.k}
          type="button"
          onClick={() => onPick(it.k)}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            value === it.k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function RowsumProbe() {
  const [row, setRow] = useState("sink12")
  const [fmt, setFmt] = useState("fp4")
  const [mode, setMode] = useState("sr")

  const cell = CELLS.find((c) => c.row === row && c.fmt === fmt && c.sr === (mode === "sr"))
  if (!cell) return null
  const showHit = row !== "diffuse"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">row sum of dS over 150 draws, one attention row of 256 keys</span>
        <span className="font-mono text-[10px] text-muted-foreground">sink key holds P = {cell.p0.toFixed(3)} of the row</span>
      </div>
      <div className="space-y-2 p-3 sm:p-4">
        <Pick items={ROWS} value={row} onPick={setRow} />
        <Pick items={FMTS.map((k) => ({ k, label: k }))} value={fmt} onPick={setFmt} />
        <Pick
          items={[
            { k: "rn", label: "round to nearest" },
            { k: "sr", label: "stochastic rounding" },
          ]}
          value={mode}
          onPick={setMode}
        />

        <div className="space-y-3 pt-2">
          {METHODS.map((m) => {
            const [rs, hit, err] = cell[m.k]
            const pos = Math.min(100, Math.max(2, ((mlog10(rs) - LO) / (HI - LO)) * 100))
            return (
              <div key={m.k}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[10px]">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="tabular-nums text-foreground">
                    mean |Σ dS| = {rs.toExponential(2)}
                    {showHit ? ` · sink key within 1× of truth: ${hit}/150` : ""}
                    {` · dS error ${(err * 100).toFixed(2)}%`}
                  </span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-muted/40">
                  <div className="h-2.5 rounded-full" style={{ width: `${pos}%`, background: m.color }} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="pt-1 font-mono text-[9px] text-muted-foreground">
          bar length is log10 of the mean row sum, from 1e-10 to 1e-1. Exact arithmetic would give 0; the per-draw floor near 1e-8 to 1e-10 is the fp32 sum of P.
        </p>
      </div>
    </figure>
  )
}
