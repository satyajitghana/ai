// The creature toolkit, part 7: helpers that write spec data the way an anatomist reads a diagram.
// Nothing here is a new primitive: each returns the plain `Section`, `PartSpec` and `Bulge` data of
// spec.ts, so anything it produces can be edited by hand afterwards.
//
//   loft      a body (or a skull) from three outlines read off a skeletal drawing: the dorsal
//             line and the ventral line of the side view, and the half-width of the top view
//   limb      a jointed limb from its joint positions and a girth profile written in "joint
//             units" (1.4 = four tenths of the way from the first joint to the second)
//   digits    the parts of a finger or toe: phalanges, knuckles, pads and a nail or hoof
//   muscle    a `Bulge` written by where it sits, not by angles

import { curve } from "./build"
import { MAT, type Bulge, type PartSpec, type Section, type Vec3 } from "./spec"

/**
 * One station of a loft: at `x` along the animal, the top and bottom of the side-view outline and
 * the half-width of the top-view outline. `mid` is how far up from the bottom the widest line
 * sits (0.5 default; 0.35 for a belly that hangs, 0.65 for a back broader than the belly), `n` /
 * `nb` the squareness of the upper and lower halves (2 round, 3 boxy, 1.6 tented), `ridge` and
 * `keel` as in `Section`, `z` an offset of the centre line (a head carried to one side).
 */
export type Station = { x: number; top: number; bot: number; hw: number; mid?: number; n?: number; nb?: number; ridge?: [number, number]; keel?: [number, number]; bow?: number }

export type Loft = {
  spine: Vec3[]
  sect: Section[]
  /** Spine position 0..1 of a given x (for `bones`, `breath`, `tailAt`, bulges and anchors). */
  at(x: number): number
  /** The centre line's height at x, the top and the bottom of the outline there. */
  mid(x: number): number
}

/** A body from its outlines. Stations in order, tail first (or whichever end the part starts at). */
export function loft(st: Station[]): Loft {
  const spine: Vec3[] = st.map((s) => [s.x, s.bot + (s.top - s.bot) * (s.mid ?? 0.5), 0])
  const cv = curve(spine.map((p) => [p[0], p[1], p[2]] as [number, number, number]), true)
  const sect: Section[] = st.map((s, i) => {
    const c = spine[i][1]
    const o: Section = { at: cv.knots[i], w: s.hw, up: Math.max(1e-4, s.top - c), dn: Math.max(1e-4, c - s.bot), n: s.n ?? 2.2, nb: s.nb ?? s.n ?? 2.2 }
    if (s.ridge) o.ridge = s.ridge
    if (s.keel) o.keel = s.keel
    if (s.bow) o.bow = s.bow
    return o
  })
  const seg = (x: number): [number, number] => {
    let i = 0
    while (i < st.length - 2 && (st[i + 1].x - st[i].x) * (x - st[i + 1].x) > 0) i++
    const f = Math.min(1, Math.max(0, (x - st[i].x) / (st[i + 1].x - st[i].x || 1)))
    return [i, f]
  }
  return {
    spine,
    sect,
    at(x) {
      const [i, f] = seg(x)
      return cv.knots[i] + (cv.knots[i + 1] - cv.knots[i]) * f
    },
    mid(x) {
      const [i, f] = seg(x)
      return spine[i][1] + (spine[i + 1][1] - spine[i][1]) * f
    },
  }
}

/**
 * One girth station of a limb: `t` in joint units (0 the socket, 1 the first joint, 1.5 half way
 * down the second segment ...), `w` the half-width across the limb, `f` and `b` the half-depths
 * toward the limb's `up` side and away from it (front and back of a leg whose `up` is +x).
 */
export type Girth = { t: number; w: number; f: number; b?: number; n?: number; nb?: number }

export type LimbSpec = {
  /** The socket, then every joint, then the tip: model space. */
  joints: Vec3[]
  girth: Girth[]
  /** Muscle and bone on it, placed in joint units: `t`, `len` (half-extent, joint units), and the rest as `Bulge`. */
  bulges?: (Omit<Bulge, "at" | "len"> & { t: number; len: number })[]
}

/** The path, sections and bulges of a jointed limb. Spread the result into a `PartSpec` and add name, role, fillet, limits. `v(t)` turns joint units into the part's 0..1 (for anchoring toes or more bulges). */
export function limb(l: LimbSpec): Pick<PartSpec, "origin" | "path" | "sect" | "jointed" | "bones" | "bulges"> & { v(t: number): number } {
  const J = l.joints
  const len: number[] = [0]
  for (let i = 1; i < J.length; i++) len.push(len[i - 1] + Math.hypot(J[i][0] - J[i - 1][0], J[i][1] - J[i - 1][1], J[i][2] - J[i - 1][2]))
  const total = len[len.length - 1] || 1
  const at = (t: number) => {
    const i = Math.min(J.length - 2, Math.max(0, Math.floor(t)))
    return (len[i] + (len[i + 1] - len[i]) * Math.min(1, Math.max(0, t - i))) / total
  }
  return {
    origin: J[0],
    path: J.slice(1).map((p): Vec3 => [p[0] - J[0][0], p[1] - J[0][1], p[2] - J[0][2]]),
    sect: l.girth.map((g) => ({ at: at(g.t), w: g.w, up: g.f, dn: g.b ?? g.f, n: g.n ?? 2, nb: g.nb ?? g.n ?? 2 })),
    jointed: true,
    bones: "joints",
    bulges: l.bulges?.map((b) => ({ ...b, at: at(b.t), len: b.len * ((len[Math.min(J.length - 1, Math.floor(b.t) + 1)] - len[Math.min(J.length - 2, Math.floor(b.t))]) / total), mirror: b.mirror ?? false })),
    v: at,
  }
}

