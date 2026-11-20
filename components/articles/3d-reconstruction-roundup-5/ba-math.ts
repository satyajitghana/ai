// A top-down toy of what pose noise does to triangulation and what bundle
// adjustment gives back. Cameras with known positions walk down the middle of
// a room, each seeing every wall point as a bearing (a 360 camera sees all
// directions). Their headings are perturbed. We triangulate with the noisy
// headings, then run Gauss-Newton bundle adjustment over every heading and
// every point at once, from the same observations.
import { matan2, mcos, mlog, msin } from "@/lib/dmath"

const sq = (x: number) => x * x

export type Vec = [number, number]

export const ROOM = { w: 8, h: 5 }

// Wall points: a room 8 m by 5 m centred on the origin, points spaced along the walls.
export function wallPoints(): Vec[] {
  const pts: Vec[] = []
  const hw = ROOM.w / 2
  const hh = ROOM.h / 2
  for (let i = 0; i < 6; i++) {
    const x = -hw + 0.6 + (i * (ROOM.w - 1.2)) / 5
    pts.push([x, hh], [x, -hh])
  }
  for (let i = 0; i < 3; i++) {
    const y = -hh + 1 + i * 1.5
    pts.push([hw, y], [-hw, y])
  }
  return pts
}

export function cameraPositions(m: number): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i < m; i++) {
    const t = m === 1 ? 0 : i / (m - 1)
    // a slightly wandering walk down the long axis
    out.push([-2.6 + 5.2 * t, 0.35 * msin(t * 5.2)])
  }
  return out
}

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

function gauss(r: () => number) {
  const u = Math.max(1e-12, r())
  const v = r()
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
}

const wrap = (a: number) => {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x < -Math.PI) x += 2 * Math.PI
  return x
}

const DEG = Math.PI / 180

function triangulate(cams: Vec[], heads: number[], obs: number[][], k: number): Vec {
  // least squares on the perpendicular distance to every ray
  let a = 0
  let b = 0
  let d = 0
  let ex = 0
  let ey = 0
  for (let j = 0; j < cams.length; j++) {
    const ang = heads[j] + obs[j][k]
    const nx = -msin(ang)
    const ny = mcos(ang)
    a += nx * nx
    b += nx * ny
    d += ny * ny
    const c = nx * cams[j][0] + ny * cams[j][1]
    ex += nx * c
    ey += ny * c
  }
  const det = a * d - b * b
  if (Math.abs(det) < 1e-12) return [0, 0]
  return [(d * ex - b * ey) / det, (a * ey - b * ex) / det]
}

