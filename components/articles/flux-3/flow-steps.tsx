"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// A flow model learns a velocity field v_θ(x,t) that transports a NOISE sample
// (t=0) into a DATA sample (t=1); generation is just integrating that ODE. FLUX's
// rectified-flow lineage *straightens* those transport paths so a handful of Euler
// steps land on the data. A straight (constant) field integrates EXACTLY at any
// step count — error 0. A curved field leaves a ~1/K integration error: with few
// steps the polyline cuts the corner and misses. Scrub the step count and the
// denoising time, and flip straight vs curved. Trajectories and field are
// illustrative — the geometry (straight = few-step-exact) is the real point.

const ACCENT = "oklch(0.60 0.14 160)"
const MISS = "oklch(0.62 0.18 25)"

const W = 760
const H = 360

type Pt = [number, number]

const SAMPLES: { p0: Pt; p1: Pt; bend: number }[] = [
  { p0: [96, 66], p1: [664, 92], bend: 1 },
  { p0: [78, 150], p1: [676, 158], bend: -1 },
  { p0: [104, 236], p1: [662, 250], bend: 1 },
  { p0: [86, 312], p1: [670, 300], bend: -1 },
]
const BEND = 92 // curvature magnitude for "curved" mode
const NOISE: Pt[] = [
  [-15, -9], [11, -17], [-21, 7], [7, 15], [17, 4], [-9, 19], [21, -7], [-16, -19],
]

const r2 = (n: number) => Number(n.toFixed(2))

function control(p0: Pt, p1: Pt, curved: boolean, bend: number): Pt {
  const mx = (p0[0] + p1[0]) / 2
  const my = (p0[1] + p1[1]) / 2
  if (!curved) return [mx, my]
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  return [mx + nx * BEND * bend, my + ny * BEND * bend]
}

// velocity of quadratic bezier B(t) with control C: B'(t) = 2(1-t)(C-P0) + 2t(P1-C)
function vel(p0: Pt, c: Pt, p1: Pt, t: number): Pt {
  const a = 2 * (1 - t)
  const b = 2 * t
  return [a * (c[0] - p0[0]) + b * (p1[0] - c[0]), a * (c[1] - p0[1]) + b * (p1[1] - c[1])]
}

function eulerPath(p0: Pt, c: Pt, p1: Pt, K: number): Pt[] {
  const pts: Pt[] = [p0]
  let x = p0[0]
  let y = p0[1]
  const h = 1 / K
  for (let k = 0; k < K; k++) {
    const [vx, vy] = vel(p0, c, p1, k / K)
    x += h * vx
    y += h * vy
    pts.push([x, y])
  }
  return pts
}

function posAt(euler: Pt[], t: number): Pt {
  const K = euler.length - 1
  const seg = Math.min(K - 1e-4, Math.max(0, t) * K)
  const i = Math.floor(seg)
  const f = seg - i
  const a = euler[i]
  const b = euler[Math.min(K, i + 1)]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

export function FlowSteps() {
  const [curved, setCurved] = useState(false)
  const [K, setK] = useState(4)
  const [t, setT] = useState(1)

  const paths = SAMPLES.map((s) => {
    const c = control(s.p0, s.p1, curved, s.bend)
    const euler = eulerPath(s.p0, c, s.p1, K)
    const end = euler[euler.length - 1]
    const err = Math.hypot(end[0] - s.p1[0], end[1] - s.p1[1])
    return { s, c, euler, end, err }
  })
  const meanErr = paths.reduce((a, p) => a + p.err, 0) / paths.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>flow matching · integrate noise → data in K steps</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Denoising trajectories from a noise cloud on the left to data points on the right, integrated with ${K} Euler steps in ${curved ? "curved" : "straight"} mode; mean endpoint miss ${meanErr.toFixed(1)} pixels`}
        >
          <defs>
            <marker id="fs-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="fs-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* region labels */}
          <text x={40} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
            noise · t = 0
          </text>
          <text x={W - 40} y={26} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>
            data · t = 1
          </text>

          {/* noise cloud around each start point */}
          {paths.map((p, i) =>
            NOISE.map((o, j) => (
              <circle
                key={`n-${i}-${j}`}
                cx={r2(p.s.p0[0] + o[0])}
                cy={r2(p.s.p0[1] + o[1])}
                r={1.4}
                className="fill-muted-foreground"
                opacity={0.28}
              />
            )),
          )}

          {paths.map((p, i) => {
            const [p0x, p0y] = p.s.p0
            const [p1x, p1y] = p.s.p1
            const [cx, cy] = p.c
            const missed = p.err > 6
            const d = `M ${r2(p0x)} ${r2(p0y)} ` + p.euler.slice(1).map((q) => `L ${r2(q[0])} ${r2(q[1])}`).join(" ")
            const cur = posAt(p.euler, t)
            return (
              <g key={`s-${i}`}>
                {/* true continuous path (target trajectory) */}
                <path
                  d={`M ${r2(p0x)} ${r2(p0y)} Q ${r2(cx)} ${r2(cy)} ${r2(p1x)} ${r2(p1y)}`}
                  fill="none"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.25}
                  strokeDasharray="3 4"
                  opacity={0.4}
                />
                {/* K-step Euler polyline */}
                <path
                  d={d}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={1.75}
                  markerEnd="url(#fs-arrow)"
                  className="transition-all duration-200"
                  opacity={0.95}
                />
                {/* step vertices */}
                {p.euler.slice(1, -1).map((q, k) => (
                  <circle key={`v-${i}-${k}`} cx={r2(q[0])} cy={r2(q[1])} r={2.1} fill={ACCENT} opacity={0.85} />
                ))}
                {/* start (noise) marker */}
                <circle cx={r2(p0x)} cy={r2(p0y)} r={3.4} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={1.4} />
                {/* data target (open) + where integration actually lands */}
                <circle cx={r2(p1x)} cy={r2(p1y)} r={6.5} fill="none" stroke={missed ? MISS : ACCENT} strokeWidth={1.5} opacity={missed ? 0.9 : 0.5} />
                {missed ? (
                  <circle cx={r2(p.end[0])} cy={r2(p.end[1])} r={3} fill={MISS} />
                ) : null}
                {/* current denoising position */}
                <circle cx={r2(cur[0])} cy={r2(cur[1])} r={4.2} fill={ACCENT} filter="url(#fs-soft)" className="transition-all duration-150" />
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">field</span>
            {[
              { k: false, label: "rectified (straight)" },
              { k: true, label: "diffusion (curved)" },
            ].map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setCurved(m.k)}
                aria-pressed={curved === m.k}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  curved === m.k ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {K} step{K === 1 ? "" : "s"} · mean miss{" "}
            <span style={{ color: meanErr > 6 ? MISS : ACCENT }}>{meanErr.toFixed(1)}px</span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">Euler steps K (drag)</div>
            <Range min={1} max={12} value={K} onChange={(e) => setK(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">denoising time t (drag)</div>
            <Range min={0} max={1} step={0.02} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Generation integrates the learned velocity field from noise to data. When the field is{" "}
          <span style={{ color: ACCENT }}>straight</span> (rectified), the Euler polyline is the true path at{" "}
          <span className="text-foreground">any</span> step count — drop to 2 steps and it still lands. Flip to a{" "}
          <span style={{ color: MISS }}>curved</span> field and few steps cut the corner and miss; the error only
          closes as you add steps. Straightening the paths is why a flow backbone can generate in a handful of steps.
        </p>
      </div>
    </figure>
  )
}
