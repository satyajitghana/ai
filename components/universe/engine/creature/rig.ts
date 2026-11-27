// The creature toolkit, part 3: posing. Closed-form locomotion written straight into a bone palette.
//
// Nothing here integrates. A pose is a function of four numbers the scene supplies per animal:
// the distance it has travelled along its path, the time, its scale and its seed. So `seek`
// reproduces live play, and running the clock backwards walks the animal backwards over the same
// footprints.
//
//  - The spine is not a chain of angles: every spine frame is placed on the path at its own
//    distance (frame x ahead of the model origin), so the body turns along a curve by itself, and
//    girdle sway, weight shift, bob, the tail's follow-through and a swimmer's travelling wave are
//    displacement fields added on top. Frame orientation is taken from the finished curve.
//  - A foot's plant point depends only on which stride it is in (an integer) and on the path, so
//    it is the same world point for the whole of stance: the body advances over it and nothing
//    slides. Swing carries it along the path to the next plant on an arc. Two-bone IK from the
//    hip (which rides the posed spine) to the ankle; the foot rolls off its toe.
//  - Everything else (flap rows, curling appendages, jaws, stalks) is forward kinematics with
//    sine motions whose phase lags along a row or along a chain: the metachronal ripple.
//
// A pose costs a few hundred multiplies per animal and allocates nothing.

import type { Built, PartInfo } from "./build"
import type { CreatureSpec, GaitSpec, Motion, Vec3 } from "./spec"

// ---------------------------------------------------------------- paths

/** A route through the world, parameterised by distance. `at` writes position (0..2) and unit tangent (3..5). */
export type Path = { length: number; closed: boolean; at(s: number, out: Float32Array | number[]): void }

/** A Catmull-Rom path through `pts`, resampled so distance along it is exact to a table step. */
export function makePath(pts: Vec3[], closed = false, steps = 512): Path {
  const n = pts.length
  const g = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[Math.min(n - 1, Math.max(0, i))])
  const spans = closed ? n : n - 1
  const fine: number[] = []
  const F = Math.max(steps * 2, spans * 16)
  for (let k = 0; k <= F; k++) {
    const x = (k / F) * spans
    const i = Math.min(spans - 1, Math.floor(x))
    const t = x - i, t2 = t * t, t3 = t2 * t
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2)
    for (let c = 0; c < 3; c++) fine.push(0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3))
  }
  const L = new Float64Array(F + 1)
  for (let k = 1; k <= F; k++) L[k] = L[k - 1] + Math.hypot(fine[k * 3] - fine[k * 3 - 3], fine[k * 3 + 1] - fine[k * 3 - 2], fine[k * 3 + 2] - fine[k * 3 - 1])
  const length = L[F]
  const tab = new Float32Array((steps + 1) * 3)
  let j = 1
  for (let k = 0; k <= steps; k++) {
    const d = (k / steps) * length
    while (j < F && L[j] < d) j++
    const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1)
    for (let c = 0; c < 3; c++) tab[k * 3 + c] = fine[(j - 1) * 3 + c] + (fine[j * 3 + c] - fine[(j - 1) * 3 + c]) * f
  }
  const step = length / steps
  return {
    length,
    closed,
    at(s, out) {
      let x = s / step
      if (closed) x = ((x % steps) + steps) % steps
      // off either end of an open path: carry straight on along the end tangent
      const i = x <= 0 ? 0 : x >= steps ? steps - 1 : Math.floor(x)
      const f = x - i
      const a = i * 3
      const tx = tab[a + 3] - tab[a], ty = tab[a + 4] - tab[a + 1], tz = tab[a + 5] - tab[a + 2]
      out[0] = tab[a] + tx * f
      out[1] = tab[a + 1] + ty * f
      out[2] = tab[a + 2] + tz * f
      // tangent: blend the two neighbouring chords so it turns smoothly through a table step
      const b = (closed ? (i + 1) % steps : Math.min(steps - 1, i + 1)) * 3
      const c = (closed ? (i + steps - 1) % steps : Math.max(0, i - 1)) * 3
      const g2 = f < 0.5 ? c : b
      const w = f < 0.5 ? 0.5 - f : f - 0.5
      let ux = tx * (1 - w) + (tab[g2 + 3] - tab[g2]) * w, uy = ty * (1 - w) + (tab[g2 + 4] - tab[g2 + 1]) * w, uz = tz * (1 - w) + (tab[g2 + 5] - tab[g2 + 2]) * w
      const l = Math.hypot(ux, uy, uz) || 1
      ux /= l
      uy /= l
      uz /= l
      out[3] = ux
      out[4] = uy
      out[5] = uz
    },
  }
}

/**
 * A path that is one straight ray you re-aim every frame: for a thing that is placed and pointed
 * rather than walked (an arm swinging from its elbow, a head on a neck). The model's origin sits
 * at `origin` when `drive.dist` is 0 and its +x runs along `dir`. `set` allocates nothing.
 */
export function makeAim(origin: Vec3 = [0, 0, 0], dir: Vec3 = [1, 0, 0]): Path & { set(origin: Vec3 | number[], dir: Vec3 | number[]): void } {
  const o = [origin[0], origin[1], origin[2]]
  const d = [dir[0], dir[1], dir[2]]
  const fix = () => {
    const l = Math.hypot(d[0], d[1], d[2]) || 1
    d[0] /= l
    d[1] /= l
    d[2] /= l
    // (the frames take their "right" from the horizontal heading: keep a sliver of one)
    if (Math.hypot(d[0], d[2]) < 1e-4) d[0] = 1e-4
  }
  fix()
  return {
    length: 1e9,
    closed: false,
    at(s, out) {
      out[0] = o[0] + d[0] * s
      out[1] = o[1] + d[1] * s
      out[2] = o[2] + d[2] * s
      out[3] = d[0]
      out[4] = d[1]
      out[5] = d[2]
    },
    set(no, nd) {
      o[0] = no[0]
      o[1] = no[1]
      o[2] = no[2]
      d[0] = nd[0]
      d[1] = nd[1]
      d[2] = nd[2]
      fix()
    },
  }
}

// ---------------------------------------------------------------- quaternion scratch maths (no allocation)

const TAU = Math.PI * 2
const S = new Float32Array(64) // scratch
/** out[o..o+3] = a[ai..] * b[bi..] */
function qmul(a: Float32Array, ai: number, b: Float32Array, bi: number, out: Float32Array, o: number) {
  const ax = a[ai], ay = a[ai + 1], az = a[ai + 2], aw = a[ai + 3]
  const bx = b[bi], by = b[bi + 1], bz = b[bi + 2], bw = b[bi + 3]
  out[o] = aw * bx + ax * bw + ay * bz - az * by
  out[o + 1] = aw * by - ax * bz + ay * bw + az * bx
  out[o + 2] = aw * bz + ax * by - ay * bx + az * bw
  out[o + 3] = aw * bw - ax * bx - ay * by - az * bz
}
/** out[o..o+2] = q[qi..] rotating (x, y, z) */
function qrot(q: Float32Array, qi: number, x: number, y: number, z: number, out: Float32Array, o: number) {
  const qx = q[qi], qy = q[qi + 1], qz = q[qi + 2], qw = q[qi + 3]
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x)
  out[o] = x + qw * tx + qy * tz - qz * ty
  out[o + 1] = y + qw * ty + qz * tx - qx * tz
  out[o + 2] = z + qw * tz + qx * ty - qy * tx
}
/** Quaternion of the rotation whose columns are X = f, Y = u, Z = r (orthonormal, right-handed). */
function basisQ(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number, rx: number, ry: number, rz: number, out: Float32Array, o: number) {
  const tr = fx + uy + rz
  let x: number, y: number, z: number, w: number
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    w = 0.25 * s
    x = (uz - ry) / s
    y = (rx - fz) / s
    z = (fy - ux) / s
  } else if (fx > uy && fx > rz) {
    const s = Math.sqrt(1 + fx - uy - rz) * 2
    w = (uz - ry) / s
    x = 0.25 * s
    y = (ux + fy) / s
    z = (rx + fz) / s
  } else if (uy > rz) {
    const s = Math.sqrt(1 + uy - fx - rz) * 2
    w = (rx - fz) / s
    x = (ux + fy) / s
    y = 0.25 * s
    z = (ry + uz) / s
  } else {
    const s = Math.sqrt(1 + rz - fx - uy) * 2
    w = (fy - ux) / s
    x = (rx + fz) / s
    y = (ry + uz) / s
    z = 0.25 * s
  }
  out[o] = x
  out[o + 1] = y
  out[o + 2] = z
  out[o + 3] = w
}
/** Basis from a direction d and a rough plane normal n: X = d, Z = n made perpendicular, Y = Z x X. Written as a quaternion. */
function dirQ(dx: number, dy: number, dz: number, nx: number, ny: number, nz: number, out: Float32Array, o: number) {
  const k = nx * dx + ny * dy + nz * dz
  nx -= dx * k
  ny -= dy * k
  nz -= dz * k
  const l = Math.hypot(nx, ny, nz) || 1
  nx /= l
  ny /= l
  nz /= l
  basisQ(dx, dy, dz, ny * dz - nz * dy, nz * dx - nx * dz, nx * dy - ny * dx, nx, ny, nz, out, o)
}
const sstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const fract = (x: number) => x - Math.floor(x)

