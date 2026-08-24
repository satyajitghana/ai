"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"

// The reward that makes the curriculum move on its own.
//
// Ornith-1.5 has the model propose its own training tasks, so the proposer needs
// a reward. It is a product of three terms:
//
//   R_task = V(q,s) * D(q,s,{tau}) * N(q)
//
// V asks whether the generated task and its scaffold form a valid, verifiable
// learning environment — does the scaffold run, do high-confidence solutions
// pass, do clearly wrong ones fail. It is a hard gate: V = 0 zeroes the whole
// reward, so a malformed task cannot collect reward merely by looking difficult.
//
// D asks whether the task sits at the model's current capability frontier,
// estimated from the model's own rollouts:
//
//   p = (1/N) sum 1[rollout succeeded]
//   D = exp( -(p - p*)^2 / (2 sigma^2) ),  p* = 0.2
//
// N asks whether the task is new: 1 - max similarity against a buffer of tasks
// already generated or trained on.
//
// The multiplicative form is the design choice worth noticing. A sum would let a
// proposer trade novelty against validity; a product forces all three at once.
//
// The self-curricular part is D. As the policy improves and starts solving a task
// more reliably, p climbs past p* and the proposer's reward for that task FALLS,
// which pushes it toward harder problems without anyone adjusting a schedule.
//
// sigma is not published; it is a slider here, and the shape of the argument does
// not depend on its value. mexp because the curve reaches the DOM.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const PSTAR = 0.2

export function TaskReward() {
  const [p, setP] = useState(20)
  const [sigma, setSigma] = useState(15)
  const [valid, setValid] = useState(true)
  const [novelty, setNovelty] = useState(85)

  const pp = p / 100
  const sg = sigma / 100
  const D = mexp(-((pp - PSTAR) * (pp - PSTAR)) / (2 * sg * sg))
  const V = valid ? 1 : 0
  const N = novelty / 100
  const R = V * D * N

  const W = 720
  const H = 168
  const PAD = { l: 44, r: 96, t: 14, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const X = (v: number) => PAD.l + v * iw
  const Y = (v: number) => PAD.t + ih - v * ih

  const curve: string[] = []
  for (let i = 0; i <= 100; i++) {
    const x = i / 100
    const d = mexp(-((x - PSTAR) * (x - PSTAR)) / (2 * sg * sg))
    curve.push(`${i === 0 ? "M" : "L"}${X(x).toFixed(1)},${Y(d).toFixed(1)}`)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          R<sub>task</sub> = V(q,s) · D(q,s,{"{τ}"}) · N(q)
        </span>
        <span className="font-mono text-[10px]" style={{ color: R > 0.5 ? GOOD : WARM }}>
          reward {R.toFixed(3)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              The frontier-difficulty term as a Gaussian bump peaking at a twenty-per-cent rollout success rate,
              falling away toward both trivial and impossible tasks
            </title>
            {[0, 0.5, 1].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={0.1} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {g.toFixed(1)}
                </text>
              </g>
            ))}

            <path d={curve.join(" ")} fill="none" stroke={ACCENT} strokeWidth={2.5} />

            <line x1={X(PSTAR)} y1={PAD.t} x2={X(PSTAR)} y2={PAD.t + ih} stroke={GOOD} strokeDasharray="3 3" strokeOpacity={0.75} />
            <text x={X(PSTAR)} y={PAD.t - 2} fontSize={9} fill={GOOD} textAnchor="middle" fontFamily="ui-monospace, monospace">
              p★ = 0.2
            </text>

            <line x1={X(pp)} y1={PAD.t} x2={X(pp)} y2={PAD.t + ih} stroke={WARM} strokeWidth={1.5} />
            <circle cx={X(pp)} cy={Y(D)} r={4.5} fill={WARM} />
            <text
              x={Math.min(X(pp) + 6, W - PAD.r - 60)}
              y={Y(D) - 8}
              fontSize={9}
              fill={WARM}
              fontFamily="ui-monospace, monospace"
            >
              D = {D.toFixed(3)}
            </text>

            <text x={PAD.l + 4} y={PAD.t + ih - 6} fontSize={9} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              impossible
            </text>
            <text x={PAD.l + iw - 4} y={PAD.t + ih - 6} fontSize={9} fill="currentColor" fillOpacity={0.4} textAnchor="end" fontFamily="ui-monospace, monospace">
              trivial
            </text>

            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
              <text
                key={t}
                x={X(t)}
                y={PAD.t + ih + 14}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.45}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {t.toFixed(1)}
              </text>
            ))}
            <text x={PAD.l + iw / 2} y={H - 2} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              p — the model&rsquo;s own rollout success rate on the task it just proposed
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">success rate p</span>
            <Range min={0} max={100} step={1} value={p} onChange={(e) => setP(Number(e.target.value))} className="flex-1" aria-label="rollout success rate" accent={WARM} />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{p}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">σ (unpublished)</span>
            <Range min={5} max={40} step={1} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} className="flex-1" aria-label="width of the frontier band" accent={ACCENT} />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{(sigma / 100).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">novelty N</span>
            <Range min={0} max={100} step={1} value={novelty} onChange={(e) => setNovelty(Number(e.target.value))} className="flex-1" aria-label="novelty against the task buffer" accent={GOOD} />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{N.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={() => setValid((v) => !v)}
            aria-pressed={!valid}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-muted/20"
          >
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ background: valid ? GOOD : WARM }}
            />
            <span className="font-mono text-[10px] text-foreground">
              V = {V} — {valid ? "the scaffold runs and discriminates" : "malformed task or broken scaffold"}
            </span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 font-mono text-[11px]">
          <span style={{ color: valid ? GOOD : WARM }}>V {V.toFixed(2)}</span>
          <span className="text-muted-foreground">×</span>
          <span style={{ color: ACCENT }}>D {D.toFixed(3)}</span>
          <span className="text-muted-foreground">×</span>
          <span style={{ color: GOOD }}>N {N.toFixed(2)}</span>
          <span className="text-muted-foreground">=</span>
          <span className="text-foreground">{R.toFixed(3)}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {V === 0
              ? "the hard gate — a broken environment earns nothing, however hard it looks"
              : D < 0.2
                ? pp > PSTAR
                  ? "too easy now — the proposer is being pushed toward harder tasks"
                  : "too hard — not enough successful trajectories for RL to learn from"
                : "near the frontier"}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag <em>p</em>{" "}from 0.2 rightwards and watch the reward collapse. That is the self-curricular
          mechanism in one motion:{" "}
          <span className="text-foreground">as the policy gets better at a task, the reward for proposing that
          task falls</span>, so the generator is pushed toward harder problems without anyone writing a schedule.
          The curriculum evolves because difficulty is measured against the current model&rsquo;s own rollouts
          rather than against a fixed rubric.
          <br />
          <br />
          The target is 0.2, not 0.5, and the reason is stated plainly: challenging but still yielding{" "}
          <em>enough successful trajectories</em>{" "}for reinforcement learning to have signal. A task the model
          solves half the time is not at its frontier; a task it solves never produces no gradient at all.
          <br />
          <br />
          And the multiplication matters more than any of the three terms. Under a sum, a proposer could farm
          novelty by generating exotic nonsense, or farm difficulty by generating unsolvable tasks. The product,
          with validity as a hard zero, means a proposed task has to be{" "}
          <span className="text-foreground">valid and frontier-difficulty and new, simultaneously</span>, or it is
          worth nothing.
        </p>
      </div>
    </figure>
  )
}
