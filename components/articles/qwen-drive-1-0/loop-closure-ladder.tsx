"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The paper's own ordering: "two open-loop benchmarks, one pseudo-closed-loop
// benchmark, and one closed-loop simulator." Four benchmarks, three different
// definitions of what "the planner's own action" is allowed to change.
//
// The point this diagram exists to make: read left to right by SFT-vs-RL on
// each benchmark's headline number alone, reinforcement learning looks like a
// clean, monotonic win. Only the rightmost benchmark actually re-queries the
// planner as its own trajectory changes the next observation -- and there, RL's
// win is a *trade*: less at-fault contact, but measurably less progress. The
// other three settings cannot show you that trade even in principle, because
// none of them let the plan change what happens next.

const RL_COLOR = "oklch(0.68 0.16 45)"
const SFT_COLOR = "oklch(0.55 0.02 260)"
const TIER_COLOR: Record<string, string> = {
  "open-loop": "oklch(0.60 0.02 260)",
  "pseudo-closed-loop": "oklch(0.62 0.14 230)",
  "closed-loop": "oklch(0.62 0.17 20)",
}

type Metric = {
  label: string
  unit: string
  sft: number
  rl: number
  lowerBetter?: boolean
  decimals?: number
}

type Stage = {
  id: string
  name: string
  dataset: string
  tier: "open-loop" | "pseudo-closed-loop" | "closed-loop"
  queried: string
  metrics: Metric[]
  note: string
}

const STAGES: Stage[] = [
  {
    id: "wod",
    name: "WOD-E2E",
    dataset: "Waymo Open Dataset, test split",
    tier: "open-loop",
    queried: "once per scene, scored against the recorded future",
    metrics: [{ label: "Rater Feedback Score", unit: "", sft: 7.78, rl: 7.91, decimals: 2 }],
    note: "RFS matches a plan to human-rated candidates within a speed-dependent tolerance, so it can reward a good plan that differs from what was recorded. The validation split (not shown here) supplied the RL reward, so only the held-out test-split gain is evidence of generalizing.",
  },
  {
    id: "paiav",
    name: "PAI-AV",
    dataset: "NVIDIA PhysicalAI, leakage-free 700-frame subset",
    tier: "open-loop",
    queried: "once per scene, six samples drawn",
    metrics: [{ label: "ADE @ 3 s", unit: "m", sft: 0.42, rl: 0.47, lowerBetter: true, decimals: 2 }],
    note: "minADE (best of six against ground truth) isn't shown -- the release's own code calls that selection an oracle upper bound, since picking it needs the answer.",
  },
  {
    id: "navsim",
    name: "NAVSIM v1.1",
    dataset: "navtest split",
    tier: "pseudo-closed-loop",
    queried: "once, then the single prediction is propagated through a vehicle model",
    metrics: [{ label: "PDMS", unit: "", sft: 88.2, rl: 90.7, decimals: 1 }],
    note: "Surrounding agents replay their recorded motion and never react to the ego vehicle. The paper's own read: PDMS “should not be treated as a direct proxy for interactive driving quality” near the top of the scale.",
  },
  {
    id: "alpasim",
    name: "AlpaSim",
    dataset: "916 scenarios, PAI-AV-NuRec",
    tier: "closed-loop",
    queried: "repeatedly -- the planner is re-run as its own trajectory changes the next observation",
    metrics: [
      { label: "at-fault AlpaSim score", unit: "", sft: 0.27, rl: 0.37, decimals: 2 },
      { label: "off-road rate", unit: "%", sft: 24.0, rl: 12.0, lowerBetter: true, decimals: 1 },
      { label: "progress", unit: "%", sft: 54.0, rl: 48.0, decimals: 1 },
    ],
    note: "The one setting where compounding error is even visible. RL trades progress for safety -- lower off-road rate, but also lower progress. That trade is invisible in every benchmark to its left.",
  },
]

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

function MetricBar({ metric }: { metric: Metric }) {
  const top = Math.max(metric.sft, metric.rl) * 1.2
  const pct = (v: number) => Math.min(100, (v / top) * 100)
  const rlBetter = metric.lowerBetter ? metric.rl < metric.sft : metric.rl > metric.sft

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
        <span>{metric.label}</span>
        <span className={rlBetter ? "text-foreground" : ""} style={rlBetter ? { color: RL_COLOR } : undefined}>
          {metric.lowerBetter ? "lower is better" : "higher is better"}
        </span>
      </div>
      {([
        ["SFT", metric.sft, SFT_COLOR],
        ["RL", metric.rl, RL_COLOR],
      ] as const).map(([tag, value, color]) => (
        <div key={tag} className="flex items-center gap-2 py-0.5">
          <span className="w-7 shrink-0 font-mono text-[10px] text-muted-foreground">{tag}</span>
          <div className="relative h-3.5 flex-1 rounded-sm bg-muted/40">
            <div
              className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
              style={{ width: `${pct(value)}%`, background: color }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {fmt(value, metric.decimals)}
            {metric.unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export function LoopClosureLadder() {
  const [active, setActive] = useState("alpasim")
  const stage = STAGES.find((s) => s.id === active) ?? STAGES[0]

  const W = 860
  const H = 150
  const N = STAGES.length
  const NODE_W = 172
  const MARGIN = 20
  const GAP = (W - 2 * MARGIN - N * NODE_W) / (N - 1)
  const nodeX = (i: number) => MARGIN + i * (NODE_W + GAP)
  const NODE_Y = 46
  const NODE_H = 56

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>four benchmarks &middot; three definitions of &ldquo;the loop&rdquo;</span>
        <span className="text-muted-foreground/50">SFT vs RL, same checkpoint lineage</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Four planning benchmarks ordered by how tightly the loop closes: WOD-E2E and PAI-AV are open-loop, NAVSIM is pseudo-closed-loop, AlpaSim is closed-loop">
          <defs>
            <marker id="qd-ladder-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="qd-ladder-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {STAGES.slice(0, -1).map((_, i) => {
            const x1 = nodeX(i) + NODE_W
            const x2 = nodeX(i + 1)
            const y = NODE_Y + NODE_H / 2
            return (
              <path
                key={i}
                d={`M ${x1} ${y} L ${x2 - 6} ${y}`}
                stroke="var(--muted-foreground)"
                strokeWidth={1.3}
                opacity={0.4}
                markerEnd="url(#qd-ladder-arrow)"
              />
            )
          })}

          {STAGES.map((s, i) => {
            const x = nodeX(i)
            const isActive = s.id === active
            const color = TIER_COLOR[s.tier]
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onClick={() => setActive(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActive(s.id)
                }}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={x}
                  y={NODE_Y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill="var(--background)"
                  stroke={isActive ? color : "var(--border)"}
                  strokeWidth={isActive ? 1.8 : 1.3}
                  filter={isActive ? "url(#qd-ladder-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text x={x + NODE_W / 2} y={NODE_Y + 24} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
                  {s.name}
                </text>
                <text
                  x={x + NODE_W / 2}
                  y={NODE_Y + 41}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                  fill={isActive ? color : "var(--muted-foreground)"}
                >
                  {s.tier}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-pressed={active === s.id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors sm:hidden",
                active === s.id ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-[13rem] rounded-lg border bg-muted/10 p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-xs font-medium text-foreground">{stage.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{stage.dataset}</span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">queried: {stage.queried}</p>

          <div className="mt-2 divide-y divide-border/60">
            {stage.metrics.map((m) => (
              <MetricBar key={m.label} metric={m} />
            ))}
          </div>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.note}</p>
        </div>
      </div>
    </figure>
  )
}
