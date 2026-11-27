// The creature toolkit, part 8: the grip solver. Closes the digits of a hand (or the toes of a
// foot, or a raptor's claws) round a primitive and returns the result as a held `Pose`, which the
// rig blends in with a drive channel. It runs once, on spec data alone, in `create` or at module
// level: nothing here is called per frame.
//
// Method: each digit is a chain of capsules (its joints, with the half-depth of its sections as
// the radius). From the root joint outward, each joint is flexed toward the side opposite the
// digit's `up` until the segment beyond it touches the shape or the joint reaches its limit; the
// joints after it then start from that pose. That is how a hand closes: the proximal joints stop
// first where they meet the object and the tips wrap on.

import { sectAt } from "./build"
import type { CreatureSpec, PartSpec, Pose, Vec3 } from "./spec"

/** What is held, in the model space of the rest pose. */
export type GripShape =
  | { kind: "sphere"; c: Vec3; r: number }
  | { kind: "ellipsoid"; c: Vec3; r: Vec3 }
  /** A shaft, a handle, a branch: a capsule from a to b. */
  | { kind: "capsule"; a: Vec3; b: Vec3; r: number }

export type GripOpts = {
  /** Roles of the parts that close (default ["digit"]). */
  roles?: string[]
  /** Most each joint may flex, radians, root joint first (default: 1.5, 1.85, 1.4: a human finger's MCP, PIP, DIP). Per part name to override (a thumb). */
  max?: number[]
  maxOf?: Record<string, number[]>
  /** Gap left between skin and object, model units (default 0). */
  gap?: number
  /** A joint that never meets the object flexes this fraction of its limit (default 0.55: fingers that overhang a small stone still curl). */
  slack?: number
  /** Spread (radians about `up`) applied to each digit's root joint, by part name: fan the fingers round a ball. */
  spread?: Record<string, number>
  /**
   * A set rotation of a digit's root joint before it closes, by part name: [flex, spread, twist]
   * in the rig's own order (twist about the digit's axis, then spread, then flex). This is how a
   * thumb opposes: its metacarpal turns at the CMC joint (twist, toward pronation), swings out
   * (spread) and forward (flex), and only then do its joints close on the object. The root's
   * solved flex is added on top of `pre[0]`. Use it instead of `spread` for that digit.
   */
  pre?: Record<string, [number, number, number]>
  /** Only these parts close (others are left out of the pose). */
  only?: string[]
  /**
   * Test every segment from the closing joint to the tip, not only the one beyond the joint, so a
   * long finger cannot fold its middle into the object while its tip is still clear. Default false
   * (the original behaviour, kept so existing grips do not move).
   */
  whole?: boolean
  /**
   * Wrap: each joint closes until its own segment touches, and a segment that starts inside the
   * object opens until it is clear, so every phalanx ends on the surface (a power grip) instead of
   * the finger stopping straight at its first contact. Default false.
   */
  wrap?: boolean
}

type V = [number, number, number]
const sub = (a: Vec3, b: Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec3): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
/** rotate p about the axis k (unit) through o by angle a */
const turn = (p: Vec3, o: Vec3, k: Vec3, a: number): V => {
  const v = sub(p, o), c = Math.cos(a), s = Math.sin(a)
  const kxv = cross(k, v), kd = dot(k, v) * (1 - c)
  return [o[0] + v[0] * c + kxv[0] * s + k[0] * kd, o[1] + v[1] * c + kxv[1] * s + k[1] * kd, o[2] + v[2] * c + kxv[2] * s + k[2] * kd]
}

/** Signed distance from p to the shape (exact for a sphere and a capsule, a good bound for an ellipsoid). */
export function gripDistance(s: GripShape, p: Vec3): number {
  if (s.kind === "sphere") return Math.hypot(p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]) - s.r
  if (s.kind === "capsule") {
    const ab = sub(s.b, s.a), ap = sub(p, s.a)
    const t = Math.min(1, Math.max(0, dot(ap, ab) / (dot(ab, ab) || 1e-12)))
    return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t) - s.r
  }
  const q: V = [(p[0] - s.c[0]) / s.r[0], (p[1] - s.c[1]) / s.r[1], (p[2] - s.c[2]) / s.r[2]]
  const k0 = Math.hypot(q[0], q[1], q[2])
  const k1 = Math.hypot(q[0] / s.r[0], q[1] / s.r[1], q[2] / s.r[2])
  return k1 > 1e-12 ? (k0 * (k0 - 1)) / k1 : -Math.min(s.r[0], s.r[1], s.r[2])
}

/**
 * Close every digit of `spec` round `shape`. Digits are jointed parts with an explicit `origin`
 * (their role in `roles`), posed from the rest pose: put the hand where it should hold the object
 * and the object where it should sit, in model space. Returns a `Pose`: put it in
 * `spec.poses.grip` and drive `ch.grip` from 0 (open) to 1 (closed).
 */
