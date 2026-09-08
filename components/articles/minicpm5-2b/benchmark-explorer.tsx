"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Two datasets, both transcribed by hand from openbmb/MiniCPM5-2B's own README.
//
// "vs. baselines": the full 34-row evaluation table ("Evaluation Results"),
// 9 models in the README's own column order (MiniCPM5-2B, then its 2B-class
// set LFM2.5-2.6B/Qwen3.5-2B/Gemma-4-E2B-it, then its 4B-class reference set
// Qwen3.5-4B/granite-4.2-3B/Nemotron-3-Nano-4B/Gemma-4-E4B-it/LFM2.5-8B-A1B).
// The live "average, this filter" readout reproduces the card's own claimed
// 53.9 average exactly (53.88 unrounded) when scope=all categories, class=all.
//
// "what RL + OPD bought": read off the README's own bar chart
// (assets/minicpm5/minicpm5_2b_rl_opd_score_gains.png, "Score Gains from
// RL + OPD" -- SFT-baseline bar plus a stacked RL+OPD gain segment, per
// benchmark), not re-derived. Two rows from that chart (HLE, Terminal-Bench
// v2.1) had SFT-baseline segments too thin to read a reliable number off and
// are left out rather than guessed. GDPval v2 reports two post-RL+OPD
// numbers on the chart (an Artificial-Analysis-official figure and an
// internal-eval figure); the AA figure is used here, matching how the README
// marks AA-sourced numbers elsewhere in its evaluation table.

type Row = { name: string; cat: string; vals: number[] }

const MODELS = [
  "MiniCPM5-2B",
  "LFM2.5-2.6B",
  "Qwen3.5-2B",
  "Gemma-4-E2B-it",
  "Qwen3.5-4B",
  "granite-4.2-3B",
  "Nemotron-3-Nano-4B",
  "Gemma-4-E4B-it",
  "LFM2.5-8B-A1B",
] as const

const CLASS: ("2B" | "4B")[] = ["2B", "2B", "2B", "2B", "4B", "4B", "4B", "4B", "4B"]

