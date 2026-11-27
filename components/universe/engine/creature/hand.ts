// The creature toolkit, part 10: the macro hand. One generator writes a human hand (palm, five
// digits with their nails and nail folds, the webs between the fingers) in its own "hand-local"
// frame, and two adapters hang it on something: `makeHand` on a forearm of its own (a drop-in for
// `examples.hand` in a close-up), and `human.ts` on the end of the figure's arm. The surface
// detail that geometry cannot carry (creases, knuckle wrinkles, fingerprint ridges, veins,
// tendons, nail zones, forearm hair, palm pallor) is drawn by `skinMaterial` from the `hand` frame
// in the Look (`handLook` and `handFrame` write it), in the same hand-local coordinates.
//
// Hand-local frame, metres, a RIGHT hand: origin at the middle of the wrist (the level of the
// radial styloid), +x toward the fingers, +y out of the back of the hand, +z toward the little
// finger. The left hand is its mirror (z negated).
//
// Sources (R/f/creatures/refs.md, sections 5, 6 and 8; R/beats/toolkit-hands.md):
//   Bone lengths, male means, mm (Aydinlioglu, Akpinar and Tosun 1998, Tohoku J Exp Med 185:209,
//   Table 5, 100 adult hand radiographs; fetched): metacarpals I-V 46 / 68 / 64 / 58 / 54;
//   proximal phalanges 31 / 41 / 46 / 43 / 34; middle - / 24 / 29 / 28 / 20; distal 23 / 18 / 19 /
//   19 / 17. A finger's soft tip runs about 3.5 mm past its distal phalanx (by eye).
//   ANSUR II (Gordon et al. 2014) male means: hand length 193 mm (stylion to the middle fingertip),
//   palm length 116.5 (to the middle finger's palmar crease), breadth across metacarpals II-V 88,
//   wrist circumference 176. So the middle MCP joint centre sits 193 - (46 + 29 + 19 + 3.5) = 96 mm
//   past the wrist, 20 mm short of the palmar crease: the webs fill the difference.
//   Rogers et al. 2008: index PIP joint 19.4 wide by 17.8 deep, DIP 17.0 by 14.0; middle, ring and
//   little about 1.01, 0.94 and 0.82 of the index. Thumb at rest (Wikipedia "Thumb"): metacarpal
//   turned about 80 degrees into pronation, 40 abducted, 50 flexed against the index metacarpal.
//   Grips (Rogers 2008 Table 4, Napier, Marzke): power grip on a 4 cm tube MCP 35-49, PIP 48-56,
//   DIP 30-42 degrees; hammerstone held in a three-jaw chuck, thumb opposing index and middle.
//   By eye: girths between the measured joints, nail sizes (index plate about 11 by 10 mm), crease
//   and vein layout (checked against reference photographs, see the beat sheet).

import { limb, type LimbSpec } from "./anatomy"
import { solveGrip, type GripShape } from "./grip"
import type { Look } from "./shade"
import { MAT, type Bulge, type CreatureSpec, type PartSpec, type Pose, type Vec3 } from "./spec"

type Occ = NonNullable<CreatureSpec["occlusion"]>

type V = [number, number, number]
const add = (a: Vec3, b: Vec3): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: Vec3, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const norm = (a: Vec3): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// ---------------------------------------------------------------- the measured hand (hand-local, metres)

export const DIGITS = ["thumb", "index", "middle", "ring", "little"] as const
export type DigitName = (typeof DIGITS)[number]

/** Joint-to-joint lengths (m): thumb metacarpal, proximal, distal + tip; fingers proximal, middle, distal + tip. */
export const PHALANX: Record<DigitName, [number, number, number]> = {
  thumb: [0.046, 0.031, 0.027],
  index: [0.041, 0.024, 0.0215],
  middle: [0.046, 0.029, 0.0225],
  ring: [0.043, 0.028, 0.0225],
  little: [0.034, 0.02, 0.0205],
}
/** MCP joint centres of the fingers, and the thumb's CMC joint. */
export const ROOT: Record<DigitName, V> = {
  thumb: [0.022, -0.009, -0.021],
  index: [0.0935, -0.0015, -0.0305],
  middle: [0.0965, -0.001, -0.0102],
  ring: [0.0925, -0.0015, 0.0102],
  little: [0.0835, -0.0035, 0.0292],
}
/** Width scale of each finger against the index (Rogers 2008). */
const WS: Record<DigitName, number> = { thumb: 1, index: 1, middle: 1.01, ring: 0.94, little: 0.83 }
/** Sideways drift of each finger per metre of length at rest (a slight fan). */
const FAN: Record<DigitName, number> = { thumb: 0, index: -0.06, middle: -0.012, ring: 0.045, little: 0.11 }
/** Thumb segment directions at rest: metacarpal (pronated, abducted, flexed out of the palm), proximal, distal. */
const THUMB_DIR: V[] = [norm([0.78, -0.32, -0.53]), norm([0.86, -0.25, -0.44]), norm([0.9, -0.18, -0.39])]
/** The thumb's nail side at rest: it faces out toward the radial side as much as up. */
const THUMB_UP: V = [-0.22, 0.5, -0.84]

