"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A 2-D flow-matching toy: why a teacher needs ~40 Euler steps, and what a
// few-step student is trained to do instead.
//
// Nothing here is Qwen-Image-2.1. It is the same maths at toy scale. The "data"
// is a mixture of three tight Gaussians in the plane (three kinds of picture a
// prompt allows), and the noising path is the rectified-flow one the Qwen
// scheduler uses: x_t = (1 - t) x0 + t eps, t = 1 is pure noise, t = 0 is data.
// For a Gaussian mixture the ideal velocity field is exact and closed-form:
//
//   v(x, t) = E[eps - x0 | x_t = x]
//           = sum_k w_k(x, t) * ( t r_k / var_k  -  mu_k  -  (1 - t) s^2 r_k / var_k )
//   var_k   = (1 - t)^2 s^2 + t^2,   r_k = x - (1 - t) mu_k
//   w_k     = softmax_k( -|r_k|^2 / (2 var_k) - log var_k )   (2-D Gaussian evidence)
//
// So the "teacher" here is perfect; the only error left is the sampler's. The
// sampler is Euler on the shifted schedule the Qwen-Image-2.1 pipeline uses at
// 1024 x 1024 (exponential shift e^mu = 2.0008, rounded to 2):
//   raw   = linspace(1, 1/N, N);   sigma = 2 raw / (1 + raw);   then 0.
// The reference endpoint is the same sampler at 400 steps.
//
// The "student" path is drawn as the straight line from the noise to the
// teacher's endpoint, which is what trajectory methods (reflow, consistency)
// aim for. DMD, which both releases use, matches the output distribution
// instead of this noise-to-image pairing, so a DMD student may land on a
// different mode for the same noise. The caption says so.
//
// Determinism: exp and log go through lib/dmath; everything else is + - * /
// and sqrt, which are exact. SVG coordinates are rounded to 0.01.

const MODES: [number, number][] = [
  [-1.7, 1.3],
  [1.8, 1.1],
  [0.1, -1.8],
]
const S = 0.18 // data spread per mode
const SEEDS: { label: string; x: [number, number] }[] = [
  { label: "noise A", x: [1.9, -0.9] },
  { label: "noise B", x: [-1.9, -1.2] },
  { label: "noise C", x: [-0.6, 1.9] },
]
const REF_STEPS = 400
const TEACHER_STEPS = 40 // Qwen-Image-2.1's documented default
const PRESETS = [40, 8, 6, 4, 1]

function velocity(x: number, y: number, t: number): [number, number] {
  const logw: number[] = []
  const ex: number[] = []
  const ey: number[] = []
  for (const [mx, my] of MODES) {
    const v = (1 - t) * (1 - t) * S * S + t * t
    const rx = x - (1 - t) * mx
    const ry = y - (1 - t) * my
    logw.push(-(rx * rx + ry * ry) / (2 * v) - mlog(v))
    // E[eps | k] - E[x0 | k]
    ex.push((t * rx) / v - (mx + ((1 - t) * S * S * rx) / v))
    ey.push((t * ry) / v - (my + ((1 - t) * S * S * ry) / v))
  }
  const m = Math.max(...logw)
  const w = logw.map((l) => mexp(l - m))
  const z = w.reduce((a, b) => a + b, 0)
  let vx = 0
  let vy = 0
  for (let k = 0; k < w.length; k++) {
    vx += (w[k] * ex[k]) / z
    vy += (w[k] * ey[k]) / z
  }
  return [vx, vy]
}

function schedule(n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const raw = n === 1 ? 1 : 1 - (i * (1 - 1 / n)) / (n - 1)
    out.push((2 * raw) / (1 + raw))
  }
  out.push(0)
  return out
}

function euler(start: [number, number], n: number): [number, number][] {
  const s = schedule(n)
  let [x, y] = start
  const pts: [number, number][] = [[x, y]]
  for (let i = 0; i < n; i++) {
    const [vx, vy] = velocity(x, y, s[i])
    const dt = s[i + 1] - s[i]
    x += dt * vx
    y += dt * vy
    pts.push([x, y])
  }
  return pts
}

// toy -> SVG
const W = 640
const H = 420
const SCALE = 88
const px = (x: number) => Math.round((W / 2 + x * SCALE) * 100) / 100
const py = (y: number) => Math.round((H / 2 - y * SCALE) * 100) / 100
const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")
const dist = (a: [number, number], b: [number, number]) =>
  Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]))

