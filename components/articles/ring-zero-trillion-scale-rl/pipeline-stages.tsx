"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Ring-Zero's contribution is not one loss but a *sequence* of four training
// stages, each fixing what the previous one broke. First-stage RL uses a
// token-level loss to grow long reasoning; self-distillation trims the bloat and
// resets the train/infer engine gap; second-stage RL swaps to a length-normalized
// sample-level loss for sustained gains; third-stage RL adds tier prompts so one
// model can reason short or long on demand. Click a stage. Illustrative diagram.

const ACCENT = "oklch(0.58 0.19 300)"

type Stage = {
  key: string
  name: string
  tag: string
  loss: string
  kl: string
  budget: string
  why: string
}

const STAGES: Stage[] = [
  {
    key: "s1",
    name: "First-stage RL",
    tag: "elicit",
    loss: "Token-level (unnormalized)",
    kl: "KL on · β = 1e-4",
    budget: "4k → 64k (curriculum)",
    why: "Incentivize chain-of-thought from the raw base model. The token-level loss is not divided by response length, so longer correct traces accrue more credit and reasoning grows on its own.",
  },
  {
    key: "sd",
    name: "Self-Distillation",
    tag: "compress",
    loss: "SFT on shortest-correct trace",
    kl: "—",
    budget: "64k · 3 epochs",
    why: "Sample rollouts from the stage-1 expert, keep the shortest correct one, self-filter redundant segments, then fine-tune the base model on it. This compresses bloated CoT and resets the training/inference engine gap.",
  },
  {
    key: "s2",
    name: "Second-stage RL",
    tag: "sustain",
    loss: "Sample-level (1/|o|)",
    kl: "KL removed",
    budget: "64k",
    why: "The gradient is now normalized by response length, so its magnitude is independent of how long the answer is — this stops the runaway 'length inertia' the token-level loss caused, while accuracy keeps climbing.",
  },
  {
    key: "s3",
    name: "Third-stage RL",
    tag: "adapt",
    loss: "Sample-level · tier-conditioned",
    kl: "KL removed",
    budget: "4k / 16k / 64k",
    why: "Three difficulty tiers, each with its own system prompt and token budget, trained jointly. The model learns to route reasoning depth by prompt — short for easy, long for hard — at some cost to the High tier's peak.",
  },
]

// scene geometry
const W = 760
const H = 150
const NW = 158
const NH = 66
const MX = 20
const NY = 42
const STEP = (W - 2 * MX - NW) / (STAGES.length - 1)
const nx = (i: number) => MX + i * STEP

export function PipelineStages() {
  const [active, setActive] = useState(0)
  const s = STAGES[active]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the four-stage zero-RL pipeline</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Four-stage training pipeline; stage ${active + 1} of ${STAGES.length} selected: ${s.name}`}>
          <defs>
            <marker id="rz-pipe-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="rz-pipe-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          <text x={MX} y={24} className="fill-muted-foreground font-mono" fontSize={11}>
            Ling-2.5-1T-Base · no SFT · zero human labels →
          </text>

          {/* connectors between consecutive stages */}
          {STAGES.slice(0, -1).map((_, i) => {
            const x1 = nx(i) + NW
            const x2 = nx(i + 1)
            const y = NY + NH / 2
            const mx = (x1 + x2) / 2
            return (
              <path
                key={i}
                d={`M ${x1} ${y} C ${mx} ${y}, ${mx} ${y}, ${x2} ${y}`}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                markerEnd="url(#rz-pipe-arrow)"
                opacity={0.55}
              />
            )
          })}

          {/* stage nodes */}
          {STAGES.map((st, i) => {
            const on = i === active
            return (
              <g key={st.key} className="cursor-pointer" onClick={() => setActive(i)}>
                <rect
                  x={nx(i)}
                  y={NY}
                  width={NW}
                  height={NH}
                  rx={10}
                  fill={on ? ACCENT : "var(--background)"}
                  opacity={on ? 0.16 : 1}
                  stroke={on ? ACCENT : "var(--border)"}
                  strokeWidth={on ? 1.8 : 1.2}
                  filter={on ? "url(#rz-pipe-soft)" : undefined}
                  className="transition-all duration-200"
                />
                <text x={nx(i) + NW / 2} y={NY + 26} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
                  {st.name}
                </text>
                <text x={nx(i) + NW / 2} y={NY + 44} textAnchor="middle" className="font-mono" fontSize={9.5} fill={on ? ACCENT : "var(--muted-foreground)"}>
                  {st.tag} · {st.loss.split(" ")[0].toLowerCase()}
                </text>
              </g>
            )
          })}
        </svg>

        {/* stage selector */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">stage</span>
          {STAGES.map((st, i) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                i === active ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={i === active ? { background: ACCENT } : undefined}
            >
              {i + 1}. {st.tag}
            </button>
          ))}
        </div>

        {/* detail card */}
        <div className="mt-3 grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-3">
          <div className="sm:col-span-3 font-mono text-xs" style={{ color: ACCENT }}>
            {s.name}
          </div>
          <Field label="loss" value={s.loss} />
          <Field label="KL penalty" value={s.kl} />
          <Field label="seq budget" value={s.budget} />
          <p className="sm:col-span-3 text-sm leading-6 text-muted-foreground">{s.why}</p>
        </div>
      </div>
    </figure>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-muted-foreground/70">{label}</div>
      <div className="font-mono text-xs text-foreground">{value}</div>
    </div>
  )
}
