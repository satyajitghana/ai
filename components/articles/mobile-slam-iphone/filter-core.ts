import { mcos, msin } from "@/lib/dmath"

import { gauss, inv3, mul3, mv3, raycast, rng, rot, segLine, wrap, type M3, type Seg, type V2 } from "./toy-geom"

// A planar caricature of core/lio.cpp's per-scan loop, written for this article.
// State is (heading, x, y) instead of the code's 15-D error state, the map is a
// set of wall segments instead of a hash-voxel map with a 5-point plane fit, and
// the scan is 144 rays with 1 cm noise. What is kept from the code:
//   - the prior comes from IMU propagation and carries a covariance P;
//   - each point is transformed with the current estimate, associated to the
//     nearest wall within sqrt(5) m (knn_max_d2 = 5.0), and gated by the code's
//     rule s = 1 - 0.9 |r| / sqrt(|p_body|) > 0.9;
//   - the update is the information-form iterated step of iekfUpdate():
//     A = P^-1 + H^T H / R, delta = -A^-1 H^T r / R + (A^-1 H^T H / R - I)(x - x_prior),
//     with R = laser_cov = 0.001, at most max_iter = 4 iterations, fewer than
//     20 effective points counted as degenerate, and P = (I - KH) P once at the end.

const RM = 0.001
const MAX_ITER = 4
const RAYS = 144
const MAX_R = 12
const BLIND = 0.5
const BG = (3 * Math.PI) / 180 // gyro bias, rad/s
const BA = 0.3 // accelerometer bias, m/s^2, along BA_DIR in the world
const BA_DIR = (40 * Math.PI) / 180

export type Scene = {
  name: string
  walls: Seg[]
  truth: { th: number; p: V2 }
  view: { x0: number; y0: number; w: number; h: number }
}

const ROOM: Scene = {
  name: "room",
  walls: [
    { a: [0, 0], b: [10, 0] },
    { a: [10, 0], b: [10, 7] },
    { a: [10, 7], b: [0, 7] },
    { a: [0, 7], b: [0, 0] },
    { a: [6.5, 4.4], b: [7.6, 4.4] },
    { a: [7.6, 4.4], b: [7.6, 5.4] },
    { a: [7.6, 5.4], b: [6.5, 5.4] },
    { a: [6.5, 5.4], b: [6.5, 4.4] },
    { a: [2.2, 7], b: [2.2, 5.2] },
  ],
  truth: { th: 0.35, p: [4, 3] },
  view: { x0: -0.6, y0: -0.6, w: 11.2, h: 8.2 },
}

const CORRIDOR: Scene = {
  name: "corridor",
  walls: [
    { a: [-40, 0], b: [60, 0] },
    { a: [-40, 2.4], b: [60, 2.4] },
  ],
  truth: { th: 0.1, p: [10, 1.2] },
  view: { x0: 4.4, y0: -2.9, w: 11.2, h: 8.2 },
}

export const SCENES = [ROOM, CORRIDOR]

type PtState = "used" | "gated" | "none"
type Stage = { th: number; p: V2; eff: number; rms: number; pts: { w: V2; s: PtState }[] }

function makeScan(sc: Scene): V2[] {
  const r = rng(7)
  const out: V2[] = []
  for (let k = 0; k < RAYS; k++) {
    const a = (2 * Math.PI * (k + 0.5 * r())) / RAYS
    const dw = rot(a, [1, 0])
    const t = raycast(sc.truth.p, dw, sc.walls, MAX_R)
    if (t === null || t < BLIND) continue
    const hit: V2 = [sc.truth.p[0] + dw[0] * (t + 0.01 * gauss(r)), sc.truth.p[1] + dw[1] * (t + 0.01 * gauss(r))]
    out.push(rot(-sc.truth.th, [hit[0] - sc.truth.p[0], hit[1] - sc.truth.p[1]]))
  }
  return out
}

