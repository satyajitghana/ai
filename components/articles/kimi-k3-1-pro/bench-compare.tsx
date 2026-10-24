"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every row of the benchmark table on Moonshot's K3.1 Pro launch blog
// (kimi.ai/blog/kimi-k3-1-pro, read 2026-10-24), transcribed by script from the
// JSON the page ships, blanks kept blank. Kimi K3.1 Pro is column 0.
//
// What the widget does with it, so a reader can check me:
//   - A row counts only if at least one SELECTED comparator has a score on it.
//   - "Ahead" means K3.1 Pro is at least as good as every selected comparator
//     that has a score (lower is better on the two hallucination rows).
//   - Margin is K3.1 Pro minus the best selected comparator, in the row's own
//     unit (points, or Elo on the three Elo rows), sign flipped on lower-is-better.
//   - ZeroBench avg@5 / pass@5 uses avg@5. GLM-5.3's HLE scores are text-only.
//   - "In the launch chart" marks the 14 panels of the blog's headline figure.

const MODELS = ["Kimi K3.1 Pro", "Claude Fable 5.1", "GPT-6 Astra", "Claude Opus 5.5", "DeepSeek-V4.1-Flash-1017", "GLM-5.3"]
const SHORT = ["K3.1 Pro", "Fable 5.1", "GPT-6 Astra", "Opus 5.5", "DS-V4.1-Flash", "GLM-5.3"]
const PROPRIETARY = [1, 2, 3]

type Cat = "coding" | "agentic" | "knowledge" | "cyber"
type Row = { name: string; cat: Cat; s: (number | null)[]; lower?: boolean; internal?: boolean; chart?: boolean }

