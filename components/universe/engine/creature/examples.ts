// The creature toolkit: two worked examples. EXAMPLES ONLY. They exist to show how a spec is
// written from references and to prove the two hard cases (a many-flapped swimmer, a heavy
// quadruped). A scene models its own animals for its own story: copy the pattern, not the animal.
//
// What each was checked against is in R/BUILD.md, "The creature toolkit", and repeated here.

import { digit, limb, loft, muscle } from "./anatomy"
import { solveGrip, type GripShape } from "./grip"
import { MAT, type CreatureSpec, type PartSpec, type Section, type Vec3 } from "./spec"
import type { Look } from "./shade"

// ---------------------------------------------------------------- Triceratops horridus (metres)
//
// THE WORKED PATTERN for a large tetrapod. Order of work: proportions (the loft stations and the
// joint positions, read off references), then silhouette from four views, then surface.
//
// Fetched 2026-11-27 (notes with URLs: R/f/creatures/refs.md):
//  - Natural History Museum, London, dino directory "Triceratops": 9 m, 10 t; frill solid and
//    short; beak deep and narrow. Wikipedia "Triceratops": 8 to 9 m, 6 to 10 t; skull to 2.5 m,
//    "almost a third of the length of the entire animal"; brow horns about 1 m, forward in adults;
//    one nasal horn above the nostrils; 5 epoccipitals per squamosal; 10 neck, 12 back, 10 sacral
//    and about 45 tail vertebrae; three hoofed fingers bearing weight (I to III), four hoofed toes.
//  - Thompson and Holmes 2007, Palaeontologia Electronica 10(1) (Chasmosaurus fore limb through a
//    step): humerus about 37 degrees to the horizontal, turned out about 27 degrees, elbow angle 89 to 114
//    degrees; "distinctly narrow chest between the pectoral girdles", a "broad barrel" by the
//    ninth rib. Paul and Christiansen 2000, Paleobiology (abstract): hands "directly beneath the
//    glenoids", elbows "only slightly averted", fore prints lateral to hind prints (Ceratopsipes).
//  - Skin (the "Lane" specimen, via Wikipedia): polygonal basement scales to 9 cm, feature scales
//    over 10 cm spaced 15 to 20 cm. Colour is unknown; this one is an invention in rhinoceros greys.
// From memory, NOT fetched (no skeletal reconstruction with segment lengths could be loaded): the
// split of length into skull, trunk and tail (about 30 : 30 : 35), the back highest over the
// hips with the shoulder at about 0.85 of that, humerus about 0.7 and tibia about 0.7 of the
// femur (femur 1.03 m is fetched), the tail held clear of the ground, a torso 1.6 to 1.8 m wide.
//
// Origin: on the ground under the hips. x forward, y up, z right.

/**
 * The head was drawn at one size and then scaled about the occiput by eye: these carry every head part with it.
 * MEASURED, AND TOO BIG: beak tip to frill edge is about 3.0 m along the ground and 3.8 m along the skull on an
 * 8.2 m animal (0.37 and 0.47 of its length), where the fetched sources give a skull of at most 2.5 m, "almost a
 * third"; the frill is 2.4 m across. HS 0.9 with a shorter, flatter frill would be closer. Check your own animal's
 * numbers against its sources the same way before you trust the picture.
 */
const HS = 1.14
const hx = (x: number) => 2.95 + (x - 2.95) * HS
const hy = (y: number) => 1.74 + (y - 1.74) * HS
const H = (x: number, y: number, z = 0): [number, number, number] => [hx(x), hy(y), z * HS]
const hp = (path: [number, number, number][]): [number, number, number][] => path.map((p) => [p[0] * HS, p[1] * HS, p[2] * HS])
const hs = (sect: Section[]): Section[] => sect.map((q) => ({ ...q, w: q.w * HS, up: q.up * HS, dn: q.dn === undefined ? undefined : q.dn * HS, ridge: q.ridge ? [q.ridge[0] * HS, q.ridge[1] * HS] : undefined }))
const hst = (x: number, top: number, bot: number, hw: number, n: number) => ({ x: hx(x), top: hy(top), bot: hy(bot), hw: hw * HS, n })