/** A swelling written by place: `at` and `len` along the part (0..1), `around` and `arc` in degrees, `h` its height. One-sided unless `both`. */
export const muscle = (at: number, around: number, h: number, len: number, arc: number, both = false): Bulge => ({ at, around, h, len, arc, mirror: both })

export type DigitSpec = {
  name: string
  on: string
  /** The knuckle it grows from, then each joint, then the tip: model space. */
  joints: Vec3[]
  /** Half-width at the root and at the tip; depth is `depth` times the width (default 0.92). */
  r0: number
  r1: number
  depth?: number
  /** The dorsal (nail) side. */
  up: Vec3
  role?: string
  row?: number
  /** A nail (flat, on the dorsal side of the last segment) or a hoof / claw (a cap over the tip), or neither. */
  tip?: "nail" | "hoof" | "claw" | "none"
  mirror?: boolean
  /** Knuckle height as a fraction of the radius (default 0.22) and pad height (default 0.16). */
  knuckle?: number
  pad?: number
  limits?: [number, number]
  minDetail?: number
  fillet?: number
}

/**
 * A finger or a toe: a jointed chain with a knuckle over each joint, a pad under each segment and
 * its nail, hoof or claw. Returns the parts in order (the digit, then what rides on it).
 */
export function digit(d: DigitSpec): PartSpec[] {
  const nseg = d.joints.length - 1
  const dep = d.depth ?? 0.92
  const girth: Girth[] = []
  for (let i = 0; i <= nseg; i++) {
    const r = d.r0 + (d.r1 - d.r0) * (i / nseg)
    girth.push({ t: i, w: r * (i === nseg ? 0.82 : 1), f: r * dep * (i === nseg ? 0.7 : 1), b: r * dep * (i === nseg ? 0.8 : 1) })
    if (i < nseg) girth.push({ t: i + 0.5, w: r * 0.93, f: r * dep * 0.9, b: r * dep * 0.98 })
  }
  const bulges: LimbSpec["bulges"] = []
  for (let i = 1; i < nseg; i++) bulges.push({ t: i, len: 0.22, around: 0, arc: 75, h: d.r0 * (d.knuckle ?? 0.22) })
  for (let i = 0; i < nseg; i++) bulges.push({ t: i + 0.55, len: 0.42, around: 180, arc: 80, h: d.r0 * (d.pad ?? 0.16) * (i === nseg - 1 ? 1.5 : 1) })
  const lm = limb({ joints: d.joints, girth, bulges })
  const r = d.r1
  const out: PartSpec[] = [{ name: d.name, on: d.on, ...lm, up: d.up, mirror: d.mirror, rings: 6 * nseg + 2, sides: 12, cap: "round", fillet: d.fillet ?? d.r0 * 0.7, role: d.role ?? "digit", row: d.row ?? 0, limits: d.limits, minDetail: d.minDetail }]
  const tip = d.tip ?? "nail"
  if (tip === "nail")
    out.push({ name: d.name + "Nail", on: d.name, at: lm.v(nseg - 0.62), around: 0, mirror: d.mirror, sink: r * 0.5, frame: "surface", path: [[r * 0.8, r * 0.3, 0], [r * 1.45, r * 0.16, 0]], up: d.up, sect: [{ at: 0, w: r * 0.6, up: r * 0.16, n: 2.6 }, { at: 0.6, w: r * 0.7, up: r * 0.14, n: 2.6 }, { at: 1, w: r * 0.55, up: r * 0.08 }], rings: 5, sides: 8, cap: "round", fillet: r * 0.12, mat: MAT.horn, minDetail: d.minDetail ?? 0.4 })
  else if (tip !== "none")
    out.push({ name: d.name + "Hoof", on: d.name, at: lm.v(nseg - 0.5), around: 0, mirror: d.mirror, sink: r * 0.9, frame: "surface", path: tip === "hoof" ? [[r * 0.8, -r * 0.5, 0], [r * 1.25, -r * 1.0, 0]] : [[r * 1.1, -r * 0.3, 0], [r * 2.2, -r * 1.3, 0]], up: d.up, sect: tip === "hoof" ? [{ at: 0, w: r * 1.08, up: r * 1.0, dn: r * 0.9, n: 2.5 }, { at: 0.6, w: r * 1.0, up: r * 0.85, dn: r * 0.7, n: 2.5 }, { at: 1, w: r * 0.7, up: r * 0.4, dn: r * 0.3 }] : [{ at: 0, w: r * 0.7, up: r * 0.8 }, { at: 1, w: r * 0.06, up: r * 0.08 }], rings: 5, sides: 9, cap: tip === "hoof" ? "round" : "point", fillet: r * 0.15, mat: MAT.horn, minDetail: d.minDetail ?? 0.4 })
  return out
}