const ROWS: Row[] = [
  { name: "Terminal-Bench 4.0", cat: "coding", s: [65.7, 57.9, 58.2, 66.4, 42.3, 41.8], chart: true },
  { name: "Terminal-Bench Science 0.1", cat: "coding", s: [38.1, 40.0, 68.1, 63.3, 15.7, 8.1], chart: true },
  { name: "SWE Marathon v1.1", cat: "coding", s: [51.7, 45.6, 42.5, 46.3, 40.0, 42.5], chart: true },
  { name: "BenchCAD w/o tools", cat: "coding", s: [72.8, 60.6, null, 73.0, 41.2, null] },
  { name: "BenchCAD w/ tools", cat: "coding", s: [92.7, 92.6, 95.9, 96.2, 81.6, null], chart: true },
  { name: "Program Bench", cat: "coding", s: [31.5, 53.5, 50.0, 65.0, 29.1, 19.0] },
  { name: "DeepSWE v1.1", cat: "coding", s: [75.5, 67.4, 74.1, 74.2, 77.0, 66.9] },
  { name: "PostTrain Bench v1.2", cat: "coding", s: [36.5, 44.6, 41.9, 43.8, 30.5, 34.5] },
  { name: "Kimi Code Bench 2.0", cat: "coding", s: [77.1, null, null, null, 76.1, 61.7], internal: true },
  { name: "Kimi Code Bench 3.0 Long-horizon", cat: "coding", s: [61.2, 58.8, 66.5, 58.5, 51.5, 45.5], internal: true, chart: true },
  { name: "HLE-Full w/ tools", cat: "agentic", s: [70.0, 65.6, 57.2, 67.7, 58.8, 62.5], chart: true },
  { name: "BrowseComp", cat: "agentic", s: [92.1, null, 91.5, 90.8, null, null] },
  { name: "BioMysteryBench", cat: "agentic", s: [80.6, 81.6, 78.9, 81.9, 80.0, 79.6] },
  { name: "CharXiv (RQ) w/ python", cat: "agentic", s: [93.4, 92.7, 92.8, 93.8, 85.6, null] },
  { name: "MMMU-Pro w/ python", cat: "agentic", s: [90.0, 88.4, 87.8, 89.8, 82.5, null] },
  { name: "GDP.pdf w/ python", cat: "agentic", s: [85.7, 83.8, 85.5, 83.9, 73.0, null] },
  { name: "ChartoGraphy w/ python", cat: "agentic", s: [90.2, 88.4, 91.0, 89.0, 83.0, null], chart: true },
  { name: "BabyVision w/ python", cat: "agentic", s: [95.4, 95.1, 96.6, 97.7, 92.5, null] },
  { name: "ZeroBench_main w/ python (pass@5)", cat: "agentic", s: [63.0, 59.0, 58.0, 61.0, 51.0, null], chart: true },
  { name: "Agents' Last Exam (ALL)", cat: "agentic", s: [43.2, null, 32.8, 42.6, 37.7, 26.2], chart: true },
  { name: "Agents' Last Exam (CLI)", cat: "agentic", s: [44.2, null, 38.8, 40.7, 36.0, 29.4] },
  { name: "Automation Bench-AA", cat: "agentic", s: [73.3, 59.4, 68.5, 69.5, 66.6, 62.2] },
  { name: "GDPval-AA v2.1 (Elo)", cat: "agentic", s: [1846, 1754, 1573, 1866, 1746, 1650], chart: true },
  { name: "AA-Briefcase v1.1 (Elo)", cat: "agentic", s: [1678, 1672, 1569, 1803, 1570, 1507] },
  { name: "APEX-Agents", cat: "agentic", s: [67.2, 68.6, 64.7, 73.5, 63.4, 56.6] },
  { name: "OfficeQA Pro v2", cat: "agentic", s: [64.4, 54.5, 54.4, 62.2, 40.4, 31.1], chart: true },
  { name: "OfficeQA Pro", cat: "agentic", s: [67.4, 68.6, 66.2, null, 62.4, 58.6] },
  { name: "Frontier Finance", cat: "agentic", s: [58.6, 60.8, 45.0, 56.7, 54.5, 57.5], chart: true },
  { name: "Harvey Legal Agent", cat: "agentic", s: [23.7, 19.1, null, null, 21.0, null] },
  { name: "HANDBOOK.md", cat: "agentic", s: [44.6, 38.8, null, 41.5, 28.9, 20.8] },
  { name: "OSWorld V2.1", cat: "agentic", s: [79.6, 80.7, 75.8, 81.8, 69.3, null], chart: true },
  { name: "Business Operation", cat: "agentic", s: [37.8, 30.7, 32.3, null, 8.9, 18.6], internal: true },
  { name: "DECK-Arena (Elo)", cat: "agentic", s: [1456, null, 1423, 1253, 1231, 1119], internal: true },
  { name: "Design Bench (Elo)", cat: "agentic", s: [957, null, 1076, 927, 863, 718], internal: true },
  { name: "Kimi Hallu Bench Hard w/ tools (%)", cat: "agentic", s: [8.3, 23.3, 5.5, 15.0, 23.3, 22.6], lower: true, internal: true },
  { name: "GDP.pdf", cat: "knowledge", s: [34.6, 27.6, 34.2, 30.6, 17.2, 11.2], chart: true },
  { name: "HLE-Full", cat: "knowledge", s: [51.1, 57.6, 53.6, 59.8, 42.6, 43.0] },
  { name: "HLE-Diamond", cat: "knowledge", s: [39.4, 55.1, 65.8, 60.9, 21.6, 25.1] },
  { name: "GPQA-Diamond", cat: "knowledge", s: [94.2, 93.7, 96.1, 93.9, 92.2, 91.7] },
  { name: "CharXiv (RQ)", cat: "knowledge", s: [89.0, 88.8, 90.0, 92.1, 77.0, null] },
  { name: "MMMU-Pro", cat: "knowledge", s: [84.1, 86.3, 86.9, 87.7, 80.6, null] },
  { name: "ZeroBench_main (avg@5)", cat: "knowledge", s: [29.8, 23.0, 43.2, 35.0, 11.8, null] },
  { name: "PerceptionBench", cat: "knowledge", s: [68.3, 63.0, 77.6, 72.1, 47.7, null] },
  { name: "Kimi Hallu Bench w/o tools (%)", cat: "knowledge", s: [5.4, 11.4, 4.2, 6.8, 13.1, 14.8], lower: true, internal: true },
  { name: "ExploitBench", cat: "cyber", s: [74.7, 83.0, 100, 91.0, null, 54.4] },
  { name: "ExploitGym", cat: "cyber", s: [20.7, 30.4, 42.4, 34.5, null, 15.0] },
  { name: "xdev-bench-hard", cat: "cyber", s: [81.0, null, null, null, 85.7, 57.1], internal: true },
]

const CATS: { id: "all" | Cat; label: string }[] = [
  { id: "all", label: "all" },
  { id: "coding", label: "coding" },
  { id: "agentic", label: "agentic" },
  { id: "knowledge", label: "knowledge + vision" },
  { id: "cyber", label: "cyber" },
]

const KIMI = "oklch(0.6 0.17 255)"
const OTHER = "oklch(0.66 0.03 250)"

type Scored = { row: Row; best: number; margin: number; ahead: boolean; rank: number; n: number }

