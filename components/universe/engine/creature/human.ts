// The creature toolkit, part 9: a human figure. THE WORKED PATTERN for people: a spec built from a
// body type (measured lengths and breadths), a `Look` for skin, hair and a hide wrap, and a
// catalogue of poses written as pure functions of time that fill a `Drive`.
//
// Model space as everywhere: +x is the way the figure faces, +y up, +z its right; the origin is on
// the ground between the feet; metres. The rest pose stands with the arms held out and down (an
// A-pose: skin weights are kindest to a shoulder half way between hanging and raised).
//
// How it is put together, so it can be copied for another biped:
//   body    the torso only, a column from the crotch to the base of the neck, lofted from back,
//           front and half-width at each height (`column`), with seven spine frames. Frame 0 is the
//           pelvis: every spine pose (`lean`, `bend`, `twist`, `tilt`) turns frames above it.
//   head    neck and head as ONE part with four bones (so there is no seam under the jaw), dense
//           enough to carry a face: brow, sockets, cheekbones, chin and jaw are bulges; nose, lips,
//           ears, eyes and brows are small parts filleted into it.
//   arm     shoulder, elbow, wrist and palm as ONE jointed tube (so there is no seam at the wrist),
//           round at the shoulder and flat at the palm; the five digits grow from its end.
//   leg     hip, knee, ankle, ball of the foot as one jointed tube, a heel, five toes.
// Arms and legs are placed by `drive.reach` (two-bone IK to a world point, the hand or foot aimed
// in the world); the spine, the head and the fingers by `poses` weighted by `drive.ch`.
//
// Sources (R/f/creatures/refs.md, section 8). Fetched: ANSUR II (Gordon et al. 2014) adult stature,
// acromial, crotch, knee and malleolus heights, biacromial and hip breadth, segment, hand and foot
// lengths, head length and breadth; Snyder et al. 1977 for the child; the NIOSH head-and-face
// report for nose and mouth. By eye, not from a source: every girth (leaner than the soldiers
// measured), chest and waist sizes, the adults' chin-to-crown height (0.232, 0.218), and the hip
// joint, set 1.5 cm above the fetched trochanterion height (0.901, 0.845).

import { digit, limb, muscle, type LimbSpec } from "./anatomy"
import { curve } from "./build"
import { solveGrip } from "./grip"
import { frameOf, handOcclusion, handParts, handPoses, HELD, PALM_BULGES, PALM_END, PALM_GIRTH, type HandFrame, type HandMap } from "./hand"
import type { LodSpec } from "./gpu"
import type { Drive, Rig } from "./rig"
import type { Look, Paint } from "./shade"
import { MAT, type Bulge, type CardSpec, type CreatureSpec, type PartSpec, type Pose, type Section, type Vec3 } from "./spec"

type V = [number, number, number]

// ---------------------------------------------------------------- body types

/** A body, in metres. Heights are above the ground, standing; breadths and depths are whole widths. */
export type BodyType = {
  name: string
  stature: number
  /** Acromion (the point of the shoulder), crotch, hip joint (trochanterion), knee (mid patella) and ankle (lateral malleolus) heights. */
  shoulder: number
  crotch: number
  hip: number
  knee: number
  ankle: number
  /** Biacromial breadth; chest, waist and hip breadth and depth. */
  biacromial: number
  chest: [number, number]
  waist: [number, number]
  hips: [number, number]
  /** Shoulder to elbow, elbow to wrist, hand length (wrist crease to the middle fingertip), foot length. */
  upperArm: number
  forearm: number
  hand: number
  foot: number
  /** Chin to the top of the head, head length (brow to the back) and breadth, neck half-width. */
  head: number
  headL: number
  headB: number
  neck: number
  /** Limb girth as a multiple of the reference adult's (1 = a lean adult man). */
  mass: number
  /** 0..1: how far the bony landmarks are softened (a child's face and limbs, 1). */
  soft: number
  /** Height of the lower face relative to the skull, 1 adult; a child's face is shorter under a full-size cranium (0.86). */
  face: number
  /** Breast volume, metres of projection (0 none). */
  bust: number
}

/** A man of ANSUR II mean lengths (stature 1.756 m), leaner than the soldiers measured. */
export const adultA: BodyType = {
  name: "adultA", stature: 1.756, shoulder: 1.44, crotch: 0.846, hip: 0.915, knee: 0.488, ankle: 0.073,
  biacromial: 0.415, chest: [0.3, 0.225], waist: [0.275, 0.195], hips: [0.335, 0.225],
  upperArm: 0.305, forearm: 0.262, hand: 0.193, foot: 0.271, head: 0.232, headL: 0.1995, headB: 0.154, neck: 0.057, mass: 1, soft: 0, face: 1, bust: 0,
}
/** A woman of ANSUR II mean lengths (stature 1.629 m): narrower shoulders, hips as broad as a man's. */
export const adultB: BodyType = {
  name: "adultB", stature: 1.629, shoulder: 1.335, crotch: 0.782, hip: 0.86, knee: 0.449, ankle: 0.063,
  biacromial: 0.365, chest: [0.262, 0.2], waist: [0.245, 0.175], hips: [0.34, 0.215],
  upperArm: 0.283, forearm: 0.237, hand: 0.181, foot: 0.246, head: 0.218, headL: 0.19, headB: 0.148, neck: 0.049, mass: 0.86, soft: 0.45, face: 0.97, bust: 0.03,
}
/** A child of about eight (Snyder et al. 1977, ages 7.5 to 8.5: stature 1.269 m): 6.75 heads tall, short legs, no muscle definition. */
export const child: BodyType = {
  name: "child", stature: 1.269, shoulder: 1.02, crotch: 0.582, hip: 0.636, knee: 0.345, ankle: 0.05,
  biacromial: 0.279, chest: [0.208, 0.155], waist: [0.204, 0.15], hips: [0.224, 0.16],
  upperArm: 0.212, forearm: 0.182, hand: 0.138, foot: 0.198, head: 0.188, headL: 0.186, headB: 0.142, neck: 0.04, mass: 0.64, soft: 1, face: 0.88, bust: 0,
}

// ---------------------------------------------------------------- helpers

const add = (a: Vec3, b: Vec3): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: Vec3, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec3): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const mixn = (a: number, b: number, t: number) => a + (b - a) * t
const sstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/** One level of an upright loft: at height `y`, where the back and the front of the outline are (x) and the half-width. */
export type Level = { y: number; back: number; front: number; hw: number; n?: number; nb?: number }

/**
 * An upright body from its outlines, the vertical twin of `loft`: the side view's back and front
 * lines and the front view's half-width, bottom first. With the default `body.up` of an upright
 * spine (-x), `around: 0` is the back, 180 the front, 90 the right side. `at(y)` gives the 0..1
 * position of a height, for bones, bulges and anchors.
 */
export function column(st: Level[], axis?: [number, number]): { pts: V[]; sect: Section[]; at(y: number): number } {
  // The centre line is straight (from `axis[0]` at the bottom to `axis[1]` at the top; default: the
  // middle of the first and last levels) and the outline's asymmetry goes into the section's two
  // half-depths. A centre line that followed the outline's middle would tilt the rings wherever the
  // front steps out (a chin, a brow) and fold the surface over itself.
  const n = st.length - 1
  const a0 = axis ? axis[0] : (st[0].back + st[0].front) / 2, a1 = axis ? axis[1] : (st[n].back + st[n].front) / 2
  const ax = (y: number) => a0 + ((a1 - a0) * (y - st[0].y)) / (st[n].y - st[0].y || 1)
  const pts: V[] = st.map((s) => [ax(s.y), s.y, 0])
  const cv = curve(pts, true)
  const sect: Section[] = st.map((s, i) => ({ at: cv.knots[i], w: s.hw, up: Math.max(1e-4, ax(s.y) - s.back), dn: Math.max(1e-4, s.front - ax(s.y)), n: s.n ?? 2.2, nb: s.nb ?? s.n ?? 2.2 }))
  return {
    pts, sect,
    at(y) {
      let i = 0
      while (i < st.length - 2 && y > st[i + 1].y) i++
      const f = Math.min(1, Math.max(0, (y - st[i].y) / (st[i + 1].y - st[i].y || 1)))
      return cv.knots[i] + (cv.knots[i + 1] - cv.knots[i]) * f
    },
  }
}

// ---------------------------------------------------------------- the figure

/** Rest-space points a scene hangs things on: `ride(rig, bone, point, scale, out)` carries one with a bone. */
export type Anchors = {
  /** Centre of a stone held in the right palm, and the two ends of a shaft held across it (a hammer handle, a crank). */
  stone: V
  shaft: [V, V]
  /** Centre of the right palm, its normal (out of the palm), the direction of the fingers. */
  palm: V
  palmN: V
  fingers: V
  /** Where a reed or stylus leaves the right hand's pinch, and the direction it points. */
  pinch: V
  pinchDir: V
  /** Rest positions: eyes' midpoint, shoulder joints, hip joints, wrists and ankles (right side; mirror z for the left). */
  eyes: V
  shoulder: V
  hipJ: V
  wrist: V
  ankleJ: V
}

export type Human = {
  body: BodyType
  spec: CreatureSpec
  anchors: Anchors
  /** Lengths the pose functions use: thigh, shin, upper arm, forearm (model units). */
  len: { thigh: number; shin: number; upper: number; fore: number; hand: number }
  /** Where the right hand is in rest space (mirrored for the left), for the hand shading (`humanLook` puts it in the Look). */
  hand: HandFrame
}

export type HumanOpts = {
  /** The first pass's hand (tube fingers, no nail folds, the old joint positions), for a scene tuned to it. Default false: the macro hand of hand.ts. */
  classicHand?: boolean
  /** Linear skinning instead of dual quaternions (the first pass's shoulders and wrists). Default false. */
  linear?: boolean
}

/** The hand of `examples.hand`, re-used: its own axes are x along the fingers, y out of the back of the hand, z across (thumb on -z), wrist at x = 0.244. */
const finger = (k: Vec3, L: [number, number, number], fan: number): Vec3[] => {
  const J: Vec3[] = [k]
  let a = 0.1
  for (const l of L) {
    const p = J[J.length - 1]
    J.push([p[0] + l * Math.cos(a), p[1] - l * Math.sin(a), p[2] + l * fan])
    a += 0.11
  }
  return J
}
const KNUCKLE: Record<string, Vec3> = { index: [0.362, 0, -0.031], middle: [0.367, 0.001, -0.0105], ring: [0.362, 0, 0.0105], little: [0.352, -0.002, 0.03] }
const PHAL: Record<string, [number, number, number]> = { index: [0.04, 0.024, 0.021], middle: [0.045, 0.027, 0.023], ring: [0.041, 0.026, 0.022], little: [0.033, 0.019, 0.02] }
const FAN: Record<string, number> = { index: -0.07, middle: -0.015, ring: 0.04, little: 0.1 }
const FR: Record<string, [number, number]> = { index: [0.0094, 0.0076], middle: [0.0096, 0.0078], ring: [0.009, 0.0073], little: [0.008, 0.0065] }
export const FINGERS = ["thumb", "index", "middle", "ring", "little"] as const