// 1. PROPORTIONS. The side-view outline (top, bottom) and the top-view half-width, tail to beak.
const T = loft([
  { x: -3.25, top: 1.0, bot: 0.95, hw: 0.02 },
  { x: -2.7, top: 1.24, bot: 1.0, hw: 0.085, ridge: [0.02, 0.03] },
  { x: -2.0, top: 1.6, bot: 1.13, hw: 0.16, ridge: [0.035, 0.05], n: 1.9 },
  { x: -1.3, top: 2.02, bot: 1.28, hw: 0.26, ridge: [0.045, 0.07], n: 1.9 },
  { x: -0.7, top: 2.42, bot: 1.36, hw: 0.4, ridge: [0.05, 0.09], n: 1.9 },
  { x: -0.25, top: 2.66, bot: 1.24, hw: 0.62, mid: 0.56, ridge: [0.05, 0.11], n: 2 },
  { x: 0.2, top: 2.78, bot: 1.12, hw: 0.84, mid: 0.56, ridge: [0.045, 0.12], n: 2.1, nb: 2.4 }, // the hips: the highest point of the back
  { x: 0.8, top: 2.74, bot: 0.96, hw: 0.95, mid: 0.46, ridge: [0.04, 0.12], n: 2.1, nb: 2.7 },
  { x: 1.4, top: 2.63, bot: 0.93, hw: 0.97, mid: 0.44, ridge: [0.035, 0.12], n: 2.1, nb: 2.8 }, // the barrel: broadest at the ninth rib, belly flat
  { x: 1.9, top: 2.5, bot: 0.98, hw: 0.86, mid: 0.46, ridge: [0.03, 0.11], n: 2.1, nb: 2.6 },
  { x: 2.35, top: 2.37, bot: 1.06, hw: 0.64, mid: 0.5, ridge: [0.02, 0.1], n: 2.1, nb: 2.3 }, // narrow between the shoulders
  { x: 2.7, top: 2.26, bot: 1.18, hw: 0.45 },
  { x: 2.95, top: 2.2, bot: 1.27, hw: 0.4 }, // the neck, hidden under the frill
  hst(3.2, 2.2, 1.42, 0.43, 2.5),
  hst(3.5, 2.2, 1.37, 0.47, 2.6), // across the orbits and jugals: the widest of the face
  hst(3.8, 2.08, 1.3, 0.4, 2.5),
  hst(4.1, 1.9, 1.2, 0.3, 2.3),
  hst(4.35, 1.68, 1.12, 0.2, 2.1),
  hst(4.55, 1.42, 1.03, 0.11, 1.9),
  hst(4.67, 1.16, 0.99, 0.03, 2), // the beak tip, hooked down
])
const tx = T.at

// the limbs: socket, joints and tip from the same drawing. Fore prints fall outside hind prints.
const HIND = limb({
  joints: [[0.1, 1.95, 0.56], [0.46, 1.0, 0.63], [0.12, 0.38, 0.63], [0.3, 0.125, 0.63], [0.5, 0.085, 0.63]],
  girth: [
    { t: 0, w: 0.44, f: 0.5, b: 0.6 }, { t: 0.35, w: 0.43, f: 0.47, b: 0.56 }, { t: 0.8, w: 0.33, f: 0.36, b: 0.37 }, { t: 1, w: 0.27, f: 0.31, b: 0.26 },
    { t: 1.35, w: 0.25, f: 0.22, b: 0.31 }, { t: 2, w: 0.2, f: 0.17, b: 0.2 }, { t: 2.6, w: 0.25, f: 0.17, b: 0.19 }, { t: 3, w: 0.29, f: 0.15, b: 0.12, nb: 3 },
    { t: 3.6, w: 0.28, f: 0.115, b: 0.1, nb: 3 }, { t: 4, w: 0.24, f: 0.085, b: 0.085, nb: 3 },
  ],
  bulges: [
    { t: 0.45, len: 0.45, around: 75, arc: 70, h: 0.07 }, // the thigh's outer mass
    { t: 1, len: 0.16, around: 0, arc: 60, h: 0.05 }, // knee
    { t: 1.3, len: 0.3, around: 180, arc: 65, h: 0.06 }, // calf
    { t: 2, len: 0.14, around: 180, arc: 50, h: 0.04 }, // heel
  ],
})
const FORE = limb({
  joints: [[2.3, 1.45, 0.5], [2.02, 0.86, 0.69], [2.2, 0.33, 0.73], [2.31, 0.115, 0.75], [2.47, 0.08, 0.77]],
  girth: [
    { t: 0, w: 0.34, f: 0.4, b: 0.42 }, { t: 0.5, w: 0.3, f: 0.31, b: 0.36 }, { t: 1, w: 0.24, f: 0.23, b: 0.27 }, { t: 1.3, w: 0.23, f: 0.23, b: 0.24 },
    { t: 2, w: 0.19, f: 0.17, b: 0.18 }, { t: 2.6, w: 0.23, f: 0.15, b: 0.17 }, { t: 3, w: 0.26, f: 0.13, b: 0.11, nb: 3 }, { t: 3.6, w: 0.27, f: 0.105, b: 0.09, nb: 3 }, { t: 4, w: 0.24, f: 0.075, b: 0.075, nb: 3 },
  ],
  bulges: [
    { t: 0.4, len: 0.4, around: 60, arc: 70, h: 0.06 }, // deltoid and triceps
    { t: 1, len: 0.15, around: 180, arc: 55, h: 0.07 }, // the point of the elbow
    { t: 1.3, len: 0.3, around: 0, arc: 70, h: 0.035 }, // forearm
  ],
})
/** A hoof: a short blunt block on the front of the toe segment, `dz` off the foot's midline, splayed by `yaw`. */
const hoof = (leg: "hind" | "fore", tip: [number, number, number], i: number, dz: number, yaw: number, r: number): PartSpec => ({
  name: `${leg}Hoof${i}`, on: leg, origin: [tip[0] - r * 1.5 - Math.abs(dz) * 0.35, tip[1] + r * 0.05, tip[2] + dz], mirror: true,
  path: [[r * 1.5 * Math.cos(yaw), -r * 0.1, r * 1.5 * Math.sin(yaw)], [r * 2.3 * Math.cos(yaw), -r * 0.42, r * 2.3 * Math.sin(yaw)]],
  sect: [{ at: 0, w: r * 0.95, up: r * 1.0, dn: r * 0.85, n: 2.5 }, { at: 0.6, w: r, up: r * 0.95, dn: r * 0.8, n: 2.6 }, { at: 1, w: r * 0.7, up: r * 0.5, dn: r * 0.42 }],
  rings: 5, sides: 9, cap: "round", fillet: r * 0.3, mat: MAT.shell, minDetail: 0.4,
})

