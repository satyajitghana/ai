"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The same 540 blind pairings (9 writers, 36 pairs, 15 parts each) judged twice:
// once by Claude Opus 5.5, once by GPT-6 Astra. Both grids are copied from
// training/head_to_head/results.json and results-astra.json in
// github.com/MaximeRivest/sciencemadereadable (commit 384ef37). Each cell is
// [wins, losses, no clear winner] for the row writer against the column writer;
// a win counts only if the judge picks the same rewrite in both presentation
// orders. Win rate = (wins + half the no-clear-winners) / 120.

type Cell = [number, number, number] | null
type Grid = Cell[][]

const WRITERS = ["Opus", "Astra", "Sonnet", "Sol", "Our 9B", "Our 4B", "Terra 5.6", "Luna", "Our 0.8B"]
const STUDENT = new Set(["Our 9B", "Our 4B", "Our 0.8B"])
const ANTHROPIC = new Set(["Opus", "Sonnet"])

const OPUS: Grid = [
  [null, [7, 3, 5], [12, 2, 1], [12, 1, 2], [11, 1, 3], [12, 1, 2], [14, 0, 1], [15, 0, 0], [15, 0, 0]],
  [[3, 7, 5], null, [3, 5, 7], [9, 3, 3], [10, 3, 2], [12, 0, 3], [13, 1, 1], [14, 0, 1], [15, 0, 0]],
  [[2, 12, 1], [5, 3, 7], null, [8, 5, 2], [7, 5, 3], [11, 3, 1], [11, 1, 3], [12, 1, 2], [14, 0, 1]],
  [[1, 12, 2], [3, 9, 3], [5, 8, 2], null, [8, 7, 0], [8, 5, 2], [11, 1, 3], [13, 1, 1], [15, 0, 0]],
  [[1, 11, 3], [3, 10, 2], [5, 7, 3], [7, 8, 0], null, [8, 4, 3], [11, 4, 0], [11, 4, 0], [15, 0, 0]],
  [[1, 12, 2], [0, 12, 3], [3, 11, 1], [5, 8, 2], [4, 8, 3], null, [6, 7, 2], [7, 5, 3], [14, 1, 0]],
  [[0, 14, 1], [1, 13, 1], [1, 11, 3], [1, 11, 3], [4, 11, 0], [7, 6, 2], null, [7, 3, 5], [13, 0, 2]],
  [[0, 15, 0], [0, 14, 1], [1, 12, 2], [1, 13, 1], [4, 11, 0], [5, 7, 3], [3, 7, 5], null, [15, 0, 0]],
  [[0, 15, 0], [0, 15, 0], [0, 14, 1], [0, 15, 0], [0, 15, 0], [1, 14, 0], [0, 13, 2], [0, 15, 0], null],
]

const ASTRA: Grid = [
  [null, [0, 15, 0], [3, 9, 3], [2, 10, 3], [11, 2, 2], [11, 0, 4], [0, 14, 1], [2, 11, 2], [15, 0, 0]],
  [[15, 0, 0], null, [13, 1, 1], [13, 1, 1], [15, 0, 0], [15, 0, 0], [10, 4, 1], [12, 0, 3], [15, 0, 0]],
  [[9, 3, 3], [1, 13, 1], null, [6, 5, 4], [12, 2, 1], [13, 0, 2], [2, 9, 4], [7, 7, 1], [15, 0, 0]],
  [[10, 2, 3], [1, 13, 1], [5, 6, 4], null, [11, 1, 3], [13, 1, 1], [5, 9, 1], [4, 6, 5], [15, 0, 0]],
  [[2, 11, 2], [0, 15, 0], [2, 12, 1], [1, 11, 3], null, [9, 1, 5], [0, 15, 0], [1, 12, 2], [15, 0, 0]],
  [[0, 11, 4], [0, 15, 0], [0, 13, 2], [1, 13, 1], [1, 9, 5], null, [0, 14, 1], [0, 12, 3], [14, 1, 0]],
  [[14, 0, 1], [4, 10, 1], [9, 2, 4], [9, 5, 1], [15, 0, 0], [14, 0, 1], null, [9, 4, 2], [15, 0, 0]],
  [[11, 2, 2], [0, 12, 3], [7, 7, 1], [6, 4, 5], [12, 1, 2], [12, 0, 3], [4, 9, 2], null, [15, 0, 0]],
  [[0, 15, 0], [0, 15, 0], [0, 15, 0], [0, 15, 0], [0, 15, 0], [1, 14, 0], [0, 15, 0], [0, 15, 0], null],
]

