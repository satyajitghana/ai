"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Scaling Agentic RL — one rollout, drawn as the taskset pipeline. A task loads
// from typed config; a prebuilt sandbox boots and resets to base_commit; the
// harness lets the agent act; then scoring RESTORES the withheld grading material
// (the test patch + the taskset's own upstream grader), runs it, and emits a
// 0/1 reward that feeds the RL update. The whole integrity idea is one beat: the
// grader stays locked while the agent is live inside the sandbox, and unlocks only
// at scoring. Step the stages to watch it. Illustrative, not a trace.

const ACCENT = "oklch(0.66 0.14 195)"

type Stage = "setup" | "rollout" | "score" | "update"
const STAGES: Stage[] = ["setup", "rollout", "score", "update"]
const rank = (s: Stage) => STAGES.indexOf(s)

const CAPTION: Record<Stage, string> = {
  setup:
    "Load the task from a typed config, boot its prebuilt image, and reset the repo to base_commit.",
  rollout:
    "The harness runs the agent inside the sandbox. The test patch and grader stay withheld — anything readable in the container is fair game for a reward hack.",
  score:
    "Scoring restores the withheld tests, applies the test_patch, and runs the taskset's own upstream grader → reward.",
  update: "The reward becomes the RL learning signal in prime-rl.",
}

const W = 902
const H = 372

type NodeDef = {
  x: number
  y: number
  w: number
  h: number
  at: number // stage rank at which this node lights up
  title: string
  sub: string
}

const NY_TOP = 66
const NY_BOT = 250
const NH = 62

const NODES: NodeDef[] = [
  { x: 36, y: NY_TOP, w: 160, h: NH, at: 0, title: "taskset", sub: "config · split · filter" },
  { x: 252, y: NY_TOP, w: 168, h: NH, at: 0, title: "prebuilt sandbox", sub: "reset → base_commit" },
  { x: 476, y: NY_TOP, w: 186, h: NH, at: 1, title: "agent rollout", sub: "harness · agent acts" },
  { x: 300, y: NY_BOT, w: 190, h: NH, at: 2, title: "score", sub: "restore tests → grade" },
  { x: 520, y: NY_BOT, w: 122, h: NH, at: 2, title: "reward", sub: "∈ {0,1}" },
  { x: 676, y: NY_BOT, w: 190, h: NH, at: 3, title: "RL update", sub: "prime-rl signal" },
]

// the withheld grading node lives on the scoring tier but is drawn specially
const VAULT = { x: 36, y: NY_BOT, w: 196, h: NH }

type LinkDef = { d: string; at: number; vault?: boolean }

const cx = (n: { x: number; w: number }) => n.x + n.w / 2
const cyMid = (n: { y: number; h: number }) => n.y + n.h / 2

