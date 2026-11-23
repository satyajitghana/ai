"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mexp, mlog, mtan } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Accord's measurement of the scale disagreement between two images (paper Sec. 4.2, App. A.2),
// computed pixel by pixel on a 2D scene seen from above.
//
// Camera i and camera j look at a wall 4 m away; a pillar may stand 3 m away. Each image's depth
// is the true z-depth times exp(e). For every pixel of i: lift it with i's depth, carry it into j,
// read j's own depth at the pixel it lands on, take log(d_j) - log(z_i->j). Pixels landing nearer
// than 0.15 m, outside j's view, with viewing rays more than 30 deg apart or with a log ratio beyond
// 0.5 are left out (the paper's gates). r_ij is the median; r_ji the same the other way;
// a_ij = (r_ij - r_ji) / 2 estimates e_j - e_i.

const WALL = 4
const PILLAR = { z: 3, x0: -0.15, x1: 0.35 }
const FOV = (35 * Math.PI) / 180
const RAYS = 241
const MAX_ANGLE = (30 * Math.PI) / 180

type Cam = { x: number; y: number }

function hit(c: Cam, a: number, pillar: boolean) {
  const t = mtan(a)
  if (pillar) {
    const dz = PILLAR.z - c.y
    if (dz > 0) {
      const x = c.x + dz * t
      if (x >= PILLAR.x0 && x <= PILLAR.x1) return { x, y: PILLAR.z, z: dz }
    }
  }
  const dz = WALL - c.y
  return { x: c.x + dz * t, y: WALL, z: dz }
}

