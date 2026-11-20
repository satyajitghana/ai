// Classical bundle adjustment in flatland, solved the way a real solver does it:
// Levenberg-Marquardt on the normal equations, with the points eliminated by
// the Schur complement so only the camera block is solved densely.
//
// Each camera is a 1D pinhole with a full pose (x, y, heading); it sees a point
// as one image coordinate u = x / z in its own frame. Camera 0 is held fixed
// (three of the four gauge freedoms of a 2D similarity); the fourth, scale, is
// left free on purpose, and the damping keeps the solve well posed.
import { macos, mcos, mlog, msin } from "@/lib/dmath"

export type Vec = [number, number]
export type Cam = { c: Vec; th: number }

export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gauss(r: () => number) {
  const u = Math.max(r(), 1e-12)
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * r())
}

export const NCAM = 5
export const NPT = 30
export const FPX = 400 // pixels per unit focal length

// world = R(th) [x, z] + c; at th = 0 the camera looks along +y
export function project(cam: Cam, X: Vec): { u: number; z: number } {
  const dx = X[0] - cam.c[0]
  const dy = X[1] - cam.c[1]
  const co = mcos(cam.th)
  const si = msin(cam.th)
  const x = co * dx + si * dy
  const z = -si * dx + co * dy
  return { u: x / z, z }
}

export type Scene = {
  cams: Cam[]
  pts: Vec[]
  obs: { cam: number; pt: number; u: number }[]
}

export function makeScene(pixNoise: number, seed: number, turnDeg = 40): Scene {
  const r = rng(seed)
  const cams: Cam[] = []
  for (let i = 0; i < NCAM; i++) {
    const t = i / (NCAM - 1)
    // a walk past a wall of points, turning a little toward the middle
    cams.push({ c: [-2.4 + 4.8 * t, 0.3 * msin(3 * t)], th: ((turnDeg * t - turnDeg / 2) * Math.PI) / 180 })
  }
  const pts: Vec[] = []
  for (let k = 0; k < NPT; k++) {
    pts.push([-3.4 + (6.8 * (k + 0.5)) / NPT + 0.2 * (r() - 0.5), 2.2 + 2.6 * r()])
  }
  const obs: Scene["obs"] = []
  for (let k = 0; k < NPT; k++)
    for (let i = 0; i < NCAM; i++) {
      const p = project(cams[i], pts[k])
      if (p.z > 0.3 && Math.abs(p.u) < 1.2) obs.push({ cam: i, pt: k, u: p.u + (pixNoise / FPX) * gauss(r) })
    }
  return { cams, pts, obs }
}

export type State = { cams: Cam[]; pts: Vec[] }

export function noisyStart(sc: Scene, poseNoise: number, seed: number): State {
  const r = rng(seed * 7919 + 1)
  const cams = sc.cams.map((c, i) =>
    i === 0
      ? { c: [c.c[0], c.c[1]] as Vec, th: c.th }
      : { c: [c.c[0] + 0.03 * poseNoise * gauss(r), c.c[1] + 0.03 * poseNoise * gauss(r)] as Vec, th: c.th + (poseNoise * Math.PI * gauss(r)) / 180 },
  )
  // points: perturbed copies of the truth, standing in for a rough initialiser
  const pts = sc.pts.map((p) => [p[0] + 0.03 * poseNoise * gauss(r), p[1] + 0.03 * poseNoise * gauss(r)] as Vec)
  return { cams, pts }
}

// Cold start: every camera at camera 0's pose, every point one unit along the
// ray of the first camera that sees it.
export function coldStart(sc: Scene): State {
  const c0 = sc.cams[0]
  const cams = sc.cams.map(() => ({ c: [c0.c[0], c0.c[1]] as Vec, th: c0.th }))
  const pts = sc.pts.map((_, k) => {
    const o = sc.obs.find((q) => q.pt === k)
    const u = o ? o.u : 0
    const co = mcos(c0.th)
    const si = msin(c0.th)
    // camera point (u, 1) to world
    return [c0.c[0] + co * u - si * 1, c0.c[1] + si * u + co * 1] as Vec
  })
  return { cams, pts }
}

export function cost(sc: Scene, s: State) {
  let e = 0
  for (const o of sc.obs) {
    const p = project(s.cams[o.cam], s.pts[o.pt])
    // a point behind the camera costs as if it projected far off the image
    const r = p.z > 1e-3 ? p.u - o.u : 10
    e += r * r
  }
  return 0.5 * e
}