/** Joint positions of a digit, root first, tip last (hand-local). The fingers rest with a slight curl. */
export function digitJoints(d: DigitName): V[] {
  const L = PHALANX[d]
  const J: V[] = [[...ROOT[d]] as V]
  if (d === "thumb") {
    for (let i = 0; i < 3; i++) J.push(add(J[i], mul(THUMB_DIR[i], L[i])))
    return J
  }
  let a = 0.06
  for (let i = 0; i < 3; i++) {
    const p = J[i]
    J.push([p[0] + L[i] * Math.cos(a), p[1] - L[i] * Math.sin(a), p[2] + L[i] * FAN[d]])
    a += 0.1
  }
  return J
}
/** v (0..1 along the digit part) of its two inner joints, for the creases the shader draws. */
export function jointV(d: DigitName): [number, number] {
  const L = PHALANX[d], T = L[0] + L[1] + L[2]
  return [L[0] / T, (L[0] + L[1]) / T]
}

/** The palm as girth stations, `u` 0 at the wrist and 1 at the end of the palm (x = PALM_END), and its swellings (u, half-length in u). */
export const PALM_END = 0.116
// (u = x / PALM_END; the knuckles are at x 0.084 to 0.097, u 0.72 to 0.84. Past them the palm goes on
// as the web: its back drops away between the fingers and its palmar half reaches the finger crease)
export const PALM_GIRTH: { u: number; w: number; f: number; b: number; n?: number; nb?: number }[] = [
  { u: 0, w: 0.0285, f: 0.0172, b: 0.0188, n: 2.2, nb: 2.2 },
  { u: 0.14, w: 0.0312, f: 0.0172, b: 0.0205, n: 2.25, nb: 2.3 },
  { u: 0.35, w: 0.0385, f: 0.0152, b: 0.019, n: 2.4, nb: 2.4 },
  { u: 0.6, w: 0.0428, f: 0.0134, b: 0.0158, n: 2.55, nb: 2.5 },
  { u: 0.78, w: 0.0445, f: 0.0124, b: 0.0142, n: 2.6, nb: 2.6 },
  { u: 0.86, w: 0.0438, f: 0.0098, b: 0.0128, n: 2.6, nb: 2.6 },
  { u: 0.93, w: 0.0405, f: 0.0052, b: 0.0108, n: 2.4, nb: 2.6 },
  { u: 1, w: 0.035, f: 0.0022, b: 0.0074, n: 2.2, nb: 2.4 },
]
export const PALM_BULGES: (Omit<Bulge, "at" | "len"> & { u: number; len: number })[] = [
  { u: 0.25, len: 0.26, around: -126, arc: 50, h: 0.0085 }, // thenar (the thumb's metacarpal carries the rest of the ball)
  { u: 0.37, len: 0.31, around: 124, arc: 44, h: 0.0072 }, // hypothenar
  { u: 0.78, len: 0.12, around: 180, arc: 66, h: 0.0034 }, // the pads under the knuckles
  { u: 0.48, len: 0.19, around: 178, arc: 24, h: -0.0028 }, // the hollow of the palm
  // heads of metacarpals II-V: the knuckles
  { u: 0.81, len: 0.095, around: -42, arc: 13, h: 0.0042 }, { u: 0.835, len: 0.095, around: -14, arc: 13, h: 0.0047 },
  { u: 0.805, len: 0.095, around: 14, arc: 13, h: 0.0042 }, { u: 0.735, len: 0.095, around: 40, arc: 13, h: 0.0036 },
  // between the metacarpals, where the tendons and veins lie
  { u: 0.53, len: 0.24, around: -28, arc: 9, h: -0.0013 }, { u: 0.55, len: 0.24, around: 0, arc: 9, h: -0.0013 }, { u: 0.52, len: 0.24, around: 27, arc: 9, h: -0.0013 },
  { u: 0.05, len: 0.09, around: 180, arc: 26, h: -0.0016 }, // the hollow between the wrist's flexor tendons
  { u: 0.025, len: 0.05, around: 62, arc: 26, h: 0.003 }, // the head of the ulna
]