/** Build a human figure of a body type. Call once per body type; the result is plain data plus the anchors. */
export function makeHuman(b: BodyType = adultA, opts: HumanOpts = {}): Human {
  const classic = !!opts.classicHand
  const m = b.mass
  const hard = 1 - b.soft
  // ---- the torso: f = 0 at the crotch, 1 at the point of the shoulder
  const ty = (f: number) => b.crotch + (b.shoulder - b.crotch) * f
  const kH = b.hips[0] / 0.335, kW = b.waist[0] / 0.275, kC = b.chest[0] / 0.3, kS = b.biacromial / 0.415
  const dH = b.hips[1] / 0.225, dW = b.waist[1] / 0.195, dC = b.chest[1] / 0.225
  const T = column([
    { y: ty(-0.03), back: -0.045 * dH, front: 0.04 * dH, hw: 0.06 * kH, n: 2.1 },
    { y: ty(0.07), back: -0.11 * dH, front: 0.08 * dH, hw: 0.152 * kH, n: 2.12, nb: 2.22 },
    { y: ty(0.19), back: -0.122 * dH, front: 0.088 * dH, hw: 0.168 * kH, n: 2.12, nb: 2.22 },
    { y: ty(0.33), back: -0.1 * dW, front: 0.093 * dW, hw: 0.152 * kW, n: 2.12, nb: 2.22 },
    { y: ty(0.44), back: -0.088 * dW, front: 0.092 * dW, hw: 0.138 * kW, n: 2.12, nb: 2.22 },
    { y: ty(0.6), back: -0.103 * dC, front: 0.098 * dC, hw: 0.148 * kC, n: 2.12, nb: 2.22 },
    { y: ty(0.76), back: -0.118 * dC, front: 0.112 * dC, hw: 0.162 * kC, n: 2.12, nb: 2.22 },
 ...(classic ? [
    { y: ty(0.89), back: -0.116 * dC, front: 0.1 * dC, hw: 0.16 * kS, n: 2.1, nb: 2.2 },
    { y: ty(0.96), back: -0.104 * dC, front: 0.078 * dC, hw: 0.15 * kS, n: 2 },
    { y: ty(1.01), back: -0.09 * dC, front: 0.055 * dC, hw: 0.118 * kS, n: 2 },
    { y: ty(1.045), back: -0.074 * dC, front: 0.034 * dC, hw: 0.066 * kS, n: 2 },
  ] : [
    // the shoulders carried out to meet the deltoids, and the trapezius sloping from them up into the neck
    { y: ty(0.89), back: -0.116 * dC, front: 0.1 * dC, hw: 0.172 * kS, n: 2.2, nb: 2.3 },
    { y: ty(0.955), back: -0.104 * dC, front: 0.076 * dC, hw: 0.166 * kS, n: 2.3, nb: 2.2 },
    { y: ty(0.99), back: -0.092 * dC, front: 0.056 * dC, hw: 0.132 * kS, n: 2.1 },
    { y: ty(1.02), back: -0.078 * dC, front: 0.04 * dC, hw: 0.084 * kS, n: 2 },
    { y: ty(1.04), back: -0.066 * dC, front: 0.03 * dC, hw: 0.056 * kS, n: 2 },
  ]),
  ])
  const ta = (f: number) => T.at(ty(f))
  const mus = hard * 0.75 + 0.25
  const bodyBulges: Bulge[] = [
    muscle(ta(0.11), 42, 0.02 * dH, 0.085, 46, true), // the buttocks
    muscle(ta(0.5), 0, -0.006, 0.26, 11, false), // the furrow of the spine
    muscle(ta(0.84), 34, 0.006 * mus, 0.07, 30, true), // shoulder blades
    muscle(ta(0.8), 142, 0.009 * mus + b.bust, 0.075, 34, true), // the chest
    muscle(ta(0.62), 180, -0.004 * mus, 0.04, 26, false), // the pit under the breastbone
    muscle(ta(0.36), 104, 0.005 * mus, 0.035, 30, true), // the crest of the hip bone
    muscle(ta(0.4), 180, -0.003, 0.012, 7, false), // the navel
  ]
  // ---- neck and head: head-local coordinates are the adult's, x forward from the ear, y up from the chin, z right
  const chin = b.stature - b.head
  const hh = b.head / 0.232, hl = b.headL / 0.197, hb = b.headB / 0.152
  const HX = -0.012 * hl
  const fy = (y: number) => (y <= 0 ? y : y >= 0.232 ? y : y * b.face + (1 - b.face) * (y * y) / 0.232)
  const hp = (x: number, y: number, z: number): V => [HX + x * hl, chin + fy(y) * hh, z * hb]
  const nk = b.neck / 0.057
  const neckBase = ty(1.0) - 0.012
  const jw = mixn(0.9, 1, hard) // a narrower jaw on a soft face
  const HL: Level[] = [
    { y: neckBase - 0.11, back: HX - 0.07 * nk, front: HX + 0.045 * nk, hw: 0.07 * nk },
    { y: neckBase, back: HX - 0.076 * nk, front: HX + 0.044 * nk, hw: 0.067 * nk },
    ...(classic ? [
    { y: mixn(neckBase, chin, 0.55), back: HX - 0.068 * nk, front: HX + 0.036 * nk, hw: 0.057 * nk },
    { y: chin - 0.016 * hh, back: hp(-0.078, 0, 0)[0], front: hp(0.036, 0, 0)[0], hw: 0.055 * hb * jw, nb: 2 },
    { y: hp(0, 0.004, 0)[1], back: hp(-0.084, 0, 0)[0], front: hp(0.07, 0, 0)[0], hw: 0.05 * hb * jw, nb: 1.6 },
    { y: hp(0, 0.022, 0)[1], back: hp(-0.09, 0, 0)[0], front: hp(0.084, 0, 0)[0], hw: 0.055 * hb * jw, nb: 1.62 },
    { y: hp(0, 0.048, 0)[1], back: hp(-0.096, 0, 0)[0], front: hp(0.088, 0, 0)[0], hw: 0.063 * hb * jw, nb: 1.75 },
    ] : [
    { y: mixn(neckBase, chin, 0.55), back: HX - 0.068 * nk, front: HX + 0.036 * nk, hw: 0.052 * nk },
    { y: chin - 0.016 * hh, back: hp(-0.078, 0, 0)[0], front: hp(0.036, 0, 0)[0], hw: 0.052 * hb * jw, nb: 2 },
    // the underside of the jaw: nearly level from the throat to the chin, so the jaw line casts its shadow on the neck
    { y: chin - 0.006 * hh, back: hp(-0.081, 0, 0)[0], front: hp(0.06, 0, 0)[0], hw: 0.057 * hb * jw, nb: 1.7 },
    { y: hp(0, 0.004, 0)[1], back: hp(-0.084, 0, 0)[0], front: hp(0.071, 0, 0)[0], hw: 0.059 * hb * jw, nb: 1.6 },
    { y: hp(0, 0.022, 0)[1], back: hp(-0.09, 0, 0)[0], front: hp(0.084, 0, 0)[0], hw: 0.062 * hb * jw, nb: 1.62 },
    { y: hp(0, 0.048, 0)[1], back: hp(-0.096, 0, 0)[0], front: hp(0.088, 0, 0)[0], hw: 0.065 * hb * jw, nb: 1.75 },
    ]),
    { y: hp(0, 0.075, 0)[1], back: hp(-0.101, 0, 0)[0], front: hp(0.088, 0, 0)[0], hw: 0.069 * hb, nb: 1.9 },
    { y: hp(0, 0.1, 0)[1], back: hp(-0.104, 0, 0)[0], front: hp(0.086, 0, 0)[0], hw: 0.0715 * hb, nb: 2.05 },
    { y: hp(0, 0.118, 0)[1], back: hp(-0.106, 0, 0)[0], front: hp(0.085, 0, 0)[0], hw: 0.072 * hb, nb: 2.1 },
    { y: hp(0, 0.14, 0)[1], back: hp(-0.106, 0, 0)[0], front: hp(0.089, 0, 0)[0], hw: 0.073 * hb, nb: 2.15 },
    { y: hp(0, 0.175, 0)[1], back: hp(-0.103, 0, 0)[0], front: hp(0.087, 0, 0)[0], hw: 0.076 * hb, nb: 2.15 },
    { y: hp(0, 0.2, 0)[1], back: hp(-0.094, 0, 0)[0], front: hp(0.077, 0, 0)[0], hw: 0.068 * hb },
    { y: hp(0, 0.215, 0)[1], back: hp(-0.078, 0, 0)[0], front: hp(0.06, 0, 0)[0], hw: 0.054 * hb },
    { y: hp(0, 0.225, 0)[1], back: hp(-0.056, 0, 0)[0], front: hp(0.04, 0, 0)[0], hw: 0.037 * hb },
    { y: hp(0, 0.2305, 0)[1], back: hp(-0.028, 0, 0)[0], front: hp(0.014, 0, 0)[0], hw: 0.016 * hb },
  ]
  const HD = column(HL, [HX - 0.014 * nk, hp(-0.008, 0, 0)[0]])
  const ha = (y: number) => HD.at(hp(0, y, 0)[1])
  const hlen = (HL[HL.length - 1].y - HL[0].y) || 1
  const hd = (metres: number) => (metres * hh) / hlen // a length on the head as a fraction of the part
  const headBulges: Bulge[] = [
    muscle(ha(0.139), 158, 0.0026 * hard + 0.0008, hd(0.013), 22, true), // the brow ridge
    muscle(ha(0.116), 153, -0.0075, hd(0.019), 16, true), // the eye sockets
    muscle(ha(0.097), 128, 0.003 * hard + 0.001, hd(0.022), 26, true), // cheekbones
    muscle(ha(0.06), 134, -0.0025 * hard + 0.0025 * b.soft, hd(0.03), 24, true), // the cheek below them (full on a child)
    muscle(ha(0.155), 100, -0.0025 * hard, hd(0.03), 22, true), // temples
    muscle(ha(0.02), 180, 0.003, hd(0.016), 24, false), // the chin
    muscle(ha(0.052), 180, 0.003, hd(0.03), 32, false), // the muzzle: teeth under the lips
    muscle(ha(0.03), 104, 0.003 * hard, hd(0.022), 20, true), // the angle of the jaw
  ]
  const headPath = HD.pts.slice(1).map((p): Vec3 => sub(p, HD.pts[0]))
  // ---- the arm: A-pose, the palm facing the body
  const SH: V = [-0.016, b.shoulder - 0.048, b.biacromial / 2 - 0.012]
  const ad = norm([0.1, -0.86, 0.5])
  const au = norm(sub([0, 0, 1], mul(ad, ad[2]))) // the back of the hand: outward
  const EL = add(SH, mul(norm([0.06, -0.86, 0.5]), b.upperArm))
  const WR = add(EL, mul(norm([0.15, -0.86, 0.49]), b.forearm))
  const hs = b.hand / 0.193
  const hdir = norm(sub(WR, EL))
  const hu = norm(sub(au, mul(hdir, dot(au, hdir))))
  const hside = cross(hdir, hu)
  /** a point of the reference hand (its own axes, wrist at x = 0.244) in model space */
  const H = (l: Vec3): V => add(WR, add(mul(hdir, (l[0] - 0.244) * hs), add(mul(hu, l[1] * hs), mul(hside, l[2] * hs))))
  const Hd = (l: Vec3): V => norm(add(mul(hdir, l[0]), add(mul(hu, l[1]), mul(hside, l[2]))))
  // the macro hand (hand.ts): its own frame, wrist at the origin, x to the fingers, y out of the back, z to the little finger
  const hmap: HandMap = { p: (l) => add(WR, add(mul(hdir, l[0] * hs), add(mul(hu, l[1] * hs), mul(hside, l[2] * hs)))), d: (l) => norm(add(mul(hdir, l[0]), add(mul(hu, l[1]), mul(hside, l[2])))), s: hs }
  const HE = classic ? H([0.365, -0.003, 0]) : hmap.p([PALM_END, -0.0015, 0])
  const am = (t: number) => (t <= 1.5 ? m : mixn(m, hs, sstep((t - 1.5) / 0.5)))
  const ag = (t: number, w: number, f: number, bk: number, n = 2): LimbSpec["girth"][number] => ({ t, w: w * am(t), f: f * am(t), b: bk * am(t), n, nb: n })
  const ARM = limb({
    joints: [SH, EL, WR, HE],
    girth: [
      ag(0, 0.054, 0.055, 0.052), ag(0.3, 0.052, 0.05, 0.047), ag(0.6, 0.046, 0.042, 0.043), ag(0.9, 0.04, 0.037, 0.038), ag(1, 0.04, 0.038, 0.037),
      ag(1.2, 0.045, 0.043, 0.044), ag(1.5, 0.04, 0.037, 0.038), ag(1.76, 0.033, 0.0265, 0.027, 2.2), ag(2, 0.0285, 0.0185, 0.0195, 2.4),
      ...(classic ? [ag(2.16, 0.0305, 0.018, 0.02, 2.3), ag(2.42, 0.04, 0.0145, 0.02, 2.4), ag(2.82, 0.0445, 0.0125, 0.016, 2.5), ag(3, 0.0425, 0.0105, 0.012, 2.5)]
        : PALM_GIRTH.filter((g) => g.u > 0).map((g) => ({ t: 2 + g.u, w: g.w * hs, f: g.f * hs, b: g.b * hs, n: g.n, nb: g.nb }))),
    ],
    bulges: [
      { t: 0.2, len: 0.3, around: 0, arc: 80, h: 0.012 * m * mus }, // deltoid
      ...(classic ? [] : [{ t: 0.16, len: 0.26, around: -62, arc: 42, h: 0.008 * m * mus }, { t: 0.16, len: 0.26, around: 62, arc: 42, h: 0.007 * m * mus }, { t: 0.42, len: 0.08, around: 10, arc: 40, h: -0.003 * m * mus }]), // its front and back heads, and the dip at its insertion
      { t: 0.55, len: 0.3, around: -90, arc: 55, h: 0.009 * m * mus }, // biceps
      { t: 0.5, len: 0.35, around: 100, arc: 50, h: 0.006 * m * mus }, // triceps
      { t: 1, len: 0.07, around: 95, arc: 30, h: 0.006 * m * hard }, // the point of the elbow
      { t: 1.22, len: 0.22, around: -60, arc: 50, h: 0.006 * m * mus }, // brachioradialis
      { t: 1.25, len: 0.22, around: 150, arc: 50, h: 0.004 * m * mus }, // the flexors' belly
      { t: 1.955, len: 0.05, around: 62, arc: 28, h: 0.0045 * hs * hard }, // the head of the ulna
      { t: 1.8, len: 0.16, around: 180, arc: 24, h: -0.0022 * hs }, // between the wrist's tendons
      ...(classic ? [
        { t: 2.3, len: 0.3, around: -128, arc: 56, h: 0.0135 * hs }, // thenar: the ball of the thumb
        { t: 2.36, len: 0.32, around: 128, arc: 46, h: 0.007 * hs }, // hypothenar
        { t: 2.85, len: 0.14, around: 180, arc: 70, h: 0.004 * hs }, // the pads under the knuckles
        { t: 2.6, len: 0.2, around: 180, arc: 26, h: -0.0035 * hs }, // the hollow of the palm
        { t: 2.97, len: 0.09, around: -41, arc: 13, h: 0.0042 * hs }, { t: 2.99, len: 0.09, around: -13, arc: 13, h: 0.0046 * hs }, { t: 2.97, len: 0.09, around: 13, arc: 13, h: 0.0042 * hs }, { t: 2.94, len: 0.09, around: 40, arc: 13, h: 0.0036 * hs }, // knuckles
      ] : PALM_BULGES.filter((g) => g.u > 0.04).map(({ u, ...g }) => ({ ...g, t: 2 + u, h: g.h * hs }))),
    ],
  })
  const dg = (name: string, joints: Vec3[], r0: number, r1: number, up: Vec3, row: number, fillet: number): PartSpec[] =>
    digit({ name, on: "arm", joints: joints.map(H), r0: r0 * hs, r1: r1 * hs, up: Hd(up), row, fillet: fillet * hs, mirror: true }).map((p) => (p.mat === MAT.horn ? p : { ...p, thin: 0.35, rings: (p.rings ?? 20) + 4, sides: 14 }))
  const thumbJ: Vec3[] = [[0.281, -0.01, -0.027], [0.318, -0.021, -0.058], [0.348, -0.031, -0.078], [0.374, -0.038, -0.092]]
  const digits: PartSpec[] = [
    ...dg("thumb", thumbJ, 0.0138, 0.0098, [-0.3, 0.62, -0.72], 0, 0.016),
    ...(["index", "middle", "ring", "little"] as const).flatMap((f, i) => dg(f, finger(KNUCKLE[f], PHAL[f], FAN[f]), FR[f][0], FR[f][1], [0, 1, 0], i + 1, 0.0085)),
  ]
  // the first web (thumb to index) and the three between the fingers: thin skin sunk into the palm's edge
  const webs: PartSpec[] = [
    { name: "web0", on: "arm", origin: H([0.3, -0.01, -0.033]), path: [sub(H([0.325, -0.012, -0.043]), H([0.3, -0.01, -0.033])), sub(H([0.346, -0.008, -0.036]), H([0.3, -0.01, -0.033]))], up: Hd([-0.2, 0.9, -0.4]), mirror: true, sect: [{ at: 0, w: 0.012 * hs, up: 0.007 * hs }, { at: 0.5, w: 0.011 * hs, up: 0.0045 * hs }, { at: 1, w: 0.008 * hs, up: 0.004 * hs }], rings: 6, sides: 8, cap: "round", fillet: 0.008 * hs, thin: 0.5, minDetail: 0.4 },
  ]
  // extensor tendons on the back of the hand: thin tubes lying in the skin from the wrist to each knuckle
  const palmUp = (x: number) => {
    const t = (x - 0.244) / 0.121
    return t < 0.16 ? mixn(0.0185, 0.018, t / 0.16) : t < 0.42 ? mixn(0.018, 0.0145, (t - 0.16) / 0.26) : t < 0.82 ? mixn(0.0145, 0.0125, (t - 0.42) / 0.4) : mixn(0.0125, 0.0105, (t - 0.82) / 0.18)
  }
  const palmW = (x: number) => {
    const t = (x - 0.244) / 0.121
    return t < 0.16 ? mixn(0.0285, 0.0305, t / 0.16) : t < 0.42 ? mixn(0.0305, 0.04, (t - 0.16) / 0.26) : t < 0.82 ? mixn(0.04, 0.0445, (t - 0.42) / 0.4) : mixn(0.0445, 0.0425, (t - 0.82) / 0.18)
  }
  const dorsum = (x: number, z: number): V => [x, palmUp(x) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / palmW(x), 2.4)), 1 / 2.4) - 0.0021, z]
  const tendons: PartSpec[] = (["index", "middle", "ring", "little"] as const).map((f, i) => {
    const k = KNUCKLE[f]
    const z0 = (i - 1.5) * 0.0065
    const a = H(dorsum(0.258, z0))
    return {
      name: "tendon" + i, on: "arm", origin: a, path: [sub(H(dorsum(0.305, mixn(z0, k[2], 0.5))), a), sub(H(dorsum(k[0] - 0.012, k[2])), a)], up: hu, mirror: true,
      sect: [{ at: 0, w: 0.002 * hs, up: 0.0022 * hs }, { at: 0.5, w: 0.0024 * hs, up: 0.0026 * hs }, { at: 1, w: 0.002 * hs, up: 0.0018 * hs }], rings: 8, sides: 6, cap: "point", cap0: "point", fillet: 0.004 * hs, flare: 0.9, minDetail: 0.9,
    }
  })
  // ---- the leg
  const HJ: V = [0, b.hip, b.hips[0] * 0.255]
  const KN: V = [0.022, b.knee, b.hips[0] * 0.275]
  const AN: V = [-0.012, b.ankle, b.hips[0] * 0.262]
  const fs = b.foot / 0.27
  const BL: V = [AN[0] + 0.137 * fs, 0.02 * fs, AN[2] + 0.012 * fs]
  const lm = (t: number) => (t <= 1.7 ? m : mixn(m, fs, sstep((t - 1.7) / 0.3)))
  const lg = (t: number, w: number, f: number, bk: number, n = 2, nb = n): LimbSpec["girth"][number] => ({ t, w: w * lm(t), f: f * lm(t), b: bk * lm(t), n, nb })
  const LEG = limb({
    joints: [HJ, KN, AN, BL],
    girth: [
      lg(0, 0.078, 0.082, 0.088), lg(0.3, 0.079, 0.083, 0.082), lg(0.7, 0.062, 0.066, 0.06), lg(1, 0.053, 0.056, 0.052), lg(1.15, 0.05, 0.046, 0.054), lg(1.35, 0.052, 0.042, 0.064),
      lg(1.7, 0.038, 0.036, 0.042), lg(1.93, 0.031, 0.034, 0.036), lg(2, 0.033, 0.04, 0.04), lg(2.4, 0.04, 0.03, 0.03, 2, 2.8), lg(2.75, 0.047, 0.02, 0.022, 2.2, 3), lg(3, 0.048, 0.013, 0.016, 2.3, 3),
    ],
    bulges: [
      { t: 0.45, len: 0.4, around: 8, arc: 60, h: 0.008 * m * mus }, // quadriceps
      { t: 0.86, len: 0.14, around: -50, arc: 34, h: 0.006 * m * mus }, // the teardrop above the knee, inside
      { t: 1, len: 0.085, around: 0, arc: 44, h: 0.009 * m * (0.5 + 0.5 * hard) }, // the kneecap
      { t: 1.3, len: 0.26, around: 168, arc: 68, h: 0.01 * m * mus }, // the calf
      { t: 1.4, len: 0.2, around: -140, arc: 40, h: 0.006 * m * mus }, // its inner head, lower
      { t: 1.5, len: 0.4, around: 0, arc: 18, h: 0.003 * m * hard }, // the shin
      { t: 1.975, len: 0.035, around: 95, arc: 30, h: 0.007 * fs }, // outer ankle bone
      { t: 1.95, len: 0.035, around: -95, arc: 30, h: 0.008 * fs }, // inner ankle bone, higher
      { t: 1.86, len: 0.1, around: 140, arc: 22, h: -0.004 * fs }, { t: 1.86, len: 0.1, around: -140, arc: 22, h: -0.004 * fs }, // either side of the Achilles tendon
    ],
  })
  const toeZ = [-0.03, -0.012, 0.004, 0.019, 0.032], toeL = [0.05, 0.043, 0.038, 0.033, 0.027], toeR = [0.013, 0.0092, 0.0088, 0.0084, 0.008], toeX = [0.004, 0.006, 0.002, -0.006, -0.016]
  const toes: PartSpec[] = toeZ.flatMap((z, i) => {
    const r: V = [BL[0] + toeX[i] * fs - 0.006 * fs, 0.016 * fs, BL[2] + z * fs]
    return digit({ name: "toe" + i, on: "leg", joints: [r, add(r, [toeL[i] * 0.58 * fs, -0.003 * fs, z * 0.08 * fs]), add(r, [toeL[i] * fs, -0.006 * fs, z * 0.14 * fs])], r0: toeR[i] * fs, r1: toeR[i] * 0.86 * fs, up: [0, 1, 0], row: i, role: "toe", mirror: true, fillet: 0.006 * fs, minDetail: 0.4, pad: 0.1 })
  })
  const heelO: V = [AN[0] + 0.012 * fs, AN[1] - 0.024 * fs, AN[2]]
  // ---- parts
  const eyeC = hp(0.0672, 0.117, 0.0322)
  const eR = 0.0122 * hh
  const lipW = 0.024
  const parts: PartSpec[] = [
    {
      name: "head", origin: HD.pts[0], path: headPath, up: [-1, 0, 0], sect: HD.sect, rings: 112, sides: 84, cap: "flat", fillet: classic ? 0.055 : 0.04, flare: classic ? 0.55 : 0.18, bones: 4, role: "head", bulges: headBulges,
    },
    // the nose: bridge, tip and wings, a wedge laid on the face
    {
      name: "nose", on: "head", origin: hp(0.075, 0.125, 0), path: [sub(hp(0.089, 0.104, 0), hp(0.075, 0.125, 0)), sub(hp(0.1, 0.0855, 0), hp(0.075, 0.125, 0))], up: [0.86, 0.5, 0],
      sect: [{ at: 0, w: 0.0075, up: 0.004, dn: 0.01 }, { at: 0.45, w: 0.009, up: 0.005, dn: 0.012 }, { at: 0.78, w: 0.0135, up: 0.007, dn: 0.014 }, { at: 1, w: 0.012, up: 0.0075, dn: 0.012 }].map((s) => ({ ...s, w: s.w * hb, up: s.up * hl, dn: (s.dn ?? s.up) * hl })),
      rings: 20, sides: 18, cap: "round", fillet: 0.008, flare: 0.5, minDetail: 0.2,
      bulges: [muscle(0.9, 92, 0.0035 * hb, 0.13, 34, true), muscle(0.72, 60, -0.0012, 0.12, 22, true), ...(classic ? [] : [muscle(0.9, 152, -0.0026 * hb, 0.09, 20, true) /* the nostrils */, muscle(0.95, 118, -0.0008, 0.06, 14, true) /* the crease round each wing */])],
    },
    // lips: two soft rolls from corner to corner
    {
      name: "lipU", on: "head", origin: hp(0.08, 0.0505, -lipW), path: [sub(hp(0.0885, 0.0535, 0), hp(0.08, 0.0505, -lipW)), sub(hp(0.08, 0.0505, lipW), hp(0.08, 0.0505, -lipW))], up: [1, 0.25, 0],
      sect: [{ at: 0, w: 0.0008, up: 0.0025 }, { at: 0.22, w: 0.0027, up: 0.0042 }, { at: 0.5, w: 0.0033, up: 0.0046 }, { at: 0.78, w: 0.0027, up: 0.0042 }, { at: 1, w: 0.0008, up: 0.0025 }], rings: 14, sides: 8, cap: "point", cap0: "point", fillet: 0.003, flare: 0.3, mat: MAT.lip, minDetail: 0.4,
    },
    {
      name: "lipD", on: "head", origin: hp(0.0795, 0.049, -lipW * 0.96), path: [sub(hp(0.087, 0.0425, 0), hp(0.0795, 0.049, -lipW * 0.96)), sub(hp(0.0795, 0.049, lipW * 0.96), hp(0.0795, 0.049, -lipW * 0.96))], up: [1, -0.35, 0],
      sect: [{ at: 0, w: 0.0008, up: 0.0025 }, { at: 0.22, w: 0.003, up: 0.0044 }, { at: 0.5, w: 0.004, up: 0.005 }, { at: 0.78, w: 0.003, up: 0.0044 }, { at: 1, w: 0.0008, up: 0.0025 }], rings: 14, sides: 8, cap: "point", cap0: "point", fillet: 0.003, flare: 0.3, mat: MAT.lip, minDetail: 0.4,
    },
    // eyes: the ball carries its own lids (shade.ts, `eyeForward`)
    {
      name: "eye", on: "head", origin: [eyeC[0] - eR * 1.05, eyeC[1], eyeC[2]], mirror: true, path: [[eR * 0.55, 0, 0], [eR * 1.05, 0, 0]], up: [0, 1, 0],
      sect: [{ at: 0, w: eR * 0.55, up: eR * 0.55 }, { at: 0.5, w: eR * 0.93, up: eR * 0.93 }, { at: 1, w: eR, up: eR }], rings: 7, sides: 18, cap: "round", fillet: 0, mat: MAT.eye, minDetail: 0.2,
    },
    // eyelids: a roll of skin along the edge of each lid, lying on the ball where the shading opens it
    ...(classic ? [] : ([[1, 0.0014, 0.0011], [-1, 0.0009, 0.0007]] as const).map(([side, r, rt]): PartSpec => {
      const R = eR * 1.05
      const pt = (a: number): V => {
        const e = side > 0 ? 0.25 * (1 - (a / 1.05) ** 2) + 0.03 : -0.26 * (1 - (a / 1.05) ** 2) - 0.02
        return add(eyeC, [R * Math.cos(e) * Math.cos(a), R * Math.sin(e), R * Math.cos(e) * Math.sin(a)])
      }
      const A = [-0.95, -0.5, 0, 0.5, 1.0].map(pt)
      return {
        name: side > 0 ? "lidU" : "lidD", on: "head", origin: A[0], mirror: true, path: A.slice(1).map((p) => sub(p, A[0])), up: [1, side * 0.4, 0],
        sect: [{ at: 0, w: r * 0.4, up: rt * 0.4 }, { at: 0.2, w: r, up: rt }, { at: 0.5, w: r * 1.1, up: rt * 1.1 }, { at: 0.8, w: r, up: rt }, { at: 1, w: r * 0.4, up: rt * 0.4 }],
        rings: 16, sides: 8, cap: "point", cap0: "point", fillet: 0.0015, flare: 0.4, minDetail: 0.9,
      }
    })),
    // brows: a low ridge of hair
    {
      name: "brow", on: "head", origin: hp(0.0865, 0.1365, 0.012), mirror: true, path: [sub(hp(0.0855, 0.142, 0.03), hp(0.0865, 0.1365, 0.012)), sub(hp(0.0735, 0.138, 0.05), hp(0.0865, 0.1365, 0.012))], up: [1, 0.2, 0.3],
      sect: [{ at: 0, w: 0.002, up: 0.0018 }, { at: 0.4, w: 0.0028, up: 0.002 }, { at: 1, w: 0.001, up: 0.0012 }], rings: 8, sides: 6, cap: "point", cap0: "point", fillet: 0.003, flare: 0.5, mat: MAT.hair, minDetail: 0.4,
    },
    // ears: a thin cupped plate, the lobe at the bottom
    {
      name: "ear", on: "head", origin: hp(-0.004, 0.083, 0.0695), mirror: true, path: [sub(hp(-0.012, 0.113, 0.0735), hp(-0.004, 0.083, 0.0695)), sub(hp(-0.016, 0.143, 0.073), hp(-0.004, 0.083, 0.0695))], up: [-0.3, 0, 0.95],
      sect: [{ at: 0, w: 0.008, up: 0.0036 }, { at: 0.3, w: 0.014, up: 0.0026, bow: -0.2 }, { at: 0.7, w: 0.0175, up: 0.0024, bow: -0.3 }, { at: 1, w: 0.011, up: 0.002, bow: -0.2 }].map((s) => ({ ...s, w: s.w * hh * 0.9 })), rings: 12, sides: 12, cap: "round", fillet: 0.005, flare: 0.3, thin: 0.45, minDetail: 0.2,
      bulges: [muscle(0.55, 0, -0.002, 0.3, 50, false)],
    },
    // sternomastoid: the cord from behind the ear to the pit of the throat
    {
      name: "scm", on: "head", origin: hp(-0.03, 0.062, 0.058 * jw), mirror: true, path: [sub([HX + 0.002, mixn(neckBase, chin, 0.5), 0.046 * nk], hp(-0.03, 0.062, 0.058 * jw)), sub([HX + 0.036 * nk, neckBase + 0.004, 0.02 * nk], hp(-0.03, 0.062, 0.058 * jw))], up: [0.6, 0, 0.8],
      sect: [{ at: 0, w: 0.009, up: 0.006 }, { at: 0.5, w: 0.01, up: 0.0065 }, { at: 1, w: 0.006, up: 0.005 }].map((s) => ({ ...s, w: s.w * nk * (0.5 + 0.5 * hard), up: s.up * nk * (0.4 + 0.6 * hard) })), rings: 12, sides: 8, cap: "point", cap0: "point", fillet: 0.012, flare: 0.9, minDetail: 2,
    },
    // collar bones
    {
      name: "clavicle", origin: [0.079 * dC, ty(0.925), 0.02], mirror: true, path: [[-0.01 * dC, 0.008, b.biacromial * 0.18], [-0.05 * dC, 0.016, b.biacromial * 0.34]], up: [0.7, 0.7, 0],
      sect: [{ at: 0, w: 0.009, up: 0.008 }, { at: 0.5, w: 0.007, up: 0.0065 }, { at: 1, w: 0.008, up: 0.007 }].map((s) => ({ ...s, w: s.w * (0.3 + 0.4 * hard), up: s.up * (0.3 + 0.4 * hard) })), rings: 10, sides: 8, cap: "point", cap0: "point", fillet: 0.014, flare: 0.9, minDetail: 2,
    },
    { name: "arm", ...ARM, mirror: true, up: au, rings: classic ? 96 : 130, sides: classic ? 26 : 30, cap: "round", cap0: "round", fillet: (classic ? 0.07 : 0.09) * m, flare: classic ? 0.2 : 0.4, role: "arm" },
    ...(classic ? [...digits, ...webs, ...tendons] : handParts({ on: "arm", map: hmap, mirror: true, minDetail: 0.4 })),
    { name: "leg", ...LEG, mirror: true, up: [1, 0, 0], rings: 84, sides: 24, cap: "round", cap0: "round", fillet: 0.06 * m, flare: 0.08, role: "limb" },
    {
      name: "heel", on: "leg", origin: heelO, mirror: true, path: [[-0.03 * fs, -0.016 * fs, 0], [-0.05 * fs, -0.022 * fs, 0]], up: [0, 1, 0],
      sect: [{ at: 0, w: 0.03 * fs, up: 0.03 * fs }, { at: 0.6, w: 0.031 * fs, up: 0.03 * fs, nb: 3 }, { at: 1, w: 0.026 * fs, up: 0.026 * fs, nb: 3 }], rings: 6, sides: 12, cap: "round", fillet: 0.02 * fs, flare: 0.3,
    },
    ...toes,
  ]
  // ---- hair: a cap of short strands (the hero level only; below it the scalp's paint stands in)
  const cards: CardSpec[] = [
    { on: "head", from: ha(0.062), to: ha(0.152), arc: [0, 64], count: 420, len: 0.026 * hh, w: 0.0065, lift: 0.1, jitter: 0.45, seed: 5 },
    { on: "head", from: ha(0.15), to: ha(0.192), arc: [0, 118], count: 440, len: 0.026 * hh, w: 0.0065, lift: 0.1, jitter: 0.45, seed: 7 },
    { on: "head", from: ha(0.19), to: ha(0.229), arc: [0, 180], count: 700, len: 0.027 * hh, w: 0.0065, lift: 0.12, jitter: 0.5, seed: 9 },
  ]
  const base: CreatureSpec = {
    name: "human-" + b.name,
    body: {
      spine: T.pts, sect: T.sect, rings: 104, sides: 44, caps: ["round", "round"],
      bones: [0, ta(0.2), ta(0.38), ta(0.56), ta(0.74), ta(0.9), 1],
      breath: [ta(0.5), ta(0.98), 0.012], bulges: bodyBulges,
    },
    parts, cards,
  }
  // ---- anchors and poses
  const palm = classic ? H([0.325, -0.02, -0.004]) : hmap.p([0.06, -0.019, 0])
  const stone = classic ? H([0.34, -0.056, -0.004]) : hmap.p(HELD.stone.c)
  const stoneR = 0.04 * hs
  const shaft: [V, V] = classic ? [H([0.333, -0.034, -0.075]), H([0.322, -0.034, 0.07])] : [hmap.p(HELD.shaft.b), hmap.p(HELD.shaft.a)]
  const fingersPose = (p: Record<string, [number, number?, number?][]>, side: "R" | "L"): Pose => Object.fromEntries(Object.entries(p).map(([k, v]) => [k + side, v]))
  const hand: Record<string, Record<string, [number, number?, number?][]>> = {
    // a hand at ease: each finger a little more curled than the last
    curl: { thumb: [[0.12, 0.1], [0.2], [0.3]], index: [[0.3], [0.42], [0.25]], middle: [[0.4], [0.5], [0.3]], ring: [[0.48], [0.55], [0.32]], little: [[0.55], [0.58], [0.34]] },
    fist: { thumb: [[0.5, 0.35], [0.7], [0.9]], index: [[1.45], [1.7], [1.1]], middle: [[1.5], [1.75], [1.15]], ring: [[1.5], [1.75], [1.15]], little: [[1.5], [1.7], [1.1]] },
    // flat and spread: on a wall, on the ground
    splay: { thumb: [[-0.25, -0.5], [-0.05], [-0.1]], index: [[-0.1, 0.2], [-0.1], [-0.11]], middle: [[-0.1, 0.02], [-0.1], [-0.11]], ring: [[-0.1, -0.16], [-0.1], [-0.11]], little: [[-0.1, -0.36], [-0.1], [-0.11]] },
    flat: { thumb: [[-0.1, -0.1], [0], [-0.05]], index: [[-0.1], [-0.11], [-0.11]], middle: [[-0.1], [-0.11], [-0.11]], ring: [[-0.1], [-0.11], [-0.11]], little: [[-0.1], [-0.11], [-0.11]] },
    // a shallow cup: a slab or a bowl lying on the palm
    cup: { thumb: [[0.05, -0.3], [0.15], [0.2]], index: [[0.12, 0.08], [0.2], [0.15]], middle: [[0.14], [0.22], [0.15]], ring: [[0.16, -0.06], [0.24], [0.15]], little: [[0.2, -0.14], [0.26], [0.16]] },
    // a reed or a stylus between the thumb and two fingers
    pinch: { thumb: [[0.3, 0.5], [0.35], [0.4]], index: [[0.85], [0.75], [0.35]], middle: [[1.0], [0.9], [0.45]], ring: [[1.3], [1.3], [0.7]], little: [[1.35], [1.35], [0.7]] },
    point: { thumb: [[0.4, 0.3], [0.6], [0.7]], index: [[-0.05], [-0.08], [-0.08]], middle: [[1.4], [1.6], [1.0]], ring: [[1.45], [1.65], [1.0]], little: [[1.45], [1.6], [1.0]] },
    stone: !classic ? {} : solveGrip(base, { kind: "sphere", c: stone, r: stoneR }, { maxOf: { thumb: [0.55, 0.9, 1.3] }, slack: 0.5 }) as Record<string, [number, number?, number?][]>,
    shaft: !classic ? {} : solveGrip(base, { kind: "capsule", a: shaft[0], b: shaft[1], r: 0.0155 * hs }, { maxOf: { thumb: [0.7, 1.0, 1.2] }, slack: 0.8 }) as Record<string, [number, number?, number?][]>,
  }
  if (!classic) {
    const hp = handPoses(base, hmap)
    for (const k of ["curl", "fist", "splay", "flat", "cup", "pinch", "stone", "shaft", "core"] as const) hand[k] = hp[k]
  }
  const poses: Record<string, Pose> = {
    // the spine: channel = radians in all, shared between the frames above the pelvis
    lean: { body: [[0], [0], [0.3], [0.3], [0.25], [0.15]] },
    bend: { body: [[0], [0], [0, 0.3], [0, 0.3], [0, 0.25], [0, 0.15]] },
    twist: { body: [[0], [0], [0, 0, 0.2], [0, 0, 0.3], [0, 0, 0.3], [0, 0, 0.2]] },
    /** the whole figure about the pelvis: pitch, roll and yaw of frame 0 */
    tilt: { body: [[1]] },
    roll: { body: [[0, 1]] },
    yaw: { body: [[0, 0, 1]] },
    /** breathing in: the chest lifts and the shoulders with it */
    breathe: { body: [[0], [0], [0], [-0.012], [-0.016]], arm: [[0, 0, 0]] },
    // the head: radians, shared between the neck and the skull
    nod: { head: [[0], [0.4], [0.6]] },
    turn: { head: [[0], [0, 0, -0.45], [0, 0, -0.55]] },
    cock: { head: [[0], [0, -0.4], [0, -0.6]] },
    toeUp: { toe0: [[-0.5], [-0.1]], toe1: [[-0.5], [-0.1]], toe2: [[-0.5], [-0.1]], toe3: [[-0.5], [-0.1]], toe4: [[-0.5], [-0.1]] },
  }
  for (const [name, p] of Object.entries(hand)) {
    poses[name + "R"] = fingersPose(p, "R")
    poses[name + "L"] = fingersPose(p, "L")
  }
  const spec: CreatureSpec = { ...base, poses, ...(opts.linear ? {} : { skinning: "dq" as const }), ...(classic ? {} : { occlusion: handOcclusion(hmap, "arm#.2", true) }) }
  return {
    body: b, spec,
    anchors: {
      stone, shaft, palm, palmN: mul(hu, -1), fingers: hdir,
      pinch: classic ? H([0.357, -0.047, -0.04]) : hmap.p([0.1024, -0.0538, -0.0327]),
      pinchDir: classic ? Hd([0.55, -0.75, -0.3]) : hmap.d(sub(HELD.stylus.a, HELD.stylus.b)),
      eyes: [eyeC[0], eyeC[1], 0], shoulder: SH, hipJ: HJ, wrist: WR, ankleJ: AN,
    },
    len: { thigh: Math.hypot(...sub(KN, HJ)), shin: Math.hypot(...sub(AN, KN)), upper: b.upperArm, fore: b.forearm, hand: b.hand },
    hand: frameOf(WR, hdir, hu, hside, hs, true),
  }
}

