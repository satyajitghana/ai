"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Rigel's zero-shot scores against each baseline, per task, from the
// lm-evaluation-harness result files the Rigel blog ships inside its chart
// bundle (every model run 0-shot, BF16, same harness commit). The blog's chart
// shows nine tasks; the same result files also hold COPA, RACE and LAMBADA.
// Numbers are the harness's own (acc_norm where the chart uses it, acc
// otherwise), times 100, to two decimals.

const TASKS = [
  { key: "sciq", label: "SciQ", charted: true },
  { key: "boolq", label: "BoolQ", charted: true },
  { key: "piqa", label: "PIQA", charted: true },
  { key: "arc_easy", label: "ARC-Easy", charted: true },
  { key: "hellaswag", label: "HellaSwag", charted: true },
  { key: "winogrande", label: "WinoGrande", charted: true },
  { key: "mmlu", label: "MMLU", charted: true },
  { key: "arc_challenge", label: "ARC-Challenge", charted: true },
  { key: "openbookqa", label: "OpenBookQA", charted: true },
  { key: "copa", label: "COPA", charted: false },
  { key: "race", label: "RACE", charted: false },
  { key: "lambada_openai", label: "LAMBADA", charted: false },
] as const

type TaskKey = (typeof TASKS)[number]["key"]
type Scores = Record<TaskKey, number>

const RIGEL: Scores = {
  sciq: 94.7, piqa: 76.12, arc_easy: 73.53, boolq: 76.51, hellaswag: 65.48, winogrande: 61.72,
  mmlu: 51.61, arc_challenge: 45.22, openbookqa: 41.0, copa: 74.0, race: 36.27, lambada_openai: 54.92,
}

const BASELINES: { key: string; label: string; scores: Scores }[] = [
  {
    key: "llama3b",
    label: "Llama-3.2-3B",
    scores: {
      sciq: 93.6, piqa: 78.02, arc_easy: 71.84, boolq: 73.7, hellaswag: 74.05, winogrande: 69.61,
      mmlu: 55.03, arc_challenge: 46.25, openbookqa: 40.8, copa: 82.0, race: 38.85, lambada_openai: 69.65,
    },
  },
  {
    key: "granite",
    label: "Granite-4.2-3B",
    scores: {
      sciq: 93.1, piqa: 76.22, arc_easy: 73.91, boolq: 74.07, hellaswag: 69.87, winogrande: 65.75,
      mmlu: 58.19, arc_challenge: 47.27, openbookqa: 39.8, copa: 82.0, race: 40.0, lambada_openai: 59.36,
    },
  },
  {
    key: "llama1b",
    label: "Llama-3.2-1B",
    scores: {
      sciq: 91.2, piqa: 74.97, arc_easy: 61.74, boolq: 63.64, hellaswag: 64.22, winogrande: 60.46,
      mmlu: 37.67, arc_challenge: 37.03, openbookqa: 37.0, copa: 82.0, race: 37.22, lambada_openai: 62.2,
    },
  },
  {
    key: "smol",
    label: "SmolLM3-3B-Base",
    scores: {
      sciq: 92.2, piqa: 78.73, arc_easy: 76.98, boolq: 80.34, hellaswag: 75.22, winogrande: 67.96,
      mmlu: 59.81, arc_challenge: 52.39, openbookqa: 44.4, copa: 86.0, race: 38.18, lambada_openai: 69.61,
    },
  },
]

const MAXD = 16 // points; the axis runs -16 .. +16
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`

export function EvalGap() {
  const [base, setBase] = useState("llama3b")
  const [all, setAll] = useState(false)

  const b = BASELINES.find((x) => x.key === base) ?? BASELINES[0]
  const tasks = TASKS.filter((t) => all || t.charted)
  const avg = (s: Scores) => tasks.reduce((acc, t) => acc + s[t.key], 0) / tasks.length
  const gap = avg(RIGEL) - avg(b.scores)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Rigel minus baseline, zero-shot, points</span>
        <span className="text-muted-foreground/60">from the harness result files</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {BASELINES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setBase(x.key)}
              aria-pressed={base === x.key}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                base === x.key ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              vs {x.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-pressed={all}
            className={cn(
              "ml-auto cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
              all ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {all ? "all 12 tasks in the logs" : "the 9 charted tasks"}
          </button>
        </div>

        <div className="mt-4 space-y-1.5">
          {tasks.map((t) => {
            const d = RIGEL[t.key] - b.scores[t.key]
            const w = (Math.min(Math.abs(d), MAXD) / MAXD) * 50
            return (
              <div key={t.key} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2">
                <span className={cn("truncate font-mono text-[11px]", t.charted ? "text-foreground" : "text-muted-foreground")}>
                  {t.label}
                  {!t.charted && <span className="text-muted-foreground/60"> *</span>}
                </span>
                <div className="relative h-3.5 rounded-sm bg-muted/30">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
                  <div
                    className="absolute inset-y-0 rounded-sm transition-all duration-300"
                    style={{
                      left: d >= 0 ? "50%" : `${(50 - w).toFixed(2)}%`,
                      width: `${w.toFixed(2)}%`,
                      background: d >= 0 ? "oklch(0.60 0.15 255)" : "oklch(0.63 0.15 40)",
                    }}
                  />
                </div>
                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{signed(d)}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 font-mono text-[11px]">
          <span className="text-muted-foreground">
            average over {tasks.length}: Rigel {avg(RIGEL).toFixed(2)} · {b.label} {avg(b.scores).toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-foreground">{signed(gap)} points</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground/70">
          * in the result files, not in the blog&apos;s chart · COPA has 100 questions, so one question is one point
        </div>
      </div>
    </figure>
  )
}