/** A finger's girth in joint units (t: 0 MCP, 1 PIP, 2 DIP, 3 tip), index-sized; scale by the finger's width. */
const FINGER_GIRTH: LimbSpec["girth"] = [
  { t: 0, w: 0.0106, f: 0.0094, b: 0.0098, n: 2.2, nb: 2.4 },
  { t: 0.45, w: 0.0092, f: 0.0077, b: 0.0089, n: 2.25, nb: 2.7 },
  { t: 0.88, w: 0.0094, f: 0.0083, b: 0.0083, n: 2.2, nb: 2.5 },
  { t: 1, w: 0.0097, f: 0.0087, b: 0.0082, n: 2.2, nb: 2.4 },
  { t: 1.12, w: 0.0094, f: 0.0083, b: 0.0083, n: 2.2, nb: 2.5 },
  { t: 1.5, w: 0.0084, f: 0.0071, b: 0.0079, n: 2.3, nb: 2.7 },
  { t: 1.9, w: 0.0084, f: 0.0069, b: 0.0071, n: 2.2, nb: 2.5 },
  { t: 2, w: 0.0085, f: 0.0068, b: 0.007, n: 2.25, nb: 2.4 },
  { t: 2.3, w: 0.0083, f: 0.0058, b: 0.0074, n: 2.6, nb: 2.4 },
  { t: 2.62, w: 0.008, f: 0.0051, b: 0.0077, n: 2.7, nb: 2.3 },
  { t: 2.86, w: 0.0067, f: 0.004, b: 0.0063, n: 2.4, nb: 2.2 },
  { t: 3, w: 0.0044, f: 0.0026, b: 0.0034, n: 2.2, nb: 2.2 },
]
const THUMB_GIRTH: LimbSpec["girth"] = [
  { t: 0, w: 0.0128, f: 0.0095, b: 0.013, n: 2.2, nb: 2.2 },
  { t: 0.5, w: 0.0145, f: 0.0098, b: 0.0158, n: 2.2, nb: 2.3 },
  { t: 0.9, w: 0.0122, f: 0.0098, b: 0.0108, n: 2.2, nb: 2.4 },
  { t: 1, w: 0.0119, f: 0.0098, b: 0.0102, n: 2.2, nb: 2.4 },
  { t: 1.5, w: 0.0104, f: 0.0084, b: 0.0097, n: 2.3, nb: 2.7 },
  { t: 1.92, w: 0.0107, f: 0.0083, b: 0.0086, n: 2.2, nb: 2.5 },
  { t: 2, w: 0.0108, f: 0.0082, b: 0.0085, n: 2.25, nb: 2.4 },
  { t: 2.3, w: 0.0106, f: 0.0068, b: 0.009, n: 2.6, nb: 2.4 },
  { t: 2.62, w: 0.0102, f: 0.0058, b: 0.0094, n: 2.7, nb: 2.3 },
  { t: 2.88, w: 0.0082, f: 0.0045, b: 0.0074, n: 2.4, nb: 2.2 },
  { t: 3, w: 0.0056, f: 0.003, b: 0.0042, n: 2.2, nb: 2.2 },
]
const DIGIT_BULGES = (thumb: boolean): LimbSpec["bulges"] => [
  // the dorsal knuckle over each joint, a pad under each segment, the pulp under the nail
  { t: 1, len: 0.17, around: 0, arc: 64, h: thumb ? 0.0012 : 0.0013 },
  { t: 2, len: 0.16, around: 0, arc: 60, h: 0.0009 },
  ...(thumb ? [] : [{ t: 0.55, len: 0.38, around: 180, arc: 78, h: 0.0009 }]),
  { t: 1.5, len: 0.36, around: 180, arc: 76, h: 0.0008 },
  { t: 2.6, len: 0.34, around: 180, arc: 92, h: 0.0011 },
  // the nail folds: the skin stands up round the sides of the plate and over its root
  { t: 2.56, len: 0.3, around: 72, arc: 18, h: 0.00045 }, { t: 2.56, len: 0.3, around: -72, arc: 18, h: 0.00045 },
  { t: 2.2, len: 0.07, around: 0, arc: 46, h: 0.0005 },
]