const ROWS: Row[] = [
  { name: "LiveCodeBench v6", cat: "Code Reasoning", vals: [69.1, 42.1, 20.2, 42.9, 56.4, 58.9, 50.7, 53.9, 39.8] },
  { name: "LCB-Pro 25Q2 (Easy)", cat: "Code Reasoning", vals: [68.0, 30.9, 10.3, 27.1, 58.3, 54.6, 51.6, 45.8, 27.8] },
  { name: "LCB-Pro 25Q2 (Medium)", cat: "Code Reasoning", vals: [17.5, 0.0, 0.0, 0.0, 7.0, 5.3, 5.3, 1.8, 0.0] },
  { name: "OJBench", cat: "Code Reasoning", vals: [32.5, 11.2, 2.6, 11.6, 24.8, 21.8, 20.0, 19.0, 8.2] },
  { name: "SciCode (wbg)", cat: "Code Reasoning", vals: [26.3, 14.2, 2.8, 20.9, 16.1, 24.9, 16.4, 24.4, 7.8] },
  { name: "AIME 2025", cat: "Math Reasoning", vals: [86.5, 41.9, 29.6, 31.7, 78.8, 79.4, 56.3, 37.1, 46.0] },
  { name: "AIME 2026", cat: "Math Reasoning", vals: [86.5, 45.2, 29.0, 39.8, 82.7, 83.5, 62.1, 45.0, 56.7] },
  { name: "HMMT Feb 2026", cat: "Math Reasoning", vals: [63.8, 33.7, 20.5, 17.8, 64.0, 60.8, 51.3, 30.1, 38.5] },
  { name: "MATH-500", cat: "Math Reasoning", vals: [94.6, 89.6, 85.8, 85.4, 99.0, 97.0, 91.6, 88.2, 93.2] },
  { name: "IFBench", cat: "Instruction Following", vals: [66.3, 59.0, 46.0, 25.7, 59.0, 73.0, 58.3, 28.3, 51.0] },
  { name: "IFEval", cat: "Instruction Following", vals: [86.7, 93.4, 77.5, 31.4, 90.2, 93.7, 88.0, 44.4, 90.8] },
  { name: "Multi-IF", cat: "Instruction Following", vals: [71.8, 76.8, 57.1, 40.3, 73.6, 75.9, 65.9, 45.9, 71.4] },
  { name: "MMLU-Pro", cat: "General Knowledge", vals: [70.8, 65.2, 64.3, 56.0, 78.0, 65.8, 65.7, 68.3, 63.1] },
  { name: "MMLU-Redux", cat: "General Knowledge", vals: [84.7, 80.0, 80.0, 71.8, 88.7, 78.9, 79.8, 83.7, 80.0] },
  { name: "HLE", cat: "General Knowledge", vals: [8.9, 6.2, 2.6, 4.8, 9.9, 6.6, 4.9, 3.8, 6.9] },
  { name: "GPQA-Diamond", cat: "General Knowledge", vals: [70.2, 55.8, 45.6, 43.3, 77.1, 55.9, 51.3, 57.6, 51.3] },
  { name: "SuperGPQA", cat: "General Knowledge", vals: [40.8, 26.2, 38.6, 30.3, 52.8, 39.9, 37.8, 38.7, 34.5] },
  { name: "AA-LCR", cat: "Long Context", vals: [59.0, 5.3, 28.7, 17.0, 61.0, 24.3, 17.3, 33.0, 0.0] },
  { name: "NoLiMa", cat: "Long Context", vals: [68.1, 0.7, 17.1, 3.9, 43.5, 5.1, 1.1, 2.3, 0.5] },
  { name: "LongBenchPro", cat: "Long Context", vals: [44.8, 23.7, 8.2, 42.2, 58.4, 34.8, 27.9, 53.5, 19.6] },
  { name: "LongBench v2", cat: "Long Context", vals: [43.7, 30.3, 24.9, 33.2, 47.3, 36.0, 32.0, 42.7, 30.4] },
  { name: "τ³-Bench Banking", cat: "Tool Use", vals: [20.8, 7.2, 2.1, 3.9, 6.8, 5.6, 1.2, 4.1, 3.4] },
  { name: "τ²-Bench Telecom", cat: "Tool Use", vals: [97.1, 90.4, 69.0, 20.8, 92.1, 40.9, 28.1, 20.8, 16.1] },
  { name: "BFCL v4", cat: "Tool Use", vals: [66.6, 61.1, 43.6, 36.6, 56.8, 52.2, 43.7, 47.0, 49.2] },
  { name: "SWE-bench Verified", cat: "Coding Agent", vals: [46.4, 6.0, 5.0, 2.0, 33.6, 36.8, 3.0, 15.0, 0.4] },
  { name: "SWE-bench Pro", cat: "Coding Agent", vals: [14.4, 0.6, 0.8, 0.0, 28.2, 12.3, 0.1, 3.3, 0.4] },
  { name: "Terminal-Bench v2.1", cat: "Coding Agent", vals: [8.6, 4.5, 3.0, 0.4, 25.8, 13.9, 3.8, 1.9, 1.9] },
  { name: "BrowseComp-ZH", cat: "Search Agent", vals: [43.5, 9.8, 18.2, 4.7, 39.6, 21.1, 3.3, 7.0, 13.2] },
  { name: "BrowseComp Top100", cat: "Search Agent", vals: [39.7, 13.7, 19.3, 6.0, 33.3, 19.0, 4.7, 6.3, 9.7] },
  { name: "GAIA Text-103", cat: "Search Agent", vals: [88.7, 49.5, 47.9, 30.1, 78.6, 57.3, 26.5, 39.5, 41.1] },
  { name: "GDPval-AA v2", cat: "General Agent", vals: [19.6, 4.5, 0.0, 0.0, 11.7, 0.0, 0.0, 0.0, 0.0] },
  { name: "Claw-Gym", cat: "General Agent", vals: [59.2, 19.3, 25.5, 31.3, 51.6, 60.0, 33.7, 37.9, 2.7] },
  { name: "WildClaw", cat: "General Agent", vals: [23.9, 10.2, 9.2, 8.9, 17.0, 20.0, 8.9, 14.3, 4.5] },
  { name: "QwenClaw", cat: "General Agent", vals: [42.9, 19.3, 18.2, 14.5, 37.1, 36.4, 16.8, 16.7, 4.5] },
]

const CATEGORIES = [...new Set(ROWS.map((r) => r.cat))]

type GainRow = { name: string; cat: string; sft: number; final: number }

