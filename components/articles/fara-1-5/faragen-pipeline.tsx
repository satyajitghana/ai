"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// FaraGen1.5, the pipeline that generates almost all of Fara1.5's training data:
// Environments -> a Solver (paired with a user simulator) that attempts the task
// -> three independent Verifiers, any one of which can reject the trajectory ->
// the admitted trajectory joins the ~2M-sample training mix. Click a verifier to
// see what it actually catches. The mix bar underneath is the real composition
// of that final set (paper's reported percentages).

const ACCENT = "oklch(0.6 0.18 275)"

const VERIFIERS = [
  {
    key: "correctness",
    label: "Correctness",
    catches:
      "Did the trajectory actually solve the task, checked against the environment's own ground truth -- not just the agent's own \"done\" claim.",
  },
  {
    key: "efficiency",
    label: "Efficiency",
    catches:
      "Did the solver take a reasonable path, or wander -- dead-end tabs, backtracking, redundant re-reads that a well-trained model shouldn't learn to imitate.",
  },
  {
    key: "critical",
    label: "Critical points",
    catches:
      "Did the trajectory pause and ask before an irreversible action -- payment, submit, send -- or did it barrel through one no user ever authorized.",
  },
] as const

const MIX = [
  { label: "web trajectories", pct: 60.0 },
  { label: "synthetic environments", pct: 12.8 },
  { label: "form filling / interaction", pct: 12.5 },
  { label: "grounding", pct: 8.8 },
  { label: "VQA", pct: 4.9 },
  { label: "GUI drag / misc", pct: 0.8 },
]

const W = 720
const H = 178
const STAGE_Y = 26
const STAGE_H = 56

function stageBox(x: number, w: number, label: string, sub: string, key: string) {
  return (
    <g key={key}>
      <rect
        x={x}
        y={STAGE_Y}
        width={w}
        height={STAGE_H}
        rx={9}
        fill="var(--background)"
        stroke="var(--border)"
        strokeWidth={1.4}
      />
      <text x={x + w / 2} y={STAGE_Y + 24} textAnchor="middle" className="fill-foreground font-mono" fontSize={11.5} fontWeight={600}>
        {label}
      </text>
      <text x={x + w / 2} y={STAGE_Y + 41} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
        {sub}
      </text>
    </g>
  )
}

function arrow(x1: number, x2: number, y: number, key: string) {
  return (
    <path
      key={key}
      d={`M ${x1} ${y} L ${x2} ${y}`}
      stroke="var(--muted-foreground)"
      strokeWidth={1.4}
      markerEnd="url(#fg-arrow)"
      opacity={0.6}
    />
  )
}

export function FaraGenPipeline() {
  const [sel, setSel] = useState<(typeof VERIFIERS)[number]["key"]>("critical")
  const active = VERIFIERS.find((v) => v.key === sel)!

  const envW = 128, envX = 8
  const solW = 150, solX = envX + envW + 34
  const verW = 236, verX = solX + solW + 34
  const outW = 96, outX = verX + verW + 34
  const midY = STAGE_Y + STAGE_H / 2

  const pillW = (verW - 24) / 3

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>faragen1.5 · synthetic data pipeline</span>
        <span className="text-muted-foreground/50">~2m training samples</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="FaraGen1.5 pipeline: environments feed a solver paired with a user simulator, which produces trajectories checked by three verifiers, any one of which can reject before a trajectory joins the training set.">
          <defs>
            <marker id="fg-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
          </defs>

          {stageBox(envX, envW, "Environments", "live web + 6 synthetic apps", "env")}
          {arrow(envX + envW, solX, midY, "a1")}

          {stageBox(solX, solW, "Solver + user sim", "GPT-5.4 agent (83% M2W)", "sol")}
          {arrow(solX + solW, verX, midY, "a2")}

          {/* verifier gate */}
          <rect x={verX} y={STAGE_Y - 8} width={verW} height={STAGE_H + 16} rx={10} fill="none" stroke="var(--border)" strokeWidth={1.2} strokeDasharray="3 3" />
          <text x={verX + verW / 2} y={STAGE_Y - 13} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            verifiers · any one can veto
          </text>
          {VERIFIERS.map((v, i) => {
            const x = verX + 12 + i * pillW
            const isSel = v.key === sel
            return (
              <g key={v.key} onClick={() => setSel(v.key)} className="cursor-pointer" role="button" tabIndex={0}>
                <rect
                  x={x}
                  y={STAGE_Y + 6}
                  width={pillW - 8}
                  height={STAGE_H - 12}
                  rx={7}
                  fill={isSel ? ACCENT : "var(--muted)"}
                  opacity={isSel ? 0.92 : 0.35}
                  className="transition-all duration-200"
                />
                <text
                  x={x + (pillW - 8) / 2}
                  y={STAGE_Y + STAGE_H / 2 + 3}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9}
                  fontWeight={isSel ? 700 : 500}
                  fill={isSel ? "oklch(0.99 0 0)" : "var(--muted-foreground)"}
                >
                  {v.label}
                </text>
              </g>
            )
          })}

          {arrow(verX + verW, outX, midY, "a3")}
          {stageBox(outX, outW, "Training set", "~2M samples", "out")}
        </svg>

        <div className="mt-1 flex flex-wrap gap-1.5">
          {VERIFIERS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setSel(v.key)}
              aria-pressed={sel === v.key}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                sel === v.key ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm leading-6 text-foreground">{active.catches}</p>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">training mix (~2M samples, by category)</div>
          <svg viewBox={`0 0 ${W} 34`} className="w-full" role="img" aria-label="Training mix: 60 percent web trajectories, 12.8 percent synthetic environments, 12.5 percent form filling, 8.8 percent grounding, 4.9 percent VQA, 0.8 percent GUI drag and misc.">
            {(() => {
              let acc = 0
              return MIX.map((m, i) => {
                const x = (acc / 100) * W
                const w = (m.pct / 100) * W
                acc += m.pct
                const shade = 0.32 + i * 0.1
                return (
                  <rect
                    key={m.label}
                    x={x}
                    y={0}
                    width={Math.max(w - 1, 0)}
                    height={20}
                    rx={2}
                    fill={ACCENT}
                    opacity={Math.min(shade, 0.95)}
                  />
                )
              })
            })()}
          </svg>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
            {MIX.map((m) => (
              <span key={m.label}>
                {m.label} <span className="text-foreground">{m.pct}%</span>
              </span>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Almost none of this is human-collected. The solver is GPT-5.4 (a strong but not vision-only agent, 83% on
          Online-Mind2Web) paired with a simulated user that withholds task details the way a real one would. Three
          verifiers gate the output before it counts as training data -- reject on any one and the trajectory never
          reaches the mix below. 60% of the final set is still ordinary web trajectories; the rest is synthetic
          environments, form-filling with deliberate ambiguity, grounding, and a small slice of VQA and drag gestures.
        </p>
      </div>
    </figure>
  )
}
