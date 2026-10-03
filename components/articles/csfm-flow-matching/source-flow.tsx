"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A 2-D flow-matching toy whose only variable is the SOURCE distribution.
//
// Nothing here is a real image model. It is the same maths at toy scale, with
// an exact, closed-form velocity field, so every sampler error shown is the
// sampler's and not a model's. Six conditions each own a tight Gaussian target
// cluster on a ring (six kinds of picture a prompt could ask for). The data
// path is the flow-matching interpolant x_t = (1 - t) x0 + t x1, t = 0 the
// source, t = 1 the data; the velocity target is Delta = x1 - x0.
//
// Two source designs:
//   fixed    p0 = N(0, s0^2) for every condition      (the Gaussian everyone inherits)
//   learned  p0(.|C) = N(mu_C, ssrc^2), mu_C relocated next to target C
//            (an illustration of what CSFM's learned source converges to:
//             a condition-dependent blob that mirrors the target geometry)
//
// What the widget measures, all deterministic:
//   crossings   segment intersections among the drawn interpolants. Intrinsic
//               variance Var(Delta | x_t) vanishes exactly when interpolants do
//               not cross, so the crossing count is a direct proxy for it.
//   path length mean |x1 - x0| over the drawn pairs.
//   landing err how far N-step Euler on the EXACT marginal field lands from a
//               256-step reference, for one highlighted source point.
//   min steps   fewest Euler steps for that landing error to fall under 0.08.
//
// For a mixture of Gaussian source/target components with independent coupling,
// (x_t, Delta) is jointly Gaussian per component, so the marginal velocity
//   v(x,t) = sum_c w_c(x,t) * [ (m1_c - m0_c) + (Ctd_c / Vt_c)(x - mt_c) ]
//   Vt_c   = (1-t)^2 a2_c + t^2 b2_c,   Ctd_c = -(1-t) a2_c + t b2_c
//   w_c    = softmax_c( -|x - mt_c|^2 / (2 Vt_c) - log Vt_c )   (2-D evidence)
// is exact and cheap. exp and log go through lib/dmath; the rest is + - * / and
// sqrt, which are exact, and SVG coordinates are rounded to 0.01.

const K = 6
const R = 2.0 // target ring radius
const SD = 0.16 // target spread
const S0 = 0.9 // fixed source std, N(0, S0^2)
const RS = 1.15 // learned source mean radius
const SSRC = 0.42 // learned source std (VarReg keeps it near unit; kept modest here)
const M = 8 // interpolants drawn per condition
const TOL = 0.08 // "converged" landing tolerance, toy units
const REF_STEPS = 256
const PRESETS = [1, 2, 4, 8, 20]

const COND = ["#e8590c", "#2f9e44", "#1c7ed6", "#ae3ec9", "#f08c00", "#0ca678"]
const ANG = (k: number) => (2 * Math.PI * k) / K
const TARGET: [number, number][] = Array.from(
  { length: K },
  (_, k) => [R * mcos(ANG(k)), R * msin(ANG(k))] as [number, number]
)

// deterministic LCG -> standard normal via Box-Muller (mlog, mcos are det.)
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0x100000000
  }
}
function gauss(rng: () => number): number {
  const u1 = Math.max(1e-9, rng())
  const u2 = rng()
  return Math.sqrt(-2 * mlog(u1)) * mcos(2 * Math.PI * u2)
}

type Pair = { x0: number; y0: number; x1: number; y1: number; k: number }
function pairs(mode: "fixed" | "learned"): Pair[] {
  const rng = makeRng(20240517)
  const out: Pair[] = []
  for (let k = 0; k < K; k++) {
    const [tx, ty] = TARGET[k]
    const mx = RS * mcos(ANG(k))
    const my = RS * msin(ANG(k))
    for (let i = 0; i < M; i++) {
      const x1 = tx + SD * gauss(rng)
      const y1 = ty + SD * gauss(rng)
      const x0 = mode === "fixed" ? S0 * gauss(rng) : mx + SSRC * gauss(rng)
      const y0 = mode === "fixed" ? S0 * gauss(rng) : my + SSRC * gauss(rng)
      out.push({ x0, y0, x1, y1, k })
    }
  }
  return out
}

function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (cy - ay) * (bx - ax) - (by - ay) * (cx - ax)
}
function segCross(p: Pair, q: Pair) {
  const d1 = ccw(q.x0, q.y0, q.x1, q.y1, p.x0, p.y0)
  const d2 = ccw(q.x0, q.y0, q.x1, q.y1, p.x1, p.y1)
  const d3 = ccw(p.x0, p.y0, p.x1, p.y1, q.x0, q.y0)
  const d4 = ccw(p.x0, p.y0, p.x1, p.y1, q.x1, q.y1)
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0
}
function bundleStats(ps: Pair[]) {
  let crossings = 0
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) if (segCross(ps[i], ps[j])) crossings++
  let len = 0
  for (const p of ps) len += Math.sqrt((p.x1 - p.x0) ** 2 + (p.y1 - p.y0) ** 2)
  return { crossings, meanLen: len / ps.length }
}

