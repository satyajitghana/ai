"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// PhoneBench v1 leaderboard, reproduced from the model card's own chart
// (images/01-phonebench-v1-leaderboard.png), not paraphrased. Every field
// below is a number printed in that chart -- score, TTFAT P50 / "P50 floor" /
// P95, and cost/min. "P50 floor" is only measured for the dedicated-endpoint
// (Modal-hosted) rows; third-party API rows don't have one.
//
// The point this table is built to surface: PhoneLLM Alpha 1 and Nemotron 3
// Nano 30B base are architecturally identical (PhoneLLM is a full-parameter
// fine-tune, same shapes, same weights layout) -- so their latency and cost
// numbers are IDENTICAL, digit for digit (331/197/~600ms, $0.0025/min).
// Fine-tuning changed the score from 28.6% to 72.3%. It changed nothing else,
// because it couldn't -- the compute graph is the same graph.

type Row = {
  model: string
  score: number
  p50: number | null
  p50Floor: number | null
  p95: number | null
  p95Approx: boolean
  cost: number
  tag?: "tuned" | "base"
}

const ROWS: Row[] = [
  { model: "Gemini 3.6 Flash", score: 78.6, p50: 1168, p50Floor: null, p95: 1468, p95Approx: false, cost: 0.0751 },
  { model: "GPT-5.6 Terra", score: 72.4, p50: 980, p50Floor: null, p95: 1957, p95Approx: false, cost: 0.0347 },
  { model: "PhoneLLM Alpha 1", score: 72.3, p50: 331, p50Floor: 197, p95: 600, p95Approx: true, cost: 0.0025, tag: "tuned" },
  { model: "GPT-5.6 Luna", score: 70.7, p50: 786, p50Floor: null, p95: 1736, p95Approx: false, cost: 0.0035 },
  { model: "Qwen 3.8 27B", score: 70.0, p50: null, p50Floor: 286, p95: null, p95Approx: false, cost: 0.0074 },
  { model: "Claude Sonnet 5", score: 68.9, p50: 1651, p50Floor: null, p95: 2166, p95Approx: false, cost: 0.052 },
  { model: "DeepSeek V4 Flash 0731", score: 68.6, p50: 464, p50Floor: 303, p95: 600, p95Approx: true, cost: 0.0687 },
  { model: "Claude Haiku 4.5", score: 67.8, p50: 707, p50Floor: null, p95: 899, p95Approx: false, cost: 0.0188 },
  { model: "Gemma 4 31B", score: 58.1, p50: 385, p50Floor: 254, p95: 600, p95Approx: true, cost: 0.0101 },
  { model: "Kimi K2.6 NVFP4", score: 57.9, p50: 313, p50Floor: 227, p95: 600, p95Approx: true, cost: 0.0372 },
  { model: "Gemini 3.5 Flash Lite", score: 57.8, p50: 1190, p50Floor: null, p95: 1339, p95Approx: false, cost: 0.0082 },
  { model: "GPT-4.1", score: 57.4, p50: 889, p50Floor: null, p95: 1190, p95Approx: false, cost: 0.0292 },
  { model: "Nemotron 3 Super 120B base", score: 55.9, p50: 274, p50Floor: 235, p95: 600, p95Approx: true, cost: 0.0036 },
  { model: "Nemotron 3 Ultra 550B-A55B base", score: 38.1, p50: 342, p50Floor: 240, p95: 600, p95Approx: true, cost: 0.0279 },
  { model: "Nemotron 3 Nano 30B base", score: 28.6, p50: 331, p50Floor: 197, p95: 600, p95Approx: true, cost: 0.0025, tag: "base" },
]

const TUNED = "oklch(0.55 0.16 155)"
const BASE = "oklch(0.68 0.13 85)"

type SortKey = "score" | "p50" | "cost"

export function LeaderboardExplorer() {
  const [sortBy, setSortBy] = useState<SortKey>("score")

  const rows = useMemo(() => {
    const withNull = (v: number | null) => (v === null ? Infinity : v)
    if (sortBy === "score") return [...ROWS].sort((a, b) => b.score - a.score)
    if (sortBy === "p50") return [...ROWS].sort((a, b) => withNull(a.p50) - withNull(b.p50))
    return [...ROWS].sort((a, b) => a.cost - b.cost)
  }, [sortBy])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">PhoneBench v1, 15 models, real chart values</span>
        <div className="flex gap-1.5">
          {(
            [
              ["score", "sort by score"],
              ["p50", "sort by TTFAT P50"],
              ["cost", "sort by cost/min"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortBy(k)}
              aria-pressed={sortBy === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sortBy === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-mono text-[10.5px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">model</th>
                <th className="px-1.5 py-1 text-right font-normal">score</th>
                <th className="px-1.5 py-1 text-right font-normal">TTFAT P50</th>
                <th className="px-1.5 py-1 text-right font-normal">P95</th>
                <th className="px-1.5 py-1 text-right font-normal">cost/min</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.model}
                  className={cn("border-t", r.tag === "tuned" && "bg-[oklch(0.55_0.16_155_/_0.08)]", r.tag === "base" && "bg-[oklch(0.68_0.13_85_/_0.06)]")}
                >
                  <td className="py-1" style={{ color: r.tag === "tuned" ? TUNED : r.tag === "base" ? BASE : "currentColor" }}>
                    {r.model}
                  </td>
                  <td className="px-1.5 py-1 text-right tabular-nums">{r.score.toFixed(1)}%</td>
                  <td className="px-1.5 py-1 text-right tabular-nums">
                    {r.p50 === null ? "--" : `${r.p50}`}
                    {r.p50Floor !== null && <span className="text-muted-foreground"> ({r.p50Floor} floor)</span>}
                  </td>
                  <td className="px-1.5 py-1 text-right tabular-nums">
                    {r.p95 === null ? "--" : `${r.p95Approx ? "~" : ""}${r.p95}`}
                  </td>
                  <td className="px-1.5 py-1 text-right tabular-nums">${r.cost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sort by TTFAT or cost and <span style={{ color: TUNED }}>PhoneLLM Alpha 1</span> and{" "}
          <span style={{ color: BASE }}>Nemotron 3 Nano 30B base</span> land on the exact same row —
          331ms / 197ms floor / ~600ms P95, $0.0025/min, digit for digit. That&rsquo;s not a
          coincidence, it&rsquo;s the same weight shapes on the same hardware: full-parameter
          fine-tuning changes what the model outputs, not how much compute producing that output
          costs. Sort by score and the only thing that moved is <span style={{ color: TUNED }}>72.3%</span>{" "}
          against <span style={{ color: BASE }}>28.6%</span> — 43.7 points, for free, on an unchanged
          latency and cost profile.
        </p>
      </div>
    </figure>
  )
}
