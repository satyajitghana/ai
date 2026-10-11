import { matan2, mcos, mlog, msin } from "@/lib/dmath"

// A 2-D toy of drift and structure closure. Nothing here is StructureGS-SLAM's
// code (none has been released); it is the textbook version of the idea, small
// enough to read in one sitting.
//
// A robot drives a U around the inner block of a rectangular floor: 24 m east,
// 14 m north, 24 m west. It never comes back to where it started; it finishes
// 14 m north of it, beside the same long west wall it saw on the first metre.
//
// Odometry integrates a heading that gains a constant yaw bias per metre plus
// a little noise, and step lengths with 2% noise. Every wall the robot is
// within 4.5 m of (perpendicular foot inside the segment) is observed as a
// plane: its normal angle in the robot frame and its range, both slightly noisy.
//
// Three modes:
//   off          dead reckoning only
//   pgi          each wall becomes a persistent plane the first time it is seen.
//                When a plane that has been out of view for at least 10 m of
//                travel is seen again, its normal and offset are compared with
//                the stored ones. The heading residual is spread linearly over
//                every pose since the previous anchor (the exact least-squares
//                answer for a rotation chain with equal weights), the path is
//                re-integrated, and then the offset residual is spread the same
//                way along the plane's normal. One plane fixes heading and ONE
//                translation direction; the other direction is left alone.
//   manhattan    pgi, plus: every visible wall at every step pins the heading
//                to the nearest of the four axis directions of the first wall
//                ever seen (the Manhattan assumption), if within a 10 degree gate.
//
// "Skew" tilts the north outer wall by 6 degrees, so the floor is no longer
// square. Under the Manhattan assumption that wall drags the heading 6 degrees
// the wrong way for as long as it is in view.
//
// All noise levels, ranges and gates are toy values of mine.

export type Mode = "off" | "pgi" | "manhattan"
export type P2 = [number, number]

export type Wall = { id: string; a: P2; b: P2 }

const STEP = 0.25
const RANGE = 4.5
const GAP_M = 10
const GATE = (10 * Math.PI) / 180
const HEAD_NOISE = (0.05 * Math.PI) / 180
const LEN_NOISE = 0.02
const OBS_ANG_NOISE = (0.3 * Math.PI) / 180
const OBS_RANGE_NOISE = 0.02
const SKEW = (6 * Math.PI) / 180

export function walls(skew: boolean): Wall[] {
  const north: Wall = skew
    ? (() => {
        const cx = 12
        const cy = 16
        const h = 14
        const c = mcos(SKEW)
        const s = msin(SKEW)
        return { id: "north", a: [cx - h * c, cy - h * s], b: [cx + h * c, cy + h * s] }
      })()
    : { id: "north", a: [-2, 16], b: [26, 16] }
  return [
    { id: "west", a: [-2, -2], b: [-2, 16] },
    { id: "south", a: [-2, -2], b: [26, -2] },
    { id: "east", a: [26, -2], b: [26, 16] },
    north,
    { id: "block-s", a: [2, 2], b: [22, 2] },
    { id: "block-e", a: [22, 2], b: [22, 12] },
    { id: "block-n", a: [2, 12], b: [22, 12] },
    { id: "block-w", a: [2, 2], b: [2, 12] },
  ]
}

