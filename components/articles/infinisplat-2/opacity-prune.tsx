"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, mexp, mhypot, mlog, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What InfiniSplat v2 does with a noisy point cloud, in a 2D side view.
//
// The scene: a back wall at depth 3.0 and a box whose front face is at 1.6,
// seen by three cameras on the line y = 0 (x = -1.5, 0, 1.5), each with 40 rays
// over +-32 degrees. Each ray's "predicted" depth is the true depth, plus
//   - edge bleed: where neighbouring rays' true depths jump by more than 0.35,
//     the two rays on the far side are pulled 40% and 75% of the way towards
//     the near surface. That is the flying-pixel artefact every monocular and
//     multi-view depth network has at silhouettes; it is there at zero noise.
//   - Gaussian noise of standard deviation sigma (the slider), and
//   - spikes: with probability 0.5 * sigma, the depth is cut to 60-85% of
//     itself, which puts the point in mid-air.
// Back-projecting those depths gives the point cloud. Like v2, the toy never
// moves a point: centres are the back-projected positions, full stop.
//
// Labels follow the paper's Appendix B.4 in spirit, simplified for three views:
// a point is "inconsistent" if another camera that can see its direction has
// observed free space in front of the true surface there (true depth exceeds the
// point's distance by more than 0.08); "surface" if its own predicted depth is
// within 0.08 of the truth; otherwise "uncertain" (off the surface, but hidden
// behind it from every other view).
//
// Opacity is a HAND-WRITTEN STAND-IN, not v2's network. v2 learns opacity
// from rendering loss alone; this toy imitates the effect the paper reports
// with a cross-view free-space test against the other cameras' *predicted*
// (noisy) depths: alpha = 0.97 * prod_b sigmoid(-(v_b - 0.18) / 0.035), where
// v_b is how far in front of camera b's predicted surface the point sits.
// Scales: along the surface, half the mean distance to the two neighbouring
// points of the same ray fan, capped at 0.3; across it, 0.02.
//
// Merge and prune follow gaussians.py in the release: voxel side = 1.4 x the
// median of the per-Gaussian geometric-mean scale, every attribute averaged
// per occupied voxel, then Gaussians with opacity under 0.01 are dropped.
// The point-level statistics use the per-point opacity, as the paper's
// diagnostic does. Every number on screen is computed by this file.

const FOV = (32 * Math.PI) / 180
const RAYS = 40
const CAMS = [-1.5, 0, 1.5]
const WALL = 3.0
const BOX = { x0: -0.5, x1: 0.5, y0: 1.6, y1: 2.2 }
const TOL = 0.08
const CAP = 0.3
const ACROSS = 0.02
const VOXEL_MULT = 1.4
const PRUNE = 0.01

type Label = "surface" | "inconsistent" | "uncertain"

type Pt = {
  cam: number
  ray: number
  x: number
  y: number
  dTrue: number
  dPred: number
  label: Label
  alpha: number
  tx: number
  ty: number
  sAlong: number
}

// Deterministic noise so the server and the browser draw the same cloud.
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

const NOISE = (() => {
  const rnd = mulberry32(20261016)
  return CAMS.map(() =>
    Array.from({ length: RAYS }, () => {
      const u1 = Math.max(1e-9, rnd())
      const u2 = rnd()
      return {
        n: Math.sqrt(-2 * mlog(u1)) * mcos(2 * Math.PI * u2),
        u: rnd(),
        v: rnd(),
      }
    }),
  )
})()

const rayAngle = (i: number) => -FOV + (2 * FOV * i) / (RAYS - 1)

// Exact depth along a ray from (cx, 0) at angle th from straight ahead (+y).
function castTrue(cx: number, th: number): number {
  const s = msin(th)
  const c = mcos(th)
  let t = WALL / c
  const tf = BOX.y0 / c
  const xf = cx + s * tf
  if (xf >= BOX.x0 && xf <= BOX.x1) t = Math.min(t, tf)
  if (s > 1e-9 && cx < BOX.x0) {
    const ts = (BOX.x0 - cx) / s
    const y = c * ts
    if (y >= BOX.y0 && y <= BOX.y1) t = Math.min(t, ts)
  }
  if (s < -1e-9 && cx > BOX.x1) {
    const ts = (BOX.x1 - cx) / s
    const y = c * ts
    if (y >= BOX.y0 && y <= BOX.y1) t = Math.min(t, ts)
  }
  return t
}