const GAIN_ROWS: GainRow[] = [
  { name: "GPQA-Diamond", cat: "Knowledge", sft: 48.59, final: 70.2 },
  { name: "SuperGPQA", cat: "Knowledge", sft: 34.43, final: 40.77 },
  { name: "LiveCodeBench v6", cat: "Code", sft: 58.67, final: 69.14 },
  { name: "LCB-Pro 25Q2 (Easy)", cat: "Code", sft: 45.36, final: 68.04 },
  { name: "LCB-Pro 25Q2 (Medium)", cat: "Code", sft: 5.24, final: 17.54 },
  { name: "OJBench", cat: "Code", sft: 22.2, final: 32.54 },
  { name: "SciCode (wbg)", cat: "Code", sft: 20.37, final: 26.3 },
  { name: "IFBench", cat: "Instruction Following", sft: 50.67, final: 66.33 },
  { name: "IFEval", cat: "Instruction Following", sft: 81.7, final: 86.69 },
  { name: "AIME 2025", cat: "Math Reasoning", sft: 66.46, final: 86.46 },
  { name: "AIME 2026", cat: "Math Reasoning", sft: 74.17, final: 86.46 },
  { name: "HMMT Feb 2026", cat: "Math Reasoning", sft: 52.08, final: 63.83 },
  { name: "AA-LCR", cat: "Long Context", sft: 48.0, final: 59.0 },
  { name: "NoLiMa", cat: "Long Context", sft: 59.15, final: 68.06 },
  { name: "LongBenchPro", cat: "Long Context", sft: 38.03, final: 44.82 },
  { name: "LongBench v2", cat: "Long Context", sft: 42.15, final: 43.74 },
  { name: "SWE-bench Verified", cat: "Code Agent", sft: 29.0, final: 46.4 },
  { name: "τ³-Bench Banking", cat: "Tool Use", sft: 12.58, final: 20.8 },
  { name: "τ²-Bench Telecom", cat: "Tool Use", sft: 92.98, final: 97.08 },
  { name: "BFCL v4", cat: "Tool Use", sft: 55.4, final: 66.59 },
  { name: "BrowseComp-ZH", cat: "Search Agent", sft: 36.56, final: 43.48 },
  { name: "BrowseComp Top100", cat: "Search Agent", sft: 38.33, final: 39.67 },
  { name: "GAIA Text-103", cat: "Search Agent", sft: 79.29, final: 88.67 },
  { name: "GDPval v2 (AA)", cat: "General Agent", sft: 15.8, final: 19.55 },
  { name: "Claw-Gym", cat: "General Agent", sft: 54.38, final: 59.23 },
  { name: "WildClaw", cat: "General Agent", sft: 14.57, final: 23.88 },
  { name: "QwenClaw", cat: "General Agent", sft: 39.98, final: 42.92 },
]

