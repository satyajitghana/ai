"use client"

import { useState } from "react"

import { DATA } from "@/components/articles/delta-matching/data"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Normalized row-sum residual |Σⱼ dSᵢⱼ| / Σⱼ |dSᵢⱼ| (paper eq. 23), median over rows, mean of 6 seeds, for random
// attention heads (B=1, H=4, T=512, D=64) through our simulated E4M3 attention. Numbers from data.ts, produced by
// public/articles/delta-matching/code/toy_rowsum.py. The white tick on each bar is the paper&apos;s value for the same
// method on its real 1.67B model (Table 9, layers 3-19), REPORTED, not ours.

type Method = "stale" | "consistent" | "matched"
const METHODS: { k: Method; label: string; color: string }[] = [
  { k: "stale", label: "stale  ⟨dO, O⟩", color: "oklch(0.62 0.19 30)" },
  { k: "consistent", label: "consistent dO", color: "oklch(0.68 0.14 85)" },
  { k: "matched", label: "matched  Σ P·dP̂", color: "oklch(0.58 0.15 160)" },
]

const PAPER: Record<"pre" | "post", Record<Method, number>> = {
  pre: { stale: 1.1045e-2, consistent: 2.466e-3, matched: 1.425e-7 },
  post: { stale: 1.1705e-2, consistent: 3.898e-3, matched: 2.7e-3 },
}

const LO = -9
const HI = -1.2
const pos = (v: number) => Math.min(100, Math.max(1.5, ((mlog10(v) - LO) / (HI - LO)) * 100))

function Pick({ items, value, onPick }: { items: { k: string; label: string }[]; value: string; onPick: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.k}
          type="button"
          onClick={() => onPick(it.k)}
          aria-pressed={value === it.k}
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

export function RowSumLab() {
  const [inputs, setInputs] = useState("gaussian")
  const [stage, setStage] = useState<"pre" | "post">("pre")
  const rows = DATA.rowsum.filter((r) => r.inputs === inputs)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">normalized row-sum residual of dS · lower is better · log scale 10⁻⁹ to 10⁻¹</span>
        <span className="font-mono text-[10px] text-muted-foreground">our toy heads, 6 seeds · white tick = the paper&apos;s real-model value</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <Pick items={[{ k: "gaussian", label: "Gaussian inputs" }, { k: "outliers", label: "outlier channels + heavy-tailed dO" }]} value={inputs} onPick={setInputs} />
        <Pick items={[{ k: "pre", label: "before the dS cast" }, { k: "post", label: "after the dS cast to E4M3" }]} value={stage} onPick={(k) => setStage(k as "pre" | "post")} />

        <div className="space-y-4 pt-1">
          {rows.map((r) => (
            <div key={r.logitStd}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                <span>logit spread {r.logitStd.toFixed(0)} (how sharp the attention rows are)</span>
                <span>FP8 error vs exact: O {(r.relErr.O * 100).toFixed(1)}% · dQ {(r.relErr.dq * 100).toFixed(1)}%</span>
              </div>
              <div className="space-y-1.5">
                {METHODS.map((m) => {
                  const v = r[m.k][stage]
                  return (
                    <div key={m.k} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2 font-mono text-[10px]">
                      <span className="text-muted-foreground">{m.label}</span>
                      <div className="relative h-3 rounded-sm bg-muted/40">
                        <div className="h-full rounded-sm" style={{ width: `${pos(v)}%`, background: m.color, opacity: 0.85 }} />
                        <div className="absolute inset-y-[-2px] w-[2px] bg-foreground" style={{ left: `${pos(PAPER[stage][m.k])}%` }} title={`paper: ${PAPER[stage][m.k].toExponential(1)}`} />
                      </div>
                      <span className="text-right tabular-nums text-foreground">{v.toExponential(1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Before the cast, matched sits at FP32 round-off (about 10⁻⁸) and the other two do not. The cast of dS to E4M3 itself breaks the zero sum, so matched rises to the 10⁻³ range
          afterwards; stale stays above it, by 1.7 to 2.5 times here, and consistent dO by about 1.2 to 1.3 times. The correction restores the invariant only up to that cast.
        </p>
      </div>
    </figure>
  )
}
