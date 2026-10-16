"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// "A new SOTA": against what? Three boards.
//  - The paper's own Figure 4, TB 4.0 and TB 2.1 panels (reported).
//  - The official Terminal-Bench 4.0 leaderboard as embedded in tbench.ai on
//    2026-10-16, best entry per model (measured: read from the page's data;
//    each entry is 330 trials). Terminal-RSI-27B is not on it; its row is the
//    paper's own number, placed for comparison.
// Plus a granularity check: how many points one task in one run is worth, so
// the margin over the next entry can be read in tasks rather than decimals.

type Row = { m: string; v: number; ours?: boolean; open?: boolean }
type Board = { id: string; label: string; src: string; tasks: number; runs: number; rows: Row[] }

const BOARDS: Board[] = [
  {
    id: "f4-40",
    label: "Fig 4 · TB 4.0",
    src: "reported · paper Figure 4",
    tasks: 63,
    runs: 3,
    rows: [
      { m: "GPT-6 Astra (high)", v: 54.0 },
      { m: "Claude Opus 5 (high)", v: 46.0 },
      { m: "GPT-6 Sol (high)", v: 26.3 },
      { m: "Claude Haiku 5.5 (high)", v: 21.7 },
      { m: "GPT-5.6 Sol (high)", v: 20.7 },
      { m: "Terminal-RSI-27B", v: 19.84, ours: true },
      { m: "Gemini 3.8 Flash (high)", v: 19.7 },
      { m: "DeepSeek V4 Pro (max)", v: 14.6, open: true },
      { m: "Kimi K3 (max)", v: 12.6, open: true },
      { m: "DeepSeek V4 Flash 0731 (max)", v: 12.1, open: true },
    ],
  },
  {
    id: "f4-21",
    label: "Fig 4 · TB 2.1",
    src: "reported · paper Figure 4",
    tasks: 89,
    runs: 3,
    rows: [
      { m: "GPT-6 Astra (high)", v: 89.9 },
      { m: "Claude Opus 5 (high)", v: 87.6 },
      { m: "Gemini 3.8 Flash (high)", v: 87.6 },
      { m: "GPT-5.6 Sol (high)", v: 87.3 },
      { m: "Terminal-RSI-27B", v: 86.52, ours: true },
      { m: "GPT-6 Sol (high)", v: 85.4 },
      { m: "Kimi K3 (max)", v: 85.0, open: true },
      { m: "GLM-5.3 (max)", v: 83.9, open: true },
      { m: "DeepSeek V4 Pro 0813 (max)", v: 78.7, open: true },
      { m: "DeepSeek V4 Flash 0731 (max)", v: 78.7, open: true },
    ],
  },
  {
    id: "lb-40",
    label: "Official · TB 4.0",
    src: "measured · tbench.ai leaderboard, 2026-10-16, best entry per model",
    tasks: 66,
    runs: 5,
    rows: [
      { m: "Opus 5.5 (Claude Code)", v: 64.85 },
      { m: "Sonnet 5.5 (Claude Code)", v: 61.82 },
      { m: "GPT-6 Astra (Codex)", v: 58.18 },
      { m: "GPT-6.1 Sol (Codex)", v: 58.18 },
      { m: "Fable 5.1 (Claude Code)", v: 57.88 },
      { m: "Opus 5 (Claude Code)", v: 53.94 },
      { m: "GPT-6 Sol (Codex)", v: 49.39 },
      { m: "Fable 5 (Claude Code)", v: 44.55 },
      { m: "GLM-5.3 (Claude Code)", v: 41.82, open: true },
      { m: "Grok 4.7 (Grok Build)", v: 37.58 },
      { m: "GPT-5.6 Sol (Codex)", v: 37.27 },
      { m: "GLM-5.3-Flash (Claude Code)", v: 35.76, open: true },
      { m: "Qwen3.8-Max-0902 (Claude Code)", v: 26.97 },
      { m: "Opus 4.8 (Claude Code)", v: 23.64 },
      { m: "GPT-5.6 Terra (Codex)", v: 21.52 },
      { m: "Grok 4.6 (Grok Build)", v: 20.3 },
      { m: "Terminal-RSI-27B (paper, not listed)", v: 19.84, ours: true },
      { m: "Gemini 3.8 Flash (mini-SWE-agent)", v: 19.09 },
    ],
  },
]

