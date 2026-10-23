"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of the argument in Niantic Spatial's "Photorealism is not geometry" post:
// an appearance-only splat fit has no reason to keep a blank wall flat, and
// training longer lets it wander further; a depth term against lidar holds it.
//
// Illustrative, not a splat optimiser. A 4 m wall carries 48 Gaussians. Each one
// feels three forces, written as a quadratic energy in its depth offset z (mm):
//   photometric pin   k_i * z^2 / 2    k_i = texture_i * (views / 4)^2
//   appearance pull   -b_i * z         b_i: a fixed, seeded share of view-dependent
//                                      colour (exposure, gloss) the optimiser can
//                                      "explain" by moving the Gaussian off the wall
//   depth loss        lambda * z^2 / 2 against a lidar depth of zero
// Gradient flow on that energy has a closed form:
//   z(t) = z* + (z0 - z*) exp(-(k_i + lambda) t),   z* = b_i / (k_i + lambda)
// where t is in thousands of iterations. Texture is high on a poster in the
// middle of the wall and near zero on the paint around it. The constants are
// picked to make the shape visible, not fitted to any real scene.
//
// exp goes through lib/dmath; the seeded generator is integer arithmetic.

const N = 48
const WALL_M = 4

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type G = { x: number; tex: number; b: number; lidar0: number; sfm0: number }

const GAUSSIANS: G[] = (() => {
  const r = mulberry32(20261016)
  const out: G[] = []
  for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N) * WALL_M
    const poster = x > 1.4 && x < 2.6
    const tex = poster ? 0.8 + 0.4 * r() : 0.02 + 0.03 * r()
    const b = 2 * (2 * r() - 1)
    const lidar0 = 1.5 * (2 * r() - 1)
    // Structure from motion finds few points on blank paint, so its seeds there
    // sit far off the wall; on the poster they are close.
    const sfm0 = (poster ? 4 : 30) * (2 * r() - 1)
    out.push({ x, tex, b, lidar0, sfm0 })
  }
  return out
})()

const W = 560
const H = 220
const MID = 110
const MM_PER_PX = 0.6 // vertical exaggeration: 1 px is 0.6 mm

function rms(xs: number[]) {
  if (!xs.length) return 0
  return Math.sqrt(xs.reduce((a, v) => a + v * v, 0) / xs.length)
}

export function DepthDrift() {
  const [iters, setIters] = useState(7)
  const [views, setViews] = useState(4)
  const [lambda, setLambda] = useState(0)
  const [init, setInit] = useState<"lidar" | "sfm">("lidar")

  const zs = useMemo(() => {
    const g = (views / 4) * (views / 4)
    return GAUSSIANS.map((p) => {
      const k = p.tex * g
      const rate = k + lambda
      const zStar = p.b / rate
      const z0 = init === "lidar" ? p.lidar0 : p.sfm0
      return zStar + (z0 - zStar) * mexp(-rate * iters)
    })
  }, [iters, views, lambda, init])

  const posterErr = rms(zs.filter((_, i) => GAUSSIANS[i].x > 1.4 && GAUSSIANS[i].x < 2.6))
  const paintErr = rms(zs.filter((_, i) => !(GAUSSIANS[i].x > 1.4 && GAUSSIANS[i].x < 2.6)))

  const sx = (x: number) => 20 + (x / WALL_M) * (W - 40)
  const sy = (z: number) => MID - Math.max(-95, Math.min(95, z / MM_PER_PX))

  const camXs = Array.from({ length: views }, (_, i) => (views === 1 ? 2 : 0.6 + (2.8 * i) / (views - 1)))

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Toy model, illustrative: a flat wall fitted with and without a depth term
      </div>

      <svg viewBox={`0 0 ${W} ${H + 30}`} className="mt-3 w-full" role="img" aria-label="Gaussians along a flat wall drifting off it in the blank regions">
        <rect x={sx(1.4)} y={8} width={sx(2.6) - sx(1.4)} height={H - 16} fill="currentColor" opacity={0.06} />
        <text x={(sx(1.4) + sx(2.6)) / 2} y={22} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>
          textured poster
        </text>
        <text x={sx(0.7)} y={22} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>
          blank paint
        </text>
        <text x={sx(3.3)} y={22} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>
          blank paint
        </text>
        <line x1={sx(0)} x2={sx(WALL_M)} y1={MID} y2={MID} stroke="currentColor" strokeDasharray="4 4" opacity={0.6} />
        {GAUSSIANS.map((p, i) => (
          <ellipse
            key={i}
            cx={sx(p.x)}
            cy={sy(zs[i])}
            rx={(W - 40) / N / 2 + 1}
            ry={3}
            fill={p.tex > 0.5 ? "#3B7DD8" : "#C77D2E"}
            opacity={0.85}
          />
        ))}
        <text x={W - 20} y={MID - 6} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>
          true wall
        </text>
        {camXs.map((cx, i) => (
          <path
            key={i}
            d={`M ${sx(cx)} ${H + 4} l -6 12 l 12 0 z`}
            fill="currentColor"
            opacity={0.5}
          />
        ))}
        <text x={20} y={H + 26} fontSize={10} fill="currentColor" opacity={0.6}>
          cameras ({views} views); vertical scale exaggerated, 10 px = 6 mm
        </text>
      </svg>

      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Training length</span>
            <span className="font-mono tabular-nums">{iters}k iterations</span>
          </div>
          <Range min={0} max={30} step={1} value={iters} onChange={(e) => setIters(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Views of the wall</span>
            <span className="font-mono tabular-nums">{views}</span>
          </div>
          <Range min={2} max={12} step={1} value={views} onChange={(e) => setViews(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="flex justify-between">
            <span>Depth-loss weight λ</span>
            <span className="font-mono tabular-nums">{lambda.toFixed(2)}</span>
          </div>
          <Range min={0} max={1} step={0.05} value={lambda} onChange={(e) => setLambda(Number(e.target.value))} />
        </label>
        <div className="text-sm">
          <div>Initial Gaussians</div>
          <div className="mt-1 flex gap-2">
            {(["lidar", "sfm"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setInit(k)}
                className={cn(
                  "rounded border px-2 py-1 font-mono text-xs",
                  init === k ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                {k === "lidar" ? "lidar points" : "SfM points"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">RMS off-wall, blank paint</dt>
          <dd className="font-mono text-lg tabular-nums" style={{ color: "#C77D2E" }}>
            {paintErr.toFixed(1)} mm
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">RMS off-wall, poster</dt>
          <dd className="font-mono text-lg tabular-nums" style={{ color: "#3B7DD8" }}>
            {posterErr.toFixed(1)} mm
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        With λ at zero, start from lidar points and drag training length up: the blank paint walks
        away from the wall while the poster stays put. Raise λ and it stops. Starting from SfM points
        the blank paint begins off the wall and comes back only slowly, toward the same wrong place. The numbers are a toy&apos;s, not
        any product&apos;s.
      </p>
    </div>
  )
}
