"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// SAIL's Table I as a budget slider. Every number here is the paper's own
// (arXiv 2603.08269v2, Table I): the share of 20 seeds per task for which the
// search found a trajectory that passes the simulator's ground-truth success
// check within the node budget. Nothing is interpolated between budgets; the
// slider only steps through the five budgets the paper ran.
//
// At 15 nodes the two baselines the paper ran at that budget are drawn too:
// breadth-first (15 independent proposals, no feedback loop) and depth-first
// (15 sequential refinements of one chain).

const TASKS = ["Banana", "Pen", "Bowl", "Drawer", "Laptop", "Marker"] as const
const FULL = ["HandOverBanana", "HandOverPen", "BowlOnRack", "DrawerOpen", "LaptopClose", "MarkerRemoveLid"]

const BUDGETS = [1, 6, 15, 30, 45] as const
const SAIL: Record<number, number[]> = {
  1: [40, 40, 40, 10, 15, 5],
  6: [80, 55, 100, 20, 50, 25],
  15: [90, 70, 100, 40, 50, 40],
  30: [95, 80, 100, 50, 55, 45],
  45: [95, 80, 100, 50, 70, 45],
}
const AVG: Record<number, number> = { 1: 25, 6: 55, 15: 65, 30: 71, 45: 73 }
const BFS = [85, 50, 60, 35, 60, 15]
const DFS = [45, 50, 80, 5, 30, 10]

const C_SAIL = "oklch(0.58 0.14 250)"
const C_BFS = "oklch(0.68 0.14 60)"
const C_DFS = "oklch(0.62 0.12 330)"

export function BudgetSweep() {
  const [idx, setIdx] = useState(2)
  const nodes = BUDGETS[idx]
  const vals = SAIL[nodes]
  const showBase = nodes === 15

  const W = 720
  const H = 250
  const PAD = { l: 36, r: 12, t: 14, b: 40 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const gw = iw / TASKS.length
  const Y = (v: number) => PAD.t + ih - (v / 100) * ih

  // three bars per group at 15 nodes, one otherwise
  const bars = showBase
    ? [
        { key: "sail", v: vals, c: C_SAIL },
        { key: "bfs", v: BFS, c: C_BFS },
        { key: "dfs", v: DFS, c: C_DFS },
      ]
    : [{ key: "sail", v: vals, c: C_SAIL }]
  const bw = showBase ? gw * 0.22 : gw * 0.42

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="overflow-x-auto px-2 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[520px]" role="img">
          <title>
            {`Success-found rate per task at ${nodes} node${nodes === 1 ? "" : "s"}: ${TASKS.map((t, i) => `${t} ${vals[i]}%`).join(", ")}; average ${AVG[nodes]}%.`}
          </title>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke="currentColor" className="text-border" />
              <text x={PAD.l - 6} y={Y(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {v}
              </text>
            </g>
          ))}
          {TASKS.map((t, i) => {
            const gx = PAD.l + i * gw + gw / 2
            const total = bars.length * bw + (bars.length - 1) * 4
            const single = SAIL[1][i]
            return (
              <g key={t}>
                {bars.map((b, j) => {
                  const x = gx - total / 2 + j * (bw + 4)
                  const v = b.v[i]
                  return (
                    <g key={b.key}>
                      <rect x={x} y={Y(v)} width={bw} height={Y(0) - Y(v)} fill={b.c} rx={2} />
                      <text x={x + bw / 2} y={Y(v) - 4} textAnchor="middle" className="fill-foreground font-mono text-[10px]">
                        {v}
                      </text>
                    </g>
                  )
                })}
                {/* the single-generation level, for reference */}
                {nodes !== 1 && (
                  <line
                    x1={gx - gw * 0.4}
                    x2={gx + gw * 0.4}
                    y1={Y(single)}
                    y2={Y(single)}
                    stroke="currentColor"
                    strokeDasharray="4 3"
                    className="text-foreground/60"
                  />
                )}
                <text x={gx} y={H - 22} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                  {t}
                </text>
              </g>
            )
          })}
          <text x={PAD.l} y={H - 4} className="fill-muted-foreground font-mono text-[10px]">
            % of 20 seeds where a passing trajectory was found · dashed: 1 node
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
        <label htmlFor="sail-budget" className="font-mono text-xs text-muted-foreground">
          budget <span className="text-foreground">{nodes}</span> node{nodes === 1 ? "" : "s"}
        </label>
        <Range
          id="sail-budget"
          min={0}
          max={BUDGETS.length - 1}
          step={1}
          value={idx}
          accent={C_SAIL}
          onChange={(e) => setIdx(Number(e.currentTarget.value))}
          className="min-w-40 flex-1"
        />
      </div>

      <div className="grid gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-3">
        <span className="text-muted-foreground">
          <span className="inline-block h-2 w-3" style={{ background: C_SAIL }} /> SAIL average{" "}
          <span className="text-foreground">{AVG[nodes]}%</span>
        </span>
        {showBase ? (
          <>
            <span className="text-muted-foreground">
              <span className="inline-block h-2 w-3" style={{ background: C_BFS }} /> breadth-first, 15 nodes{" "}
              <span className="text-foreground">51%</span>
            </span>
            <span className="text-muted-foreground">
              <span className="inline-block h-2 w-3" style={{ background: C_DFS }} /> depth-first, 15 nodes{" "}
              <span className="text-foreground">37%</span>
            </span>
          </>
        ) : (
          <span className="text-muted-foreground sm:col-span-2">
            set the budget to 15 to see the two baselines the paper ran at that budget
          </span>
        )}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Reported: SAIL paper, Table I. Tasks: {FULL.join(", ")}, in the ALOHA simulator, 20 seeds each. Only the
        five budgets the paper ran are shown; nothing is interpolated. Success is the simulator&apos;s own check, not
        the VLM score.
      </figcaption>
    </figure>
  )
}
