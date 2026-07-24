"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Generational comparison on the metrics the post gives for all three parts:
// memory bandwidth and exponential (softmax) throughput. Rubin's absolute
// headline specs sit in the strip below. Numbers: NVIDIA Rubin architecture post.

const ACCENT = "oklch(0.7 0.17 145)"
const GENS = ["Blackwell", "Blackwell Ultra", "Rubin"] as const

const METRICS = [
  { label: "Memory bandwidth (TB/s)", vals: [8, 8, 22], fmt: (v: number) => `${v}` },
  { label: "BF16/FP16 exp throughput (×)", vals: [1, 2, 4], fmt: (v: number) => `${v}×` },
  { label: "FP32 exp throughput (×)", vals: [1, 2, 2], fmt: (v: number) => `${v}×` },
]

const RUBIN_SPECS = [
  ["336B", "transistors"],
  ["224", "SMs"],
  ["896", "Tensor Cores"],
  ["50 PF", "NVFP4"],
  ["288 GB", "HBM4"],
  ["3.6 TB/s", "NVLink 6"],
]

export function GenSpecs() {
  const [gi, setGi] = useState(2)

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Blackwell → Rubin, generation over generation</span>
        <div className="flex flex-wrap gap-1">
          {GENS.map((g, i) => (
            <button key={g} type="button" onClick={() => setGi(i)} className={chip(i === gi)}>{g}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {METRICS.map((m) => {
            const max = Math.max(...m.vals)
            return (
              <div key={m.label}>
                <div className="mb-1 font-mono text-[11px] text-muted-foreground">{m.label}</div>
                <div className="space-y-1">
                  {GENS.map((g, i) => (
                    <div key={g} className="grid grid-cols-[110px_1fr_46px] items-center gap-2">
                      <span className={cn("font-mono text-[10px]", i === gi ? "text-foreground" : "text-muted-foreground/70")}>{g}</span>
                      <span className="h-3.5 overflow-hidden rounded bg-muted/40">
                        <span className="block h-full rounded transition-all duration-500" style={{ width: `${(m.vals[i] / max) * 100}%`, background: i === gi ? ACCENT : "oklch(0.6 0.03 250)" }} />
                      </span>
                      <span className={cn("text-right font-mono text-[11px] tabular-nums", i === gi ? "text-foreground" : "text-muted-foreground")}>{m.fmt(m.vals[i])}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide" style={{ color: ACCENT }}>Rubin GPU · headline specs</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {RUBIN_SPECS.map(([v, l]) => (
              <div key={l} className="text-center">
                <div className="font-mono text-sm tabular-nums text-foreground">{v}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
