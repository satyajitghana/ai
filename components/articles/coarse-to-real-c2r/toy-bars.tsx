"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { TOY } from "./data"

// Measured with the numpy toy printed in the article: mean of 3 seeds, 600 held-out actual-coarse inputs, error
// against the real image (which includes fine texture no coarse image can encode, so the floor is not zero).
const VARIANTS = [
  { id: "paired_only", label: "Image pairs only", note: "C2R trained straight on the few paired images" },
  { id: "pseudo_no_bottleneck", label: "Pseudo, raw output", note: "R2C's soft output used as the control" },
  { id: "pseudo_bottleneck", label: "Pseudo, decoded", note: "R2C output snapped back onto the coarse set first" },
  { id: "oracle_true_coarse", label: "Oracle", note: "true coarse of the same videos (the paired data nobody has)" },
] as const

export function ToyBars() {
  const [i, setI] = useState(0)
  const row = TOY[i]
  const max = Math.max(...VARIANTS.map((v) => row[v.id][0]), TOY_FLOOR + 0.02)
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <label className="mb-3 flex items-center gap-3 text-sm">
        <span className="shrink-0">Image pairs: <strong className="font-mono tabular-nums">{row.n}</strong></span>
        <Range min={0} max={TOY.length - 1} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="Number of image pairs" />
      </label>
      <div className="space-y-2">
        {VARIANTS.map((v) => {
          const [m, s] = row[v.id]
          return (
            <div key={v.id} className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-2 text-sm sm:grid-cols-[11rem_1fr_7rem]">
              <span className={cn("truncate", v.id === "pseudo_bottleneck" && "font-semibold")} title={v.note}>{v.label}</span>
              <div className="relative h-4 rounded-sm bg-muted">
                <div className="h-4 rounded-sm" style={{ width: `${Math.round((m / max) * 100)}%`, background: v.id === "pseudo_bottleneck" ? "oklch(0.62 0.17 255)" : v.id === "pseudo_no_bottleneck" ? "oklch(0.62 0.16 30)" : "oklch(0.7 0.03 255)" }} />
                <div className="absolute top-0 h-4 w-px bg-foreground/70" style={{ left: `${Math.round((TOY_FLOOR / max) * 100)}%` }} title="texture floor" />
              </div>
              <span className="text-right font-mono text-xs tabular-nums">{m.toFixed(4)} <span className="text-muted-foreground">±{s.toFixed(4)}</span></span>
            </div>
          )
        })}
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed">
        Mean squared error against the real image, lower is better; the tick is the texture floor (0.0225), the variance of the fine noise no
        coarse input contains. Three seeds, ± is the standard deviation. {" "}
        <span className="font-mono text-xs uppercase text-muted-foreground">measured, toy</span>
      </figcaption>
    </figure>
  )
}

const TOY_FLOOR = 0.15 * 0.15