/** How the generator's hand-local coordinates land in the model: a point, a direction, and the scale. */
export type HandMap = { p(l: Vec3): V; d(l: Vec3): V; s: number }

export type HandPartsOpts = {
  /** The part the digits and webs grow from (the palm, or the end of an arm). */
  on: string
  map: HandMap
  /** Build both sides (the figure's hands), or one right hand. */
  mirror?: boolean
  /** Detail level at and above which the small parts appear (nails, nail folds' parts, webs). */
  minDetail?: number
  /** The first web, thumb to index (default on). */
  web0?: boolean
}

/** The digits, nails and webs, as parts on `on`. The palm itself is the caller's (see PALM_GIRTH). */
export function handParts(o: HandPartsOpts): PartSpec[] {
  const { map } = o, s = map.s
  const out: PartSpec[] = []
  DIGITS.forEach((d, row) => {
    const thumb = d === "thumb"
    const J = digitJoints(d).map((p) => map.p(p))
    const k = WS[d] * s
    const L = limb({ joints: J, girth: (thumb ? THUMB_GIRTH : FINGER_GIRTH).map((g) => ({ ...g, w: g.w * k, f: g.f * k, b: (g.b ?? g.f) * k })), bulges: DIGIT_BULGES(thumb)!.map((b) => ({ ...b, h: b.h * k })) })
    const { v: _v, ...lp } = L
    void _v
    out.push({
      name: d, on: o.on, ...lp, up: map.d(thumb ? THUMB_UP : [0, 1, 0]), mirror: o.mirror, rings: thumb ? 46 : 44, sides: 24, cap: "round",
      fillet: thumb ? 0.005 * s : 0, flare: 0, role: "digit", row, mat: MAT.digit, thin: 0.38,
    })
    // the nail plate: a thin bowed plate on the back of the last segment, its root under the fold
    const nl = (thumb ? 0.0148 : d === "little" ? 0.0112 : 0.0134) * WS[d] * s
    const nw = (thumb ? 0.0068 : 0.0057) * WS[d] * s
    out.push({
      name: d + "Nail", on: d, at: L.v(2.2), around: 0, mirror: o.mirror, sink: 0.00025 * s, frame: "surface",
      path: [[nl * 0.5, 0.00062 * s, 0], [nl, 0.00112 * s, 0]], up: map.d(thumb ? THUMB_UP : [0, 1, 0]),
      sect: [{ at: 0, w: nw * 0.78, up: 0.00022 * s, dn: 0.0002 * s, n: 2.4, bow: 0.08 }, { at: 0.25, w: nw * 0.98, up: 0.0003 * s, dn: 0.00022 * s, n: 2.8, bow: 0.13 }, { at: 0.8, w: nw, up: 0.00028 * s, dn: 0.0002 * s, n: 2.8, bow: 0.15 }, { at: 1, w: nw * 0.86, up: 0.00022 * s, dn: 0.00018 * s, n: 2.5, bow: 0.14 }],
      rings: 14, sides: 18, cap: "round", fillet: 0, mat: MAT.horn, minDetail: o.minDetail ?? 0.4,
    })
  })
  // the first web: thin skin from the index metacarpal to the thumb's proximal phalanx
  if (o.web0 !== false) {
    const r0: V = [0.06, -0.0055, -0.033]
    const t1 = digitJoints("thumb")[1]
    const tip: V = add(t1, [0.012, 0.004, 0.0075])
    const mid: V = [(r0[0] + tip[0]) / 2 + 0.002, (r0[1] + tip[1]) / 2 + 0.0005, (r0[2] + tip[2]) / 2]
    out.push({
      name: "web0", on: o.on, origin: map.p(r0), mirror: o.mirror, path: [sub(map.p(mid), map.p(r0)), sub(map.p(tip), map.p(r0))], up: map.d([-0.15, 0.95, -0.2]),
      sect: [{ at: 0, w: 0.0115 * s, up: 0.0055 * s, dn: 0.006 * s, n: 2.3 }, { at: 0.5, w: 0.0105 * s, up: 0.0036 * s, dn: 0.0042 * s, n: 2.4 }, { at: 1, w: 0.0075 * s, up: 0.0026 * s, dn: 0.003 * s }],
      rings: 18, sides: 18, cap: "round", fillet: 0, flare: 0, thin: 0.6, follow: ["thumb.0", "thumb.1"], followFrom: 0.1, mat: MAT.skin, minDetail: o.minDetail ?? 0.4,
    })
  }
  return out
}

