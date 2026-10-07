"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Mach-2 Additive Medium against its own BF16 base, with the noise drawn in.
//
// Scores and task counts are the model card's table (SyzygyResearch/
// Mach-2-Additive-Medium README @ b0234bb). The "items" column is score x
// tasks: for HLE, GPQA, AIME, Terminal-Bench, DeepSWE and tau3-Banking it
// lands on a whole number (731 vs 860 of 2,158; 896 vs 913 of 990; 231 vs 230
// of 240; 70 vs 73 of 89; 55 vs 56 of 113; 207 vs 213 of 459), which is how I
// know the denominators. AutomationBench and NL2Repo carry partial credit.
//
// The interval is a plain two-sample binomial 95% interval on the difference,
// treating the runs as independent. Both models ran the same tasks, so a
// paired test would be tighter; the card does not publish per-task results,
// so it cannot be run. GPQA and AIME repeat each question 5 and 8 times,
// which makes their true intervals wider than drawn. Read the bands as a
// rough noise floor, not a significance test.

type Row = { name: string; n: number; mach: number; bf16: number; long: boolean; partial?: boolean }

const ROWS: Row[] = [
  { name: "Humanity's Last Exam", n: 2158, mach: 33.87, bf16: 39.85, long: false },
  { name: "GPQA Diamond", n: 990, mach: 90.51, bf16: 92.22, long: false },
  { name: "AIME 2026", n: 240, mach: 96.25, bf16: 95.83, long: false },
  { name: "Terminal-Bench 2.1", n: 89, mach: 78.65, bf16: 82.02, long: true },
  { name: "AutomationBench", n: 600, mach: 71.67, bf16: 70.29, long: true, partial: true },
  { name: "NL2Repo", n: 98, mach: 56.12, bf16: 60.06, long: true, partial: true },
  { name: "DeepSWE v1.1", n: 113, mach: 48.67, bf16: 49.56, long: true },
  { name: "τ³-Banking", n: 459, mach: 45.1, bf16: 46.41, long: true },
]

const SPAN = 16 // points either side of zero

function ci(r: Row) {
  const a = r.mach / 100
  const b = r.bf16 / 100
  const se = Math.sqrt((a * (1 - a)) / r.n + (b * (1 - b)) / r.n) * 100
  return 1.96 * se
}

const x = (d: number) => 50 + (Math.max(-SPAN, Math.min(SPAN, d)) / SPAN) * 50

export function NoiseFloor() {
  const [view, setView] = useState<"diff" | "items">("diff")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Mach-2 minus BF16 · same harness · card&apos;s table</span>
        <div className="flex gap-1">
          {(
            [
              ["diff", "difference and noise"],
              ["items", "as task counts"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                view === id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {ROWS.map((r) => {
          const d = r.mach - r.bf16
          const w = ci(r)
          const outside = Math.abs(d) > w
          return (
            <div key={r.name} className="grid grid-cols-[9.5rem_1fr] items-center gap-3 font-mono text-xs sm:grid-cols-[11rem_1fr]">
              <div className="truncate text-foreground" title={r.name}>
                {r.name}
                <span className="ml-1 text-[10px] text-muted-foreground">{r.long ? "agentic" : "exam"}</span>
              </div>
              {view === "diff" ? (
                <div className="relative h-6">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <div
                    className="absolute top-1.5 h-3 rounded-sm bg-muted-foreground/20"
                    style={{ left: `${x(d - w)}%`, width: `${x(d + w) - x(d - w)}%` }}
                  />
                  <div
                    className={cn("absolute top-1 h-4 w-1.5 -translate-x-1/2 rounded-sm", outside ? "bg-orange-600" : "bg-sky-600")}
                    style={{ left: `${x(d)}%` }}
                  />
                  <span
                    className="absolute top-0.5 text-[10px] text-muted-foreground"
                    style={d < 0 ? { left: `${x(d + w) + 1}%` } : { right: `${100 - x(d - w) + 1}%` }}
                  >
                    {d > 0 ? "+" : ""}
                    {d.toFixed(2)} ± {w.toFixed(1)}
                  </span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <span className="text-foreground">{((r.mach * r.n) / 100).toFixed(r.partial ? 1 : 0)}</span> vs{" "}
                  <span className="text-foreground">{((r.bf16 * r.n) / 100).toFixed(r.partial ? 1 : 0)}</span> of{" "}
                  {r.n.toLocaleString("en-US")}
                </div>
              )}
            </div>
          )
        })}
        <div className="grid grid-cols-[9.5rem_1fr] gap-3 font-mono text-[10px] text-muted-foreground sm:grid-cols-[11rem_1fr]">
          <span />
          {view === "diff" ? (
            <div className="flex justify-between">
              <span>−{SPAN} pts</span>
              <span>0</span>
              <span>+{SPAN}</span>
            </div>
          ) : (
            <span>score × tasks; fractional where the benchmark gives partial credit</span>
          )}
        </div>
        <p className="pt-1 text-sm leading-6 text-muted-foreground">
          {view === "diff"
            ? "Grey is a rough 95% band for the difference. Only Humanity's Last Exam, the knowledge exam, falls outside it. Every agentic gap is a few tasks wide and sits well inside its noise."
            : "Most of these gaps are a handful of tasks: one DeepSWE task, three on Terminal-Bench, one AIME answer in 240. The HLE gap is 129 questions."}
        </p>
      </div>
    </figure>
  )
}