type Comp = { m0: [number, number]; a2: number; m1: [number, number]; b2: number }
function components(mode: "fixed" | "learned"): Comp[] {
  return Array.from({ length: K }, (_, k) => {
    const m0: [number, number] =
      mode === "fixed" ? [0, 0] : [RS * mcos(ANG(k)), RS * msin(ANG(k))]
    const a2 = mode === "fixed" ? S0 * S0 : SSRC * SSRC
    return { m0, a2, m1: TARGET[k], b2: SD * SD }
  })
}
function velocity(x: number, y: number, t: number, cs: Comp[]): [number, number] {
  const logw: number[] = []
  const dx: number[] = []
  const dy: number[] = []
  for (const c of cs) {
    const mtx = (1 - t) * c.m0[0] + t * c.m1[0]
    const mty = (1 - t) * c.m0[1] + t * c.m1[1]
    const Vt = (1 - t) * (1 - t) * c.a2 + t * t * c.b2
    const rx = x - mtx
    const ry = y - mty
    logw.push(-(rx * rx + ry * ry) / (2 * Vt) - mlog(Vt))
    const Ctd = -(1 - t) * c.a2 + t * c.b2
    dx.push(c.m1[0] - c.m0[0] + (Ctd / Vt) * rx)
    dy.push(c.m1[1] - c.m0[1] + (Ctd / Vt) * ry)
  }
  const mmax = Math.max(...logw)
  const w = logw.map((l) => mexp(l - mmax))
  const z = w.reduce((a, b) => a + b, 0)
  let vx = 0
  let vy = 0
  for (let i = 0; i < w.length; i++) {
    vx += (w[i] * dx[i]) / z
    vy += (w[i] * dy[i]) / z
  }
  return [vx, vy]
}
function euler(start: [number, number], n: number, cs: Comp[]): [number, number][] {
  let [x, y] = start
  const pts: [number, number][] = [[x, y]]
  for (let i = 0; i < n; i++) {
    const [vx, vy] = velocity(x, y, i / n, cs)
    const dt = 1 / n
    x += dt * vx
    y += dt * vy
    pts.push([x, y])
  }
  return pts
}
const d2 = (a: [number, number], b: [number, number]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

// representative source draws per mode; both flow to a target on the ring
const SEEDS: Record<"fixed" | "learned", [number, number][]> = {
  fixed: [
    [0.55, 0.32],
    [-0.62, 0.18],
    [0.12, -0.7],
  ],
  learned: [
    [1.4, 0.3],
    [-0.67, 1.2],
    [-0.58, -1.1],
  ],
}

// toy -> SVG
const W = 640
const H = 470
const SCALE = 96
const px = (x: number) => Math.round((W / 2 + x * SCALE) * 100) / 100
const py = (y: number) => Math.round((H / 2 - y * SCALE) * 100) / 100

export function SourceFlow() {
  const [mode, setMode] = useState<"fixed" | "learned">("fixed")
  const [steps, setSteps] = useState(4)
  const [seedIx, setSeedIx] = useState(0)

  const ps = useMemo(() => pairs(mode), [mode])
  const stats = useMemo(() => bundleStats(ps), [ps])
  const cs = useMemo(() => components(mode), [mode])

  const start = SEEDS[mode][seedIx]
  const ref = useMemo(() => euler(start, REF_STEPS, cs), [start, cs])
  const end = ref[ref.length - 1]
  const traj = useMemo(() => euler(start, steps, cs), [start, steps, cs])
  const landed = traj[traj.length - 1]
  const err = d2(landed, end)

  const minSteps = useMemo(() => {
    for (let n = 1; n <= 40; n++) {
      const p = euler(start, n, cs)
      if (d2(p[p.length - 1], end) < TOL) return n
    }
    return 40
  }, [start, cs, end])

  const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-source-flow={`${mode}-${steps}-${seedIx}`}
      aria-label="A two-dimensional flow-matching toy comparing a fixed Gaussian source with a learned condition-dependent source"
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b px-4 py-4">
        <div>
          <span className="font-mono text-xs text-muted-foreground">source distribution</span>
          <div className="mt-2 flex gap-2">
            {(["fixed", "learned"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-sm border px-2.5 py-0.5 font-mono text-xs",
                  mode === m
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "fixed" ? "fixed N(0, I)" : "learned p(x0 | C)"}
              </button>
            ))}
          </div>
        </div>
        <label className="block min-w-[12rem] flex-1">
          <span className="font-mono text-xs text-muted-foreground">Euler steps, N</span>
          <Range
            min={1}
            max={40}
            step={1}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="number of Euler sampling steps"
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
          <span className="font-mono text-xs text-muted-foreground">source sample</span>
          <div className="mt-2 flex gap-2">
            {["A", "B", "C"].map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeedIx(i)}
                aria-pressed={seedIx === i}
                className={cn(
                  "rounded-sm border px-2.5 py-0.5 font-mono text-xs",
                  seedIx === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${mode === "fixed" ? "Fixed Gaussian source" : "Learned condition-dependent source"}: ${stats.crossings} interpolant crossings, mean path length ${stats.meanLen.toFixed(2)}; ${steps}-step Euler lands ${err.toFixed(2)} from the reference.`}
      >
        {/* source region */}
        {mode === "fixed" ? (
          <circle
            cx={px(0)}
            cy={py(0)}
            r={Math.round(S0 * SCALE)}
            className="fill-foreground/[0.04] stroke-muted-foreground/50"
            strokeDasharray="4 4"
          />
        ) : (
          TARGET.map((_, k) => (
            <circle
              key={k}
              cx={px(RS * mcos(ANG(k)))}
              cy={py(RS * msin(ANG(k)))}
              r={Math.round(SSRC * SCALE)}
              className="fill-foreground/[0.04] stroke-muted-foreground/50"
              strokeDasharray="4 4"
            />
          ))
        )}

        {/* interpolant bundles, faint, coloured by condition */}
        <g strokeWidth={0.75} opacity={0.5}>
          {ps.map((p, i) => (
            <line
              key={i}
              x1={px(p.x0)}
              y1={py(p.y0)}
              x2={px(p.x1)}
              y2={py(p.y1)}
              stroke={COND[p.k]}
            />
          ))}
        </g>

        {/* target clusters */}
        {TARGET.map(([tx, ty], k) => (
          <circle key={k} cx={px(tx)} cy={py(ty)} r={Math.round(2 * SD * SCALE)} fill={COND[k]} fillOpacity={0.9} />
        ))}

        {/* 256-step reference for the highlighted sample */}
        <polyline
          points={poly(ref.filter((_, i) => i % 8 === 0 || i === ref.length - 1))}
          fill="none"
          className="stroke-foreground/25"
          strokeWidth={2}
        />

        {/* N-step Euler trajectory */}
        <g className="text-foreground">
          <polyline points={poly(traj)} fill="none" stroke="currentColor" strokeWidth={2.25} />
          {traj.map(([x, y], i) => (
            <circle key={i} cx={px(x)} cy={py(y)} r={i === traj.length - 1 ? 4.5 : 2.5} fill="currentColor" />
          ))}
          <circle
            cx={px(landed[0])}
            cy={py(landed[1])}
            r={Math.max(6, Math.round(err * SCALE))}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeDasharray="2 3"
          />
        </g>

        <circle cx={px(start[0])} cy={py(start[1])} r={5.5} className="fill-background stroke-foreground" strokeWidth={2} />
        <text x={px(start[0]) + 9} y={py(start[1]) + 4} className="fill-foreground font-mono text-[11px]">
          x0
        </text>
      </svg>

      <div className="grid gap-x-6 gap-y-1 border-t px-4 py-3 font-mono text-xs tabular-nums sm:grid-cols-2">
        <span className="text-muted-foreground">interpolant crossings (intrinsic-variance proxy)</span>
        <span className={mode === "learned" ? "text-emerald-700 dark:text-emerald-400" : ""}>
          {stats.crossings}
        </span>
        <span className="text-muted-foreground">mean path length, |x1 - x0|</span>
        <span className={mode === "learned" ? "text-emerald-700 dark:text-emerald-400" : ""}>
          {stats.meanLen.toFixed(2)}
        </span>
        <span className="text-muted-foreground">sample {["A", "B", "C"][seedIx]}: lands at N = {steps}</span>
        <span>{err.toFixed(2)} from the {REF_STEPS}-step endpoint</span>
        <span className="text-muted-foreground">min Euler steps to land within {TOL}</span>
        <span className={minSteps <= 4 ? "text-emerald-700 dark:text-emerald-400" : ""}>{minSteps}</span>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        An illustrative toy with an exact velocity field, so every sampler error is real, not a model&apos;s. Six
        conditions, each a target cluster on the ring. The fixed source is one Gaussian at the origin shared by all
        conditions; interpolants from it fan across the plane and cross heavily, and the marginal field bends, so Euler
        needs many steps. The learned source relocates a blob next to each condition&apos;s target, the way CSFM&apos;s
        learned source mirrors the target geometry: short, local, mostly parallel paths, and Euler converges in a handful
        of steps. The crossing count is a proxy for the intrinsic-variance term, which vanishes exactly when interpolants
        do not cross. The measured image-model numbers are in the tables below, not here.
      </figcaption>
    </figure>
  )
}