/**
 * Levels of detail for `makeHerd({ lods })`. The herd measures an animal by its rest sphere inflated
 * by everything its poses could do at once, which for a figure is about 2.6 times its real half
 * height; so these are: the hero mesh while the figure fills six tenths of the frame's height or
 * more (a close-up, a macro of the hands), the reduced mesh (no hair strands, tendons or nails'
 * detail; a fifth of the triangles) down to about an eighth of the frame, and the far stand-in below that.
 */
export const HUMAN_LODS: LodSpec[] = [{ detail: 1, cover: 1.6 }, { detail: 0.5, cover: 0.32 }, { detail: 0.15, cover: 0 }]

// ---------------------------------------------------------------- the look

export type SkinOpts = {
  /** Skin colour (linear-ish hex, as every Look colour). Default a mid brown. */
  skin?: number
  hair?: number
  /** "wrap": hide round the hips; "wrap2": that and a band round the chest; "none". */
  garment?: "wrap" | "wrap2" | "none"
  hide?: number
  /** Dried clay or ochre on the hands and forearms: its colour and 0..1. */
  clay?: number
  clayAmt?: number
  /** Dust up the shins and on the feet, 0..1. */
  dust?: number
  /** Forearm and back-of-hand hair, 0..1 (default 0.5). */
  armHair?: number
  /** false: leave out the macro hand's creases, nails and subsurface (the first pass's skin). */
  handDetail?: boolean
}

