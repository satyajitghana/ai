"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Plane bundle adjustment against scan-to-map registration, in 2D so it can be drawn.
//
// Three scans see one straight wall from 2 m away, each covering an overlapping stretch of it.
// Scan 1 is the anchor. Scan 2 was registered badly earlier (its error is the first pair of
// sliders); scan 3 arrives with the odometry's prediction error (the second pair).
//
//   scan-to-map   the map is frozen: a plane is fitted to scans 1 and 2 as they stand, and only
//                 scan 3 moves, to minimise its points' squared distances to that plane.
//   window BA     scans 2 and 3 both move. The cost is N times the smallest eigenvalue of the
//                 covariance of every point on the plane; the plane itself never becomes a
//                 variable (it is the eigenvector, solved in closed form at each step).
//
// The cost is evaluated twice: from all the raw points, and from three point clusters
// (n, sum p, sum p p^T per scan, in the scan's own frame, transformed by its pose). The numbers
// agree to rounding, which is the point of BALM2's point cluster: the BA never touches a point.

type V2 = [number, number]
type Pose = { th: number; dy: number }
type Cluster = { n: number; s: V2; S: [number, number, number] } // S = [xx, xy, yy]

const SIGMA = 0.02 // 2 cm range noise
const SENSOR_Y = -2
const SCANS = [
  { cx: 1.0, x0: 0.0, x1: 3.2 },
  { cx: 3.0, x0: 1.4, x1: 4.6 },
  { cx: 5.0, x0: 2.8, x1: 6.0 },
]
const NPTS = 60

// deterministic noise (LCG + Box-Muller through the det. wrappers)
function noise(seed: number, n: number) {
  let s = seed >>> 0
  const u = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s + 0.5) / 4294967296
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(Math.sqrt(-2 * mlog(u())) * mcos(2 * Math.PI * u()))
  return out
}

// body-frame points of each scan (sensor at the origin, wall at y = +2)
const BODY: V2[][] = SCANS.map((sc, k) => {
  const z = noise(17 + 31 * k, NPTS)
  return Array.from({ length: NPTS }, (_, i) => {
    const xw = sc.x0 + ((sc.x1 - sc.x0) * (i + 0.5)) / NPTS
    return [xw - sc.cx, -SENSOR_Y + SIGMA * z[i]] as V2
  })
})

const CLUSTERS: Cluster[] = BODY.map((pts) => {
  const c: Cluster = { n: 0, s: [0, 0], S: [0, 0, 0] }
  for (const [x, y] of pts) {
    c.n++
    c.s[0] += x
    c.s[1] += y
    c.S[0] += x * x
    c.S[1] += x * y
    c.S[2] += y * y
  }
  return c
})

const toWorld = (p: V2, k: number, pose: Pose): V2 => {
  const c = mcos(pose.th)
  const s = msin(pose.th)
  return [c * p[0] - s * p[1] + SCANS[k].cx, s * p[0] + c * p[1] + SENSOR_Y + pose.dy]
}

// smallest eigenvalue / eigenvector of a 2x2 symmetric [a b; b d]
function eig2(a: number, b: number, d: number) {
  const tr = (a + d) / 2
  const r = Math.sqrt(((a - d) / 2) ** 2 + b * b)
  const lmin = tr - r
  // eigenvector for lmin
  let nx = b
  let ny = lmin - a
  if (Math.abs(nx) + Math.abs(ny) < 1e-15) {
    nx = a <= d ? 1 : 0
    ny = a <= d ? 0 : 1
  }
  const L = Math.sqrt(nx * nx + ny * ny)
  return { lmin, n: [nx / L, ny / L] as V2 }
}

// plane (line) fit and N * lambda_min from raw points
function fitRaw(pts: V2[]) {
  const N = pts.length
  let mx = 0
  let my = 0
  for (const p of pts) {
    mx += p[0]
    my += p[1]
  }
  mx /= N
  my /= N
  let a = 0
  let b = 0
  let d = 0
  for (const p of pts) {
    const dx = p[0] - mx
    const dy = p[1] - my
    a += dx * dx
    b += dx * dy
    d += dy * dy
  }
  const e = eig2(a / N, b / N, d / N)
  return { N, mean: [mx, my] as V2, n: e.n, cost: N * e.lmin, lmin: e.lmin }
}