/**
 * Contact occlusion for a hand (spec.occlusion): a capsule per phalanx and one for the palm, so
 * fingers darken each other and a fingertip curled into the palm darkens it. `bone(part, k)` names
 * a digit's k-th bone; `palm` names the palm's bone. `mirror` adds the left hand (z negated, "R" / "L").
 */
export function handOcclusion(map: HandMap, palm: string, mirror = false): Occ {
  const caps: Occ["caps"] = []
  const gates: Occ["gates"] = []
  for (const side of mirror ? (["R", "L"] as const) : ([""] as const)) {
    const m = (p: V): V => (side === "L" ? [p[0], p[1], -p[2]] : p)
    for (const d of DIGITS) {
      const J = digitJoints(d).map((p) => m(map.p(p)))
      const r = (d === "thumb" ? 0.0105 : 0.0088) * WS[d] * map.s
      for (let k = d === "thumb" ? 1 : 0; k < 3; k++) caps.push({ bone: `${d}${side}.${k}`, a: J[k], b: J[k + 1], r: k === 2 ? r * 0.85 : r })
    }
    caps.push({ bone: palm.replace("#", side), a: m(map.p([0.025, -0.004, 0])), b: m(map.p([0.08, -0.004, 0])), r: 0.022 * map.s })
    const c = m(map.p([0.08, 0, 0]))
    gates.push([c[0], c[1], c[2], 0.15 * map.s])
  }
  return { gates, caps, strength: 0.9 }
}

// ---------------------------------------------------------------- held shapes, hand poses

/** Props as the grips were solved for them (hand-local, right hand). */
export const HELD = {
  /** A hammerstone, a cobble about 8.5 by 6.5 by 7.5 cm, in a power grip: pressed into the palm (3 mm into its soft tissue: give the herd `press`), every finger wrapped on it, the thumb opposing. */
  stone: { kind: "ellipsoid", c: [0.078, -0.0545, -0.006], r: [0.043, 0.032, 0.037] } as GripShape & { kind: "ellipsoid" },
  /** A hammer or adze haft, 3.2 cm thick, lying obliquely across the palm from the hypothenar to the index base. */
  shaft: { kind: "capsule", a: [0.052, -0.0345, 0.075], b: [0.094, -0.0345, -0.085], r: 0.016 } as GripShape & { kind: "capsule" },
  /** A flint core, about 10 by 6 by 7 cm, lying on the palm and fingers with the thumb over its face: the hand that steadies the work while the other knaps it. */
  core: { kind: "ellipsoid", c: [0.098, -0.048, -0.006], r: [0.05, 0.029, 0.036] } as GripShape & { kind: "ellipsoid" },
  /** A reed stylus, 9 mm thick, in a tripod pinch: between the thumb and index pads, on the middle finger, its back end over the index knuckle. */
  stylus: { kind: "capsule", a: [0.1203, -0.1195, -0.0302], b: [0.0793, 0.0398, -0.0426], r: 0.0045 } as GripShape & { kind: "capsule" },
} as const

/** Per-digit [flex, spread, twist] lists (root first), as `Pose` entries. */
type HandPose = Record<string, [number, number?, number?][]>
const solved = (spec: CreatureSpec, shape: GripShape, o: Parameters<typeof solveGrip>[2]) => solveGrip(spec, shape, o) as HandPose

/**
 * The hand shapes, as poses keyed by digit name (`curl`, `fist`, `splay`, `flat`, `cup`, and the
 * solved grips `stone`, `shaft`, `pinch`). `spec` must hold the digits in their rest pose (from
 * `handParts`), and `map` is the one they were built with.
 */