const GOOD = "oklch(0.55 0.16 155)"
const AMBER = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"
const SUBJECT = "oklch(0.60 0.15 255)"

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        active
          ? "border-foreground/30 bg-muted/50 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function BenchmarkExplorer({ defaultTab = "baselines" }: { defaultTab?: "baselines" | "gain" }) {
  const [tab, setTab] = useState<"baselines" | "gain">(defaultTab)
  // Separate category filters per tab -- the two tabs use different category
  // label sets (e.g. "Code Reasoning" vs. "Code"), so a single shared filter
  // would either show nothing or silently ignore the filter after a tab
  // switch. Keeping them independent means each tab's filter always means
  // exactly what its own chips say.
  const [cat, setCat] = useState<string>("All")
  const [gainCat, setGainCat] = useState<string>("All")
  const [classFilter, setClassFilter] = useState<"all" | "2B">("all")

  const filteredRows = useMemo(
    () => ROWS.filter((r) => cat === "All" || r.cat === cat),
    [cat],
  )

  const colIdx = useMemo(
    () => MODELS.map((_, i) => i).filter((i) => classFilter === "all" || i === 0 || CLASS[i] === "2B"),
    [classFilter],
  )

  const subjectAvg = useMemo(() => {
    if (filteredRows.length === 0) return 0
    return filteredRows.reduce((s, r) => s + r.vals[0], 0) / filteredRows.length
  }, [filteredRows])

  const winCount = useMemo(
    () => filteredRows.filter((r) => r.vals[0] >= Math.max(...colIdx.map((i) => r.vals[i]))).length,
    [filteredRows, colIdx],
  )

  const gainFiltered = useMemo(
    () => GAIN_ROWS.filter((r) => gainCat === "All" || r.cat === gainCat),
    [gainCat],
  )
  const gainCats = [...new Set(GAIN_ROWS.map((r) => r.cat))]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the README&rsquo;s own evaluation table, 34 benchmarks / 9 models</span>
        <div className="flex gap-1.5">
          <Chip active={tab === "baselines"} onClick={() => setTab("baselines")}>
            vs. baselines
          </Chip>
          <Chip active={tab === "gain"} onClick={() => setTab("gain")}>
            what RL+OPD bought
          </Chip>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {tab === "baselines" ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={cat === "All"} onClick={() => setCat("All")}>
                All ({ROWS.length})
              </Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                  {c}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">
                MiniCPM5-2B average, this filter:{" "}
                <span style={{ color: SUBJECT }} className="font-bold">
                  {subjectAvg.toFixed(1)}
                </span>{" "}
                · best of {colIdx.length} on {winCount}/{filteredRows.length} rows
              </span>
              <div className="flex gap-1.5">
                <Chip active={classFilter === "all"} onClick={() => setClassFilter("all")}>
                  vs. all 9
                </Chip>
                <Chip active={classFilter === "2B"} onClick={() => setClassFilter("2B")}>
                  vs. 2B-class only (4)
                </Chip>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse font-mono text-[10.5px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 text-left font-normal">benchmark</th>
                    <th className="px-1.5 py-1 text-right font-normal" style={{ color: SUBJECT }}>
                      MiniCPM5-2B
                    </th>
                    <th className="px-1.5 py-1 text-right font-normal">best of rest</th>
                    <th className="px-1.5 py-1 text-right font-normal">margin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const rest = colIdx.filter((i) => i !== 0).map((i) => r.vals[i])
                    const bestRest = Math.max(...rest)
                    const bestRestIdx = colIdx.filter((i) => i !== 0)[rest.indexOf(bestRest)]
                    const margin = r.vals[0] - bestRest
                    return (
                      <tr key={r.name} className="border-t">
                        <td className="py-1 text-foreground">{r.name}</td>
                        <td className="px-1.5 py-1 text-right tabular-nums font-bold" style={{ color: SUBJECT }}>
                          {r.vals[0].toFixed(1)}
                        </td>
                        <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">
                          {bestRest.toFixed(1)}{" "}
                          <span className="opacity-60">({MODELS[bestRestIdx]})</span>
                        </td>
                        <td
                          className="px-1.5 py-1 text-right tabular-nums"
                          style={{ color: margin >= 0 ? GOOD : BAD }}
                        >
                          {margin >= 0 ? "+" : ""}
                          {margin.toFixed(1)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Every row here is transcribed from the card&rsquo;s own table, not re-scored. Filtered
              to <span className="text-foreground">All</span> categories against{" "}
              <span className="text-foreground">all 9</span> models, the live average above comes
              out to <span style={{ color: SUBJECT }}>53.9</span> — reproducing the card&rsquo;s
              headline number from the per-benchmark rows themselves, not just quoting it. Switch to{" "}
              <span className="text-foreground">2B-class only</span> and MiniCPM5-2B&rsquo;s lead
              widens on almost every row, which is expected — the 4B-class column includes models
              nearly double its parameter count.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={gainCat === "All"} onClick={() => setGainCat("All")}>
                All ({GAIN_ROWS.length})
              </Chip>
              {gainCats.map((c) => (
                <Chip key={c} active={gainCat === c} onClick={() => setGainCat(c)}>
                  {c}
                </Chip>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {gainFiltered.map((r) => {
                const max = Math.max(r.sft, r.final, 100)
                const sftW = (r.sft / max) * 100
                const finalW = (r.final / max) * 100
                const gain = r.final - r.sft
                return (
                  <div key={r.name}>
                    <div className="mb-0.5 flex items-baseline justify-between font-mono text-[10.5px]">
                      <span className="text-foreground">{r.name}</span>
                      <span style={{ color: gain > 15 ? GOOD : gain > 5 ? AMBER : "currentColor" }}>
                        +{gain.toFixed(1)}
                      </span>
                    </div>
                    <div className="relative h-4 rounded bg-muted/20">
                      <div className="absolute inset-y-0 left-0 rounded bg-muted-foreground/30" style={{ width: `${sftW}%` }} />
                      <div
                        className="absolute inset-y-0 rounded-r"
                        style={{ left: `${sftW}%`, width: `${Math.max(finalW - sftW, 0)}%`, background: GOOD, opacity: 0.85 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              <span className="text-muted-foreground">Grey</span> is the SFT-only checkpoint (before
              RL); <span style={{ color: GOOD }}>green</span> is what RL + OPD added on top. The
              README states this averages{" "}
              <span className="text-foreground">+10.96 points</span> across reasoning/general
              benchmarks and <span className="text-foreground">+6.96 points</span> across agentic
              ones — this chart is that same comparison, read off the card&rsquo;s own figure
              row by row rather than taken only as an average. Two rows (HLE, Terminal-Bench v2.1)
              are left out here because their SFT-baseline bars were too thin on the source chart
              to transcribe a reliable number.
            </p>
          </>
        )}
      </div>
    </figure>
  )
}