function median(v: number[]) {
  if (!v.length) return NaN
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function direction(a: Cam, ea: number, b: Cam, eb: number, pillar: boolean) {
  const ratios: number[] = []
  const placed: [number, number][] = []
  for (let k = 0; k < RAYS; k++) {
    const ang = -FOV + (2 * FOV * k) / (RAYS - 1)
    const p = hit(a, ang, pillar)
    const s = mexp(ea)
    const px = a.x + (p.x - a.x) * s
    const py = a.y + (p.y - a.y) * s
    placed.push([px, py])
    const dz = py - b.y
    if (dz <= 0.15) continue
    const angB = matan2(px - b.x, dz)
    if (Math.abs(angB) > FOV) continue
    if (Math.abs(angB - ang) > MAX_ANGLE) continue
    const q = hit(b, angB, pillar)
    const r = mlog(q.z * mexp(eb)) - mlog(dz)
    if (Math.abs(r) > 0.5) continue
    ratios.push(r)
  }
  const m = ratios.length ? ratios.reduce((x, y) => x + y, 0) / ratios.length : NaN
  return { r: median(ratios), m, n: ratios.length, placed }
}

const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`

export function TwoWayAgreement() {
  const [ei, setEi] = useState(2)
  const [ej, setEj] = useState(-1)
  const [d, setD] = useState(0)
  const [pillar, setPillar] = useState(true)
  const [k, setK] = useState(3)

  const camI: Cam = { x: -0.6, y: 0 }
  const camJ: Cam = { x: 0.6, y: d }

  const res = useMemo(() => {
    const ij = direction(camI, ei / 100, camJ, ej / 100, pillar)
    const ji = direction(camJ, ej / 100, camI, ei / 100, pillar)
    return { ij, ji, a: (ij.r - ji.r) / 2 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ei, ej, d, pillar])

  const truth = (ej - ei) / 100
  const firstOrder = truth - (d / WALL) * ((ei + ej) / 200)

  const W = 640
  const H = 260
  const X = (x: number) => W / 2 + x * 120
  const Y = (y: number) => H - 20 - y * 52

  const camPath = (c: Cam, color: string) => {
    const s = 9
    return (
      <polygon
        points={`${X(c.x)},${Y(c.y) - s} ${X(c.x) - s * 0.8},${Y(c.y) + s * 0.6} ${X(c.x) + s * 0.8},${Y(c.y) + s * 0.6}`}
        fill={color}
      />
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">two images, one surface, measured both ways</span>
        <button
          type="button"
          onClick={() => setPillar((p) => !p)}
          aria-pressed={pillar}
          className={cn(
            "cursor-pointer rounded px-2 py-1 transition-colors",
            pillar ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          pillar {pillar ? "on" : "off"}
        </button>
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Top view: two cameras look at a wall with a pillar in front; each camera's depth places its own copy of the wall and pillar."
          className="w-full rounded-md border bg-muted/20"
        >
          <line x1={X(-2.6)} x2={X(2.6)} y1={Y(WALL)} y2={Y(WALL)} stroke="var(--muted-foreground)" strokeWidth="3" opacity="0.45" />
          <text x={X(2.6)} y={Y(WALL) - 6} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
            wall, 4 m
          </text>
          {pillar && (
            <line x1={X(PILLAR.x0)} x2={X(PILLAR.x1)} y1={Y(PILLAR.z)} y2={Y(PILLAR.z)} stroke="var(--muted-foreground)" strokeWidth="5" opacity="0.45" />
          )}
          {res.ij.placed.map((p, i) => (
            <circle key={`i${i}`} cx={X(p[0]).toFixed(1)} cy={Y(p[1]).toFixed(1)} r="1.6" fill="#c8501e" opacity="0.8" />
          ))}
          {res.ji.placed.map((p, i) => (
            <circle key={`j${i}`} cx={X(p[0]).toFixed(1)} cy={Y(p[1]).toFixed(1)} r="1.6" fill="#2563eb" opacity="0.8" />
          ))}
          {camPath(camI, "#c8501e")}
          {camPath(camJ, "#2563eb")}
          <text x={X(camI.x)} y={Y(camI.y) + 16} textAnchor="middle" fontSize="10" className="font-mono" fill="#c8501e">
            camera i
          </text>
          <text x={X(camJ.x)} y={Y(camJ.y) + 16} textAnchor="middle" fontSize="10" className="font-mono" fill="#2563eb">
            camera j
          </text>
          <text x={8} y={14} fontSize="10" className="fill-muted-foreground font-mono">
            top view · each dot is a pixel placed by its own image&apos;s depth
          </text>
        </svg>

        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">r_ij (i carried into j) </span>
            {pct(res.ij.r)} <span className="text-muted-foreground">from {res.ij.n} px</span>
          </div>
          <div>
            <span className="text-muted-foreground">r_ji (j carried into i) </span>
            {pct(res.ji.r)} <span className="text-muted-foreground">from {res.ji.n} px</span>
          </div>
          <div>
            <span className="text-muted-foreground">a_ij = ½(r_ij − r_ji) </span>
            <span className="text-foreground">{pct(res.a)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">with a mean, not a median: r_ij </span>
            {pct(res.ij.m)}
            <span className="text-muted-foreground"> · r_ji </span>
            {pct(res.ji.m)}
            <span className="text-muted-foreground"> · half the difference </span>
            {pct((res.ij.m - res.ji.m) / 2)}
          </div>
          <div>
            <span className="text-muted-foreground">true e_j − e_i </span>
            {pct(truth)}
            <span className="text-muted-foreground"> · with the D/z term </span>
            {pct(firstOrder)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 font-mono text-xs">
            <span style={{ color: "#c8501e" }}>e_i, image i too long by {ei.toFixed(1)}%</span>
            <Range min={-5} max={5} step={0.5} value={ei} accent="#c8501e" onChange={(e) => setEi(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span style={{ color: "#2563eb" }}>e_j, image j too long by {ej.toFixed(1)}%</span>
            <Range min={-5} max={5} step={0.5} value={ej} accent="#2563eb" onChange={(e) => setEj(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span>camera j nearer by D = {d.toFixed(1)} m</span>
            <Range min={0} max={1.5} step={0.1} value={d} onChange={(e) => setD(Number(e.target.value))} />
          </label>
        </div>

        <div className="mt-4 border-t pt-3">
          <label className="grid gap-1 font-mono text-xs sm:max-w-sm">
            <span>
              the solve: an image with k = {k} pair{k === 1 ? "" : "s"} moves {k}/{k + 1} ={" "}
              {((100 * k) / (k + 1)).toFixed(0)}% of the way its pairs ask
            </span>
            <Range min={0} max={10} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
          </label>
        </div>

        <figcaption className="mt-3 text-xs text-muted-foreground">
          Where one camera sees a patch of wall that the pillar hides from the other, the other reads the pillar instead,
          which is nearer: that pulls the ratio negative in both directions. The mean readout shows the pull; the median
          and the 0.5 gate remove most of it, and half the difference of the two directions cancels what is left, because
          a scale error flips sign between directions and an occlusion does not. Moving camera j nearer adds the small first-order term the paper derives,
          −(D/z)·(e_i+e_j)/2. Computed live on this toy scene with the paper&apos;s gates; not data from a run.
        </figcaption>
      </div>
    </figure>
  )
}