const OURS = "oklch(0.58 0.17 255)"
const OPEN = "oklch(0.64 0.13 160)"
const REST = "oklch(0.68 0.02 260)"

export function SotaCheck() {
  const [id, setId] = useState("f4-40")
  const [openOnly, setOpenOnly] = useState(false)
  const [runs, setRuns] = useState(3)
  const board = BOARDS.find((b) => b.id === id) ?? BOARDS[0]
  const rows = openOnly ? board.rows.filter((r) => r.open || r.ours) : board.rows
  const ours = board.rows.find((r) => r.ours)
  const oursV = ours ? ours.v : 0
  const above = rows.filter((r) => !r.ours && r.v > oursV)
  const below = rows.filter((r) => !r.ours && r.v <= oursV)
  const next = below.length ? below[0] : undefined
  const margin = next ? Math.round((oursV - next.v) * 100) / 100 : 0
  const tasks = id === "lb-40" ? 63 : board.tasks
  const step = 100 / (tasks * runs)
  const flips = margin / step

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">&quot;A new SOTA&quot;, against which board?</div>
        <div className="font-mono text-xs text-muted-foreground">{board.src}</div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {BOARDS.map((b) => {
          const on = b.id === id
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={on}
              onClick={() => setId(b.id)}
              className="rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors"
              style={{ background: on ? OURS : "transparent", borderColor: on ? OURS : undefined, color: on ? "white" : undefined }}
            >
              {b.label}
            </button>
          )
        })}
        <label className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          open weights only
        </label>
      </div>

      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.m} className="flex items-center gap-2">
            <span className={`w-44 shrink-0 truncate text-xs sm:w-60 ${r.ours ? "font-semibold" : ""}`} title={r.m}>
              {r.m}
            </span>
            <div className="h-3 flex-1 rounded-sm bg-muted">
              <div
                className="h-3 rounded-sm"
                style={{ width: `${r.v.toFixed(2)}%`, background: r.ours ? OURS : r.open ? OPEN : REST }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{r.v.toFixed(2)}%</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs">
        <span className="font-semibold">{above.length}</span>{" "}
        {above.length === 1 ? "entry sits" : "entries sit"} above Terminal-RSI-27B on this board
        {openOnly ? " among open-weight models" : ""}.
        {next ? (
          <>
            {" "}
            Its margin over the next one down ({next.m}) is <span className="font-mono">{margin.toFixed(2)}</span> points.
          </>
        ) : null}
      </p>

      <div className="mt-4 rounded-md border p-3">
        <div className="mb-1 flex items-center justify-between gap-2 font-mono text-xs">
          <span>evaluation runs averaged: {runs}</span>
          <span className="text-muted-foreground">{tasks} tasks</span>
        </div>
        <Range min={1} max={5} step={1} value={runs} onChange={(e) => setRuns(Number(e.target.value))} accent={OURS} aria-label="Evaluation runs averaged" />
        <p className="mt-2 text-xs text-muted-foreground">
          One task flipping in one run moves a {runs}-run mean over {tasks} tasks by{" "}
          <span className="font-mono">{step.toFixed(2)}</span> points
          {next ? (
            <>
              , so the {margin.toFixed(2)}-point margin is <span className="font-mono">{flips.toFixed(2)}</span> of a task-run
            </>
          ) : null}
          . The paper says Mean@3; its 19.84 on TB 4.0 only comes out as a whole count over 63 tasks with two runs (25 of 126).
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Green marks open-weight models (DeepSeek, Kimi, GLM). Figure 4 does not say which agent produced the
        external rows; the official board pairs each model with an agent (Claude Code, Codex, mini-SWE-agent).
      </p>
    </div>
  )
}