// the same cost from clusters: transform (n, s, S) by each pose, sum, one 2x2 eigenvalue
function costClusters(ks: number[], poses: Pose[]) {
  let N = 0
  let Px = 0
  let Py = 0
  let Qxx = 0
  let Qxy = 0
  let Qyy = 0
  for (const k of ks) {
    const cl = CLUSTERS[k]
    const c = mcos(poses[k].th)
    const s = msin(poses[k].th)
    const tx = SCANS[k].cx
    const ty = SENSOR_Y + poses[k].dy
    // R s
    const rsx = c * cl.s[0] - s * cl.s[1]
    const rsy = s * cl.s[0] + c * cl.s[1]
    // R S R^T
    const [xx, xy, yy] = cl.S
    const a = c * c * xx - 2 * c * s * xy + s * s * yy
    const bb = c * s * xx + (c * c - s * s) * xy - c * s * yy
    const d = s * s * xx + 2 * c * s * xy + c * c * yy
    N += cl.n
    Px += rsx + cl.n * tx
    Py += rsy + cl.n * ty
    Qxx += a + 2 * rsx * tx + cl.n * tx * tx
    Qxy += bb + rsx * ty + tx * rsy + cl.n * tx * ty
    Qyy += d + 2 * rsy * ty + cl.n * ty * ty
  }
  const mx = Px / N
  const my = Py / N
  const e = eig2(Qxx / N - mx * mx, Qxy / N - mx * my, Qyy / N - my * my)
  return N * e.lmin
}

// one Gauss-Newton step aligning scan k to a fixed line (n, point m); returns the new pose
function alignToLine(k: number, pose: Pose, n: V2, m: V2): Pose {
  let p = { ...pose }
  for (let it = 0; it < 4; it++) {
    let h00 = 0
    let h01 = 0
    let h11 = 0
    let g0 = 0
    let g1 = 0
    const c = [SCANS[k].cx, SENSOR_Y + p.dy]
    for (const b of BODY[k]) {
      const q = toWorld(b, k, p)
      const r = n[0] * (q[0] - m[0]) + n[1] * (q[1] - m[1])
      const jth = n[0] * -(q[1] - c[1]) + n[1] * (q[0] - c[0])
      const jdy = n[1]
      h00 += jth * jth
      h01 += jth * jdy
      h11 += jdy * jdy
      g0 += jth * r
      g1 += jdy * r
    }
    const det = h00 * h11 - h01 * h01
    if (Math.abs(det) < 1e-12) break
    p = { th: p.th - (h11 * g0 - h01 * g1) / det, dy: p.dy - (h00 * g1 - h01 * g0) / det }
  }
  return p
}

const DEG = Math.PI / 180

type Mode = "start" | "s2m" | "ba"

