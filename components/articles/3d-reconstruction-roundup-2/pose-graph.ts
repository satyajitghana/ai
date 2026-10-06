import { matan2, mcos, msin } from "@/lib/dmath"

// A 2D pose graph you can read in full: the toy behind <LoopClosureToy />.
//
// Ground truth is a closed loop around a city block: 48 steps of 2 m, each
// side ten straight steps then two 45-degree turns, so the four sides are the
// same pattern rotated by 90 degrees and the loop closes exactly. Pose k is
// (x, y, heading); the step from k to k+1 moves 2 m forward along the heading
// and then turns.
//
// Odometry is what a streaming front end hands you: the relative pose of each
// step, in the frame of the earlier pose, with a little deterministic noise
// (a seeded LCG, so server and client agree) plus two systematic errors you
// control: a heading bias added to every turn, and optionally a scale drift
// that grows the measured step length linearly along the sequence.
//
// Dead reckoning composes those measurements from the start pose. Loop
// closure adds one more edge: the place-recognition step has matched the last
// frame to the first, and the loop window measured their relative pose. Pose
// graph optimisation then finds the 48 free poses (pose 0 is fixed) that
// minimise the sum of squared residuals of all 49 edges, by Gauss-Newton on
// SE(2) with a dense solve. That is CLoSeR's objective (sequential plus loop
// edges, on SE(n), no scale variable) in two dimensions instead of three, and
// without the Huber loss, since the toy has no wrong loops.
//
// Every number this produces is a property of this toy, not of CLoSeR.
// Transcendentals go through lib/dmath so server and client agree.

export type Pose = [number, number, number]

export const STEPS = 48
export const STEP_M = 2
const TURN = Math.PI / 4

export function wrap(a: number): number {
  return matan2(msin(a), mcos(a))
}

/** The turn applied after step k (radians). */
function turnAt(k: number): number {
  const inSide = k % 12
  return inSide >= 10 ? TURN : 0
}

function compose(p: Pose, rel: Pose): Pose {
  const c = mcos(p[2])
  const s = msin(p[2])
  return [p[0] + c * rel[0] - s * rel[1], p[1] + s * rel[0] + c * rel[1], p[2] + rel[2]]
}

export function groundTruth(): Pose[] {
  const out: Pose[] = [[0, 0, 0]]
  for (let k = 0; k < STEPS; k++) {
    out.push(compose(out[k], [STEP_M, 0, turnAt(k)]))
  }
  return out
}

/** Deterministic noise in [-1, 1], one stream per call. */
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s / 4294967296) * 2 - 1
  }
}

export type Edge = { i: number; j: number; z: Pose }

/**
 * Odometry edges k -> k+1.
 * biasDeg: heading error added to every step, in degrees.
 * scaleDrift: fractional growth of the measured step length by the last step
 *             (0.25 means the last step is measured 25% long).
 */
export function odometry(biasDeg: number, scaleDrift: number): Edge[] {
  const rnd = lcg(7)
  const bias = (biasDeg * Math.PI) / 180
  const edges: Edge[] = []
  for (let k = 0; k < STEPS; k++) {
    const scale = 1 + (scaleDrift * k) / (STEPS - 1)
    const fwd = STEP_M * scale * (1 + 0.02 * rnd())
    const side = 0.04 * rnd()
    const dth = turnAt(k) + bias + ((0.3 * Math.PI) / 180) * rnd()
    edges.push({ i: k, j: k + 1, z: [fwd, side, dth] })
  }
  return edges
}

/** The loop edge: last pose seen again at the first, measured relative pose. */
export function loopEdge(): Edge {
  return { i: STEPS, j: 0, z: [0.05, -0.03, (0.2 * Math.PI) / 180] }
}

export function deadReckon(edges: Edge[]): Pose[] {
  const out: Pose[] = [[0, 0, 0]]
  for (const e of edges) out.push(compose(out[e.i], e.z))
  return out
}

/** Residual of one edge: the measured relative pose against the current one. */
function residual(xi: Pose, xj: Pose, z: Pose): [number, number, number] {
  const c = mcos(xi[2])
  const s = msin(xi[2])
  const dx = xj[0] - xi[0]
  const dy = xj[1] - xi[1]
  return [c * dx + s * dy - z[0], -s * dx + c * dy - z[1], wrap(xj[2] - xi[2] - z[2])]
}

