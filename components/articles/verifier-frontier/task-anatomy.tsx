"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a verifier actually reads, on each of the three tasks.
//
// Each verifier sees a problem P and a candidate answer A, and returns a single
// verdict. The three tasks were chosen to get progressively harder to check:
// Countdown and Maze have exact checkers so labels are free and unlimited;
// faithfulness has none, so its labels are HaluEval's human judgements and a
// frontier model is scored on the same test set as a competitor rather than as
// the source of truth.
//
// The examples are the project's own. They are worth showing because the switch-on
// sizes turn out to be explainable by them: Countdown's prompt is short and its
// tell is local, so signal survives down to 0.15M; Maze's tell is the answer's
// magnitude at the end of a ~100-token ASCII grid, which a nano model cannot carry
// that far, and it sits at exactly chance across the whole sub-1M range;
// faithfulness has a long source but lexically scattered tells, and falls between.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Task = {
  key: string
  label: string
  question: string
  problem: string[]
  answer: string
  verdict: boolean
  why: string
  supervision: string
  supervisionC: string
  on: string
  tell: string
}

const TASKS: Task[] = [
  {
    key: "countdown",
    label: "Countdown",
    question: "Does the expression hit the target using each number once?",
    problem: ["numbers → target", "6  10  10  8  →  48"],
    answer: "(10 + 8 − 10) × 6",
    verdict: true,
    why: "= 8 × 6 = 48. Uses 6, 10, 10 and 8 exactly once.",
    supervision: "checkable exactly — a generator proposes, a checker labels, data is unlimited and free",
    supervisionC: GOOD,
    on: "0.63M",
    tell: "A short prompt, and the check is local arithmetic on a handful of tokens. Signal survives furthest down here — a latent ranking signal is present at 0.15M, three sizes before a usable verdict appears.",
  },
  {
    key: "maze",
    label: "Maze",
    question: "Is the proposed shortest-path length actually the shortest?",
    problem: ["grid, start → goal", "~100 tokens of ASCII walls"],
    answer: "5 steps",
    verdict: true,
    why: "Matches the true shortest path — exactly 5 steps.",
    supervision: "checkable exactly — same free supervision, harder to read",
    supervisionC: GOOD,
    on: "1M",
    tell: "The tell is the answer's magnitude, and it sits at the very end of a long ASCII grid. A nano model cannot carry the grid that far, which is why Maze is at exactly chance — AUROC 0.50, no latent signal at all — across the whole sub-1M range, then jumps to 0.93 at 1M.",
  },
  {
    key: "faithful",
    label: "Faithfulness",
    question: "Is the answer supported by the source — nothing invented?",
    problem: ["source", "Brooklyn Nets — team owner: Jay-Z."],
    answer: "“Jay Leno is the team owner of the Brooklyn Nets.”",
    verdict: false,
    why: "Contradicts the source: it names Jay Leno, but the source says Jay-Z. A hallucinated name.",
    supervision: "no checker — HaluEval's human labels, with Gemini 2.5 Flash scored on the same set as a competitor",
    supervisionC: WARM,
    on: "1–2M",
    tell: "A long source, but the hallucination tells are scattered lexically through it rather than concentrated at one position. Falls between the other two: a latent signal flickers on at 0.63M, a usable verdict at 1M.",
  },
]

export function TaskAnatomy() {
  const [sel, setSel] = useState("maze")
  const t = TASKS.find((x) => x.key === sel) ?? TASKS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the verifier reads a problem and a candidate answer, and returns one verdict
        </span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          switches on at {t.on}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TASKS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">{t.question}</div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">problem P</div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">{t.problem[0]}</div>
            <div className="mt-0.5 font-mono text-[12px] leading-6 text-foreground">{t.problem[1]}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">proposed answer A</div>
            <div className="mt-1 font-mono text-[12px] leading-6 text-foreground">{t.answer}</div>
          </div>
        </div>

        <div
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5"
          style={{ borderColor: t.verdict ? GOOD : WARM }}
        >
          <span
            className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px]"
            style={{ background: t.verdict ? `${GOOD}22` : `${WARM}22`, color: t.verdict ? GOOD : WARM }}
          >
            {t.verdict ? "✓ Final verdict: Yes" : "✗ Final verdict: No"}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">{t.why}</span>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
            <span className="w-24 shrink-0 text-right text-foreground">supervision</span>
            <span style={{ color: t.supervisionC }}>{t.supervision}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
            <span className="w-24 shrink-0 text-right text-foreground">switch-on</span>
            <span className="text-muted-foreground">{t.on} — and here is why it lands there</span>
          </div>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {t.tell}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read the three tells together and the switch-on ordering stops being arbitrary. It is not that Maze is a
          harder <em>problem</em>{" "}than Countdown — it is that{" "}
          <span className="text-foreground">Maze&rsquo;s evidence sits at the far end of a hundred tokens of
          grid</span>, and a model with a few hundred thousand parameters cannot carry a representation that far.
          Countdown&rsquo;s check is local arithmetic on a short prompt, so it survives lowest.
          <br />
          <br />
          Which suggests the floor is set by how far the evidence has to travel rather than by how hard the check
          is to perform — an architecture and context claim, not a reasoning one. That is a more tractable
          statement than &ldquo;verification needs N parameters&rdquo;, and it predicts that a task with a long
          prompt and a local tell should sit lower than its difficulty implies.
        </p>
      </div>
    </figure>
  )
}
