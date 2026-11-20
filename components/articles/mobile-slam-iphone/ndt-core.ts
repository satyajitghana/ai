import { mexp, mlog } from "@/lib/dmath"

import { gauss, raycast, rng, rot, type Seg, type V2 } from "./toy-geom"

// A planar version of core/ndt.cpp, written for this article. The map is cut
// into 1 m cells (ndt_res = 1.0); a cell with at least 6 points keeps a mean
// and a covariance whose small eigenvalues are lifted to max(0.01 lambda_max,
// 1e-4), as NdtMap::build does. A scan point scores against its own cell and
// the face neighbours (the code's DIRECT7 becomes DIRECT5 in 2D), with the
// Magnusson constants for outlier ratio 0.55 (with 1 m cells, r^2 here equals
// the code's r^3), and Gauss-Newton steps clamped to 0.5 m and 0.2 rad. "Match"
// is the code's: the fraction of points within q < 9 of some cell.
// The global search is Lio::globalSearch() with roll and pitch removed: 12
// headings, the guess and four points 1 m away, 12 coarse iterations each,
// then 60 fine iterations from the best score, accepted at match >= 0.45.

const RES = 1
const MIN_PTS = 6
const OUT = 0.55
const C1 = 10 * (1 - OUT)
const C2 = OUT / (RES * RES)
const D3 = -mlog(C2)
const D1 = -mlog(C1 + C2) - D3
const D2 = -2 * mlog((-mlog(C1 * mexp(-0.5) + C2) - D3) / D1)

// The floor plan, then moved so the map origin (where mapping started) is in the room.
const OX = 5
const OY = 4
const PLAN: Seg[] = [
  { a: [0, 0], b: [11, 0] },
  { a: [11, 0], b: [11, 4.5] },
  { a: [11, 4.5], b: [8.5, 4.5] },
  { a: [8.5, 4.5], b: [8.5, 7.5] },
  { a: [8.5, 7.5], b: [0, 7.5] },
  { a: [0, 7.5], b: [0, 0] },
  { a: [3, 3], b: [4.2, 3] },
  { a: [4.2, 3], b: [4.2, 4.1] },
  { a: [4.2, 4.1], b: [3, 4.1] },
  { a: [3, 4.1], b: [3, 3] },
  { a: [6.2, 0], b: [6.2, 2] },
  { a: [1.4, 7.5], b: [1.4, 6.2] },
]
export const WALLS: Seg[] = PLAN.map((w) => ({ a: [w.a[0] - OX, w.a[1] - OY] as V2, b: [w.b[0] - OX, w.b[1] - OY] as V2 }))
export const TRUTH = { th: -0.5, p: [6.4 - OX, 4.6 - OY] as V2 }

type Cell = { mu: V2; icov: [number, number, number]; cov: [number, number, number] }

function buildMap() {
  const r = rng(11)
  const pts: V2[] = []
  for (const w of WALLS) {
    const dx = w.b[0] - w.a[0]
    const dy = w.b[1] - w.a[1]
    const L = Math.sqrt(dx * dx + dy * dy)
    const n = Math.max(2, Math.round(L / 0.07))
    for (let i = 0; i <= n; i++) {
      const u = i / n
      pts.push([w.a[0] + u * dx + 0.015 * gauss(r), w.a[1] + u * dy + 0.015 * gauss(r)])
    }
  }
  const acc = new Map<string, { s: V2; xx: number; xy: number; yy: number; n: number }>()
  for (const p of pts) {
    const key = `${Math.floor(p[0] / RES)},${Math.floor(p[1] / RES)}`
    const a = acc.get(key) ?? { s: [0, 0] as V2, xx: 0, xy: 0, yy: 0, n: 0 }
    a.s = [a.s[0] + p[0], a.s[1] + p[1]]
    a.xx += p[0] * p[0]
    a.xy += p[0] * p[1]
    a.yy += p[1] * p[1]
    a.n++
    acc.set(key, a)
  }
  const cells = new Map<string, Cell>()
  for (const [key, a] of acc) {
    if (a.n < MIN_PTS) continue
    const mu: V2 = [a.s[0] / a.n, a.s[1] / a.n]
    const cxx = (a.xx - a.n * mu[0] * mu[0]) / (a.n - 1)
    const cxy = (a.xy - a.n * mu[0] * mu[1]) / (a.n - 1)
    const cyy = (a.yy - a.n * mu[1] * mu[1]) / (a.n - 1)
    // eigen-decompose, lift the small eigenvalue, rebuild
    const m = (cxx + cyy) / 2
    const q = Math.sqrt(((cxx - cyy) / 2) * ((cxx - cyy) / 2) + cxy * cxy)
    const l1 = m + q
    if (!(l1 > 0)) continue
    const l2 = Math.max(m - q, Math.max(0.01 * l1, 1e-4))
    // unit eigenvector of l1
    let vx = cxy
    let vy = l1 - cxx
    if (Math.abs(vx) + Math.abs(vy) < 1e-12) {
      vx = cxx >= cyy ? 1 : 0
      vy = cxx >= cyy ? 0 : 1
    }
    const vn = Math.sqrt(vx * vx + vy * vy)
    vx /= vn
    vy /= vn
    const cov: [number, number, number] = [
      l1 * vx * vx + l2 * vy * vy,
      (l1 - l2) * vx * vy,
      l1 * vy * vy + l2 * vx * vx,
    ]
    const icov: [number, number, number] = [
      (vx * vx) / l1 + (vy * vy) / l2,
      vx * vy * (1 / l1 - 1 / l2),
      (vy * vy) / l1 + (vx * vx) / l2,
    ]
    cells.set(key, { mu, icov, cov })
  }
  return { pts, cells }
}