export function FlowToy() {
  const [steps, setSteps] = useState(6)
  const [seed, setSeed] = useState(0)
  const [cfg, setCfg] = useState(false)

  const start = SEEDS[seed].x
  const ref = useMemo(() => euler(start, REF_STEPS), [start])
  const end = ref[ref.length - 1]
  const teacher = useMemo(() => euler(start, steps), [start, steps])
  const landed = teacher[teacher.length - 1]
  const err = dist(landed, end)

  // the student's nodes, on the straight line, at the same sigmas
  const student = schedule(steps).map(
    (s) => [s * start[0] + (1 - s) * end[0], s * start[1] + (1 - s) * end[1]] as [number, number]
  )
  const mean: [number, number] = [
    (MODES[0][0] + MODES[1][0] + MODES[2][0]) / 3,
    (MODES[0][1] + MODES[1][1] + MODES[2][1]) / 3,
  ]

  const teacherPasses = TEACHER_STEPS * (cfg ? 2 : 1)
  const studentPasses = steps

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-flow-toy={`${steps}-${seed}-${cfg ? 1 : 0}`}
      aria-label="A two-dimensional flow-matching toy comparing Euler steps along a curved path with a distilled straight path"
    >
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">
            sampling steps, N
          </span>
          <Range
            min={1}
            max={40}
            step={1}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="number of sampling steps"
          />
          <span className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSteps(n)}
                aria-pressed={steps === n}
                className={cn(
                  "rounded-sm border px-2.5 py-0.5 font-mono text-xs tabular-nums",
                  steps === n
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </span>
        </label>
        <div>
          <span className="font-mono text-xs text-muted-foreground">
            starting noise
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SEEDS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setSeed(i)}
                aria-pressed={seed === i}
                className={cn(
                  "rounded-sm border px-2.5 py-0.5 font-mono text-xs",
                  seed === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Teacher Euler path at ${steps} steps landing ${err.toFixed(2)} units from the 400-step endpoint; straight student path landing on it.`}
      >
        {MODES.map(([mx, my], i) => (
          <g key={i}>
            <circle cx={px(mx)} cy={py(my)} r={Math.round(2 * S * SCALE)} className="fill-foreground/10" />
            <text
              x={px(mx)}
              y={py(my) + (my > 0 ? -38 : 50)}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[11px]"
            >
              {["picture kind 1", "picture kind 2", "picture kind 3"][i]}
            </text>
          </g>
        ))}
        {/* where one step from pure noise lands: the average of the modes */}
        <g className="stroke-muted-foreground" strokeWidth={1.5}>
          <line x1={px(mean[0]) - 5} y1={py(mean[1]) - 5} x2={px(mean[0]) + 5} y2={py(mean[1]) + 5} />
          <line x1={px(mean[0]) - 5} y1={py(mean[1]) + 5} x2={px(mean[0]) + 5} y2={py(mean[1]) - 5} />
        </g>
        <text x={px(mean[0]) + 9} y={py(mean[1]) + 4} className="fill-muted-foreground font-mono text-[11px]">
          average
        </text>

        {/* the fine reference path */}
        <polyline
          points={poly(ref.filter((_, i) => i % 4 === 0 || i === ref.length - 1))}
          fill="none"
          className="stroke-foreground/30"
          strokeWidth={2}
        />

        {/* the student: straight, same sigmas */}
        <g className="text-emerald-600 dark:text-emerald-400">
          <line
            x1={px(start[0])}
            y1={py(start[1])}
            x2={px(end[0])}
            y2={py(end[1])}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          {student.map(([x, y], i) => (
            <circle key={i} cx={px(x)} cy={py(y)} r={3} fill="currentColor" />
          ))}
        </g>

        {/* the teacher at N Euler steps */}
        <g className="text-foreground">
          <polyline points={poly(teacher)} fill="none" stroke="currentColor" strokeWidth={2} />
          {teacher.map(([x, y], i) => (
            <circle key={i} cx={px(x)} cy={py(y)} r={i === teacher.length - 1 ? 5 : 3} fill="currentColor" />
          ))}
          <circle
            cx={px(landed[0])}
            cy={py(landed[1])}
            r={Math.max(8, Math.round(err * SCALE))}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="2 3"
          />
        </g>

        <circle cx={px(start[0])} cy={py(start[1])} r={6} className="fill-background stroke-foreground" strokeWidth={2} />
        <text x={px(start[0]) + 10} y={py(start[1]) + 4} className="fill-foreground font-mono text-[11px]">
          noise
        </text>
      </svg>

      <div className="grid gap-x-6 gap-y-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-2">
        <span className="text-muted-foreground">
          teacher, {steps} Euler step{steps === 1 ? "" : "s"} (solid)
        </span>
        <span className="tabular-nums">
          lands {err.toFixed(2)} from the {REF_STEPS}-step endpoint
        </span>
        <span className="text-emerald-700 dark:text-emerald-400">student, {steps} steps (dashed)</span>
        <span className="tabular-nums">on the line by construction</span>
      </div>

      <div className="border-t px-4 py-3">
        <label className="flex items-center gap-2 font-mono text-xs">
          <input
            type="checkbox"
            checked={cfg}
            onChange={(e) => setCfg(e.target.checked)}
            className="accent-foreground"
          />
          classifier-free guidance on the {TEACHER_STEPS}-step teacher
        </label>
        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-2">
          <span className="text-muted-foreground">teacher forward passes</span>
          <span className="tabular-nums">
            {TEACHER_STEPS} x {cfg ? 2 : 1} = {teacherPasses}
          </span>
          <span className="text-muted-foreground">student forward passes</span>
          <span className="tabular-nums">
            {steps} x 1 = {studentPasses}
          </span>
          <span className="font-medium">ceiling on the speedup</span>
          <span className="font-medium tabular-nums">
            {(teacherPasses / studentPasses).toFixed(2)}x
          </span>
        </div>
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          {cfg
            ? "Guidance runs a second, unconditional pass every step. Qwen-Image 1.0's card did this at 50 steps: 100 passes an image. Qwen-Image-2.1's pipeline does not by default, so this box is the case that does not apply to it."
            : "Qwen-Image-2.1's pipeline default: true_cfg_scale = 1.0, one pass per step. The only thing a student can remove from this baseline is steps."}
        </p>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        A toy with an exact velocity field, so every error shown is the
        sampler&apos;s, not a model&apos;s. Steps follow the shift-2 schedule the
        Qwen-Image-2.1 pipeline computes at 1024 x 1024. At N = 1 the teacher
        lands on the average of the three modes: a blur. The dashed straight path
        is what trajectory methods (reflow, consistency) train toward; a DMD
        student matches the distribution instead, and may land on a different
        mode from the same noise.
      </figcaption>
    </figure>
  )
}
