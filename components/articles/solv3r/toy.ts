// A linear stand-in for a multi-view solve, used by the solver widget and run under Node to produce the numbers the
// article quotes. Cameras sit on a ring; every pair of cameras within OVERLAP places of each other "sees" the other
// and contributes one noisy relative-offset measurement. Camera 0 is the reference and never moves (it fixes the
// world frame, the job Solv3R's reference camera token does). One "solver call" is one Jacobi sweep: every camera in
// the active set moves to the average position its measurements imply, given the current positions of the cameras
// it overlaps with inside that set. The update has no step index, so it is a stationary solver in the paper's sense.
import { mcos, msin } from "@/lib/dmath"

export const N_MAX = 40
export const OVERLAP = 8

export type Pt = [number, number]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Scene = {
  truth: Pt[]
  guess: Pt[] // the "encoding" a camera starts from: far from its solved position
  meas: Map<number, Pt> // key i*N_MAX+j: measured x_j - x_i
  nbr: number[][]
}

export function makeScene(seed = 7): Scene {
  const rnd = mulberry32(seed)
  const truth: Pt[] = []
  for (let i = 0; i < N_MAX; i++) {
    const th = (2 * Math.PI * i) / N_MAX
    truth.push([mcos(th), 0.62 * msin(th)])
  }
  const meas = new Map<number, Pt>()
  const nbr: number[][] = truth.map(() => [])
  for (let i = 0; i < N_MAX; i++)
    for (let j = i + 1; j < N_MAX; j++) {
      const d = Math.min(j - i, N_MAX - (j - i))
      if (d > OVERLAP) continue
      const n: Pt = [(rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.04]
      const m: Pt = [truth[j][0] - truth[i][0] + n[0], truth[j][1] - truth[i][1] + n[1]]
      meas.set(i * N_MAX + j, m)
      meas.set(j * N_MAX + i, [-m[0], -m[1]])
      nbr[i].push(j)
      nbr[j].push(i)
    }
  const guess: Pt[] = truth.map((p, i) => (i === 0 ? [p[0], p[1]] : [p[0] + (rnd() - 0.5) * 1.2, p[1] + (rnd() - 0.5) * 1.2]))
  return { truth, guess, meas, nbr }
}

/** One solver call on the cameras in `active`: each non-reference camera in it moves to the mean of
 *  (x_j - m_ij) over the cameras j it overlaps with that are also in `active`. Cameras outside `active` are not read. */
export function call(s: Scene, x: Pt[], active: number[]): Pt[] {
  const inSet = new Set(active)
  const y = x.map((p) => [p[0], p[1]] as Pt)
  for (const i of active) {
    if (i === 0) continue
    let sx = 0
    let sy = 0
    let k = 0
    for (const j of s.nbr[i]) {
      if (!inSet.has(j)) continue
      const m = s.meas.get(i * N_MAX + j)!
      sx += x[j][0] - m[0]
      sy += x[j][1] - m[1]
      k++
    }
    if (k > 0) y[i] = [sx / k, sy / k]
  }
  return y
}

/** Relative state update between consecutive calls, the stopping criterion of the paper's Eq. 5. */
export function relUpdate(a: Pt[], b: Pt[], idx: number[]): number {
  let num = 0
  let den = 0
  for (const i of idx) {
    const dx = b[i][0] - a[i][0]
    const dy = b[i][1] - a[i][1]
    num += dx * dx + dy * dy
    den += a[i][0] * a[i][0] + a[i][1] * a[i][1]
  }
  return Math.sqrt(num) / Math.sqrt(Math.max(den, 1e-12))
}

/** RMS distance to the true positions over the cameras in idx (excluding the reference). */
export function rmsErr(s: Scene, x: Pt[], idx: number[]): number {
  let e = 0
  let n = 0
  for (const i of idx) {
    if (i === 0) continue
    const dx = x[i][0] - s.truth[i][0]
    const dy = x[i][1] - s.truth[i][1]
    e += dx * dx + dy * dy
    n++
  }
  return n ? Math.sqrt(e / n) : 0
}

export function range(a: number, b: number): number[] {
  const r: number[] = []
  for (let i = a; i < b; i++) r.push(i)
  return r
}

/** A deterministic block of `size` cameras drawn from `pool` for call number `k` (always includes camera 0 when
 *  withRef). */
export function block(pool: number[], size: number, k: number, withRef: boolean): number[] {
  const rnd = mulberry32(1000 + k * 7919)
  const cand = pool.filter((i) => !(withRef && i === 0))
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = cand[i]
    cand[i] = cand[j]
    cand[j] = t
  }
  const out = cand.slice(0, withRef ? size - 1 : size)
  return withRef ? [0, ...out] : out
}