export function handPoses(spec: CreatureSpec, map: HandMap, mirror = false): Record<string, HandPose> {
  // a left hand built as the mirror image of a right one: spread and twist turn the other way
  const M = mirror ? -1 : 1
  const pre = (p: Record<string, [number, number, number]>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [v[0], v[1] * M, v[2] * M] as [number, number, number]]))
  const spr = (p: Record<string, number>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v * M]))
  const mp = (h: HandPose): HandPose => (mirror ? Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.map((a) => [a[0], a[1] === undefined ? undefined : a[1] * M, a[2] === undefined ? undefined : a[2] * M] as [number, number?, number?])])) : h)
  const at = (g: GripShape): GripShape =>
    g.kind === "capsule" ? { kind: "capsule", a: map.p(g.a), b: map.p(g.b), r: g.r * map.s } : g.kind === "ellipsoid" ? { kind: "ellipsoid", c: map.p(g.c), r: mul(g.r, map.s) } : { kind: "sphere", c: map.p(g.c), r: g.r * map.s }
  const right: CreatureSpec = { ...spec, parts: spec.parts.filter((p) => !p.mirror || true) }
  // the thumb opposes: its metacarpal pronates at the CMC joint and swings across the palm
  const stone = solved(right, at(HELD.stone), { wrap: true, max: [1.6, 1.9, 1.6], maxOf: { thumb: [0.9, 1.1, 1.4] }, pre: pre({ thumb: [0.3, 0.3, 0.55] }), slack: 0.3, gap: 0.0002 * map.s, spread: spr({ index: 0.04, ring: -0.03, little: -0.08 }) })
  const shaft = solved(right, at(HELD.shaft), { whole: true, maxOf: { thumb: [0.4, 0.9, 1.1] }, pre: pre({ thumb: [0.55, 0.05, 0.6] }), slack: 0.8, gap: 0.0003 * map.s })
  // tripod: thumb and index pads found by search (lab), the middle finger closed under the shaft by the solver
  // tripod: thumb, index and middle poses found by search (lab tripod.ts) so the three pads sit on one 9 mm shaft that rests on the index knuckle
  const pinch3: HandPose = mp({ thumb: [[-0.042, -0.079, 0.013], [0.267], [0.324]], index: [[0.647], [0.873], [-0.002]], middle: [[0.914, 0.158], [0.813], [0.187]] })
  const core = solved(right, at(HELD.core), { wrap: true, max: [1.6, 1.9, 1.6], maxOf: { thumb: [0.9, 1.1, 1.3] }, pre: pre({ thumb: [0.45, 0.35, 0.7] }), slack: 0.2, gap: 0.0002 * map.s, spread: spr({ index: 0.03, little: -0.06 }) })
  // flat on a wall: each digit spread (or not), opened a little past straight, then closed until its pad meets the plane of the palm
  const wall: GripShape = { kind: "sphere", c: [0.08, -0.0221 - 20, 0], r: 20 }
  const onWall = (spread: number) => solved(right, at(wall), { whole: true, slack: 0, gap: 0.0002 * map.s, maxOf: { thumb: [0.6, 0.6, 0.6] }, max: [0.6, 0.6, 0.6], pre: pre({ thumb: [0.1, -0.5 * spread, 0.3 * spread], index: [-0.25, 0.17 * spread, 0], middle: [-0.25, 0.02 * spread, 0], ring: [-0.25, -0.13 * spread, 0], little: [-0.25, -0.32 * spread, 0] }) })
  return {
    curl: mp({ thumb: [[0.08, 0.05], [0.15], [0.25]], index: [[0.22], [0.36], [0.2]], middle: [[0.3], [0.44], [0.24]], ring: [[0.38], [0.5], [0.27]], little: [[0.45], [0.54], [0.3]] }),
    fist: mp({ thumb: [[0.55, 0.3, 0.5], [0.7], [0.8]], index: [[1.4], [1.75], [1.0]], middle: [[1.45], [1.8], [1.05]], ring: [[1.45], [1.8], [1.05]], little: [[1.45], [1.75], [1.0]] }),
    splay: onWall(1),
    flat: onWall(0.25),
    cup: mp({ thumb: [[0.05, -0.25, 0.2], [0.15], [0.2]], index: [[0.14, 0.06], [0.22], [0.14]], middle: [[0.16], [0.24], [0.15]], ring: [[0.18, -0.05], [0.26], [0.15]], little: [[0.22, -0.12], [0.28], [0.16]] }),
    stone, shaft, core,
    pinch: { ...pinch3, ring: [[0.95], [1.35], [0.7]], little: [[1.05], [1.35], [0.7]] },
  }
}

// ---------------------------------------------------------------- the standalone forearm and hand

export type HandSpecOpts = {
  /** Uniform size (1 = the ANSUR II male mean hand, 19.3 cm). */
  size?: number
  /** Forearm girth against a lean man's (1). */
  mass?: number
  /** "L" builds the left hand: the mirror image across the model's z (thumb toward +z), with its grips. Default "R". */
  side?: "R" | "L"
}