function solve(A: number[][], y: number[]): number[] {
  const n = y.length
  const M = A.map((row, i) => [...row, y[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    const piv = M[c][c]
    if (Math.abs(piv) < 1e-14) continue
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv
      if (f === 0) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = Math.abs(M[r][r]) < 1e-14 ? 0 : s / M[r][r]
  }
  return x
}

function reprojCost(cams: Vec[], heads: number[], pts: Vec[], obs: number[][]) {
  let c = 0
  for (let j = 0; j < cams.length; j++)
    for (let k = 0; k < pts.length; k++) {
      const res = wrap(matan2(pts[k][1] - cams[j][1], pts[k][0] - cams[j][0]) - heads[j] - obs[j][k])
      c += res * res
    }
  // a step that throws a point far outside the room is refused: the walk is indoors
  for (const p of pts) if (Math.abs(p[0]) > 2 * ROOM.w || Math.abs(p[1]) > 2 * ROOM.h) return Infinity
  return c
}

// Levenberg-Marquardt bundle adjustment over every heading and every point.
function bundleAdjust(cams: Vec[], heads0: number[], pts0: Vec[], obs: number[][], iters: number) {
  const m = cams.length
  const n = pts0.length
  let heads = [...heads0]
  // start from the triangulated points, pulled inside the room when a ray pair ran off
  let pts = pts0.map((p) => [Math.max(-ROOM.w, Math.min(ROOM.w, p[0])), Math.max(-ROOM.h, Math.min(ROOM.h, p[1]))] as Vec)
  const dim = m + 2 * n
  let cost = reprojCost(cams, heads, pts, obs)
  let lambda = 1e-3
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: dim }, () => new Array<number>(dim).fill(0))
    const g = new Array<number>(dim).fill(0)
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < n; k++) {
        const dx = pts[k][0] - cams[j][0]
        const dy = pts[k][1] - cams[j][1]
        const r2 = dx * dx + dy * dy
        const res = wrap(matan2(dy, dx) - heads[j] - obs[j][k])
        // d res / d heading = -1, d res / d point = (-dy, dx) / r^2
        const idx = [j, m + 2 * k, m + 2 * k + 1]
        const J = [-1, -dy / r2, dx / r2]
        for (let a = 0; a < 3; a++) {
          g[idx[a]] += J[a] * res
          for (let b = 0; b < 3; b++) H[idx[a]][idx[b]] += J[a] * J[b]
        }
      }
    }
    for (let tries = 0; tries < 8; tries++) {
      const A = H.map((row, i) => row.map((v, k) => (i === k ? v * (1 + lambda) + 1e-9 : v)))
      const step = solve(A, g.map((v) => -v))
      const h2 = heads.map((h, j) => h + step[j])
      const p2 = pts.map((p, k) => [p[0] + step[m + 2 * k], p[1] + step[m + 2 * k + 1]] as Vec)
      const c2 = reprojCost(cams, h2, p2, obs)
      if (c2 < cost) {
        heads = h2
        pts = p2
        cost = c2
        lambda = Math.max(1e-7, lambda / 3)
        break
      }
      lambda *= 4
    }
  }
  return { heads, pts, rms: Math.sqrt(cost / (m * n)) }
}

const rmsDist = (a: Vec[], b: Vec[]) =>
  Math.sqrt(a.reduce((s, p, i) => s + sq(p[0] - b[i][0]) + sq(p[1] - b[i][1]), 0) / a.length)

export type Sim = ReturnType<typeof simulate>

export function simulate(nCams: number, rotNoiseDeg: number, pixNoiseDeg: number, seed: number) {
  const r = rng(seed)
  const truePts = wallPoints()
  const cams = cameraPositions(nCams)
  const trueHeads = cams.map((_, j) => (j * 37 * DEG) % (2 * Math.PI))
  // observed bearings relative to each camera's true heading, with pixel noise
  const obs = cams.map((c, j) =>
    truePts.map((p) => wrap(matan2(p[1] - c[1], p[0] - c[0]) - trueHeads[j] + gauss(r) * pixNoiseDeg * DEG)),
  )
  const noisyHeads = trueHeads.map((h) => h + gauss(r) * rotNoiseDeg * DEG)
  const tri = (heads: number[]) => truePts.map((_, k) => triangulate(cams, heads, obs, k))
  const ptsNoisy = tri(noisyHeads)
  const ptsTrue = tri(trueHeads)
  const ba = bundleAdjust(cams, noisyHeads, ptsNoisy, obs, 25)
  const headErr = (h: number[]) =>
    Math.sqrt(h.reduce((s, v, j) => s + sq(wrap(v - trueHeads[j])), 0) / h.length) / DEG
  return {
    cams,
    truePts,
    trueHeads,
    noisyHeads,
    ptsNoisy,
    ptsBA: ba.pts,
    headsBA: ba.heads,
    errNoisy: rmsDist(ptsNoisy, truePts),
    errBA: rmsDist(ba.pts, truePts),
    errTruePose: rmsDist(ptsTrue, truePts),
    headErrNoisy: headErr(noisyHeads),
    headErrBA: headErr(ba.heads),
    reprojBA: ba.rms / DEG,
  }
}
