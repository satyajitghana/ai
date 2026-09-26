"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Solved-of-30 against judged positions, the paper's Figure 3, with two
// reference curves and the size of the space drawn on.
//
// "Interference Search" and "one line" are the lab's own curves for its 30 hard
// four-number problems, read from results/llm/viz_slim.json (the data behind
// Figure 3). The two dashed curves are mine, on 30 different hard problems from
// the same generator: the same frontier loop, the same cost unit and the same
// width rule (W = budget / 12, rounded down, minimum 1), with the judge
// replaced by a random order (400 runs per problem, averaged) or by the exact
// solver. The shaded band is what a breadth-first pass over every merged state
// costs on those 30 problems with no judge at all: 72 to 150 judged positions.
//
// The unit matters. Only judging costs anything; listing the legal moves and
// checking the goal are free, so the budget is checked at the top of a round
// and, on four numbers, mostly sets the width rather than stopping the search.

const BUDGETS = [10, 20, 30, 45, 60, 80, 100, 130, 160, 200, 260, 330, 420, 520]
const SERIES = [
  { id: "is", label: "Interference Search (trained judge)", src: "reported", color: "oklch(0.55 0.15 255)", dash: "", v: [0, 2, 3, 13, 13, 23, 27, 29, 29, 30, 30, 30, 30, 30] },
  { id: "line", label: "one line of thought (trained judge)", src: "reported", color: "oklch(0.66 0.16 45)", dash: "", v: [0, 1, 7, 8, 12, 13, 15, 18, 19, 21, 21, 24, 24, 25] },
  { id: "oracle", label: "same frontier, exact solver as judge", src: "measured", color: "oklch(0.60 0.15 150)", dash: "5 4", v: [0, 0, 2, 19, 23, 30, 30, 30, 30, 30, 30, 30, 30, 30] },
  { id: "random", label: "same frontier, random order", src: "measured", color: "oklch(0.62 0.02 260)", dash: "2 3", v: [0, 0.01, 0.08, 1.75, 2.59, 4.33, 5.67, 8.03, 12.45, 14.01, 12.42, 14.59, 17.07, 19.23] },
] as const

const SWEEP_LO = 72
const SWEEP_HI = 150

export function BudgetCurve() {
  const [idx, setIdx] = useState(9)
  const [hidden, setHidden] = useState<string[]>([])
  const b = BUDGETS[idx]
  const w = Math.max(1, Math.floor(b / 12))

  const W = 720
  const H = 260
  const PAD = { l: 40, r: 16, t: 14, b: 36 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const X = (v: number) => PAD.l + (v / 540) * iw
  const Y = (v: number) => PAD.t + ih - (v / 30) * ih

  const path = (v: readonly number[]) =>
    v.map((y, i) => `${i === 0 ? "M" : "L"}${X(BUDGETS[i]).toFixed(1)},${Y(y).toFixed(1)}`).join(" ")

  const fmt = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
        {SERIES.map((s) => {
          const on = !hidden.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => setHidden((h) => (on ? [...h, s.id] : h.filter((x) => x !== s.id)))}
              className={cn(
                "flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[11px] transition-colors",
                on ? "text-foreground" : "text-muted-foreground/60 line-through"
              )}
            >
              <span className="inline-block h-[2px] w-3" style={{ background: s.color }} />
              {s.label}
              <span className="text-muted-foreground">· {s.src}</span>
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto px-2 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img">
          <title>
            Solved out of 30 hard four-number Countdown problems against positions judged per problem.
            Interference Search reaches 30 at 200; one line of thought reaches 21 at 200 and 25 at 520.
            The same frontier with an exact solver as judge reaches 30 at 80; with a random order it
            reaches about 14 at 200. A breadth-first pass over every state costs 72 to 150 judged
            positions.
          </title>
          {/* the whole space, swept with no judge */}
          <rect
            x={X(SWEEP_LO)}
            y={PAD.t}
            width={X(SWEEP_HI) - X(SWEEP_LO)}
            height={ih}
            fill="currentColor"
            className="text-muted-foreground/10"
          />
          <text x={X(SWEEP_LO) + 4} y={PAD.t + 12} className="fill-muted-foreground font-mono text-[10px]">
            every state, no judge: 72–150
          </text>
          {/* grid */}
          {[0, 10, 20, 30].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke="currentColor" className="text-border" />
              <text x={PAD.l - 6} y={Y(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {v}
              </text>
            </g>
          ))}
          {[0, 100, 200, 300, 400, 500].map((v) => (
            <text key={v} x={X(v)} y={H - 18} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
              {v}
            </text>
          ))}
          <text x={PAD.l + iw / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            positions judged per problem
          </text>
          {/* budget marker */}
          <line x1={X(b)} x2={X(b)} y1={PAD.t} y2={PAD.t + ih} stroke="currentColor" strokeDasharray="3 3" className="text-foreground/50" />
          {SERIES.filter((s) => !hidden.includes(s.id)).map((s) => (
            <g key={s.id}>
              <path d={path(s.v)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
              <circle cx={X(b)} cy={Y(s.v[idx])} r={3.5} fill={s.color} />
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
        <label htmlFor="budget-idx" className="font-mono text-xs text-muted-foreground">
          budget {b} · width {w}
        </label>
        <Range
          id="budget-idx"
          min={0}
          max={BUDGETS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.currentTarget.value))}
          className="min-w-40 flex-1"
        />
      </div>

      <div className="grid gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-2">
        {SERIES.map((s) => (
          <span key={s.id} className="text-muted-foreground">
            <span className="text-foreground">{fmt(s.v[idx])}</span> / 30 · {s.label}
          </span>
        ))}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Solid curves: the lab&apos;s 30 problems (its Figure 3 data). Dashed curves and the band: my runs
        of the same loop on 30 other hard problems from the same generator. Proposing moves and checking
        the goal are free in this unit; only judging a state costs.
      </figcaption>
    </figure>
  )
}
