"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Scaling Agentic RL — the reward-source spectrum. The taskset catalog above
// this component runs on graders with a ground truth: a gold patch, a hidden
// test. Hugging Face's watercolour-painting reproduction (Sergio Paniego,
// TRL + OpenEnv, Sept 2026 — see https://huggingface.co/blog/train-to-paint-with-code)
// runs the same GRPO loop over a reward with none: the sketch is judged by a
// vision model against a hand-rated pool, or by a preference model trained
// once on human comparisons. Same failure mode — a policy under optimisation
// pressure finds whatever seam is left — but the seam moves as the grader
// itself gets less like a test and more like an opinion. Five stops along one
// axis, from "a ground truth exists" to "taste, and nothing else." Click a
// stop. Illustrative, drawn from both posts' own numbers.

const ACCENT = "oklch(0.66 0.14 195)"

type Stop = {
  id: string
  axisLabel: string
  title: string
  subtitle: string
  source: string
  groundTruth: "yes" | "no" | "partial"
  grades: string
  hack: string
  xFrac: number
}

const STOPS: Stop[] = [
  {
    id: "verifier",
    axisLabel: "verifier",
    title: "Gold-patch verifier",
    subtitle: "hidden tests, applied and run",
    source: "Prime Intellect · 23 agentic tasksets",
    groundTruth: "yes",
    grades:
      "Whether the patched repo passes the taskset's own hidden test suite — a fact that existed before the rollout started and does not depend on anyone's opinion of the diff.",
    hack: "Reading the withheld test file or grading state if the sandbox leaks it. Mitigated, not eliminated: grading material is hidden until scoring, then restored only to compute the reward.",
    xFrac: 0.03,
  },
  {
    id: "gate",
    axisLabel: "gate",
    title: "Rule-based honesty gate",
    subtitle: "compiled? used the library? didn't cheat?",
    source: "HuggingEnvs watercolour environment",
    groundTruth: "partial",
    grades:
      "Not whether the painting is any good — whether the sketch actually painted with p5.brush. Static analysis plus a paint-coverage floor reject a submission that loaded someone else's image, wrote the answer as text, or drew with bare p5 primitives to dodge the medium, before any judge looks at it.",
    hack: "None turned up across roughly 300 generations with the allowlist advised but not enforced by the gate itself — the checks are mechanical, so there is nothing for a policy to flatter.",
    xFrac: 0.21,
  },
  {
    id: "absolute",
    axisLabel: "judge · absolute",
    title: "LLM judge, absolute mark",
    subtitle: "one vision call, scored 1 to 10",
    source: "HuggingEnvs watercolour environment",
    groundTruth: "no",
    grades:
      "A vision model looks at the render alone, no reference, and returns a mark against an anchored rubric — the slot HPSv3 fills in the original rubric, stood in for because a 7B preference model can't keep up with a rollout group on CPU.",
    hack: "The judge's own compression: love-tier and okay-tier paintings score 9.0 and 8.4, close enough to overlap. It discriminates worst exactly where a training run spends most of its time — near the top.",
    xFrac: 0.45,
  },
  {
    id: "pairwise",
    axisLabel: "judge · pairwise",
    title: "LLM judge, pairwise",
    subtitle: "which is better, A or B?",
    source: "HuggingEnvs env · Qwen3-VL-30B-A3B-Instruct",
    groundTruth: "no",
    grades:
      "The render against 4 references drawn from a 178-painting hand-rated pool, scored in both presentation orders; the reward is the fraction of comparisons won.",
    hack: "Position bias on a real tie — both presentation orders picked whichever image came first when neither painting was actually better. Caught by scoring both orders and paying a tie half credit, not prevented. The score still only ever means “closer to these 178 paintings.”",
    xFrac: 0.68,
  },
  {
    id: "preference",
    axisLabel: "preference model",
    title: "Learned preference model",
    subtitle: "frozen, trained once on human data",
    source: "MizzenAI/HPSv3",
    groundTruth: "no",
    grades:
      "One forward pass: an image and a text description in, a scalar preference score out. Trained on 1.17M human pairwise comparisons, then frozen — it never consults a person again.",
    hack: "Whatever blind spot survived 1.17M comparisons — the classic RLHF failure. It can't be argued with or re-anchored mid-run the way a live LLM judge can: stable when it's right, uncorrectable when it's wrong.",
    xFrac: 0.94,
  },
]