// ---------------------------------------------------------------- the rig

type Leg = {
  part: PartInfo
  bones: number[]
  attach: number
  /** socket relative to its attach frame's head (model units) */
  sock: [number, number, number]
  l1: number
  l2: number
  /** rest tip (the plant point) in model space, and the ankle-to-tip vector */
  tip: [number, number, number]
  foot: [number, number, number]
  pole: [number, number, number]
  /** conj of the rest basis of the upper, lower and foot bones (4 floats each) */
  rest: Float32Array
  off: number
  track: number
  pair: number
  /** shortest and longest hip-to-ankle distance the knee's limits allow (model units) */
  dMin: number
  dMax: number
  /** a toe segment: ankle-to-ball and ball-to-tip vectors (rest) */
  toes: boolean
  meta: [number, number, number]
  toeV: [number, number, number]
}
type PoseBone = { bone: number; s: [number, number, number]; u: [number, number, number]; t: [number, number, number]; a: number; b: number; c: number }
/** the footfall pulse: a sharp dip just after a foot takes the load and a slow recovery; peak 1 at f = 0.056 */
const thud = (f: number) => 1.868 * Math.exp(-f / 0.14) * (1 - Math.exp(-f / 0.035))
type MotionBone = { bone: number; ax: number; ay: number; az: number; row: number; k: number; sgn: number; alt: number; lo: number; hi: number }

/** What a scene supplies for one animal on one frame. Reuse the object. */
export type Drive = {
  path: Path
  /** Distance of the model origin along the path, world units. Gait and swim phase are tied to it. */
  dist: number
  time: number
  scale: number
  /** Sideways offset from the path (world units, +right): a lane in a herd. */
  lane: number
  /** Height offset (swimmers: a depth lane). */
  rise: number
  seed: number
  /** Terrain: height of the ground at (x, z). Walkers plant their feet on it and pitch to it. */
  ground: ((x: number, z: number) => number) | null
  /** Look target in world space, how far the head turns to it (0..1) and how far the eyes do (lead the head: ramp this first). */
  look: [number, number, number] | null
  head: number
  eyes: number
  /** Named gains for motions with a `channel` (a jaw opening, appendages curling to grasp). */
  ch: Record<string, number>
  /**
   * Reach targets: by part name (a jointed part of two or more bones that is not a leg: "armR"),
   * [x, y, z, weight, hintX, hintY, hintZ] in world space. The part's first two bones are solved so
   * its second joint (the wrist) lands on the point; weight 0..1 blends from the posed arm; the
   * optional hint is the world direction the elbow should point. Whatever hangs beyond (the hand,
   * its fingers and their poses) follows. Reuse the arrays: nothing here may allocate per frame.
   * Six more numbers aim the bone beyond the second joint (the hand, the foot) in the world
   * instead of letting it hang from the forearm: [7..9] the direction it points (fingers, toes) and
   * [10..12] where its side axis goes (direction x dorsal side: for a palm facing down with fingers
   * along +x, +z). All zero or absent: it follows the chain as before. Poses on that bone still add.
   */
  reach?: Record<string, number[] | null>
  /** Roll about the heading, radians (an arm turning palm up, a swimmer rolling). Optional: 0 when absent. */
  roll?: number
  /**
   * Eye offsets set by the scene, [x, y] in -1..1 (the pupils' turn right and up), for a figure whose
   * head is turned by poses and not by `look` (human.ts): they replace what `look` would have written.
   */
  eye?: number[] | null
}
export const makeDrive = (path: Path): Drive => ({ path, dist: 0, time: 0, scale: 1, lane: 0, rise: 0, seed: 0, ground: null, look: null, head: 0, eyes: 0, ch: {} })

export type Rig = {
  spec: CreatureSpec
  bones: number
  /** World-space pose of the last `pose()` call: bone rotations (4 each) and head positions (3 each). */
  q: Float32Array
  p: Float32Array
  /**
   * Pose one animal. Results are in `q`, `p`, `info`. `lite` skips the sine motions (flap rows, curls):
   * for far animals, whose flap rows the vertex stage ripples parametrically instead (gpu.ts).
   */
  pose(d: Drive, lite?: boolean): void
  /** Write the last pose as one palette row: `data` is the texture's array, `row` the row index, `width` texels per row. */
  write(data: Float32Array, row: number, width: number, tint: Vec3 | null): void
  /** Filled by pose(): cycle count, blink, eye offsets, breath; and how far past full reach any leg was asked to go (0 = never). */
  info: { cycle: number; blink: number; eyeX: number; eyeY: number; breath: number; overreach: number }
  /** World position of a leg's foot tip in the last pose (for tests, dust and sound). */
  foot(leg: number, out: Float32Array | number[]): boolean
  /** World position of a leg's toe tip as the bones carry it (what the skin does): compare with foot() to measure sliding. */
  toe(leg: number, out: Float32Array | number[]): void
  legs: number
  /** Furthest any bone strays from its rest place over a cycle, in model units: inflate culling bounds by this. */
  excursion: number
  /** Model-space x of the rest bounds' centre and its y, and the rest radius. */
  centre: [number, number, number]
  radius: number
  /** Index of a bone by name ("spine4", "hindR.0", "palm.0"), or -1: its world rotation is `q[4i..]`, its head `p[3i..]`. */
  bone(name: string): number
}

/** Texels at the start of a palette row before the bones: tint+seed, cycle/blink/eye, breath/-/-/scale. */
export const HEADER = 3
export const paletteWidth = (bones: number) => HEADER + bones * 2

/** Phase offset of a leg pair within the gait cycle (0..1): the footfall order each gait uses. */
export const GAIT_OFFSETS = (gait: GaitSpec["gait"], pair: number, pairs: number, left: boolean, lag: number): number => {
  const fromBack = pairs - 1 - pair
  if (gait === "trot") return ((fromBack % 2 ? 0.5 : 0) + (left ? 0 : 0.5)) % 1
  if (gait === "metachronal") return (fromBack * lag + (left ? 0 : 0.5)) % 1
  if (gait === "biped") return left ? 0 : 0.5
  // lateral sequence: hind, then the fore foot of the same side
  return (fromBack * (gait === "amble" ? 0.22 : 0.25) + (left ? 0 : 0.5)) % 1
}

