"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The four numbers in the Atria Dawn launch post, and what each one counts.
//
// Sources, per row:
// - Atria: the benchmark table on atria-asi.ai (release 20261015) and the
//   GitHub README, which match each other; the Preview column is also in the
//   paper's Table 1 (arXiv 2609.15818).
// - Metric definitions: AutomationBench (arXiv 2604.18934), WideSearch
//   (arXiv 2508.07999), Workspace-Bench 1.0 (arXiv 2605.03596), and HumanRank
//   from Frontis-MA1 (arXiv 2607.28568), which the Atria site cites.
// - "Same benchmark, other operators": numbers already on this site, each
//   from the publisher named in `by`.
// Bars are plain percentages of a 0-100 axis; only + - * / reach the DOM.

type Bar = { who: string; v: number; by: string; atria?: boolean }

type Bench = {
  id: string
  name: string
  posted: string
  site: number
  preview: number
  metric: string
  hundred: string
  caveat: string
  bars: Bar[]
}

const BENCHES: Bench[] = [
  {
    id: "auto",
    name: "AutomationBench",
    posted: "54.7%",
    site: 54.7,
    preview: 53.8,
    metric: "Share of tasks whose end state is fully correct: programmatic assertions on the simulated CRM, inbox, calendar and other apps after the agent stops. No partial credit.",
    hundred: "Every task's data lands in the right systems, with the business rules followed.",
    caveat: "The benchmark's own paper put the best frontier model below 10% at release. The same model scores 27.3 in Qwen's table and 49.7 in Atria's.",
    bars: [
      { who: "Atria Dawn", v: 54.7, by: "Atria", atria: true },
      { who: "GLM-5.3", v: 52.5, by: "Atria, Dawn table" },
      { who: "GLM-5.3", v: 49.2, by: "Atria, Preview table" },
      { who: "GLM-5.3", v: 48.2, by: "Z.ai launch" },
      { who: "GLM-5.3", v: 62.2, by: "Artificial Analysis, via Mistral" },
      { who: "Qwen3.8-Max", v: 49.7, by: "Atria" },
      { who: "Qwen3.8-Max", v: 27.3, by: "Qwen, Pass@1" },
      { who: "Ultramarine 1 Flash", v: 50.2, by: "Paper Instruments" },
      { who: "LFM2.5-24B-A2B", v: 27.69, by: "Liquid AI" },
    ],
  },
  {
    id: "wide",
    name: "WideSearch",
    posted: "84.8%",
    site: 84.6,
    preview: 81.9,
    metric: "Not stated by Atria. WideSearch publishes three: table-level success rate, row-level F1 and item-level F1, over 200 questions whose answer is a large table of facts.",
    hundred: "Success rate: the whole table matches. Item F1: every cell found and nothing extra.",
    caveat: "The launch post says 84.8; the site and README say 84.6. The best success rate in the WideSearch paper was 5%, so a score in the 80s is almost certainly an F1, most likely item-level.",
    bars: [
      { who: "Atria Dawn", v: 84.6, by: "Atria", atria: true },
      { who: "Claude Opus 5", v: 84.0, by: "Atria" },
      { who: "GPT-5.6 Sol", v: 83.3, by: "Atria" },
      { who: "Qwen3.8-Max", v: 81.9, by: "Atria, and Qwen's own table" },
      { who: "Kimi K3", v: 79.6, by: "Atria" },
    ],
  },
  {
    id: "work",
    name: "Workspace-Bench",
    posted: "66.1%",
    site: 66.1,
    preview: 65.0,
    metric: "Rubric score over 388 tasks in realistic workspaces (20,476 files, 7,399 rubrics), graded by an LLM judge; Atria used Doubao Seed 2.0 Lite as the judge.",
    hundred: "Every rubric item satisfied on every task. The benchmark's paper puts humans at 80.7.",
    caveat: "Between the Preview table and the Dawn table, Qwen3.8-Max moved from 63.9 to 68.0 and GLM-5.3 from 63.9 to 67.4. Dawn's 66.1 is third of the eight columns.",
    bars: [
      { who: "Qwen3.8-Max", v: 68.0, by: "Atria, Dawn table" },
      { who: "GLM-5.3", v: 67.4, by: "Atria, Dawn table" },
      { who: "Atria Dawn", v: 66.1, by: "Atria", atria: true },
      { who: "Claude Opus 5", v: 65.8, by: "Atria" },
      { who: "Atria Dawn Preview", v: 65.0, by: "Atria" },
      { who: "Human", v: 80.7, by: "Workspace-Bench paper" },
    ],
  },
  {
    id: "mle",
    name: "MLE-bench Lite",
    posted: "88.2%",
    site: 88.2,
    preview: 86.2,
    metric: "HumanRank: for each of the 22 Kaggle tasks, the fraction of the human leaderboard the agent's submission beats, averaged over tasks and runs. Not a medal rate.",
    hundred: "Beats every human entrant on every task. A medal needs a place near the top of a leaderboard, so the same runs score far higher on HumanRank than on medal rate.",
    caveat: "Atria's comparators match Frontis-MA1's Table 1: GPT-5.6 Sol 0.8891 HumanRank is a 72.73% medal average there, Kimi K3 0.8574 also 72.73%.",
    bars: [
      { who: "GPT-5.6 Sol, HumanRank", v: 88.9, by: "Atria and Frontis" },
      { who: "Atria Dawn, HumanRank", v: 88.2, by: "Atria", atria: true },
      { who: "Kimi K3, HumanRank", v: 85.8, by: "Atria and Frontis" },
      { who: "GLM-5.2, HumanRank", v: 79.48, by: "Frontis, Claude Code" },
      { who: "GPT-5.6 Sol, medals", v: 72.73, by: "Frontis" },
      { who: "Kimi K3, medals", v: 72.73, by: "Frontis" },
      { who: "GLM-5.2, medals", v: 59.09, by: "Frontis, Claude Code" },
    ],
  },
]

