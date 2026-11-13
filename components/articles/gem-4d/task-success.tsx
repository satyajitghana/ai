"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// GEM-4D's Table 2 (arXiv 2605.22882v4), every cell, and the arithmetic behind
// the launch post's headline.
//
// RLBench: success of trajectories that the paper's own inverse-dynamics
// system (AIDS) extracted from each model's rollouts, replayed in the
// simulator. TesserAct's rollouts go through GEM-4D's AIDS because TesserAct's
// own inverse dynamics is not public. CogVideoX has no RLBench row: most of its
// rollouts could not be processed at all.
//
// Droid: a 15-participant human study that rates generated videos for task
// success, deformation and instruction following. No robot moved for these.
//
// The means are unweighted averages of the columns shown; the paper prints
// none of them. 159 / 7 = 22.71 and 526 / 7 = 75.14 give the post's 22.7 and
// 75.1. Droid: 182 / 3 = 60.67 and 245 / 3 = 81.67; the paper writes 61 and 81.
// Only + - * / and toFixed, so server and browser print the same text.

type Row = { task: string; tess: number; gem: number; cog: number | null }

const RLBENCH: Row[] = [
  { task: "Lift Numbered Block", tess: 21, gem: 78, cog: null },
  { task: "Put Rubbish In Bin", tess: 0, gem: 75, cog: null },
  { task: "Reach Target", tess: 2, gem: 82, cog: null },
  { task: "Lamp On", tess: 36, gem: 67, cog: null },
  { task: "Pick Up Cup", tess: 49, gem: 81, cog: null },
  { task: "Slide Block To Target", tess: 18, gem: 80, cog: null },
  { task: "Solve Puzzle", tess: 33, gem: 63, cog: null },
]

const DROID: Row[] = [
  { task: "AUTOLab", tess: 58, gem: 75, cog: 49 },
  { task: "CLVR", tess: 65, gem: 83, cog: 64 },
  { task: "RAIL", tess: 59, gem: 87, cog: 39 },
]

type Split = "rlbench" | "droid"
type Sort = "paper" | "gap"

const fmt = (x: number) => x.toFixed(1)

export function TaskSuccess() {
  const [split, setSplit] = useState<Split>("rlbench")
  const [sort, setSort] = useState<Sort>("paper")
  const [dropped, setDropped] = useState<Record<string, boolean>>({})

  const base = split === "rlbench" ? RLBENCH : DROID
  const rows = sort === "gap" ? [...base].sort((a, b) => b.gem - b.tess - (a.gem - a.tess)) : base
  const kept = base.filter((r) => !dropped[r.task])
  const n = kept.length
  const sumT = kept.reduce((s, r) => s + r.tess, 0)
  const sumG = kept.reduce((s, r) => s + r.gem, 0)
  const meanT = n ? sumT / n : 0
  const meanG = n ? sumG / n : 0

  const W = 640
  const LABEL = 170
  const BAR = W - LABEL - 60
  const ROWH = 34

  const toggle = (t: string) => setDropped((d) => ({ ...d, [t]: !d[t] }))

  const tab = (key: string, label: string, on: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1",
        on
          ? "border-foreground/60 text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="GEM-4D's Table 2, per task, with the means the launch post quotes"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        paper Table 2, every cell · the means are my arithmetic on it · click a task to leave it out
      </div>

      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="benchmark">
          <span className="w-20 shrink-0 text-muted-foreground">split</span>
          {tab("rl", "RLBench · simulator replay", split === "rlbench", () => {
            setSplit("rlbench")
            setDropped({})
          })}
          {tab("dr", "Droid · human study of videos", split === "droid", () => {
            setSplit("droid")
            setDropped({})
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="order">
          <span className="w-20 shrink-0 text-muted-foreground">order</span>
          {tab("p", "as in the paper", sort === "paper", () => setSort("paper"))}
          {tab("g", "by gap", sort === "gap", () => setSort("gap"))}
        </div>
      </div>

      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} ${rows.length * ROWH + 24}`}
          width="100%"
          className="min-w-[460px]"
          role="img"
          aria-label={`Success rate per task. Mean over ${n} tasks: TesserAct ${fmt(meanT)}%, GEM-4D ${fmt(meanG)}%.`}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={LABEL + (v / 100) * BAR}
                x2={LABEL + (v / 100) * BAR}
                y1={0}
                y2={rows.length * ROWH}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              <text
                x={LABEL + (v / 100) * BAR}
                y={rows.length * ROWH + 16}
                textAnchor="middle"
                className="fill-current font-mono text-[10px] opacity-60"
              >
                {v}%
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = i * ROWH
            const off = !!dropped[r.task]
            return (
              <g
                key={r.task}
                opacity={off ? 0.25 : 1}
                onClick={() => toggle(r.task)}
                style={{ cursor: "pointer" }}
              >
                <text x={0} y={y + 20} className="fill-current font-mono text-[11px]">
                  {r.task}
                </text>
                {r.cog !== null && (
                  <rect
                    x={LABEL}
                    y={y + 3}
                    width={(r.cog / 100) * BAR}
                    height={6}
                    rx={1}
                    className="fill-current"
                    opacity={0.3}
                  />
                )}
                <rect
                  x={LABEL}
                  y={y + 10}
                  width={Math.max(1, (r.tess / 100) * BAR)}
                  height={9}
                  rx={1.5}
                  fill="oklch(0.72 0.14 65)"
                />
                <rect
                  x={LABEL}
                  y={y + 20}
                  width={(r.gem / 100) * BAR}
                  height={9}
                  rx={1.5}
                  fill="var(--hg-accent, oklch(0.62 0.13 165))"
                />
                <text
                  x={LABEL + (r.gem / 100) * BAR + 6}
                  y={y + 28}
                  className="fill-current font-mono text-[10px]"
                >
                  {r.tess} → {r.gem}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 font-mono text-[11px] text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-2 w-3 rounded-sm" style={{ background: "oklch(0.72 0.14 65)" }} />
          TesserAct (through GEM-4D&rsquo;s extractor on RLBench)
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-3 rounded-sm"
            style={{ background: "var(--hg-accent, oklch(0.62 0.13 165))" }}
          />
          GEM-4D
        </span>
        {split === "droid" && (
          <span>
            <span className="mr-1 inline-block h-1.5 w-3 rounded-sm bg-current opacity-30" />
            CogVideoX
          </span>
        )}
      </div>

      <div className="grid gap-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-3">
        <div>
          <div className="text-muted-foreground">TesserAct mean</div>
          <div className="tabular-nums">
            {sumT} / {n} = {fmt(meanT)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">GEM-4D mean</div>
          <div className="tabular-nums">
            {sumG} / {n} = {fmt(meanG)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">gap</div>
          <div className="tabular-nums">+{fmt(meanG - meanT)} points</div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        {split === "rlbench"
          ? "Two of seven TesserAct cells are 0 and 2. Leave Put Rubbish In Bin and Reach Target out and the gap shrinks from 52.4 to 42.4 points. The paper gives no trial count or spread for this table."
          : "No robot moved for these numbers: 15 people rated generated videos. The column means are 60.7 and 81.7; the paper's abstract says 61% and 81%."}
      </figcaption>
    </figure>
  )
}