export function makeRig(spec: CreatureSpec, built: Built): Rig {
  const sk = built.skel
  const B = sk.n
  const NS = sk.spine
  const head = sk.head
  const q = new Float32Array(B * 4)
  const p = new Float32Array(B * 3)
  const lq = new Float32Array(B * 4)
  const tmp = new Float32Array(16)
  const ps = new Float32Array(6)
  const fp = new Float32Array(NS * 3)
  const info = { cycle: 0, blink: 0, eyeX: 0, eyeY: 0, breath: 0, overreach: 0 }
  let headC = 1, headS = 0
  const gait = spec.gait
  const swim = spec.swim

  // rest orientation of the spine curve at each frame (its conjugate), from neighbouring frames
  const restF = new Float32Array(NS * 4)
  for (let j = 0; j < NS; j++) {
    const a = Math.max(0, j - 1) * 3, b = Math.min(NS - 1, j + 1) * 3
    let fx = head[b] - head[a], fy = head[b + 1] - head[a + 1]
    const l = Math.hypot(fx, fy) || 1
    fx /= l
    fy /= l
    basisQ(fx, fy, 0, -fy, fx, 0, 0, 0, 1, restF, j * 4)
    restF[j * 4] *= -1
    restF[j * 4 + 1] *= -1
    restF[j * 4 + 2] *= -1
  }
  const X = (j: number) => head[j * 3]
  const bodyLen = X(NS - 1) - X(0) || 1

  // legs, front pair first
  const legParts = built.parts.filter((x) => x.role === "leg" && x.bones.length >= 2)
  const pairX = [...new Set(legParts.map((x) => Math.round(x.joints[0][0] * 1000) / 1000))].sort((a, b) => b - a)
  const legs: Leg[] = legParts.map((part) => {
    const J = part.joints
    const pair = pairX.indexOf(Math.round(J[0][0] * 1000) / 1000)
    const three = part.bones.length >= 3
    const toes = !!part.toes && part.bones.length >= 4
    const ankle = J[2]
    const tip = three ? J[J.length - 1] : J[2]
    const at = part.attach
    const rest = new Float32Array(16)
    const dA = [ankle[0] - J[0][0], ankle[1] - J[0][1], ankle[2] - J[0][2]]
    let pole: [number, number, number] = [J[1][0] - J[0][0], J[1][1] - J[0][1], J[1][2] - J[0][2]]
    const dl = Math.hypot(dA[0], dA[1], dA[2]) || 1
    const k = (pole[0] * dA[0] + pole[1] * dA[1] + pole[2] * dA[2]) / (dl * dl)
    pole = [pole[0] - dA[0] * k, pole[1] - dA[1] * k, pole[2] - dA[2] * k]
    if (Math.hypot(pole[0], pole[1], pole[2]) < 1e-4 * dl) pole = [1, 0, 0]
    const n = [dA[1] * pole[2] - dA[2] * pole[1], dA[2] * pole[0] - dA[0] * pole[2], dA[0] * pole[1] - dA[1] * pole[0]]
    const seg = (a: number, b: number, o: number, nx: number, ny: number, nz: number) => {
      const dx = J[b][0] - J[a][0], dy = J[b][1] - J[a][1], dz = J[b][2] - J[a][2]
      const l = Math.hypot(dx, dy, dz) || 1
      dirQ(dx / l, dy / l, dz / l, nx, ny, nz, rest, o)
      rest[o] *= -1
      rest[o + 1] *= -1
      rest[o + 2] *= -1
      return l
    }
    const l1 = seg(0, 1, 0, n[0], n[1], n[2])
    const l2 = seg(1, 2, 4, n[0], n[1], n[2])
    if (toes) {
      seg(2, 3, 8, 0, 0, 1)
      seg(3, J.length - 1, 12, 0, 0, 1)
    } else if (three) seg(2, J.length - 1, 8, 0, 0, 1)
    const left = tip[2] < 0
    return {
      part, bones: part.bones, attach: at,
      sock: [J[0][0] - head[at * 3], J[0][1] - head[at * 3 + 1], J[0][2] - head[at * 3 + 2]],
      l1, l2, tip: [tip[0], tip[1], tip[2]],
      foot: [tip[0] - ankle[0], tip[1] - ankle[1], tip[2] - ankle[2]],
      pole, rest,
      off: gait ? GAIT_OFFSETS(gait.gait, pair, pairX.length, left, gait.lag ?? 0.12) : 0,
      track: gait?.track?.[pair] !== undefined ? gait.track[pair] * (left ? -1 : 1) : tip[2],
      pair,
      dMin: part.limits ? ((a: number) => Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(a))))(part.limits[1]) : 0,
      dMax: part.limits ? ((a: number) => Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(a))))(part.limits[0]) : Infinity,
      toes,
      meta: toes ? [J[3][0] - ankle[0], J[3][1] - ankle[1], J[3][2] - ankle[2]] : [0, 0, 0],
      toeV: toes ? [tip[0] - J[3][0], tip[1] - J[3][1], tip[2] - J[3][2]] : [0, 0, 0],
    }
  })
  // the girdles: the hindmost and foremost leg pairs (one girdle for a biped), their x and their left-leg phase
  const hindLeg = legs.find((l) => l.pair === pairX.length - 1 && l.tip[2] < 0) ?? legs[0]
  const foreLeg = legs.find((l) => l.pair === 0 && l.tip[2] < 0) ?? legs[0]
  const xH = hindLeg ? head[hindLeg.attach * 3] + hindLeg.sock[0] : 0
  const xS = foreLeg && pairX.length > 1 ? head[foreLeg.attach * 3] + foreLeg.sock[0] : xH + bodyLen * 0.3
  const oH = hindLeg?.off ?? 0
  const oS = pairX.length > 1 ? (foreLeg?.off ?? 0) : oH
  const tailX = gait ? X(0) + bodyLen * (gait.tailAt ?? 0.3) : X(0)
  const neckX = gait ? X(0) + bodyLen * (gait.neckAt ?? 0.75) : X(NS - 1)
  let neck0 = NS - 1
  for (let j = NS - 1; j >= 0; j--) if (X(j) >= neckX) neck0 = j

  // motions resolved to bones
  const motions: { m: Motion; list: MotionBone[] }[] = (spec.motions ?? []).map((m) => {
    const list: MotionBone[] = []
    for (const part of built.parts) {
      if (part.role !== m.role || part.name === "body") continue
      const ax = part.axes[m.axis === "tan" ? 0 : m.axis === "up" ? 1 : 2]
      part.bones.forEach((bone, k) => list.push({ bone, ax: ax[0], ay: ax[1], az: ax[2], row: part.row, k, sgn: m.axis === "side" ? 1 : part.side < 0 ? -1 : 1, alt: m.alternate && part.side < 0 ? 0.5 : 0, lo: part.limits ? part.limits[0] : -Infinity, hi: part.limits ? part.limits[1] : Infinity }))
    }
    return { m, list }
  })
  // held poses resolved to bones
  const poses: { name: string; list: PoseBone[] }[] = Object.entries(spec.poses ?? {}).map(([name, pose]) => {
    const list: PoseBone[] = []
    for (const key of Object.keys(pose)) {
      for (const part of built.parts) {
        if (part.name === "body" || (part.name !== key && part.base !== key)) continue
        const sg = part.side < 0 ? -1 : 1
        pose[key].forEach((a, k) => {
          if (k >= part.bones.length) return
          list.push({ bone: part.bones[k], t: part.axes[0], u: part.axes[1], s: part.axes[2], a: -(a[0] ?? 0), b: (a[1] ?? 0) * sg, c: (a[2] ?? 0) * sg })
        })
      }
    }
    return { name, list }
  })
  // held poses of the spine itself (the key "body"): per spine frame from frame 0, [pitch, roll, yaw] in the frame's own axes
  // (pitch about the model's z, positive toward +x: a figure bending forward; roll about x, positive toward +z, its right;
  // yaw about y, positive turning to its right). Each frame turns about its own head and carries every frame after it.
  const spinePoses: { name: string; a: Float32Array }[] = Object.entries(spec.poses ?? {}).filter(([, pose]) => pose.body).map(([name, pose]) => {
    const a = new Float32Array(NS * 3)
    pose.body.forEach((v, j) => {
      if (j >= NS) return
      a[j * 3] = v[0] ?? 0
      a[j * 3 + 1] = v[1] ?? 0
      a[j * 3 + 2] = v[2] ?? 0
    })
    return { name, a }
  })
  const spineA = new Float32Array(NS * 3)
  const SQ = new Float32Array(24)
  const turn = (bone: number, ax: [number, number, number], ang: number) => {
    if (ang === 0) return
    const sn = Math.sin(ang * 0.5)
    S[0] = ax[0] * sn
    S[1] = ax[1] * sn
    S[2] = ax[2] * sn
    S[3] = Math.cos(ang * 0.5)
    qmul(lq, bone * 4, S, 0, tmp, 0)
    lq[bone * 4] = tmp[0]
    lq[bone * 4 + 1] = tmp[1]
    lq[bone * 4 + 2] = tmp[2]
    lq[bone * 4 + 3] = tmp[3]
  }
  // reach chains: every jointed part of two or more bones that is not a leg
  type Reach = { name: string; b0: number; b1: number; l1: number; l2: number; rest: Float32Array; pole: [number, number, number]; b2: number }
  const reaches: Reach[] = built.parts.filter((x) => x.name !== "body" && x.role !== "leg" && x.bones.length >= 2 && x.joints.length >= 3).map((part) => {
    const J = part.joints
    const rest = new Float32Array(12)
    const dA = [J[2][0] - J[0][0], J[2][1] - J[0][1], J[2][2] - J[0][2]]
    let pole: [number, number, number] = [J[1][0] - J[0][0], J[1][1] - J[0][1], J[1][2] - J[0][2]]
    const dl = Math.hypot(dA[0], dA[1], dA[2]) || 1
    const k = (pole[0] * dA[0] + pole[1] * dA[1] + pole[2] * dA[2]) / (dl * dl)
    pole = [pole[0] - dA[0] * k, pole[1] - dA[1] * k, pole[2] - dA[2] * k]
    if (Math.hypot(pole[0], pole[1], pole[2]) < 1e-3 * dl) pole = [part.axes[1][0], part.axes[1][1], part.axes[1][2]]
    const n = [dA[1] * pole[2] - dA[2] * pole[1], dA[2] * pole[0] - dA[0] * pole[2], dA[0] * pole[1] - dA[1] * pole[0]]
    const seg = (a: number, b: number, o: number) => {
      const dx = J[b][0] - J[a][0], dy = J[b][1] - J[a][1], dz = J[b][2] - J[a][2]
      const l = Math.hypot(dx, dy, dz) || 1
      dirQ(dx / l, dy / l, dz / l, n[0], n[1], n[2], rest, o)
      rest[o] *= -1
      rest[o + 1] *= -1
      rest[o + 2] *= -1
      return l
    }
    const l1 = seg(0, 1, 0), l2 = seg(1, 2, 4)
    // the bone beyond (a hand, a foot): the conjugate of its rest basis, from its direction and its side axis (direction x the part's up)
    const b2 = part.bones.length >= 3 && J.length >= 4 ? part.bones[2] : -1
    if (b2 >= 0) {
      let dx = J[3][0] - J[2][0], dy = J[3][1] - J[2][1], dz = J[3][2] - J[2][2]
      const l = Math.hypot(dx, dy, dz) || 1
      dx /= l
      dy /= l
      dz /= l
      const u = part.axes[1]
      dirQ(dx, dy, dz, dy * u[2] - dz * u[1], dz * u[0] - dx * u[2], dx * u[1] - dy * u[0], rest, 8)
      rest[8] *= -1
      rest[9] *= -1
      rest[10] *= -1
    }
    return { name: part.name, b0: part.bones[0], b1: part.bones[1], l1, l2, rest, pole, b2 }
  })
  const dirty = new Uint8Array(B)
  const hd = new Float32Array(NS * 2)
  const amps = swim ? swim.amp : null
  const ampAt = (a: number) => {
    if (!amps) return 0
    let i = 0
    while (i < amps.length - 2 && a > amps[i + 1][0]) i++
    const f = Math.min(1, Math.max(0, (a - amps[i][0]) / (amps[i + 1][0] - amps[i][0] || 1)))
    return amps[i][1] + (amps[i + 1][1] - amps[i][1]) * sstep(f)
  }
  const footOut = new Float32Array(legs.length * 4)

  function pose(d: Drive, lite = false) {
    const sc = d.scale
    const path = d.path
    const cyc = gait ? d.dist / (gait.stride * sc) : swim ? d.dist / (swim.stride * sc) : d.time
    info.cycle = cyc
    info.overreach = 0
    // ---- girdle signals (all functions of the cycle count)
    const duty = gait?.duty ?? 0.6
    const aH = TAU * (cyc + oH - duty / 2), aS = TAU * (cyc + oS - duty / 2)
    const zH = gait ? -(gait.shift ?? 0) * Math.cos(aH) * sc : 0
    const zS = gait ? -(gait.shift ?? 0) * Math.cos(aS) * sc : 0
    const mH = gait ? (gait.girdle ?? 0) * Math.cos(TAU * (cyc + oH)) : 0
    const mS = gait ? (gait.girdle ?? 0) * Math.cos(TAU * (cyc + oS)) : 0
    let yH = gait ? (gait.bob ?? 0) * Math.cos(2 * aH) * sc : 0
    let yS = gait ? (gait.bob ?? 0) * Math.cos(2 * aS) * sc : 0
    let rH = gait ? -(gait.roll ?? 0) * Math.cos(aH) : 0
    let rS = gait ? -(gait.roll ?? 0) * Math.cos(aS) : 0
    // weight: each girdle sinks as one of its feet takes the load, and tips toward that foot
    const drop = gait?.drop ?? 0
    if (drop) {
      const hl = thud(fract(cyc + oH)), hr = thud(fract(cyc + oH + 0.5)), sl = thud(fract(cyc + oS)), sr = thud(fract(cyc + oS + 0.5))
      yH -= drop * (hl + hr) * sc
      yS -= drop * (sl + sr) * sc
      rH += (gait?.dropRoll ?? 0) * (hr - hl)
      rS += (gait?.dropRoll ?? 0) * (sr - sl)
    }
    const belly = gait?.belly
    const tailBob = (gait?.tailBob ?? 0) * drop
    // ---- ground under the girdles: the trunk pitches to the slope
    let gH = 0, gS = 0
    const ground = gait ? d.ground : null
    if (ground) {
      path.at(d.dist + xH * sc, ps)
      gH = ground(ps[0] - ps[5] * d.lane, ps[2] + ps[3] * d.lane)
      path.at(d.dist + xS * sc, ps)
      gS = ground(ps[0] - ps[5] * d.lane, ps[2] + ps[3] * d.lane)
    }
    const span = (xS - xH) * sc || 1
    // ---- spine frame positions
    let bank = 0
    if (swim?.bank) {
      path.at(d.dist + X(0) * sc, ps)
      const t0x = ps[3], t0z = ps[5]
      path.at(d.dist + X(NS - 1) * sc, ps)
      bank = (swim.bank * (t0x * ps[5] - t0z * ps[3])) / (bodyLen * sc)
    }
    // Two passes at most. If a leg is asked to reach past its length (a long step, a dip in the ground),
    // its girdle is lowered by what is missing and the pose is solved again: the trunk sinks into the
    // step instead of the foot being dragged off its plant.
    let dropH = 0, dropS = 0
    for (let pass = 0; pass < 2; pass++) {
    let overH = 0, overS = 0
    for (let j = 0; j < NS; j++) {
      const xj = X(j) * sc
      path.at(d.dist + xj, ps)
      // horizontal right of the heading
      let rx = -ps[5], rz = ps[3]
      const rl = Math.hypot(rx, rz) || 1
      rx /= rl
      rz /= rl
      let lat = d.lane, up = head[j * 3 + 1] * sc + d.rise
      if (gait) {
        // between the girdles: a cubic through each girdle's shift with its yaw as the slope; beyond them the slope carries on, fading
        const u = (xj - xH * sc) / span
        if (u <= 0) {
          const back = -u * span
          const tl = Math.max(0, (tailX * sc - xj) / ((tailX - X(0)) * sc || 1))
          lat += zH - mH * back * Math.exp(-back / (bodyLen * sc * 0.6))
          if (gait.tail) lat -= gait.tail[0] * sc * tl * tl * Math.cos(TAU * (cyc + oH - gait.tail[1] * tl))
          up += yH * (1 - 0.5 * tl) + gH + ((gS - gH) * (xj - xH * sc)) / span
          if (tailBob) up -= tailBob * sc * tl * (thud(fract(cyc + oH - 0.3 * tl)) + thud(fract(cyc + oH + 0.5 - 0.3 * tl)) - 0.55)
        } else if (u >= 1) {
          const fwd = (u - 1) * span
          const nk = Math.max(0, (xj - neckX * sc) / ((X(NS - 1) - neckX) * sc || 1))
          lat += zS + mS * fwd * Math.exp(-fwd / (bodyLen * sc * 0.25))
          if (gait.head) lat += gait.head[0] * sc * nk * nk * Math.cos(TAU * (cyc + oS - gait.head[1] * nk))
          up += yS + gS + ((gS - gH) * (xj - xS * sc)) / span + (gait.pitch ?? 0) * sc * nk * nk * Math.cos(2 * TAU * (cyc + oS - 0.08))
        } else {
          const u2 = u * u, u3 = u2 * u
          lat += (2 * u3 - 3 * u2 + 1) * zH + (u3 - 2 * u2 + u) * span * mH + (-2 * u3 + 3 * u2) * zS + (u3 - u2) * span * mS
          up += yH + (yS - yH) * u + gH + (gS - gH) * u
          if (belly) {
            const bw = Math.sin(Math.PI * u) * belly[0] * sc
            lat -= bw * Math.cos(aH - TAU * belly[1])
            up -= (bw / 3) * (thud(fract(cyc + oH - belly[1])) + thud(fract(cyc + oH + 0.5 - belly[1])))
          }
        }
      }
      if (gait) up -= dropH + (dropS - dropH) * Math.min(1, Math.max(0, (xj - xH * sc) / span))
      let vert = 0
      if (swim) {
        const a = ampAt(sk.spineAt[j]) * sc * Math.sin(TAU * (cyc + (X(j) - X(0)) / (swim.wavelength * bodyLen)))
        if (swim.plane === "vertical") vert = a
        else lat += a
      }
      hd[j * 2] = rx
      hd[j * 2 + 1] = rz
      fp[j * 3] = ps[0] + rx * lat
      fp[j * 3 + 1] = (gait ? 0 : ps[1]) + up + vert
      fp[j * 3 + 2] = ps[2] + rz * lat
    }
    // ---- frame orientations from the finished curve, then roll
    for (let j = 0; j < NS; j++) {
      const a = Math.max(0, j - 1) * 3, b = Math.min(NS - 1, j + 1) * 3
      let fx = fp[b] - fp[a], fy = fp[b + 1] - fp[a + 1], fz = fp[b + 2] - fp[a + 2]
      // remove the rest curve's own slope: at rest the frames are level by definition
      const l = Math.hypot(fx, fy, fz) || 1
      fx /= l
      fy /= l
      fz /= l
      let rx = -fz, rz = fx
      const rl = Math.hypot(rx, rz)
      // an upright stretch of spine (a standing or seated torso, a rearing neck) has no heading of its own: take the path's
      const own = rl <= 0.45 ? 0 : rl >= 0.8 ? 1 : (rl - 0.45) / 0.35
      rx = (rl > 1e-6 ? rx / rl : 0) * own + hd[j * 2] * (1 - own)
      rz = (rl > 1e-6 ? rz / rl : 0) * own + hd[j * 2 + 1] * (1 - own)
      let ry0 = 0
      if (own < 1) {
        // make it square to the tangent again
        const k = rx * fx + rz * fz
        rx -= fx * k
        ry0 = -fy * k
        rz -= fz * k
      }
      const rn = Math.hypot(rx, ry0, rz) || 1
      rx /= rn
      ry0 /= rn
      rz /= rn
      let ux = ry0 * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry0 * fx
      const u = Math.min(1, Math.max(0, (X(j) - xH) / (xS - xH || 1)))
      const roll = (gait ? rH + (rS - rH) * u : 0) + bank + (d.roll ?? 0)
      let ry = ry0
      if (roll !== 0) {
        const c = Math.cos(roll), s = Math.sin(roll)
        const nux = ux * c + rx * s, nuy = uy * c + ry0 * s, nuz = uz * c + rz * s
        const nrx = rx * c - ux * s, nry = ry0 * c - uy * s, nrz = rz * c - uz * s
        ux = nux
        uy = nuy
        uz = nuz
        rx = nrx
        ry = nry
        rz = nrz
      }
      basisQ(fx, fy, fz, ux, uy, uz, rx, ry, rz, tmp, 0)
      qmul(tmp, 0, restF, j * 4, q, j * 4)
      p[j * 3] = fp[j * 3]
      p[j * 3 + 1] = fp[j * 3 + 1]
      p[j * 3 + 2] = fp[j * 3 + 2]
    }
    {
      qrot(q, (NS >> 1) * 4, 1, 0, 0, tmp, 0)
      const hl = Math.hypot(tmp[0], tmp[2]) || 1
      headC = tmp[0] / hl
      headS = tmp[2] / hl
    }
    // ---- held poses of the spine: each frame turns about its own head and carries the frames after it
    if (spinePoses.length) {
      let any = false
      spineA.fill(0)
      for (let n = 0; n < spinePoses.length; n++) {
        const g = d.ch[spinePoses[n].name] ?? 0
        if (g === 0) continue
        any = true
        const a = spinePoses[n].a
        for (let i = 0; i < NS * 3; i++) spineA[i] += a[i] * g
      }
      if (any) {
        // SQ[0..3]: the world turn carried so far (D); SQ[4..]: scratch
        SQ[0] = SQ[1] = SQ[2] = 0
        SQ[3] = 1
        let ox = p[0], oy = p[1], oz = p[2] // the unposed head of the frame before
        for (let j = 0; j < NS; j++) {
          const ux = p[j * 3], uy = p[j * 3 + 1], uz = p[j * 3 + 2]
          if (j > 0) {
            qrot(SQ, 0, ux - ox, uy - oy, uz - oz, SQ, 20)
            p[j * 3] = p[j * 3 - 3] + SQ[20]
            p[j * 3 + 1] = p[j * 3 - 2] + SQ[21]
            p[j * 3 + 2] = p[j * 3 - 1] + SQ[22]
          }
          ox = ux
          oy = uy
          oz = uz
          const pi = spineA[j * 3], ro = spineA[j * 3 + 1], ya = spineA[j * 3 + 2]
          // unposed orientation and its conjugate
          SQ[4] = q[j * 4]
          SQ[5] = q[j * 4 + 1]
          SQ[6] = q[j * 4 + 2]
          SQ[7] = q[j * 4 + 3]
          qmul(SQ, 0, SQ, 4, SQ, 8) // D * q
          if (pi !== 0 || ro !== 0 || ya !== 0) {
            // local turn: yaw about y, then pitch about z, then roll about x
            SQ[12] = 0
            SQ[13] = -Math.sin(ya * 0.5)
            SQ[14] = 0
            SQ[15] = Math.cos(ya * 0.5)
            SQ[16] = 0
            SQ[17] = 0
            SQ[18] = -Math.sin(pi * 0.5)
            SQ[19] = Math.cos(pi * 0.5)
            qmul(SQ, 12, SQ, 16, SQ, 20)
            SQ[12] = Math.sin(ro * 0.5)
            SQ[13] = 0
            SQ[14] = 0
            SQ[15] = Math.cos(ro * 0.5)
            qmul(SQ, 20, SQ, 12, SQ, 16)
            qmul(SQ, 8, SQ, 16, SQ, 20) // Q = D * q * l
            // D = Q * conj(q)
            SQ[4] = -SQ[4]
            SQ[5] = -SQ[5]
            SQ[6] = -SQ[6]
            qmul(SQ, 20, SQ, 4, SQ, 0)
            q[j * 4] = SQ[20]
            q[j * 4 + 1] = SQ[21]
            q[j * 4 + 2] = SQ[22]
            q[j * 4 + 3] = SQ[23]
          } else {
            q[j * 4] = SQ[8]
            q[j * 4 + 1] = SQ[9]
            q[j * 4 + 2] = SQ[10]
            q[j * 4 + 3] = SQ[11]
          }
        }
      }
    }
    // ---- head: turn the neck toward a target; the eyes take what the head has not yet turned
    info.eyeX = d.eye ? d.eye[0] : 0
    info.eyeY = d.eye ? d.eye[1] : 0
    if (d.look && neck0 < NS - 1) {
      const hj = NS - 1
      qrot(q, neck0 * 4, 1, 0, 0, tmp, 0)
      qrot(q, neck0 * 4, 0, 1, 0, tmp, 3)
      qrot(q, neck0 * 4, 0, 0, 1, tmp, 6)
      const dx = d.look[0] - p[hj * 3], dy = d.look[1] - p[hj * 3 + 1], dz = d.look[2] - p[hj * 3 + 2]
      const dl = Math.hypot(dx, dy, dz) || 1
      const f = (dx * tmp[0] + dy * tmp[1] + dz * tmp[2]) / dl, u = (dx * tmp[3] + dy * tmp[4] + dz * tmp[5]) / dl, r = (dx * tmp[6] + dy * tmp[7] + dz * tmp[8]) / dl
      const yawT = Math.max(-0.9, Math.min(0.9, Math.atan2(r, Math.max(0.05, f))))
      const pitT = Math.max(-0.5, Math.min(0.5, Math.asin(Math.max(-1, Math.min(1, u)))))
      const yaw = yawT * d.head, pit = pitT * d.head
      info.eyeX = (yawT * d.eyes - yaw) / 0.9
      info.eyeY = (pitT * d.eyes - pit) / 0.5
      const n = NS - 1 - neck0
      const ux = tmp[3], uy = tmp[4], uz = tmp[5], rx = tmp[6], ry = tmp[7], rz = tmp[8]
      for (let j = neck0 + 1; j < NS; j++) {
        const k = (j - neck0) / n
        // rotation about the neck root's up by -yaw*k (right is +z, so a turn to the right is negative about y), then about its right by pitch*k
        const hy = -yaw * k * 0.5, hp = pit * k * 0.5
        S[0] = ux * Math.sin(hy)
        S[1] = uy * Math.sin(hy)
        S[2] = uz * Math.sin(hy)
        S[3] = Math.cos(hy)
        S[4] = rx * Math.sin(hp)
        S[5] = ry * Math.sin(hp)
        S[6] = rz * Math.sin(hp)
        S[7] = Math.cos(hp)
        qmul(S, 0, S, 4, S, 8)
        // (frames were written from fp, so fp still holds the unturned positions)
        qrot(S, 8, fp[j * 3] - fp[j * 3 - 3], fp[j * 3 + 1] - fp[j * 3 - 2], fp[j * 3 + 2] - fp[j * 3 - 1], tmp, 9)
        p[j * 3] = p[j * 3 - 3] + tmp[9]
        p[j * 3 + 1] = p[j * 3 - 2] + tmp[10]
        p[j * 3 + 2] = p[j * 3 - 1] + tmp[11]
        qmul(S, 8, q, j * 4, tmp, 12)
        q[j * 4] = tmp[12]
        q[j * 4 + 1] = tmp[13]
        q[j * 4 + 2] = tmp[14]
        q[j * 4 + 3] = tmp[15]
      }
    }
    // ---- everything that hangs off the spine: local sine motions, then forward kinematics
    for (let b = NS; b < B; b++) {
      lq[b * 4] = 0
      lq[b * 4 + 1] = 0
      lq[b * 4 + 2] = 0
      lq[b * 4 + 3] = 1
    }
    // (lite: no sine motions; parts ride their parents rigidly and the vertex stage ripples the flap rows instead)
    for (let n = 0; n < (lite ? 0 : motions.length); n++) {
      const m = motions[n].m
      const list = motions[n].list
      const clk = m.clock === "time" ? d.time : cyc
      const gain = m.channel === undefined ? 1 : (d.ch[m.channel] ?? 0)
      const rate = m.rate ?? 1, lag = m.lag ?? 0, tip = m.tipLag ?? 0, off = m.offset ?? 0, amp = m.amp ?? 0, ampK = m.ampK ?? 0, bias = m.bias ?? 0, biasK = m.biasK ?? 0
      for (let i = 0; i < list.length; i++) {
        const e = list[i]
        const ang = Math.min(e.hi, Math.max(e.lo, (bias + biasK * e.k + (amp + ampK * e.k) * Math.sin(TAU * (clk * rate - e.row * lag - e.k * tip + e.alt + d.seed * (m.clock === "time" ? 1 : 0)) + off)) * gain)) * e.sgn * 0.5
        const s = Math.sin(ang)
        S[0] = e.ax * s
        S[1] = e.ay * s
        S[2] = e.az * s
        S[3] = Math.cos(ang)
        qmul(lq, e.bone * 4, S, 0, tmp, 0)
        lq[e.bone * 4] = tmp[0]
        lq[e.bone * 4 + 1] = tmp[1]
        lq[e.bone * 4 + 2] = tmp[2]
        lq[e.bone * 4 + 3] = tmp[3]
      }
    }
    for (let n = 0; n < poses.length; n++) {
      const g = d.ch[poses[n].name] ?? 0
      if (g === 0) continue
      const list = poses[n].list
      for (let i = 0; i < list.length; i++) {
        const e = list[i]
        turn(e.bone, e.s, e.a * g)
        turn(e.bone, e.u, e.b * g)
        turn(e.bone, e.t, e.c * g)
      }
    }
    for (let b = NS; b < B; b++) {
      const par = sk.parent[b]
      qmul(q, par * 4, lq, b * 4, q, b * 4)
      qrot(q, par * 4, (head[b * 3] - head[par * 3]) * sc, (head[b * 3 + 1] - head[par * 3 + 1]) * sc, (head[b * 3 + 2] - head[par * 3 + 2]) * sc, tmp, 0)
      p[b * 3] = p[par * 3] + tmp[0]
      p[b * 3 + 1] = p[par * 3 + 1] + tmp[1]
      p[b * 3 + 2] = p[par * 3 + 2] + tmp[2]
    }
    // ---- reach: two-bone IK of an arm to a world point, then everything beyond it again
    if (d.reach) {
      for (let n = 0; n < reaches.length; n++) {
        const R = reaches[n]
        const T = d.reach[R.name]
        if (!T || !(T[3] > 0)) continue
        const b0 = R.b0, b1 = R.b1, par = sk.parent[b0]
        const l1 = R.l1 * sc, l2 = R.l2 * sc
        const Hx = p[b0 * 3], Hy = p[b0 * 3 + 1], Hz = p[b0 * 3 + 2]
        let dx = T[0] - Hx, dy = T[1] - Hy, dz = T[2] - Hz
        let dl = Math.hypot(dx, dy, dz) || 1e-6
        dx /= dl
        dy /= dl
        dz /= dl
        dl = Math.min((l1 + l2) * 0.999, Math.max(dl, Math.abs(l1 - l2) + 1e-5))
        const ca = (l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl)
        const sa = Math.sqrt(Math.max(0, 1 - ca * ca))
        let px: number, py: number, pz: number
        if (T.length >= 7 && (T[4] !== 0 || T[5] !== 0 || T[6] !== 0)) {
          px = T[4]
          py = T[5]
          pz = T[6]
        } else {
          qrot(q, par * 4, R.pole[0], R.pole[1], R.pole[2], tmp, 0)
          px = tmp[0]
          py = tmp[1]
          pz = tmp[2]
        }
        const pk = px * dx + py * dy + pz * dz
        px -= dx * pk
        py -= dy * pk
        pz -= dz * pk
        const pl = Math.hypot(px, py, pz) || 1
        px /= pl
        py /= pl
        pz /= pl
        const nx = dy * pz - dz * py, ny = dz * px - dx * pz, nz = dx * py - dy * px
        const kx = dx * ca + px * sa, ky = dy * ca + py * sa, kz = dz * ca + pz * sa
        dirQ(kx, ky, kz, nx, ny, nz, tmp, 0)
        qmul(tmp, 0, R.rest, 0, tmp, 4)
        dirQ((dx * dl - kx * l1) / l2, (dy * dl - ky * l1) / l2, (dz * dl - kz * l1) / l2, nx, ny, nz, tmp, 0)
        qmul(tmp, 0, R.rest, 4, tmp, 8)
        // blend from the posed arm by weight (shortest way round), and renormalise
        const w = Math.min(1, T[3])
        for (let k = 0; k < 2; k++) {
          const b = k ? b1 : b0, o = k ? 8 : 4
          const sgn = q[b * 4] * tmp[o] + q[b * 4 + 1] * tmp[o + 1] + q[b * 4 + 2] * tmp[o + 2] + q[b * 4 + 3] * tmp[o + 3] < 0 ? -1 : 1
          let x = q[b * 4] + (tmp[o] * sgn - q[b * 4]) * w, y = q[b * 4 + 1] + (tmp[o + 1] * sgn - q[b * 4 + 1]) * w, z = q[b * 4 + 2] + (tmp[o + 2] * sgn - q[b * 4 + 2]) * w, ww = q[b * 4 + 3] + (tmp[o + 3] * sgn - q[b * 4 + 3]) * w
          const l = Math.hypot(x, y, z, ww) || 1
          x /= l
          y /= l
          z /= l
          ww /= l
          q[b * 4] = x
          q[b * 4 + 1] = y
          q[b * 4 + 2] = z
          q[b * 4 + 3] = ww
        }
        qrot(q, b0 * 4, (head[b1 * 3] - head[b0 * 3]) * sc, (head[b1 * 3 + 1] - head[b0 * 3 + 1]) * sc, (head[b1 * 3 + 2] - head[b0 * 3 + 2]) * sc, tmp, 0)
        p[b1 * 3] = Hx + tmp[0]
        p[b1 * 3 + 1] = Hy + tmp[1]
        p[b1 * 3 + 2] = Hz + tmp[2]
        // the bone beyond, aimed in the world (a palm laid on a wall, a foot kept flat) instead of hanging from the forearm
        const aim = R.b2 >= 0 && T.length >= 13 && (T[7] !== 0 || T[8] !== 0 || T[9] !== 0) ? R.b2 : -1
        dirty.fill(0)
        dirty[b1] = 1
        for (let b = b1 + 1; b < B; b++) {
          const pr = sk.parent[b]
          if (pr < 0 || !dirty[pr]) continue
          dirty[b] = 1
          if (b === aim) {
            const al = Math.hypot(T[7], T[8], T[9]) || 1
            dirQ(T[7] / al, T[8] / al, T[9] / al, T[10], T[11], T[12], tmp, 0)
            qmul(tmp, 0, R.rest, 8, tmp, 4)
            qmul(tmp, 4, lq, b * 4, tmp, 8)
            qmul(q, pr * 4, lq, b * 4, tmp, 12)
            const sgn = tmp[8] * tmp[12] + tmp[9] * tmp[13] + tmp[10] * tmp[14] + tmp[11] * tmp[15] < 0 ? -1 : 1
            let x = tmp[12] + (tmp[8] * sgn - tmp[12]) * w, y = tmp[13] + (tmp[9] * sgn - tmp[13]) * w, z = tmp[14] + (tmp[10] * sgn - tmp[14]) * w, ww = tmp[15] + (tmp[11] * sgn - tmp[15]) * w
            const l = Math.hypot(x, y, z, ww) || 1
            x /= l
            y /= l
            z /= l
            ww /= l
            q[b * 4] = x
            q[b * 4 + 1] = y
            q[b * 4 + 2] = z
            q[b * 4 + 3] = ww
          } else
          qmul(q, pr * 4, lq, b * 4, q, b * 4)
          qrot(q, pr * 4, (head[b * 3] - head[pr * 3]) * sc, (head[b * 3 + 1] - head[pr * 3 + 1]) * sc, (head[b * 3 + 2] - head[pr * 3 + 2]) * sc, tmp, 0)
          p[b * 3] = p[pr * 3] + tmp[0]
          p[b * 3 + 1] = p[pr * 3 + 1] + tmp[1]
          p[b * 3 + 2] = p[pr * 3 + 2] + tmp[2]
        }
      }
    }
    // ---- legs
    if (gait) {
      const Ls = gait.stride * sc
      for (let li = 0; li < legs.length; li++) {
        const L = legs[li]
        const ph = cyc + L.off
        const n = Math.floor(ph)
        const f = ph - n
        // where this foot stands in stride n: the body's distance at mid-stance, plus the foot's rest lead
        const s0 = (n + duty / 2 - L.off) * Ls + L.tip[0] * sc
        let fx: number, fy: number, fz: number, pitch: number
        const lane = d.lane + L.track * sc
        let hx: number, hz: number
        if (f < duty) {
          path.at(s0, ps)
          hx = ps[3]
          hz = ps[5]
          const hl = Math.hypot(hx, hz) || 1
          hx /= hl
          hz /= hl
          fx = ps[0] - hz * lane
          fz = ps[2] + hx * lane
          fy = (ground ? ground(fx, fz) : 0) + L.tip[1] * sc
          // late stance: the heel peels up and the foot rolls over its toe
          pitch = 0.42 * sstep((f / duty - 0.72) / 0.28)
        } else {
          const tau = (f - duty) / (1 - duty)
          const e = tau * tau * tau * (tau * (tau * 6 - 15) + 10)
          path.at(s0, ps)
          let ax = ps[3], az = ps[5]
          let al = Math.hypot(ax, az) || 1
          const x0 = ps[0] - (az / al) * lane, z0 = ps[2] + (ax / al) * lane
          path.at(s0 + Ls, ps)
          ax = ps[3]
          az = ps[5]
          al = Math.hypot(ax, az) || 1
          const x1 = ps[0] - (az / al) * lane, z1 = ps[2] + (ax / al) * lane
          path.at(s0 + Ls * e, ps)
          hx = ps[3]
          hz = ps[5]
          const hl = Math.hypot(hx, hz) || 1
          hx /= hl
          hz /= hl
          // along the path between the two plants (exactly on each at the ends)
          fx = ps[0] - hz * lane
          fz = ps[2] + hx * lane
          const g0 = ground ? ground(x0, z0) : 0, g1 = ground ? ground(x1, z1) : 0
          // the arc peaks early, as a real foot does: it is snatched up and set down gently
          fy = g0 + (g1 - g0) * e + L.tip[1] * sc + gait.lift * sc * Math.sin(Math.PI * Math.pow(tau, 0.8))
          pitch = 0.42 * (1 - sstep(tau * 2.2)) - 0.16 * Math.sin(Math.PI * sstep((tau - 0.35) / 0.65))
        }
        footOut[li * 4] = fx
        footOut[li * 4 + 1] = fy
        footOut[li * 4 + 2] = fz
        footOut[li * 4 + 3] = f < duty ? 1 : 0
        // the heading frame at the foot: forward (hx, 0, hz), right (-hz, 0, hx)
        const three = L.bones.length >= 3
        let vx: number, vy: number, vz: number, wx: number, wz: number
        let ax: number, ay: number, az: number
        // (a toe segment: the toes stay flat through stance and the segment above rolls over the ball of the foot)
        let tx = 0, ty = 0, tz = 0
        if (L.toes) {
          const tp = f < duty ? pitch * sstep((f / duty - 0.9) / 0.1) : pitch + 0.25 * Math.sin(Math.PI * sstep((f - duty) / (1 - duty)))
          const mp = f < duty ? pitch * 1.5 : pitch
          const ct = Math.cos(tp), st = Math.sin(tp)
          const ux = (L.toeV[0] * ct + L.toeV[1] * st) * sc, uy = (-L.toeV[0] * st + L.toeV[1] * ct) * sc, uz = L.toeV[2] * sc
          tx = hx * ux - hz * uz
          ty = uy
          tz = hz * ux + hx * uz
          const c = Math.cos(mp), s = Math.sin(mp)
          vx = (L.meta[0] * c + L.meta[1] * s) * sc
          vy = (-L.meta[0] * s + L.meta[1] * c) * sc
          vz = L.meta[2] * sc
          wx = hx * vx - hz * vz
          wz = hz * vx + hx * vz
          ax = fx - tx - wx
          ay = fy - ty - vy
          az = fz - tz - wz
        } else {
          const c = Math.cos(pitch), s = Math.sin(pitch)
          vx = (L.foot[0] * c + L.foot[1] * s) * sc
          vy = (-L.foot[0] * s + L.foot[1] * c) * sc
          vz = L.foot[2] * sc
          // ankle = tip - footVec (in world)
          wx = hx * vx - hz * vz
          wz = hz * vx + hx * vz
          ax = three ? fx - wx : fx
          ay = three ? fy - vy : fy
          az = three ? fz - wz : fz
        }
        // hip
        const at = L.attach
        qrot(q, at * 4, L.sock[0] * sc, L.sock[1] * sc, L.sock[2] * sc, tmp, 0)
        const Hx = p[at * 3] + tmp[0], Hy = p[at * 3 + 1] + tmp[1], Hz = p[at * 3 + 2] + tmp[2]
        let dx = ax - Hx, dy = ay - Hy, dz = az - Hz
        let dl = Math.hypot(dx, dy, dz) || 1e-6
        dx /= dl
        dy /= dl
        dz /= dl
        const l1 = L.l1 * sc, l2 = L.l2 * sc
        const reach = Math.min((l1 + l2) * 0.9995, L.dMax * sc)
        if (dl > reach) {
          info.overreach = Math.max(info.overreach, (dl - reach) / sc)
          if (L.pair === 0 && pairX.length > 1) overS = Math.max(overS, dl - reach)
          else overH = Math.max(overH, dl - reach)
          dl = reach
        }
        dl = Math.max(dl, Math.abs(l1 - l2) + 1e-4, L.dMin * sc)
        const ca = (l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl)
        const sa = Math.sqrt(Math.max(0, 1 - ca * ca))
        // pole: the rest bend direction carried by the trunk
        qrot(q, at * 4, L.pole[0], L.pole[1], L.pole[2], tmp, 0)
        let px = tmp[0], py = tmp[1], pz = tmp[2]
        const pk = px * dx + py * dy + pz * dz
        px -= dx * pk
        py -= dy * pk
        pz -= dz * pk
        const pl = Math.hypot(px, py, pz) || 1
        px /= pl
        py /= pl
        pz /= pl
        const nx = dy * pz - dz * py, ny = dz * px - dx * pz, nz = dx * py - dy * px
        const Kx = Hx + (dx * ca + px * sa) * l1, Ky = Hy + (dy * ca + py * sa) * l1, Kz = Hz + (dz * ca + pz * sa) * l1
        // (if the target was out of reach the ankle is pulled in along the line to it)
        const Ax = Hx + dx * dl, Ay = Hy + dy * dl, Az = Hz + dz * dl
        const b0 = L.bones[0], b1 = L.bones[1]
        dirQ((Kx - Hx) / l1, (Ky - Hy) / l1, (Kz - Hz) / l1, nx, ny, nz, tmp, 0)
        qmul(tmp, 0, L.rest, 0, q, b0 * 4)
        p[b0 * 3] = Hx
        p[b0 * 3 + 1] = Hy
        p[b0 * 3 + 2] = Hz
        dirQ((Ax - Kx) / l2, (Ay - Ky) / l2, (Az - Kz) / l2, nx, ny, nz, tmp, 0)
        qmul(tmp, 0, L.rest, 4, q, b1 * 4)
        p[b1 * 3] = Kx
        p[b1 * 3 + 1] = Ky
        p[b1 * 3 + 2] = Kz
        if (L.toes) {
          const b2 = L.bones[2], b3 = L.bones[3]
          const fl = Math.hypot(vx, vy, vz) || 1
          dirQ(wx / fl, vy / fl, wz / fl, -hz, 0, hx, tmp, 0)
          qmul(tmp, 0, L.rest, 8, q, b2 * 4)
          p[b2 * 3] = Ax
          p[b2 * 3 + 1] = Ay
          p[b2 * 3 + 2] = Az
          const tl = Math.hypot(tx, ty, tz) || 1
          dirQ(tx / tl, ty / tl, tz / tl, -hz, 0, hx, tmp, 0)
          qmul(tmp, 0, L.rest, 12, q, b3 * 4)
          p[b3 * 3] = Ax + wx
          p[b3 * 3 + 1] = Ay + vy
          p[b3 * 3 + 2] = Az + wz
        } else if (three) {
          const fl = Math.hypot(vx, vy, vz) || 1
          dirQ(wx / fl, vy / fl, wz / fl, -hz, 0, hx, tmp, 0)
          let prev = b1
          for (let k = 2; k < L.bones.length; k++) {
            const b = L.bones[k]
            qmul(tmp, 0, L.rest, 8, q, b * 4)
            if (k === 2) {
              p[b * 3] = Ax
              p[b * 3 + 1] = Ay
              p[b * 3 + 2] = Az
            } else {
              qrot(q, b * 4, (head[b * 3] - head[prev * 3]) * sc, (head[b * 3 + 1] - head[prev * 3 + 1]) * sc, (head[b * 3 + 2] - head[prev * 3 + 2]) * sc, tmp, 4)
              p[b * 3] = p[prev * 3] + tmp[4]
              p[b * 3 + 1] = p[prev * 3 + 1] + tmp[5]
              p[b * 3 + 2] = p[prev * 3 + 2] + tmp[6]
            }
            prev = b
          }
        }
      }
    }
    if (pass === 0 && (overH > 0 || overS > 0)) {
      dropH = overH * 1.6 + 1e-4 * sc
      dropS = overS * 1.6 + 1e-4 * sc
      info.overreach = 0
    } else break
    }
    // ---- small involuntary things: a blink every few seconds, breathing
    const bt = fract(d.time / (3.3 + 2.9 * fract(d.seed * 7.31)) + d.seed)
    info.blink = bt < 0.045 ? Math.sin((bt / 0.045) * Math.PI) : 0
    info.breath = Math.sin(d.time * (1.1 + 0.5 * fract(d.seed * 3.7)) + d.seed * 40)
    lastScale = sc
    lastSeed = d.seed
  }
  let lastScale = 1
  let lastSeed = 0

  function write(data: Float32Array, row: number, width: number, tint: Vec3 | null) {
    let o = row * width * 4
    data[o] = tint ? tint[0] : 1
    data[o + 1] = tint ? tint[1] : 1
    data[o + 2] = tint ? tint[2] : 1
    data[o + 3] = lastSeed
    data[o + 4] = info.cycle
    data[o + 5] = info.blink
    data[o + 6] = info.eyeX
    data[o + 7] = info.eyeY
    data[o + 8] = info.breath
    data[o + 9] = headC
    data[o + 10] = headS
    data[o + 11] = lastScale
    o += HEADER * 4
    for (let b = 0; b < B; b++, o += 8) {
      data[o] = q[b * 4]
      data[o + 1] = q[b * 4 + 1]
      data[o + 2] = q[b * 4 + 2]
      data[o + 3] = q[b * 4 + 3]
      qrot(q, b * 4, head[b * 3] * lastScale, head[b * 3 + 1] * lastScale, head[b * 3 + 2] * lastScale, tmp, 0)
      data[o + 4] = p[b * 3] - tmp[0]
      data[o + 5] = p[b * 3 + 1] - tmp[1]
      data[o + 6] = p[b * 3 + 2] - tmp[2]
      data[o + 7] = lastScale
    }
  }

  const rig: Rig = {
    spec, bones: B, q, p, pose, write, info,
    toe(leg, out) {
      const L = legs[leg]
      const b = L.bones[L.toes ? 3 : Math.min(2, L.bones.length - 1)]
      // (a two-bone leg has no foot bone: its tip hangs off the lower bone)
      qrot(q, b * 4, (L.tip[0] - head[b * 3]) * lastScale, (L.tip[1] - head[b * 3 + 1]) * lastScale, (L.tip[2] - head[b * 3 + 2]) * lastScale, tmp, 0)
      out[0] = p[b * 3] + tmp[0]
      out[1] = p[b * 3 + 1] + tmp[1]
      out[2] = p[b * 3 + 2] + tmp[2]
    },
    foot(leg, out) {
      out[0] = footOut[leg * 4]
      out[1] = footOut[leg * 4 + 1]
      out[2] = footOut[leg * 4 + 2]
      return footOut[leg * 4 + 3] > 0
    },
    legs: legs.length,
    excursion: 0,
    centre: [built.centre[0], built.centre[1], built.centre[2]],
    radius: built.radius,
    bone: (name) => sk.names.indexOf(name),
  }
  // how far the animation carries any bone from its rest place: sample a cycle on a straight line
  {
    const line = makePath([[-1000, 0, 0], [0, 0, 0], [1000, 0, 0]], false, 8)
    const d = makeDrive(line)
    const stride = gait?.stride ?? swim?.stride ?? 1
    let ex = 0
    for (let k = 0; k < 24; k++) {
      d.dist = 1000 + (k / 24) * stride
      d.time = k * 0.37
      for (const key of (spec.motions ?? []).map((m) => m.channel)) if (key) d.ch[key] = 1
      for (const key of Object.keys(spec.poses ?? {})) d.ch[key] = 1
      pose(d)
      for (let b = 0; b < B; b++) ex = Math.max(ex, Math.hypot(p[b * 3] - (d.dist - 1000) - head[b * 3], p[b * 3 + 1] - head[b * 3 + 1], p[b * 3 + 2] - head[b * 3 + 2]))
    }
    rig.excursion = ex
  }
  return rig
}

