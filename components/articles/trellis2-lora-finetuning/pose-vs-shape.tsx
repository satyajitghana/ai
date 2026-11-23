"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The blog's three geometry metrics, run on a 2D shoe outline, to separate two ways a
// generated shape can be "wrong": it can be rotated, or its sole can be the wrong shape.
// Both outlines are normalized the way scripts/eval_geometry.py normalizes meshes (centre
// the bounding box, scale the longest side to 1), points are sampled along the outline,
// and the metrics follow that script: Chamfer = mean nearest distance both ways, F-score at
// tau = 2% of the reference's bounding-box diagonal, normal consistency = mean |cos| between
// matched normals. "Best of 4" tries the four right-angle rotations and keeps the best
// F-score, the 2D cousin of searching the 24 axis-aligned rotations of a cube.
// A toy outline, not a GSO shoe and not TRELLIS.2 output.

type Pt = [number, number]

const OUTLINE: Pt[] = [
  [0.0, 0.14], [0.02, 0.03], [0.2, 0.0], [0.5, 0.0], [0.8, 0.0], [0.96, 0.02], [1.0, 0.08],
  [0.96, 0.15], [0.8, 0.22], [0.62, 0.27], [0.5, 0.36], [0.4, 0.42], [0.2, 0.42], [0.06, 0.36],
]
const N = 360

function resample(poly: Pt[], n: number) {
  const segs: { a: Pt; b: Pt; len: number }[] = []
  let total = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
    segs.push({ a, b, len })
    total += len
  }
  const pts: Pt[] = []
  const nrm: Pt[] = []
  let si = 0
  let acc = 0
  for (let k = 0; k < n; k++) {
    const s = (k / n) * total
    while (acc + segs[si].len < s) {
      acc += segs[si].len
      si++
    }
    const { a, b, len } = segs[si]
    const t = len ? (s - acc) / len : 0
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    nrm.push([(b[1] - a[1]) / len, -(b[0] - a[0]) / len])
  }
  return { pts, nrm }
}

function soleError(poly: Pt[], e: number): Pt[] {
  // a wrong sole: the bottom edge bulges up through the arch, the heel drops
  return poly.map(([x, y]) => (y < 0.05 ? [x, y + e * (0.09 * msin(Math.PI * x) - 0.04 * (1 - x))] : [x, y]))
}