export const triceratops: CreatureSpec = {
  name: "triceratops",
  body: {
    spine: T.spine, sect: T.sect, rings: 150, sides: 40,
    // four tail frames, the hips, two in the trunk, the shoulders, the neck, two in the rigid head
    bones: [0, tx(-2.5), tx(-1.7), tx(-0.9), tx(0.1), tx(0.9), tx(1.6), tx(2.3), tx(2.9), tx(hx(3.3)), tx(hx(4.0)), 1],
    caps: ["point", "point"],
    breath: [tx(0.3), tx(2.2), 0.02],
    // 2. SILHOUETTE: what a smooth loft cannot say. Bone and muscle that show through the hide.
    bulges: [
      muscle(tx(0.12), 52, 0.07, 0.085, 46, true), // the ilium: the hips stand proud of the back
      muscle(tx(2.22), 78, 0.1, 0.085, 50, true), // shoulder blade and its muscle
      muscle(tx(1.15), 178, 0.07, 0.11, 60, false), // the gut hangs
      muscle(tx(-0.55), 70, 0.05, 0.05, 50, true), // the tail's root muscle (caudofemoralis)
      muscle(tx(hx(3.55)), 38, 0.06, 0.02, 24, true), // the boss the brow horn stands on
      muscle(tx(hx(3.42)), 118, 0.07, 0.028, 30, true), // cheek: the jugal flares
      muscle(tx(hx(3.9)), 100, -0.035, 0.03, 30, true), // the hollow of the cheek in front of it
      muscle(tx(hx(4.28)), 78, -0.045, 0.017, 26, true), // the nostril, in its great fossa
      muscle(tx(hx(4.16)), 0, 0.03, 0.03, 40, false), // nasal boss
    ],
  },
  parts: [
    // the frill: a solid shield of bone rising behind the brow horns, as wide as the shoulders, saddled round the neck
    {
      name: "frill", origin: H(3.3, 2.1, 0), path: hp([[-0.4, 0.3, 0], [-0.82, 0.64, 0], [-1.16, 0.96, 0], [-1.3, 1.12, 0]]), up: [0.6, 0.8, 0],
      sect: hs([{ at: 0, w: 0.52, up: 0.16, dn: 0.2, n: 2.5, bow: 0.95 }, { at: 0.3, w: 0.88, up: 0.09, dn: 0.1, n: 2.6, bow: 0.6 }, { at: 0.62, w: 1.04, up: 0.065, n: 2.7, bow: 0.44, ridge: [0.03, 0.12] }, { at: 0.88, w: 0.96, up: 0.055, n: 2.7, bow: 0.34, ridge: [0.02, 0.12] }, { at: 1, w: 0.7, up: 0.05, n: 2.6, bow: 0.28 }]),
      rings: 22, sides: 36, fillet: 0.36, cap: "round",
    },
    // epoccipitals: low triangles round the frill's margin, five down each squamosal
    ...[0.3, 0.44, 0.58, 0.72, 0.86].map((at, i): PartSpec => ({
      name: "epo" + i, on: "frill", at, around: 90, mirror: true, sink: 0.03, frame: "surface", path: hp([[0, 0.1, 0]]), sect: hs([{ at: 0, w: 0.1, up: 0.045 }, { at: 1, w: 0.016, up: 0.014 }]), up: [0.6, 0.8, 0],
      rings: 3, sides: 6, cap: "point", fillet: 0.05, minDetail: 0.4,
    })),
    ...[-0.5, -0.17, 0.17, 0.5].map((z, i): PartSpec => ({
      name: "epoTop" + i, origin: H(2.03 + Math.abs(z) * 0.2, 3.16 - Math.abs(z) * 0.3, z), path: hp([[-0.07, 0.085, z * 0.1]]), sect: hs([{ at: 0, w: 0.1, up: 0.045 }, { at: 1, w: 0.016, up: 0.014 }]), up: [0.6, 0.8, 0],
      rings: 3, sides: 6, cap: "point", fillet: 0.05, on: "frill", minDetail: 0.4,
    })),
    // brow horns: about a metre, from above the eyes, forward and a little out, the tips turned up
    {
      name: "brow", origin: H(3.52, 2.1, 0.25), mirror: true, path: hp([[0.26, 0.3, 0.05], [0.58, 0.52, 0.1], [0.92, 0.62, 0.12], [1.08, 0.7, 0.12]]),
      sect: hs([{ at: 0, w: 0.14, up: 0.16 }, { at: 0.25, w: 0.105, up: 0.115 }, { at: 0.7, w: 0.055, up: 0.06 }, { at: 1, w: 0.01, up: 0.01 }]), rings: 16, sides: 12, cap: "point", fillet: 0.14, mat: MAT.horn,
    },
    { name: "nasal", origin: H(4.14, 1.84, 0), path: hp([[0.05, 0.16, 0], [0.13, 0.3, 0]]), sect: hs([{ at: 0, w: 0.085, up: 0.12 }, { at: 0.5, w: 0.055, up: 0.07 }, { at: 1, w: 0.012, up: 0.014 }]), rings: 7, sides: 10, cap: "point", fillet: 0.08, mat: MAT.horn },
    // jugal horns: down and out from the cheek, below and behind the eye
    { name: "jugal", origin: H(3.4, 1.5, 0.43), mirror: true, path: hp([[-0.03, -0.15, 0.07], [-0.06, -0.3, 0.11]]), sect: hs([{ at: 0, w: 0.11, up: 0.14 }, { at: 0.6, w: 0.06, up: 0.07 }, { at: 1, w: 0.02, up: 0.02 }]), rings: 6, sides: 8, cap: "point", fillet: 0.1 },
    // lower jaw, deep at the back, with its own beak
    {
      name: "jaw", origin: H(3.32, 1.4, 0), path: hp([[0.4, -0.12, 0], [0.82, -0.25, 0], [1.1, -0.33, 0], [1.24, -0.3, 0]]), sect: hs([{ at: 0, w: 0.36, up: 0.14, dn: 0.2, n: 2.4 }, { at: 0.4, w: 0.3, up: 0.11, dn: 0.2, n: 2.4 }, { at: 0.75, w: 0.15, up: 0.08, dn: 0.14 }, { at: 1, w: 0.03, up: 0.04, dn: 0.03 }]),
      rings: 12, sides: 14, cap: "point", fillet: 0.1, bones: 1, role: "jaw",
    },
    // the beak: a horn sheath over the rostral bone, deep, narrow and hooked
    { name: "beak", origin: H(4.3, 1.42, 0), path: hp([[0.18, -0.06, 0], [0.33, -0.24, 0], [0.36, -0.44, 0]]), sect: hs([{ at: 0, w: 0.17, up: 0.22, dn: 0.17, n: 1.9 }, { at: 0.5, w: 0.1, up: 0.15, dn: 0.1, n: 1.9 }, { at: 1, w: 0.012, up: 0.03, dn: 0.02 }]), rings: 9, sides: 12, cap: "point", fillet: 0.04, mat: MAT.horn },
    { name: "eye", origin: H(3.6, 1.9, 0.41), mirror: true, path: hp([[0.01, 0, 0.05]]), sect: hs([{ at: 0, w: 0.036, up: 0.036 }, { at: 1, w: 0.03, up: 0.03 }]), rings: 3, sides: 12, cap: "round", fillet: 0.035, mat: MAT.eye, minDetail: 0.4 },
    // hind limb: a column under the hip, knee forward; four hoofed toes
    { name: "hind", ...HIND, mirror: true, up: [1, 0, 0], rings: 40, sides: 20, cap: "round", fillet: 0.24, role: "leg", limits: [0.12, 1.6], toes: true },
    hoof("hind", [0.5, 0.085, 0.63], 0, -0.2, -0.45, 0.06), hoof("hind", [0.5, 0.085, 0.63], 1, -0.07, -0.13, 0.068), hoof("hind", [0.5, 0.085, 0.63], 2, 0.07, 0.13, 0.068), hoof("hind", [0.5, 0.085, 0.63], 3, 0.2, 0.45, 0.06),
    // fore limb: shorter; the elbow flexed back and a little out, the hand under the shoulder, fingers turned out; three hoofed fingers
    { name: "fore", ...FORE, mirror: true, up: [1, 0, 0], rings: 36, sides: 18, cap: "round", fillet: 0.2, role: "leg", limits: [0.14, 1.7], toes: true },
    hoof("fore", [2.47, 0.08, 0.77], 0, -0.13, -0.15, 0.06), hoof("fore", [2.47, 0.08, 0.77], 1, 0.02, 0.2, 0.064), hoof("fore", [2.47, 0.08, 0.77], 2, 0.16, 0.55, 0.056),
  ],
  // 3. WEIGHT. A slow lateral-sequence amble, three feet down most of the time. Each girdle sinks as a foot
  // takes the load, the belly swings late, the head nods, the tail lags the hips.
  gait: {
    gait: "amble", stride: 1.9, duty: 0.72, lift: 0.17, bob: 0.018, shift: 0.075, roll: 0.02, girdle: 0.055, pitch: 0.05,
    tail: [0.4, 0.34], head: [0.09, 0.14], tailAt: tx(0), neckAt: tx(2.7),
    drop: 0.045, dropRoll: 0.022, belly: [0.05, 0.12], tailBob: 2.2,
  },
  motions: [{ role: "jaw", axis: "side", bias: 0.3, channel: "jaw" }],
}

