"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Where "at least 1,000x faster" comes from, with its assumptions exposed.
// Baseline fit times: one cold fit (seed 0) on one H200, from the CRAM repo's
// results/baseline-fit-times.json (Sudoku, Maze) and results/multi-solution-table.json
// (N-Queens, graph coloring). CRAM fit times: the repo's run records
// (experiments/runs/table/*.json, checkpoints/*/final.json):
//   warm  = median of 7 fits after a first fit in the same process (what the paper reports)
//   cold  = the first fit in a fresh process, one-time kernel loading and compilation included
//   cpu   = cold, on one thread of a Xeon Platinum 8468, no GPU
// N-Queens cold times are from the checkpoint's indexing fit; the paper's 2.9 s and 6.8 s are a
// re-timed dense version with the same weights (to 1e-7), for which no cold time is recorded.

type Mode = "warm" | "cold" | "cpu"
type Task = {
  id: string
  label: string
  base: [string, number][]
  cram: Partial<Record<Mode, number>>
  note?: string
}

const TASKS: Task[] = [
  {
    id: "sudoku",
    label: "Sudoku-Extreme",
    base: [["HRM", 4302], ["EqR", 7056], ["TRM", 9110], ["EBR", 10114], ["FRM", 10372], ["GRAM", 11409], ["TRMP", 32486]],
    cram: { warm: 0.0424, cold: 0.5013, cpu: 1.7148 },
  },
  {
    id: "maze",
    label: "Maze-Unique",
    base: [["EBR", 7255], ["HRM", 25394], ["EqR", 25770], ["TRMP", 27467], ["FRM", 34936], ["TRM", 56071], ["GRAM", 83374]],
    cram: { warm: 0.1322, cold: 0.7995, cpu: 0.119 },
  },
  {
    id: "nq8",
    label: "N-Queens 8×8",
    base: [["HRM", 3542.6], ["TRM", 4510.4], ["GRAM", 4580.4], ["EBR", 11567.1]],
    cram: { warm: 2.896, cold: 5.604 },
    note: "cold time is the checkpoint's indexing fit",
  },
  {
    id: "nq10",
    label: "N-Queens 10×10",
    base: [["HRM", 14397.9], ["TRM", 17975.9], ["GRAM", 18897.6], ["EBR", 27454.2]],
    cram: { warm: 6.752, cold: 7.818 },
    note: "cold time is the checkpoint's indexing fit",
  },
  {
    id: "gc8",
    label: "Graph coloring 8",
    base: [["HRM", 2460.8], ["GRAM", 3157.6], ["TRM", 3241.8], ["EBR", 16227.8]],
    cram: { warm: 1.27, cold: 1.504, cpu: 59.91 },
  },
  {
    id: "gc10",
    label: "Graph coloring 10",
    base: [["HRM", 6165.7], ["TRM", 7708.8], ["GRAM", 7748.4], ["EBR", 27523.4]],
    cram: { warm: 0.344, cold: 0.55, cpu: 70.99 },
  },
]

const MODES: { id: Mode; label: string }[] = [
  { id: "warm", label: "warm GPU (paper)" },
  { id: "cold", label: "cold GPU" },
  { id: "cpu", label: "one CPU thread" },
]

function dur(s: number) {
  if (s < 1) return `${Math.round(s * 1000)} ms`
  if (s < 120) return `${s.toFixed(s < 10 ? 2 : 1)} s`
  if (s < 7200) return `${Math.round(s / 60)} min`
  return `${(s / 3600).toFixed(1)} h`
}
const ratio = (r: number) => (r >= 100 ? Math.round(r).toLocaleString("en-US") : r.toFixed(r >= 10 ? 0 : 1)) + "×"