function score(row: Row, on: boolean[]): Scored | null {
  const k = row.s[0]
  if (k === null) return null
  const vals = row.s
    .map((v, i) => ({ v, i }))
    .filter((x) => x.i > 0 && on[x.i] && x.v !== null) as { v: number; i: number }[]
  if (vals.length === 0) return null
  const better = (a: number, b: number) => (row.lower ? a < b : a > b)
  let best = vals[0].v
  for (const x of vals) if (better(x.v, best)) best = x.v
  const margin = row.lower ? best - k : k - best
  const rank = 1 + vals.filter((x) => better(x.v, k)).length
  return { row, best, margin, ahead: margin >= 0, rank, n: vals.length + 1 }
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`

export function BenchCompare() {
  const [on, setOn] = useState<boolean[]>([true, true, true, true, false, false])
  const [cat, setCat] = useState<"all" | Cat>("all")
  const [noInternal, setNoInternal] = useState(false)
  const [chartOnly, setChartOnly] = useState(false)

  const toggle = (i: number) => setOn((o) => o.map((v, j) => (j === i ? !v : v)))

  const rows = ROWS.filter(
    (r) => (cat === "all" || r.cat === cat) && (!noInternal || !r.internal) && (!chartOnly || r.chart),
  )
  const scored = rows.map((r) => score(r, on)).filter((x): x is Scored => x !== null)
  const ahead = scored.filter((x) => x.ahead).length
  const far = scored.filter((x) => !x.ahead && !x.row.name.includes("Elo") && x.margin < -5).length

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-dashed border-foreground/15 text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="space-y-2 border-b px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground">
          k3.1 pro launch table · 47 rows · compare against
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((m, i) =>
            i === 0 ? null : (
              <button key={m} type="button" aria-pressed={on[i]} onClick={() => toggle(i)} className={chip(on[i])}>
                {SHORT[i]}
                {PROPRIETARY.includes(i) ? "" : " · open"}
              </button>
            ),
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={chip(cat === c.id)}>
              {c.label}
            </button>
          ))}
          <button type="button" aria-pressed={noInternal} onClick={() => setNoInternal((v) => !v)} className={chip(noInternal)}>
            drop moonshot-internal
          </button>
          <button type="button" aria-pressed={chartOnly} onClick={() => setChartOnly((v) => !v)} className={chip(chartOnly)}>
            launch-chart panels only
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">ahead or tied</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: KIMI }}>
              {ahead} / {scored.length}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">behind</div>
            <div className="font-mono text-lg tabular-nums">{scored.length - ahead}</div>
          </div>
          <div className="col-span-2 rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-1">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">behind by over 5 pts</div>
            <div className="font-mono text-lg tabular-nums">{far}</div>
          </div>
        </div>

        {scored.length === 0 ? (
          <div className="py-6 text-center font-mono text-xs text-muted-foreground">
            no row has a score from the selected comparators
          </div>
        ) : (
          <div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
            {scored.map(({ row, margin, ahead: a, rank, n }) => {
              const present = row.s.map((v, i) => (i === 0 || on[i] ? v : null))
              const nums = present.filter((v): v is number => v !== null)
              const hi = Math.max(...nums)
              const lo = row.name.includes("Elo") ? Math.min(...nums) * 0.9 : 0
              const w = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 100)
              return (
                <div key={row.name} className="rounded-lg border bg-background/40 px-3 py-2">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <div className="font-mono text-[11px] text-foreground">
                      {row.name}
                      {row.internal ? <span className="text-muted-foreground"> · internal</span> : null}
                      {row.lower ? <span className="text-muted-foreground"> · lower is better</span> : null}
                    </div>
                    <div className="font-mono text-[11px] tabular-nums" style={{ color: a ? KIMI : undefined }}>
                      #{rank} of {n} · {signed(margin)}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {present.map((v, i) =>
                      v === null ? null : (
                        <div key={i} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2">
                          <span className={cn("truncate font-mono text-[10px]", i === 0 ? "text-foreground" : "text-muted-foreground")}>
                            {SHORT[i]}
                          </span>
                          <div className="h-2 rounded-sm bg-muted/40">
                            <div
                              className="h-2 rounded-sm"
                              style={{ width: `${Math.max(1, w(v)).toFixed(1)}%`, background: i === 0 ? KIMI : OTHER }}
                            />
                          </div>
                          <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">{fmt(v)}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          With the three proprietary models selected and every row in, K3.1 Pro is ahead or tied on 16 of 45 rows. Agentic
          rows carry it; knowledge, vision and cyber rows mostly do not. The blanks are the blog&rsquo;s own. Every Kimi
          number was run by Moonshot, mostly in the Claude Code harness; most comparator numbers were copied from the
          other labs&rsquo; reports or public leaderboards, run in their own harnesses. Toggle the open models in to see
          where DeepSeek-V4.1-Flash-1017 takes the top spot.
        </p>
      </div>
    </figure>
  )
}