export const triceratopsLook: Look = {
  base: 0x4e4438, back: 0x2a241e, belly: 0x8a7b62, accent: 0x362d25, horn: 0x6e6250, hornTip: 0x1e1914, shell: 0x2a231d, eye: 0x4a2a0c,
  // skin at the scale of the shot: scales to 9 cm with larger feature scales (resolved up close), folds and mottling (resolved from far)
  cell: 0.085, relief: 0.016, cellVary: 0.22, feature: 2.3, blotch: 0.3, blotchSize: 1.2, mottle: 0.3,
  fold: 0.42, foldSize: 0.17, foldFlex: 3, dust: 0x7a6a54, dustTo: 0.85, dustAmt: 0.34, occlude: 0.75, selfShadow: 0.8,
  rough: 0.8, spec: 0.14, wrap: 0.3, rim: 0.24,
}

// ---------------------------------------------------------------- Anomalocaris canadensis (centimetres)
//
// Looked up (fetched while modelling): Wikipedia "Anomalocaris": thirteen pairs of trunk flaps and
// three small pairs on a constricted neck; each flap sloping below the one behind, so a side acts
// as one fin; widest between the third and fifth; setal blades in rows on the back of each
// segment; a tail fan of three pairs of fins and a terminal piece; frontal appendages of 14
// podomeres, taller than wide, most with a pair of ventral endites; the body about twice the
// appendage's length; stalked compound eyes; an oval head shield and two lateral P-elements; a
// triradial oral cone under the head; swimming by a wave along the flaps (Usami 2006).
// From memory, NOT re-checked against the source: the upswept V of the tail fan and the stiff
// head on a flexible trunk (Daley and Edgecombe 2014); the page gives no fan orientation, eye
// position, appendage curl or body cross-section, so those are this model's reading of published
// reconstructions. Colour is invented.
//
// Origin: mid-trunk on the midline. x forward.