/** A `Look` for `skinMaterial`: skin with pores and joint creases, a forward eye, hair, lips and a hide wrap, for the body type `h` was built from. */
export function humanLook(h: Human, o: SkinOpts = {}): Look {
  const b = h.body
  const skin = o.skin ?? 0x8a5f48
  const k = (c: number, f: number) => {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * f)), g = Math.min(255, Math.round(((c >> 8) & 255) * f)), bl = Math.min(255, Math.round((c & 255) * f))
    return (r << 16) | (g << 8) | bl
  }
  const hair = o.hair ?? 0x120d0a
  const hideC = o.hide ?? 0x5a4028
  const chin = b.stature - b.head
  const hh = b.head / 0.232, hl = b.headL / 0.197, hb = b.headB / 0.152
  const paints: Paint[] = [
    // the scalp under the hair (all that is left of it on the reduced levels)
    { at: [-0.034 * hl, chin + 0.212 * hh, 0], r: [0.115 * hl, 0.082 * hh, 0.09 * hb], color: hair, edge: 0.14, rag: 0.12, ragSize: 0.008, matte: 0.9, vary: 0.3 },
    { at: [-0.082 * hl, chin + 0.125 * hh, 0], r: [0.06 * hl, 0.075 * hh, 0.068 * hb], color: hair, edge: 0.16, rag: 0.12, ragSize: 0.008, matte: 0.9, vary: 0.3 },
  ]
  paints.push({ at: [(-0.012 + 0.0965) * hl, chin + 0.0735 * hh * b.face, 0.0075 * hb], r: [0.006, 0.0035, 0.0045], color: k(skin, 0.25), mirror: true, edge: 0.5 })
  paints.push({ at: [-0.024 * hl, chin + 0.112 * hh, 0.079 * hb], r: [0.008, 0.012, 0.012], color: k(skin, 0.5), mirror: true, edge: 0.7 })
  const garment = o.garment ?? "wrap"
  const span = b.shoulder - b.crotch
  if (garment !== "none") paints.push({ at: [0, b.crotch + span * 0.07, 0], r: [0.4, span * 0.27, b.hips[0] * 0.68], color: hideC, box: true, edge: 0.06, rag: 0.22, ragSize: 0.045, matte: 1, vary: 0.45 })
  if (garment === "wrap2") paints.push({ at: [0, b.crotch + span * 0.78, 0], r: [0.4, span * 0.105, b.chest[0] * 0.57], color: hideC, box: true, edge: 0.08, rag: 0.08, ragSize: 0.05, matte: 1, vary: 0.45 })
  if (o.clay !== undefined || o.clayAmt) {
    const w = h.anchors.palm
    paints.push({ at: [w[0], w[1], w[2]], r: [0.2, 0.26, 0.2], color: o.clay ?? 0x8a7a66, amt: o.clayAmt ?? 0.7, mirror: true, edge: 0.6, rag: 0.9, ragSize: 0.022, matte: 0.8, vary: 0.35 })
  }
  return {
    base: skin, belly: k(skin, 1.22), back: k(skin, 0.94), horn: k(skin, 1.12), hornTip: k(skin, 1.45), eye: 0x24150c, sclera: 0x9a9088, eyeForward: true,
    lip: (k(skin, 0.8) & 0xff0000) | (k(skin, 0.6) & 0x00ff00) | (k(skin, 0.62) & 0x0000ff), hair, hide: hideC, prop: 0x55524c, paints,
    cell: 0.00065, relief: 0.00003, cellVary: 0.035, mottle: 0.1, blotch: 0.08, blotchSize: 0.07, accent: k(skin, 0.8),
    fold: 0.22, foldSize: 0.004, foldFlex: 3.2, foldBase: 0.05, occlude: 0.55, rough: 0.74, spec: 0.11, wrap: 0.5, rim: 0.3, bleed: 0x9a2c16, glow: 1.6,
    ...(o.dust ? { dust: 0x6a5a48, dustTo: b.knee * 0.8, dustAmt: o.dust } : {}),
    // the macro hand's surface (hand.ts) and skin that scatters light
    ...(o.handDetail === false ? {} : {
      hand: { ...h.hand, palm: k(skin, 1.3), clay: o.clay !== undefined || o.clayAmt ? (o.clayAmt ?? 0.7) * 0.8 : 0, clayCol: o.clay ?? 0x8a7a66, dust: (o.dust ?? 0) * 0.5, hair: o.armHair ?? 0.5, veins: 0.5 },
      nails: true, horn: 0xa87264, hornTip: 0xb89a84, sss: 0.5,
    }),
  }
}