export function SpeedupLedger() {
  const [tid, setTid] = useState("nq8")
  const [mode, setMode] = useState<Mode>("warm")
  const task = TASKS.find((t) => t.id === tid) ?? TASKS[0]
  const c = task.cram[mode]

  // floor across every task for this mode
  const floors = TASKS.flatMap((t) => {
    const v = t.cram[mode]
    if (v === undefined) return []
    const [name, s] = t.base.reduce((a, b) => (b[1] < a[1] ? b : a))
    return [{ task: t.label, name, r: s / v }]
  })
  const floor = floors.reduce((a, b) => (b.r < a.r ? b : a), floors[0])

  const lo = -2
  const hi = 5
  const W = 640
  const L = 70
  const R = 96
  const row = 22
  const x = (s: number) => L + ((mlog10(s) - lo) / (hi - lo)) * (W - L - R)
  const rows: [string, number, boolean][] = [...task.base.map(([n, s]) => [n, s, false] as [string, number, boolean]), ["CRAM", c ?? 0, true]]
  const H = rows.length * row + 34

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">fit time on one H200, log scale</span>
        <span className="font-mono text-[10px] text-muted-foreground">from the authors&apos; run records</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="task">
            {TASKS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTid(t.id)}
                className={cn("rounded px-2 py-1 font-mono text-[11px]", tid === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="how CRAM is timed">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn("rounded px-2 py-1 font-mono text-[11px]", mode === m.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={`Fit times for ${task.label}: baselines and CRAM on a log scale.`}>
          {[0.01, 0.1, 1, 10, 100, 1000, 10000, 100000].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={4} y2={H - 26} className="stroke-border" strokeDasharray="2 3" />
              <text x={x(t)} y={H - 12} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
                {dur(t)}
              </text>
            </g>
          ))}
          {rows.map(([name, s, isCram], k) => {
            const y = 6 + k * row
            if (isCram && c === undefined) {
              return (
                <text key={name} x={L} y={y + 13} className="fill-muted-foreground font-mono text-[10px]">
                  CRAM: no CPU time recorded for this task
                </text>
              )
            }
            return (
              <g key={name}>
                <text x={L - 6} y={y + 13} textAnchor="end" className={cn("font-mono text-[10px]", isCram ? "fill-sky-700 font-semibold dark:fill-sky-300" : "fill-foreground")}>
                  {name}
                </text>
                <rect x={L} y={y + 3} width={Math.max(2, x(s) - L)} height={row - 8} rx={2} className={isCram ? "fill-sky-500" : "fill-muted-foreground/40"} />
                <text x={x(s) + 5} y={y + 13} className="fill-foreground font-mono text-[10px]">
                  {dur(s)}
                  {!isCram && c !== undefined ? `  ·  ${ratio(s / c)}` : ""}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">smallest ratio, this task</div>
            <div className="mt-0.5 font-mono text-sm text-foreground">
              {c === undefined ? "n/a" : (() => {
                const [n, s] = task.base.reduce((a, b) => (b[1] < a[1] ? b : a))
                return `${ratio(s / c)} against ${n}`
              })()}
            </div>
            {task.note && mode === "cold" ? <div className="font-mono text-[9px] text-muted-foreground">{task.note}</div> : null}
          </div>
          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">smallest ratio, every task with this timing</div>
            <div className={cn("mt-0.5 font-mono text-sm", floor && floor.r < 1000 ? "text-rose-700 dark:text-rose-300" : "text-foreground")}>
              {floor ? `${ratio(floor.r)}: ${floor.task}, ${floor.name}` : "n/a"}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">over {floors.length} of 6 tasks</div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Every baseline bar is one cold fit of its authors&apos; full training schedule, not the time to reach some accuracy. The paper times CRAM warm: the median of seven fits after a first one in the same process. Switch to cold to charge CRAM its own start-up as the baselines are charged theirs, or to one CPU thread to drop the GPU. On the GPU, warm or cold, Sudoku and Maze stay above 8,000×. The floor of the headline is N-Queens 8×8 against HRM, at about 1,000×: its cold bar is the released checkpoint&apos;s slower indexing fit (4.53 s warm, 5.60 s cold), since no cold time was recorded for the paper&apos;s 2.9 s dense fit. Graph coloring on one CPU thread takes about a minute, because its cost tables depend on the whole adjacency list.
      </figcaption>
    </figure>
  )
}