const JUDGES = {
  opus: { label: "Judge: Claude Opus 5.5", grid: OPUS },
  astra: { label: "Judge: GPT-6 Astra", grid: ASTRA },
} as const

type JudgeKey = keyof typeof JUDGES

function winRate(grid: Grid, i: number) {
  let w = 0
  let t = 0
  let n = 0
  for (const c of grid[i]) {
    if (!c) continue
    w += c[0]
    t += c[2]
    n += c[0] + c[1] + c[2]
  }
  return n > 0 ? (w + t / 2) / n : 0
}

function colorFor(name: string) {
  if (STUDENT.has(name)) return "oklch(0.55 0.15 155)"
  if (ANTHROPIC.has(name)) return "oklch(0.62 0.14 55)"
  return "oklch(0.58 0.13 265)"
}

export function JudgeFlip() {
  const [judge, setJudge] = useState<JudgeKey>("opus")
  const [a, setA] = useState(4)
  const [b, setB] = useState(6)

  const grid = JUDGES[judge].grid
  const ranked = WRITERS.map((name, i) => ({ name, i, rate: winRate(grid, i) })).sort((x, y) => y.rate - x.rate)

  const pair = (g: Grid) => (a === b ? null : g[a][b])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          540 blind pairings · 3 papers · 15 parts · same rewrites, two judges
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">measured from the repo&apos;s result files</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(JUDGES) as JudgeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setJudge(k)}
              aria-pressed={judge === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                judge === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {JUDGES[k].label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {ranked.map((r, k) => (
            <div key={r.name} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{k + 1}</span>
              <span className="w-20 shrink-0 truncate text-right font-mono text-[10px]" style={{ color: colorFor(r.name) }}>
                {r.name}
              </span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div
                  className="h-4 rounded-sm transition-[width] duration-500"
                  style={{ width: `${r.rate * 100}%`, background: colorFor(r.name), opacity: 0.85 }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums">
                {Math.round(r.rate * 100)}%
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          orange: Anthropic writers · blue: OpenAI writers · green: the fine-tuned students (two-thirds Opus-taught)
        </div>

        <div className="mt-4 rounded-lg border border-dashed p-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
            <span className="text-muted-foreground">head to head</span>
            <select
              value={a}
              onChange={(e) => setA(Number(e.target.value))}
              aria-label="First writer"
              className="rounded border bg-background px-1.5 py-0.5"
            >
              {WRITERS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">vs</span>
            <select
              value={b}
              onChange={(e) => setB(Number(e.target.value))}
              aria-label="Second writer"
              className="rounded border bg-background px-1.5 py-0.5"
            >
              {WRITERS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
            {(Object.keys(JUDGES) as JudgeKey[]).map((k) => {
              const c = pair(JUDGES[k].grid)
              return (
                <div key={k} className={cn("rounded border p-2", judge === k && "border-foreground/30")}>
                  <div className="text-[9px] text-muted-foreground">{JUDGES[k].label}</div>
                  {c ? (
                    <div className="mt-0.5 tabular-nums">
                      <span className="font-semibold">
                        {c[0]}–{c[1]}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {c[2]} no clear winner
                      </span>
                    </div>
                  ) : (
                    <div className="mt-0.5 text-muted-foreground">pick two different writers</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </figure>
  )
}
