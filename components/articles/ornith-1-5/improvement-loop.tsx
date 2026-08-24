"use client"

import { useState } from "react"

// The three-stage loop, drawn.
//
// A conventional RL post-training pipeline has three fixed inputs: human-curated
// tasks, a hand-designed harness, and a policy. Ornith-1.5 makes all three
// learned, in one loop, with reward propagated across every stage — and each
// stage carries its own multiplicative reward:
//
//   R_task     = V(q,s) x D(q,s,{tau}) x N(q)
//   R_harness  = C(q,h) x F(h,{tau}) x H(h)
//   R_rollout  = h(q, tau)
//
// All three are optimized with GRPO.
//
// The two feedback paths are what make it a loop rather than a pipeline. Reward
// from the rollout flows back to the proposer and the harness, so a task that
// produced useful learning signal makes the proposer more likely to produce
// tasks like it. And the solve history feeds forward into proposing, so the
// curriculum's difficulty target is measured against the current policy.
//
// The buffer B is the third arrow and the easiest one to miss: novelty is scored
// against tasks already generated or trained on, which is what stops the proposer
// from farming small variations of one good task.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Stage = {
  key: string
  n: number
  title: string
  produces: string
  reward: string
  color: string
  terms: { sym: string; asks: string }[]
  note: string
}

const STAGES: Stage[] = [
  {
    key: "task",
    n: 1,
    title: "propose a task",
    produces: "a question q",
    reward: "R_task = V · D · N",
    color: ACCENT,
    terms: [
      { sym: "V(q,s)", asks: "is it valid and verifiable? — a hard gate: V = 0 zeroes everything" },
      { sym: "D(q,s,{τ})", asks: "is it at the right difficulty? — a Gaussian on the model's own success rate, peaked at p★ = 0.2" },
      { sym: "N(q)", asks: "is it sufficiently novel? — 1 minus the max similarity against the task buffer" },
    ],
    note: "Given an environment or codebase, high-level instructions about the task type, and the model's own history of what it has already solved, the system proposes progressively harder tasks that go beyond that history. Difficulty is estimated from the current policy's rollouts, so the curriculum moves as the policy improves.",
  },
  {
    key: "scaffold",
    n: 2,
    title: "build a scaffold",
    produces: "a harness h",
    reward: "R_harness = C · F · H",
    color: GOOD,
    terms: [
      { sym: "C(q,h)", asks: "does the harness faithfully reflect the task specification?" },
      { sym: "F(h,{τ})", asks: "do its rewards track the true quality of candidate solutions?" },
      { sym: "H(h)", asks: "is it resistant to evaluator failures, shortcuts and reward hacking?" },
    ],
    note: "The scaffold is the instructions, tools, decomposition strategy and orchestration used to approach the problem. Learning it means the agent design is optimized alongside the policy instead of being fixed by whoever wrote the harness — and H is the term standing between that and the model designing its own easy grader.",
  },
  {
    key: "rollout",
    n: 3,
    title: "attempt it",
    produces: "rollouts τ",
    reward: "R_rollout = h(q, τ)",
    color: WARM,
    terms: [{ sym: "h(q,τ)", asks: "did the generated harness say the attempt succeeded?" }],
    note: "Conditioned on the task and the scaffold, the policy produces solution rollouts, scored directly by the harness the previous stage generated. For verifiable tasks this is binary pass or fail; for richer environments it can combine correctness, completion, efficiency and constraint satisfaction.",
  },
]