const A_X0 = -15
const A_X1 = 12.5
const ax = (x: number) => (x - A_X0) / (A_X1 - A_X0)
const as = (x: number, w: number, up: number, dn: number, n = 2.2): Section => ({ at: ax(x), w, up, dn, n, nb: 2.4 })

/** Length of trunk flap i (0 at the front): widest at the third to fifth, small at the tail. */
const flapLen = (i: number) => 3.9 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow((i + 2.3) / 16.2, 0.72))), 1.25)
const flap = (name: string, x: number, L: number, row: number): PartSpec => {
  const c = 0.3 * L + 0.62
  return {
    name, at: ax(x), around: 104, mirror: true, sink: 0.25, path: [[-0.14 * L, -0.05 * L, 0.54 * L], [-0.42 * L, -0.13 * L, L]], up: [-0.3, 1, 0.08],
    sect: [{ at: 0, w: c * 0.72, up: 0.16, n: 2.4 }, { at: 0.4, w: c, up: 0.1, n: 2.4 }, { at: 0.8, w: c * 0.74, up: 0.06 }, { at: 1, w: c * 0.34, up: 0.04 }],
    rings: 9, sides: 10, cap: "round", fillet: 0.3, bones: 2, role: "flap", row, thin: 0.85, mat: MAT.membrane,
  }
}
const endite = (k: number, around: number): PartSpec => {
  const L = (k % 2 ? 0.8 : 1.6) * (1 - k / 24)
  return {
    name: `endite${k}_${around}`, on: "app", at: (k + 0.5) / 14, around, mirror: true, sink: 0.03, frame: "surface", path: [[0.15 * L, 0.6 * L, 0], [0.42 * L, L, 0]],
    sect: [{ at: 0, w: 0.1, up: 0.1 }, { at: 1, w: 0.014, up: 0.014 }], rings: 4, sides: 5, cap: "point", fillet: 0.05, mat: MAT.horn, minDetail: k % 2 ? 0.9 : 0.4,
  }
}

