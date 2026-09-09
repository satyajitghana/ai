"use client"

import { useMemo, useState } from "react"

import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// scale_rewards="group" divides every advantage by its own group's standard
// deviation: advantage / (std + 1e-4). As a policy converges on a task, eight
// rollouts of it agree more, std shrinks, and 1/std grows -- the same reward
// gap gets pushed harder every step it survives. Whether that runs away
// depends on what a "group" actually spans, which is set by how many distinct
// tasks land in one optimizer step (tasks_per_step, i.e. gradient
// accumulation): at 1, the group's std IS the within-task spread over eight
// samples of the same location, which can collapse to near zero; at 2+, the
// group also spans the gap BETWEEN two different tasks' rewards, which does
// not collapse just because the policy is confident on either one.
//
// Every number below is read from runs-std.json (the per-step std/grad/zero
// series behind HuggingFace's own d3-amplification.html) and independently
// re-binned here, not eyeballed off their chart:
//   run 1  (1 task/step):  median std 0.0155  ->  1/std = 64.5   n=1000 steps
//   run 2  (2 tasks/step): median std 0.1926  ->  1/std = 5.2    n=367 steps
//   run 3  (2 tasks/step,
//           group scaling back on): median std 0.0776 -> 1/std = 12.9, n=304
// Run 3 is the useful third point: same tasks_per_step as run 2, but with
// scale_rewards restored to "group". Its distribution below sits between the
// other two -- most steps behave like run 2, but ~7% still collapse into
// run 1's regime, versus run 1's 32%. Pooling two tasks makes the collapse
// rare, not impossible.
//
// Histograms: 16 log-spaced bins from std=0.003 to 1.0, fraction of that run's
// training steps landing in each bin.

type RunKey = "run1" | "run2" | "run3"

const RUNS: Record<
  RunKey,
  { label: string; tasksPerStep: number; median: number; n: number; color: string; hist: number[] }
> = {
  run1: {
    label: "run 1 · 1 task/step",
    tasksPerStep: 1,
    median: 0.0155,
    n: 1000,
    color: "oklch(0.62 0.16 25)",
    hist: [0.322, 0.048, 0.05, 0.05, 0.068, 0.058, 0.075, 0.053, 0.066, 0.051, 0.042, 0.037, 0.069, 0.011, 0, 0],
  },
  run2: {
    label: "run 2 · 2 tasks/step",
    tasksPerStep: 2,
    median: 0.1926,
    n: 367,
    color: "oklch(0.58 0.15 255)",
    hist: [0, 0, 0, 0, 0, 0, 0.0082, 0.0191, 0.0436, 0.1144, 0.2044, 0.297, 0.2561, 0.0572, 0, 0],
  },
  run3: {
    label: "run 3 · 2 tasks/step, group scaling restored",
    tasksPerStep: 2,
    median: 0.0776,
    n: 304,
    color: "oklch(0.68 0.14 145)",
    hist: [0.0691, 0.023, 0.0362, 0.0329, 0.0296, 0.0493, 0.0757, 0.0921, 0.0954, 0.1349, 0.0855, 0.1283, 0.1086, 0.0395, 0, 0],
  },
}
const ORDER: RunKey[] = ["run1", "run2", "run3"]

const STD_LO = 0.003
const STD_HI = 1.0
const N_BINS = 16
const binEdges = Array.from({ length: N_BINS + 1 }, (_, i) =>
  mexp(mlog(STD_LO) + ((mlog(STD_HI) - mlog(STD_LO)) * i) / N_BINS)
)

const W = 720
const CURVE_H = 150
const HIST_ROW_H = 34
const padL = 46
const padR = 14
const padT = 16
const padCurveB = 24
const padHistB = 26