export function ImprovementLoop() {
  const [sel, setSel] = useState("task")
  const s = STAGES.find((x) => x.key === sel) ?? STAGES[0]

  const W = 720
  const H = 268
  const BOX_W = 300
  const BOX_H = 46
  const X0 = 208
  const Y0 = 56
  const GAP = 28
  const y = (i: number) => Y0 + i * (BOX_H + GAP)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          task generation, scaffold construction and rollouts — all three optimized with GRPO
        </span>
        <span className="font-mono text-[10px]" style={{ color: s.color }}>
          stage {s.n}: {s.title}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              A three-stage loop: propose a task, build a scaffold for it, attempt it. Reward from the attempt
              flows back to all three stages, and the solved-task history and novelty buffer feed forward into
              proposing the next one.
            </title>

            {/* inputs into stage 1 */}
            {[
              { l: "environment / codebase", yy: 14 },
              { l: "task-type instructions", yy: 28 },
              { l: "solve history", yy: 42 },
            ].map((inp) => (
              <g key={inp.l}>
                <text x={200} y={inp.yy} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="end" fontFamily="ui-monospace, monospace">
                  {inp.l}
                </text>
                <line x1={206} y1={inp.yy - 3} x2={X0 + 24} y2={Y0 - 4} stroke="currentColor" strokeOpacity={0.2} />
              </g>
            ))}

            {STAGES.map((st, i) => {
              const on = st.key === sel
              return (
                <g key={st.key} onClick={() => setSel(st.key)} style={{ cursor: "pointer" }}>
                  <rect
                    x={X0}
                    y={y(i)}
                    width={BOX_W}
                    height={BOX_H}
                    rx={7}
                    fill={st.color}
                    fillOpacity={on ? 0.22 : 0.09}
                    stroke={st.color}
                    strokeOpacity={on ? 1 : 0.4}
                    strokeWidth={on ? 2 : 1}
                  />
                  <circle cx={X0 + 20} cy={y(i) + BOX_H / 2} r={10} fill={st.color} fillOpacity={on ? 1 : 0.55} />
                  <text
                    x={X0 + 20}
                    y={y(i) + BOX_H / 2 + 4}
                    fontSize={11}
                    fill="#0c0a09"
                    textAnchor="middle"
                    fontFamily="ui-monospace, monospace"
                  >
                    {st.n}
                  </text>
                  <text x={X0 + 40} y={y(i) + 20} fontSize={11} fill="currentColor" fontFamily="ui-monospace, monospace">
                    {st.title}
                  </text>
                  <text x={X0 + 40} y={y(i) + 34} fontSize={9} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    produces {st.produces}
                  </text>
                  <text
                    x={X0 + BOX_W + 26}
                    y={y(i) + BOX_H / 2 + 4}
                    fontSize={9.5}
                    fill={st.color}
                    fillOpacity={on ? 1 : 0.6}
                    fontFamily="ui-monospace, monospace"
                  >
                    {st.reward}
                  </text>

                  {i < STAGES.length - 1 ? (
                    <>
                      <line
                        x1={X0 + BOX_W / 2}
                        y1={y(i) + BOX_H}
                        x2={X0 + BOX_W / 2}
                        y2={y(i + 1) - 7}
                        stroke="currentColor"
                        strokeOpacity={0.35}
                        strokeWidth={1.5}
                      />
                      <polygon
                        points={`${X0 + BOX_W / 2},${y(i + 1) - 1} ${X0 + BOX_W / 2 - 4},${y(i + 1) - 8} ${X0 + BOX_W / 2 + 4},${y(i + 1) - 8}`}
                        fill="currentColor"
                        fillOpacity={0.35}
                      />
                    </>
                  ) : null}
                </g>
              )
            })}

            {/* reward flowing back to every stage */}
            <path
              d={`M${X0 - 10},${y(2) + BOX_H / 2} L${X0 - 60},${y(2) + BOX_H / 2} L${X0 - 60},${y(0) + BOX_H / 2} L${X0 - 10},${y(0) + BOX_H / 2}`}
              fill="none"
              stroke={WARM}
              strokeWidth={1.75}
            />
            <polygon
              points={`${X0 - 2},${y(0) + BOX_H / 2} ${X0 - 10},${y(0) + BOX_H / 2 - 4} ${X0 - 10},${y(0) + BOX_H / 2 + 4}`}
              fill={WARM}
            />
            <line x1={X0 - 60} y1={y(1) + BOX_H / 2} x2={X0 - 10} y2={y(1) + BOX_H / 2} stroke={WARM} strokeWidth={1.75} />
            <polygon
              points={`${X0 - 2},${y(1) + BOX_H / 2} ${X0 - 10},${y(1) + BOX_H / 2 - 4} ${X0 - 10},${y(1) + BOX_H / 2 + 4}`}
              fill={WARM}
            />
            <text
              x={X0 - 66}
              y={y(1) + BOX_H / 2 - 8}
              fontSize={9}
              fill={WARM}
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
            >
              reward propagates
            </text>
            <text
              x={X0 - 66}
              y={y(1) + BOX_H / 2 + 4}
              fontSize={9}
              fill={WARM}
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
            >
              to all three stages
            </text>

            {/* the novelty buffer — parked below the R_task label so the two never collide */}
            <rect x={X0 + BOX_W + 34} y={y(0) + BOX_H + 4} width={148} height={30} rx={5} fill={MUTED} fillOpacity={0.12} stroke={MUTED} strokeOpacity={0.5} />
            <text x={X0 + BOX_W + 108} y={y(0) + BOX_H + 17} fontSize={9.5} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
              task buffer ℬ
            </text>
            <text x={X0 + BOX_W + 108} y={y(0) + BOX_H + 29} fontSize={7.5} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              already generated / trained on
            </text>
            <path
              d={`M${X0 + BOX_W + 34},${y(0) + BOX_H + 19} L${X0 + BOX_W + 16},${y(0) + BOX_H + 19} L${X0 + BOX_W + 16},${y(0) + BOX_H / 2 + 8}`}
              fill="none"
              stroke={MUTED}
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
            <polygon
              points={`${X0 + BOX_W + 16},${y(0) + BOX_H / 2 + 1} ${X0 + BOX_W + 12},${y(0) + BOX_H / 2 + 9} ${X0 + BOX_W + 20},${y(0) + BOX_H / 2 + 9}`}
              fill={MUTED}
            />

            <text x={4} y={H - 6} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              click a stage
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: s.color }}>
            {s.reward}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {s.terms.map((t) => (
              <div key={t.sym} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
                <span className="w-24 shrink-0 text-right text-foreground">{t.sym}</span>
                <span className="flex-1 text-muted-foreground">{t.asks}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{s.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read the two arrows on the left as the actual claim. Reward from a rollout does not just update the
          policy — it updates{" "}
          <span className="text-foreground">the thing that proposed the task and the thing that graded it</span>,
          so a task that produced useful learning signal makes the proposer more likely to produce tasks like it,
          and a harness that scored honestly makes the scaffold generator more likely to build harnesses like
          that.
          <br />
          <br />
          Both rewards are products of three terms rather than sums, and in both cases the third term is the
          adversarial one. On the task side, novelty stops the proposer farming variations of a single good
          problem. On the harness side, hack resistance is the only thing standing between &ldquo;the model
          designs its own grader&rdquo; and the obvious failure mode — and it is the term defined in a sentence
          and never measured.
        </p>
      </div>
    </figure>
  )
}