function makeScan(): V2[] {
  const r = rng(5)
  const out: V2[] = []
  const N = 110
  for (let k = 0; k < N; k++) {
    const a = (2 * Math.PI * (k + 0.5 * r())) / N
    const d = rot(a, [1, 0])
    const t = raycast(TRUTH.p, d, WALLS, 15)
    if (t === null || t < 0.4) continue
    const tt = t + 0.01 * gauss(r)
    out.push(rot(-TRUTH.th, [d[0] * tt, d[1] * tt]))
  }
  return out
}

export const MAP = buildMap()
export const SCAN = makeScan()
const NB: V2[] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export type Pose = { th: number; p: V2 }
type Eval = { score: number; match: number; matched: boolean[] }

export function align(start: Pose, maxIter: number) {
  let th = start.th
  let p: V2 = [start.p[0], start.p[1]]
  const hist: (Pose & Eval)[] = []
  for (let it = 0; it < maxIter; it++) {
    let h00 = 0, h01 = 0, h02 = 0, h11 = 0, h12 = 0, h22 = 0
    let g0 = 0, g1 = 0, g2 = 0
    let score = 0
    let nm = 0
    const matched: boolean[] = []
    for (const pb of SCAN) {
      const q = rot(th, pb)
      const x: V2 = [q[0] + p[0], q[1] + p[1]]
      const ix = Math.floor(x[0] / RES)
      const iy = Math.floor(x[1] / RES)
      // J = d x / d [tx, ty, dtheta] for x' = Exp(dtheta) x + t: [I, (-x_y, x_x)]
      const jt: V2 = [-x[1], x[0]]
      let m = false
      for (const o of NB) {
        const c = MAP.cells.get(`${ix + o[0]},${iy + o[1]}`)
        if (!c) continue
        const dx = x[0] - c.mu[0]
        const dy = x[1] - c.mu[1]
        const Cx = c.icov[0] * dx + c.icov[1] * dy
        const Cy = c.icov[1] * dx + c.icov[2] * dy
        const qq = dx * Cx + dy * Cy
        if (qq > 50) continue
        const e = mexp(-0.5 * D2 * qq)
        score += -D1 * e
        if (qq < 9) m = true
        const w = -D1 * D2 * e
        // C J columns
        const cj2x = c.icov[0] * jt[0] + c.icov[1] * jt[1]
        const cj2y = c.icov[1] * jt[0] + c.icov[2] * jt[1]
        h00 += w * c.icov[0]
        h01 += w * c.icov[1]
        h11 += w * c.icov[2]
        h02 += w * cj2x
        h12 += w * cj2y
        h22 += w * (jt[0] * cj2x + jt[1] * cj2y)
        g0 += w * Cx
        g1 += w * Cy
        g2 += w * (jt[0] * Cx + jt[1] * Cy)
      }
      matched.push(m)
      if (m) nm++
    }
    hist.push({ th, p: [p[0], p[1]], score: score / SCAN.length, match: nm / SCAN.length, matched })
    // solve (H + 1e-6 I) delta = -g, 3x3, by Cramer
    const a = h00 + 1e-6, b = h01, c = h02, d = h11 + 1e-6, e = h12, f = h22 + 1e-6
    const det = a * (d * f - e * e) - b * (b * f - e * c) + c * (b * e - d * c)
    if (!(Math.abs(det) > 0)) break
    const r0 = -g0, r1 = -g1, r2 = -g2
    let dtx = (r0 * (d * f - e * e) - b * (r1 * f - e * r2) + c * (r1 * e - d * r2)) / det
    let dty = (a * (r1 * f - e * r2) - r0 * (b * f - e * c) + c * (b * r2 - r1 * c)) / det
    let dth = (a * (d * r2 - r1 * e) - b * (b * r2 - r1 * c) + r0 * (b * e - d * c)) / det
    if (!Number.isFinite(dtx + dty + dth)) break
    const nt = Math.sqrt(dtx * dtx + dty * dty)
    if (nt > 0.5) {
      dtx *= 0.5 / nt
      dty *= 0.5 / nt
    }
    if (Math.abs(dth) > 0.2) dth *= 0.2 / Math.abs(dth)
    const rp = rot(dth, p)
    p = [rp[0] + dtx, rp[1] + dty]
    th = th + dth
    if (Math.sqrt(dtx * dtx + dty * dty + dth * dth) < 1e-4) break
  }
  return hist
}

export function globalSearch(guess: V2) {
  const cands: { p: V2; th: number; score: number }[] = []
  let best: (Pose & Eval) | null = null
  for (let k = 0; k < 12; k++) {
    const yaw = (2 * Math.PI * k) / 12
    for (const o of NB) {
      const h = align({ th: yaw, p: [guess[0] + o[0], guess[1] + o[1]] }, 12)
      const end = h[h.length - 1]
      cands.push({ p: end.p, th: end.th, score: end.score })
      if (!best || end.score > best.score) best = end
    }
  }
  const fine = best ? align({ th: best.th, p: best.p }, 60) : []
  return { cands, fine }
}