export type HandModel = {
  spec: CreatureSpec
  /** Rest-space points to hang props on (`human.ride(rig, rig.bone("arm.2"), skel.head, point, scale, out)`: the palm is bone `arm.2`, as on the figure). */
  anchors: { wrist: V; palm: V; palmN: V; fingers: V; stone: V; shaft: [V, V]; stylus: [V, V] }
  /** The frame the shading needs: put it in the Look (`handLook` does). */
  frame: HandFrame
  map: HandMap
}

/** Where the hand is in rest space, for the shading: hand-local origin, axes and scale; `mirror` if both hands are mirrored about z = 0. */
export type HandFrame = { o: Vec3; x: Vec3; y: Vec3; z: Vec3; s: number; mirror?: boolean; v: [number, number][] }

/**
 * A right forearm and hand (elbow at the origin, +x to the fingers, palm down, thumb toward -z),
 * the macro successor of `examples.hand`. Pose it as that one: `makeAim` for the elbow and the
 * forearm's direction, `drive.roll` for pronation, and the channels `curl`, `fist`, `splay`,
 * `flat`, `cup`, `stone`, `shaft`, `pinch` (0..1, they blend) for the hand, plus `wrist`
 * ([flex, deviation]: set `d.ch.wristFlex`, `d.ch.wristDev` in radians). Skinned with dual quaternions.
 */
export function makeHand(o: HandSpecOpts = {}): HandModel {
  const s = o.size ?? 1, m = o.mass ?? 1
  const W = 0.268 * s // radiale-stylion 26.8 cm
  const zs = o.side === "L" ? -1 : 1
  const map: HandMap = { p: (l) => [W + l[0] * s, l[1] * s, zs * l[2] * s], d: (l) => norm([l[0], l[1], zs * l[2]]), s }
  // forearm and palm are ONE jointed tube (elbow, wrist, the end of the palm): no seam at the wrist.
  // Forearm girths from ANSUR II (31 cm flexed below the elbow, 17.6 at the wrist) and the surface anatomy.
  const FG: LimbSpec["girth"] = [
    { t: 0, w: 0.042 * m * s, f: 0.041 * m * s, b: 0.043 * m * s, n: 2.1 },
    { t: 0.12, w: 0.0455 * m * s, f: 0.044 * m * s, b: 0.046 * m * s, n: 2.1 },
    { t: 0.3, w: 0.0425 * m * s, f: 0.038 * m * s, b: 0.04 * m * s, n: 2.15 },
    { t: 0.55, w: 0.037 * m * s, f: 0.029 * m * s, b: 0.03 * m * s, n: 2.25 },
    { t: 0.8, w: 0.0322 * s, f: 0.0212 * s, b: 0.0222 * s, n: 2.4 },
    ...PALM_GIRTH.map((g) => ({ t: 1 + g.u, w: g.w * s, f: g.f * s, b: g.b * s, n: g.n, nb: g.nb })),
  ]
  // a joint 2.5 cm short of the wrist keeps a bent wrist from bending the forearm with it (the blend spans 30% of a segment)
  const WJ = W - 0.025 * s
  const tt = (t: number) => (t >= 1 ? t + 1 : (t * W) / WJ < 1 ? (t * W) / WJ : 1 + (t * W - WJ) / (W - WJ))
  const ARM = limb({
    joints: [[0, 0, 0], [WJ, 0, 0], [W, 0, 0], map.p([PALM_END, -0.0015, 0])],
    girth: FG.map((g) => ({ ...g, t: tt(g.t) })),
    bulges: [
      ...[
        { t: 0.22, len: 0.24, around: zs * -78, arc: 42, h: 0.0065 * m * s }, // brachioradialis on the thumb side
        { t: 0.3, len: 0.28, around: zs * -30, arc: 30, h: 0.004 * m * s }, // the wrist extensors beside it
        { t: 0.28, len: 0.3, around: zs * 150, arc: 52, h: 0.005 * m * s }, // the flexors' belly
        { t: 0.45, len: 0.4, around: zs * 72, arc: 10, h: -0.0022 * s }, // the ulna's border, under the skin
      ],
      { t: tt(0.86), len: 0.12, around: zs * 175, arc: 10, h: 0.0011 * s }, { t: tt(0.86), len: 0.12, around: zs * -160, arc: 9, h: 0.0012 * s }, // palmaris longus and the radial flexor, near the wrist
      ...PALM_BULGES.map(({ u, ...b }) => ({ ...b, around: zs * b.around, t: 2 + u, h: b.h * s })),
    ],
  })
  const { v: _av, ...armP } = ARM
  void _av
  const base: CreatureSpec = {
    name: zs < 0 ? "handMacroL" : "handMacro",
    skinning: "dq",
    // the body is a stub hidden in the elbow's cap: the aim path and drive.roll place it
    body: { spine: [[0.004 * s, 0, 0], [0.012 * s, 0, 0], [0.02 * s, 0, 0]], sect: [{ at: 0, w: 0.02 * s, up: 0.02 * s }, { at: 1, w: 0.02 * s, up: 0.02 * s }], rings: 4, sides: 8, bones: [0, 1], caps: ["round", "round"] },
    parts: [
      { name: "arm", ...armP, origin: [0, 0, 0], up: [0, 1, 0], rings: 76, sides: 40, cap: "round", cap0: "round", fillet: 0, flare: 0, role: "arm" },
      ...handParts({ on: "arm", map }),
    ],
  }
  const hp = handPoses(base, map, zs < 0)
  const poses: Record<string, Pose> = {}
  for (const [k, p] of Object.entries(hp)) poses[k] = p as Pose
  poses.wristFlex = { arm: [[0], [0], [1]] }
  poses.wristDev = { arm: [[0], [0], [0, 1]] }
  const spec: CreatureSpec = { ...base, poses, occlusion: handOcclusion(map, "arm.2") }
  const sh = HELD.shaft, st = HELD.stylus
  return {
    spec, map,
    anchors: {
      wrist: map.p([0, 0, 0]), palm: map.p([0.06, -0.019, 0]), palmN: [0, -1, 0], fingers: [1, 0, 0],
      stone: map.p(HELD.stone.c), shaft: [map.p(sh.a), map.p(sh.b)], stylus: [map.p(st.a), map.p(st.b)],
    },
    frame: { o: map.p([0, 0, 0]), x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, zs], s, v: DIGITS.map(jointV) },
  }
}

