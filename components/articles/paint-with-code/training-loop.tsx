"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The four-step loop, as the post describes it, with the fifth label the post's
// own stepper adds: prompt, model, tooling, judge, update.
//
// Every stage is quoted from the post. What is worth noticing is where the
// design work actually sits. Three of the five stages are ordinary — a prompt
// goes in, GRPO comes out, a browser renders a canvas. The two in the middle,
// "what is being judged" and "what it is being judged against", are where every
// decision in the project lives, and both of them are hand-authored artefacts
// rather than anything the training loop discovers.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Stage = {
  k: string
  l: string
  sub: string
  c: string
  authored: boolean
  body: string
  detail: string[]
}

const STAGES: Stage[] = [
  {
    k: "prompt",
    l: "prompt",
    sub: "draw a peach hibiscus in watercolour",
    c: MUTED,
    authored: false,
    body: "A natural-language request for a painting. Nothing in the loop is conditioned on a reference image — the prompt is the whole specification.",
    detail: ["ordinary", "no image conditioning", "the task, in one line"],
  },
  {
    k: "model",
    l: "model",
    sub: "writes a complete p5.brush sketch",
    c: ACCENT,
    authored: false,
    body: "The policy emits JavaScript, not pixels. That is the entire premise: the artefact is source, so a person can open it and change one line instead of going back to the prompt.",
    detail: ["output is code", "13,500 tokens → under 2,000 after the rubric fix", "editable by hand"],
  },
  {
    k: "tooling",
    l: "tooling",
    sub: "sandboxed Puppeteer → PNG",
    c: MUTED,
    authored: false,
    body: "A headless browser runs the sketch and screenshots the canvas. This is also the compilation gate: a sketch that throws produces no PNG, and there is nothing to judge.",
    detail: ["headless render", "doubles as the compile check", "the only unambiguous signal in the loop"],
  },
  {
    k: "judge",
    l: "judge",
    sub: "vs two references sampled from the pool",
    c: GOOD,
    authored: true,
    body: "A separate judge model is shown the rollout and two references drawn at random from the hand-rated pool, and asked which is the better watercolour. The reward is the fraction of comparisons won.",
    detail: ["pairwise, not 0–10", "two references per rollout", "581 paintings in the pool, 117 of them love-tier"],
  },
  {
    k: "update",
    l: "update",
    sub: "GRPO",
    c: WARM,
    authored: false,
    body: "Group-relative policy optimization: rewards are normalized within a group of rollouts on the same prompt, so what propagates is which sketch in the batch was better — not how good any of them was in absolute terms.",
    detail: ["group-relative", "ties carry no gradient direction", "runs thousands of times"],
  },
]

export function TrainingLoop() {
  const [sel, setSel] = useState(3)

  const W = 720
  const H = 132
  const BW = 118
  const GAP = 18
  const X0 = 29
  const BY = 26
  const BH = 52

  const s = STAGES[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one iteration — run thousands of times during training
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          2 of 5 stages are hand-authored
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              The training loop drawn as five boxes left to right — prompt, model, tooling, judge, update — joined by
              arrows, with a return arrow running back underneath from update to prompt. The judge box is highlighted
              as the hand-authored stage.
            </title>

            {STAGES.map((st, i) => {
              const x = X0 + i * (BW + GAP)
              const on = i === sel
              return (
                <g key={st.k} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                  <rect
                    x={x}
                    y={BY}
                    width={BW}
                    height={BH}
                    rx={7}
                    fill={st.c}
                    fillOpacity={on ? 0.24 : 0.08}
                    stroke={st.c}
                    strokeOpacity={on ? 0.85 : 0.35}
                    strokeWidth={on ? 1.6 : 1}
                    strokeDasharray={st.authored ? "none" : "none"}
                  />
                  <text
                    x={x + BW / 2}
                    y={BY + 21}
                    fontSize={11}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={on ? 1 : 0.7}
                    fontFamily="ui-monospace, monospace"
                  >
                    {st.l}
                  </text>
                  <text
                    x={x + BW / 2}
                    y={BY + 36}
                    fontSize={7.5}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={0.45}
                    fontFamily="ui-monospace, monospace"
                  >
                    {i + 1} of 5
                  </text>
                  {st.authored ? (
                    <text
                      x={x + BW / 2}
                      y={BY - 7}
                      fontSize={8}
                      textAnchor="middle"
                      fill={GOOD}
                      fontFamily="ui-monospace, monospace"
                    >
                      hand-authored
                    </text>
                  ) : null}
                  {i < STAGES.length - 1 ? (
                    <line
                      x1={x + BW + 3}
                      y1={BY + BH / 2}
                      x2={x + BW + GAP - 4}
                      y2={BY + BH / 2}
                      stroke="currentColor"
                      strokeOpacity={0.4}
                      strokeWidth={1.2}
                      markerEnd="url(#pwc-loop-arrow)"
                    />
                  ) : null}
                </g>
              )
            })}

            <defs>
              <marker id="pwc-loop-arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="currentColor" fillOpacity={0.4} />
              </marker>
            </defs>

            {/* return path */}
            <path
              d={`M ${X0 + 4 * (BW + GAP) + BW / 2} ${BY + BH} L ${X0 + 4 * (BW + GAP) + BW / 2} ${BY + BH + 24} L ${X0 + BW / 2} ${BY + BH + 24} L ${X0 + BW / 2} ${BY + BH + 5}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1.2}
              strokeDasharray="4 3"
              markerEnd="url(#pwc-loop-arrow)"
            />
            <text
              x={W / 2}
              y={BY + BH + 20}
              fontSize={8.5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.45}
              fontFamily="ui-monospace, monospace"
            >
              next rollout
            </text>
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {STAGES.map((st, i) => (
            <button
              key={st.k}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === sel
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {st.l}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[11px] text-foreground">{s.l}</span>
            <span className="font-mono text-[10px]" style={{ color: s.c }}>
              {s.sub}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.body}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {s.detail.map((d) => (
              <span key={d} className="font-mono text-[9px] text-muted-foreground">
                · {d}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Three of these five stages are off-the-shelf. A prompt goes in, a headless browser renders a canvas, GRPO
          normalizes within the group. The project&rsquo;s entire design surface is the other two:{" "}
          <span className="text-foreground">what the judge is asked</span>{" "}and{" "}
          <span className="text-foreground">what it compares against</span>. Both are hand-authored artefacts, and
          both are where the first run went wrong.
        </p>
      </div>
    </figure>
  )
}
