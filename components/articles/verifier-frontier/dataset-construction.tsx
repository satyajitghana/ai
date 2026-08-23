"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The dataset construction, which is where most of the value of this project is.
//
// Each of the four build-time decisions below closes a specific hole that would
// otherwise have produced the same headline for the wrong reason. Toggle them off
// and the panel names the artifact you would get instead.
//
// The numbers are the project's: 5,000 problems, 6 answers each at temperature
// 0.9, deduplicated, balanced to exactly 50/50, split 9,600 / 1,200 / 1,200 with
// the test slice frozen and shared across every one of the nineteen models.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Step = {
  key: string
  l: string
  detail: string
  closes: string
  ifOff: string
}

const STEPS: Step[] = [
  {
    key: "six",
    l: "six answers per problem, T = 0.9",
    detail: "turns 5,000 problems into ~30k labelled examples, and the wrong ones are realistic model-made mistakes",
    closes: "the verifier could otherwise shortcut on problem features alone",
    ifOff: "With one answer per problem, every problem carries a single label. A verifier can then score well by learning which problems tend to be answered correctly — never looking at the answer it was asked to judge.",
  },
  {
    key: "gold",
    l: "gold solutions injected as guaranteed positives",
    detail: "each problem's known-correct answer, added regardless of whether the generator found it",
    closes: "the correct class collapsing onto the easy problems",
    ifOff: "Problems the generator never solves contribute only wrong answers. The 'correct' class then consists entirely of problems that were easy to solve, and a verifier scores well by learning that correct looks easy.",
  },
  {
    key: "hard",
    l: "hard negatives, one edit from correct",
    detail: "take a correct answer, swap one operator or nudge one number, keep it only if the exact checker now says it is wrong",
    closes: "surface pattern-matching standing in for computation",
    ifOff: "Wrong answers that look wrong can be caught by their surface. A negative one edit away from correct cannot — catching it requires actually doing the arithmetic, which is the capability being measured.",
  },
  {
    key: "frozen",
    l: "deduplicated, balanced 50/50, split once, frozen",
    detail: "9,600 / 1,200 / 1,200, with the test slice shared across all nineteen models",
    closes: "chance drifting away from 0.50, and cross-model comparisons drifting apart",
    ifOff: "Without exact balance, the chance baseline moves per task and 'sits at chance' stops being a single number. Without a shared frozen slice, the size curve is nineteen models measured on nineteen slightly different tests.",
  },
]

const FLOW = [
  { l: "5,000 problems", v: "procedural generators (Reasoning Gym)", c: MUTED },
  { l: "× 6 answers at T=0.9", v: "Qwen2.5-7B on Countdown, 3B on Maze", c: ACCENT },
  { l: "exact checker labels each", v: "free supervision — no human, no judge model", c: GOOD },
  { l: "+ gold · + hard negatives", v: "guaranteed positives and one-edit negatives", c: WARM },
  { l: "dedup · balance · split · freeze", v: "9,600 / 1,200 / 1,200", c: MUTED },
]

export function DatasetConstruction() {
  const [off, setOff] = useState<string[]>([])
  const toggle = (k: string) => setOff((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const broken = STEPS.filter((s) => off.includes(s.key))

  const W = 720
  const H = 96
  const BW = 132
  const GAP = 15

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          how 5,000 puzzles become a benchmark that measures verification
        </span>
        <span className="font-mono text-[10px]" style={{ color: broken.length ? WARM : GOOD }}>
          {broken.length ? `${broken.length} safeguard${broken.length > 1 ? "s" : ""} disabled` : "all four in place"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              A five-stage pipeline turning procedurally generated puzzles into a balanced, frozen verification
              benchmark
            </title>
            {FLOW.map((f, i) => {
              const x = 6 + i * (BW + GAP)
              return (
                <g key={f.l}>
                  <rect x={x} y={22} width={BW} height={46} rx={6} fill={f.c} fillOpacity={0.12} stroke={f.c} strokeOpacity={0.5} />
                  <text x={x + BW / 2} y={41} fontSize={9.5} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {f.l}
                  </text>
                  <foreignObject x={x + 4} y={44} width={BW - 8} height={22}>
                    <div
                      style={{
                        fontSize: "7.5px",
                        lineHeight: "10px",
                        textAlign: "center",
                        fontFamily: "ui-monospace, monospace",
                        opacity: 0.55,
                      }}
                    >
                      {f.v}
                    </div>
                  </foreignObject>
                  {i < FLOW.length - 1 ? (
                    <polygon points={`${x + BW + 11},45 ${x + BW + 3},41 ${x + BW + 3},49`} fill="currentColor" fillOpacity={0.35} />
                  ) : null}
                </g>
              )
            })}
            <text x={6} y={13} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              built once, then never reweighted or resampled when scoring
            </text>
            <text x={W - 6} y={H - 6} fontSize={9} fill="currentColor" fillOpacity={0.45} textAnchor="end" fontFamily="ui-monospace, monospace">
              faithfulness skips to HaluEval&rsquo;s ready-made human-labelled pairs
            </text>
          </svg>
        </div>

        <div className="mt-3 space-y-1">
          {STEPS.map((s) => {
            const disabled = off.includes(s.key)
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={!disabled}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                  disabled ? "border-transparent bg-muted/10" : "hover:bg-muted/20",
                )}
                style={{ borderColor: disabled ? undefined : `${GOOD}55` }}
              >
                <span
                  className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: disabled ? "transparent" : GOOD, border: disabled ? "1px solid currentColor" : "none", opacity: disabled ? 0.4 : 1 }}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-mono text-[10px]", disabled ? "text-muted-foreground line-through" : "text-foreground")}>
                    {s.l}
                  </span>
                  <span className="block font-mono text-[9px] text-muted-foreground">
                    {disabled ? s.ifOff : s.detail}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px]"
                  style={{ background: disabled ? `${WARM}22` : `${GOOD}1f`, color: disabled ? WARM : GOOD }}
                >
                  {disabled ? "hole open" : "closes a hole"}
                </span>
              </button>
            )
          })}
        </div>

        {broken.length ? (
          <div className="mt-2 rounded-lg border px-3 py-2.5 text-sm leading-6 text-muted-foreground" style={{ borderColor: WARM }}>
            With {broken.length === 1 ? "that safeguard" : "those safeguards"} off, a verifier can still score
            well — on a benchmark that is no longer measuring verification.{" "}
            <span className="text-foreground">
              &ldquo;A 0.63M model verifies at 0.85&rdquo; would then be a statement about the dataset
            </span>
            , and it would be indistinguishable from the real result on any published number.
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Toggle any of the four off and read what you would get instead. Each closes a specific hole through
          which a verifier can score well without ever doing the check — and none of them is a step you would take
          unless you had thought about how the measurement could lie to you.
          <br />
          <br />
          This is where most of the project&rsquo;s value sits, and it is why the headline is worth taking
          seriously. The claim is not &ldquo;a small model gets 0.85&rdquo;; a small model can get 0.85 on a badly
          built set trivially. The claim is{" "}
          <span className="text-foreground">0.85 on a balanced set whose negatives are one edit from correct and
          whose positives include problems the generator could not solve</span>, on a frozen slice shared with
          every larger model in the comparison.
        </p>
      </div>
    </figure>
  )
}
