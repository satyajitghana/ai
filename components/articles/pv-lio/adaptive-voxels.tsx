"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { matan2, mcos, mlog, msin } from "@/lib/dmath"

// The coarse-to-fine voxel rule from VoxelMap / PV-LIO (OctoTree::init_octo_tree and
// cut_octo_tree in include/voxel_map_util.hpp), on a 2D slice so it fits on a page. Each root
// voxel that collects more than 5 points fits a plane (here a line) by PCA. If the smallest
// eigenvalue of the points' covariance is under plannar_threshold, the voxel keeps that plane.
// If not, it is cut into children (8 in 3D, 4 here) and each child tries again, down to
// max_layer. A leaf at max_layer that still is not flat holds no plane and matches nothing.
// The scene is a toy: a floor, a wall, a step, a sloped ceiling and a round column, sampled
// every 3 cm with 1 cm of noise.

type Pt = [number, number]
const DOM_W = 4
const DOM_H = 3
const S = 150 // px per metre
const PAD = 10
const W = DOM_W * S + PAD * 2
const H = DOM_H * S + PAD * 2

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function scene(): Pt[] {
  const r = rng(7)
  const g = () => {
    const u = Math.max(r(), 1e-9)
    return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * r())
  }
  const out: Pt[] = []
  const seg = (a: Pt, b: Pt) => {
    const len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]))
    const n = Math.round(len / 0.03)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      out.push([a[0] + (b[0] - a[0]) * t + 0.01 * g(), a[1] + (b[1] - a[1]) * t + 0.01 * g()])
    }
  }
  seg([0.12, 0.1], [2.6, 0.1]) // floor
  seg([0.12, 0.1], [0.12, 2.85]) // wall
  seg([2.6, 0.1], [2.6, 0.8]) // step riser
  seg([2.6, 0.8], [3.95, 0.8]) // step tread
  seg([0.12, 2.85], [3.95, 2.35]) // sloped ceiling
  const cx = 1.75
  const cy = 1.45
  const rad = 0.3
  const n = Math.round((2 * Math.PI * rad) / 0.03)
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n
    out.push([cx + rad * mcos(a) + 0.01 * g(), cy + rad * msin(a) + 0.01 * g()])
  }
  return out
}

type Cell = { x: number; y: number; size: number; layer: number; kind: "plane" | "split" | "rough" | "sparse"; n: number; lmin?: number; c?: Pt; ang?: number; half?: number }

function build(pts: Pt[], root: number, maxLayer: number, thr: number): Cell[] {
  const cells: Cell[] = []
  const visit = (x: number, y: number, size: number, layer: number, sub: Pt[]) => {
    if (sub.length <= 5) {
      if (sub.length > 0) cells.push({ x, y, size, layer, kind: "sparse", n: sub.length })
      return
    }
    let mx = 0
    let my = 0
    for (const p of sub) { mx += p[0]; my += p[1] }
    mx /= sub.length
    my /= sub.length
    let a = 0
    let b = 0
    let c = 0
    for (const p of sub) { const dx = p[0] - mx; const dy = p[1] - my; a += dx * dx; b += dx * dy; c += dy * dy }
    a /= sub.length
    b /= sub.length
    c /= sub.length
    const disc = Math.sqrt(((a - c) / 2) * ((a - c) / 2) + b * b)
    const lmin = (a + c) / 2 - disc
    const lmax = (a + c) / 2 + disc
    if (lmin < thr) {
      const ang = 0.5 * matan2(2 * b, a - c)
      cells.push({ x, y, size, layer, kind: "plane", n: sub.length, lmin, c: [mx, my], ang, half: Math.min(Math.sqrt(3 * lmax), size * 0.72) })
      return
    }
    if (layer >= maxLayer) {
      cells.push({ x, y, size, layer, kind: "rough", n: sub.length, lmin })
      return
    }
    cells.push({ x, y, size, layer, kind: "split", n: sub.length, lmin })
    const h = size / 2
    for (const [ox, oy] of [[0, 0], [h, 0], [0, h], [h, h]] as const) {
      visit(x + ox, y + oy, h, layer + 1, sub.filter((p) => p[0] >= x + ox && p[0] < x + ox + h && p[1] >= y + oy && p[1] < y + oy + h))
    }
  }
  for (let x = 0; x < DOM_W - 1e-9; x += root) {
    for (let y = 0; y < DOM_H - 1e-9; y += root) {
      visit(x, y, root, 0, pts.filter((p) => p[0] >= x && p[0] < x + root && p[1] >= y && p[1] < y + root))
    }
  }
  return cells
}