function classify(sc: Scene, body: V2[], th: number, p: V2) {
  const pts: { w: V2; s: PtState; pb: V2; n?: V2; r?: number }[] = []
  let eff = 0
  let r2 = 0
  for (const pb of body) {
    const q = rot(th, pb)
    const w: V2 = [q[0] + p[0], q[1] + p[1]]
    let best: ReturnType<typeof segLine> | null = null
    for (const s of sc.walls) {
      const l = segLine(w, s)
      if (best === null || l.dist < best.dist) best = l
    }
    if (best === null || best.dist * best.dist > 5) {
      pts.push({ w, s: "none", pb })
      continue
    }
    const r = best.n[0] * w[0] + best.n[1] * w[1] + best.d
    const range = Math.sqrt(pb[0] * pb[0] + pb[1] * pb[1])
    if (1 - (0.9 * Math.abs(r)) / Math.sqrt(range) <= 0.9) {
      pts.push({ w, s: "gated", pb })
      continue
    }
    pts.push({ w, s: "used", pb, n: best.n, r })
    eff++
    r2 += r * r
  }
  return { pts, eff, rms: eff ? Math.sqrt(r2 / eff) : 0 }
}

export function run(sc: Scene, tau: number) {
  const body = makeScan(sc)
  const th0 = sc.truth.th + BG * tau
  const off = 0.5 * BA * tau * tau
  const p0: V2 = [sc.truth.p[0] + off * mcos(BA_DIR), sc.truth.p[1] + off * msin(BA_DIR)]
  const sth = 0.01 + 0.05 * tau
  const sp = 0.02 + 0.05 * tau + 0.25 * tau * tau
  const P: M3 = [sth * sth, 0, 0, 0, sp * sp, 0, 0, 0, sp * sp]
  const Pinv = inv3(P)

  let th = th0
  let p: V2 = [p0[0], p0[1]]
  const stages: Stage[] = []
  let KH: M3 = new Array(9).fill(0)
  let degenerate = false
  let eff = 0
  for (let it = 0; it <= MAX_ITER; it++) {
    const c = classify(sc, body, th, p)
    stages.push({ th, p: [p[0], p[1]], eff: c.eff, rms: c.rms, pts: c.pts.map(({ w, s }) => ({ w, s })) })
    if (it === MAX_ITER) break
    eff = c.eff
    if (c.eff < 20) {
      degenerate = true
      break
    }
    const HtH: M3 = new Array(9).fill(0)
    const Htr = [0, 0, 0]
    for (const q of c.pts) {
      if (q.s !== "used" || !q.n || q.r === undefined) continue
      const dR = rot(th, [-q.pb[1], q.pb[0]])
      const h = [q.n[0] * dR[0] + q.n[1] * dR[1], q.n[0], q.n[1]]
      for (let a = 0; a < 3; a++) {
        Htr[a] += h[a] * q.r
        for (let b = 0; b < 3; b++) HtH[a * 3 + b] += h[a] * h[b]
      }
    }
    const A = Pinv.map((v, k) => v + HtH[k] / RM)
    const Ainv = inv3(A)
    KH = mul3(Ainv, HtH).map((v) => v / RM)
    const dx = [wrap(th - th0), p[0] - p0[0], p[1] - p0[1]]
    const g = mv3(Ainv, Htr).map((v) => -v / RM)
    const corr = mv3(KH.map((v, k) => v - (k % 4 === 0 ? 1 : 0)), dx)
    const delta = [g[0] + corr[0], g[1] + corr[1], g[2] + corr[2]]
    th += delta[0]
    p = [p[0] + delta[1], p[1] + delta[2]]
    if (Math.abs(delta[0]) < 1e-4 && Math.sqrt(delta[1] * delta[1] + delta[2] * delta[2]) < 1e-3) {
      const c2 = classify(sc, body, th, p)
      stages.push({ th, p: [p[0], p[1]], eff: c2.eff, rms: c2.rms, pts: c2.pts.map(({ w, s }) => ({ w, s })) })
      break
    }
  }
  const IminusKH = KH.map((v, k) => (k % 4 === 0 ? 1 : 0) - v)
  const Ppost = eff >= 20 ? mul3(IminusKH, P) : P
  return { stages, P, Ppost, degenerate, rays: body.length }
}