function normalize(pts: Pt[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = Math.max(x1 - x0, y1 - y0) || 1
  return pts.map(([x, y]) => [(x - cx) / s, (y - cy) / s] as Pt)
}

function rotate(pts: Pt[], deg: number): Pt[] {
  const a = (deg * Math.PI) / 180, c = mcos(a), s = msin(a)
  return pts.map(([x, y]) => [c * x - s * y, s * x + c * y])
}

function metrics(gen: Pt[], gn: Pt[], gt: Pt[], tn: Pt[]) {
  const near = (from: Pt[], to: Pt[]) => {
    const d: number[] = [], idx: number[] = []
    for (const p of from) {
      let bd = Infinity, bi = 0
      for (let j = 0; j < to.length; j++) {
        const dd = (p[0] - to[j][0]) ** 2 + (p[1] - to[j][1]) ** 2
        if (dd < bd) { bd = dd; bi = j }
      }
      d.push(Math.sqrt(bd)); idx.push(bi)
    }
    return { d, idx }
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of gt) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const tau = 0.02 * Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
  const g2t = near(gen, gt), t2g = near(gt, gen)
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  const prec = mean(g2t.d.map((d) => (d < tau ? 1 : 0)))
  const rec = mean(t2g.d.map((d) => (d < tau ? 1 : 0)))
  const f = prec + rec ? (2 * prec * rec) / (prec + rec) : 0
  const ncg = mean(gn.map((n, i) => Math.abs(n[0] * tn[g2t.idx[i]][0] + n[1] * tn[g2t.idx[i]][1])))
  const nct = mean(tn.map((n, i) => Math.abs(n[0] * gn[t2g.idx[i]][0] + n[1] * gn[t2g.idx[i]][1])))
  return { cd: mean(g2t.d) + mean(t2g.d), f, nc: 0.5 * (ncg + nct) }
}

export function PoseVsShape() {
  const [deg, setDeg] = useState(90)
  const [err, setErr] = useState(0)
  const [view, setView] = useState<"raw" | "best">("raw")

  const res = useMemo(() => {
    const ref = resample(OUTLINE, N)
    const gt = normalize(ref.pts)
    const g = resample(soleError(OUTLINE, err / 100), N)
    const score = (d: number) => {
      const p = normalize(rotate(g.pts, d))
      const n = rotate(g.nrm, d)
      return { pts: p, m: metrics(p, n, gt, ref.nrm) }
    }
    const raw = score(deg)
    let best = raw
    let bestDeg = deg
    for (const k of [90, 180, 270]) {
      const s = score(deg + k)
      if (s.m.f > best.m.f) { best = s; bestDeg = (deg + k) % 360 }
    }
    return { gt, raw, best, bestDeg }
  }, [deg, err])

  const W = 640, H = 300
  const P = (pts: Pt[], ox: number) => pts.map(([x, y]) => `${(ox + x * 240).toFixed(1)},${(H / 2 - y * 240).toFixed(1)}`).join(" ")
  const shown = view === "raw" ? res.raw : res.best

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">a rotated shoe against a wrong shoe, on the blog&apos;s metrics</span>
        <div className="flex gap-1">
          {(["raw", "best"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "raw" ? "as generated" : "best of 4 rotations"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two shoe outlines overlaid: the reference in grey and the generated one in orange, normalized to a unit box." className="w-full rounded-md border bg-muted/20">
          <polygon points={P(res.gt, W / 2)} fill="none" stroke="var(--muted-foreground)" strokeWidth="3" opacity="0.55" />
          <polygon points={P(shown.pts, W / 2)} fill="none" stroke="#c8501e" strokeWidth="2" />
          <text x={10} y={18} fontSize="11" className="fill-muted-foreground font-mono">grey: reference · orange: generated, after the eval&apos;s box normalization</text>
        </svg>

        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-3">
          {[["as generated", res.raw.m], ["best of 4 rotations", res.best.m]].map(([label, m]) => {
            const mm = m as { cd: number; f: number; nc: number }
            return (
              <div key={label as string} className="sm:col-span-3">
                <span className="text-muted-foreground">{label as string}: </span>
                Chamfer {mm.cd.toFixed(3)} · F@2% <span className="text-foreground">{mm.f.toFixed(2)}</span> · normal cons. {mm.nc.toFixed(2)}
              </div>
            )
          })}
          <div className="sm:col-span-3 text-muted-foreground">the search turned it a further {(res.bestDeg - deg + 360) % 360}°</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-mono text-xs">
            <span>generated shoe rotated by {deg}°</span>
            <Range min={0} max={180} step={5} value={deg} accent="#c8501e" onChange={(e) => setDeg(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span>sole wrong by {err}%</span>
            <Range min={0} max={100} step={5} value={err} onChange={(e) => setErr(Number(e.target.value))} />
          </label>
        </div>

        <figcaption className="mt-3 text-xs text-muted-foreground">
          Start with a perfect shape (sole 0%) turned 90°: the as-generated F-score collapses although nothing about the shape
          is wrong, and the best right-angle rotation gives it all back. Now set the rotation to 0 and bend the sole: the score
          falls and no rotation helps. A tilt that is not a right angle (try 30°) is not recovered at all by the four-way search,
          which is why a finer alignment matters before blaming the geometry. Computed live on a toy outline with the
          eval script&apos;s normalization and thresholds; not TRELLIS.2 output.
        </figcaption>
      </div>
    </figure>
  )
}