export function PlaneBA() {
  const [e2th, setE2th] = useState(1.2)
  const [e2dy, setE2dy] = useState(6)
  const [e3th, setE3th] = useState(-0.8)
  const [e3dy, setE3dy] = useState(-4)
  const [mode, setMode] = useState<Mode>("start")

  const start: Pose[] = useMemo(
    () => [
      { th: 0, dy: 0 },
      { th: e2th * DEG, dy: e2dy / 100 },
      { th: e3th * DEG, dy: e3dy / 100 },
    ],
    [e2th, e2dy, e3th, e3dy],
  )

  const solved = useMemo(() => {
    // scan-to-map: fit the frozen map (scans 1+2), align scan 3 to it
    const map12 = fitRaw([...BODY[0].map((b) => toWorld(b, 0, start[0])), ...BODY[1].map((b) => toWorld(b, 1, start[1]))])
    const s2m: Pose[] = [start[0], start[1], alignToLine(2, start[2], map12.n, map12.mean)]
    // window BA: alternate the closed-form plane and the two free poses
    let ba: Pose[] = start.map((p) => ({ ...p }))
    for (let it = 0; it < 30; it++) {
      const all = fitRaw(ba.flatMap((p, k) => BODY[k].map((b) => toWorld(b, k, p))))
      ba = [ba[0], alignToLine(1, ba[1], all.n, all.mean), alignToLine(2, ba[2], all.n, all.mean)]
    }
    return { start, s2m, ba }
  }, [start])

  const poses = mode === "start" ? solved.start : mode === "s2m" ? solved.s2m : solved.ba
  const world = poses.map((p, k) => BODY[k].map((b) => toWorld(b, k, p)))
  const all = fitRaw(world.flat())
  const viaClusters = costClusters([0, 1, 2], poses)

  // drawing: x in metres, y exaggerated 25x around the wall
  const W = 640
  const H = 250
  const EX = 25
  const X = (x: number) => 30 + (x / 6) * (W - 60)
  const Y = (y: number) => H / 2 - y * EX * ((W - 60) / 6) * 0.12
  const COLORS = ["#64748b", "#e11d48", "#2563eb"]

  // fitted plane through the current points
  const lineAt = (x: number) => all.mean[1] - (all.n[0] / all.n[1]) * (x - all.mean[0])

  const err = (p: Pose) => `${(p.th / DEG).toFixed(2)}°, ${(p.dy * 100).toFixed(1)} cm`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">one wall, three scans, two ways to fix them</span>
        <div className="flex gap-1">
          {(
            [
              ["start", "as estimated"],
              ["s2m", "scan-to-map"],
              ["ba", "window BA"],
            ] as [Mode, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                mode === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Points from three scans of one wall, drawn with the vertical scale exaggerated, and the plane fitted through all of them."
          className="w-full rounded-md border bg-muted/20"
        >
          <line x1={X(0)} x2={X(6)} y1={Y(0)} y2={Y(0)} stroke="var(--muted-foreground)" strokeDasharray="4 4" opacity="0.5" />
          <text x={X(6)} y={Y(0) - 6} textAnchor="end" className="fill-muted-foreground font-mono" fontSize="10">
            true wall
          </text>
          <line
            x1={X(0)}
            x2={X(6)}
            y1={Y(lineAt(0))}
            y2={Y(lineAt(6))}
            stroke="var(--foreground)"
            strokeWidth="1.2"
            opacity="0.7"
          />
          {world.map((pts, k) =>
            pts.map((p, i) => <circle key={`${k}-${i}`} cx={X(p[0]).toFixed(1)} cy={Y(p[1]).toFixed(1)} r="2.2" fill={COLORS[k]} opacity="0.85" />),
          )}
          {SCANS.map((sc, k) => (
            <text key={k} x={X((sc.x0 + sc.x1) / 2)} y={H - 10} textAnchor="middle" fontSize="10" className="font-mono" fill={COLORS[k]}>
              scan {k + 1}
              {k === 0 ? " (anchor)" : ""}
            </text>
          ))}
          <text x={8} y={14} fontSize="10" className="fill-muted-foreground font-mono">
            vertical scale x{EX}
          </text>
        </svg>

        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">scan 2 error now </span>
            <span style={{ color: COLORS[1] }}>{err(poses[1])}</span>
          </div>
          <div>
            <span className="text-muted-foreground">scan 3 error now </span>
            <span style={{ color: COLORS[2] }}>{err(poses[2])}</span>
          </div>
          <div>
            <span className="text-muted-foreground">plane thickness √λmin </span>
            {(Math.sqrt(Math.max(all.lmin, 0)) * 1000).toFixed(1)} mm
            <span className="text-muted-foreground"> (noise is {SIGMA * 1000} mm)</span>
          </div>
          <div>
            <span className="text-muted-foreground">BA cost N·λmin, from {all.N} points </span>
            {(all.cost * 1e4).toFixed(3)}
            <span className="text-muted-foreground"> · from 3 clusters </span>
            {(viaClusters * 1e4).toFixed(3)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-mono text-xs">
            <span>
              <span style={{ color: COLORS[1] }}>scan 2</span> frozen-in rotation error {e2th.toFixed(1)}°
            </span>
            <Range min={-3} max={3} step={0.1} value={e2th} accent={COLORS[1]} onChange={(e) => setE2th(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span>
              <span style={{ color: COLORS[1] }}>scan 2</span> offset {e2dy.toFixed(0)} cm
            </span>
            <Range min={-10} max={10} step={1} value={e2dy} accent={COLORS[1]} onChange={(e) => setE2dy(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span>
              <span style={{ color: COLORS[2] }}>scan 3</span> predicted rotation error {e3th.toFixed(1)}°
            </span>
            <Range min={-3} max={3} step={0.1} value={e3th} accent={COLORS[2]} onChange={(e) => setE3th(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span>
              <span style={{ color: COLORS[2] }}>scan 3</span> offset {e3dy.toFixed(0)} cm
            </span>
            <Range min={-10} max={10} step={1} value={e3dy} accent={COLORS[2]} onChange={(e) => setE3dy(Number(e.target.value))} />
          </label>
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
        Scan-to-map fixes scan 3 against a map that already contains scan 2&apos;s error, so scan 3 lands on a wrong wall. Window BA
        moves scans 2 and 3 together against the anchor and the wall comes back to one thickness. The plane is never a variable: it is
        the eigenvector of the points&apos; covariance, and the cost is the same number whether it is summed over every point or over three
        clusters. A toy in 2D with synthetic points, not data from the runs.
      </figcaption>
    </figure>
  )
}
