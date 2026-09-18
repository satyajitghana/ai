"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

// The launch post compares "70ms-500ms" (TypeSafe) against "3 to 329 seconds" (frontier
// LLMs) -- but doesn't say the 329s task is the same task as the 70ms one. TypeSafe's own
// docs cookbooks run a fairer comparison: the SAME rubric, forced into the SAME structured
// answer shape (via TypeSafe's own "System One LLM" wrapper), sent to Jev and to four LLMs
// side by side. These are TWO of those cookbooks' own measured numbers -- self-published,
// cached, and explicitly flagged by TypeSafe as "historical price assumptions... not
// verified jev-latest prices or current billing amounts" -- plotted on log-log axes so the
// two-plus-orders-of-magnitude spread is legible. Toggle between the two tasks; the ranking
// barely moves, which is itself informative about how load-bearing the specific task is.

type Point = {
  label: string
  ms: number
  cost: number
  accent?: boolean
  dx: number
  dy: number
  anchor?: "start" | "end" | "middle"
}

type Task = {
  key: string
  name: string
  detail: string
  source: string
  points: Point[]
}

const ACCENT = "oklch(0.68 0.19 15)" // Jev
const MUTED = "oklch(0.6 0.02 260)"

const TASKS: Task[] = [
  {
    key: "moderation",
    name: "Moderation rubric",
    detail: "8 Choice questions, one borderline user post, 15 repeats/condition",
    source: "docs.typesafe.ai cookbook “Self-consistency: choices”, sampled 2026-09-11",
    points: [
      { label: "Jev (jev-latest)", ms: 114, cost: 0.000046, accent: true, dx: 8, dy: -10, anchor: "start" },
      { label: "gpt-5.4-mini", ms: 2293, cost: 0.002299, dx: -8, dy: -12, anchor: "end" },
      { label: "claude-haiku-4-5", ms: 3853, cost: 0.003498, dx: 8, dy: 16, anchor: "start" },
      { label: "claude-opus-4-8 (reasoning)", ms: 10376, cost: 0.028375, dx: -8, dy: -12, anchor: "end" },
      { label: "gpt-5.5 (reasoning)", ms: 12978, cost: 0.041255, dx: 8, dy: 16, anchor: "start" },
    ],
  },
  {
    key: "insurance",
    name: "Insurance-claim rubric",
    detail: "14 Noul questions, one claim, 15 repeats/condition",
    source: "docs.typesafe.ai cookbook “Self-consistency: nouls”, sampled 2026-09-11",
    points: [
      { label: "Jev (jev-latest)", ms: 111, cost: 0.000043, accent: true, dx: 8, dy: -10, anchor: "start" },
      { label: "gpt-5.4-mini", ms: 1405, cost: 0.001089, dx: -8, dy: -12, anchor: "end" },
      { label: "claude-haiku-4-5", ms: 1780, cost: 0.001798, dx: 8, dy: 16, anchor: "start" },
      { label: "gpt-5.5 (reasoning)", ms: 11125, cost: 0.033157, dx: -10, dy: -12, anchor: "end" },
      { label: "claude-opus-4-8 (reasoning)", ms: 13886, cost: 0.034275, dx: 8, dy: 16, anchor: "start" },
    ],
  },
]

const COST_MIN = 0.00003
const COST_MAX = 0.05
const MS_MIN = 80
const MS_MAX = 20000

const COST_TICKS = [0.0001, 0.001, 0.01]
const MS_TICKS = [
  { v: 100, label: "100ms" },
  { v: 1000, label: "1s" },
  { v: 10000, label: "10s" },
]

const W = 680
const H = 380
const PL = 58
const PR = 18
const PT = 22
const PB = 40

const logCostMin = mlog10(COST_MIN)
const logCostMax = mlog10(COST_MAX)
const logMsMin = mlog10(MS_MIN)
const logMsMax = mlog10(MS_MAX)

const xPos = (cost: number) =>
  PL + ((mlog10(cost) - logCostMin) / (logCostMax - logCostMin)) * (W - PL - PR)
const yPos = (ms: number) =>
  PT + ((mlog10(ms) - logMsMin) / (logMsMax - logMsMin)) * (H - PT - PB)

