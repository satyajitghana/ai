"use client"

import { useState } from "react"

// Where each post-training stage moved each benchmark, and where the student
// sits against the model it was distilled from.
//
// Two views of the same checkpoints, because the report publishes two:
//   "as published" = Table 5: the first four stages evaluated at a 65,536
//     context (61,440-token response cap), the last two at 131,072 (126,976
//     cap). The dashed divider marks the switch.
//   "all at 131K" = Table 9 (Appendix G) for the first five stages, every one
//     evaluated at the 131K limit, plus RL 3 from Table 5 (only ever run at
//     131K). Under a full budget RL 1 and RL 2 mostly stop looking like gains.
// Lengths: Table 6, mean generated tokens, all at the 131,072 limit.
// Teacher line: VibeThinker-3B's own score in Table 7, the model whose 5.5M
// solutions are the distillation corpus (report section 4.2).
//
// Only +, -, * and / reach the DOM, so no dmath wrapper is needed.

const STAGES = ["Distill", "DPO", "RL 1", "RL 2", "SFT + soup", "RL 3"]

type Bench = {
  name: string
  s: number[]
  full: number[]
  len: number[]
  teacher: number
}

const BENCH: Bench[] = [
  {
    name: "AIME 2026",
    s: [81.67, 83.54, 87.5, 87.4, 91.35, 94.01],
    full: [81.77, 91.25, 88.54, 86.98, 91.35, 94.01],
    len: [24219, 32800, 19502, 18376, 21121, 29863],
    teacher: 93.85,
  },
  {
    name: "AIME 2025",
    s: [77.08, 80.52, 85.62, 87.71, 89.17, 90.21],
    full: [79.58, 87.29, 85.42, 87.4, 89.17, 90.21],
    len: [27725, 35506, 22736, 21226, 23474, 31968],
    teacher: 92.19,
  },
  {
    name: "HMMT Feb. 2026",
    s: [64.68, 62.41, 73.01, 72.25, 80.78, 83.62],
    full: [66.48, 74.15, 72.16, 72.16, 80.78, 83.62],
    len: [37825, 44842, 28404, 26815, 33042, 44297],
    teacher: 78.98,
  },
  {
    name: "HMMT Feb. 2025",
    s: [70.42, 76.15, 80.73, 80.62, 89.69, 91.35],
    full: [72.4, 81.77, 81.98, 79.48, 89.69, 91.35],
    len: [35037, 42709, 26973, 24393, 28309, 39647],
    teacher: 88.23,
  },
  {
    name: "BeyondAIME",
    s: [57.16, 52.25, 65.28, 65.34, 72.38, 74.25],
    full: [59.41, 66.03, 66.03, 65.34, 72.38, 74.25],
    len: [39323, 49517, 30540, 27404, 36936, 52387],
    teacher: 72.0,
  },
  {
    name: "APEX Shortlist",
    s: [23.27, 21.81, 33.44, 32.05, 43.42, 50.8],
    full: [25.33, 34.51, 35.17, 30.12, 43.42, 50.8],
    len: [50485, 59860, 38747, 32359, 54239, 75007],
    teacher: 46.41,
  },
  {
    name: "ArXivMath May 2026",
    s: [20.08, 15.39, 25.08, 24.14, 23.52, 25.08],
    full: [20.47, 24.69, 26.09, 25.86, 23.52, 25.08],
    len: [40908, 65128, 34097, 29474, 46560, 68002],
    teacher: 29.77,
  },
]

const LINE = "oklch(0.55 0.15 295)"
const TEACHER = "oklch(0.6 0.15 40)"

function k(n: number) {
  return `${(n / 1000).toFixed(1)}k`
}

export function StageLadder() {
  const [bi, setBi] = useState(0)
  const [view, setView] = useState<"full" | "published">("full")
  const b = BENCH[bi]
  const vals = view === "full" ? b.full : b.s

  const W = 700
  const H = 250
  const L = 44
  const R = 24
  const T = 22
  const B = 58
  const lo = Math.min(...vals, b.teacher)
  const hi = Math.max(...vals, b.teacher)
  const pad = (hi - lo) * 0.18 + 1
  const yMin = lo - pad
  const yMax = hi + pad
  const x = (i: number) => L + (i * (W - L - R)) / (STAGES.length - 1)
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B)
  const path = vals
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
    .join(" ")
  const final = vals[vals.length - 1]
  const gap = final - b.teacher
  const divX = (x(3) + x(4)) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Post-training, stage by stage (report Tables 5, 6 and 9)
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: gap >= 0 ? LINE : TEACHER }}
        >
          final {final.toFixed(2)} vs teacher {b.teacher.toFixed(2)} (
          {gap >= 0 ? "+" : ""}
          {gap.toFixed(2)})
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-3 sm:px-4">
        {(
          [
            ["full", "all at 131K"],
            ["published", "as published"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
              view === v
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 self-center text-muted-foreground">·</span>
        {BENCH.map((bb, i) => (
          <button
            key={bb.name}
            type="button"
            onClick={() => setBi(i)}
            aria-pressed={i === bi}
            className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
              i === bi
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {bb.name}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[560px]"
          role="img"
          aria-label={`${b.name}: ${view === "full" ? "all evaluated at 131K" : "as published, 65K then 131K"}: ${STAGES.map((s, i) => `${s} ${vals[i].toFixed(2)}`).join(", ")}. The distillation teacher VibeThinker-3B scores ${b.teacher.toFixed(2)}.`}
        >
          {view === "published" && (
            <g>
              <line
                x1={divX}
                x2={divX}
                y1={T - 8}
                y2={H - B + 6}
                className="stroke-muted-foreground/50"
                strokeDasharray="3 4"
              />
              <text
                x={divX - 6}
                y={T - 10}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                evaluated at 65K
              </text>
              <text
                x={divX + 6}
                y={T - 10}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                evaluated at 131K
              </text>
            </g>
          )}

          <line
            x1={L}
            x2={W - R}
            y1={y(b.teacher)}
            y2={y(b.teacher)}
            stroke={TEACHER}
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          <text
            x={L + 4}
            y={y(b.teacher) - 5}
            fill={TEACHER}
            className="font-mono"
            style={{ fontSize: 9 }}
          >
            teacher, VibeThinker-3B: {b.teacher.toFixed(2)}
          </text>

          <path
            d={path}
            fill="none"
            stroke={LINE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {vals.map((v, i) => (
            <g key={STAGES[i]}>
              <circle cx={x(i)} cy={y(v)} r={4.5} fill={LINE} />
              <text
                x={x(i)}
                y={y(v) + (i % 2 === 0 ? -9 : 16)}
                textAnchor="middle"
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {v.toFixed(2)}
              </text>
              <text
                x={x(i)}
                y={H - B + 22}
                textAnchor="middle"
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {STAGES[i]}
              </text>
              <text
                x={x(i)}
                y={H - B + 36}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {k(b.len[i])} tok
              </text>
            </g>
          ))}
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Pass@1 after each post-training stage, with the mean answer length
        underneath. In the published view RL 1 looks like the big step; with
        every checkpoint given the same 131K budget, DPO is already close and RL
        1 and RL 2 mostly buy shorter answers. The SFT-plus-soup step and RL 3
        do the lifting after distillation. The student ends above its teacher on
        four columns, level on AIME 2026, and below it on AIME 2025 and
        ArXivMath.
      </figcaption>
    </figure>
  )
}
