"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Between the post's 3 and its 23 the paper has a ladder, and the rungs say
// who is doing the work.
//
// Rows 1 and 3-6 are the paper's Table 4 (hard four-number Countdown, the same
// 30 problems), with token counts from its Table 6. Row 7 is Table 3 at 200
// judged positions. Rows 2 and 8 are mine, measured on 30 different hard
// problems from the same generator (the 30 whose numbers the lab published in
// its Phase 0 and Phase 1 raw results): row 2 is the width-6 frontier with its
// judge replaced by a random order, 4,000 shuffles per problem, 14.4% expected
// = 4.3 of 30; row 8 is a breadth-first pass over every merged state with no
// judge, which solves all 30 after judging at most 150 positions.
//
// "LM" marks what the 1.7B model does in that row. The filter keeps only the
// rows where the model runs at all.

type Row = {
  label: string
  solved: number
  lm: "writes" | "reads" | "none"
  lmNote: string
  judge: string
  src: "reported" | "measured"
  post?: boolean
}

const ROWS: Row[] = [
  {
    label: "Qwen3-1.7B thinking in text",
    solved: 3,
    lm: "writes",
    lmNote: "writes 1,490 tokens, reads 83",
    judge: "none: it must commit to an answer",
    src: "reported",
    post: true,
  },
  {
    label: "frontier, width 6, random order",
    solved: 4.3,
    lm: "none",
    lmNote: "not used",
    judge: "a shuffle",
    src: "measured",
  },
  {
    label: "frontier, width 6, the model asked yes or no",
    solved: 4,
    lm: "reads",
    lmNote: "reads about 4,290 tokens, writes 0",
    judge: "P(yes), AUC 0.58",
    src: "reported",
  },
  {
    label: "frontier, width 6, probe on the model's hidden state",
    solved: 15,
    lm: "reads",
    lmNote: "reads about 4,290 tokens, writes 0",
    judge: "linear probe, AUC 0.87",
    src: "reported",
  },
  {
    label: "frontier, width 6, probe on number features",
    solved: 22,
    lm: "none",
    lmNote: "not used",
    judge: "linear probe, AUC 0.94",
    src: "reported",
  },
  {
    label: "frontier, width 6, trained set transformer",
    solved: 23,
    lm: "none",
    lmNote: "not used",
    judge: "102,145 parameters, AUC 0.98",
    src: "reported",
    post: true,
  },
  {
    label: "same judge, width 16, 200 judged positions",
    solved: 30,
    lm: "none",
    lmNote: "not used",
    judge: "the same set transformer",
    src: "reported",
  },
  {
    label: "breadth-first over every state, no judge",
    solved: 30,
    lm: "none",
    lmNote: "not used",
    judge: "none: at most 150 states, all of them",
    src: "measured",
  },
]

const BAR = "oklch(0.60 0.15 255)"
const POST = "oklch(0.66 0.16 45)"

type Filter = "all" | "lm" | "post"

export function ClaimLadder() {
  const [filter, setFilter] = useState<Filter>("all")
  const rows = ROWS.filter((r) =>
    filter === "all" ? true : filter === "lm" ? r.lm !== "none" : r.post
  )

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">show</span>
        {(
          [
            ["all", "every rung"],
            ["post", "the two rows the post compares"],
            ["lm", "only rows where the 1.7B model runs"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-xs transition-colors",
              filter === id
                ? "border-foreground/40 bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ol className="my-0 list-none space-y-3 px-4 py-4">
        {rows.map((r) => (
          <li key={r.label} className="pl-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm">
                {r.label}
                {r.post ? (
                  <span className="ml-2 font-mono text-[10px] tracking-wide uppercase" style={{ color: POST }}>
                    in the post
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-sm">
                {r.solved % 1 === 0 ? r.solved : r.solved.toFixed(1)}
                <span className="text-muted-foreground"> / 30</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-sm bg-muted">
              <div
                className="h-2 rounded-sm"
                style={{ width: `${((r.solved / 30) * 100).toFixed(2)}%`, background: r.post ? POST : BAR }}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted-foreground">
              <span className={cn(r.lm !== "none" && "text-foreground")}>LM: {r.lmNote}</span>
              <span>judge: {r.judge}</span>
              <span>{r.src}</span>
            </div>
          </li>
        ))}
      </ol>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Hard four-number Countdown, 30 problems. Reported rows are the paper&apos;s Tables 3, 4 and 6.
        Measured rows are mine, on 30 other hard problems from the same generator. Every search row
        lets the environment list the legal moves; only the judge changes.
      </figcaption>
    </figure>
  )
}
