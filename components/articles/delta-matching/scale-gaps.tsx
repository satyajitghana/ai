"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// REPORTED, not re-run: validation cross-entropy of the paper's GDN/GQA hybrids (30B Nemotron-CC tokens), mean of two seeds,
// from Tables 1 and 2 of arXiv 2609.37852. The bar is the excess over each scale's own BF16/FP32 reference.

type Row = { label: string; ce: number }
const SCALES: { k: string; name: string; ref: number; rows: Row[] }[] = [
  {
    k: "0.569B",
    name: "0.569B",
    ref: 1.5233,
    rows: [
      { label: "naive FP8, stale delta", ce: 1.5399 },
      { label: "Delta-Matching", ce: 1.5228 },
    ],
  },
  {
    k: "1.67B",
    name: "1.67B",
    ref: 1.4178,
    rows: [
      { label: "naive FP8, stale delta", ce: 1.897 },
      { label: "cuDNN / Transformer Engine FP8", ce: 1.6105 },
      { label: "consistent dO only", ce: 1.4667 },
      { label: "Delta-Matching", ce: 1.4162 },
    ],
  },
  {
    k: "5.29B",
    name: "5.29B",
    ref: 1.3349,
    rows: [
      { label: "naive FP8, stale delta", ce: 1.9327 },
      { label: "Delta-Matching", ce: 1.3374 },
    ],
  },
]

const MAX = 0.62

export function ScaleGaps() {
  const [scale, setScale] = useState("1.67B")
  const s = SCALES.find((x) => x.k === scale) ?? SCALES[1]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">validation cross-entropy above BF16/FP32 · reported by the paper</span>
        <span className="font-mono text-[10px] text-muted-foreground">GDN/GQA hybrids, 30B tokens, mean of two seeds</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SCALES.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setScale(x.k)}
              aria-pressed={scale === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                scale === x.k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.name} parameters
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          BF16/FP32 reference: <span className="tabular-nums text-foreground">{s.ref.toFixed(4)}</span>
        </p>
        <div className="space-y-2">
          {s.rows.map((r) => {
            const gap = r.ce - s.ref
            const w = Math.min(100, (Math.max(gap, 0) / MAX) * 100)
            const good = gap < 0.01
            return (
              <div key={r.label} className="grid grid-cols-[11rem_1fr_6.5rem] items-center gap-2 font-mono text-[10px]">
                <span className="text-muted-foreground">{r.label}</span>
                <div className="h-3 rounded-sm bg-muted/40">
                  <div className="h-full rounded-sm" style={{ width: `${Math.max(w, 0.8)}%`, background: good ? "oklch(0.58 0.15 160)" : "oklch(0.62 0.19 30)", opacity: 0.85 }} />
                </div>
                <span className="text-right tabular-nums text-foreground">
                  {r.ce.toFixed(4)} ({gap >= 0 ? "+" : "−"}
                  {Math.abs(gap).toFixed(3)})
                </span>
              </div>
            )
          })}
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          The stale-delta gap is 0.017 at 0.569B and about 0.6 at 5.29B: the same shortcut, a very different cost. Short runs and small models hide it, which is the paper&apos;s warning about its own field.
        </p>
      </div>
    </figure>
  )
}