// ---------------------------------------------------------------- poses: pure functions of time that fill a Drive

const CH = [
  "lean", "bend", "twist", "tilt", "roll", "yaw", "breathe", "nod", "turn", "cock", "toeUp",
  ...["curl", "fist", "splay", "flat", "cup", "pinch", "point", "stone", "shaft", "core"].flatMap((n) => [n + "R", n + "L"]),
] as const
const LIMBS = ["armR", "armL", "legR", "legL"] as const
const _ps = new Float32Array(6)
const _a: V = [0, 0, 0], _b: V = [0, 0, 0], _c: V = [0, 0, 0]

/** The figure's place this frame: origin on the ground, heading, right. Filled by `place`. */
export type Frame = { o: V; f: V; r: V; s: number }
const FR0: Frame = { o: [0, 0, 0], f: [1, 0, 0], r: [0, 0, 1], s: 1 }

/**
 * Start a pose (every pose function calls it). THE RULE FOR `fill`: set `d.dist`, `d.lane` and
 * `d.rise` afresh on every call before the pose function, because this adds the pelvis's shift to
 * them and the herd reuses one Drive (it calls `fill` twice per figure).
 * Clears every channel and reach this module owns (a herd shares one Drive between
 * its figures) and returns the figure's frame. `drop` lowers the pelvis (model units: sitting,
 * crouching) and `shift` moves it [forward, right] without moving the frame, so feet given in
 * the frame stay planted.
 */