export const anomalocaris: CreatureSpec = {
  name: "anomalocaris",
  body: {
    spine: [[-15, 0.5, 0], [-12, 0.25, 0], [-6, 0, 0], [0, 0, 0], [5, 0.15, 0], [9, 0.3, 0], [12.5, 0.05, 0]],
    sect: [
      as(-15, 0.25, 0.2, 0.2), as(-13.2, 0.75, 0.55, 0.5), as(-9, 1.55, 0.95, 0.85), as(-4, 2.3, 1.3, 1.15), as(0.5, 2.7, 1.5, 1.3),
      as(3.6, 2.35, 1.45, 1.25), as(5.4, 1.75, 1.25, 1.1), as(7, 2.05, 1.5, 1.25), as(9, 2.3, 1.6, 1.3, 2.6), as(11.3, 1.75, 1.2, 1.0, 2.4), as(12.5, 0.9, 0.65, 0.6),
    ],
    rings: 96, sides: 28, bones: 11, caps: ["round", "round"], mat: MAT.shell,
    segments: { from: ax(-13.6), to: ax(4.2), count: 13, depth: 0.075 },
  },
  parts: [
    // head shield (the H-element): an oval sclerite with a rim, saddling the top of the head
    { name: "shield", origin: [6.5, 1.52, 0], path: [[2.4, 0.3, 0], [4.9, -0.12, 0]], sect: [{ at: 0, w: 0.9, up: 0.16, bow: 0.25 }, { at: 0.45, w: 1.85, up: 0.2, bow: 0.4, n: 2.4 }, { at: 1, w: 1.0, up: 0.13, bow: 0.3 }], rings: 10, sides: 16, cap: "round", fillet: 0, mat: MAT.shell },
    // the two lateral P-elements
    { name: "pEl", origin: [6.7, 0.25, 2.0], mirror: true, path: [[1.6, 0.05, 0.3], [3.3, -0.1, 0.05]], up: [0, 0.15, 1], sect: [{ at: 0, w: 0.5, up: 0.12, bow: 0.2 }, { at: 0.5, w: 0.95, up: 0.15, bow: 0.3 }, { at: 1, w: 0.5, up: 0.1, bow: 0.2 }], rings: 8, sides: 12, cap: "round", fillet: 0, mat: MAT.shell, minDetail: 0.4 },
    // oral cone: a ring of plates round the mouth, under the head
    { name: "mouth", origin: [8.4, -0.95, 0], path: [[0, -0.55, 0]], up: [1, 0, 0], sect: [{ at: 0, w: 1.25, up: 1.25 }, { at: 0.7, w: 1.1, up: 1.1 }, { at: 1, w: 0.55, up: 0.55 }], rings: 5, sides: 16, cap: "flat", fillet: 0.25, mat: MAT.mouth, minDetail: 0.4, segments: { count: 2, depth: 0.12 } },
    // stalked eyes
    { name: "stalk", origin: [8.7, 0.95, 1.7], mirror: true, path: [[0.15, 0.75, 0.9], [0.25, 1.15, 1.75]], sect: [{ at: 0, w: 0.48, up: 0.48 }, { at: 1, w: 0.36, up: 0.36 }], rings: 6, sides: 9, cap: "round", fillet: 0.3, bones: 1, role: "stalk", mat: MAT.shell },
    { name: "eye", on: "stalk", origin: [8.92, 2.0, 3.3], mirror: true, path: [[0.05, 0.22, 0.55], [0.08, 0.36, 1.05]], sect: [{ at: 0, w: 0.42, up: 0.42 }, { at: 0.45, w: 0.98, up: 0.92 }, { at: 1, w: 0.8, up: 0.76 }], rings: 8, sides: 14, cap: "round", fillet: 0, mat: MAT.eye },
    // the frontal appendages: 14 podomeres, taller than wide, curled down and under
    {
      name: "app", origin: [10.7, -0.5, 0.82], mirror: true, path: [[2.0, 0.4, 0.1], [4.4, 0.1, 0.16], [6.3, -1.2, 0.12], [7.0, -3.1, 0], [6.3, -4.7, -0.1], [4.9, -5.2, -0.12], [3.9, -4.6, -0.12]], up: [0, 1, 0],
      sect: [{ at: 0, w: 0.5, up: 0.72 }, { at: 0.5, w: 0.36, up: 0.52 }, { at: 0.85, w: 0.2, up: 0.28 }, { at: 1, w: 0.07, up: 0.09 }], rings: 44, sides: 10, cap: "point", fillet: 0.35, bones: 7, role: "app", mat: MAT.shell, segments: { count: 14, depth: 0.1 },
    },
    // endites: a pair of ventral spines on each of thirteen podomeres, long and short alternating
    ...Array.from({ length: 13 }, (_, k) => [endite(k + 1, 162), endite(k + 1, -162)]).flat(),
    // three small neck flaps, then thirteen trunk flaps, front to back
    ...[0, 1, 2].map((i) => flap("neck" + i, 6.4 - i * 0.85, 1.25 + i * 0.25, i - 3)),
    ...Array.from({ length: 13 }, (_, i) => flap("flap" + i, 3.5 - i * 1.37, flapLen(i), i)),
    // tail fan: three pairs of blades swept up and back, and the terminal piece
    ...[0, 1, 2].map((i): PartSpec => {
      const L = 4.6 - i * 0.9
      return {
        name: "fan" + i, at: ax(-13.3 - i * 0.62), around: 62, mirror: true, sink: 0.12, path: [[-0.3 * L, 0.42 * L, 0.26 * L], [-0.72 * L, 0.86 * L, 0.46 * L]], up: [0.5, 0.2, -0.8],
        sect: [{ at: 0, w: 0.5, up: 0.11 }, { at: 0.45, w: 0.78, up: 0.07 }, { at: 1, w: 0.22, up: 0.04 }], rings: 8, sides: 8, cap: "round", fillet: 0.2, bones: 1, role: "fan", row: i, thin: 0.8, mat: MAT.membrane,
      }
    }),
    { name: "tailpiece", at: 0.012, around: 0, path: [[-1.3, 0.1, 0], [-2.3, 0.05, 0]], up: [0, 1, 0], sect: [{ at: 0, w: 0.32, up: 0.12 }, { at: 0.6, w: 0.42, up: 0.06 }, { at: 1, w: 0.12, up: 0.03 }], rings: 6, sides: 8, cap: "round", fillet: 0.1, thin: 0.6, mat: MAT.membrane, minDetail: 0.4 },
  ],
  // setal blades: rows of lanceolate blades across the back of each trunk segment
  cards: [{ from: ax(-12.8), to: ax(3.8), arc: [14, 80], count: 13 * 2 * 15, rows: 13, len: 1.0, w: 0.13, lift: 0.08, jitter: 0.12, seed: 3 }],
  // a stiff head, a trunk that flexes a little in the vertical plane, more toward the tail
  swim: { wavelength: 1.25, stride: 15, plane: "vertical", amp: [[0, 0.75], [0.25, 0.42], [0.6, 0.12], [0.75, 0.02], [1, 0]], bank: 6 },
  motions: [
    // the metachronal wave: every flap beats once per cycle, each a little later than the one ahead, and its tip later still
    { role: "flap", axis: "side", amp: 0.3, ampK: 0.22, lag: 0.115, tipLag: 0.13 },
    { role: "fan", axis: "side", amp: 0.07, lag: 0.1, offset: 2.2 },
    { role: "app", axis: "side", amp: 0.035, tipLag: 0.07, rate: 0.5 },
    { role: "app", axis: "side", biasK: 0.035, bias: 0.05, channel: "grasp" },
    { role: "stalk", axis: "tan", amp: 0.07, rate: 0.37, clock: "time" },
  ],
}