// True path: straight legs joined by quarter arcs of radius 2 m.
function truePath(): { p: P2[]; th: number[] } {
  const p: P2[] = []
  const th: number[] = []
  const R = 2
  const plan: Array<["line" | "arc", number]> = [
    ["line", 22],
    ["arc", (Math.PI / 2) * R],
    ["line", 10],
    ["arc", (Math.PI / 2) * R],
    ["line", 22],
  ]
  let x = 0
  let y = 0
  let h = 0
  p.push([x, y])
  th.push(h)
  for (const [kind, len] of plan) {
    const n = Math.round(len / STEP)
    const ds = len / n
    for (let i = 0; i < n; i++) {
      if (kind === "arc") {
        const dh = ds / R
        const hm = h + dh / 2
        x += ds * mcos(hm)
        y += ds * msin(hm)
        h += dh
      } else {
        x += ds * mcos(h)
        y += ds * msin(h)
      }
      p.push([x, y])
      th.push(h)
    }
  }
  return { p, th }
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

const wrap = (a: number) => {
  let r = a
  while (r > Math.PI) r -= 2 * Math.PI
  while (r < -Math.PI) r += 2 * Math.PI
  return r
}
const wrapQuarter = (a: number) => {
  let r = a
  while (r > Math.PI / 4) r -= Math.PI / 2
  while (r < -Math.PI / 4) r += Math.PI / 2
  return r
}

// Perpendicular foot from p onto wall; null if outside the segment or out of range.
function see(p: P2, w: Wall): { dir: number; rho: number } | null {
  const dx = w.b[0] - w.a[0]
  const dy = w.b[1] - w.a[1]
  const L2 = dx * dx + dy * dy
  const t = ((p[0] - w.a[0]) * dx + (p[1] - w.a[1]) * dy) / L2
  if (t < 0 || t > 1) return null
  const fx = w.a[0] + t * dx - p[0]
  const fy = w.a[1] + t * dy - p[1]
  const rho = Math.sqrt(fx * fx + fy * fy)
  if (rho > RANGE || rho < 1e-6) return null
  return { dir: matan2(fy, fx), rho }
}

export type Closure = { step: number; wall: string; dHeadingDeg: number; dOffset: number }

export type SimResult = {
  truth: P2[]
  odo: P2[]
  est: P2[]
  closures: Closure[]
  manhattanSteps: number
  finalErr: [number, number]
  ate: [number, number]
  headingErrDeg: [number, number]
  // The west wall as the robot re-observes it at the end, placed with the
  // odometry pose (a drifted ghost), and as the stored persistent plane.
  ghost: [P2, P2] | null
}

export function simulate(driftDegPerM: number, mode: Mode, skew: boolean): SimResult {
  const W = walls(skew)
  const { p: truth, th } = truePath()
  const N = truth.length - 1
  const r = rng(20261011)
  const gauss = () => Math.sqrt(-2 * mlog(Math.max(r(), 1e-9))) * mcos(2 * Math.PI * r())
  const bias = ((driftDegPerM * Math.PI) / 180) * STEP

  // Odometry increments (shared by every mode; same seed, same noise).
  const dTh: number[] = [0]
  const dLen: number[] = [0]
  for (let k = 1; k <= N; k++) {
    const dx = truth[k][0] - truth[k - 1][0]
    const dy = truth[k][1] - truth[k - 1][1]
    dTh.push(th[k] - th[k - 1] + bias + HEAD_NOISE * gauss())
    dLen.push(Math.sqrt(dx * dx + dy * dy) * (1 + LEN_NOISE * gauss()))
  }
  // Observations (also shared).
  const obs: Array<Array<{ id: string; phi: number; rho: number }>> = []
  for (let k = 0; k <= N; k++) {
    const list: Array<{ id: string; phi: number; rho: number }> = []
    W.forEach((w, wi) => {
      const s = see(truth[k], w)
      if (!s) return
      // Noise per (step, wall), so tilting one wall does not reshuffle the others.
      const ro = rng((20261011 + k * 7919 + wi * 104729) & 0x7fffffff)
      const g = () => Math.sqrt(-2 * mlog(Math.max(ro(), 1e-9))) * mcos(2 * Math.PI * ro())
      list.push({ id: w.id, phi: wrap(s.dir - th[k] + OBS_ANG_NOISE * g()), rho: s.rho + OBS_RANGE_NOISE * g() })
    })
    obs.push(list)
  }

  // Integrate a path from headings at each step (heading used for step k is hd[k]).
  const integrate = (hd: number[]): P2[] => {
    const out: P2[] = [[0, 0]]
    for (let k = 1; k <= N; k++) {
      const hm = (hd[k - 1] + hd[k]) / 2
      out.push([out[k - 1][0] + dLen[k] * mcos(hm), out[k - 1][1] + dLen[k] * msin(hm)])
    }
    return out
  }

  const hOdo: number[] = [0]
  for (let k = 1; k <= N; k++) hOdo.push(hOdo[k - 1] + dTh[k])
  const odo = integrate(hOdo)

  // Corrected estimate.
  const h = [...hOdo]
  let pos = integrate(h)
  const closures: Closure[] = []
  let manhattanSteps = 0
  let anchor = 0
  let mframe: number | null = null
  const planes = new Map<string, { alpha: number; d: number; lastSeen: number; lastS: number }>()
  const arc: number[] = [0]
  for (let k = 1; k <= N; k++) arc.push(arc[k - 1] + dLen[k])

  for (let k = 0; k <= N; k++) {
    if (k > 0) {
      // propagate heading from the (possibly corrected) previous pose
      h[k] = h[k - 1] + dTh[k]
      const hm = (h[k - 1] + h[k]) / 2
      pos[k] = [pos[k - 1][0] + dLen[k] * mcos(hm), pos[k - 1][1] + dLen[k] * msin(hm)]
    }
    if (mode === "off") continue

    // Manhattan: absolute heading from any visible wall, snapped to the frame.
    if (mode === "manhattan" && obs[k].length) {
      let sum = 0
      let n = 0
      for (const o of obs[k]) {
        const alpha = h[k] + o.phi
        if (mframe === null) mframe = alpha
        const res = wrapQuarter(mframe - alpha)
        if (Math.abs(res) < GATE) {
          sum += res
          n++
        }
      }
      if (n) {
        h[k] += sum / n
        manhattanSteps++
      }
    }

    // Persistent planes: register new ones, close on re-observation after a gap.
    for (const o of obs[k]) {
      const alpha = h[k] + o.phi
      const nx = mcos(alpha)
      const ny = msin(alpha)
      const d = nx * pos[k][0] + ny * pos[k][1] + o.rho
      const pl = planes.get(o.id)
      if (!pl) {
        planes.set(o.id, { alpha, d, lastSeen: k, lastS: arc[k] })
        continue
      }
      if (arc[k] - pl.lastS >= GAP_M) {
        // 1) rotation residual, spread linearly from the last anchor to k
        const rTh = wrap(pl.alpha - alpha)
        const span = k - anchor
        for (let j = anchor + 1; j <= k; j++) h[j] += (rTh * (j - anchor)) / span
        // 2) re-integrate positions from the anchor with corrected headings
        for (let j = anchor + 1; j <= k; j++) {
          const hm = (h[j - 1] + h[j]) / 2
          pos[j] = [pos[j - 1][0] + dLen[j] * mcos(hm), pos[j - 1][1] + dLen[j] * msin(hm)]
        }
        // 3) offset residual along the stored normal, spread the same way
        const cx = mcos(pl.alpha)
        const cy = msin(pl.alpha)
        const dNow = cx * pos[k][0] + cy * pos[k][1] + o.rho
        const rD = pl.d - dNow
        for (let j = anchor + 1; j <= k; j++) {
          const f = (j - anchor) / span
          pos[j] = [pos[j][0] + f * rD * cx, pos[j][1] + f * rD * cy]
        }
        closures.push({ step: k, wall: o.id, dHeadingDeg: (rTh * 180) / Math.PI, dOffset: rD })
        anchor = k
      }
      pl.lastSeen = k
      pl.lastS = arc[k]
    }
  }
  pos = pos.slice(0, N + 1)

  const err = (a: P2[]) => {
    let s = 0
    for (let k = 0; k <= N; k++) {
      const dx = a[k][0] - truth[k][0]
      const dy = a[k][1] - truth[k][1]
      s += dx * dx + dy * dy
    }
    const dx = a[N][0] - truth[N][0]
    const dy = a[N][1] - truth[N][1]
    return { ate: Math.sqrt(s / (N + 1)), fin: Math.sqrt(dx * dx + dy * dy) }
  }
  const eo = err(odo)
  const ee = err(pos)

  // Ghost: the west wall as seen at the last step, placed with the odometry pose.
  let ghost: [P2, P2] | null = null
  const last = obs[N].find((o) => o.id === "west")
  if (last) {
    const alpha = hOdo[N] + last.phi
    const fx = odo[N][0] + last.rho * mcos(alpha)
    const fy = odo[N][1] + last.rho * msin(alpha)
    const tx = -msin(alpha)
    const ty = mcos(alpha)
    ghost = [
      [fx - 9 * tx, fy - 9 * ty],
      [fx + 9 * tx, fy + 9 * ty],
    ]
  }

  return {
    truth,
    odo,
    est: pos,
    closures,
    manhattanSteps,
    finalErr: [eo.fin, ee.fin],
    ate: [eo.ate, ee.ate],
    headingErrDeg: [(wrap(hOdo[N] - th[N]) * 180) / Math.PI, (wrap(h[N] - th[N]) * 180) / Math.PI],
    ghost,
  }
}