export function place(d: Drive, drop = 0, shiftX = 0, shiftZ = 0, out: Frame = FR0): Frame {
  if (!d.reach) d.reach = {}
  for (let i = 0; i < LIMBS.length; i++) {
    let T = d.reach[LIMBS[i]]
    if (!T) T = d.reach[LIMBS[i]] = new Array<number>(13).fill(0)
    for (let k = 0; k < 13; k++) T[k] = 0
  }
  if (!d.eye) d.eye = [0, 0]
  d.eye[0] = 0
  d.eye[1] = 0
  for (let i = 0; i < CH.length; i++) d.ch[CH[i]] = 0
  d.path.at(d.dist, _ps)
  const hl = Math.hypot(_ps[3], _ps[5]) || 1
  const fx = _ps[3] / hl, fz = _ps[5] / hl
  out.f[0] = fx
  out.f[2] = fz
  out.r[0] = -fz
  out.r[2] = fx
  out.o[0] = _ps[0] - fz * d.lane
  out.o[1] = _ps[1]
  out.o[2] = _ps[2] + fx * d.lane
  out.s = d.scale
  d.rise = -drop * d.scale
  d.dist += shiftX * d.scale
  d.lane += shiftZ * d.scale
  return out
}
/** A point given in the figure's frame (x forward, y up from the ground, z right; model units) as a world point. */
export function toWorld(F: Frame, x: number, y: number, z: number, out: number[] | V, at = 0) {
  out[at] = F.o[0] + (F.f[0] * x + F.r[0] * z) * F.s
  out[at + 1] = F.o[1] + y * F.s
  out[at + 2] = F.o[2] + (F.f[2] * x + F.r[2] * z) * F.s
}
const dirW = (F: Frame, x: number, y: number, z: number, out: number[] | V, at = 0) => {
  out[at] = F.f[0] * x + F.r[0] * z
  out[at + 1] = y
  out[at + 2] = F.f[2] * x + F.r[2] * z
}
/**
 * Put a limb's end somewhere: `limb` "armR" | "armL" | "legR" | "legL"; the wrist or ankle goes to
 * (x, y, z) in the figure's frame; (ex, ey, ez) is the way the elbow or knee points.
 */
export function limbTo(d: Drive, F: Frame, name: (typeof LIMBS)[number], x: number, y: number, z: number, ex: number, ey: number, ez: number, weight = 1) {
  const T = d.reach![name]!
  toWorld(F, x, y, z, T, 0)
  T[3] = weight
  dirW(F, ex, ey, ez, T, 4)
}
/**
 * Aim the hand or foot at the end of that limb: `(fx, fy, fz)` is the way the fingers or toes
 * point, `(nx, ny, nz)` the way the palm or the sole faces, both in the figure's frame.
 */
export function aim(d: Drive, F: Frame, name: (typeof LIMBS)[number], fx: number, fy: number, fz: number, nx: number, ny: number, nz: number) {
  const T = d.reach![name]!
  dirW(F, fx, fy, fz, _a)
  dirW(F, nx, ny, nz, _b)
  // side = palm normal x fingers (the part's own side axis is its direction x its back)
  T[7] = _a[0]
  T[8] = _a[1]
  T[9] = _a[2]
  T[10] = _b[1] * _a[2] - _b[2] * _a[1]
  T[11] = _b[2] * _a[0] - _b[0] * _a[2]
  T[12] = _b[0] * _a[1] - _b[1] * _a[0]
}
/** The same with world directions (a wall's normal, a tool's axis). */
export function aimWorld(d: Drive, name: (typeof LIMBS)[number], f: Vec3, n: Vec3) {
  const T = d.reach![name]!
  T[7] = f[0]
  T[8] = f[1]
  T[9] = f[2]
  T[10] = n[1] * f[2] - n[2] * f[1]
  T[11] = n[2] * f[0] - n[0] * f[2]
  T[12] = n[0] * f[1] - n[1] * f[0]
}
/** A world point as the figure's frame sees it (for reaching to a prop the scene placed). */
export function toFrame(F: Frame, w: Vec3 | number[], out: V): V {
  const x = (w[0] - F.o[0]) / F.s, z = (w[2] - F.o[2]) / F.s
  out[0] = x * F.f[0] + z * F.f[2]
  out[1] = (w[1] - F.o[1]) / F.s
  out[2] = x * F.r[0] + z * F.r[2]
  return out
}

/** A point of the rest pose (an anchor) carried by a bone of the last pose: where a held prop is. `q` out is that bone's rotation. */
export function ride(rig: Rig, bone: number, head: Float32Array, rest: Vec3, scale: number, out: number[] | Float32Array) {
  const q = rig.q, p = rig.p, o = bone * 4
  const x = (rest[0] - head[bone * 3]) * scale, y = (rest[1] - head[bone * 3 + 1]) * scale, z = (rest[2] - head[bone * 3 + 2]) * scale
  const qx = q[o], qy = q[o + 1], qz = q[o + 2], qw = q[o + 3]
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x)
  out[0] = p[bone * 3] + x + qw * tx + qy * tz - qz * ty
  out[1] = p[bone * 3 + 1] + y + qw * ty + qz * tx - qx * tz
  out[2] = p[bone * 3 + 2] + z + qw * tz + qx * ty - qy * tx
}

const TAU = Math.PI * 2
const fr = (x: number) => x - Math.floor(x)
const ease = (x: number) => sstep(x)
/** Unequal sines: a slow wander that never repeats on screen, in -1..1. */
const wander = (t: number, seed: number) => 0.6 * Math.sin(t * 0.37 + seed * 12.9) + 0.4 * Math.sin(t * 0.83 + seed * 7.3 + 1.7)

const _l: V = [0, 0, 0], _A: V = [0, 0, 0]
const _own: { look: Vec3 | number[] | null; lookAt: number } = { look: null, lookAt: -10 }
/** the pose's own look target (its work), when the scene gave none: a reused object, nothing allocated */
const own = (p: Vec3 | number[], at: number | undefined) => {
  _own.look = p
  _own.lookAt = at ?? -10
  return _own
}

const NONE = {}

/** Options every pose takes. */
export type PoseOpts = {
  /** Where the figure looks (world), and when it began to (seconds on the same clock as `t`): the eyes lead the head by a fifth of a second. */
  look?: Vec3 | number[] | null
  lookAt?: number
  /** 0..1 liveliness of the idle layer (breathing, weight shifts, fingers). Default 1. */
  life?: number
}

/**
 * The involuntary layer, added by every pose: breathing (the chest swells by itself; this lifts
 * the shoulders with it), and fingers that settle. Blinking is the rig's own.
 */
function idle(d: Drive, t: number, k: number) {
  const br = Math.sin(t * (1.1 + 0.5 * fr(d.seed * 3.7)) + d.seed * 40) // the rig's own breath phase
  d.ch.breathe = (0.5 + 0.5 * br) * k
  const settle = 0.06 * Math.exp(-fr(t / 5.3 + d.seed) * 5.3 * 1.4) + 0.03 * wander(t * 1.7, d.seed + 3)
  d.ch.curlR += settle * k
  d.ch.curlL += (0.05 * Math.exp(-fr(t / 6.1 + d.seed * 1.7) * 6.1 * 1.4) + 0.03 * wander(t * 1.5, d.seed + 5)) * k
}

