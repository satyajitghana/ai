import { mcos, mlog, matan2 } from "@/lib/dmath"

// A 2-D constant-velocity Kalman filter, its seeded truth and its consistency
// statistics, shared by the FilterTuner widget. Pure functions of their inputs:
// the same scene renders identically on the server and in the browser.
//
// State x = [px, py, vx, vy], dt = 1. The truth is drawn from exactly the model
// the filter assumes (white acceleration of intensity Q_TRUE, position noise
// R_TRUE), so when the filter's q and r match those, NEES is chi-square and
// the averaged NEES sits inside its band.

export const STEPS = 90
export const RUNS = 16
export const Q_TRUE = 0.04
export const R_TRUE = 4 // variance, so sigma = 2

// chi-square bounds for the run-averaged NEES on position (2 dof, 16 runs):
// chi2.ppf([0.025, 0.975], 2 * 16) / 16, from scipy.
export const BAND: [number, number] = [1.143, 3.093]
// 95% ellipse for 2 dof: chi2.ppf(0.95, 2) = 5.991
export const ELL_K = 5.991

type M4 = number[][]

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s + 0.5) / 4294967296
  }
}

function gauss(r: () => number) {
  const u = r()
  const v = r()
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
}

// white-acceleration process noise for one axis pair, dt = 1
function Qm(q: number): M4 {
  return [
    [q / 3, 0, q / 2, 0],
    [0, q / 3, 0, q / 2],
    [q / 2, 0, q, 0],
    [0, q / 2, 0, q],
  ]
}

export type Scene = { truth: number[][]; meas: number[][][] }

// One truth trajectory, RUNS independent measurement sequences of it.
export function makeScene(): Scene {
  const r = rng(39)
  // sample w ~ N(0, Q_TRUE * [[1/3, 1/2], [1/2, 1]]) per axis via its Cholesky factor
  const l11 = Math.sqrt(1 / 3)
  const l21 = 0.5 / l11
  const l22 = Math.sqrt(1 - l21 * l21)
  const sq = Math.sqrt(Q_TRUE)
  let x = [0, 0, 2, -0.3]
  const truth: number[][] = []
  for (let k = 0; k < STEPS; k++) {
    truth.push(x)
    const ax = [gauss(r), gauss(r)]
    const ay = [gauss(r), gauss(r)]
    const wpx = sq * l11 * ax[0]
    const wvx = sq * (l21 * ax[0] + l22 * ax[1])
    const wpy = sq * l11 * ay[0]
    const wvy = sq * (l21 * ay[0] + l22 * ay[1])
    x = [x[0] + x[2] + wpx, x[1] + x[3] + wpy, x[2] + wvx, x[3] + wvy]
  }
  const sr = Math.sqrt(R_TRUE)
  const meas: number[][][] = []
  for (let m = 0; m < RUNS; m++) {
    const rm = rng(7919 * (m + 1))
    meas.push(truth.map((t) => [t[0] + sr * gauss(rm), t[1] + sr * gauss(rm)]))
  }
  return { truth, meas }
}

export type Run = {
  x: number[][] // posterior state per step
  P: number[][] // posterior position covariance [pxx, pxy, pyy] per step
  nees: number[] // position NEES per step
  nis: number[] // NIS per step
}

// Run the filter with assumed process intensity q and measurement variance r.
export function runFilter(meas: number[][], truth: number[][], q: number, r: number): Run {
  const Q = Qm(q)
  let x = [meas[0][0], meas[0][1], 0, 0]
  let P: M4 = [
    [r, 0, 0, 0],
    [0, r, 0, 0],
    [0, 0, 4, 0],
    [0, 0, 0, 4],
  ]
  const out: Run = { x: [], P: [], nees: [], nis: [] }
  for (let k = 0; k < meas.length; k++) {
    if (k > 0) {
      // predict: x = F x, P = F P F' + Q with F = [[I, I], [0, I]]
      x = [x[0] + x[2], x[1] + x[3], x[2], x[3]]
      const FP: M4 = [
        [P[0][0] + P[2][0], P[0][1] + P[2][1], P[0][2] + P[2][2], P[0][3] + P[2][3]],
        [P[1][0] + P[3][0], P[1][1] + P[3][1], P[1][2] + P[3][2], P[1][3] + P[3][3]],
        [P[2][0], P[2][1], P[2][2], P[2][3]],
        [P[3][0], P[3][1], P[3][2], P[3][3]],
      ]
      const N: M4 = FP.map((row) => [row[0] + row[2], row[1] + row[3], row[2], row[3]])
      P = N.map((row, i) => row.map((v, j) => v + Q[i][j]))
    }
    // update with z = [px, py] + v, H = [I 0]
    const z = meas[k]
    const y = [z[0] - x[0], z[1] - x[1]]
    const s00 = P[0][0] + r
    const s01 = P[0][1]
    const s11 = P[1][1] + r
    const det = s00 * s11 - s01 * s01
    const i00 = s11 / det
    const i01 = -s01 / det
    const i11 = s00 / det
    if (k > 0) out.nis.push(y[0] * (i00 * y[0] + i01 * y[1]) + y[1] * (i01 * y[0] + i11 * y[1]))
    else out.nis.push(NaN)
    // K = P H' S^-1 (4x2)
    const K = P.map((row) => [row[0] * i00 + row[1] * i01, row[0] * i01 + row[1] * i11])
    x = x.map((v, i) => v + K[i][0] * y[0] + K[i][1] * y[1])
    // Joseph form: P = (I - KH) P (I - KH)' + K R K'
    const I4 = [0, 1, 2, 3]
    const A: M4 = I4.map((i) => I4.map((j) => (i === j ? 1 : 0) - (j < 2 ? K[i][j] : 0)))
    const AP = I4.map((i) => I4.map((j) => I4.reduce((s, l) => s + A[i][l] * P[l][j], 0)))
    P = I4.map((i) =>
      I4.map((j) => I4.reduce((s, l) => s + AP[i][l] * A[j][l], 0) + r * (K[i][0] * K[j][0] + K[i][1] * K[j][1])),
    )
    const t = truth[k]
    const e = [t[0] - x[0], t[1] - x[1]]
    const d = P[0][0] * P[1][1] - P[0][1] * P[0][1]
    out.nees.push((e[0] * (P[1][1] * e[0] - P[0][1] * e[1]) + e[1] * (-P[0][1] * e[0] + P[0][0] * e[1])) / d)
    out.x.push(x)
    out.P.push([P[0][0], P[0][1], P[1][1]])
  }
  return out
}

// Ellipse of a 2x2 covariance at chi-square level k: semi-axes and angle.
export function ellipse(pxx: number, pxy: number, pyy: number, k = ELL_K) {
  const m = (pxx + pyy) / 2
  const d = Math.sqrt(((pxx - pyy) / 2) ** 2 + pxy * pxy)
  const l1 = m + d
  const l2 = Math.max(m - d, 0)
  const ang = 0.5 * matan2(2 * pxy, pxx - pyy)
  return { a: Math.sqrt(k * l1), b: Math.sqrt(k * l2), ang }
}