const TRUE_DEPTH = CAMS.map((cx) => Array.from({ length: RAYS }, (_, i) => castTrue(cx, rayAngle(i))))

function predictDepths(sigma: number): number[][] {
  return CAMS.map((_, c) => {
    const truth = TRUE_DEPTH[c]
    const d = [...truth]
    // edge bleed, applied to the far side of every depth jump
    for (let i = 0; i + 1 < RAYS; i++) {
      const a = truth[i]
      const b = truth[i + 1]
      if (Math.abs(a - b) <= 0.35) continue
      const near = Math.min(a, b)
      const far = Math.max(a, b)
      const step = a > b ? -1 : 1 // walk away from the near side
      const f1 = a > b ? i : i + 1
      const f2 = f1 + step
      d[f1] = near + 0.4 * (far - near)
      if (f2 >= 0 && f2 < RAYS && Math.abs(truth[f2] - far) < 0.05) d[f2] = near + 0.75 * (far - near)
    }
    return d.map((v, i) => {
      const z = NOISE[c][i]
      let out = v
      if (z.u < 0.5 * sigma) out *= 0.6 + 0.25 * z.v
      return Math.max(0.3, out + sigma * z.n)
    })
  })
}

// Camera b's depth along an arbitrary direction, interpolated over its rays.
function sampleDepth(depths: number[], th: number): number {
  const f = ((th + FOV) / (2 * FOV)) * (RAYS - 1)
  const i = Math.min(RAYS - 2, Math.max(0, Math.floor(f)))
  const w = f - i
  return depths[i] * (1 - w) + depths[i + 1] * w
}

const sigmoid = (z: number) => 1 / (1 + mexp(-z))

function build(sigma: number) {
  const pred = predictDepths(sigma)
  const pts: Pt[] = []
  CAMS.forEach((cx, c) => {
    for (let i = 0; i < RAYS; i++) {
      const th = rayAngle(i)
      const d = pred[c][i]
      const x = cx + d * msin(th)
      const y = d * mcos(th)
      const dTrue = TRUE_DEPTH[c][i]

      let violates = false
      let alpha = 0.97
      CAMS.forEach((bx, b) => {
        if (b === c) return
        const dx = x - bx
        const r = mhypot(dx, y)
        const tb = matan2(dx, y)
        if (Math.abs(tb) > FOV) return
        if (castTrue(bx, tb) - r > TOL) violates = true
        const v = sampleDepth(pred[b], tb) - r
        alpha *= sigmoid(-(v - 0.18) / 0.035)
      })

      const label: Label = violates
        ? "inconsistent"
        : Math.abs(d - dTrue) <= TOL
          ? "surface"
          : "uncertain"
      pts.push({ cam: c, ray: i, x, y, dTrue, dPred: d, label, alpha, tx: 1, ty: 0, sAlong: 0.05 })
    }
  })

  // Tangent and along-surface scale from the neighbouring rays of the same fan.
  for (const p of pts) {
    const fan = pts.filter((q) => q.cam === p.cam)
    const a = fan[Math.max(0, p.ray - 1)]
    const b = fan[Math.min(RAYS - 1, p.ray + 1)]
    const tx = b.x - a.x
    const ty = b.y - a.y
    const n = mhypot(tx, ty) || 1
    p.tx = tx / n
    p.ty = ty / n
    const dl = p.ray > 0 ? mhypot(p.x - a.x, p.y - a.y) : mhypot(p.x - b.x, p.y - b.y)
    const dr = p.ray < RAYS - 1 ? mhypot(p.x - b.x, p.y - b.y) : dl
    p.sAlong = Math.min(CAP, Math.max(0.01, 0.25 * (dl + dr)))
  }

  // Voxel merge exactly as the release does it, then the 0.01 opacity prune.
  const geo = pts.map((p) => Math.sqrt(p.sAlong * ACROSS)).sort((a, b) => a - b)
  const median = geo[Math.floor((geo.length - 1) / 2)] // lower-middle, like torch.median
  const voxel = VOXEL_MULT * median
  const cells = new Map<string, Pt[]>()
  for (const p of pts) {
    const k = `${Math.floor(p.x / voxel)},${Math.floor(p.y / voxel)}`
    const list = cells.get(k)
    if (list) list.push(p)
    else cells.set(k, [p])
  }
  const merged = [...cells.values()].map((g) => {
    const n = g.length
    let tx = 0
    let ty = 0
    for (const q of g) {
      const sgn = q.tx * g[0].tx + q.ty * g[0].ty < 0 ? -1 : 1
      tx += sgn * q.tx
      ty += sgn * q.ty
    }
    const tn = mhypot(tx, ty) || 1
    return {
      x: g.reduce((s, q) => s + q.x, 0) / n,
      y: g.reduce((s, q) => s + q.y, 0) / n,
      alpha: g.reduce((s, q) => s + q.alpha, 0) / n,
      sAlong: g.reduce((s, q) => s + q.sAlong, 0) / n,
      tx: tx / tn,
      ty: ty / tn,
      n,
    }
  })
  const kept = merged.filter((m) => m.alpha >= PRUNE)

  const inc = pts.filter((p) => p.label === "inconsistent")
  const surf = pts.filter((p) => p.label === "surface")
  const pruned = (list: Pt[]) => list.filter((p) => p.alpha < PRUNE).length
  return {
    pts,
    merged,
    kept,
    voxel,
    stats: {
      total: pts.length,
      inconsistent: inc.length,
      uncertain: pts.filter((p) => p.label === "uncertain").length,
      incPruned: inc.length ? pruned(inc) / inc.length : 0,
      allPruned: pruned(pts) / pts.length,
      surfKept: surf.length ? 1 - pruned(surf) / surf.length : 1,
    },
  }
}

