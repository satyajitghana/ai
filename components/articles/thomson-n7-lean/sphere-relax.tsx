"use client"

// Seven points on a sphere relaxing toward the pentagonal bipyramid, with the
// Coulomb energy updating as they move. This is an *illustration* of what the
// Thomson problem asks, not a solver: it linearly interpolates a fixed
// suboptimal start toward the exact bipyramid and reprojects each point onto
// the unit sphere, so the energy falls toward E(P) = 14.4529774142 without ever
// running gradient descent. The real minimiser, and the proof that it is one,
// are the article's subject.
//
// SSR-safe: the initial frame is the start configuration, computed the same way
// on server and client. Every coordinate that reaches the DOM goes through the
// deterministic trig wrappers in lib/dmath, so the SVG serializes identically
// in Node and the browser (no hydration mismatch). The auto-relax animation is
// client-only and runs after hydration.

import { useEffect, useRef, useState } from "react"

import { mcos, msin } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"

type V3 = [number, number, number]

const TAU = 2 * Math.PI

// The exact regular pentagonal bipyramid: five points on the equator at
// 2*pi*k/5, and the two poles. This is the configuration the proof shows is
// optimal.
const TARGET: V3[] = [
  ...Array.from({ length: 5 }, (_, k): V3 => [mcos((TAU * k) / 5), msin((TAU * k) / 5), 0]),
  [0, 0, 1],
  [0, 0, -1],
]

// A fixed, deliberately suboptimal start: an uneven ring, both "poles" pulled
// off-axis and down. Higher energy than the bipyramid, same seven points.
const START: V3[] = [
  [mcos(0), msin(0), 0.18],
  [mcos(0.9), msin(0.9), 0.1],
  [mcos(2.4), msin(2.4), -0.12],
  [mcos(3.5), msin(3.5), 0.05],
  [mcos(5.1), msin(5.1), -0.2],
  [0.35, -0.15, 0.95],
  [-0.3, 0.25, -0.9],
]

const normalize = ([x, y, z]: V3): V3 => {
  const r = Math.sqrt(x * x + y * y + z * z) || 1
  return [x / r, y / r, z / r]
}

// Linear blend of start and target, reprojected to the unit sphere.
function configAt(t: number): V3[] {
  return START.map((s, i) => {
    const e = TARGET[i]
    return normalize([s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t, s[2] + (e[2] - s[2]) * t])
  })
}

// Coulomb energy: sum over unordered pairs of 1 / distance. sqrt and division
// are exact per IEEE-754, so this is deterministic once the inputs are.
function energy(pts: V3[]): number {
  let e = 0
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i][0] - pts[j][0]
      const dy = pts[i][1] - pts[j][1]
      const dz = pts[i][2] - pts[j][2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d > 1e-9) e += 1 / d
    }
  return e
}

// A fixed camera: tilt down ~22 degrees, turn ~-32 degrees. Constants through
// dmath so server and client agree to the last digit.
const AX = mcos(0.38)
const AXs = msin(0.38)
const AY = mcos(-0.56)
const AYs = msin(-0.56)

function project([x, y, z]: V3): { px: number; py: number; depth: number } {
  // rotate about y, then about x
  const x1 = x * AY + z * AYs
  const z1 = -x * AYs + z * AY
  const y2 = y * AX - z1 * AXs
  const z2 = y * AXs + z1 * AX
  return { px: x1, py: y2, depth: z2 }
}

const SIZE = 340
const R = 128
const CX = SIZE / 2
const CY = SIZE / 2

export function SphereRelax() {
  const [step, setStep] = useState(0) // 0..100
  const [playing, setPlaying] = useState(false)
  const stepRef = useRef(0)
  useEffect(() => {
    stepRef.current = step
  }, [step])

  // Client-only, post-hydration animation. setState happens inside the rAF
  // callback (an external-event callback), not synchronously in the effect body.
  useEffect(() => {
    if (!playing) return
    let id = 0
    function frame() {
      const next = Math.min(100, stepRef.current + 1.25)
      stepRef.current = next
      setStep(next)
      if (next >= 100) {
        setPlaying(false)
        return
      }
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [playing])

  const t = step / 100
  const pts = configAt(t)
  const e = energy(pts)
  const proj = pts.map((p, i) => ({ i, ...project(p) }))
  // draw far points first
  const order = [...proj].sort((a, b) => a.depth - b.depth)
  const pairs: { a: number; b: number; depth: number }[] = []
  for (let i = 0; i < 7; i++)
    for (let j = i + 1; j < 7; j++) pairs.push({ a: i, b: j, depth: (proj[i].depth + proj[j].depth) / 2 })
  pairs.sort((p, q) => p.depth - q.depth)

  const sx = (p: { px: number }) => CX + p.px * R
  const sy = (p: { py: number }) => CY - p.py * R

  const atMin = step > 99.5

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          className="mx-auto shrink-0"
          role="img"
          aria-label="Seven points on a sphere, relaxing toward the pentagonal bipyramid"
        >
          <circle cx={CX} cy={CY} r={R} className="fill-foreground/[0.03] stroke-border" strokeWidth={1} />
          {/* equator ellipse for depth cue */}
          <ellipse cx={CX} cy={CY} rx={R} ry={R * Math.abs(AXs)} className="fill-none stroke-border/60" strokeDasharray="3 4" strokeWidth={1} />
          {pairs.map(({ a, b }) => (
            <line
              key={`${a}-${b}`}
              x1={sx(proj[a])}
              y1={sy(proj[a])}
              x2={sx(proj[b])}
              y2={sy(proj[b])}
              className="stroke-foreground/15"
              strokeWidth={1}
            />
          ))}
          {order.map(({ i, depth }) => {
            const p = proj[i]
            const front = depth > 0
            const rr = 6 + depth * 2.2
            return (
              <g key={i}>
                <circle
                  cx={sx(p)}
                  cy={sy(p)}
                  r={Math.max(3.5, rr)}
                  className={front ? "fill-[var(--hg-accent,#2f8f5b)]" : "fill-[var(--hg-accent,#2f8f5b)]/50"}
                  stroke="white"
                  strokeWidth={1.4}
                  style={{ ["--hg-accent" as string]: "#2f8f5b" }}
                />
              </g>
            )
          })}
        </svg>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm text-muted-foreground">Coulomb energy</div>
          <div className="font-mono text-3xl font-semibold tabular-nums">
            {e.toFixed(4)}
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            minimum E(P) = 14.4529774142{atMin ? " — reached" : ""}
          </div>

          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>start</span>
              <span>pentagonal bipyramid</span>
            </div>
            <Range
              min={0}
              max={100}
              step={0.5}
              value={step}
              accent="#2f8f5b"
              aria-label="Relaxation from the start configuration to the pentagonal bipyramid"
              onChange={(ev) => {
                setPlaying(false)
                setStep(Number(ev.currentTarget.value))
              }}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (atMin) setStep(0)
                setPlaying((p) => !p)
              }}
              className="rounded-md border bg-background px-3 py-1.5 font-mono text-xs transition-colors hover:bg-muted"
            >
              {playing ? "Pause" : atMin ? "Replay" : "Relax"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                setStep(0)
              }}
              className="rounded-md border bg-background px-3 py-1.5 font-mono text-xs transition-colors hover:bg-muted"
            >
              Reset
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Illustrative, not a solver: the seven points are blended from a fixed
            suboptimal start toward the exact bipyramid and reprojected onto the
            sphere, so the energy falls to 14.4529774142. The proof is about why
            that configuration is the global minimum, not how a descent finds it.
          </p>
        </div>
      </div>
    </div>
  )
}