function hpath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}
function vpath(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

const taskset = NODES[0]
const sandbox = NODES[1]
const rollout = NODES[2]
const score = NODES[3]
const reward = NODES[4]
const update = NODES[5]

const LINKS: LinkDef[] = [
  { d: hpath(taskset.x + taskset.w, cyMid(taskset), sandbox.x, cyMid(sandbox)), at: 0 },
  { d: hpath(sandbox.x + sandbox.w, cyMid(sandbox), rollout.x, cyMid(rollout)), at: 1 },
  // finalize: the agent's captured diff flows down into scoring
  { d: vpath(cx(rollout), rollout.y + rollout.h, cx(score), score.y), at: 2 },
  // the vault → score: grading material restored only at scoring time
  { d: hpath(VAULT.x + VAULT.w, cyMid(VAULT), score.x, cyMid(score)), at: 2, vault: true },
  { d: hpath(score.x + score.w, cyMid(score), reward.x, cyMid(reward)), at: 2 },
  { d: hpath(reward.x + reward.w, cyMid(reward), update.x, cyMid(update)), at: 3 },
]

export function RolloutPipeline() {
  const [stage, setStage] = useState<Stage>("rollout")
  const cur = rank(stage)
  const unlocked = cur >= 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one rollout · taskset → sandbox → grade → reward</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Agentic RL rollout pipeline at the ${stage} stage. A task loads from config into a prebuilt sandbox reset to base_commit; the harness runs the agent; the withheld grader is ${unlocked ? "restored and run at scoring, producing a reward that feeds the RL update" : "kept withheld while the agent is live"}.`}
        >
          <defs>
            <marker id="rp-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="rp-arrow-mut" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} />
            </marker>
            <filter id="rp-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* tier labels */}
          <text x={36} y={40} className="fill-muted-foreground font-mono" fontSize={11}>
            agent-visible sandbox
          </text>
          <text x={36} y={228} className="fill-muted-foreground font-mono" fontSize={11}>
            withheld until scoring →
          </text>

          {/* connectors (behind nodes) */}
          {LINKS.map((l, i) => {
            const reached = cur >= l.at
            const active = cur === l.at
            const dashed = l.vault && !unlocked
            return (
              <path
                key={i}
                d={l.d}
                fill="none"
                stroke={reached ? ACCENT : "var(--muted-foreground)"}
                strokeWidth={active ? 2 : 1.5}
                strokeDasharray={dashed ? "4 3" : undefined}
                markerEnd={`url(#${reached ? "rp-arrow" : "rp-arrow-mut"})`}
                opacity={reached ? (active ? 0.95 : 0.7) : 0.28}
                className="transition-all duration-300"
              />
            )
          })}

          {/* the withheld grading vault */}
          {(() => {
            const locked = !unlocked
            return (
              <g className="transition-all duration-300">
                <rect
                  x={VAULT.x}
                  y={VAULT.y}
                  width={VAULT.w}
                  height={VAULT.h}
                  rx={10}
                  fill="var(--background)"
                  stroke={locked ? "var(--muted-foreground)" : ACCENT}
                  strokeWidth={1.5}
                  strokeDasharray={locked ? "5 4" : undefined}
                  opacity={locked ? 0.85 : 1}
                  filter={locked ? undefined : "url(#rp-soft)"}
                />
                <text x={cx(VAULT)} y={VAULT.y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600} opacity={locked ? 0.75 : 1}>
                  grading material
                </text>
                <text x={cx(VAULT)} y={VAULT.y + 36} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                  test_patch · gold_patch
                </text>
                <text x={cx(VAULT)} y={VAULT.y + 50} textAnchor="middle" className="font-mono" fontSize={9} fill={locked ? "var(--muted-foreground)" : ACCENT} fontWeight={600}>
                  {locked ? "withheld" : "restored for scoring"}
                </text>
              </g>
            )
          })()}

          {/* pipeline nodes */}
          {NODES.map((n, i) => {
            const reached = cur >= n.at
            const active = cur === n.at
            return (
              <g key={i} className="transition-all duration-300">
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={10}
                  fill="var(--background)"
                  stroke={reached ? ACCENT : "var(--border)"}
                  strokeWidth={active ? 2 : 1.5}
                  opacity={reached ? 1 : 0.5}
                  filter={active ? "url(#rp-soft)" : undefined}
                />
                <text x={cx(n)} y={n.y + 26} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600} opacity={reached ? 1 : 0.55}>
                  {n.title}
                </text>
                <text x={cx(n)} y={n.y + 43} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9} opacity={reached ? 1 : 0.55}>
                  {n.sub}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            {STAGES.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                aria-pressed={stage === s}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  stage === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="mr-1 opacity-50">{i + 1}</span>
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px]" style={{ color: unlocked ? ACCENT : undefined }}>
            <span className={unlocked ? "" : "text-muted-foreground"}>grader {unlocked ? "restored" : "withheld"}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{CAPTION[stage]}</p>
      </div>
    </figure>
  )
}