const ROOTS = [0.25, 0.5, 1, 2]
const LAYERS = [0, 1, 2, 3]
const THRS = [0.01, 0.001]
const LAYER_COL = ["oklch(0.62 0.17 255)", "oklch(0.66 0.15 160)", "oklch(0.74 0.15 75)", "oklch(0.66 0.18 25)"]

export function AdaptiveVoxels() {
  const pts = useMemo(() => scene(), [])
  const [root, setRoot] = useState(1)
  const [maxLayer, setMaxLayer] = useState(2)
  const [thr, setThr] = useState(0.01)
  const cells = useMemo(() => build(pts, root, maxLayer, thr), [pts, root, maxLayer, thr])
  const planes = cells.filter((c) => c.kind === "plane")
  const rough = cells.filter((c) => c.kind === "rough")
  const inPlanes = planes.reduce((s, c) => s + c.n, 0)
  const X = (x: number) => PAD + x * S
  const Y = (y: number) => H - PAD - y * S
  const perLayer = LAYERS.map((l) => planes.filter((c) => c.layer === l).length)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">coarse-to-fine voxels · a 2D slice of the rule</span>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="w-full rounded-md border bg-muted/20"
          aria-label={`A 4 by 3 metre slice with ${pts.length} points. Root voxels of ${root} m, up to ${maxLayer} splits, threshold ${thr} square metres: ${planes.length} planes hold ${inPlanes} points, ${rough.length} voxels at the deepest layer are not flat enough to hold one.`}>
          {cells.map((c, i) => (
            <rect key={`c${i}`} x={X(c.x)} y={Y(c.y + c.size)} width={c.size * S} height={c.size * S}
              fill={c.kind === "rough" ? "oklch(0.66 0.18 25 / 0.14)" : "none"}
              stroke="var(--muted-foreground)" strokeOpacity={c.kind === "split" ? 0.5 : 0.25} strokeWidth={c.layer === 0 ? 1 : 0.6}
              strokeDasharray={c.layer === 0 ? undefined : "2 2"} />
          ))}
          {pts.map((p, i) => (
            <circle key={`p${i}`} cx={X(p[0])} cy={Y(p[1])} r={1.1} fill="var(--foreground)" opacity="0.45" />
          ))}
          {planes.map((c, i) => {
            const dx = mcos(c.ang ?? 0) * (c.half ?? 0)
            const dy = msin(c.ang ?? 0) * (c.half ?? 0)
            const p = c.c ?? [0, 0]
            return (
              <line key={`l${i}`} x1={X(p[0] - dx)} y1={Y(p[1] - dy)} x2={X(p[0] + dx)} y2={Y(p[1] + dy)}
                stroke={LAYER_COL[c.layer]} strokeWidth={3} strokeLinecap="round" opacity="0.9" />
            )
          })}
        </svg>

        <div className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-3">
          <Picker label="root voxel (voxel_size)" values={ROOTS} value={root} set={setRoot} fmt={(v) => `${v} m`} />
          <Picker label="max_layer" values={LAYERS} value={maxLayer} set={setMaxLayer} fmt={(v) => `${v}`} />
          <Picker label="plannar_threshold" values={THRS} value={thr} set={setThr} fmt={(v) => `${v} m²`} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="planes, by layer 0/1/2/3" value={perLayer.join(" / ")} />
          <Stat label="points on a plane" value={`${((inPlanes / pts.length) * 100).toFixed(0)}%`} highlight />
          <Stat label="deepest voxels, not flat" value={`${rough.length}`} />
          <Stat label="voxels" value={`${cells.length}`} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Line colour is the layer the plane was found at: blue for a root voxel, then green, amber,
          red as voxels are cut. Shaded squares reached the last layer and still were not flat, so
          they hold no plane and any scan point landing there finds no match. The shipped threshold
          of 0.01 m² is on a variance, so it accepts a voxel whose points sit within about 10 cm of a
          line: with 0.25 m roots almost every voxel passes at once. This slice is 2D and its points
          are generated; PV-LIO does the same in 3D with eight children per cut.
        </p>
      </div>
    </figure>
  )
}

function Picker<T extends number>({ label, values, value, set, fmt }: { label: string; values: readonly T[]; value: T; set: (v: T) => void; fmt: (v: T) => string }) {
  return (
    <div>
      <div className="mb-1 text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <button key={v} type="button" onClick={() => set(v)} aria-pressed={value === v}
            className={cn("cursor-pointer rounded border px-2 py-1 transition-colors", value === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {fmt(v)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