export type HandSkin = {
  /** Skin colour (the back of the hand). */
  skin?: number
  /** Palm colour (paler, less melanin: default derived from `skin`). */
  palm?: number
  /** 0..1: dried clay or dust in the creases and on the pads, and its colour. */
  clay?: number
  clayCol?: number
  dust?: number
  /** 0..1 forearm and back-of-hand hair. Default 0.6. */
  hair?: number
  /** 0..1 how far the veins stand out. Default 0.6. */
  veins?: number
  /** 0..1 calluses on the pads and the palm under the knuckles (a knapper's hand). */
  callus?: number
}

/** A Look for the macro hand (or pass `frame` to `human.humanLook` for a figure's hands). */
export function handLook(h: HandModel | HandFrame, o: HandSkin = {}): Look {
  const frame = "frame" in h ? h.frame : h
  const skin = o.skin ?? 0x8a5c44
  const k = (c: number, f: [number, number, number]) => {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * f[0])), g = Math.min(255, Math.round(((c >> 8) & 255) * f[1])), bl = Math.min(255, Math.round((c & 255) * f[2]))
    return (r << 16) | (g << 8) | bl
  }
  return {
    base: skin, belly: skin, horn: 0xb27a6c, hornTip: 0xc0a08a, prop: 0x5a554c, eye: 0,
    cell: 0.00062, relief: 0.000045, cellVary: 0.04, mottle: 0.1, blotch: 0.07, blotchSize: 0.05, accent: k(skin, [0.86, 0.78, 0.78]),
     occlude: 0, rough: 0.58, spec: 0.2, wrap: 0.32, rim: 0.22, bleed: 0x5a2014, glow: 0.7, sss: 0.5,
    hand: { ...frame, palm: o.palm ?? k(skin, [1.32, 1.16, 1.08]), clay: o.clay ?? 0, clayCol: o.clayCol ?? 0x8c7a62, dust: o.dust ?? 0, hair: o.hair ?? 0.6, veins: o.veins ?? 0.45, callus: o.callus ?? 0 },
    nails: true,
  }
}

/** The figure's hand frame from the arm's wrist and axes (human.ts). */
export function frameOf(wrist: Vec3, x: Vec3, y: Vec3, z: Vec3, s: number, mirror: boolean): HandFrame {
  return { o: [...wrist] as V, x: [...x] as V, y: [...y] as V, z: [...z] as V, s, mirror, v: DIGITS.map(jointV) }
}
