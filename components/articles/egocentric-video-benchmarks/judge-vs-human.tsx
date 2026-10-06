"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Human raters vs Ego2ActJudge on the six generators and the two human control
// sets. Human scores: the 25-case, 600-video panel (paper Table 2). Judge scores:
// all benchmark videos (Table 2), or, for Final only, the same panel videos the
// humans rated (Table 9, where the human means are recomputed on those videos). Only reported numbers; nothing is interpolated.

const HUM = "oklch(0.6 0.16 25)"
const JDG = "oklch(0.58 0.15 250)"

type Axis = "final" | "task" | "physics"
type Row = {
  name: string
  control?: boolean
  human: Record<Axis, number>
  judge: Record<Axis, number>
  judgePanel?: number
  humanPanel?: number
}

const ROWS: Row[] = [
  { name: "Seedance 2.0", human: { task: 67.8, physics: 63.0, final: 64.0 }, judge: { task: 79.9, physics: 91.1, final: 83.3 }, judgePanel: 88.0, humanPanel: 64.3 },
  { name: "Kling 3.0 Pro", human: { task: 59.3, physics: 64.2, final: 59.6 }, judge: { task: 64.0, physics: 88.9, final: 72.5 }, judgePanel: 76.7 },
  { name: "MiniMax H3", human: { task: 61.2, physics: 55.8, final: 55.3 }, judge: { task: 53.7, physics: 76.2, final: 59.3 }, judgePanel: 70.7 },
  { name: "Grok Imagine 1.5", human: { task: 56.6, physics: 47.9, final: 49.9 }, judge: { task: 67.8, physics: 79.4, final: 69.5 }, judgePanel: 72.9 },
  { name: "Wan 2.7", human: { task: 55.5, physics: 41.4, final: 44.3 }, judge: { task: 67.8, physics: 80.5, final: 71.4 }, judgePanel: 68.6 },
  { name: "Cosmos 3 Nano", human: { task: 16.9, physics: 5.2, final: 3.9 }, judge: { task: 15.4, physics: 38.8, final: 13.3 }, judgePanel: 14.4, humanPanel: 4.0 },
  { name: "Human, correct", control: true, human: { task: 100, physics: 100, final: 100 }, judge: { task: 93.9, physics: 98.1, final: 95.4 } },
  { name: "Human, wrong", control: true, human: { task: 59.6, physics: 94.1, final: 73.4 }, judge: { task: 57.8, physics: 91.6, final: 70.1 } },
]

type Sort = "human" | "judge" | "gap"

const W = 760
const LX = 150
const RX = W - 70
const ROW_H = 30
const TOP = 26
const H = TOP + ROW_H * ROWS.length + 26
const xOf = (v: number) => LX + ((RX - LX) * v) / 100

export function JudgeVsHuman() {
  const [axis, setAxis] = useState<Axis>("final")
  const [sort, setSort] = useState<Sort>("human")
  const [panel, setPanel] = useState(false)

  const usePanel = panel && axis === "final"
  const jv = (r: Row) => (usePanel && r.judgePanel !== undefined ? r.judgePanel : r.judge[axis])
  const hv = (r: Row) => (usePanel && r.humanPanel !== undefined ? r.humanPanel : r.human[axis])
  const gens = ROWS.filter((r) => !r.control)
  const key = (r: Row) => (sort === "human" ? hv(r) : sort === "judge" ? jv(r) : jv(r) - hv(r))
  const ordered = [...gens].sort((a, b) => key(b) - key(a)).concat(ROWS.filter((r) => r.control))

  const meanGap = gens.reduce((s, r) => s + (jv(r) - hv(r)), 0) / gens.length

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>ego2act · human raters vs ego2actjudge</span>
        <span className="text-muted-foreground/60">reported, 0-100</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          {(["final", "task", "physics"] as Axis[]).map((a) => (
            <button key={a} type="button" className={btn(axis === a)} onClick={() => setAxis(a)}>
              {a}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground/50">|</span>
          <span className="text-muted-foreground">sort</span>
          {(["human", "judge", "gap"] as Sort[]).map((s) => (
            <button key={s} type="button" className={btn(sort === s)} onClick={() => setSort(s)}>
              {s}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground/50">|</span>
          <button
            type="button"
            role="switch"
            aria-checked={panel}
            disabled={axis !== "final"}
            className={cn(btn(panel && axis === "final"), axis !== "final" && "cursor-not-allowed opacity-40")}
            onClick={() => setPanel((v) => !v)}
          >
            {panel && axis === "final" ? "✓" : "○"} judge on panel videos only
          </button>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`${axis} score per generator: human raters versus Ego2ActJudge. Mean judge minus human gap over the six generators: ${meanGap.toFixed(1)} points.`}
        >
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={xOf(t)} x2={xOf(t)} y1={TOP - 6} y2={H - 22} stroke="var(--border)" strokeWidth={1} />
              <text x={xOf(t)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="font-mono">
                {t}
              </text>
            </g>
          ))}
          <circle cx={LX} cy={10} r={5} fill={HUM} />
          <text x={LX + 10} y={14} fontSize={11} fill="var(--muted-foreground)" className="font-mono">
            human raters (25-case panel)
          </text>
          <circle cx={LX + 250} cy={10} r={5} fill="var(--background)" stroke={JDG} strokeWidth={2} />
          <text x={LX + 260} y={14} fontSize={11} fill="var(--muted-foreground)" className="font-mono">
            {usePanel ? "Ego2ActJudge (same panel videos)" : "Ego2ActJudge (all 110 cases)"}
          </text>
          {ordered.map((r, i) => {
            const y = TOP + i * ROW_H + ROW_H / 2
            const h = hv(r)
            const j = jv(r)
            const gap = j - h
            return (
              <g key={r.name} opacity={r.control ? 0.6 : 1}>
                {r.control && i > 0 && !ordered[i - 1].control ? (
                  <line x1={8} x2={W - 8} y1={y - ROW_H / 2} y2={y - ROW_H / 2} stroke="var(--border)" strokeDasharray="3 3" />
                ) : null}
                <text x={LX - 12} y={y + 4} textAnchor="end" fontSize={12} fill="var(--foreground)" className="font-mono">
                  {r.name}
                </text>
                <line x1={xOf(h)} x2={xOf(j)} y1={y} y2={y} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeWidth={2} />
                <circle cx={xOf(h)} cy={y} r={5.5} fill={HUM} />
                <circle cx={xOf(j)} cy={y} r={5.5} fill="var(--background)" stroke={JDG} strokeWidth={2} />
                <text x={RX + 14} y={y + 4} fontSize={11} fill={gap >= 0 ? "var(--foreground)" : HUM} className="font-mono">
                  {gap >= 0 ? "+" : "−"}
                  {Math.abs(gap).toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          right column: judge minus human. Mean over the six generators:{" "}
          <span className="text-foreground">
            {meanGap >= 0 ? "+" : "−"}
            {Math.abs(meanGap).toFixed(1)}
          </span>{" "}
          points ({axis}
          {usePanel ? ", same videos" : ", different video sets"}).
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The judge sits right of the humans on almost every row, and furthest right on Physics. It gets the order nearly right and the level wrong. MiniMax H3 and Cosmos 3 Nano are the two generators the judge scores below the humans on Task, and on the full benchmark it drops from third to fifth on Final.
        </p>
      </div>
    </figure>
  )
}