export const anomalocarisLook: Look = {
  base: 0x8a3b22, belly: 0xa9795a, accent: 0x4a1c12, shell: 0x7a2f1c, horn: 0x5e2a1a, hornTip: 0x1d0d08, eye: 0x1c2a2a, compoundEye: true,
  cell: 0.22, relief: 0.03, cellVary: 0.18, blotch: 0.45, blotchSize: 2.2, bands: [ax(-13.6), ax(4.2), 13], rough: 0.4, spec: 0.38, coat: 0.28, wrap: 0.16, rim: 0.28,
}

// ---------------------------------------------------------------- A human right forearm and hand, gripping a stone (metres)
//
// THE WORKED PATTERN for hands. The forearm is the "body" (elbow at the origin, +x toward the
// fingers, palm down, so the thumb is on -z); the palm is a one-bone part (the wrist), the five
// digits are jointed chains on it, and the grip is a held pose solved once by `solveGrip`.
//
// Fetched 2026-11-27 (R/f/creatures/refs.md): ANSUR II (Gordon et al. 2014) male means: elbow to
// wrist 26.8 cm, hand length 19.3 cm, palm length 11.65 cm, hand breadth 8.8 cm, wrist
// circumference 17.6 cm, forearm circumference 31 cm. Rogers et al. 2008 (CDC): wrist breadth
// 59 mm, index PIP joint 19.4 mm wide and 17.8 deep, DIP 17.0 by 14.0, little finger about 0.85 of
// that; ranges of flexion MCP 85 to 90 degrees, PIP 100 to 115, DIP 80 to 90, thumb MCP 50 to 55 and IP 85 to
// 90, wrist 70 to 90 either way. From memory, NOT fetched: phalanx lengths after Buryanov and
// Kotiuk 2010 (index 40 / 22 / 16 mm, middle 45 / 26 / 17, ring 41 / 26 / 17, little 33 / 18 / 16,
// thumb metacarpal 46, phalanges 32 / 22).
//
// A scene poses it with `makeAim` (the elbow's place and the forearm's direction, each frame),
// `drive.roll` (pronation), and `drive.ch.grip` (0 open, 1 closed on the stone). The stone here is
// a rigid part on the palm so the example is whole; a scene with its own prop leaves it out and
// places the prop from `rig.bone("palm.0")` in `HerdOpts.after`.

const ARM = loft([
  { x: 0, top: 0.043, bot: -0.045, hw: 0.04 },
  { x: 0.055, top: 0.049, bot: -0.051, hw: 0.049 },
  { x: 0.13, top: 0.039, bot: -0.041, hw: 0.041 },
  { x: 0.2, top: 0.026, bot: -0.027, hw: 0.033, n: 2.3 },
  { x: 0.262, top: 0.02, bot: -0.021, hw: 0.0295, n: 2.5 },
])
/** A finger's joints from its knuckle: three phalanges with the slight curl and fan of a hand at rest. */
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
/** The held stone: a fist-sized cobble under the palm. */
const STONE: GripShape & { kind: "ellipsoid" } = { kind: "ellipsoid", c: [0.345, -0.05, -0.006], r: [0.046, 0.033, 0.04] }