// residual derivatives by central differences (exact enough for a toy, and deterministic)
function jac(cam: Cam, X: Vec) {
  const h = 1e-6
  const f = (cc: Cam, xx: Vec) => project(cc, xx).u
  const dc = [0, 0, 0]
  const dp = [0, 0]
  for (let a = 0; a < 3; a++) {
    const p1: Cam = { c: [cam.c[0], cam.c[1]], th: cam.th }
    const p2: Cam = { c: [cam.c[0], cam.c[1]], th: cam.th }
    if (a < 2) {
      p1.c[a] += h
      p2.c[a] -= h
    } else {
      p1.th += h
      p2.th -= h
    }
    dc[a] = (f(p1, X) - f(p2, X)) / (2 * h)
  }
  for (let a = 0; a < 2; a++) {
    const x1: Vec = [X[0], X[1]]
    const x2: Vec = [X[0], X[1]]
    x1[a] += h
    x2[a] -= h
    dp[a] = (f(cam, x1) - f(cam, x2)) / (2 * h)
  }
  return { dc, dp }
}

function solveDense(A: number[][], b: number[]) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r
    ;[M[i], M[piv]] = [M[piv], M[i]]
    const d = M[i][i] || 1e-12
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / d
      if (f === 0) continue
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c]
    x[i] = s / (M[i][i] || 1e-12)
  }
  return x
}

export type StepInfo = {
  state: State
  lambda: number
  cost: number
  accepted: boolean
  tries: number
  // the structure of this step's normal equations, for drawing
  H: number[][] // full (cams then points), magnitudes
  S: number[][] // Schur complement on the cameras
  nCamParams: number
  nPtParams: number
}

// One LM iteration. The free camera parameters are cameras 1..n-1 (3 each);
// every point has 2. H = J^T J is [[B, E], [E^T, C]], C block-diagonal (2x2 per
// point). Damped: B + lam*diag(B), C + lam*diag(C). Eliminate the points:
// S = B - E C^-1 E^T, solve S dc = -(gc - E C^-1 gp), then dp = C^-1 (-gp - E^T dc).
export function lmStep(sc: Scene, s: State, lambda: number): StepInfo {
  const nc = (s.cams.length - 1) * 3
  const np = s.pts.length * 2
  const B = Array.from({ length: nc }, () => new Array(nc).fill(0))
  const E = Array.from({ length: nc }, () => new Array(np).fill(0))
  const C = s.pts.map(() => [0, 0, 0]) // per point: c00, c01, c11
  const gc = new Array(nc).fill(0)
  const gp = new Array(np).fill(0)
  for (const o of sc.obs) {
    const cam = s.cams[o.cam]
    const X = s.pts[o.pt]
    const p = project(cam, X)
    const r = p.u - o.u
    const { dc, dp } = jac(cam, X)
    const ci = o.cam - 1 // -1 when camera 0 (fixed)
    const pk = o.pt * 2
    if (ci >= 0) {
      for (let a = 0; a < 3; a++) {
        gc[ci * 3 + a] += dc[a] * r
        for (let b = 0; b < 3; b++) B[ci * 3 + a][ci * 3 + b] += dc[a] * dc[b]
        for (let b = 0; b < 2; b++) E[ci * 3 + a][pk + b] += dc[a] * dp[b]
      }
    }
    gp[pk] += dp[0] * r
    gp[pk + 1] += dp[1] * r
    C[o.pt][0] += dp[0] * dp[0]
    C[o.pt][1] += dp[0] * dp[1]
    C[o.pt][2] += dp[1] * dp[1]
  }
  const c0 = cost(sc, s)
  let lam = lambda
  let tries = 0
  let best: State | null = null
  let bestCost = c0
  let S: number[][] = []
  while (tries < 8) {
    tries++
    // damped blocks
    const Bd = B.map((row, i) => row.map((v, j) => (i === j ? v + lam * (v + 1e-9) : v)))
    const Cinv = C.map(([a, b, d]) => {
      const a2 = a + lam * (a + 1e-9)
      const d2 = d + lam * (d + 1e-9)
      const det = a2 * d2 - b * b || 1e-18
      return [d2 / det, -b / det, a2 / det]
    })
    // S = Bd - E Cinv E^T ; rhs = -(gc - E Cinv gp)
    S = Bd.map((row) => [...row])
    const rhs = gc.map((g) => -g)
    for (let k = 0; k < s.pts.length; k++) {
      const [i00, i01, i11] = Cinv[k]
      const pk = k * 2
      const g0 = gp[pk]
      const g1 = gp[pk + 1]
      for (let a = 0; a < nc; a++) {
        const ea0 = E[a][pk]
        const ea1 = E[a][pk + 1]
        if (ea0 === 0 && ea1 === 0) continue
        const w0 = ea0 * i00 + ea1 * i01
        const w1 = ea0 * i01 + ea1 * i11
        rhs[a] += w0 * g0 + w1 * g1
        for (let b = 0; b < nc; b++) S[a][b] -= w0 * E[b][pk] + w1 * E[b][pk + 1]
      }
    }
    const dc = solveDense(S, rhs)
    // back-substitute the points
    const cams = s.cams.map((c, i) =>
      i === 0 ? c : { c: [c.c[0] + dc[(i - 1) * 3], c.c[1] + dc[(i - 1) * 3 + 1]] as Vec, th: c.th + dc[(i - 1) * 3 + 2] },
    )
    const pts = s.pts.map((p, k) => {
      const pk = k * 2
      let t0 = -gp[pk]
      let t1 = -gp[pk + 1]
      for (let a = 0; a < nc; a++) {
        t0 -= E[a][pk] * dc[a]
        t1 -= E[a][pk + 1] * dc[a]
      }
      const [i00, i01, i11] = Cinv[k]
      return [p[0] + i00 * t0 + i01 * t1, p[1] + i01 * t0 + i11 * t1] as Vec
    })
    const cand = { cams, pts }
    const c1 = cost(sc, cand)
    if (Number.isFinite(c1) && c1 < c0) {
      best = cand
      bestCost = c1
      lam = Math.max(lam / 3, 1e-7)
      break
    }
    lam = Math.min(lam * 4, 1e8)
  }
  // magnitudes of the undamped H for the picture
  const n = nc + np
  const H = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < nc; i++) for (let j = 0; j < nc; j++) H[i][j] = Math.abs(B[i][j])
  for (let i = 0; i < nc; i++)
    for (let j = 0; j < np; j++) {
      H[i][nc + j] = Math.abs(E[i][j])
      H[nc + j][i] = Math.abs(E[i][j])
    }
  C.forEach(([a, b, d], k) => {
    H[nc + 2 * k][nc + 2 * k] = Math.abs(a)
    H[nc + 2 * k][nc + 2 * k + 1] = Math.abs(b)
    H[nc + 2 * k + 1][nc + 2 * k] = Math.abs(b)
    H[nc + 2 * k + 1][nc + 2 * k + 1] = Math.abs(d)
  })
  return {
    state: best ?? s,
    lambda: lam,
    cost: bestCost,
    accepted: best !== null,
    tries,
    H,
    S: S.map((row) => row.map((v) => Math.abs(v))),
    nCamParams: nc,
    nPtParams: np,
  }
}