const W = 902
const H = 190
const TRACK_X0 = 44
const TRACK_X1 = 858
const TRACK_Y = 78

const px = (frac: number) => TRACK_X0 + frac * (TRACK_X1 - TRACK_X0)

const GT_LABEL: Record<Stop["groundTruth"], string> = {
  yes: "ground truth",
  partial: "honesty only",
  no: "no ground truth",
}

export function RewardSpectrum() {
  const [selected, setSelected] = useState<string>("pairwise")
  const active = STOPS.find((s) => s.id === selected) ?? STOPS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>five reward sources · two posts · one axis</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Reward-source spectrum from a verifier with ground truth to a learned preference model with none. Selected: ${active.title}, ${GT_LABEL[active.groundTruth]}. ${active.grades} Exploit path: ${active.hack}`}
        >
          {/* end labels */}
          <text x={TRACK_X0} y={30} className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            ground truth exists
          </text>
          <text x={TRACK_X1} y={30} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            taste, no ground truth
          </text>

          {/* axis track */}
          <line x1={TRACK_X0} y1={TRACK_Y} x2={TRACK_X1} y2={TRACK_Y} stroke="var(--border)" strokeWidth={2} />
          <line
            x1={TRACK_X0}
            y1={TRACK_Y}
            x2={px(active.xFrac)}
            y2={TRACK_Y}
            stroke={ACCENT}
            strokeWidth={2}
            opacity={0.35}
          />

          {/* stops */}
          {STOPS.map((s) => {
            const isSel = s.id === selected
            const x = px(s.xFrac)
            const verified = s.groundTruth === "yes"
            const partial = s.groundTruth === "partial"
            return (
              <g key={s.id} className="transition-all duration-200">
                <circle
                  cx={x}
                  cy={TRACK_Y}
                  r={isSel ? 9 : 6.5}
                  fill={verified ? ACCENT : "var(--background)"}
                  stroke={verified ? ACCENT : isSel ? ACCENT : "var(--muted-foreground)"}
                  strokeWidth={isSel ? 2 : 1.5}
                  strokeDasharray={!verified && !partial ? "3 2.5" : undefined}
                  opacity={isSel ? 1 : verified ? 0.85 : 0.65}
                  className="transition-all duration-200"
                />
                <text
                  x={x}
                  y={TRACK_Y + 30}
                  textAnchor="middle"
                  className="fill-foreground font-mono"
                  fontSize={10.5}
                  fontWeight={isSel ? 700 : 500}
                  opacity={isSel ? 1 : 0.7}
                >
                  {s.axisLabel}
                </text>
                <text
                  x={x}
                  y={TRACK_Y + 44}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                  opacity={isSel ? 0.9 : 0.55}
                >
                  {GT_LABEL[s.groundTruth]}
                </text>
              </g>
            )
          })}

          {/* pointer from track to detail panel */}
          <line
            x1={px(active.xFrac)}
            y1={TRACK_Y + 52}
            x2={px(active.xFrac)}
            y2={H - 6}
            stroke={ACCENT}
            strokeWidth={1.25}
            strokeDasharray="2 3"
            opacity={0.5}
          />
        </svg>

        {/* detail panel */}
        <div className="mt-1 rounded-lg border bg-background/60 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="font-heading text-sm font-semibold">{active.title}</h4>
            <span className="font-mono text-[10px] text-muted-foreground">{active.source}</span>
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{active.subtitle}</p>
          <p className="mt-3 text-sm leading-6">
            <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              grades{" "}
            </span>
            {active.grades}
          </p>
          <p className="mt-2 text-sm leading-6">
            <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              exploit path{" "}
            </span>
            {active.hack}
          </p>
        </div>

        {/* stop picker */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STOPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              aria-pressed={selected === s.id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                selected === s.id
                  ? "border-foreground/40 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.axisLabel}
            </button>
          ))}
        </div>
      </div>
    </figure>
  )
}