// ---- drawing ----------------------------------------------------------------

const W = 700
const H = 360
const S = 96
const SX = (x: number) => 350 + x * S
const SY = (y: number) => 334 - y * S

const COL: Record<Label, string> = {
  surface: "oklch(0.62 0.15 155)",
  inconsistent: "oklch(0.60 0.21 27)",
  uncertain: "oklch(0.74 0.15 75)",
}
const SPLAT = "oklch(0.60 0.13 250)"

type Mode = "points" | "gaussians" | "merged"

const MODES: [Mode, string][] = [
  ["points", "1 · back-projected points"],
  ["gaussians", "2 · Gaussians, opacity"],
  ["merged", "3 · voxel merge + prune"],
]

const pct = (v: number) => `${(100 * v).toFixed(1)}%`

function ellipse(key: string, x: number, y: number, tx: number, ty: number, s: number, alpha: number) {
  const ang = (matan2(-ty, tx) * 180) / Math.PI
  return (
    <ellipse
      key={key}
      cx={SX(x)}
      cy={SY(y)}
      rx={Math.max(1.5, 2 * s * S)}
      ry={Math.max(1.2, 2 * ACROSS * S)}
      transform={`rotate(${ang.toFixed(2)} ${SX(x).toFixed(2)} ${SY(y).toFixed(2)})`}
      fill={SPLAT}
      fillOpacity={0.85 * alpha}
      stroke={SPLAT}
      strokeOpacity={Math.min(1, 0.15 + alpha)}
      strokeWidth={0.6}
    />
  )
}

