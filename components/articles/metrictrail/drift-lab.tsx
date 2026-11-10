"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { DRIFT, MARKS, type Mode } from "./data"

// My toy of MetricTrail's core trick, run on CPU (numpy). MEASURED, but on a toy, not on KITTI.
// A planar, DPVO-shaped estimator: 16 patches per frame, each a fixed pixel plus one optimisable
// inverse depth; a 12-frame window whose 10 newest poses are free and 2 oldest fixed; 4 Gauss-Newton
// steps per frame on reprojection error (1 px noise). Three ways to give a new patch its depth:
//   median  DPVO's rule: the median inverse depth of the previous three frames' patches
//   init    the noisy "single-image metric depth" (10% per patch, 5% per frame, 5% gross outliers)
//   prior   the same init, kept as a Huber log-inverse-depth factor (lambda 1, delta 0.3, after frame 12)
// Trajectory: 3,000 frames, about 3 km, one seed. ATE = RMSE after one Sim(2) alignment of the prefix.
// The path drawn is the raw estimate, not aligned, so scale drift shows as a stretched or shrunken path.

const MODES: { id: Mode; label: string; color: string }[] = [
  { id: "median", label: "median seed (DPVO)", color: "oklch(0.64 0.17 35)" },
  { id: "init", label: "metric init only", color: "oklch(0.7 0.12 85)" },
  { id: "prior", label: "init + kept as factor", color: "oklch(0.62 0.15 150)" },
]

const W = 420
const H = 340
const PAD = 14

export function DriftLab() {
  const [mode, setMode] = useState<Mode>("prior")
  const [upto, setUpto] = useState(3000)
  const run = DRIFT.traj[mode]
  const n = Math.max(2, Math.round((upto / 3000) * (run.gt.length - 1)) + 1)

  // fit the ground-truth path; estimates that drift outside are clipped by the viewBox
  const xs = DRIFT.traj.prior.gt.map((p) => p[0])
  const zs = DRIFT.traj.prior.gt.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const z0 = Math.min(...zs)
  const z1 = Math.max(...zs)
  const span = Math.max(x1 - x0, z1 - z0) * 1.15
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const sx = (x: number) => PAD + ((x - cx) / span + 0.5) * (W - 2 * PAD)
  const sz = (z: number) => H - PAD - ((z - cz) / span + 0.5) * (H - 2 * PAD)
  const line = (pts: number[][]) =>
    pts
      .slice(0, n)
      .map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sz(p[1]).toFixed(1)}`)
      .join(" ")
  const seen = MARKS.filter((m) => m <= upto)
  const mark = seen.length ? seen[seen.length - 1] : MARKS[0]
  const col = MODES.find((m) => m.id === mode)!.color
  const maxAte = Math.max(...MODES.map((m) => DRIFT.ate[m.id][mark]))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        a toy DPVO in the plane, 3,000 frames · measured on my CPU, one seed drawn, three seeds averaged in the bars
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded bg-muted/30"
          role="img"
          aria-label={`Top-down view of a 3 km ground-truth path in grey and the toy estimator's raw path in colour, for the ${mode} depth rule, after ${upto} frames. Trajectory error after alignment at ${mark} frames: ${DRIFT.ate[mode][mark].toFixed(1)} m.`}
        >
          <defs>
            <clipPath id="mt-drift-clip">
              <rect x={0} y={0} width={W} height={H} />
            </clipPath>
          </defs>
          <g clipPath="url(#mt-drift-clip)">
            <path d={line(run.gt)} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" />
            <path d={line(run.est)} fill="none" stroke={col} strokeWidth={1.8} />
            <circle cx={sx(run.gt[0][0])} cy={sz(run.gt[0][1])} r={4} fill="var(--foreground)" />
          </g>
          <text x={PAD} y={H - 6} fontSize={10} className="fill-muted-foreground font-mono">
            grey: ground truth · colour: raw estimate (not aligned)
          </text>
        </svg>
        <div className="space-y-3 text-sm">
          <div className="flex flex-col gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center gap-2 rounded border px-2 py-1 text-left font-mono text-xs",
                  m.id === mode ? "border-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                {m.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">frames processed = {upto}</span>
            <Range min={250} max={3000} step={50} value={upto} onChange={(e) => setUpto(Number(e.target.value))} accent={col} />
          </label>
          <div className="space-y-1.5">
            <div className="font-mono text-xs text-muted-foreground">ATE after {mark} frames, mean of 3 seeds</div>
            {MODES.map((m) => {
              const v = DRIFT.ate[m.id][mark]
              return (
                <div key={m.id} className="grid grid-cols-[1fr_4.5rem] items-center gap-2">
                  <div className="h-3 rounded-sm bg-muted">
                    <div className="h-3 rounded-sm" style={{ width: `${((v / maxAte) * 100).toFixed(2)}%`, background: m.color }} />
                  </div>
                  <span className="text-right font-mono text-xs">{v.toFixed(1)} m</span>
                </div>
              )
            })}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            Sim(2) scale needed at {mark} frames: {MODES.map((m) => `${DRIFT.scale[m.id][mark].toFixed(2)}`).join(" / ")}
          </div>
        </div>
      </div>
    </figure>
  )
}