/** Solve A x = b in place (dense, partial pivoting). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    if (piv !== col) {
      const t = A[col]
      A[col] = A[piv]
      A[piv] = t
      const tb = b[col]
      b[col] = b[piv]
      b[piv] = tb
    }
    const d = A[col][col]
    if (Math.abs(d) < 1e-12) continue
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d
      if (f === 0) continue
      for (let c2 = col; c2 < n; c2++) A[r][c2] -= f * A[col][c2]
      b[r] -= f * b[col]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let acc = b[r]
    for (let c2 = r + 1; c2 < n; c2++) acc -= A[r][c2] * x[c2]
    x[r] = Math.abs(A[r][r]) < 1e-12 ? 0 : acc / A[r][r]
  }
  return x
}

/**
 * Gauss-Newton pose graph optimisation on SE(2). Pose 0 is held fixed.
 * Returns the optimised poses.
 */
export function optimise(init: Pose[], edges: Edge[], iters = 8): Pose[] {
  const x: Pose[] = init.map((p) => [p[0], p[1], p[2]])
  const n = (x.length - 1) * 3
  for (let it = 0; it < iters; it++) {
    const H: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
    const g = new Array<number>(n).fill(0)
    for (const e of edges) {
      const xi = x[e.i]
      const xj = x[e.j]
      const r = residual(xi, xj, e.z)
      const c = mcos(xi[2])
      const s = msin(xi[2])
      const dx = xj[0] - xi[0]
      const dy = xj[1] - xi[1]
      // d r / d x_i and d r / d x_j, rows = residual components.
      const A = [
        [-c, -s, -s * dx + c * dy],
        [s, -c, -c * dx - s * dy],
        [0, 0, -1],
      ]
      const B = [
        [c, s, 0],
        [-s, c, 0],
        [0, 0, 1],
      ]
      const blocks: [number, number[][]][] = []
      if (e.i > 0) blocks.push([(e.i - 1) * 3, A])
      if (e.j > 0) blocks.push([(e.j - 1) * 3, B])
      for (const [oa, Ja] of blocks) {
        for (let a = 0; a < 3; a++) {
          let acc = 0
          for (let k = 0; k < 3; k++) acc += Ja[k][a] * r[k]
          g[oa + a] += acc
        }
        for (const [ob, Jb] of blocks) {
          for (let a = 0; a < 3; a++) {
            for (let b2 = 0; b2 < 3; b2++) {
              let acc = 0
              for (let k = 0; k < 3; k++) acc += Ja[k][a] * Jb[k][b2]
              H[oa + a][ob + b2] += acc
            }
          }
        }
      }
    }
    const step = solve(
      H,
      g.map((v) => -v),
    )
    let maxStep = 0
    for (let p = 1; p < x.length; p++) {
      const o = (p - 1) * 3
      x[p] = [x[p][0] + step[o], x[p][1] + step[o + 1], x[p][2] + step[o + 2]]
      maxStep = Math.max(maxStep, Math.abs(step[o]), Math.abs(step[o + 1]))
    }
    if (maxStep < 1e-6) break
  }
  return x
}

/** Per-pose position error against ground truth, in metres. */
export function errors(est: Pose[], gt: Pose[]): number[] {
  return est.map((p, k) => Math.sqrt((p[0] - gt[k][0]) ** 2 + (p[1] - gt[k][1]) ** 2))
}

export function rmse(errs: number[]): number {
  return Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length)
}

export type ToyResult = {
  gt: Pose[]
  odo: Pose[]
  pgo: Pose[]
  odoErr: number[]
  pgoErr: number[]
  odoRmse: number
  pgoRmse: number
  gap: number
}

export function runToy(biasDeg: number, scaleDrift: number): ToyResult {
  const gt = groundTruth()
  const edges = odometry(biasDeg, scaleDrift)
  const odo = deadReckon(edges)
  const pgo = optimise(odo, [...edges, loopEdge()])
  const odoErr = errors(odo, gt)
  const pgoErr = errors(pgo, gt)
  const last = odo[STEPS]
  return {
    gt,
    odo,
    pgo,
    odoErr,
    pgoErr,
    odoRmse: rmse(odoErr),
    pgoRmse: rmse(pgoErr),
    gap: Math.sqrt(last[0] ** 2 + last[1] ** 2),
  }
}
