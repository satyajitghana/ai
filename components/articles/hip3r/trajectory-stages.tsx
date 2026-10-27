"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { RUN } from "./data"

// Top-down view of ONE simulated run (seed 0): the ground-truth two-lap loop and the trajectory each stage of our
// simplified re-implementation recovers, after a Sim(3) fit to ground truth. MEASURED on a synthetic backend,
// not the authors' pipeline and not real video. Numbers under the tabs: this seed, then the mean over all seeds.

const STAGES = [
  { id: "1 chain", label: "Chain only", blurb: "each chunk aligned to the previous one through its overlap; nothing closes the loop" },
  { id: "2 + loops, all at once", label: "+ all loops", blurb: "every loop edge switched on together, solved from the chain" },
  { id: "3 + loops, progressive", label: "+ progressive loops", blurb: "loops enter shortest first, a third at a time" },
  { id: "4 shared", label: "+ shared camera", blurb: "one SE(3) pose per frame under that layout, priors plus motion edges" },
] as const

const COL = ["oklch(0.62 0.19 28)", "oklch(0.68 0.15 75)", "oklch(0.62 0.13 250)", "oklch(0.62 0.15 150)"]

const W = 520
const H = 400

const all = RUN.gt as number[][]
const xs = all.map((p) => p[0])
const ys = all.map((p) => p[1])
const pad = 40
const x0 = Math.min(...xs) - pad
const x1 = Math.max(...xs) + pad
const y0 = Math.min(...ys) - pad
const y1 = Math.max(...ys) + pad
const sc = Math.min(W / (x1 - x0), H / (y1 - y0))
const ox = (W - (x1 - x0) * sc) / 2
const oy = (H - (y1 - y0) * sc) / 2
const poly = (pts: number[][]) => pts.map((p) => `${(ox + (p[0] - x0) * sc).toFixed(1)},${(oy + (y1 - p[1]) * sc).toFixed(1)}`).join(" ")

export function TrajectoryStages() {
  const [i, setI] = useState(0)
  const s = STAGES[i]
  const first = RUN.first[s.id as keyof typeof RUN.first] as { ate: number }
  const mean = RUN.summary[s.id as keyof typeof RUN.summary]
  const traj = RUN.traj[s.id as keyof typeof RUN.traj] as number[][]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured · synthetic 800-frame, two-lap trajectory · our simplified re-implementation, not HiP3R&apos;s code
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3" role="tablist" aria-label="Stage">
        {STAGES.map((x, k) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={i === k}
            onClick={() => setI(k)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              i === k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-[1.4fr_1fr]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded bg-muted/30"
          role="img"
          aria-label={`Top-down view of a simulated two-lap trajectory. Dashed line: ground truth. Solid line: ${s.label}. Absolute trajectory error for this seed ${first.ate.toFixed(2)} metres.`}
        >
          <polyline points={poly(RUN.gt as number[][])} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="5 4" />
          <polyline points={poly(traj)} fill="none" stroke={COL[i]} strokeWidth={2} strokeLinejoin="round" />
        </svg>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{s.blurb}.</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">ATE, this run</dt>
            <dd className="text-right tabular-nums">{first.ate.toFixed(2)} m</dd>
            <dt className="text-muted-foreground">ATE, mean of {RUN.seeds}</dt>
            <dd className="text-right tabular-nums">{mean.ate[0].toFixed(2)} m</dd>
            <dt className="text-muted-foreground">range over seeds</dt>
            <dd className="text-right tabular-nums">
              {mean.ate[1].toFixed(2)} to {mean.ate[2].toFixed(2)}
            </dd>
            <dt className="text-muted-foreground">RPE rot, mean</dt>
            <dd className="text-right tabular-nums">{mean.rpe_rot[0].toFixed(3)} deg</dd>
            <dt className="text-muted-foreground">RPE trans, mean</dt>
            <dd className="text-right tabular-nums">{mean.rpe_trans[0].toFixed(3)} m</dd>
          </dl>
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        Dashed: ground truth. Both laps trace the same curve, so the second lap should lie on the first; the chain leaves them apart.
      </figcaption>
    </figure>
  )
}