export function solveGrip(spec: CreatureSpec, shape: GripShape, o: GripOpts = {}): Pose {
  const roles = o.roles ?? ["digit"]
  const pose: Pose = {}
  const gap = o.gap ?? 0
  for (const ps of spec.parts as PartSpec[]) {
    if (!ps.jointed || !ps.origin || !roles.includes(ps.role ?? "")) continue
    if (o.only && !o.only.includes(ps.name)) continue
    const J: V[] = [[...ps.origin] as V, ...ps.path.map((p): V => [ps.origin![0] + p[0], ps.origin![1] + p[1], ps.origin![2] + p[2]])]
    const n = J.length - 1
    const len: number[] = [0]
    for (let i = 1; i <= n; i++) len.push(len[i - 1] + Math.hypot(...sub(J[i], J[i - 1])))
    const dir = norm(sub(J[1], J[0]))
    let up: V = ps.up ? [...ps.up] as V : Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
    const k = dot(up, dir)
    up = norm([up[0] - dir[0] * k, up[1] - dir[1] * k, up[2] - dir[2] * k])
    // flexing toward -up is a negative turn about side = dir x up
    let side: V = cross(dir, up)
    const max = o.maxOf?.[ps.name] ?? o.max ?? [1.5, 1.85, 1.4]
    const angles: [number, number, number][] = []
    const spread = o.spread?.[ps.name] ?? 0
    if (spread) {
      for (let i = 1; i <= n; i++) J[i] = turn(J[i], J[0], up, spread)
      side = turn(side, [0, 0, 0], up, spread)
    }
    const pre = o.pre?.[ps.name]
    // the rig's order for a root bone: twist about the axis, then spread about up, then flex about side (fixed rest axes)
    const R0 = (p: Vec3, org: Vec3, a: number): V => turn(turn(turn(p, org, dir, pre![2]), org, up, pre![1]), org, side, -(pre![0] + a))
    for (let b = 0; b < n; b++) {
      const lim = max[Math.min(b, max.length - 1)]
      // the half-depth of the digit along this segment, on its palmar side
      const rad = (t: number) => {
        const q = sectAt(ps.sect, (len[b] + (len[b + 1] - len[b]) * t) / (len[n] || 1))
        return q.dn
      }
      const radAt = (seg: number, t: number) => sectAt(ps.sect, (len[seg] + (len[seg + 1] - len[seg]) * t) / (len[n] || 1)).dn
      const clear = (a: number) => {
        let m = 1e9
        for (let i = 1; i <= 6; i++) {
          const t = i / 6
          const p: V = [J[b][0] + (J[b + 1][0] - J[b][0]) * t, J[b][1] + (J[b + 1][1] - J[b][1]) * t, J[b][2] + (J[b + 1][2] - J[b][2]) * t]
          m = Math.min(m, gripDistance(shape, pre && b === 0 ? R0(p, J[0], a) : turn(p, J[b], side, -a)) - rad(t) - gap)
        }
        if (o.whole)
          for (let sg = b + 1; sg < n; sg++)
            for (let i = 0; i <= 6; i++) {
              const t = i / 6
              const p: V = [J[sg][0] + (J[sg + 1][0] - J[sg][0]) * t, J[sg][1] + (J[sg + 1][1] - J[sg][1]) * t, J[sg][2] + (J[sg + 1][2] - J[sg][2]) * t]
              m = Math.min(m, gripDistance(shape, pre && b === 0 ? R0(p, J[0], a) : turn(p, J[b], side, -a)) - radAt(sg, t) - gap)
            }
        return m
      }
      let a = lim * (o.slack ?? 0.55)
      if (pre && b === 0 && clear(0) <= 0) {
        // the set rotation already puts the digit into the object: open it until it is clear
        a = 0
        for (let i = 1; i <= 64 && clear(a) <= 0; i++) a = (-1.4 * i) / 64
      } else if (o.wrap && clear(0) <= 0) {
        a = 0
        for (let i = 1; i <= 64 && clear(a) <= 0; i++) a = (-lim * i) / 64
      } else if (clear(0) <= 0) a = 0
      else {
        const N = 48
        for (let i = 1; i <= N; i++) {
          const x = (lim * i) / N
          if (clear(x) > 0) continue
          let lo = (lim * (i - 1)) / N, hi = x
          for (let it = 0; it < 18; it++) {
            const mid = (lo + hi) / 2
            if (clear(mid) > 0) lo = mid
            else hi = mid
          }
          a = lo
          break
        }
      }
      if (pre && b === 0) {
        angles.push([pre[0] + a, pre[1], pre[2]])
        for (let i = 1; i <= n; i++) J[i] = R0(J[i], J[0], a)
        side = norm(R0(side, [0, 0, 0], a))
        continue
      }
      angles.push([a, b === 0 ? spread : 0, 0])
      for (let i = b + 1; i <= n; i++) J[i] = turn(J[i], J[b], side, -a)
    }
    pose[ps.name] = angles
  }
  return pose
}