const fmtCost = (c: number) => (c < 0.001 ? `$${c.toFixed(6)}` : `$${c.toFixed(4)}`)
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`)

export function CostLatencyFrontier() {
  const [taskIndex, setTaskIndex] = useState(0)
  const task = TASKS[taskIndex]
  const jev = task.points.find((p) => p.accent)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cost vs. latency, same rubric, same schema, per call</span>
        <span className="text-muted-foreground/50">log-log · TypeSafe&apos;s own cookbook numbers</span>
      </div>

      <div className="flex gap-1.5 border-b px-3 py-2">
        {TASKS.map((t, i) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTaskIndex(i)}
            className={
              i === taskIndex
                ? "rounded-full px-3 py-1 font-mono text-xs font-medium text-background"
                : "rounded-full px-3 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
            }
            style={i === taskIndex ? { background: "var(--foreground)" } : undefined}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        <p className="mb-2 font-mono text-[11px] text-muted-foreground">
          {task.detail} · {task.source}
        </p>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${task.name}: Jev costs ${fmtCost(jev.cost)} and takes ${fmtMs(jev.ms)} per call; the four LLM conditions range from ${fmtMs(Math.min(...task.points.filter((p) => !p.accent).map((p) => p.ms)))} to ${fmtMs(Math.max(...task.points.map((p) => p.ms)))} and ${fmtCost(Math.min(...task.points.filter((p) => !p.accent).map((p) => p.cost)))} to ${fmtCost(Math.max(...task.points.map((p) => p.cost)))}`}
        >
          <defs>
            <filter id="clf-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* gridlines */}
          {COST_TICKS.map((c) => (
            <line key={`vx-${c}`} x1={xPos(c)} x2={xPos(c)} y1={PT} y2={H - PB} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
          ))}
          {MS_TICKS.map((t) => (
            <line key={`hy-${t.v}`} x1={PL} x2={W - PR} y1={yPos(t.v)} y2={yPos(t.v)} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
          ))}
          <line x1={PL} x2={PL} y1={PT} y2={H - PB} stroke="var(--border)" strokeWidth={1} />
          <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="var(--border)" strokeWidth={1} />

          {/* "cheaper & faster" corner label */}
          <text x={PL + 6} y={PT + 14} className="fill-muted-foreground font-mono" fontSize={9}>
            ↙ cheaper &amp; faster
          </text>

          {/* axis tick labels */}
          {COST_TICKS.map((c) => (
            <text key={`vxl-${c}`} x={xPos(c)} y={H - PB + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {c < 0.001 ? `$${c}` : `$${c}`}
            </text>
          ))}
          {MS_TICKS.map((t) => (
            <text key={`hyl-${t.v}`} x={PL - 8} y={yPos(t.v) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
              {t.label}
            </text>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            cost per call (log) →
          </text>
          <text x={16} y={(PT + H - PB) / 2} textAnchor="middle" transform={`rotate(-90 16 ${(PT + H - PB) / 2})`} className="fill-muted-foreground font-mono" fontSize={9}>
            latency per call (log) →
          </text>

          {/* points */}
          {task.points.map((p) => {
            const cx = xPos(p.cost)
            const cy = yPos(p.ms)
            return (
              <g key={p.label}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={p.accent ? 7 : 5}
                  fill={p.accent ? ACCENT : "var(--background)"}
                  stroke={p.accent ? "var(--background)" : MUTED}
                  strokeWidth={p.accent ? 2 : 1.5}
                  filter="url(#clf-soft)"
                />
                <text
                  x={cx + p.dx}
                  y={cy + p.dy}
                  textAnchor={p.anchor ?? "start"}
                  className="font-mono"
                  fontSize={10.5}
                  fill={p.accent ? ACCENT : "var(--foreground)"}
                  fontWeight={p.accent ? 600 : 400}
                >
                  {p.label}
                </text>
                <text
                  x={cx + p.dx}
                  y={cy + p.dy + 12}
                  textAnchor={p.anchor ?? "start"}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {fmtMs(p.ms)} · {fmtCost(p.cost)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {task.points.map((p) => (
            <div key={p.label}>
              <div className="truncate font-mono text-[10px] text-muted-foreground" title={p.label}>
                {p.label}
              </div>
              <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: p.accent ? ACCENT : undefined }}>
                {(p.ms / jev.ms).toFixed(1)}× slower
              </div>
              <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {(p.cost / jev.cost).toFixed(1)}× cost
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This is the comparison the launch post&apos;s <strong>&ldquo;70ms&ndash;500ms vs. 3&ndash;329 seconds&rdquo;</strong>{" "}
          line skips: the same eight- or fourteen-question rubric, forced into the same JSON shape for every model.
          Under that constraint the reasoning models (<code>gpt-5.5</code>, <code>claude-opus-4-8</code>) land at
          10&ndash;14 seconds and 600&ndash;900× the cost — in the neighborhood of the blog&apos;s upper bound, not
          the extreme end of it. The non-reasoning models land at 1&ndash;4 seconds, nowhere near 329s. TypeSafe&apos;s own
          caption on this table: these are <em>&ldquo;historical price assumptions&hellip; not verified <code>jev-latest</code>{" "}
          prices or current billing amounts.&rdquo;</em>
        </p>
      </div>
    </figure>
  )
}