export function AdvantageAmplification() {
  const [active, setActive] = useState<Set<RunKey>>(new Set(["run1", "run2"]))

  const histTop = padT + CURVE_H + padCurveB
  const activeList = ORDER.filter((k) => active.has(k))
  const H = histTop + Math.max(1, activeList.length) * HIST_ROW_H + padHistB

  const sx = (std: number) => {
    const t = (mlog(std) - mlog(STD_LO)) / (mlog(STD_HI) - mlog(STD_LO))
    return padL + Math.min(1, Math.max(0, t)) * (W - padL - padR)
  }
  // curve panel: y = 1/std, log-log, 1 to 300
  const MULT_LO = 1
  const MULT_HI = 300
  const sy = (mult: number) => {
    const t = (mlog(mult) - mlog(MULT_LO)) / (mlog(MULT_HI) - mlog(MULT_LO))
    return padT + (1 - Math.min(1, Math.max(0, t))) * CURVE_H
  }

  const curvePath = useMemo(() => {
    const pts: string[] = []
    const STEPS = 100
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS
      const std = mexp(mlog(STD_LO) + (mlog(STD_HI) - mlog(STD_LO)) * t)
      pts.push(`${sx(std)},${sy(1 / std)}`)
    }
    return pts.join(" ")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (k: RunKey) =>
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const chip = (k: RunKey) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-left font-mono text-[11px] transition-colors",
      active.has(k)
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          advantage multiplier 1/std, and how often each run hit it
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ORDER.map((k) => (
            <button key={k} type="button" onClick={() => toggle(k)} className={chip(k)}>
              {RUNS[k].label}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A log-log curve of the GRPO advantage multiplier 1 over group standard deviation, with each selected run's median marked, and below it a histogram of how often that run's training steps saw each group standard deviation. Run 1, one task per optimizer step, spends about a third of its steps at a near-collapsed standard deviation implying a multiplier above 60. Run 2, two tasks per step, never collapses that far and stays around a multiplier of 5."
        >
          {/* curve panel gridlines (y = multiplier) */}
          {[1, 5, 10, 50, 100].map((m) => (
            <g key={m}>
              <line x1={padL} y1={sy(m)} x2={W - padR} y2={sy(m)} stroke="currentColor" strokeOpacity={0.07} />
              <text x={padL - 6} y={sy(m) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="8.5">
                {m}&times;
              </text>
            </g>
          ))}
          <text x={14} y={padT + 4} className="fill-muted-foreground/70 font-mono" fontSize="8.5">
            multiplier
          </text>

          <polyline points={curvePath} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.6} />

          {activeList.map((k) => {
            const r = RUNS[k]
            const x = sx(r.median)
            const y = sy(1 / r.median)
            return (
              <g key={k}>
                <line x1={x} y1={padT} x2={x} y2={histTop} stroke={r.color} strokeOpacity={0.45} strokeDasharray="3 3" />
                <circle cx={x} cy={y} r={4} fill={r.color} />
                <text x={x + 5} y={Math.max(padT + 9, y - 5)} className="font-mono" fontSize="8.5" fill={r.color}>
                  {(1 / r.median).toFixed(1)}&times;
                </text>
              </g>
            )
          })}

          {/* x axis ticks, shared by curve + histograms, sitting just above the first histogram row */}
          {[0.003, 0.01, 0.03, 0.1, 0.3, 1].map((s) => (
            <text key={s} x={sx(s)} y={histTop - 6} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="8">
              {s}
            </text>
          ))}

          {/* histogram rows */}
          {activeList.map((k, rowIdx) => {
            const r = RUNS[k]
            const rowY = histTop + rowIdx * HIST_ROW_H
            const baseline = rowY + HIST_ROW_H - 8
            return (
              <g key={k}>
                <text x={padL} y={rowY + 8} className="fill-muted-foreground font-mono" fontSize="8.5">
                  {r.label} · median std {r.median} · n={r.n} steps
                </text>
                {r.hist.map((frac, i) => {
                  const x0 = sx(Math.max(STD_LO, binEdges[i]))
                  const x1 = sx(Math.min(STD_HI, binEdges[i + 1]))
                  const barH = Math.max(0.5, frac * (HIST_ROW_H - 12) * 3)
                  return (
                    <rect
                      key={i}
                      x={x0}
                      y={baseline - barH}
                      width={Math.max(0.6, x1 - x0 - 0.5)}
                      height={barH}
                      fill={r.color}
                      opacity={0.75}
                    />
                  )
                })}
                <line x1={padL} y1={baseline} x2={W - padR} y2={baseline} stroke="currentColor" strokeOpacity={0.12} />
              </g>
            )
          })}

          <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">
            per-step group standard deviation of the reward (log scale)
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Run 1&rsquo;s group std is the spread of eight rollouts of the <em>same</em> task, and it
          collapses: 32% of its steps sit in the lowest bin, implying a multiplier past 60&times;,
          with a measured ceiling near 10,000&times; when a group agrees exactly. Add a second task
          per step (run 2) and the group std also has to span the gap <em>between</em> two different
          tasks&rsquo; rewards, which a converging policy cannot shrink to zero &mdash; its
          distribution sits entirely above run 1&rsquo;s collapse zone. Run 3 keeps two tasks per
          step but turns <code>scale_rewards</code> back to <code>&quot;group&quot;</code>: the
          amplification comes back, just rarer &mdash; about 7% of its steps, not 32%.
        </p>
      </div>
    </figure>
  )
}