export function OpacityPrune() {
  const [sigma, setSigma] = useState(0.06)
  const [mode, setMode] = useState<Mode>("gaussians")
  const { pts, merged, kept, voxel, stats } = useMemo(() => build(sigma), [sigma])

  const desc =
    `Side view of a wall and a box seen by three cameras, depth noise ${sigma.toFixed(2)}. ` +
    `${stats.total} back-projected points, ${stats.inconsistent} of them in free space another camera has seen through. ` +
    `At opacity threshold 0.01 the stand-in prunes ${pct(stats.incPruned)} of those inconsistent points, ` +
    `${pct(stats.allPruned)} of all points, and keeps ${pct(stats.surfKept)} of the points on the surface. ` +
    `Voxel merging at ${voxel.toFixed(3)} units turns ${stats.total} Gaussians into ${merged.length}, of which ${kept.length} survive the prune.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>noisy points in, Gaussians out · centres never move</span>
        <span className="text-muted-foreground/60">2D toy · opacity is a stand-in</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-[92px] shrink-0">depth noise {sigma.toFixed(2)}</span>
          <Range
            min={0}
            max={0.2}
            step={0.01}
            value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))}
            aria-label="Depth noise standard deviation"
            className="flex-1"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" role="img" aria-label={desc}>
          {/* true geometry */}
          <line
            x1={SX(-3.4)}
            x2={SX(3.4)}
            y1={SY(WALL)}
            y2={SY(WALL)}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeOpacity={0.5}
            strokeDasharray="4 4"
          />
          <rect
            x={SX(BOX.x0)}
            y={SY(BOX.y1)}
            width={(BOX.x1 - BOX.x0) * S}
            height={(BOX.y1 - BOX.y0) * S}
            fill="currentColor"
            className="text-muted-foreground"
            fillOpacity={0.06}
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeDasharray="4 4"
          />
          <text x={SX(-3.4)} y={SY(WALL) - 6} className="fill-muted-foreground font-mono" fontSize={9}>
            true wall
          </text>
          <text x={SX(BOX.x1) + 6} y={SY(BOX.y0) + 3} className="fill-muted-foreground font-mono" fontSize={9}>
            true box
          </text>

          {/* cameras and their fields of view */}
          {CAMS.map((cx) => (
            <g key={cx}>
              {[-FOV, FOV].map((th) => (
                <line
                  key={th}
                  x1={SX(cx)}
                  y1={SY(0)}
                  x2={SX(cx + 0.55 * msin(th))}
                  y2={SY(0.55 * mcos(th))}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeOpacity={0.35}
                />
              ))}
              <polygon
                points={`${SX(cx)},${SY(0) - 6} ${SX(cx) - 7},${SY(0) + 6} ${SX(cx) + 7},${SY(0) + 6}`}
                fill="currentColor"
                className="text-foreground"
                fillOpacity={0.7}
              />
            </g>
          ))}

          {mode === "points" &&
            pts.map((p) => (
              <circle key={`${p.cam}-${p.ray}`} cx={SX(p.x)} cy={SY(p.y)} r={2.6} fill={COL[p.label]} fillOpacity={0.9} />
            ))}

          {mode === "gaussians" &&
            pts.map((p) => ellipse(`${p.cam}-${p.ray}`, p.x, p.y, p.tx, p.ty, p.sAlong, p.alpha))}

          {mode === "merged" && (
            <>
              {merged
                .filter((m) => m.alpha < PRUNE)
                .map((m, i) => (
                  <g key={`x${i}`} stroke={COL.inconsistent} strokeOpacity={0.7} strokeWidth={1.1}>
                    <line x1={SX(m.x) - 3} y1={SY(m.y) - 3} x2={SX(m.x) + 3} y2={SY(m.y) + 3} />
                    <line x1={SX(m.x) - 3} y1={SY(m.y) + 3} x2={SX(m.x) + 3} y2={SY(m.y) - 3} />
                  </g>
                ))}
              {kept.map((m, i) => ellipse(`k${i}`, m.x, m.y, m.tx, m.ty, m.sAlong, m.alpha))}
            </>
          )}

          {/* legend */}
          <g className="font-mono" fontSize={9}>
            {mode === "points" ? (
              (["surface", "inconsistent", "uncertain"] as Label[]).map((l, i) => (
                <g key={l} transform={`translate(${16 + i * 112}, ${H - 8})`}>
                  <circle cx={4} cy={-3} r={3} fill={COL[l]} />
                  <text x={12} y={0} className="fill-muted-foreground">
                    {l}
                  </text>
                </g>
              ))
            ) : (
              <text x={16} y={H - 8} className="fill-muted-foreground">
                {mode === "gaussians"
                  ? "fill = opacity · ellipse = 2σ footprint along the fitted tangent"
                  : `voxel ${voxel.toFixed(3)} = 1.4 × median scale · × = merged Gaussian under 0.01 opacity`}
              </text>
            )}
          </g>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
        <span>
          points <span className="text-foreground">{stats.total}</span> · inconsistent{" "}
          <span style={{ color: COL.inconsistent }}>{stats.inconsistent}</span>
        </span>
        <span>
          inconsistent pruned <span className="text-foreground">{pct(stats.incPruned)}</span>
        </span>
        <span>
          all pruned <span className="text-foreground">{pct(stats.allPruned)}</span>
        </span>
        <span>
          surface kept <span className="text-foreground">{pct(stats.surfKept)}</span>
        </span>
        <span className="col-span-2 sm:col-span-4">
          merge: {stats.total} → {merged.length} Gaussians, {kept.length} after the 0.01 prune · paper (Hypersim, real
          model): 51.8% / 7.5% / 93.3%
        </span>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Three cameras see a wall and a box. Their depth is wrong in the way depth networks are wrong: pixels bleed across
        the box&apos;s edges into mid-air, and noise and spikes grow with the slider. No point is ever moved. What changes
        is opacity: a point that sits in space another camera has seen straight through gets faded, and under 0.01 it is
        deleted. Opacity here is a hand-written cross-view test standing in for v2&apos;s learned head; the merge and the
        0.01 prune follow the released code.
      </figcaption>
    </figure>
  )
}
