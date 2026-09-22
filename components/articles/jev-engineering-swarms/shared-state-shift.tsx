"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The cost side of batching, and why it is easy to ship without noticing.
//
// duckdb-jev issue #4 measured what happens when rows that used to get their
// own state are grouped into one batched request. Two readouts, two different
// answers:
//
//   jev_choice  — 30 support tickets, grouped 5 / 10 / 30 rows per state,
//                 269 of 270 answers agree with the one-row-per-state baseline.
//                 Mean confidence moves from 0.951 alone to 0.939-0.970 grouped.
//
//   jev_score   — six tickets scored alone, then grouped with mild companions
//                 and with severe ones. All six move in the same direction,
//                 about -0.29 rubric levels on a 0-3 scale: roughly a tenth of
//                 the full range.
//
// The mechanism is the readout, not the model. Choice reports the argmax, which
// survives a distribution that has shifted but not reordered. Score reports a
// probability-weighted mean over the rubric levels, so the same shift lands in
// the output directly. Batching is answer-preserving for one of these and not
// for the other, and the API is the same call.
//
// The illustration below shows the effect on a single ticket: the same rubric
// distribution, nudged, and what each readout does with it. The magnitude is
// the issue's measured -0.29; the per-level shape is drawn to make the argmax
// and the mean diverge, which is the point being made.

const LEVELS = ["0 · none", "1 · minor", "2 · serious", "3 · critical"]

const ALONE = [0.05, 0.19, 0.55, 0.21]
const GROUPED = [0.09, 0.27, 0.51, 0.13]

function argmax(p: number[]) {
  let best = 0
  for (let i = 1; i < p.length; i += 1) if (p[i] > p[best]) best = i
  return best
}

function expected(p: number[]) {
  return p.reduce((acc, v, i) => acc + v * i, 0)
}

export function SharedStateShift() {
  const [grouped, setGrouped] = useState(true)
  const p = grouped ? GROUPED : ALONE
  const choiceIdx = argmax(p)
  const score = expected(p)
  const delta = expected(GROUPED) - expected(ALONE)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one ticket, two readouts, same shifted distribution
        </span>
        <div className="flex gap-1">
          {(
            [
              [false, "its own state"],
              [true, "grouped"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setGrouped(v)}
              aria-pressed={grouped === v}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors",
                grouped === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/35",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {LEVELS.map((lab, i) => (
            <div key={lab} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{lab}</span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div
                  className="h-4 rounded-sm transition-all"
                  style={{
                    width: `${p[i] * 100}%`,
                    background:
                      i === choiceIdx ? "oklch(0.58 0.15 155)" : "oklch(0.62 0.03 250)",
                    opacity: 0.9,
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {(p[i] * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">jev_choice &middot; argmax</div>
            <div className="mt-0.5 font-mono text-lg text-foreground">{LEVELS[choiceIdx]}</div>
            <div className="mt-1 text-[11px] leading-5" style={{ color: "oklch(0.58 0.15 155)" }}>
              unchanged &mdash; 269 of 270 grouped answers matched their solo baseline
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              jev_score &middot; probability-weighted mean
            </div>
            <div className="mt-0.5 font-mono text-lg tabular-nums text-foreground">{score.toFixed(2)}</div>
            <div className="mt-1 text-[11px] leading-5" style={{ color: "oklch(0.62 0.19 27)" }}>
              moves {delta.toFixed(2)} levels &mdash; the issue measured about &minus;0.29 across six tickets,
              every one in the same direction
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both readouts come from the same call and the same distribution. One reports which bar is tallest, and
          a shift that does not reorder the bars is invisible to it. The other reports where the mass sits, and
          the same shift lands straight in the number. A swarm that batches because batching is cheaper is
          silently changing the input to whichever of those two it happens to be using, and the cheap one to
          verify is the one that hides it.
        </p>
      </div>
    </figure>
  )
}