/**
 * Turn the head (and lead with the eyes) toward a world point. `yaw0`/`pitch0` are what the pose
 * has already put on the trunk (radians), so the neck only takes the rest.
 */
function lookTo(h: Human, d: Drive, F: Frame, t: number, o: PoseOpts | undefined, drop: number, lean: number) {
  if (!o?.look) return
  toFrame(F, o.look, _c)
  const e = h.anchors.eyes
  // the eyes' height under the pose: the trunk's lean brings the head forward and down
  const ey = e[1] - drop - (e[1] - h.body.crotch) * (1 - Math.cos(lean)), ex = e[0] + (e[1] - h.body.crotch) * Math.sin(lean)
  const dx = _c[0] - ex, dy = _c[1] - ey, dz = _c[2]
  const yaw = Math.max(-1.25, Math.min(1.25, Math.atan2(dz, Math.max(0.05, dx))))
  const pit = Math.max(-0.7, Math.min(0.9, Math.atan2(-dy, Math.hypot(dx, dz)) - lean))
  const since = t - (o.lookAt ?? -10)
  const head = ease((since - 0.12) / 0.55), eyes = ease(since / 0.16)
  d.ch.turn += yaw * 0.8 * head
  d.ch.nod += pit * 0.8 * head
  d.eye![0] = Math.max(-1, Math.min(1, (yaw * eyes - yaw * 0.8 * head) / 0.6))
  d.eye![1] = Math.max(-1, Math.min(1, -(pit * eyes - pit * 0.8 * head) / 0.5))
}

/** Feet flat on the ground where the rest pose has them (plus an offset forward and a wider or narrower stance). */
function plant(h: Human, d: Drive, F: Frame, fwdR = 0, fwdL = 0, wide = 0, toeOut = 0.12) {
  const a = h.anchors.ankleJ
  limbTo(d, F, "legR", a[0] + fwdR, a[1], a[2] + wide, 1, 0.1, 0.25 + toeOut)
  limbTo(d, F, "legL", a[0] + fwdL, a[1], -a[2] - wide, 1, 0.1, -0.25 - toeOut)
  aim(d, F, "legR", Math.cos(toeOut), -0.33, Math.sin(toeOut), 0, -1, 0)
  aim(d, F, "legL", Math.cos(toeOut), -0.33, -Math.sin(toeOut), 0, -1, 0)
}
/** An arm hanging at ease: the wrist beside the thigh, the palm to the body. */
function hang(h: Human, d: Drive, F: Frame, side: 1 | -1, drop: number, sway: number) {
  const s = h.anchors.shoulder
  const L = (h.len.upper + h.len.fore) * 0.985
  const name = side > 0 ? "armR" : "armL"
  limbTo(d, F, name, s[0] + 0.05 + sway, s[1] - drop - L * 0.985, side * (s[2] + 0.045), -1, -0.1, side * 0.3)
  aim(d, F, name, 0.12, -1, 0, 0, 0, -side)
  d.ch[side > 0 ? "curlR" : "curlL"] += 1
}

/** Standing at ease: weight moving slowly from one foot to the other, arms hanging, breathing. */
export function stand(h: Human, d: Drive, t: number, o?: PoseOpts): Frame {
  const F = stand0(h, d, t, o?.life ?? 1)
  lookTo(h, d, F, t, o, 0.012, 0)
  return F
}
function stand0(h: Human, d: Drive, t: number, k: number): Frame {
  const w = wander(t * 0.6, d.seed) * k
  const F = place(d, 0.012 + 0.004 * Math.abs(w), 0, 0.022 * w)
  plant(h, d, F)
  d.ch.roll = 0.03 * w
  d.ch.bend = -0.05 * w
  hang(h, d, F, 1, 0.012, 0.01 * wander(t * 0.5, d.seed + 1) * k)
  hang(h, d, F, -1, 0.012, 0.01 * wander(t * 0.5, d.seed + 2) * k)
  idle(d, t, k)
  return F
}

const SK = (h: Human) => h.body.stature / 1.756
/** How far the eyes come down and forward when the trunk pitches by `a` (model units): for look targets and props. */
const headDrop = (h: Human, a: number) => (h.anchors.eyes[1] - h.body.crotch) * (1 - Math.cos(a))

/**
 * Seated cross-legged on the ground: knees out, each foot under the other shin, the back
 * rounded, forearms on the knees. `arms: false` leaves the arms to the caller (strike, holdWrite).
 */
export function seated(h: Human, d: Drive, t: number, o?: PoseOpts & { arms?: boolean }): Frame {
  const F = seated0(h, d, t, o?.life ?? 1, o?.arms !== false)
  lookTo(h, d, F, t, o, h.body.hip - 0.098 * h.body.mass + headDrop(h, 0.4), 0.3)
  return F
}
function seated0(h: Human, d: Drive, t: number, k: number, arms: boolean): Frame {
  const s = SK(h), m = h.body.mass
  const drop = h.body.hip - 0.098 * m
  const sway = wander(t * 0.45, d.seed) * k
  const F = place(d, drop, 0, 0)
  d.ch.tilt = -0.1 + 0.015 * sway
  d.ch.lean = 0.5 + 0.03 * sway
  d.ch.bend = 0.03 * wander(t * 0.3, d.seed + 4) * k
  d.ch.nod = -0.28
  limbTo(d, F, "legR", 0.25 * s, 0.07 * s, -0.07 * s, 0.5, 0.22, 1)
  limbTo(d, F, "legL", 0.34 * s, 0.065 * s, 0.08 * s, 0.5, 0.22, -1)
  aim(d, F, "legR", 0.3, -0.12, -0.94, -0.9, 0.1, -0.3)
  aim(d, F, "legL", 0.3, -0.12, 0.94, -0.9, 0.1, 0.3)
  if (arms) {
    limbTo(d, F, "armR", 0.33 * s, 0.31 * s, 0.34 * s, -0.2, -0.5, 1)
    limbTo(d, F, "armL", 0.33 * s, 0.31 * s, -0.34 * s, -0.2, -0.5, -1)
    aim(d, F, "armR", 0.8, -0.55, -0.25, 0.25, -0.9, 0.2)
    aim(d, F, "armL", 0.8, -0.55, 0.25, 0.25, -0.9, -0.2)
    d.ch.curlR += 1
    d.ch.curlL += 1
  }
  idle(d, t, k)
  return F
}

/** Crouching on the heels, feet flat, forearms on the knees and the hands loose between them: someone feeding a fire. */
export function crouch(h: Human, d: Drive, t: number, o?: PoseOpts & { arms?: boolean }): Frame {
  const F = crouch0(h, d, t, o?.life ?? 1, o?.arms !== false)
  lookTo(h, d, F, t, o, h.body.hip - 0.33 * SK(h) + headDrop(h, 0.9), 0.8)
  return F
}
function crouch0(h: Human, d: Drive, t: number, k: number, arms: boolean): Frame {
  const s = SK(h)
  const drop = h.body.hip - 0.33 * s
  const sway = wander(t * 0.5, d.seed) * k
  const F = place(d, drop, -0.2 * s, 0.01 * sway)
  plant(h, d, F, 0, 0, 0.07 * s, 0.4)
  d.ch.tilt = 0.6 + 0.02 * sway
  d.ch.lean = 0.42
  d.ch.nod = -0.6
  if (arms) {
    limbTo(d, F, "armR", 0.36 * s, 0.4 * s, 0.13 * s, 0, -0.3, 1)
    limbTo(d, F, "armL", 0.36 * s, 0.4 * s, -0.13 * s, 0, -0.3, -1)
    aim(d, F, "armR", 0.75, -0.6, -0.25, 0.3, -0.5, -0.8)
    aim(d, F, "armL", 0.75, -0.6, 0.25, 0.3, -0.5, 0.8)
    d.ch.curlR += 1.1
    d.ch.curlL += 1.1
  }
  idle(d, t, k)
  return F
}

/**
 * Reaching to a point with one hand, from standing: `w` 0..1 is how far the reach has gone (keyframe
 * it); the fingertips arrive at `target` (world), the trunk leans and turns after the hand.
 */
export function reachTo(h: Human, d: Drive, t: number, o: PoseOpts & { target: Vec3 | number[]; w?: number; side?: 1 | -1 }): Frame {
  const k = o.life ?? 1, w = o.w ?? 1, side = o.side ?? 1
  const F = stand0(h, d, t, k)
  toFrame(F, o.target, _c)
  const sh = h.anchors.shoulder
  let dx = _c[0] - sh[0], dy = _c[1] - sh[1], dz = _c[2] - side * sh[2]
  const dl = Math.hypot(dx, dy, dz) || 1
  dx /= dl
  dy /= dl
  dz /= dl
  const far = sstep((dl - (h.len.upper + h.len.fore) * 0.7) / 0.5)
  d.ch.lean += 0.42 * far * w * Math.max(0, dx)
  d.ch.twist += -side * 0.3 * far * w
  d.ch.bend += side * 0.12 * far * w * Math.max(0, -dy)
  const name = side > 0 ? "armR" : "armL"
  const hl = h.len.hand * 0.92
  limbTo(d, F, name, _c[0] - dx * hl, _c[1] - dy * hl, _c[2] - dz * hl, -0.2, -0.6, side, 1)
  const T = d.reach![name]!
  // blend from the hanging arm that stand() set
  T[3] = 1
  if (w < 1) {
    const s = h.anchors.shoulder, L = (h.len.upper + h.len.fore) * 0.97
    toWorld(F, s[0] + 0.05, s[1] - 0.012 - L, side * (s[2] + 0.055), _a)
    for (let i = 0; i < 3; i++) T[i] = _a[i] + (T[i] - _a[i]) * ease(w)
  }
  const e = ease(w)
  aim(d, F, name, mixn(0.12, dx, e), mixn(-1, dy, e), mixn(0, dz, e), mixn(0, 0, e), mixn(0, -1, e), mixn(-side, 0, e))
  d.ch[side > 0 ? "curlR" : "curlL"] = 1 - 0.75 * e
  d.ch[side > 0 ? "flatR" : "flatL"] = 0.5 * e
  lookTo(h, d, F, t, o.look ? o : own(o.target, o.lookAt), 0.012, d.ch.lean * 0.6)
  return F
}