// error after the best similarity that maps the estimate onto the truth
// (removes the gauge): RMS camera-centre error in metres, mean heading error in degrees
export function poseError(sc: Scene, s: State) {
  const A = s.cams.map((c) => c.c)
  const Bv = sc.cams.map((c) => c.c)
  const n = A.length
  let ax = 0
  let ay = 0
  let bx = 0
  let by = 0
  for (let i = 0; i < n; i++) {
    ax += A[i][0] / n
    ay += A[i][1] / n
    bx += Bv[i][0] / n
    by += Bv[i][1] / n
  }
  let sxx = 0
  let sxy = 0
  let va = 0
  for (let i = 0; i < n; i++) {
    const x1 = A[i][0] - ax
    const y1 = A[i][1] - ay
    const x2 = Bv[i][0] - bx
    const y2 = Bv[i][1] - by
    sxx += x1 * x2 + y1 * y2
    sxy += x1 * y2 - y1 * x2
    va += x1 * x1 + y1 * y1
  }
  const norm = Math.sqrt(sxx * sxx + sxy * sxy)
  const sc2 = va > 1e-12 ? norm / va : 1
  const co = norm > 0 ? (sxx / norm) * sc2 : sc2
  const si = norm > 0 ? (sxy / norm) * sc2 : 0
  const ang = norm > 0 ? Math.sign(sxy) * macos(Math.max(-1, Math.min(1, sxx / norm))) : 0
  const map = (q: Vec): Vec => [co * (q[0] - ax) - si * (q[1] - ay) + bx, si * (q[0] - ax) + co * (q[1] - ay) + by]
  let pe = 0
  let he = 0
  const cams = s.cams.map((c) => ({ c: map(c.c), th: c.th + ang }))
  cams.forEach((c, i) => {
    pe += (c.c[0] - Bv[i][0]) ** 2 + (c.c[1] - Bv[i][1]) ** 2
    let d = c.th - sc.cams[i].th
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    he += Math.abs(d)
  })
  return {
    posRms: Math.sqrt(pe / n),
    headDeg: ((he / n) * 180) / Math.PI,
    aligned: { cams, pts: s.pts.map(map) },
  }
}
