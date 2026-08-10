"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Meta's own comparison table, re-tallied. Numbers transcribed from the model
// card and cross-checked against the highlighted cells in the blog's version of
// the same figure. Sorted by margin so the shape is visible: Muse Glimmer wins
// the agentic rows it was built for and loses the computer-use and long-horizon
// terminal rows to Qwen3.6-27B.
//
// The safety rows are scored inverted (lower violation / attack-success is
// better) and are held out of the win tally, because "who wins" is the wrong
// frame for them — see the article.

type Row = { name: string; cat: Cat; mg: number; gemma: number; qwen: number; lowerBetter?: boolean }
type Cat = "agentic" | "coding" | "multimodal" | "reasoning" | "safety"

const ROWS: Row[] = [
  { name: "MCP Atlas", cat: "agentic", mg: 75.5, gemma: 54.2, qwen: 62.5 },
  { name: "DeepSearch QA", cat: "agentic", mg: 74.6, gemma: 61.7, qwen: 71.1 },
  { name: "τ³-Banking", cat: "agentic", mg: 23.5, gemma: 15.1, qwen: 16.7 },
  { name: "WildClawBench", cat: "agentic", mg: 47.6, gemma: 37.6, qwen: 43.2 },
  { name: "GDPval-AA v2", cat: "agentic", mg: 953, gemma: 811, qwen: 1141 },
  { name: "Gaia2", cat: "agentic", mg: 43.3, gemma: 36.4, qwen: 40.0 },
  { name: "SkillsBench", cat: "agentic", mg: 44.3, gemma: 32.4, qwen: 46.6 },
  { name: "OSWorld-Verified", cat: "agentic", mg: 65.9, gemma: 58.5, qwen: 75.6 },
  { name: "SWE-Bench Pro", cat: "coding", mg: 51.2, gemma: 36.9, qwen: 50.2 },
  { name: "SWE-Bench Verified", cat: "coding", mg: 76.0, gemma: 66.6, qwen: 77.2 },
  { name: "TerminalBench 2.1", cat: "coding", mg: 51.7, gemma: 43.4, qwen: 60.7 },
  { name: "SciCode", cat: "coding", mg: 43.6, gemma: 43.4, qwen: 39.8 },
  { name: "Charxiv Reasoning", cat: "multimodal", mg: 78.8, gemma: 77.7, qwen: 78.4 },
  { name: "ScreenSpot Pro", cat: "multimodal", mg: 75.4, gemma: 75.9, qwen: 76.1 },
  { name: "OmniDocBench v1.5", cat: "multimodal", mg: 75.8, gemma: 72.5, qwen: 77.8 },
  { name: "MMMU Pro", cat: "multimodal", mg: 74, gemma: 73, qwen: 75 },
  { name: "IFBench", cat: "reasoning", mg: 77.0, gemma: 76.0, qwen: 70.8 },
  { name: "AIME 2026", cat: "reasoning", mg: 94.7, gemma: 89.2, qwen: 94.1 },
  { name: "GPQA Diamond", cat: "reasoning", mg: 83.5, gemma: 85.7, qwen: 84.2 },
  { name: "HLE Text", cat: "reasoning", mg: 22.0, gemma: 23.6, qwen: 23.1 },
  { name: "AA-LCR", cat: "reasoning", mg: 80.0, gemma: 68.3, qwen: 73.3 },
  { name: "Beam128K", cat: "reasoning", mg: 65.1, gemma: 58.2, qwen: 63.0 },
  { name: "CI Memories · violation", cat: "safety", mg: 26.4, gemma: 12.1, qwen: 53.4, lowerBetter: true },
  { name: "Siren AgentDojo · ASR", cat: "safety", mg: 28.4, gemma: 25.6, qwen: 40.3, lowerBetter: true },
]

const MG = "oklch(0.60 0.15 255)"
const RIVAL = "oklch(0.58 0.19 25)"
const MUT = "oklch(0.62 0.03 250)"

const CATS: { k: Cat | "all"; label: string }[] = [
  { k: "all", label: "all" },
  { k: "agentic", label: "agentic" },
  { k: "coding", label: "coding" },
  { k: "multimodal", label: "multimodal" },
  { k: "reasoning", label: "reasoning" },
  { k: "safety", label: "safety" },
]

// margin against the better of the two rivals, as a percentage of that rival
function margin(r: Row): number {
  const best = r.lowerBetter ? Math.min(r.gemma, r.qwen) : Math.max(r.gemma, r.qwen)
  const d = r.lowerBetter ? best - r.mg : r.mg - best
  return (d / best) * 100
}

export function BenchLedger() {
  const [cat, setCat] = useState<Cat | "all">("all")

  const shown = ROWS.filter((r) => cat === "all" || r.cat === cat).slice().sort((a, b) => margin(b) - margin(a))
  const scored = ROWS.filter((r) => r.cat !== "safety")
  const wins = scored.filter((r) => margin(r) > 0).length

  const chip = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  const maxAbs = Math.max(...shown.map((r) => Math.abs(margin(r))), 1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Muse Glimmer vs. the better rival, per row
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          wins {wins} of {scored.length} scored rows
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button key={c.k} type="button" onClick={() => setCat(c.k)} className={chip(cat === c.k)}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-0.5">
          {shown.map((r) => {
            const m = margin(r)
            const win = m > 0
            const w = (Math.abs(m) / maxAbs) * 48
            return (
              <div
                key={r.name}
                className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-x-2 rounded px-2 py-1"
              >
                <span className="truncate font-mono text-[10px] text-muted-foreground">{r.name}</span>
                <div className="relative h-3">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <div
                    className="absolute inset-y-0 rounded-sm"
                    style={{
                      background: win ? MG : RIVAL,
                      left: win ? "50%" : `${50 - w}%`,
                      width: `${Math.max(w, 0.6)}%`,
                    }}
                  />
                </div>
                <span
                  className="w-14 text-right font-mono text-[10px] tabular-nums"
                  style={{ color: win ? MG : RIVAL }}
                >
                  {m > 0 ? "+" : ""}{m.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MG }} /> Muse Glimmer ahead
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: RIVAL }} /> best rival ahead
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MUT }} /> safety rows scored
            inverted
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Meta publishes a comparison in which its own model loses{" "}
          <span className="text-foreground">{scored.length - wins} of {scored.length}</span>{" "}scored rows, and the
          losses are not rounding — OSWorld-Verified by 9.7 points and TerminalBench by 9.0, both to Qwen3.6-27B.
          Filter to <em>agentic</em>{" "}and the shape appears: the rows Muse Glimmer wins by a distance are the ones
          measuring tool schemas and multi-turn task completion, and the rows it loses are computer-use and
          long-horizon terminal work. That is a coherent, legible profile rather than a uniform win, and publishing
          it in that form is the least common thing about this release.
        </p>
      </div>
    </figure>
  )
}