/** The palm of one hand flat on a wall, fingers spread: `point` is where the middle of the palm goes and `normal` points out of the wall (both world). */
export function palmWall(h: Human, d: Drive, t: number, o: PoseOpts & { point: Vec3 | number[]; normal: Vec3 | number[]; side?: 1 | -1; press?: number }): Frame {
  const k = o.life ?? 1, side = o.side ?? 1
  const F = stand0(h, d, t, k * 0.5)
  const name = side > 0 ? "armR" : "armL"
  const n = o.normal
  // fingers up the wall (world up made square to the normal), leaning a little outward
  const un = n[1]
  let ux = -n[0] * un + side * 0.12 * n[2], uy = 1 - n[1] * un, uz = -n[2] * un - side * 0.12 * n[0]
  const ul = Math.hypot(ux, uy, uz) || 1
  ux /= ul
  uy /= ul
  uz /= ul
  const push = (o.press ?? 0.5) * (0.6 + 0.4 * Math.sin(t * 1.3 + d.seed))
  const T = d.reach![name]!
  const s = F.s, back = 0.068 * (h.len.hand / 0.193), off = 0.021 * (h.len.hand / 0.193)
  T[0] = o.point[0] + (n[0] * off - ux * back) * s
  T[1] = o.point[1] + (n[1] * off - uy * back) * s
  T[2] = o.point[2] + (n[2] * off - uz * back) * s
  T[3] = 1
  dirW(F, -0.2, -0.75, side * 0.6, T, 4)
  _a[0] = ux
  _a[1] = uy
  _a[2] = uz
  _b[0] = -n[0]
  _b[1] = -n[1]
  _b[2] = -n[2]
  aimWorld(d, name, _a, _b)
  d.ch[side > 0 ? "curlR" : "curlL"] = 0
  d.ch[side > 0 ? "splayR" : "splayL"] = 1
  d.ch.lean += 0.1 + 0.05 * push
  d.ch.twist += -side * 0.12
  lookTo(h, d, F, t, o.look ? o : own(o.point, o.lookAt), 0.012, 0.1)
  return F
}

/** Where a strike is in its cycle (0 = the blow lands) and how high the hand is, 0..1: raised slowly, held, brought down fast, a small rebound. Fire the sound cue when the phase wraps. */
export const strikePhase = (t: number, rate: number) => fr(t * rate)
export function strikeLift(p: number): number {
  if (p < 0.1) return 0.09 * Math.sin((Math.PI * p) / 0.1)
  if (p < 0.62) return ease((p - 0.1) / 0.52)
  if (p < 0.76) return 1
  const x = (p - 0.76) / 0.24
  return 1 - x * x * (1.6 - 0.6 * x)
}
/** The jolt just after the blow, 1 at its peak and gone in a fifth of a cycle. */
const jolt = (p: number) => 6.6 * p * Math.exp(-p / 0.035) * 2.35

export type StrikeOpts = PoseOpts & {
  /** "seated" (a hammerstone on a core held on the left thigh), "crouch", or "stand" (a hammer on an anvil). */
  base?: "seated" | "crouch" | "stand"
  /** Blows per second (default 0.55). */
  rate?: number
  /** Where the blow lands, in the figure's frame (default: in front of the left knee when seated, an anvil at hip height standing). */
  at?: number[]
  /** "stone": the right hand wraps a hammerstone; "shaft": it holds a hammer handle. */
  tool?: "stone" | "shaft"
  /** How high the hand is raised (model units, default 0.24 seated, 0.4 standing). */
  lift?: number
}

/** Gripping and striking: the right hand raises a tool and brings it down where the left hand steadies the work. */
export function strike(h: Human, d: Drive, t: number, o: StrikeOpts = NONE): Frame {
  const base = o.base ?? "seated", s = SK(h), hs = h.len.hand / 0.193
  const tool = o.tool ?? (base === "stand" ? "shaft" : "stone")
  const p = strikePhase(t + d.seed * 1.7, o.rate ?? 0.55), u = strikeLift(p), j = jolt(p)
  const F = base === "seated" ? seated0(h, d, t, o.life ?? 1, false) : base === "crouch" ? crouch0(h, d, t, o.life ?? 1, false) : stand0(h, d, t, (o.life ?? 1) * 0.4)
  const A = _A
  if (o.at) {
    A[0] = o.at[0]
    A[1] = o.at[1]
    A[2] = o.at[2]
  } else if (base === "seated") {
    A[0] = 0.4 * s
    A[1] = 0.25 * s
    A[2] = -0.1 * s
  } else if (base === "crouch") {
    A[0] = 0.5 * s
    A[1] = 0.2 * s
    A[2] = -0.04 * s
  } else {
    A[0] = 0.46 * s
    A[1] = h.body.hip * 0.98
    A[2] = 0.06 * s
  }
  const lift = (o.lift ?? (base === "stand" ? 0.4 : 0.24)) * s
  // the trunk goes with the arm: up and back as it rises, down into the blow
  d.ch.lean += (base === "stand" ? 0.2 : 0.06) - 0.07 * u + 0.03 * j
  d.ch.twist += 0.1 * u - 0.05
  d.ch.bend += -0.04 * u
  // right hand: the tool's face lands on A
  const hx = A[0] - 0.02 * s - 0.1 * u * s, hy = A[1] + lift * u, hz = A[2] + (0.07 + 0.06 * u) * s
  if (tool === "stone") {
    // palm down over the stone: the wrist is behind and above the stone's centre
    const fx = 0.78, fy = -0.3 + 0.75 * u, fz = -0.45
    const fl = Math.hypot(fx, fy, fz)
    limbTo(d, F, "armR", hx - (fx / fl) * 0.095 * hs, hy + 0.1 * hs - (fy / fl) * 0.095 * hs, hz - (fz / fl) * 0.095 * hs, -0.2, -0.3 + 0.3 * u, 1)
    aim(d, F, "armR", fx, fy, fz, 0.25 + 0.5 * u, -1, 0.15)
    d.ch.curlR = 0
    d.ch.stoneR = 1
  } else {
    const fx = 0.9, fy = -0.42 + 0.9 * u, fz = -0.1
    limbTo(d, F, "armR", hx - 0.2 * s, hy + 0.06 * s + 0.1 * u * s, hz, -0.3, -0.4 + 0.3 * u, 1)
    aim(d, F, "armR", fx, fy, fz, 0.2 + 0.6 * u, -1, 0)
    d.ch.curlR = 0
    d.ch.shaftR = 1
  }
  // left hand: under and round the work, jolted by each blow
  if (base === "stand") {
    limbTo(d, F, "armL", A[0] + 0.0 * s, A[1] + 0.03 * s - 0.006 * j, A[2] - 0.26 * s, -0.2, -0.5, -1)
    aim(d, F, "armL", 0.5, -0.1, 0.86, 0, -1, 0)
    d.ch.curlL = 1.3
  } else {
    limbTo(d, F, "armL", A[0] - 0.055 * s, A[1] - 0.075 * s - 0.008 * j, A[2] - 0.085 * s, -0.3, -0.5, -1)
    aim(d, F, "armL", 0.55, 0.12, 0.83, -0.1, 1, 0.1)
    d.ch.curlL = 0
    d.ch.cupL = 1
    d.ch.stoneL = 0.45
  }
  toWorld(F, A[0], A[1], A[2], _l)
  lookTo(h, d, F, t, o.look ? o : own(_l, o.lookAt), -d.rise / F.s + headDrop(h, d.ch.lean + d.ch.tilt), (d.ch.lean + d.ch.tilt) * 0.7)
  d.ch.nod += 0.03 * j
  return F
}

/** Holding a small slab in the left palm and writing on it with a tool in the right: a reed on clay, a burin on bone. `base` as in strike. */
export function holdWrite(h: Human, d: Drive, t: number, o: PoseOpts & { base?: "seated" | "stand"; speed?: number } = NONE): Frame {
  const base = o.base ?? "stand", s = SK(h), hs = h.len.hand / 0.193
  const F = base === "seated" ? seated0(h, d, t, o.life ?? 1, false) : stand0(h, d, t, (o.life ?? 1) * 0.5)
  const sy = base === "seated" ? 0.47 * s : h.anchors.shoulder[1] - 0.36 * s
  const S = _A
  S[0] = 0.3 * s
  S[1] = sy
  S[2] = -0.05 * s
  // left hand: palm up under the slab, fingers pointing forward and to the right
  limbTo(d, F, "armL", S[0] - 0.06 * hs, S[1] - 0.03 * hs, S[2] - 0.065 * hs, -0.2, -0.7, -0.7)
  aim(d, F, "armL", 0.62, 0.1, 0.78, -0.12, 1, 0.12)
  d.ch.curlL = 0
  d.ch.cupL = 1
  // right hand: the tool's tip walks along a line in short strokes, lifts, and starts the next
  const sp = o.speed ?? 1
  const line = fr((t * sp) / 6.5), stroke = fr(t * sp * 1.9)
  const press = Math.max(0, Math.sin(Math.PI * Math.min(1, stroke / 0.55)))
  const wx = 0.022 - 0.014 * Math.floor(line * 3), wz = -0.03 + 0.06 * fr(line * 3)
  const tx = S[0] + wx * hs, ty = S[1] + (0.014 + 0.012 * (1 - press)) * hs, tz = S[2] + wz * hs
  // the tip is where the pinch anchor is: the wrist sits up and back from it
  limbTo(d, F, "armR", tx - 0.045 * hs, ty + 0.105 * hs, tz + 0.085 * hs, -0.1, -0.5, 1)
  aim(d, F, "armR", 0.5, -0.72, -0.48, -0.3, -0.5, -0.8)
  d.ch.curlR = 0
  d.ch.pinchR = 1
  d.ch.lean += 0.12
  d.ch.nod += base === "seated" ? 0.55 : 0.62
  d.eye![1] = -0.5
  d.eye![0] = 0.25 * wz / 0.03
  return F
}

/** Turning a small crank with the right hand: `centre` of the handle's circle in the figure's frame, its `radius`, turns per second. The axle runs across the figure (along z). */
export function crank(h: Human, d: Drive, t: number, o: PoseOpts & { centre?: Vec3; radius?: number; rate?: number } = NONE): Frame {
  const s = SK(h)
  const F = stand0(h, d, t, (o.life ?? 1) * 0.4)
  const C = _A
  C[0] = o.centre ? o.centre[0] : 0.42 * s
  C[1] = o.centre ? o.centre[1] : h.body.hip * 1.08
  C[2] = o.centre ? o.centre[2] : 0.2 * s
  const r = (o.radius ?? 0.11) * s
  const a = -TAU * t * (o.rate ?? 0.7)
  const cx = Math.cos(a), sy = Math.sin(a)
  // the handle lies across the palm: the wrist is above and behind it
  limbTo(d, F, "armR", C[0] + r * cx - 0.085 * s, C[1] + r * sy + 0.045 * s, C[2], -0.3, -0.3, 1)
  aim(d, F, "armR", 0.88, -0.47, 0, 0.47, -0.88, 0)
  d.ch.curlR = 0
  d.ch.shaftR = 1
  d.ch.lean += 0.16 + 0.07 * cx
  d.ch.twist += 0.06 * sy
  d.ch.bend += 0.05
  // the other hand steadies the frame
  limbTo(d, F, "armL", C[0] - 0.09 * s, C[1] + 0.05 * s, C[2] - 0.36 * s, -0.2, -0.6, -1)
  aim(d, F, "armL", 0.95, -0.2, 0.2, 0.2, -1, 0)
  d.ch.curlL = 0.9
  toWorld(F, C[0], C[1], C[2], _l)
  lookTo(h, d, F, t, o.look ? o : own(_l, o.lookAt), 0.012, 0.2)
  return F
}

/** The catalogue, by name. */
export const POSES = { stand, seated, crouch, reachTo, palmWall, strike, holdWrite, crank }