const handBase: CreatureSpec = {
  name: "hand",
  body: {
    spine: ARM.spine, sect: ARM.sect, rings: 30, sides: 24, bones: [0, 0.5, 1], caps: ["round", "round"],
    bulges: [
      muscle(0.22, -70, 0.006, 0.2, 60, false), // brachioradialis, thumb side
      muscle(0.25, 150, 0.005, 0.22, 50, false), // the flexors' belly
      muscle(0.96, 62, 0.0045, 0.05, 28, false), // the head of the ulna at the wrist
      muscle(0.8, 180, -0.0025, 0.16, 24, false), // the hollow between the wrist's tendons
    ],
  },
  parts: [
    {
      name: "palm", origin: [0.244, 0, 0], path: [[0.05, -0.002, 0], [0.098, -0.003, 0], [0.121, -0.003, 0]], up: [0, 1, 0],
      sect: [{ at: 0, w: 0.025, up: 0.016, dn: 0.017, n: 2.3 }, { at: 0.16, w: 0.0305, up: 0.018, dn: 0.02, n: 2.3 }, { at: 0.42, w: 0.04, up: 0.0145, dn: 0.02, n: 2.4 }, { at: 0.82, w: 0.0445, up: 0.0125, dn: 0.016, n: 2.5 }, { at: 1, w: 0.0425, up: 0.0105, dn: 0.012, n: 2.5 }],
      rings: 20, sides: 26, cap: "round", fillet: 0, bones: 1, role: "palm", // end to end with the forearm: no flare, the crease at the wrist is the junction
      bulges: [
        muscle(0.3, -128, 0.011, 0.3, 52), // thenar: the ball of the thumb
        muscle(0.36, 128, 0.007, 0.32, 46), // hypothenar
        muscle(0.85, 180, 0.004, 0.14, 70), // the pads under the knuckles
        muscle(0.97, -41, 0.0042, 0.09, 13), muscle(0.99, -13, 0.0046, 0.09, 13), muscle(0.97, 13, 0.0042, 0.09, 13), muscle(0.94, 40, 0.0036, 0.09, 13), // the four knuckles
        muscle(0.6, -27, -0.002, 0.3, 9), muscle(0.6, 0, -0.002, 0.3, 9), muscle(0.6, 27, -0.002, 0.3, 9), // between the metacarpals
      ],
    },
    ...digit({ name: "thumb", on: "palm", joints: [[0.283, -0.008, -0.029], [0.318, -0.02, -0.058], [0.348, -0.03, -0.078], [0.374, -0.037, -0.092]], r0: 0.0118, r1: 0.0098, up: [-0.3, 0.62, -0.72], row: 0, fillet: 0.01 }),
    ...digit({ name: "index", on: "palm", joints: finger([0.362, 0, -0.031], [0.04, 0.024, 0.021], -0.07), r0: 0.0094, r1: 0.0076, up: [0, 1, 0], row: 1 }),
    ...digit({ name: "middle", on: "palm", joints: finger([0.367, 0.001, -0.0105], [0.045, 0.027, 0.023], -0.015), r0: 0.0096, r1: 0.0078, up: [0, 1, 0], row: 2 }),
    ...digit({ name: "ring", on: "palm", joints: finger([0.362, 0, 0.0105], [0.041, 0.026, 0.022], 0.04), r0: 0.009, r1: 0.0073, up: [0, 1, 0], row: 3 }),
    ...digit({ name: "little", on: "palm", joints: finger([0.352, -0.002, 0.03], [0.033, 0.019, 0.02], 0.1), r0: 0.008, r1: 0.0065, up: [0, 1, 0], row: 4 }),
    {
      name: "stone", on: "palm", origin: [STONE.c[0] - STONE.r[0], STONE.c[1], STONE.c[2]], path: [[STONE.r[0], 0, 0], [STONE.r[0] * 2, 0, 0]], up: [0, 1, 0],
      sect: [{ at: 0, w: 0.01, up: 0.008 }, { at: 0.1, w: 0.024, up: 0.02, n: 2.2 }, { at: 0.3, w: 0.036, up: 0.03, n: 2.3 }, { at: 0.52, w: 0.04, up: 0.033, n: 2.4 }, { at: 0.75, w: 0.036, up: 0.03, n: 2.3 }, { at: 0.92, w: 0.022, up: 0.019 }, { at: 1, w: 0.01, up: 0.008 }],
      rings: 16, sides: 18, cap0: "round", cap: "round", fillet: 0, mat: MAT.prop,
      bulges: [muscle(0.3, 40, -0.004, 0.25, 50, false), muscle(0.65, -110, -0.005, 0.3, 60, false), muscle(0.55, 150, 0.003, 0.3, 40, false), muscle(0.4, -30, 0.003, 0.2, 40, false)],
    },
  ],
}

/** The hand with its grip solved: `ch.grip` 1 closes the digits on the stone and cocks the wrist back a little. */
export const hand: CreatureSpec = {
  ...handBase,
  poses: {
    grip: {
      ...solveGrip(handBase, STONE, { maxOf: { thumb: [0.55, 0.9, 1.3] }, slack: 0.5 }),
      palm: [[-0.28, 0.06, 0]],
    },
  },
}

export const handLook: Look = {
  base: 0x8e5e42, belly: 0xb98468, horn: 0xa07866, hornTip: 0xc4a898, prop: 0x55524c, eye: 0x000000,
  cell: 0.0022, relief: 0.00012, cellVary: 0.05, blotch: 0.12, blotchSize: 0.05, mottle: 0.14,
  fold: 0.7, foldSize: 0.006, foldFlex: 4, foldBase: 0.12, occlude: 0, rough: 0.62, spec: 0.22, wrap: 0.5, rim: 0.3, bleed: 0x8a2a1a,
}

/** The human figure (human.ts): `examples.human.makeHuman`, `humanLook`, the pose catalogue. Also importable directly from "../engine/creature/human". */
export * as human from "./human"
