"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Transcribed from Recursive's benchmark chart (RecursiveSI/flint model card,
// assets/flint_benchmarks_nvfp4.png). "int" marks a score the chart flags as
// measured internally by Recursive; the whole SWE-bench Pro v2 panel carries
// that flag. Everything else is developer-reported. Means are computed here.
const BENCH = ["Terminal-Bench 2.1", "SWE-bench Pro v2", "SWE-bench Verified", "LiveCodeBench v6", "IFBench", "IFEval"] as const
const SHORT = ["TB 2.1", "SWE Pro v2", "SWE Verified", "LCB v6", "IFBench", "IFEval"] as const
const CODING = [0, 1, 2, 3]

type Row = { name: string; cls: "flint" | "moe" | "dense"; s: number[]; int: number[] }
const ROWS: Row[] = [
  { name: "Flint BF16", cls: "flint", s: [54.9, 89.7, 74.2, 80.3, 89.2, 95.1], int: [] },
  { name: "Flint NVFP4", cls: "flint", s: [53.7, 88.5, 74.1, 80.8, 88.1, 94.6], int: [] },
  { name: "Qwen 3.5", cls: "moe", s: [38.7, 68.6, 69.2, 74.6, 70.2, 91.9], int: [1] },
  { name: "Qwen 3.6", cls: "moe", s: [44.9, 73.8, 73.4, 80.4, 67.9, 89.6], int: [1] },
  { name: "Laguna XS 2.1", cls: "moe", s: [24.7, 38.6, 70.9, 49.5, 34.4, 73.7], int: [0, 1, 3, 4, 5] },
  { name: "Qwen 3.8", cls: "dense", s: [73.0, 94.9, 75.6, 90.3, 79.5, 94.6], int: [1, 2, 5] },
  { name: "Muse Glimmer", cls: "dense", s: [51.7, 86.0, 76.0, 63.5, 77.0, 94.7], int: [1, 3, 5] },
  { name: "Gemma 4", cls: "dense", s: [43.4, 61.7, 66.6, 80.0, 76.0, 94.6], int: [1] },
]
const CLS_LABEL = { flint: "Flint, 40B total", moe: "MoE, 33-35B total, 3B active", dense: "dense, 27-31B" }

const ACCENT = "oklch(0.62 0.17 45)"

export function BenchTable() {
  const [cols, setCols] = useState<"all" | "coding">("all")
  const [peer, setPeer] = useState<"moe" | "all">("moe")
  const idx = cols === "all" ? [0, 1, 2, 3, 4, 5] : CODING
  const rows = ROWS.filter((r) => peer === "all" || r.cls !== "dense")
  const mean = (r: Row) => idx.reduce((a, i) => a + r.s[i], 0) / idx.length
  const best = (i: number) => Math.max(...rows.filter((r) => r.name !== "Flint NVFP4").map((r) => r.s[i]))
  const bestMean = Math.max(...rows.filter((r) => r.name !== "Flint NVFP4").map(mean))
  const flint = ROWS[0]
  const peerMoE = ROWS.filter((r) => r.cls === "moe")
  const gapMoE = mean(flint) - Math.max(...peerMoE.map(mean))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Recursive’s comparison, re-tabulated</span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          Flint mean lead over best MoE peer: {gapMoE >= 0 ? "+" : ""}
          {gapMoE.toFixed(1)} points
        </span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "all six benchmarks"],
              ["coding", "coding four only"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCols(k)}
              aria-pressed={cols === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                cols === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground">·</span>
          {(
            [
              ["moe", "its class: MoE under 50B"],
              ["all", "add the dense models"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPeer(k)}
              aria-pressed={peer === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                peer === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-2 text-left font-normal">model</th>
                {idx.map((i) => (
                  <th key={i} className="px-1.5 py-1 text-right font-normal" title={BENCH[i]}>
                    {SHORT[i]}
                  </th>
                ))}
                <th className="py-1 pl-2 text-right font-normal">mean</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = mean(r)
                return (
                  <tr key={r.name} className={cn("border-t", r.cls === "flint" && "bg-muted/30")}>
                    <td className="py-1 pr-2">
                      <div className={cn(r.cls === "flint" && "font-semibold")}>{r.name}</div>
                      <div className="text-[9px] text-muted-foreground">{CLS_LABEL[r.cls]}</div>
                    </td>
                    {idx.map((i) => {
                      const top = r.name !== "Flint NVFP4" && r.s[i] === best(i)
                      return (
                        <td key={i} className="px-1.5 py-1 text-right tabular-nums" style={top ? { color: ACCENT, fontWeight: 600 } : undefined}>
                          {r.s[i].toFixed(1)}
                          {r.int.includes(i) ? <sup className="text-muted-foreground">†</sup> : null}
                        </td>
                      )
                    })}
                    <td
                      className="py-1 pl-2 text-right tabular-nums"
                      style={r.name !== "Flint NVFP4" && m === bestMean ? { color: ACCENT, fontWeight: 600 } : undefined}
                    >
                      {m.toFixed(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Orange marks the column leader among the rows shown (NVFP4 excluded, it is the same model). † measured internally by
          Recursive; the rest are each developer’s own numbers, run in setups that differ. Means are unweighted and computed here.
        </p>
      </div>
    </figure>
  )
}