const ATRIA = "oklch(0.58 0.17 255)"
const OTHER = "oklch(0.7 0.02 255)"

export function MetricExplorer() {
  const [id, setId] = useState("mle")
  const b = BENCHES.find((x) => x.id === id) ?? BENCHES[0]
  const delta = Math.round((b.site - b.preview) * 10) / 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what each launch number counts</span>
        <span className="font-mono text-[10px] text-muted-foreground">reported scores; definitions from each benchmark&rsquo;s paper</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {BENCHES.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={x.id === id}
              onClick={() => setId(x.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                x.id === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.name} {x.posted}
            </button>
          ))}
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">launch post</div>
            <div className="text-lg text-foreground">{b.posted}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">site and README</div>
            <div className="text-lg text-foreground">{b.site}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">Preview, same table</div>
            <div className="text-lg text-foreground">
              {b.preview}{" "}
              <span className="text-[11px] text-muted-foreground">
                ({delta > 0 ? "+" : ""}
                {delta})
              </span>
            </div>
          </div>
        </div>

        <dl className="space-y-2 text-[13px] leading-5">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">what is counted</dt>
            <dd>{b.metric}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">what 100 means</dt>
            <dd>{b.hundred}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">read it with</dt>
            <dd>{b.caveat}</dd>
          </div>
        </dl>

        <div className="space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">same benchmark, by who ran it</div>
          {b.bars.map((r, i) => (
            <div key={`${r.who}-${i}`} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-2 font-mono text-[10px] sm:grid-cols-[minmax(0,14rem)_1fr_3rem]">
              <span className="truncate text-muted-foreground" title={`${r.who} (${r.by})`}>
                <span className={r.atria ? "text-foreground" : undefined}>{r.who}</span>
                <span className="hidden sm:inline"> · {r.by}</span>
              </span>
              <span className="h-3 overflow-hidden rounded-sm bg-muted/40">
                <span className="block h-full rounded-sm" style={{ width: `${r.v}%`, background: r.atria ? ATRIA : OTHER }} />
              </span>
              <span className="text-right text-foreground">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
