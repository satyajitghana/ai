"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The paper's most interesting result, which is not its headline.
//
// Two RL runs differ only in the reward. Outcome-only uses the programmatic
// Harbor reward r_V in [0, 1], averaged over up to six named metrics. The rubric
// run adds an LLM judge scoring the trace in [-5, 5] against the source Skill's
// own must-do / must-avoid / best-practice bullets, weighted lambda = 0.2:
//
//     r = r_V + 0.2 * s / 5
//
// Every number below is from Tables 1 and 2 of the paper. The direction is the
// finding: the rubric channel — the one carrying the human-written methodology,
// the thing "collective" is supposed to mean — loses on all three benchmark
// metrics and wins the preference test by a mile.

type Metric = "tb" | "pass" | "score" | "pref"

const METRICS: { k: Metric; label: string; unit: string; note: string }[] = [
  { k: "tb", label: "Terminal-Bench 2.1", unit: "pass@1 %", note: "public, 5 trials per task, no task above 13-gram Jaccard 0.8 with the training corpus" },
  { k: "pass", label: "S2EBench pass", unit: "pass@1 %", note: "79 hand-verified held-out tasks; all tests must pass" },
  { k: "score", label: "S2EBench score", unit: "mean", note: "the same 79 tasks with partial credit across up to six metrics" },
  { k: "pref", label: "Skill alignment", unit: "% preferred", note: "200 paired trajectories; a judge holding the source SKILL.md picks which run follows it more closely" },
]

const RUNS = [
  { k: "base", label: "base Qwen3.8-27B", tb: 49.4, pass: 33.4, score: 56.6, pref: null as number | null, color: "oklch(0.62 0.03 250)" },
  { k: "outcome", label: "outcome-only RL", tb: 54.1, pass: 37.7, score: 75.1, pref: 54.5, color: "oklch(0.58 0.15 155)" },
  { k: "rubric", label: "outcome + rubric RL", tb: 50.1, pass: 34.7, score: 63.6, pref: 73.0, color: "oklch(0.68 0.13 85)" },
]

export function RewardTension() {
  const [m, setM] = useState<Metric>("tb")
  const metric = METRICS.find((x) => x.k === m) ?? METRICS[0]
  const vals = RUNS.map((r) => r[m]).filter((v): v is number => v != null)
  const max = Math.max(...vals)
  const winner = RUNS.filter((r) => r[m] != null).reduce((a, b) => ((b[m] as number) > (a[m] as number) ? b : a))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          same data, same 300 steps, one term of difference in the reward
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">paper, Tables 1 &amp; 2</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setM(x.k)}
              aria-pressed={x.k === m}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors",
                x.k === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/35",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {RUNS.map((r) => {
            const v = r[m]
            return (
              <div key={r.k} className="flex items-center gap-2">
                <span className="w-36 shrink-0 text-right font-mono text-[10px] text-foreground">{r.label}</span>
                <div className="h-5 flex-1 rounded-sm bg-muted/40">
                  {v != null && (
                    <div
                      className="h-5 rounded-sm transition-all"
                      style={{ width: `${(v / max) * 100}%`, background: r.color, opacity: 0.9 }}
                    />
                  )}
                </div>
                <span
                  className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums"
                  style={{ color: v == null ? undefined : r.color }}
                >
                  {v == null ? "—" : v.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: winner.color }}>
            {metric.label} &middot; {metric.unit} &middot; best: {winner.label}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{metric.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Click through all four. The outcome-only run wins every benchmark; the rubric run wins the only
          measurement that asks whether the agent worked the way the Skill says to. The paper does not hide
          this and does not spin it either: the judge term stays flat from the first update to the last, the
          programmatic reward sits below the outcome-only run for most of training, and the authors write that
          &ldquo;the methodology the Skills write down may simply not be the distribution that maximizes
          benchmark pass rates.&rdquo; That sentence is the whole result.
        </p>
      </div>
    </figure>
  )
}
