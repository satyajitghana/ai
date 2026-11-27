// Scene 10, cambrian: "Bodies you can see."
//
// Idea. A naturalist's plate that draws itself: one animal slowly, then a page of them at once,
// and one of them walks off the paper.
//
// Staging. A sheet of laid paper (chain lines 25 mm apart, laid lines between, deckle edge, plate
// mark, foxing, show-through) on a walnut desk under one warm lamp, seen from above with a slight
// tilt. A brass loupe on three legs whose glass really magnifies (a second camera draws the page
// under it), an ink bottle, a dip pen, a rocker blotter. 1 unit = 10 cm.
//
// Story parameter. `ink`, the length of line drawn so far. Every drawing is a list of strokes
// (polylines with pressure); every stroke segment carries the moment the nib reaches it, as beat
// and seconds, which is its ink threshold through the monotone table `inkAt`. Nothing is
// accumulated: a frame is the stroke table evaluated at the beat clock.
//
// World rule. One lamp (`lampLit`) lights paper, wood, brass and glass, and one function
// (`inkOn`) says what ink does on a surface: the nib leaves a wet, raised, glossy, blue-black line
// with a glint at its head; it sinks into the tooth, feathers along the laid furrows, dries matt
// and purplish black and ages to brown-black. The strokes are instanced capsules drawn in screen
// space into an ink layer with max blending (coverage, wetness, youth, glint), never thinner than
// a pixel and a half; the sheet reads that layer in its own light. JS twin: `walkAt`.

import * as THREE from "three/webgpu"
import { mod, abs, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, dFdx, dFdy, Discard, dot, exp, float, floor, Fn, fract, If, length, max, min, mix as mixN, modelWorldMatrix, normalGeometry, normalize, positionGeometry, pow, reflect, screenUV, select, sin, smoothstep, sqrt, step, texture, uniform, uniformArray, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { MAT, makeDrive, makeHerd, makePath, underwaterMaterial, type CreatureSpec, type Drive, type Herd, type Lights, type LodSpec, type Look, type PartSpec, type Path, type Section, type SkinNodes, type Water } from "../engine/creature"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, L0, luma, sampleRT, sat, smoothstepRev, TAU, vnoise, voronoi, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, Portal, PostOpts, SceneInstance, State } from "../engine/types"
import { THAW_HIT } from "../transitions/thaw"

// ---------------------------------------------------------------- layout (sheet coordinates: u right, v up; world x = u, z = -v)

const HW = 1.8, HH = 1.05 // half the sheet
const PM = 0.13 // plate mark inset
const CHAIN = 0.25 // chain lines: 25 mm apart, parallel to the short side
const LAID = 1 / 90 // laid lines: about 9 to the centimetre
const W0 = 0.005 // a nib line: 0.42 mm
const LAMP = /*@__PURE__*/ new THREE.Vector3(-4.4, 3.0, -3.4)
const LOUPE_R = 0.25, LOUPE_Y = 0.2, LOUPE_M = 2.5
const LOUPE_REST: P2 = [1.78, -0.66]
const LOUPE_SET: P2 = [1.4, 0.47]
const BOTTLE: P2 = [2.12, 1.44]
const BLOT_R = 0.085
// where the last bead of `thaw` lands, in the sheet: the first stroke is pulled out of it
const F0: P2 = [-0.031, 0.007]
// the three beats' lengths, to place cues late in a beat
const WALK0 = 3.9 // seconds of beat 3 at which the small one starts to walk
const WALK_V = 0.5, WALK_A = 0.5
const BEZ: P2[] = [[0.46, 0.5], [0.95, 0.62], [1.35, 0.34], [2.9, 0.52]]
const WS = 1.3 // the small one's size (its frame is in units of 10 cm)
const S_REST = 0.14 // where along the path the animal's middle is drawn

type P2 = [number, number]
type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
/** smoothstep with node edges that may fall, spelled out so WGSL defines it. */
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}

// ---------------------------------------------------------------- the path of the one that leaves (JS twin of `walkXf`)

const bez = (t: number, o: P2) => {
  const a = 1 - t
  o[0] = a * a * a * BEZ[0][0] + 3 * a * a * t * BEZ[1][0] + 3 * a * t * t * BEZ[2][0] + t * t * t * BEZ[3][0]
  o[1] = a * a * a * BEZ[0][1] + 3 * a * a * t * BEZ[1][1] + 3 * a * t * t * BEZ[2][1] + t * t * t * BEZ[3][1]
  return o
}
const bezD = (t: number, o: P2) => {
  const a = 1 - t
  o[0] = 3 * a * a * (BEZ[1][0] - BEZ[0][0]) + 6 * a * t * (BEZ[2][0] - BEZ[1][0]) + 3 * t * t * (BEZ[3][0] - BEZ[2][0])
  o[1] = 3 * a * a * (BEZ[1][1] - BEZ[0][1]) + 6 * a * t * (BEZ[2][1] - BEZ[1][1]) + 3 * t * t * (BEZ[3][1] - BEZ[2][1])
  return o
}
const BEZ_LEN = /*@__PURE__*/ (() => {
  let l = 0
  const a: P2 = [0, 0], b: P2 = [0, 0]
  bez(0, a)
  for (let i = 1; i <= 64; i++) {
    bez(i / 64, b)
    l += Math.hypot(b[0] - a[0], b[1] - a[1])
    a[0] = b[0]
    a[1] = b[1]
  }
  return l
})()
/** Distance walked, `tau` seconds after it sets off: a soft start, then a steady pace. */
const walked = (tau: number) => (tau <= 0 ? 0 : WALK_V * (tau - WALK_A * (1 - Math.exp(-tau / WALK_A))))
const _d: P2 = [0, 0]
/** Where a point of the animal (x along its body, y across) is after walking `u`. */
function walkAt(u: number, x: number, y: number, o: P2) {
  const t = clamp((u + S_REST + x) / BEZ_LEN, 0, 1.3)
  bez(t, o)
  bezD(t, _d)
  const l = Math.hypot(_d[0], _d[1]) || 1
  o[0] += (-_d[1] / l) * y
  o[1] += (_d[0] / l) * y
  return o
}

// ---------------------------------------------------------------- beat 4, the living sea: the ground, the clock, the cast
//
// One world. The sheet lies on y = 0 and the sea is under it (1 unit = 10 cm): pale carbonate mud
// at about y = -16 with a sponge knoll and reef mounds to the north. JS twins of the TSL: `floorY`.

const SEA_Y = -16
/** Reef mounds and the sponge knoll: x, z, height, radius along x, radius along z. */
const MOUNDS: [number, number, number, number, number][] = [
  [-1.15, -1.55, 0.5, 1.0, 0.8],
  [-6.5, -7.0, 2.7, 4.6, 3.6],
  [3.2, -9.5, 3.3, 6.2, 3.8],
  [8.8, -3.5, 1.7, 3.2, 3.6],
  [-8.5, 0.5, 1.3, 2.6, 4.2],
  [1.5, 7.5, 0.9, 5, 2.4],
]
const moundAt = (x: number, z: number) => {
  let h = 0
  for (const m of MOUNDS) {
    const dx = (x - m[0]) / m[3], dz = (z - m[1]) / m[4]
    h += m[2] * Math.exp(-(dx * dx + dz * dz))
  }
  return h
}
const floorY = (x: number, z: number) => SEA_Y + 0.2 * Math.sin(0.31 * x + 1.3) * Math.sin(0.27 * z + 0.4) + 0.05 * Math.sin(0.9 * x + 0.5 * z) + moundAt(x, z)

// the beat's clock, in seconds of beat 4
const T_SOAK = 2.4 // the wet front has crossed the sheet
const T_IN = 2.9 // the lens passes the surface going down
const T_OUT = 12.9 // and coming up
const T_HOME = 13.7 // every animal is back in its place on the plate
const T_DRY = 15.8
const SOAK_R = 3.7 // how far the front has to run from the trackway to cover the sheet
/** The trackway the small one left, as a polyline in the sheet (where the water comes up). */
const TRK: P2[] = /*@__PURE__*/ (() => {
  const o: P2[] = []
  for (let i = 0; i <= 6; i++) {
    const p: P2 = [0, 0]
    bez((i / 6) * 0.66, p)
    o.push([Math.min(p[0], HW), p[1]])
  }
  return o
})()
const segD = (x: number, y: number, a: P2, b: P2) => {
  const bx = b[0] - a[0], by = b[1] - a[1]
  const h = clamp(((x - a[0]) * bx + (y - a[1]) * by) / (bx * bx + by * by))
  return Math.hypot(x - a[0] - bx * h, y - a[1] - by * h)
}
const trackD = (x: number, y: number) => {
  let d = 9
  for (let i = 0; i < TRK.length - 1; i++) d = Math.min(d, segD(x, y, TRK[i], TRK[i + 1]))
  return d
}
/** A trapezoid of speed: 0 before t0, 1 after t1, constant speed between ramps `r` long. */
const trap = (t: number, t0: number, t1: number, r: number) => {
  const x = clamp((t - t0) / (t1 - t0)), a = r / (t1 - t0)
  const v = 1 / (1 - a)
  return x < a ? (v * x * x) / (2 * a) : x > 1 - a ? 1 - (v * (1 - x) * (1 - x)) / (2 * a) : v * (x - a / 2)
}

/** One animal of the cast: its spec, how it is shaded, and its size. */
type Zoo = { spec: CreatureSpec; look: Look; surface: "skin" | "chitin" | "scales" | "feathers"; /** body length in model units */ len: number }
/** The source every label on the plate's animals carries (their pages are the beat's `src`). */
const LAB_SRC_TEXT = "Burgess Shale, ROM"
type Key = "olenoides" | "marrella" | "anomalocaris" | "opabinia" | "hallucigenia" | "wiwaxia" | "pikaia" | "vauxia" | "dinomischus" | "chancelloria"
// @@ZOO-PLACEHOLDER
// Olenoides serratus (centimetres). A trilobite of the Burgess Shale: a walker.
// References and what was taken from each: olenoides.md. Colour is invented.
// Origin: on the ground under mid-body. +x the head, +y up, +z the animal's right.

const OLE_X0 = -4.0, OLE_X1 = 4.0 // 8 cm of exoskeleton: cephalon, thorax and pygidium about equal
const OLE_Y = 1.02 // height of the centre line when standing
const OLE_at = (x: number) => (x - OLE_X0) / (OLE_X1 - OLE_X0)
const OLE_TH0 = 1.35, OLE_TH1 = -1.35 // the thorax: seven segments between these
/** Half-width of the shield at x (top-view outline: broadly oval, semicircular ends). */
const OLE_W: [number, number][] = [[-4.0, 0.2], [-3.75, 1.25], [-3.2, 2.0], [-2.4, 2.5], [-1.35, 2.6], [0, 2.7], [1.2, 2.72], [1.5, 2.9], [2.2, 2.74], [3.0, 2.2], [3.6, 1.45], [3.9, 0.75], [4.0, 0.2]]
const OLE_w = (x: number) => {
  for (let i = 1; i < OLE_W.length; i++)
    if (x <= OLE_W[i][0]) {
      const [x0, w0] = OLE_W[i - 1], [x1, w1] = OLE_W[i]
      return w0 + ((w1 - w0) * (x - x0)) / (x1 - x0)
    }
  return 0.2
}
// the axial lobe (glabella on the head, the rings behind it) is a ridge on a low, bowed shield
const OLE_s = (x: number, up: number, ridge: [number, number], bow = 0.2, dn = 0.14): Section => ({ at: OLE_at(x), w: OLE_w(x), up, dn, n: 2.6, nb: 2.6, bow, ridge })

/** One walking leg (the inner branch): coxa under the axis, six podomeres tapering, out and down to the mud. */
const OLE_leg = (name: string, x: number, k: number, sweep: number): PartSpec => {
  const reach = OLE_w(x) * 1.1 * k
  const hipZ = 0.5, hipY = 0.68
  const dz = reach - hipZ
  return {
    name, origin: [x, hipY, hipZ], mirror: true, jointed: true,
    path: [[sweep * 0.3, 0.1, dz * 0.5], [sweep * 0.8, -0.3, dz * 0.82], [sweep, -hipY, dz]],
    up: [1, 0, 0],
    sect: [{ at: 0, w: 0.2, up: 0.2 }, { at: 0.3, w: 0.15, up: 0.14 }, { at: 0.75, w: 0.085, up: 0.085 }, { at: 1, w: 0.03, up: 0.03 }],
    rings: 10, sides: 6, cap: "point", fillet: 0.1, bones: "joints", role: "leg", limits: [0.05, 2.4], segments: { count: 6, depth: 0.14 }, mat: MAT.shell,
  }
}
/** A pleural or marginal spine, on the shield's edge. */
const OLE_spine = (name: string, x: number, len: number, out: number, minDetail = 0): PartSpec => ({
  name, at: OLE_at(x), around: 90, mirror: true, sink: 0.1,
  path: [[-len * 0.5, -0.03, out * 0.6], [-len, -0.06, out]],
  sect: [{ at: 0, w: 0.17, up: 0.07 }, { at: 0.5, w: 0.085, up: 0.05 }, { at: 1, w: 0.012, up: 0.012 }],
  rings: 5, sides: 6, cap: "point", fillet: 0.1, mat: MAT.shell, minDetail,
})
const OLE_feeler = (name: string, origin: [number, number, number], path: [number, number, number][], w: number, role: string, bones: number): PartSpec => ({
  name, origin, mirror: true, path,
  sect: [{ at: 0, w, up: w }, { at: 0.5, w: w * 0.55, up: w * 0.55 }, { at: 1, w: w * 0.14, up: w * 0.14 }],
  rings: 30, sides: 5, cap: "point", fillet: 0.05, bones, role, segments: { count: 44, depth: 0.12 }, mat: MAT.shell,
})

const OLE_SEG = (OLE_TH0 - OLE_TH1) / 7
const OLE_spec: CreatureSpec = {
  name: "olenoides",
  body: {
    spine: [[-4.0, OLE_Y - 0.25, 0], [-3.0, OLE_Y - 0.06, 0], [-1.35, OLE_Y, 0], [0, OLE_Y + 0.03, 0], [1.35, OLE_Y + 0.03, 0], [2.8, OLE_Y, 0], [4.0, OLE_Y - 0.3, 0]],
    sect: [
      OLE_s(-4.0, 0.06, [0.02, 0.2], 0.03, 0.05), OLE_s(-3.75, 0.14, [0.1, 0.24], 0.06), OLE_s(-3.2, 0.2, [0.2, 0.28], 0.08), OLE_s(-2.4, 0.25, [0.27, 0.33], 0.1), OLE_s(-1.35, 0.3, [0.32, 0.38], 0.12),
      OLE_s(0, 0.32, [0.34, 0.4], 0.13), OLE_s(1.3, 0.32, [0.34, 0.42], 0.13),
      // the head shield: gently vaulted; the glabella is its own part
      OLE_s(1.7, 0.36, [0.1, 0.5], 0.13), OLE_s(2.4, 0.38, [0, 0.5], 0.12), OLE_s(3.1, 0.32, [0, 0.5], 0.09), OLE_s(3.6, 0.2, [0, 0.4], 0.05, 0.1), OLE_s(3.88, 0.11, [0, 0.3], 0.02, 0.07), OLE_s(4.0, 0.05, [0, 0.2], 0.01, 0.04),
    ],
    rings: 104, sides: 60, caps: ["round", "round"], mat: MAT.shell,
    // rigid head, seven articulating thoracic segments, rigid tail shield
    bones: [0, OLE_at(-1.35), OLE_at(-0.45), OLE_at(0.45), OLE_at(1.35), 1],
    // seven thoracic segments and six pygidial rings: thirteen furrows
    segments: { from: OLE_at(-3.7), to: OLE_at(OLE_TH0), count: 13, depth: 0.09 },
  },
  parts: [
    // the glabella: parallel-sided, rounded in front, almost to the anterior border; three pairs of furrows and the occipital ring
    {
      name: "glabella", origin: [1.36, OLE_Y + 0.26, 0], path: [[0.8, 0.05, 0], [1.6, 0.02, 0], [2.2, -0.12, 0]], up: [0, 1, 0],
      sect: [{ at: 0, w: 0.66, up: 0.24, dn: 0.2, n: 2.8 }, { at: 0.5, w: 0.68, up: 0.26, dn: 0.2, n: 2.8 }, { at: 0.88, w: 0.66, up: 0.22, dn: 0.2, n: 2.6 }, { at: 1, w: 0.5, up: 0.12, dn: 0.1, n: 2.4 }],
      rings: 22, sides: 18, cap: "round", fillet: 0, mat: MAT.horn, segments: { count: 4, depth: 0.07 },
    },
    // eyes: small outward-bowed crescents on the cheeks, at the end of the eye ridges
    {
      name: "eye", origin: [2.02, OLE_Y + 0.3, 1.3], mirror: true, path: [[0.2, 0.04, 0.12], [0.42, 0.04, 0.13], [0.62, 0, 0.02]],
      sect: [{ at: 0, w: 0.04, up: 0.05 }, { at: 0.5, w: 0.07, up: 0.1 }, { at: 1, w: 0.035, up: 0.05 }], rings: 8, sides: 8, cap: "round", cap0: "round", fillet: 0, mat: MAT.eye,
    },
    // genal spines: straight and slender, back to the third pleura
    {
      name: "genal", at: OLE_at(1.5), around: 90, mirror: true, sink: 0.12, path: [[-0.6, -0.03, 0.2], [-1.5, -0.06, 0.34]],
      sect: [{ at: 0, w: 0.24, up: 0.08 }, { at: 0.35, w: 0.12, up: 0.06 }, { at: 1, w: 0.012, up: 0.012 }], rings: 7, sides: 6, cap: "point", fillet: 0.14, mat: MAT.shell,
    },
    // seven pairs of needle-like pleural spines
    ...Array.from({ length: 7 }, (_, i) => OLE_spine("pleura" + i, OLE_TH0 - (i + 0.72) * OLE_SEG, 0.5 + i * 0.03, 0.2)),
    // five pairs of marginal spines on the pygidium, pointing rearward
    ...[-1.75, -2.3, -2.85, -3.35, -3.72].map((x, i) => OLE_spine("pyg" + i, x, 0.62 - i * 0.05, 0.14 - i * 0.045)),
    // antennae: flexible, of forty to fifty short joints, forward and curving back along the sides
    OLE_feeler("antenna", [3.3, 0.72, 0.45], [[0.9, 0.05, 0.5], [2.0, 0.2, 1.5], [2.7, 0.3, 2.9], [2.8, 0.28, 4.4], [2.3, 0.2, 5.6]], 0.085, "antenna", 5),
    // cerci: the same shape, from under the last pygidial segment
    OLE_feeler("cercus", [-3.5, 0.62, 0.3], [[-0.9, 0.04, 0.25], [-2.0, 0.12, 0.8], [-3.0, 0.16, 1.6], [-3.7, 0.14, 2.5]], 0.065, "cercus", 3),
    // walking legs: three pairs under the head, seven under the thorax, four under the tail (four to six are known)
    ...[2.75, 2.25, 1.75].map((x, i) => OLE_leg("legC" + i, x, 0.86 + i * 0.05, 0.22 - i * 0.06)),
    ...Array.from({ length: 7 }, (_, i) => OLE_leg("legT" + i, OLE_TH0 - (i + 0.5) * OLE_SEG, 1, 0.04 - i * 0.02)),
    ...[-1.62, -2.1, -2.55, -2.95].map((x, i) => OLE_leg("legP" + i, x, 0.97 - i * 0.07, -0.14 - i * 0.06)),
  ],
  // the gill branches: flat filaments sweeping back under the pleurae, seen along the shield's edge
  cards: [{ from: OLE_at(-3.0), to: OLE_at(2.6), arc: [98, 108], count: 14 * 2 * 6, rows: 14, len: 0.45, w: 0.06, lift: 0.5, jitter: 0.1, seed: 5 }],
  gait: { gait: "metachronal", stride: 0.9, duty: 0.6, lift: 0.22, lag: 0.085, bob: 0.008, shift: 0.01, roll: 0.006, girdle: 0.012, tail: [0.05, 0.2], head: [0.03, 0.1], tailAt: OLE_at(-1.35), neckAt: OLE_at(1.35) },
  motions: [
    { role: "antenna", axis: "up", amp: 0.1, ampK: 0.03, rate: 0.45, tipLag: 0.16, clock: "time", alternate: true },
    { role: "antenna", axis: "side", amp: 0.05, rate: 0.31, tipLag: 0.12, clock: "time" },
    { role: "cercus", axis: "up", amp: 0.07, rate: 0.37, tipLag: 0.2, clock: "time", alternate: true },
  ],
}

const OLE_look: Look = {
  base: 0x5e3218, back: 0x2a150a, belly: 0xb89260, accent: 0x2e180c, shell: 0x7c4a20, horn: 0x7c4a20, hornTip: 0x6a3c1a, eye: 0x1a1410, compoundEye: true,
  cell: 0.05, relief: 0.005, cellVary: 0.14, blotch: 0.55, blotchSize: 0.9, mottle: 0.45, bands: [OLE_at(-3.7), OLE_at(OLE_TH0), 13],
  rough: 0.42, spec: 0.36, coat: 0.25, wrap: 0.14, rim: 0.24, occlude: 0.6,
}

// Marrella splendens (centimetres; the animal is about 2 cm long). The "lace crab" of the Burgess
// Shale: a small swimmer, drawn in numbers. References: marrella.md. Colour is invented.
// Origin: mid-body on the midline. +x the head.

const MAR_X0 = -1.25, MAR_X1 = 0.75
const MAR_at = (x: number) => (x - MAR_X0) / (MAR_X1 - MAR_X0)
const MAR_s = (x: number, w: number, up: number, dn = up, n = 2.2): Section => ({ at: MAR_at(x), w, up, dn, n })
const MAR_HEAD = 0.22 // the head shield ends here; 26 small segments behind it

/** A long head spine: a slender curved tube, rigid with the head shield. */
const MAR_spine = (name: string, origin: [number, number, number], path: [number, number, number][], w: number, up: [number, number, number]): PartSpec => ({
  name, origin, mirror: true, path, up,
  sect: [{ at: 0, w: w * 1.5, up: w }, { at: 0.25, w: w * 1.1, up: w * 0.8 }, { at: 0.7, w: w * 0.6, up: w * 0.5 }, { at: 1, w: w * 0.08, up: w * 0.08 }],
  rings: 16, sides: 6, cap: "point", fillet: w * 1.6, mat: MAT.horn,
})
/** One trunk limb pair, drawn as its gill branch: a thin feathery blade sweeping out and back, with the leg beneath it. */
const MAR_GILLS = 12
const MAR_gx = (i: number) => 0.12 - (i / (MAR_GILLS - 1)) * 1.18
const MAR_gill = (i: number): PartSpec => {
  const x = MAR_gx(i)
  const L = 0.5 * Math.pow(1 - i / (MAR_GILLS + 2.5), 1.25) + 0.06
  return {
    name: "gill" + i, at: MAR_at(x), around: 100, mirror: true, sink: 0.01, path: [[-0.22 * L, -0.1 * L, 0.6 * L], [-0.6 * L, -0.34 * L, L]], up: [0.25, 1, 0.1],
    sect: [{ at: 0, w: 0.03, up: 0.012 }, { at: 0.4, w: 0.055, up: 0.008 }, { at: 1, w: 0.02, up: 0.005 }],
    rings: 5, sides: 6, cap: "round", fillet: 0.02, bones: 1, role: "gill", row: i, thin: 0.9, mat: MAT.membrane,
  }
}
/** The walking branch under it: a thin jointed leg, rigid with the body (it trails while swimming). */
const MAR_leg = (i: number): PartSpec => {
  const x = MAR_gx(i) + 0.03
  const L = 0.34 * Math.pow(1 - i / (MAR_GILLS + 1.5), 1.4) + 0.04
  return {
    name: "leg" + i, at: MAR_at(x), around: 150, mirror: true, sink: 0.01, path: [[-0.1 * L, -0.5 * L, 0.3 * L], [-0.45 * L, -0.95 * L, 0.34 * L]],
    sect: [{ at: 0, w: 0.018, up: 0.018 }, { at: 1, w: 0.005, up: 0.005 }], rings: 4, sides: 4, cap: "point", fillet: 0.01, mat: MAT.shell, minDetail: 0.4,
  }
}

const MAR_spec: CreatureSpec = {
  name: "marrella",
  body: {
    spine: [[-1.25, -0.03, 0], [-0.8, 0, 0], [-0.3, 0.02, 0], [0.22, 0.03, 0], [0.5, 0.02, 0], [0.75, -0.04, 0]],
    sect: [
      MAR_s(-1.25, 0.012, 0.012), MAR_s(-1.0, 0.035, 0.03), MAR_s(-0.5, 0.075, 0.06), MAR_s(0, 0.115, 0.085), MAR_s(MAR_HEAD - 0.03, 0.13, 0.095),
      // the head shield: a wedge, widest and highest at its back edge, narrowing to the front
      MAR_s(MAR_HEAD + 0.03, 0.25, 0.16, 0.12, 2.6), MAR_s(0.42, 0.22, 0.15, 0.12, 2.6), MAR_s(0.62, 0.14, 0.1, 0.08, 2.4), MAR_s(0.75, 0.05, 0.04, 0.04),
    ],
    rings: 56, sides: 12, bones: 5, caps: ["point", "round"], mat: MAT.shell,
    segments: { from: MAR_at(-1.2), to: MAR_at(MAR_HEAD - 0.02), count: 26, depth: 0.12 },
  },
  parts: [
    // the lateral spines: from the sides of the shield, out, then back along most of the body
    MAR_spine("lateral", [0.36, 0.02, 0.2], [[-0.02, 0.04, 0.22], [-0.3, 0.1, 0.46], [-0.85, 0.14, 0.6], [-1.4, 0.12, 0.56], [-1.8, 0.06, 0.42]], 0.038, [0, 1, 0]),
    // the median pair: from the shield's dorsal hind margin, up and back over the body (its keel is serrated)
    MAR_spine("median", [0.3, 0.13, 0.09], [[-0.2, 0.1, 0.06], [-0.7, 0.2, 0.14], [-1.3, 0.23, 0.2], [-1.85, 0.17, 0.2]], 0.036, [0, 0, 1]),
    // the small posteroventral pair
    { name: "pv", origin: [0.3, -0.1, 0.16], mirror: true, path: [[-0.14, -0.08, 0.05], [-0.32, -0.1, 0.07]], sect: [{ at: 0, w: 0.03, up: 0.025 }, { at: 1, w: 0.004, up: 0.004 }], rings: 5, sides: 5, cap: "point", fillet: 0.03, mat: MAT.horn, minDetail: 0.4 },
    // antennae: long, thin, about thirty joints, 15 to 30 degrees off the midline
    {
      name: "antenna", origin: [0.6, -0.07, 0.07], mirror: true, path: [[0.4, -0.02, 0.14], [0.85, 0.02, 0.36], [1.25, 0.04, 0.62], [1.55, 0.02, 0.9]],
      sect: [{ at: 0, w: 0.02, up: 0.02 }, { at: 1, w: 0.004, up: 0.004 }], rings: 14, sides: 4, cap: "point", fillet: 0.01, bones: 3, role: "antenna", mat: MAT.shell, segments: { count: 30, depth: 0.15 },
    },
    // the swimming appendages: a long basal segment and five short ones, fringed with setae; they row
    {
      name: "paddle", origin: [0.5, -0.08, 0.12], mirror: true, path: [[0.05, -0.08, 0.2], [-0.02, -0.14, 0.42], [-0.16, -0.16, 0.6]], up: [1, 0.2, 0],
      sect: [{ at: 0, w: 0.03, up: 0.028 }, { at: 0.45, w: 0.034, up: 0.024 }, { at: 0.6, w: 0.06, up: 0.016 }, { at: 0.9, w: 0.05, up: 0.012 }, { at: 1, w: 0.02, up: 0.008 }],
      rings: 10, sides: 6, cap: "round", fillet: 0.02, bones: 3, role: "paddle", mat: MAT.shell, segments: { count: 6, depth: 0.12 },
    },
    ...Array.from({ length: MAR_GILLS }, (_, i) => MAR_gill(i)),
    ...Array.from({ length: MAR_GILLS }, (_, i) => MAR_leg(i)),
  ],
  cards: [
    // the gill filaments: long and slim, along the flanks behind every limb
    { from: MAR_at(-1.1), to: MAR_at(0.15), arc: [95, 130], count: 2 * 26 * 3, rows: 26, len: 0.26, w: 0.014, lift: 0.5, jitter: 0.2, seed: 11 },
    // the setal fringe of the swimming appendages
    { on: "paddleR", from: 0.5, to: 1, arc: [60, 120], count: 2 * 10, len: 0.11, w: 0.009, lift: 0.7, jitter: 0.06, seed: 4 },
    { on: "paddleL", from: 0.5, to: 1, arc: [60, 120], count: 2 * 10, len: 0.11, w: 0.009, lift: 0.7, jitter: 0.06, seed: 4 },
  ],
  // a stiff head, a slender trunk that flexes a little as it rows
  swim: { wavelength: 1.4, stride: 2.2, plane: "vertical", amp: [[0, 0.07], [0.3, 0.035], [0.6, 0.008], [0.7, 0], [1, 0]], bank: 0.5 },
  motions: [
    // the gill-and-leg rows beat in a wave from the back forward
    { role: "gill", axis: "side", amp: 0.5, lag: -0.11, rate: 2 },
    // the paddles row: a power stroke back, in a backstroke, twice per stride
    { role: "paddle", axis: "up", amp: 0.38, ampK: 0.12, bias: -0.1, tipLag: 0.1, rate: 2 },
    { role: "paddle", axis: "side", amp: 0.1, tipLag: 0.08, rate: 2, offset: 1.57 },
    { role: "antenna", axis: "up", amp: 0.08, ampK: 0.05, rate: 0.6, tipLag: 0.18, clock: "time", alternate: true },
  ],
}

const MAR_look: Look = {
  base: 0x4a2d6e, back: 0x2a1c4e, belly: 0xb89ac8, accent: 0xc9762e, shell: 0x553a82, horn: 0x6e4aa0, hornTip: 0xe8b46a, eye: 0x0c1418,
  cell: 0.03, relief: 0.002, cellVary: 0.12, blotch: 0.35, blotchSize: 0.3, bands: [MAR_at(-1.2), MAR_at(MAR_HEAD - 0.02), 26],
  rough: 0.26, spec: 0.6, coat: 0.6, wrap: 0.2, rim: 0.4, aniso: 0.4,
}

// Anomalocaris canadensis (centimetres). Scene 10's own model; references and what was taken from each: anomalocaris.md.
// Origin: mid-trunk on the midline. +x head, +y up, +z right. Body 36 cm without appendages and fan.

const ANO_X0 = -17.5
const ANO_X1 = 18.5
const ANO_ax = (x: number) => (x - ANO_X0) / (ANO_X1 - ANO_X0)
const ANO_s = (x: number, w: number, up: number, dn: number, n = 2.3, nb = 2.6): Section => ({ at: ANO_ax(x), w, up, dn, n, nb })

/** Radius of a ball along its axis, so an eye is a sphere and not a teardrop. */
const ANO_BALL: [number, number][] = [[0, 0.4], [0.1, 0.66], [0.28, 0.92], [0.5, 1], [0.7, 0.92], [0.85, 0.72], [0.95, 0.44], [1, 0.08]]
/** Trunk flap i (0 = front) sits at this x; thirteen of them, then the fan. */
const ANO_flapX = (i: number) => 8.6 - i * 1.82
/** Flap length: longest at the third to fifth, short at the tail. */
const ANO_flapLen = (i: number) => 7.4 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow((i + 2.6) / 16.4, 0.74))), 1.2)
const ANO_flap = (name: string, x: number, L: number, row: number, bones: number): PartSpec => {
  const c = 0.2 * L + 0.75 // half the chord: nearly twice the flap spacing, so each lies under the next
  return {
    name, at: ANO_ax(x), around: 101, mirror: true, sink: 0.4,
    path: [[-0.1 * L, -0.03 * L, 0.34 * L], [-0.26 * L, -0.08 * L, 0.7 * L], [-0.5 * L, -0.15 * L, L]], up: [-0.36, 1, 0.1],
    sect: [{ at: 0, w: c * 0.8, up: 0.22, n: 2.5 }, { at: 0.3, w: c * 1.05, up: 0.13, n: 2.5 }, { at: 0.65, w: c * 0.92, up: 0.075 }, { at: 0.9, w: c * 0.55, up: 0.05 }, { at: 1, w: c * 0.24, up: 0.035 }],
    rings: 10, sides: 10, cap: "round", fillet: 0.4, bones, role: "flap", row, thin: 0.85, mat: MAT.membrane,
  }
}
/** Ventral endites in pairs on the thirteen distal podomeres, long and short alternating, swept toward the tip. */
const ANO_endite = (k: number, around: number): PartSpec => {
  const L = (k % 2 ? 1.25 : 2.5) * (1 - k / 22)
  return {
    name: `endite${k}_${around > 0 ? "a" : "b"}`, on: "app", at: (k + 0.55) / 14, around, mirror: true, sink: 0.04, frame: "surface",
    path: [[0.22 * L, 0.55 * L, 0], [0.55 * L, L, 0]],
    sect: [{ at: 0, w: 0.15, up: 0.15 }, { at: 0.5, w: 0.085, up: 0.085 }, { at: 1, w: 0.016, up: 0.016 }], rings: 4, sides: 5, cap: "point", fillet: 0.07, mat: MAT.horn, minDetail: k % 2 ? 0.9 : 0.4,
  }
}

const ANO_spec: CreatureSpec = {
  name: "anomalocaris",
  body: {
    spine: [[-17.5, 0.75, 0], [-14, 0.4, 0], [-8, 0.05, 0], [0, 0, 0], [7, 0.1, 0], [11.5, 0.3, 0], [15, 0.4, 0], [18.5, -0.1, 0]],
    sect: [
      ANO_s(-17.5, 0.3, 0.25, 0.25), ANO_s(-15.6, 0.95, 0.7, 0.62), ANO_s(-12, 1.9, 1.15, 1.0), ANO_s(-7, 2.9, 1.6, 1.35), ANO_s(-1, 3.75, 1.95, 1.6),
      ANO_s(4, 4.0, 2.05, 1.7), ANO_s(8, 3.5, 1.95, 1.65), ANO_s(10.6, 2.45, 1.6, 1.4), // the neck: constricted
      ANO_s(12.6, 2.85, 1.9, 1.5, 2.5), ANO_s(14.6, 3.3, 2.1, 1.6, 2.7), ANO_s(16.4, 2.9, 1.8, 1.4, 2.6), ANO_s(17.8, 1.9, 1.15, 1.0, 2.3), ANO_s(18.5, 0.9, 0.6, 0.55),
    ],
    rings: 110, sides: 30, bones: [0, 0.08, 0.17, 0.26, 0.36, 0.46, 0.56, 0.66, ANO_ax(9.8), ANO_ax(12.4), ANO_ax(15.5), 1], caps: ["round", "round"],
    segments: { from: ANO_ax(-15.2), to: ANO_ax(9.6), count: 13, depth: 0.07 },
    bulges: [
      { at: ANO_ax(14.4), len: 0.05, around: 62, arc: 34, h: 0.35 }, // the boss each eye stalk stands on
      { at: ANO_ax(2), len: 0.3, around: 0, arc: 16, h: -0.14, mirror: false }, // the divide down the back between the two rows of blades
    ],
  },
  parts: [
    // H-element: a laterally elongated oval with a raised rim, saddled over the top of the head
    {
      name: "shieldH", origin: [13.2, 2.56, 0], path: [[1.6, 0.06, 0], [3.2, -0.3, 0]],
      sect: [{ at: 0, w: 1.5, up: 0.2, bow: 0.22 }, { at: 0.25, w: 2.6, up: 0.26, bow: 0.34, n: 2.6 }, { at: 0.6, w: 2.75, up: 0.26, bow: 0.36, n: 2.6 }, { at: 1, w: 1.5, up: 0.16, bow: 0.25 }],
      rings: 12, sides: 20, cap: "round", cap0: "round", fillet: 0, mat: MAT.shell, bulges: [{ at: 0.5, len: 0.34, around: 0, arc: 60, h: -0.09, mirror: false }],
    },
    // P-elements: an ovoid plate on each side of the head
    {
      name: "shieldP", origin: [12.3, 0.3, 3.05], mirror: true, path: [[1.7, 0.1, 0.42], [3.6, -0.15, 0.1]], up: [0, 0.2, 1],
      sect: [{ at: 0, w: 0.6, up: 0.09, bow: 0.2 }, { at: 0.45, w: 1.25, up: 0.12, bow: 0.3, n: 2.5 }, { at: 1, w: 0.6, up: 0.08, bow: 0.2 }], rings: 9, sides: 12, cap: "round", cap0: "round", fillet: 0, mat: MAT.shell, minDetail: 0.4,
    },
    // oral cone: a disc under the head, three large plates with smaller ones between (the triradial pattern as three raised sectors)
    {
      name: "mouth", origin: [14.2, -1.35, 0], path: [[0, -0.3, 0], [0, -0.5, 0]], up: [1, 0, 0],
      sect: [{ at: 0, w: 1.75, up: 1.75 }, { at: 0.55, w: 1.6, up: 1.6 }, { at: 0.85, w: 1.05, up: 1.05 }, { at: 1, w: 0.4, up: 0.4 }], rings: 8, sides: 24, cap: "flat", fillet: 0.3, mat: MAT.mouth, minDetail: 0.4,
      bulges: [{ at: 0.6, len: 0.3, around: 0, arc: 30, h: 0.2, mirror: false }, { at: 0.6, len: 0.3, around: 120, arc: 30, h: 0.2 }],
    },
    // eyes on stalks, from the back corners of the head, up and out
    { name: "stalk", origin: [14.3, 1.5, 2.5], mirror: true, path: [[0.1, 0.8, 0.9], [0.2, 1.3, 1.9]], sect: [{ at: 0, w: 0.72, up: 0.72 }, { at: 0.5, w: 0.46, up: 0.46 }, { at: 1, w: 0.4, up: 0.4 }], rings: 7, sides: 10, cap: "round", fillet: 0.4, bones: 1, role: "stalk", mat: MAT.shell },
    { name: "eye", on: "stalk", origin: [14.5, 2.7, 4.3], mirror: true, path: [[0.08, 0.5, 1.1], [0.16, 1.0, 2.2]], sect: ANO_BALL.map(([at, k]) => ({ at, w: 1.42 * k, up: 1.4 * k })), rings: 14, sides: 16, cap: "flat", fillet: 0, mat: MAT.eye },
    // the frontal appendages: a shaft podomere and thirteen distal ones, taller than wide, curled down and under; about half the body's length
    {
      name: "app", origin: [16.9, -0.75, 1.25], mirror: true, up: [0, 1, 0],
      path: [[2.6, 0.5, 0.2], [5.6, 0.45, 0.3], [8.2, -0.85, 0.25], [9.6, -3.2, 0.12], [9.2, -5.6, 0], [7.6, -7.0, -0.1], [5.9, -6.9, -0.15], [4.9, -5.9, -0.15]],
      sect: [{ at: 0, w: 0.72, up: 1.05 }, { at: 0.3, w: 0.62, up: 0.92 }, { at: 0.65, w: 0.42, up: 0.6 }, { at: 0.9, w: 0.22, up: 0.3 }, { at: 1, w: 0.07, up: 0.09 }],
      rings: 56, sides: 12, cap: "point", fillet: 0.5, bones: 8, role: "app", mat: MAT.shell, segments: { count: 14, depth: 0.11 },
    },
    ...Array.from({ length: 13 }, (_, k) => [ANO_endite(k + 1, 160), ANO_endite(k + 1, -160)]).flat(),
    // three small pairs on the neck, then thirteen trunk pairs
    ...[0, 1, 2].map((i) => ANO_flap("neck" + i, 12.3 - i * 1.15, 2.1 + i * 0.75, i - 3, 1)),
    ...Array.from({ length: 13 }, (_, i) => ANO_flap("flap" + i, ANO_flapX(i), ANO_flapLen(i), i, 2)),
    // tail fan: three pairs of blades standing up and out, the front pair longest, and a terminal piece
    ...[0, 1, 2].map((i): PartSpec => {
      const L = 6.2 - i * 1.2
      return {
        name: "fan" + i, at: ANO_ax(-15.0 - i * 0.8), around: 58, mirror: true, sink: 0.15, path: [[-0.2 * L, 0.36 * L, 0.2 * L], [-0.52 * L, 0.72 * L, 0.36 * L], [-0.82 * L, 0.92 * L, 0.46 * L]], up: [0.45, 0.25, -0.85],
        sect: [{ at: 0, w: 0.7, up: 0.16 }, { at: 0.4, w: 1.45, up: 0.09, n: 2.4 }, { at: 0.8, w: 1.1, up: 0.06 }, { at: 1, w: 0.4, up: 0.04 }], rings: 9, sides: 8, cap: "round", fillet: 0.25, bones: 1, role: "fan", row: i, thin: 0.8, mat: MAT.membrane,
      }
    }),
    { name: "tailpiece", at: 0.01, around: 0, path: [[-1.6, 0.1, 0], [-3.0, 0.0, 0]], up: [0, 1, 0], sect: [{ at: 0, w: 0.4, up: 0.14 }, { at: 0.55, w: 0.6, up: 0.07 }, { at: 1, w: 0.15, up: 0.03 }], rings: 6, sides: 8, cap: "round", fillet: 0.12, thin: 0.6, mat: MAT.membrane, minDetail: 0.4 },
  ],
  // setal blades: rows of lanceolate blades across the back of each trunk segment, either side of the central divide
  cards: [{ from: ANO_ax(-14.6), to: ANO_ax(9.0), arc: [13, 82], count: 13 * 2 * 24, rows: 13, len: 1.3, w: 0.11, lift: 0.1, jitter: 0.12, seed: 5 }],
  // a stiff head; the trunk flexes a little in the vertical plane, more toward the fan
  swim: { wavelength: 1.3, stride: 20, plane: "vertical", amp: [[0, 0.95], [0.25, 0.5], [0.55, 0.14], [0.7, 0.02], [1, 0]], bank: 7 },
  motions: [
    // one beat per cycle, each flap later than the one ahead, the tip later still: the wave runs from the head back
    { role: "flap", axis: "side", amp: 0.26, ampK: 0.2, lag: 0.11, tipLag: 0.14 },
    { role: "fan", axis: "side", amp: 0.06, lag: 0.1, offset: 2.2 },
    { role: "app", axis: "side", amp: 0.03, tipLag: 0.07, rate: 0.5 },
    { role: "app", axis: "side", biasK: -0.035, bias: -0.05, channel: "grasp" }, // ch.grasp 0..1: the appendages curl shut
    { role: "app", axis: "side", biasK: 0.05, bias: 0.14, channel: "open" }, // ch.open 0..1: they uncurl and reach forward
    { role: "stalk", axis: "tan", amp: 0.09, rate: 0.31, clock: "time" },
    { role: "stalk", axis: "up", bias: 0.5, channel: "gaze" }, // ch.gaze -1..1: both eyes swing
  ],
}

/** Colour is invented: a slate-violet back over a pale belly, amber flaps, dark eyes. */
const ANO_look: Look = {
  base: 0x4d4a6e, back: 0x2c2b4a, belly: 0xc9b79a, accent: 0x23213a, shell: 0x2f2d4d, horn: 0x6b4a3c, hornTip: 0x1c1410, eye: 0x10262a, compoundEye: true,
  cell: 0.17, relief: 0.014, cellVary: 0.16, blotch: 0.4, blotchSize: 2.8, mottle: 0.3, bands: [ANO_ax(-15.2), ANO_ax(9.6), 13], rough: 0.38, spec: 0.4, coat: 0.3, wrap: 0.18, rim: 0.3, occlude: 0.5,
}

// Opabinia regalis (centimetres). References and what was taken from each: opabinia.md.
// Origin: mid-trunk on the midline. +x head, +y up, +z right. Body 6 cm without the proboscis.

const OPA_X0 = -3
const OPA_X1 = 3
const OPA_ax = (x: number) => (x - OPA_X0) / (OPA_X1 - OPA_X0)
const OPA_s = (x: number, w: number, up: number, dn: number, n = 2.2, nb = 2.5): Section => ({ at: OPA_ax(x), w, up, dn, n, nb })

/** Fifteen trunk segments, 3 mm apart; lobe i (0 = front) is at this x. */
const OPA_lobeX = (i: number) => 2.06 - i * 0.3
const OPA_lobeLen = (i: number) => 0.34 + 0.5 * Math.pow(Math.sin(Math.PI * Math.pow((i + 1.6) / 17.5, 0.8)), 1.1)
/** A lateral lobe: down and out; its front edge lies under the rear edge of the lobe ahead. */
const OPA_lobe = (i: number): PartSpec => {
  const L = OPA_lobeLen(i)
  const c = 0.17 * L + 0.13
  return {
    name: "lobe" + i, at: OPA_ax(OPA_lobeX(i)), around: 104, mirror: true, sink: 0.05,
    path: [[-0.04 * L, -0.12 * L, 0.38 * L], [-0.12 * L, -0.2 * L, 0.76 * L], [-0.26 * L, -0.3 * L, L]], up: [0.34, 1, 0.3],
    sect: [{ at: 0, w: c * 0.82, up: 0.04, n: 2.5 }, { at: 0.35, w: c * 1.05, up: 0.026, n: 2.5 }, { at: 0.75, w: c * 0.85, up: 0.016 }, { at: 1, w: c * 0.36, up: 0.01 }],
    rings: 8, sides: 8, cap: "round", fillet: 0.06, bones: i < 10 ? 2 : 1, role: "lobe", row: i, thin: 0.8, mat: MAT.membrane,
  }
}
/** Radius of a ball along its axis, so an eye is a sphere and not a teardrop. */
const OPA_BALL: [number, number][] = [[0, 0.5], [0.12, 0.7], [0.3, 0.93], [0.5, 1], [0.7, 0.92], [0.85, 0.72], [0.95, 0.44], [1, 0.08]]
/** An eye on its stalk: `p` the foot, `d` the direction it stands, `h` the stalk's length, `r` the eye's radius. */
const OPA_eye = (name: string, p: [number, number, number], d: [number, number, number], h: number, r: number, mirror: boolean): PartSpec[] => {
  const k = 1 / Math.hypot(d[0], d[1], d[2])
  const u: [number, number, number] = [d[0] * k, d[1] * k, d[2] * k]
  return [
    { name: name + "Stalk", origin: p, mirror, path: [[u[0] * h * 0.5, u[1] * h * 0.5, u[2] * h * 0.5], [u[0] * h, u[1] * h, u[2] * h]], sect: [{ at: 0, w: r * 0.62, up: r * 0.62 }, { at: 1, w: r * 0.45, up: r * 0.45 }], rings: 4, sides: 8, cap: "round", fillet: r * 0.5, bones: 1, role: "stalk", minDetail: 0.3 },
    {
      name: name + "Eye", on: name + "Stalk", origin: [p[0] + u[0] * h * 0.9, p[1] + u[1] * h * 0.9, p[2] + u[2] * h * 0.9], mirror, path: [[u[0] * r, u[1] * r, u[2] * r], [u[0] * r * 2, u[1] * r * 2, u[2] * r * 2]],
      sect: OPA_BALL.map(([at, k]) => ({ at, w: r * k, up: r * k })), rings: 10, sides: 10, cap: "flat", fillet: 0, mat: MAT.eye, minDetail: 0.3,
    },
  ]
}
const OPA_TIP: [number, number, number] = [2.95 + 1.95, -0.08 - 0.28, 0]

const OPA_spec: CreatureSpec = {
  name: "opabinia",
  body: {
    spine: [[-3, 0.16, 0], [-2.2, 0.05, 0], [-1, 0, 0], [0.6, 0, 0], [1.8, 0.02, 0], [2.5, 0.07, 0], [3, 0.0, 0]],
    sect: [
      OPA_s(-3, 0.035, 0.035, 0.035), OPA_s(-2.7, 0.1, 0.09, 0.08), OPA_s(-2.3, 0.16, 0.14, 0.12), OPA_s(-1.4, 0.22, 0.19, 0.16), OPA_s(-0.2, 0.26, 0.22, 0.18), OPA_s(1, 0.27, 0.23, 0.185),
      OPA_s(1.9, 0.25, 0.22, 0.18), OPA_s(2.25, 0.25, 0.22, 0.18), OPA_s(2.55, 0.29, 0.25, 0.2, 2.4), OPA_s(2.82, 0.25, 0.21, 0.17), OPA_s(3, 0.12, 0.1, 0.09),
    ],
    rings: 84, sides: 22, bones: [0, 0.07, 0.15, 0.24, 0.33, 0.42, 0.51, 0.6, 0.69, 0.78, OPA_ax(2.3), 1], caps: ["point", "round"],
    segments: { from: OPA_ax(-2.29), to: OPA_ax(2.21), count: 15, depth: 0.09 },
  },
  parts: [
    // five eyes: two small in front looking up and forward, two larger on longer stalks at the rear corners looking up and out, one between them looking up
    ...OPA_eye("eyeF", [2.72, 0.2, 0.11], [0.5, 1, 0.25], 0.1, 0.075, true),
    ...OPA_eye("eyeR", [2.44, 0.2, 0.22], [-0.05, 1, 0.75], 0.19, 0.105, true),
    ...OPA_eye("eyeM", [2.46, 0.25, 0], [0, 1, 0], 0.12, 0.09, false),
    // the proboscis: hollow, ringed like a vacuum hose, from under the front of the head
    {
      name: "probe", origin: [2.95, -0.08, 0], path: [[0.4, -0.1, 0], [0.85, -0.28, 0], [1.3, -0.4, 0], [1.7, -0.37, 0], [1.95, -0.28, 0]],
      sect: [{ at: 0, w: 0.115, up: 0.115 }, { at: 0.15, w: 0.09, up: 0.09 }, { at: 0.9, w: 0.075, up: 0.075 }, { at: 1, w: 0.085, up: 0.085 }], rings: 48, sides: 10, cap: "round", fillet: 0.09, bones: 7, role: "probe", segments: { count: 24, depth: 0.2 },
    },
    // its claw: a fused pair of appendages, two opposed halves that open sideways, each with five spines pointing in and forward
    {
      name: "claw", on: "probe", origin: OPA_TIP, mirror: true, path: [[0.1, 0.01, 0.075], [0.24, 0.02, 0.11], [0.38, 0.02, 0.085]], up: [0, 1, 0],
      sect: [{ at: 0, w: 0.05, up: 0.07 }, { at: 0.5, w: 0.04, up: 0.062 }, { at: 1, w: 0.014, up: 0.02 }], rings: 7, sides: 8, cap: "point", fillet: 0.03, bones: 1, role: "claw", mat: MAT.horn, minDetail: 0.3,
    },
    ...Array.from({ length: 5 }, (_, k): PartSpec => ({
      name: "clawSpine" + k, on: "claw", at: 0.24 + k * 0.15, around: -90, mirror: true, sink: 0.008, frame: "surface", path: [[0.03, 0.045, 0], [0.065, 0.075, 0]],
      sect: [{ at: 0, w: 0.014, up: 0.014 }, { at: 1, w: 0.003, up: 0.003 }], rings: 3, sides: 4, cap: "point", fillet: 0.008, mat: MAT.horn, minDetail: 0.9,
    })),
    // the mouth: under the head, facing backward
    { name: "mouth", origin: [2.42, -0.15, 0], path: [[-0.04, -0.025, 0], [-0.08, -0.03, 0]], up: [0, 1, 0], sect: [{ at: 0, w: 0.09, up: 0.07 }, { at: 0.6, w: 0.075, up: 0.06 }, { at: 1, w: 0.04, up: 0.03 }], rings: 4, sides: 10, cap: "flat", fillet: 0.03, mat: MAT.mouth, minDetail: 0.9 },
    ...Array.from({ length: 15 }, (_, i) => OPA_lobe(i)),
    // tail fan: three pairs of blades up and out, a V seen from behind, each overlapping the next
    ...[0, 1, 2].map((i): PartSpec => {
      const L = 0.82 - i * 0.14
      return {
        name: "fan" + i, at: OPA_ax(-2.42 - i * 0.17), around: 52, mirror: true, sink: 0.02, path: [[-0.16 * L, 0.34 * L, 0.3 * L], [-0.4 * L, 0.66 * L, 0.56 * L], [-0.62 * L, 0.84 * L, 0.7 * L]], up: [0.5, 0.35, -0.8],
        sect: [{ at: 0, w: 0.09, up: 0.025 }, { at: 0.45, w: 0.16, up: 0.014, n: 2.4 }, { at: 0.85, w: 0.11, up: 0.01 }, { at: 1, w: 0.04, up: 0.008 }], rings: 7, sides: 8, cap: "round", fillet: 0.04, bones: 1, role: "fan", row: i, thin: 0.8, mat: MAT.membrane,
      }
    }),
    // the pair of tiny rigid spines the trunk ends in
    { name: "tailSpine", origin: [-2.96, 0.15, 0.02], mirror: true, path: [[-0.1, 0.02, 0.03], [-0.2, 0.03, 0.07]], sect: [{ at: 0, w: 0.02, up: 0.02 }, { at: 1, w: 0.004, up: 0.004 }], rings: 3, sides: 5, cap: "point", fillet: 0.01, mat: MAT.horn, minDetail: 0.9 },
  ],
  // gill blades: a band of lanceolate blades over the base of each lobe
  cards: [{ from: OPA_ax(-2.3), to: OPA_ax(2.2), arc: [38, 96], count: 15 * 2 * 9, rows: 15, len: 0.2, w: 0.028, lift: 0.12, jitter: 0.12, seed: 11 }],
  // the trunk is stiff: a slight heave toward the tail only
  swim: { wavelength: 1.4, stride: 3, plane: "vertical", amp: [[0, 0.07], [0.3, 0.03], [0.6, 0.005], [1, 0]], bank: 4 },
  motions: [
    { role: "lobe", axis: "side", amp: 0.3, ampK: 0.2, lag: 0.1, tipLag: 0.13 },
    { role: "fan", axis: "side", amp: 0.06, lag: 0.1, offset: 2 },
    // the proboscis searches: a slow two-axis wander, and ch.reach 0..1 curls it down and back to the mouth
    { role: "probe", axis: "side", amp: 0.04, tipLag: 0.13, rate: 0.37, clock: "time" },
    { role: "probe", axis: "up", amp: 0.05, tipLag: 0.11, rate: 0.23, clock: "time", offset: 1.3 },
    { role: "probe", axis: "side", bias: -0.22, biasK: -0.13, channel: "reach" },
    { role: "claw", axis: "up", bias: 0.3, channel: "snap" }, // ch.snap 0..1: the claw closes
    { role: "stalk", axis: "side", amp: 0.1, rate: 0.29, clock: "time" },
  ],
}

/** Colour is invented: a sandy coral trunk, paler lobes, dark eyes. */
const OPA_look: Look = {
  base: 0xc77a45, back: 0x9a4e2c, belly: 0xe7cfa6, accent: 0x7a3a22, horn: 0x5a2f20, hornTip: 0x1f0f0a, eye: 0x3a1712,
  cell: 0.03, relief: 0.004, cellVary: 0.14, blotch: 0.35, blotchSize: 0.4, mottle: 0.3, bands: [OPA_ax(-2.29), OPA_ax(2.21), 15], rough: 0.5, spec: 0.3, coat: 0.2, wrap: 0.3, rim: 0.32,
}

// Hallucigenia sparsa (millimetres), after Smith and Caron 2015: spines up, legs down, the long end is the head.
// Refs (fetched): burgess-shale.rom.on.ca/fossils/hallucigenia-sparsa/ (a small head at the end of a long neck; three
// pairs of very thin tentacle-like lobopods on the neck; seven pairs of long dorsal spines in skin sheaths; stouter
// limbs ending in strong claws; the rearmost limb pair has no matching spine pair; a slightly swollen head with a
// pair of simple dorsal eyes and a terminal mouth; to 30 mm); en.wikipedia.org/wiki/Hallucigenia (up to ten pairs
// of slender legs, the first two or three slender and featureless, the rest ending in one or two claws; seven
// pairs of spines over the 3rd to 9th leg pairs; elongated head; the trunk featureless).
// So: appendage pairs 1 and 2 are tentacles on the neck, pair 3 a tentacle under the first spines, pairs 4 to 9
// clawed legs under spines 2 to 7, pair 10 a clawed leg behind the last spines. Colour is invented.
// Origin: on the ground under mid-trunk.

const HAL_X0 = -9.6
const HAL_LEN = 23.2 // arc length of the spine curve, tail tip to mouth
const HAL_at = (x: number) => (x - HAL_X0) / HAL_LEN
const HAL_Y = 5.6 // height of the trunk's centre line
const HAL_R = 0.72 // trunk radius
const HAL_s = (at: number, r: number): Section => ({ at, w: r, up: r, dn: r, n: 2, nb: 2 })
/** x of spine pair i (0 = the first, over the third tentacles), two millimetres apart. */
const HAL_sx = (i: number) => 5 - i * 2

/** A dorsal spine: a long rigid cone in a sheath of skin, up and a little out and back. */
const HAL_spine = (i: number): PartSpec => {
  const L = 6.4 - Math.abs(i - 2.5) * 0.28
  return {
    name: "spine" + i, origin: [HAL_sx(i), HAL_Y + HAL_R * 0.72, HAL_R * 0.55], mirror: true,
    path: [[-0.12 * L, 0.5 * L, 0.11 * L], [-0.3 * L, 0.97 * L, 0.2 * L]],
    sect: [{ at: 0, w: 0.36, up: 0.36 }, { at: 0.16, w: 0.25, up: 0.25 }, { at: 0.6, w: 0.14, up: 0.14 }, { at: 1, w: 0.02, up: 0.02 }],
    rings: 9, sides: 8, cap: "point", fillet: 0.32, mat: MAT.horn,
  }
}
/** A clawed walking leg: a soft tube, hip under the flank, a slight knee, the foot on the ground. */
const HAL_leg = (i: number, x: number, k: number): PartSpec[] => {
  const y0 = HAL_Y - HAL_R * 0.7
  const tip: [number, number, number] = [0.5 * k, -y0, 3.1 * k]
  return [
    {
      name: "leg" + i, origin: [x, y0, HAL_R * 0.6], mirror: true, jointed: true, sink: 0.2,
      path: [[0.95 * k, -y0 * 0.38, 2.1 * k], [0.15 * k, -y0 * 0.86, 2.9 * k], tip],
      sect: [{ at: 0, w: 0.36 * k, up: 0.36 * k }, { at: 0.5, w: 0.27 * k, up: 0.27 * k }, { at: 0.88, w: 0.2 * k, up: 0.2 * k }, { at: 1, w: 0.13 * k, up: 0.13 * k }],
      rings: 14, sides: 8, cap: "round", fillet: 0.3, bones: "joints", role: "leg", limits: [0.1, 1.9],
    },
    // two claws at the foot (one on the last pair)
    ...(i < 9 ? [-1, 1] : [0]).map((c): PartSpec => ({
      name: `claw${i}_${c + 1}`, on: "leg" + i, origin: [x + tip[0] - 0.05, 0.16, HAL_R * 0.6 + tip[2] + c * 0.09], mirror: true,
      path: [[0.3, 0.02, c * 0.1], [0.5, -0.14, c * 0.14]], sect: [{ at: 0, w: 0.075, up: 0.09 }, { at: 1, w: 0.012, up: 0.012 }],
      rings: 3, sides: 5, cap: "point", fillet: 0.04, mat: MAT.horn, minDetail: 0.9,
    })),
  ]
}
/** A tentacle-like anterior lobopod: very thin, hanging down and forward, swaying. */
const HAL_tent = (i: number, x: number, y: number, r: number, L: number): PartSpec => ({
  name: "tent" + i, origin: [x, y, r * 0.6], mirror: true,
  path: [[0.14 * L, -0.3 * L, 0.2 * L], [0.3 * L, -0.62 * L, 0.3 * L], [0.52 * L, -0.92 * L, 0.3 * L]],
  sect: [{ at: 0, w: 0.2, up: 0.2 }, { at: 0.4, w: 0.12, up: 0.12 }, { at: 1, w: 0.04, up: 0.04 }],
  rings: 12, sides: 6, cap: "point", fillet: 0.16, bones: 3, role: "tent", row: i, minDetail: 0.3,
})

const HAL_SPEC: CreatureSpec = {
  name: "hallucigenia",
  body: {
    // the trunk level, the neck rising a little and reaching forward, the head drooping at its end
    spine: [[-9.6, 5.0, 0], [-8.4, 5.4, 0], [-4, HAL_Y, 0], [1, HAL_Y, 0], [5, HAL_Y, 0], [7.2, 6.1, 0], [9.4, 6.5, 0], [11.4, 6.1, 0], [12.9, 5.1, 0]],
    sect: [
      HAL_s(0, 0.12), HAL_s(0.035, 0.45), HAL_s(0.09, 0.66), HAL_s(0.2, HAL_R), HAL_s(0.6, HAL_R), HAL_s(0.68, 0.6), HAL_s(0.76, 0.46), HAL_s(0.86, 0.43),
      HAL_s(0.91, 0.5), HAL_s(0.95, 0.6), HAL_s(0.985, 0.5), HAL_s(1, 0.3),
    ],
    rings: 84, sides: 14, bones: [0, 0.08, 0.2, 0.32, 0.44, 0.56, 0.64, 0.72, 0.8, 0.88, 0.94, 1], caps: ["round", "round"],
    breath: [0.2, 0.6, 0.02],
  },
  parts: [
    ...Array.from({ length: 7 }, (_, i) => HAL_spine(i)),
    HAL_tent(0, 9.2, 6.48 - 0.36, 0.44, 5.6), HAL_tent(1, 7.2, 6.1 - 0.44, 0.52, 6.2), HAL_tent(2, 5, HAL_Y - HAL_R * 0.7, HAL_R, 6.4),
    ...Array.from({ length: 6 }, (_, j) => HAL_leg(j + 3, HAL_sx(j + 1), 1)).flat(),
    ...HAL_leg(9, -8.5, 0.82),
    // a pair of simple eyes on top of the head, and the mouth at its end
    { name: "eye", origin: [11.9, 6.15, 0.3], mirror: true, path: [[0.03, 0.09, 0.07], [0.05, 0.16, 0.12]], sect: [{ at: 0, w: 0.16, up: 0.16 }, { at: 0.5, w: 0.15, up: 0.15 }, { at: 1, w: 0.09, up: 0.09 }], rings: 4, sides: 10, cap: "round", fillet: 0.03, mat: MAT.eye, minDetail: 0.4 },
  ],
  gait: { gait: "metachronal", stride: 3.4, duty: 0.7, lift: 0.9, lag: 0.15, bob: 0.08, shift: 0.1, roll: 0.03, girdle: 0.03, pitch: 0.03, tail: [0.25, 0.3], head: [0.5, 0.3], tailAt: HAL_at(-7), neckAt: HAL_at(5) },
  motions: [{ role: "tent", axis: "side", amp: 0.2, ampK: 0.08, rate: 0.35, lag: 0.21, tipLag: 0.16, clock: "time" }, { role: "tent", axis: "up", amp: 0.12, rate: 0.23, lag: 0.3, tipLag: 0.1, clock: "time", alternate: true }],
}

const HAL_LOOK: Look = {
  base: 0x8f4a63, back: 0x5e2a4c, belly: 0xcf9a92, accent: 0x44203c, horn: 0xe6d9b8, hornTip: 0x4a3524, eye: 0x101012, catchlight: true,
  blotch: 0.35, blotchSize: 1.6, mottle: 0.3, fold: 0.5, foldSize: 0.42, foldFlex: 2.5, occlude: 0.5,
  rough: 0.5, spec: 0.3, coat: 0.25, wrap: 0.5, bleed: 0xd9606a, rim: 0.4,
}

// Wiwaxia corrugata (millimetres), 50 mm long. A domed oval on a flat slug-like sole, armoured in overlapping
// ribbed sclerites, with two rows of long blade-like spines.
// Refs (fetched): burgess-shale.rom.on.ca/fossils/wiwaxia-corrugata/ (slug-like, to 55 mm; roughly oval, no
// segmentation; body sclerites in about 50 rows; two rows of blade-like dorsal spines, 7 to 11 per row; the
// ventral surface the only part not covered; epibenthic, mobile, grazing mats); en.wikipedia.org/wiki/Wiwaxia
// (elliptical from above with no distinct head or tail; nearly rectangular from the front; about 1 cm high
// without the spines; eight rows of sclerites, oval and leaf-shaped, lying flat, "the rear of one covered the
// front of the one behind"; a single row of crescent-shaped ventro-lateral sclerites; spines project outward and
// slightly upward, the middle ones of each row usually the longest; moved by contractions of a slug-like foot).
// Width (0.6 of the length) is this model's reading of published reconstructions, not a fetched number. Colour is invented.
// Origin: on the ground under the middle of the sole.

const WIW_at = (x: number) => (x + 25) / 50
const WIW_s = (x: number, w: number, up: number, dn = 2): Section => ({ at: WIW_at(x), w, up, dn, n: 2.7, nb: 5 })
const WIW_N = 9 // spines per row (7 to 11)
/** Spine i of a row, front to back: a ribbed blade standing up and out from the shoulder of the dome, leaning back. */
const WIW_spine = (i: number): PartSpec => {
  const u = i / (WIW_N - 1)
  const L = 8 + 15 * Math.pow(Math.sin(Math.PI * (0.12 + 0.76 * u)), 1.6)
  const x = 17 - u * 34
  const hw = 14.6 * Math.sqrt(Math.max(0, 1 - (x / 26) ** 2))
  return {
    name: "spine" + i, origin: [x, 2 + 7.6 * Math.sqrt(Math.max(0, 1 - (x / 27) ** 2)) * 0.86, hw * 0.47], mirror: true,
    path: [[-0.1 * L, 0.48 * L, 0.2 * L], [-0.3 * L, 0.9 * L, 0.42 * L]], up: [0.25, -0.35, 0.9],
    sect: [{ at: 0, w: 1.15, up: 0.42, n: 2.4 }, { at: 0.35, w: 1.3, up: 0.3, n: 2.4, ridge: [0.1, 0.25] }, { at: 0.8, w: 0.85, up: 0.18 }, { at: 1, w: 0.1, up: 0.05 }],
    rings: 9, sides: 8, cap: "point", fillet: 0.7, mat: MAT.horn, segments: { count: 1, depth: 0 },
  }
}

const WIW_SPEC: CreatureSpec = {
  name: "wiwaxia",
  body: {
    spine: [[-25, 0.35, 0], [-23.6, 1.3, 0], [-20, 2, 0], [-8, 2, 0], [8, 2, 0], [20, 2, 0], [23.6, 1.3, 0], [25, 0.35, 0]],
    sect: [WIW_s(-25, 1.2, 0.5, 0.3), WIW_s(-23.8, 5.2, 2.3, 1.1), WIW_s(-21.5, 8.8, 4.6, 1.8), WIW_s(-17, 12.2, 6.6), WIW_s(-9, 14.3, 7.7), WIW_s(1, 15, 8), WIW_s(11, 14, 7.6), WIW_s(17.5, 11.6, 6.4), WIW_s(21.5, 8.4, 4.4, 1.8), WIW_s(23.8, 5, 2.2, 1.1), WIW_s(25, 1.2, 0.5, 0.3)],
    rings: 40, sides: 28, bones: 7, caps: ["round", "round"], mat: MAT.skin,
  },
  parts: [
    ...Array.from({ length: WIW_N }, (_, i) => WIW_spine(i)),
    // the anterior sclerites: a fringe of leaf-shaped plates over the front margin, pointing forward and down
    ...[0, 1.9, 3.8, 5.6].map((z, i): PartSpec => ({
      name: "front" + i, origin: [23.9 - z * z * 0.1, 1.9 - z * 0.06, z], mirror: z > 0, path: [[1.1, -0.6, z * 0.14], [1.9 - z * 0.08, -1.5, z * 0.26]], up: [0.6, 0.8, 0],
      sect: [{ at: 0, w: 1.25, up: 0.3 }, { at: 0.5, w: 1.35, up: 0.2, ridge: [0.08, 0.2] }, { at: 1, w: 0.25, up: 0.08 }], rings: 5, sides: 8, cap: "point", fillet: 0.3, mat: MAT.shell, minDetail: 0.4,
    })),
  ],
  cards: [
    // the body sclerites: leaf-shaped, lying flat, each row overlapping the one behind
    { from: 0.025, to: 0.98, arc: [0.5, 97], count: 26 * 2 * 9, rows: 26, len: 5.6, w: 2.9, lift: 0.2, jitter: 0.1, seed: 5 },
    // the ventro-lateral row along the edge of the sole
    { from: 0.05, to: 0.95, arc: [97, 106], count: 26 * 2, rows: 26, len: 4.0, w: 2.2, lift: 0.14, jitter: 0.06, seed: 9 },
  ],
  // the sole's contractions: a small wave running forward along the body as it creeps
  swim: { wavelength: 0.7, stride: 7, plane: "vertical", amp: [[0, 0.22], [0.5, 0.3], [1, 0.22]], bank: 0 },
}

const WIW_LOOK: Look = {
  base: 0x5a4a2c, back: 0x3e3220, belly: 0x4a4030, accent: 0x6a5630, horn: 0xd8c89a, hornTip: 0xf4ecd4, shell: 0x564630, shellGloss: 0.15,
  cell: 2.6, relief: 0.08, cellVary: 0.3, blotch: 0.2, blotchSize: 6, mottle: 0.2,
  rough: 0.62, spec: 0.22, coat: 0.05, aniso: 0.7, wrap: 0.25, rim: 0.25,
}

// Pikaia gracilens (millimetres). A laterally flattened, leaf-shaped chordate, 40 mm here.
// Refs (fetched): burgess-shale.rom.on.ca/fossils/pikaia-gracilens/ (laterally flattened, ventral fin toward the
// posterior, V-shaped myomeres, head of two lobes with a pair of short slender tentacles, no eyes, up to twelve
// pairs of small short pointed structures ventrally behind the head, to 55 mm, nektobenthic);
// en.wikipedia.org/wiki/Pikaia (average 4 cm, height about twice the width, about 100 myomeres, dorsal and
// ventral fins as expansions of the body, expanded tail fin, eel-like S-curves, a slow swimmer).
// Colour is invented. Origin: mid-body on the midline.

const PIK_X0 = -20
const PIK_X1 = 20
const PIK_at = (x: number) => (x - PIK_X0) / (PIK_X1 - PIK_X0)
/** A station: half-width, height above and below the centre line, and the fin (a ridge and a keel) standing on it. */
const PIK_s = (x: number, w: number, up: number, dn: number, fin = 0, keel = 0): Section => ({
  at: PIK_at(x), w, up, dn, n: 1.7, nb: 1.7,
  ...(fin > 0 ? { ridge: [fin, Math.min(0.22, w * 0.5)] as [number, number] } : {}),
  ...(keel > 0 ? { keel: [keel, Math.min(0.22, w * 0.5)] as [number, number] } : {}),
})
/** One of the short pointed appendages in a row under the throat. */
const PIK_gill = (i: number): PartSpec => {
  const L = 1.5 - i * 0.07
  return {
    name: "gill" + i, at: PIK_at(17.0 - i * 0.62), around: 152, mirror: true, sink: 0.06, path: [[-0.25 * L, -0.7 * L, 0.3 * L], [-0.6 * L, -L, 0.42 * L]],
    sect: [{ at: 0, w: 0.17, up: 0.17 }, { at: 1, w: 0.03, up: 0.03 }], rings: 3, sides: 5, cap: "point", fillet: 0.08, minDetail: 0.9,
  }
}

const PIK_SPEC: CreatureSpec = {
  name: "pikaia",
  body: {
    spine: [[-20, 0, 0], [-14, 0, 0], [-6, 0, 0], [4, 0, 0], [13, 0, 0], [18, 0.1, 0], [20, 0.1, 0]],
    sect: [
      PIK_s(-20, 0.03, 0.08, 0.08), PIK_s(-19.3, 0.06, 0.5, 0.48, 0.25, 0.25), PIK_s(-17.8, 0.11, 1.0, 0.95, 0.5, 0.5), PIK_s(-15.5, 0.2, 1.35, 1.3, 0.75, 0.7), PIK_s(-12.5, 0.42, 1.7, 1.65, 0.8, 0.65),
      PIK_s(-9, 0.75, 2.2, 2.1, 0.8, 0.5), PIK_s(-2, 0.98, 2.7, 2.55, 0.8, 0.3), PIK_s(5, 1.02, 2.75, 2.6, 0.7, 0), PIK_s(11, 0.9, 2.3, 2.2, 0.5, 0),
      PIK_s(15, 0.72, 1.6, 1.55, 0.2, 0), PIK_s(17.6, 0.55, 1.0, 1.0), PIK_s(19.2, 0.5, 0.7, 0.68), PIK_s(20, 0.3, 0.4, 0.4),
    ],
    rings: 80, sides: 16, bones: 14, caps: ["point", "round"],
    segments: { from: PIK_at(-17), to: PIK_at(16), count: 36, depth: 0.035 },
  },
  parts: [
    // the head's two lobes
    { name: "lobe", origin: [19.5, 0.1, 0.22], mirror: true, path: [[0.5, 0.02, 0.14], [0.9, 0, 0.2]], sect: [{ at: 0, w: 0.34, up: 0.38 }, { at: 1, w: 0.2, up: 0.24 }], rings: 3, sides: 7, cap: "round", fillet: 0.12, minDetail: 0.4 },
    // a pair of short slender tentacles
    { name: "tent", origin: [19.9, 0.3, 0.3], mirror: true, path: [[1.1, 0.5, 0.5], [2.3, 0.75, 1.3], [3.3, 0.6, 2.3]], sect: [{ at: 0, w: 0.16, up: 0.16 }, { at: 1, w: 0.035, up: 0.035 }], rings: 8, sides: 5, cap: "point", fillet: 0.08, bones: 2, role: "tent", minDetail: 0.4 },
    ...Array.from({ length: 9 }, (_, i) => PIK_gill(i)),
  ],
  swim: { wavelength: 0.85, stride: 15, plane: "lateral", amp: [[0, 4.2], [0.3, 2.6], [0.6, 1.3], [0.85, 0.5], [1, 0.3]], bank: 3 },
  motions: [{ role: "tent", axis: "up", amp: 0.16, rate: 0.6, tipLag: 0.2, clock: "time", alternate: true }],
}

const PIK_LOOK: Look = {
  base: 0xb8704c, back: 0x6e3a26, belly: 0xe2c9a4, accent: 0x5a2a1c, stripes: 1, blotch: 0.3, blotchSize: 1.1, mottle: 0.2,
  bands: [PIK_at(-17), PIK_at(16), 36], rough: 0.45, spec: 0.35, coat: 0.3, wrap: 0.5, bleed: 0xd9785a, rim: 0.4, eye: 0x1a1a1a,
}


void MAT

// Vauxia gracilenta (centimetres): a branching demosponge. Origin: its base on the mud.
// ROM Burgess Shale gallery (fetched): to 8 cm tall; simple to branching; branches "deeply conical and nearly
// cylindrical", each a tube round an open central cavity ending in a rounded or flat osculum; skeleton a regular
// net of spongin fibres in 4 to 6 sided polygons. Branch count and angles are this model's; colour is invented.

type VAU_V = [number, number, number]
/** A tubular branch from `o` along `d` (bending back toward the vertical), `len` long, widening from r0 to r1, with its osculum. */
const VAU_branch = (name: string, on: string | undefined, o: VAU_V, d: VAU_V, len: number, r0: number, r1: number, row: number, bones: number): PartSpec[] => {
  const n = Math.hypot(d[0], d[1], d[2])
  const u: VAU_V = [d[0] / n, d[1] / n, d[2] / n]
  // the far half leans back up: a sponge grows toward the light and the current
  const m: VAU_V = [u[0] * len * 0.5, u[1] * len * 0.5, u[2] * len * 0.5]
  const e: VAU_V = [m[0] + u[0] * len * 0.3, m[1] + (u[1] * 0.5 + 0.5) * len * 0.5, m[2] + u[2] * len * 0.3]
  const t: VAU_V = [e[0] - m[0], e[1] - m[1], e[2] - m[2]]
  const tl = Math.hypot(t[0], t[1], t[2])
  // it leaves its parent sideways before it turns up, so the junction is a clean collar and not a grazing sliver
  const hl = Math.hypot(u[0], u[2]) || 1
  const k: VAU_V = [(u[0] / hl) * (r0 * 1.9 + 0.3), 0.22, (u[2] / hl) * (r0 * 1.9 + 0.3)]
  return [
    {
      name, on, origin: o, path: on === "trunk" && o[1] > 2.2 ? [m, e] : [k, m, e], up: [1, 0, 0.02],
      sect: [{ at: 0, w: r0, up: r0 }, { at: 0.35, w: r0 * 0.94, up: r0 * 0.94 }, { at: 0.8, w: r1, up: r1 }, { at: 0.95, w: r1 * 1.06, up: r1 * 1.06 }, { at: 1, w: r1 * 0.98, up: r1 * 0.98 }],
      rings: 16, sides: 12, cap: "flat", fillet: r0 * 0.45, bones, role: "sway", row, mat: MAT.skin,
    },
    // the osculum: the dark mouth of the tube, set just proud of the rim's flat cap
    {
      name: name + "Osc", on: name, origin: [o[0] + e[0], o[1] + e[1], o[2] + e[2]], path: [[(t[0] / tl) * 0.07, (t[1] / tl) * 0.07, (t[2] / tl) * 0.07]], up: [1, 0, 0.02],
      sect: [{ at: 0, w: r1 * 0.7, up: r1 * 0.7 }, { at: 1, w: r1 * 0.66, up: r1 * 0.66 }], rings: 2, sides: 10, cap: "flat", fillet: 0, mat: MAT.horn, minDetail: 0.4,
    },
  ]
}
/** Where a branch built by VAU_branch has its midpoint (a path control point, so exact): children fork from it. */
const VAU_mid = (o: VAU_V, d: VAU_V, len: number): VAU_V => {
  const n = Math.hypot(d[0], d[1], d[2])
  return [o[0] + (d[0] / n) * len * 0.5, o[1] + (d[1] / n) * len * 0.5, o[2] + (d[2] / n) * len * 0.5]
}
const VAU_T: VAU_V = [0.05, 2.3, -0.03] // top of the trunk
const VAU_A: [VAU_V, number] = [[0.75, 1, 0.25], 4.4]
const VAU_B: [VAU_V, number] = [[-0.5, 1, 0.7], 3.9]
const VAU_C: [VAU_V, number] = [[-0.35, 1, -0.8], 4.9]

const VAU_SPEC: CreatureSpec = {
  name: "vauxia",
  body: {
    // the holdfast: a low encrusting mound
    spine: [[-0.75, 0.1, 0], [0, 0.2, 0], [0.75, 0.1, 0]],
    sect: [{ at: 0, w: 0.2, up: 0.1, dn: 0.1 }, { at: 0.5, w: 0.72, up: 0.34, dn: 0.2, n: 2.4 }, { at: 1, w: 0.2, up: 0.1, dn: 0.1 }],
    rings: 10, sides: 12, bones: 2, caps: ["round", "round"],
  },
  parts: [
    {
      name: "trunk", origin: [0, 0.22, 0], path: [[0.06, 1.0, 0.03], [0.05, 2.08, -0.03]], up: [1, 0, 0],
      sect: [{ at: 0, w: 0.5, up: 0.5 }, { at: 0.3, w: 0.4, up: 0.4 }, { at: 1, w: 0.46, up: 0.46 }], rings: 12, sides: 12, cap: "round", fillet: 0.3, bones: 2, role: "sway", row: 0,
    },
    // three first-order branches from the top of the trunk, each forking once: six oscula
    ...VAU_branch("a", "trunk", VAU_T, VAU_A[0], VAU_A[1], 0.36, 0.44, 1, 2),
    ...VAU_branch("b", "trunk", [0.05, 1.95, 0], VAU_B[0], VAU_B[1], 0.34, 0.42, 2, 2),
    ...VAU_branch("c", "trunk", [0.05, 1.65, -0.02], VAU_C[0], VAU_C[1], 0.36, 0.45, 3, 2),
    ...VAU_branch("a2", "a", VAU_mid(VAU_T, VAU_A[0], VAU_A[1]), [0.9, 0.75, -0.75], 2.3, 0.28, 0.36, 4, 1),
    ...VAU_branch("b2", "b", VAU_mid([0.05, 1.95, 0], VAU_B[0], VAU_B[1]), [-1, 0.7, 0.2], 2.6, 0.27, 0.35, 5, 1),
    ...VAU_branch("c2", "c", VAU_mid([0.05, 1.65, -0.02], VAU_C[0], VAU_C[1]), [0.55, 0.8, -0.8], 2.0, 0.28, 0.36, 6, 1),
    // a young shoot low on the trunk
    ...VAU_branch("d", "trunk", [0.04, 1.2, 0.02], [0.3, 0.8, 1], 1.5, 0.22, 0.29, 7, 1),
  ],
  motions: [
    // the whole bush leans with the surge, each branch a little out of step, its tip later still
    { role: "sway", axis: "side", amp: 0.026, ampK: 0.018, rate: 0.23, lag: 0.13, tipLag: 0.14, clock: "time" },
    { role: "sway", axis: "up", amp: 0.02, ampK: 0.014, rate: 0.17, lag: 0.21, tipLag: 0.11, offset: 1.3, clock: "time" },
  ],
}

const VAU_LOOK: Look = {
  base: 0xc9973a, back: 0xb07a26, belly: 0xd9b566, accent: 0x8a5a1c, horn: 0x241307, hornTip: 0x241307,
  cell: 0.1, relief: 0.03, cellVary: 0.3, blotch: 0.3, blotchSize: 1.4, mottle: 0.35, rough: 0.9, spec: 0.06, wrap: 0.55, rim: 0.3, occlude: 0.5,
}

// Dinomischus isolatus (centimetres): a stalked cup fringed with stiff bracts. Origin: its holdfast on the mud.
// ROM Burgess Shale gallery (fetched): a cup-shaped calyx on a long rigid stem ending in a bulbous swelling (the
// holdfast); 20 stiff bracts up to 4.5 mm long round the calyx's upper margin, pointing up past the mouth and anus,
// which both sit on the upper surface; specimens 18, 20 and 28 mm tall. Wikipedia (fetched): bracts are solid
// plates about two-thirds the length of the calyx. Stalk thickness, calyx width and the colour are this model's.

const DIN_TOP: [number, number, number] = [0.05, 1.62, 0.02] // where the stalk ends and the calyx begins
const DIN_CUP = 0.62 // calyx height
const DIN_RIM = 0.25 // calyx radius at the rim
const DIN_N = 20
const DIN_bract = (i: number): PartSpec => {
  const a = ((i + 0.5) / DIN_N) * Math.PI * 2
  const c = Math.cos(a), s = Math.sin(a)
  const L = 0.4 + 0.04 * Math.sin(i * 2.4) // not all quite alike
  const R = DIN_RIM * 0.97
  return {
    name: "bract" + i, on: "calyx", origin: [DIN_TOP[0] + c * R, DIN_TOP[1] + DIN_CUP * 0.93, DIN_TOP[2] + s * R],
    // up, leaning out a little, the tip curving back in
    path: [[c * 0.07, L * 0.5, s * 0.07], [c * 0.1, L, s * 0.1]], up: [c, 0.15, s],
    sect: [{ at: 0, w: 0.036, up: 0.013 }, { at: 0.35, w: 0.04, up: 0.01 }, { at: 0.8, w: 0.028, up: 0.007 }, { at: 1, w: 0.006, up: 0.004 }],
    rings: 6, sides: 6, cap: "point", fillet: 0.015, bones: 1, role: "bract", row: i, mat: MAT.shell, minDetail: i % 2 ? 0.3 : 0,
  }
}

const DIN_SPEC: CreatureSpec = {
  name: "dinomischus",
  body: {
    // the holdfast: a small bulb, half sunk in the mud
    spine: [[-0.17, 0.09, 0], [0, 0.11, 0], [0.17, 0.09, 0]],
    sect: [{ at: 0, w: 0.05, up: 0.05 }, { at: 0.5, w: 0.17, up: 0.15, dn: 0.14, n: 2.2 }, { at: 1, w: 0.05, up: 0.05 }],
    rings: 10, sides: 12, bones: 2, caps: ["round", "round"],
  },
  parts: [
    {
      name: "stalk", origin: [0, 0.2, 0], path: [[0.03, 0.4, -0.02], [-0.01, 0.9, 0.01], [DIN_TOP[0], DIN_TOP[1] - 0.2, DIN_TOP[2]]], up: [1, 0, 0],
      sect: [{ at: 0, w: 0.06, up: 0.06 }, { at: 0.12, w: 0.042, up: 0.042 }, { at: 0.85, w: 0.036, up: 0.036 }, { at: 1, w: 0.05, up: 0.05 }],
      rings: 22, sides: 8, cap: "round", fillet: 0.05, bones: 4, role: "stalk",
    },
    {
      name: "calyx", on: "stalk", origin: DIN_TOP, path: [[0, DIN_CUP * 0.5, 0], [0, DIN_CUP, 0]], up: [1, 0, 0],
      sect: [{ at: 0, w: 0.05, up: 0.05 }, { at: 0.18, w: 0.13, up: 0.13 }, { at: 0.5, w: 0.215, up: 0.215 }, { at: 0.85, w: DIN_RIM, up: DIN_RIM }, { at: 0.96, w: DIN_RIM * 0.98, up: DIN_RIM * 0.98 }, { at: 1, w: DIN_RIM * 0.86, up: DIN_RIM * 0.86 }],
      rings: 16, sides: 20, cap: "flat", fillet: 0.03,
    },
    // the upper surface: the mouth, and the anus on its low cone beside it
    { name: "mouth", on: "calyx", origin: [DIN_TOP[0] - 0.07, DIN_TOP[1] + DIN_CUP, DIN_TOP[2]], path: [[0, 0.025, 0]], up: [1, 0, 0], sect: [{ at: 0, w: 0.075, up: 0.075 }, { at: 1, w: 0.06, up: 0.06 }], rings: 2, sides: 10, cap: "flat", fillet: 0, mat: MAT.mouth, minDetail: 0.4 },
    { name: "anus", on: "calyx", origin: [DIN_TOP[0] + 0.1, DIN_TOP[1] + DIN_CUP, DIN_TOP[2] + 0.02], path: [[0.01, 0.07, 0]], up: [1, 0, 0], sect: [{ at: 0, w: 0.05, up: 0.05 }, { at: 1, w: 0.022, up: 0.022 }], rings: 3, sides: 8, cap: "flat", fillet: 0.01, minDetail: 0.9 },
    ...Array.from({ length: DIN_N }, (_, i) => DIN_bract(i)),
  ],
  motions: [
    // a stiff stem: it nods as one piece, the cup trailing the foot
    { role: "stalk", axis: "side", amp: 0.022, ampK: 0.012, rate: 0.31, tipLag: 0.09, clock: "time" },
    { role: "stalk", axis: "up", amp: 0.018, ampK: 0.01, rate: 0.23, tipLag: 0.07, offset: 0.9, clock: "time" },
    // the bracts barely give: a slow wave round the ring, as if combing the current
    { role: "bract", axis: "side", amp: 0.07, rate: 0.4, lag: 0.05, clock: "time" },
  ],
}

const DIN_LOOK: Look = {
  base: 0xe6b8a6, back: 0xd99a8a, belly: 0xf0d6c4, accent: 0xb86a5a, shell: 0xc23a4e,
  cell: 0.022, relief: 0.003, cellVary: 0.12, blotch: 0.2, blotchSize: 0.3, mottle: 0.2, rough: 0.6, spec: 0.2, wrap: 0.5, rim: 0.4,
}

// Chancelloria eros (centimetres): an upright spiny sack. Origin: its base on the mud.
// ROM Burgess Shale gallery (fetched): like "a cylindrical cactus up to 20 centimetres tall"; star-shaped spicules,
// millimetric to about 1 cm across, in a loose unconnected net; each has hollow rays joined at a centre like an
// umbrella, one central ray pointing outward and four to seven others lying closer to the body surface; the spines
// form a tight ring round a pore at the top. The taper toward the base, the sclerite count and the colour are this model's.

const CHA_H = 13 // height of the sack
/** Radius of the sack at height fraction t: narrow at the foot, fullest two thirds up, drawn in to the pore. */
const CHA_r = (t: number) => 0.55 + 1.75 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.75) * 0.93)), 0.8) * (1 - 0.25 * t)
const CHA_sway = (y: number) => 0.25 * Math.sin(y * 0.22) // the sack's slight lean, shared by everything set on it
/** One ray: a hollow spine from `o` along `d`. */
const CHA_ray = (name: string, o: [number, number, number], d: [number, number, number], L: number, r: number, minDetail: number): PartSpec => ({
  name, on: "sack", origin: o, path: [[d[0] * L, d[1] * L, d[2] * L]], sect: [{ at: 0, w: r, up: r }, { at: 0.5, w: r * 0.6, up: r * 0.6 }, { at: 1, w: r * 0.1, up: r * 0.1 }],
  rings: 2, sides: 4, cap: "point", fillet: 0, mat: MAT.horn, minDetail,
})
/** A sclerite at height fraction t and angle a: a central ray standing out of the skin and `n` rays splayed close to it. */
const CHA_sclerite = (i: number, t: number, a: number, n: number, size: number): PartSpec[] => {
  const y = 0.3 + t * CHA_H, R = CHA_r(t) * 0.97
  const c = Math.cos(a), s = Math.sin(a)
  const o: [number, number, number] = [CHA_sway(y) + c * R, y, s * R]
  const out: PartSpec[] = [CHA_ray(`s${i}c`, o, [c * 0.94, 0.34, s * 0.94], size * 1.15, size * 0.085, 0.4)]
  for (let k = 0; k < n; k++) {
    const b = (k / n) * Math.PI * 2 + i * 0.7
    // in the tangent plane (up, and round the sack), lifted a quarter of the way out
    const tx = -s * Math.cos(b), ty = Math.sin(b), tz = c * Math.cos(b)
    out.push(CHA_ray(`s${i}r${k}`, o, [tx * 0.95 + c * 0.3, ty * 0.95, tz * 0.95 + s * 0.3], size * (0.8 + 0.25 * Math.sin(i * 1.7 + k)), size * 0.07, k % 2 ? 0.9 : 0.5))
  }
  return out
}
const CHA_SCLERITES: PartSpec[] = (() => {
  const out: PartSpec[] = []
  let i = 0
  // rows up the sack, each offset from the one below (a loose net, not a lattice)
  for (let row = 0; row < 7; row++) {
    const t = 0.1 + row * 0.125
    const per = Math.round(3.5 + 2.6 * Math.sin(Math.PI * Math.min(1, t * 1.05)))
    for (let j = 0; j < per; j++) {
      const a = ((j + (row % 2) * 0.5 + 0.13 * Math.sin(i * 2.3)) / per) * Math.PI * 2
      out.push(...CHA_sclerite(i, t + 0.018 * Math.sin(i * 3.1), a, 4 + (i % 2) + (i % 5 === 0 ? 1 : 0), 0.72 + 0.32 * Math.sin(Math.PI * t) + 0.08 * Math.sin(i * 1.3)))
      i++
    }
  }
  return out
})()
// the ring of long spines round the pore
const CHA_TUFT: PartSpec[] = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), y = 0.3 + CHA_H * 0.985, R = CHA_r(0.985) * 0.9
  const lean = 0.28 + 0.14 * Math.sin(i * 2.1)
  return CHA_ray("tuft" + i, [CHA_sway(y) + c * R, y, s * R], [c * lean, 1, s * lean], 1.5 + 0.35 * Math.sin(i * 1.9), 0.075, i % 2 ? 0.4 : 0)
})

const CHA_SPEC: CreatureSpec = {
  name: "chancelloria",
  body: {
    // what it sits on: a low foot gripping a shell fragment
    spine: [[-0.9, 0.12, 0], [0, 0.2, 0], [0.9, 0.12, 0]],
    sect: [{ at: 0, w: 0.25, up: 0.12 }, { at: 0.5, w: 0.8, up: 0.3, dn: 0.2, n: 2.4 }, { at: 1, w: 0.25, up: 0.12 }],
    rings: 8, sides: 12, bones: 2, caps: ["round", "round"],
  },
  parts: [
    {
      name: "sack", origin: [0, 0.3, 0], path: Array.from({ length: 5 }, (_, k): [number, number, number] => [CHA_sway(0.3 + ((k + 1) / 5) * CHA_H) - CHA_sway(0.3), ((k + 1) / 5) * CHA_H, 0]), up: [1, 0, 0],
      sect: Array.from({ length: 11 }, (_, k) => ({ at: k / 10, w: CHA_r(k / 10), up: CHA_r(k / 10), n: 2.1 })),
      rings: 26, sides: 20, cap: "flat", fillet: 0.3, bones: 2, role: "sack",
    },
    { name: "pore", on: "sack", origin: [CHA_sway(0.3 + CHA_H) , 0.3 + CHA_H, 0], path: [[0, 0.06, 0]], up: [1, 0, 0], sect: [{ at: 0, w: CHA_r(1) * 0.72, up: CHA_r(1) * 0.72 }, { at: 1, w: CHA_r(1) * 0.66, up: CHA_r(1) * 0.66 }], rings: 2, sides: 12, cap: "flat", fillet: 0, mat: MAT.mouth, minDetail: 0.4 },
    ...CHA_TUFT,
    ...CHA_SCLERITES,
  ],
  // a stiff sack: it barely leans
  motions: [
    { role: "sack", axis: "side", amp: 0.012, ampK: 0.008, rate: 0.19, tipLag: 0.08, clock: "time" },
    { role: "sack", axis: "up", amp: 0.009, ampK: 0.006, rate: 0.14, tipLag: 0.06, offset: 2.1, clock: "time" },
  ],
}

const CHA_LOOK: Look = {
  base: 0x7d5a78, back: 0x6a4a6a, belly: 0x9a7890, accent: 0x4a3050, horn: 0xe9dfc6, hornTip: 0xfff6e0,
  cell: 0.5, relief: 0.022, cellVary: 0.12, blotch: 0.35, blotchSize: 2.4, mottle: 0.3, rough: 0.75, spec: 0.12, wrap: 0.45, rim: 0.3, occlude: 0.4,
}
const ZOO: Record<Key, Zoo> = {
  olenoides: { spec: OLE_spec, look: OLE_look, surface: "chitin", len: 8 },
  marrella: { spec: MAR_spec, look: MAR_look, surface: "chitin", len: 2 },
  anomalocaris: { spec: ANO_spec, look: ANO_look, surface: "chitin", len: 36 },
  opabinia: { spec: OPA_spec, look: OPA_look, surface: "skin", len: 6 },
  hallucigenia: { spec: HAL_SPEC, look: HAL_LOOK, surface: "skin", len: 22.5 },
  wiwaxia: { spec: WIW_SPEC, look: WIW_LOOK, surface: "scales", len: 50 },
  pikaia: { spec: PIK_SPEC, look: PIK_LOOK, surface: "skin", len: 40 },
  vauxia: { spec: VAU_SPEC, look: VAU_LOOK, surface: "skin", len: 8 },
  dinomischus: { spec: DIN_SPEC, look: DIN_LOOK, surface: "skin", len: 2.5 },
  chancelloria: { spec: CHA_SPEC, look: CHA_LOOK, surface: "skin", len: 13 },
}
// @@ZOO-END

// ---------------------------------------------------------------- strokes

type Stroke = { p: P2[]; w: number; tap: number; lift: number; spd: number; hip?: [number, number, number] }

/** A drawing under construction: strokes in the animal's own frame (head toward +x, length about 1). */
class Draw {
  st: Stroke[] = []
  private c: number
  private s: number
  constructor(public ox: number, public oy: number, rot: number, public sc: number, public mir = 1) {
    this.c = Math.cos(rot)
    this.s = Math.sin(rot)
  }
  tp(x: number, y: number): P2 {
    y *= this.mir
    return [this.ox + (x * this.c - y * this.s) * this.sc, this.oy + (x * this.s + y * this.c) * this.sc]
  }
  /** A polyline. `w` in nib widths, `tap` how much it thins at its ends, `spd` relative pen speed. */
  l(pts: P2[], w = 1, tap = 0.55, spd = 1, lift = 0.05) {
    this.st.push({ p: pts.map(([x, y]) => this.tp(x, y)), w, tap, lift, spd })
    return this
  }
  f(fn: (t: number) => P2, n: number, w = 1, tap = 0.55, spd = 1) {
    const pts: P2[] = []
    for (let i = 0; i <= n; i++) pts.push(fn(i / n))
    return this.l(pts, w, tap, spd)
  }
  ell(cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = TAU, w = 1, rot = 0, tap = 0.4) {
    const n = Math.max(5, Math.ceil((Math.abs(a1 - a0) * Math.max(rx, ry) * this.sc) / 0.02))
    const c = Math.cos(rot), s = Math.sin(rot)
    return this.f((t) => {
      const a = a0 + (a1 - a0) * t
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry
      return [cx + x * c - y * s, cy + x * s + y * c]
    }, n, w, tap)
  }
  ln(x0: number, y0: number, x1: number, y1: number, w = 1, tap = 0.55) {
    return this.l([[x0, y0], [x1, y1]], w, tap)
  }
  /** A quadratic curve through a control point. */
  q(a: P2, c: P2, b: P2, w = 1, tap = 0.55, n = 8) {
    return this.f((t) => [(1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]], n, w, tap)
  }
  dot(x: number, y: number, w = 1.5) {
    this.st.push({ p: [this.tp(x, y), this.tp(x + 0.0012 / this.sc, y)], w, tap: 0, lift: 0.02, spd: 0.2 })
    return this
  }
  /** Short parallel ticks from a to b: shading. */
  hatch(a: P2, b: P2, n: number, len: number, ang: number, w = 0.7) {
    const dx = Math.cos(ang) * len * 0.5, dy = Math.sin(ang) * len * 0.5
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t
      this.l([[x - dx, y - dy], [x + dx, y + dy]], w, 0.7, 1.3, 0.02)
    }
    return this
  }
  /** Mark the strokes added since `from` as one leg hinged at a hip (walker only). */
  leg(from: number, hx: number, hy: number, phase: number) {
    for (let i = from; i < this.st.length; i++) this.st[i].hip = [hx * this.sc, hy * this.sc, phase]
  }
}

// One animal, slowly. Oval, a little wider at the front; a midline; rib-like units inclined toward
// both ends, larger toward the front, the two sides offset by half a unit (glide reflection, not
// a mirror); one unpaired unit at the front. Drawn from the front (oldest) to the narrow end.
function dickinsonia(d: Draw) {
  const A = 0.5, B = 0.335
  const rim = (th: number): P2 => [A * Math.cos(th), B * Math.sin(th) * (1 + 0.13 * Math.cos(th))]
  d.f((t) => rim(t * TAU), 96, 1.5, 0.25, 0.8)
  d.f((t) => rim(0.02 + t * TAU * 0.5), 40, 0.8, 0.8, 1.1) // a second pass along the lit side: the margin is a soft roll
  const X0 = 0.37, X1 = -0.475
  d.q([X0, 0], [0, 0.006], [X1, 0], 1.25, 0.4, 30)
  // the unpaired front unit: a lobe ahead of the midline
  d.q([X0, 0], [0.43, 0.07], rim(0.33), 1, 0.5)
  d.q([X0, 0], [0.43, -0.07], rim(-0.33), 1, 0.5)
  const N = 34
  for (let i = 0; i < N; i++) {
    for (const side of [1, -1]) {
      const fi = (i + (side < 0 ? 0.5 : 0)) / N // the right-hand units sit half a step behind the left
      if (fi >= 1) continue
      const x = X0 + (X1 - X0) * fi ** 0.9
      const th = 0.36 + (Math.PI - 0.36 - 0.1) * fi ** 0.82
      const m = rim(th * side)
      const lean = (0.5 - fi) * 0.16
      const rib: [P2, P2, P2] = [[x, 0], [x + lean + 0.02, m[1] * 0.55], m]
      d.q(rib[0], rib[1], rib[2], 1.0 - 0.3 * fi, 0.6, 9)
      // quilting: each unit is a little pillow, shaded on the side away from the lamp
      const at = (t: number): P2 => [(1 - t) * (1 - t) * rib[0][0] + 2 * t * (1 - t) * rib[1][0] + t * t * rib[2][0], (1 - t) * (1 - t) * rib[0][1] + 2 * t * (1 - t) * rib[1][1] + t * t * rib[2][1]]
      const gap = (0.83 / N) * (1.25 - 0.5 * fi)
      const k = fi < 0.75 ? 4 : 2
      const a0 = at(0.2), a1 = at(0.92)
      d.hatch([a0[0] - gap * 0.3, a0[1]], [a1[0] - gap * 0.3, a1[1]], k, gap * 0.5, side > 0 ? -0.5 : 0.5, 0.55)
      if (i % 2 === 0 && fi < 0.8) d.hatch([a0[0] - gap * 0.3, a0[1]], at(0.5), 2, gap * 0.5, side > 0 ? 0.9 : -0.9, 0.5)
    }
  }
}

// Three lobes lengthwise, three sections (head shield, thorax of articulated segments, tail
// shield), crescent eyes of close-packed lenses, cheek spines.
function trilobite(d: Draw) {
  d.f((t) => { const a = -Math.PI / 2 + t * Math.PI; return [0.16 + 0.33 * Math.cos(a), 0.31 * Math.sin(a)] }, 30, 1.5, 0.3)
  for (const s of [1, -1]) {
    d.l([[0.16, 0.31 * s], [0.02, 0.345 * s], [-0.16, 0.36 * s], [-0.02, 0.31 * s], [0.14, 0.27 * s]], 1.1, 0.6)
    d.ell(0.29, 0.165 * s, 0.07, 0.035, 0.3, Math.PI - 0.3, 1.3, s > 0 ? 0.25 : -0.25) // the eye
    d.ell(0.285, 0.15 * s, 0.05, 0.02, 0.2, Math.PI - 0.2, 0.8, s > 0 ? 0.25 : -0.25)
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) d.dot(0.245 + k * 0.016 + r * 0.008, (0.168 + r * 0.013 + 0.012 * Math.sin((k / 5) * Math.PI)) * s, 1.0)
    d.q([0.46, 0.1 * s], [0.34, 0.11 * s], [0.33, 0.14 * s], 0.7, 0.6) // facial suture
    d.q([0.25, 0.185 * s], [0.2, 0.25 * s], [0.16, 0.25 * s], 0.7, 0.6)
    d.q([0.17, 0.085 * s], [-0.1, 0.085 * s], [-0.42, 0.03 * s], 1.0, 0.4, 16) // axial furrow
    for (let k = 0; k < 3; k++) d.ln(0.36 - k * 0.055, 0.035 * s, 0.34 - k * 0.055, 0.085 * s, 0.7)
  }
  d.ell(0.31, 0, 0.145, 0.085, 0, TAU, 1.1)
  d.ln(0.16, -0.27, 0.16, 0.27, 1.1, 0.3)
  for (let k = 0; k < 11; k++) {
    const x = 0.16 - (k + 1) * 0.04, wv = 0.3 - 0.007 * k
    const ax = 0.085 - 0.004 * k
    d.q([x, -ax], [x + 0.012, 0], [x, ax], 1.0, 0.4, 5)
    for (const s of [1, -1]) {
      d.q([x, ax * s], [x - 0.004, wv * 0.6 * s], [x - 0.03, wv * s], 0.9, 0.5, 6)
      d.ln(x - 0.03, wv * s, x - 0.052, (wv - 0.012) * s, 0.9, 0.6)
      if (k % 2 === 0) d.hatch([x - 0.012, (ax + 0.03) * s], [x - 0.016, wv * 0.7 * s], 3, 0.022, s * 0.4, 0.5)
    }
  }
  d.f((t) => { const a = Math.PI / 2 + t * Math.PI; return [-0.3 + 0.2 * Math.cos(a), 0.215 * Math.sin(a)] }, 20, 1.4, 0.3)
  for (let k = 0; k < 4; k++) {
    d.ln(-0.33 - k * 0.03, -0.04 + k * 0.007, -0.33 - k * 0.03, 0.04 - k * 0.007, 0.8)
    for (const s of [1, -1]) d.q([-0.31 - k * 0.02, 0.05 * s], [-0.36 - k * 0.02, 0.1 * s], [-0.37 - k * 0.025, (0.19 - k * 0.04) * s], 0.7, 0.6, 5)
  }
}

// A predator: paired spined frontal appendages, stalked compound eyes, overlapping swimming
// flaps, a tail fan.
function radiodont(d: Draw) {
  const half = (x: number) => 0.11 * Math.sqrt(Math.max(0, 1 - ((x + 0.08) / 0.42) ** 2)) + 0.012
  d.f((t) => { const x = 0.33 - t * 0.83; return [x, half(x)] }, 26, 1.3, 0.4)
  d.f((t) => { const x = 0.33 - t * 0.83; return [x, -half(x)] }, 26, 1.3, 0.4)
  d.ell(0.36, 0, 0.075, 0.1, -1.9, 1.9, 1.3)
  for (let k = 0; k < 12; k++) {
    const x = 0.24 - k * 0.055, h = half(x), len = 0.2 * Math.sin(((k + 1.2) / 13.5) * Math.PI) + 0.04
    for (const s of [1, -1]) {
      d.l([[x, h * s], [x - 0.02, (h + len * 0.6) * s], [x - 0.07, (h + len) * s], [x - 0.1, (h + len * 0.72) * s], [x - 0.065, h * s]], 1.0, 0.5)
      d.hatch([x - 0.03, (h + len * 0.3) * s], [x - 0.07, (h + len * 0.8) * s], 4, 0.035, s * 1.1, 0.45) // strengthening rays
    }
    d.q([x, -h * 0.8], [x - 0.015, 0], [x, h * 0.8], 0.6, 0.5, 5)
  }
  for (const s of [1, -1]) {
    for (let k = 0; k < 3; k++) d.l([[-0.48, 0.015 * s], [-0.56 - k * 0.03, (0.07 + k * 0.045) * s], [-0.64 - k * 0.025, (0.1 + k * 0.06) * s], [-0.55, (0.03 + k * 0.012) * s]], 0.9, 0.5)
    d.ln(0.37, 0.08 * s, 0.4, 0.19 * s, 1.2, 0.2) // eye stalk
    d.ell(0.405, 0.225 * s, 0.045, 0.04, 0, TAU, 1.2)
    for (let r = -1; r <= 1; r++) for (let k = -1; k <= 1; k++) d.dot(0.405 + k * 0.02 + (r & 1) * 0.01, (0.225 + r * 0.017) * s, 0.9)
    // the great appendage: a curling, jointed arm with a spine on every joint
    const arm = (t: number): P2 => { const a = 0.2 + t * 2.5; const r = 0.2 - t * 0.09; return [0.42 + Math.sin(a) * r * 1.15, (0.03 + (1 - Math.cos(a)) * r * 0.62) * s] }
    const arm2 = (t: number): P2 => { const p = arm(t), a = 0.2 + t * 2.5, w = 0.034 * (1 - t * 0.75); return [p[0] - Math.sin(a) * w, p[1] - Math.cos(a) * w * s] }
    d.f(arm, 22, 1.25, 0.4)
    d.f(arm2, 22, 1.0, 0.5)
    for (let k = 1; k <= 11; k++) {
      const t = k / 12, p = arm(t), q = arm2(t)
      d.ln(p[0], p[1], q[0], q[1], 0.6)
      const a = 0.2 + t * 2.5, L = 0.07 * (1 - t * 0.5)
      d.ln(q[0], q[1], q[0] - Math.sin(a + 0.5) * L, q[1] - Math.cos(a + 0.5) * L * s, 0.75, 0.9)
    }
  }
}

// Five eyes on stalks and a long flexible proboscis ending in a claw.
function fiveEyes(d: Draw) {
  const half = (x: number) => 0.075 * Math.sqrt(Math.max(0, 1 - (x / 0.4) ** 2)) + 0.012
  d.f((t) => { const x = 0.3 - t * 0.68; return [x, half(x)] }, 22, 1.25, 0.4)
  d.f((t) => { const x = 0.3 - t * 0.68; return [x, -half(x)] }, 22, 1.25, 0.4)
  d.ell(0.33, 0, 0.065, 0.075, -2.0, 2.0, 1.25)
  for (let k = 0; k < 15; k++) {
    const x = 0.25 - k * 0.04, h = half(x), len = 0.075 + 0.03 * Math.sin((k / 14) * Math.PI)
    for (const s of [1, -1]) {
      d.l([[x, h * s], [x - 0.005, (h + len) * s], [x - 0.035, (h + len * 0.95) * s], [x - 0.04, h * s]], 0.95, 0.5)
      d.hatch([x - 0.01, (h + 0.012) * s], [x - 0.03, (h + 0.012) * s], 3, len * 0.55, s * 1.45, 0.4) // gills
    }
  }
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) d.l([[-0.38, 0.012 * s], [-0.44 - k * 0.03, (0.07 + k * 0.03) * s], [-0.5 - k * 0.03, (0.12 + k * 0.045) * s], [-0.43, 0.02 * s]], 0.85, 0.5)
  const eyes: P2[] = [[0.335, 0.0], [0.345, 0.05], [0.345, -0.05], [0.3, 0.07], [0.3, -0.07]]
  for (const [x, y] of eyes) { d.ell(x, y, 0.02, 0.02, 0, TAU, 1.2); d.dot(x, y, 1.6) }
  const pr = (t: number): P2 => [0.39 + t * 0.34, 0.0 - Math.sin(t * 2.6) * 0.07 - t * t * 0.1]
  d.f(pr, 22, 1.1, 0.3)
  d.f((t) => { const p = pr(t); return [p[0] + 0.004, p[1] - 0.03 * (1 - 0.3 * t)] }, 22, 0.9, 0.4)
  for (let k = 1; k < 16; k++) { const p = pr(k / 16); d.ln(p[0], p[1], p[0] + 0.004, p[1] - 0.03 * (1 - 0.3 * (k / 16)), 0.45) }
  const tip = pr(1)
  for (const s of [1, -1]) {
    d.q([tip[0], tip[1] - 0.012], [tip[0] + 0.05, tip[1] - 0.012 + 0.04 * s], [tip[0] + 0.085, tip[1] - 0.012 + 0.012 * s], 1.1, 0.6)
    for (let k = 0; k < 4; k++) d.ln(tip[0] + 0.03 + k * 0.015, tip[1] - 0.012 + (0.028 - k * 0.003) * s, tip[0] + 0.036 + k * 0.015, tip[1] - 0.012 + 0.006 * s, 0.6, 0.8)
  }
}

// A worm on legs: paired spines up, clawed legs down. Drawn from the side.
function lobopod(d: Draw) {
  const mid = (x: number) => 0.045 * Math.sin((x + 0.1) * 3.2)
  d.f((t) => { const x = 0.42 - t * 0.84; return [x, mid(x) + 0.038] }, 26, 1.25, 0.4)
  d.f((t) => { const x = 0.42 - t * 0.84; return [x, mid(x) - 0.038] }, 26, 1.25, 0.4)
  d.ell(0.47, mid(0.42) + 0.0, 0.06, 0.036, -2.2, 2.2, 1.2, 0.15)
  d.dot(0.485, mid(0.42) + 0.012, 1.8)
  d.ell(-0.435, mid(-0.42), 0.02, 0.038, 1.4, 4.9, 1.1)
  for (let k = 0; k < 7; k++) {
    const x = 0.3 - k * 0.1, y = mid(x)
    for (const o of [0, 0.022]) {
      d.l([[x + o - 0.012, y + 0.036], [x + o + 0.012 * (k - 3) * 0.3, y + 0.25 - o * 2]], 1.25, 0.85) // spine
      d.l([[x + o + 0.012, y + 0.036], [x + o + 0.012 * (k - 3) * 0.3, y + 0.25 - o * 2]], 0.7, 0.85)
    }
    d.ell(x + 0.011, y + 0.04, 0.03, 0.012, Math.PI, TAU, 0.8) // the plate each pair stands on
    for (const o of [0, 0.03]) {
      const fx = x - 0.03 + o
      d.q([fx, y - 0.036], [fx - 0.02, y - 0.12], [fx + 0.012, y - 0.2 + o * 0.6], 1.0, 0.5, 7)
      d.q([fx + 0.02, y - 0.036], [fx + 0.004, y - 0.12], [fx + 0.022, y - 0.2 + o * 0.6], 0.8, 0.5, 7)
      d.ln(fx + 0.014, y - 0.2 + o * 0.6, fx + 0.03, y - 0.215 + o * 0.6, 0.9, 0.9)
    }
    for (let j = 0; j < 3; j++) d.ln(x - 0.03 - j * 0.02, y - 0.032, x - 0.032 - j * 0.02, y + 0.032, 0.35, 0.4)
  }
  for (const s of [0.02, -0.01, -0.035]) d.q([0.52, mid(0.42) + s], [0.6, mid(0.42) + s * 3], [0.64, mid(0.42) + s * 5 - 0.02], 0.7, 0.8, 6)
}

// A tongue-shaped shell on a long stalk, with growth lines.
function lingulid(d: Draw) {
  const rim = (th: number, k = 1): P2 => { const c = Math.cos(th), s = Math.sin(th); return [0.08 + (0.3 * c - 0.05 * c * c) * k, 0.2 * s * (1 - 0.18 * c) * k] }
  d.f((t) => rim(t * TAU), 60, 1.5, 0.25)
  for (let k = 1; k <= 6; k++) d.f((t) => { const p = rim(-2.2 + t * 4.4, 1 - k * 0.13); return [p[0] - k * 0.022, p[1]] }, 26, 0.7, 0.7)
  for (let k = -5; k <= 5; k++) { const a = k * 0.2; d.ln(-0.14 + 0.1 * Math.cos(a), 0.1 * Math.sin(a) * 0.66, -0.14 + 0.47 * Math.cos(a), 0.31 * Math.sin(a) * 0.66, 0.4, 0.8) }
  for (let k = -9; k <= 9; k++) { const p = rim(k * 0.13); d.ln(p[0], p[1], p[0] + 0.035 * Math.cos(k * 0.13), p[1] + 0.035 * Math.sin(k * 0.13), 0.5, 0.9) } // bristles at the gape
  d.f((t) => [-0.22 - t * 0.42, 0.012 + 0.03 * Math.sin(t * 7) * t], 24, 1.2, 0.3)
  d.f((t) => [-0.22 - t * 0.42, -0.014 + 0.03 * Math.sin(t * 7) * t], 24, 1.0, 0.3)
  for (let k = 1; k < 12; k++) { const t = k / 12, y = 0.03 * Math.sin(t * 7) * t; d.ln(-0.22 - t * 0.42, y + 0.012, -0.225 - t * 0.42, y - 0.014, 0.4) }
}

// A cone with a lid and two curved props.
function coneShell(d: Draw) {
  d.l([[0.3, 0.12], [-0.5, 0.0], [0.3, -0.12]], 1.4, 0.3)
  d.ell(0.3, 0, 0.035, 0.12, 0, TAU, 1.2)
  d.ell(0.33, 0, 0.05, 0.1, -1.6, 1.6, 1.1)
  for (let k = 1; k < 13; k++) { const x = 0.3 - k * 0.06, h = 0.12 * ((x + 0.5) / 0.8); d.ell(x, 0, 0.012, h, -1.5, 1.5, 0.55) }
  for (const s of [1, -1]) {
    d.q([0.3, 0.1 * s], [0.42, 0.34 * s], [0.12, 0.42 * s], 1.2, 0.8, 12)
    d.hatch([0.2, 0.085 * s], [-0.4, 0.008 * s], 9, 0.03, s * 0.9, 0.45)
  }
}

// A small arthropod behind a head shield with two pairs of long back-swept spines, and a great
// many legs, each with a feathery gill.
function laceCrab(d: Draw) {
  d.l([[0.3, 0.0], [0.24, 0.075], [0.14, 0.085], [0.12, 0], [0.14, -0.085], [0.24, -0.075], [0.3, 0]], 1.3, 0.3)
  for (const s of [1, -1]) {
    d.q([0.22, 0.08 * s], [0.1, 0.36 * s], [-0.42, 0.3 * s], 1.3, 0.75, 16)
    d.q([0.15, 0.06 * s], [-0.05, 0.19 * s], [-0.5, 0.1 * s], 1.2, 0.75, 16)
    d.q([0.29, 0.02 * s], [0.5, 0.12 * s], [0.6, 0.3 * s], 0.8, 0.8, 12) // antenna
    d.q([0.27, 0.05 * s], [0.4, 0.18 * s], [0.38, 0.32 * s], 0.9, 0.7, 10)
    for (let k = 0; k < 5; k++) d.ln(0.39 - k * 0.004, (0.24 + k * 0.016) * s, 0.43, (0.25 + k * 0.016) * s, 0.4, 0.9)
  }
  d.f((t) => [0.12 - t * 0.52, 0.03 * (1 - t)], 14, 1.0, 0.4)
  d.f((t) => [0.12 - t * 0.52, -0.03 * (1 - t)], 14, 1.0, 0.4)
  for (let k = 0; k < 22; k++) {
    const x = 0.11 - k * 0.023, w = 0.03 * (1 - k / 22), L = 0.15 * (1 - (k / 22) * 0.75)
    d.ln(x, -w, x, w, 0.45)
    for (const s of [1, -1]) {
      d.q([x, w * s], [x - 0.01, (w + L * 0.6) * s], [x - 0.045, (w + L) * s], 0.7, 0.8, 5)
      if (k % 2 === 0) d.hatch([x - 0.006, (w + 0.02) * s], [x - 0.03, (w + L * 0.8) * s], 3, 0.02, s * 0.3, 0.35)
    }
  }
}

// An oval armoured in overlapping scales, with two rows of long blades.
function scaled(d: Draw) {
  d.ell(0, 0, 0.36, 0.25, 0, TAU, 1.3)
  for (let r = 0; r < 5; r++) {
    const ry = -0.18 + r * 0.09, n = 9 - Math.abs(r - 2)
    for (let k = 0; k < n; k++) {
      const x = -0.27 + ((k + (r & 1) * 0.5) / n) * 0.56
      if ((x / 0.36) ** 2 + (ry / 0.25) ** 2 > 0.82) continue
      d.l([[x - 0.035, ry + 0.035], [x - 0.04, ry - 0.01], [x, ry - 0.045], [x + 0.04, ry - 0.01], [x + 0.035, ry + 0.035]], 0.9, 0.45)
      d.ln(x, ry + 0.03, x, ry - 0.035, 0.4, 0.8)
      d.hatch([x + 0.012, ry + 0.02], [x + 0.03, ry - 0.005], 2, 0.022, 1.2, 0.35)
    }
  }
  for (let k = 0; k < 8; k++) {
    const x = -0.26 + k * 0.075, L = 0.2 + 0.13 * Math.sin((k / 7) * Math.PI)
    for (const s of [1, -1]) {
      d.l([[x - 0.014, 0.1 * s], [x - 0.03, (0.1 + L * 0.7) * s], [x - 0.05, (0.1 + L) * s]], 1.2, 0.8)
      d.l([[x + 0.014, 0.1 * s], [x - 0.012, (0.1 + L * 0.7) * s], [x - 0.05, (0.1 + L) * s]], 0.8, 0.8)
    }
  }
}

// A ringed worm in a U-shaped burrow, its spiny proboscis out. A section through the mud.
function burrowWorm(d: Draw) {
  const u = (t: number, r: number): P2 => { const a = Math.PI + t * Math.PI; return [Math.cos(a) * (0.3 + r), 0.18 + Math.sin(a) * (0.42 + r)] }
  d.ln(-0.56, 0.2, 0.56, 0.2, 0.9, 0.2) // the sea floor
  for (const r of [0.075, -0.075]) d.f((t) => u(t, r), 30, 0.75, 0.3)
  for (let k = 0; k < 36; k++) { const a = (k * 2.399) % TAU, rr = 0.1 + ((k * 0.618) % 1) * 0.42; const x = Math.cos(a) * rr * 1.25, y = -0.1 - Math.abs(Math.sin(a) * rr); if (Math.abs(Math.hypot(x / (0.3), (y - 0.18) / 0.42) - 1) > 0.32) d.dot(x, y, 0.9) }
  for (const r of [0.045, -0.045]) d.f((t) => u(0.06 + t * 0.9, r), 30, 1.2, 0.3)
  for (let k = 0; k <= 40; k++) { const t = 0.06 + (k / 40) * 0.9, a = u(t, 0.045), b = u(t, -0.045); d.ln(a[0], a[1], b[0], b[1], 0.5, 0.3) }
  const e = u(0.96, 0)
  d.l([[e[0] - 0.045, e[1]], [e[0] - 0.03, e[1] + 0.13], [e[0], e[1] + 0.17], [e[0] + 0.03, e[1] + 0.13], [e[0] + 0.045, e[1]]], 1.2, 0.3)
  for (let r = 0; r < 4; r++) for (let k = -2; k <= 2; k++) d.ln(e[0] + k * 0.014, e[1] + 0.03 + r * 0.03, e[0] + k * 0.014 + 0.006 * k, e[1] + 0.045 + r * 0.03, 0.7, 0.9)
}

// A slender swimmer: a rod along the back and blocks of muscle in chevrons.
function chordate(d: Draw) {
  const half = (x: number) => 0.07 * Math.sin(clamp((x + 0.5) / 1.0) * Math.PI) ** 0.6 + 0.004
  const bend = (x: number) => 0.03 * Math.sin(x * 5)
  d.f((t) => { const x = 0.5 - t; return [x, bend(x) + half(x)] }, 34, 1.3, 0.4)
  d.f((t) => { const x = 0.5 - t; return [x, bend(x) - half(x)] }, 34, 1.3, 0.4)
  d.f((t) => { const x = 0.42 - t * 0.86; return [x, bend(x) + half(x) * 0.45] }, 30, 0.9, 0.3)
  for (let k = 0; k < 26; k++) {
    const x = 0.38 - k * 0.031, h = half(x) * 0.92, b = bend(x)
    d.l([[x - 0.02, b + h], [x + 0.012, b + h * 0.2], [x - 0.02, b - h]], 0.6, 0.4)
  }
  for (const s of [1, -1]) d.q([0.5, bend(0.5) + 0.006 * s], [0.56, bend(0.5) + 0.04 * s], [0.6, bend(0.5) + 0.03 * s], 0.8, 0.8, 6)
  d.dot(0.47, bend(0.47) + 0.004, 1.4)
  d.hatch([-0.3, bend(-0.3) - half(-0.3) * 0.5], [-0.48, bend(-0.48)], 6, 0.03, 0.2, 0.4)
}

// A cup of plates on a stalk, with thin arms: a relative of sea lilies.
function stalked(d: Draw) {
  d.f((t) => [-0.5 + t * 0.42, 0.022 + 0.01 * t], 12, 1.1, 0.3)
  d.f((t) => [-0.5 + t * 0.42, -0.022 - 0.01 * t], 12, 1.1, 0.3)
  for (let k = 0; k < 16; k++) { const t = k / 16; d.ln(-0.5 + t * 0.42, 0.022 + 0.01 * t, -0.5 + t * 0.42, -0.022 - 0.01 * t, 0.5, 0.3) }
  d.ell(-0.52, 0, 0.03, 0.06, 0, TAU, 1.1) // holdfast
  const cup = (t: number, s: number): P2 => [-0.08 + t * 0.3, s * (0.035 + 0.12 * Math.sin(t * Math.PI * 0.8) ** 0.8)]
  for (const s of [1, -1]) d.f((t) => cup(t, s), 16, 1.3, 0.3)
  d.ln(0.22, cup(1, 1)[1], 0.22, cup(1, -1)[1], 1.0, 0.3)
  for (let r = 0; r < 5; r++) for (let k = -2; k <= 2; k++) {
    const t = (r + 0.5 + (k & 1) * 0.5) / 5.6, w = cup(t, 1)[1]
    const y = (k / 2.4) * w
    if (Math.abs(y) > w * 0.9) continue
    d.ell(-0.08 + t * 0.3, y, 0.026, 0.026, 0, TAU, 0.6) // plates, each with its pore
    d.dot(-0.08 + t * 0.3, y, 0.8)
  }
  for (let k = 0; k < 9; k++) {
    const y0 = ((k - 4) / 4) * 0.1, sw = (k - 4) * 0.045
    d.f((t) => [0.22 + t * 0.3, y0 + sw * t + 0.03 * Math.sin(t * 9 + k) * t], 14, 0.85, 0.8)
  }
}

// Two valves over the front, a jointed tail behind, legs below.
function bivalved(d: Draw) {
  d.f((t) => { const a = t * TAU; return [0.1 + 0.3 * Math.cos(a), 0.02 + 0.19 * Math.sin(a) * (1 + 0.15 * Math.cos(a + 0.6))] }, 44, 1.4, 0.3)
  d.q([-0.18, 0.14], [0.1, 0.24], [0.38, 0.1], 0.8, 0.5, 12) // hinge
  for (let k = 1; k <= 3; k++) d.ell(0.1, 0.02, 0.3 - k * 0.055, 0.19 - k * 0.04, 3.4, 5.9, 0.5)
  d.ln(0.39, 0.06, 0.46, 0.1, 1.1, 0.2)
  d.ell(0.475, 0.11, 0.025, 0.025, 0, TAU, 1.2)
  d.dot(0.475, 0.11, 1.5)
  for (const s of [0.0, 0.03]) d.q([0.4, 0.02 - s], [0.52, -0.02 - s], [0.6, 0.05 - s * 3], 0.75, 0.8, 8)
  for (let k = 0; k < 7; k++) {
    const x = -0.2 - k * 0.045, h = 0.07 - k * 0.006
    d.l([[x, 0.02 + h], [x - 0.045, 0.02 + h - 0.006], [x - 0.045, 0.02 - h + 0.006], [x, 0.02 - h]], 1.0, 0.3)
  }
  d.l([[-0.515, 0.04], [-0.62, 0.09]], 1.1, 0.8)
  d.l([[-0.515, 0.0], [-0.62, -0.05]], 1.1, 0.8)
  for (let k = 0; k < 9; k++) {
    const x = 0.3 - k * 0.055
    d.l([[x, -0.15], [x - 0.012, -0.24], [x + 0.014, -0.31], [x + 0.03, -0.32]], 0.9, 0.6)
    d.ln(x - 0.012, -0.24, x - 0.035, -0.27, 0.5, 0.9)
  }
}

// The inset: a compound eye, drawn as its lenses, hexagonally close packed.
function eyeInset(d: Draw) {
  d.ell(0, 0, 0.5, 0.5, 0, TAU, 1.3, 0, 0.15)
  d.ell(0, 0, 0.46, 0.46, 0.3, TAU - 0.3, 0.5, 0, 0.6)
  const r = 0.058
  for (let j = -4; j <= 4; j++)
    for (let i = -4; i <= 4; i++) {
      const x = (i + (j & 1) * 0.5) * r * 2, y = j * r * 1.732
      if (Math.hypot(x, y) > 0.4) continue
      d.ell(x, y, r * 0.9, r * 0.9, 0, TAU, 0.85, 0, 0.2)
      d.ell(x + r * 0.2, y - r * 0.2, r * 0.45, r * 0.45, 3.6, 5.6, 0.5, 0, 0.8) // the far side of each lens in shade
    }
}

// The one that leaves: a small trilobite seen from above, legs and feelers showing at the rim.
// World units, in its own frame; the legs are hinged so they can walk.
function walker(d: Draw) {
  d.f((t) => { const a = -Math.PI / 2 + t * Math.PI; return [0.035 + 0.062 * Math.cos(a), 0.058 * Math.sin(a)] }, 14, 1.2, 0.3)
  d.ln(0.035, -0.058, 0.035, 0.058, 0.9, 0.3)
  d.ell(0.06, 0, 0.028, 0.017, 0, TAU, 0.8)
  for (const s of [1, -1]) {
    d.ell(0.058, 0.034 * s, 0.014, 0.007, 0.2, 2.9, 1.1, s * 0.3)
    d.l([[0.035, 0.058 * s], [0.0, 0.066 * s], [0.03, 0.05 * s]], 0.8, 0.6)
    d.q([0.035, 0.017 * s], [-0.03, 0.016 * s], [-0.085, 0.006 * s], 0.75, 0.4, 8)
  }
  for (let k = 0; k < 8; k++) {
    const x = 0.035 - (k + 1) * 0.0125, w = 0.056 - 0.0022 * k
    d.q([x, -w], [x + 0.004, 0], [x, w], 0.75, 0.35, 6)
  }
  d.f((t) => { const a = Math.PI / 2 + t * Math.PI; return [-0.065 + 0.036 * Math.cos(a), 0.038 * Math.sin(a)] }, 10, 1.1, 0.3)
  for (const s of [1, -1]) d.q([0.035, 0.057 * s], [-0.02, 0.058 * s], [-0.065, 0.038 * s], 1.0, 0.3, 8)
  // feelers, then seven pairs of legs: a wave runs from the back pair to the front
  for (const s of [1, -1]) {
    const n = d.st.length
    d.q([0.09, 0.012 * s], [0.13, 0.03 * s], [0.165, 0.065 * s], 0.7, 0.8, 8)
    d.leg(n, 0.09, 0.012 * s, 9 + (s > 0 ? 0 : 1.7))
    for (let k = 0; k < 7; k++) {
      const x = 0.03 - k * 0.0145, hy = (0.05 - 0.002 * k) * s
      const m = d.st.length
      d.l([[x, hy], [x + 0.004, hy + 0.024 * s], [x - 0.004, hy + 0.04 * s]], 0.85, 0.5)
      d.leg(m, x, hy, k * 0.9 + (s > 0 ? 0 : Math.PI))
    }
  }
}

// ---------------------------------------------------------------- the plate: who is where, and when the nib gets there

type Sink = { A: number[]; B: number[]; C: number[]; Hh: number[]; n: number }
const sink = (): Sink => ({ A: [], B: [], C: [], Hh: [], n: 0 })
type Scratch = { b: number; t: number; dur: number; x: number; spd: number }

/**
 * Give a drawing's strokes their times: the nib works through them in order between `t0` and `t1`
 * of beat `b` (`warp` < 1 starts slowly), and every segment goes into the instance table.
 */
function emit(dr: Draw, R: () => number, out: Sink, scr: Scratch[], b: number, t0: number, t1: number, warp = 1, wob = 1) {
  let total = 0
  const lens: number[] = []
  const pts: P2[][] = []
  for (const s of dr.st) {
    // subdivide long segments so the hand can wander along them
    const p: P2[] = [s.p[0]]
    for (let i = 1; i < s.p.length; i++) {
      const a = s.p[i - 1], c = s.p[i]
      const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 0.035))
      for (let k = 1; k <= n; k++) p.push([a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n])
    }
    let L = 0
    const f1 = 30 + R() * 30, f2 = 80 + R() * 60, ph1 = R() * 9, ph2 = R() * 9, ph3 = R() * 9, ph4 = R() * 9
    const amp = 0.0011 * wob * (s.hip ? 0.3 : 1)
    for (let i = 0; i < p.length; i++) {
      if (i) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])
      const e = p.length > 2 ? Math.min(1, i / 2, (p.length - 1 - i) / 2 + 0.3) : 0.4
      p[i] = [p[i][0] + amp * e * (Math.sin(L * f1 + ph1) + 0.5 * Math.sin(L * f2 + ph2)), p[i][1] + amp * e * (Math.sin(L * f1 * 1.13 + ph3) + 0.5 * Math.sin(L * f2 * 0.9 + ph4))]
    }
    pts.push(p)
    lens.push(L)
    total += L / s.spd + s.lift * 0.3
  }
  let acc = 0
  let ink = 0
  dr.st.forEach((s, si) => {
    const p = pts[si], L = Math.max(lens[si], 1e-4)
    const fa = acc / total
    acc += L / s.spd
    const fb = acc / total
    acc += s.lift * 0.3
    const ta = t0 + (t1 - t0) * fa ** warp, tb = t0 + (t1 - t0) * fb ** warp
    const dens = 0.8 + R() * 0.2
    const wj = 0.88 + R() * 0.24
    let l = 0
    const wAt = (x: number) => W0 * s.w * wj * (1 - s.tap + s.tap * Math.sin(Math.PI * clamp(x)) ** 0.55)
    for (let i = 1; i < p.length; i++) {
      const l0 = l
      l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])
      out.A.push(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1])
      out.B.push(wAt(l0 / L), wAt(l / L), ta + (tb - ta) * (l0 / L), ta + (tb - ta) * (l / L))
      out.C.push(b, dens, 0, R())
      out.Hh.push(s.hip?.[0] ?? 0, s.hip?.[1] ?? 0, s.hip?.[2] ?? 0, s.hip ? 1 : 0)
      out.n++
    }
    ink += L
    if (L > 0.02) scr.push({ b, t: ta, dur: tb - ta, x: p[0][0], spd: L / Math.max(tb - ta, 1e-3) })
  })
  return ink
}

/** One lettered line: where it sits in the sheet, where in the atlas, and when it is written. */
type Lettering = { str: string; italic: boolean; x: number; y: number; em: number; b: number; t0: number; t1: number; rot: number }
const LETTERS: Lettering[] = [
  { str: "Bodies you can see.", italic: false, x: 0.0, y: 0.76, em: 0.135, b: 1, t0: 0.7, t1: 2.3, rot: 0 },
  { str: "Dickinsonia", italic: true, x: -0.6, y: -0.6, em: 0.085, b: 0, t0: 6.9, t1: 7.9, rot: 0.02 },
  { str: "shells", italic: true, x: 1.47, y: 0.27, em: 0.075, b: 2, t0: 0.4, t1: 0.8, rot: -0.02 },
  { str: "legs", italic: true, x: -0.02, y: -0.56, em: 0.075, b: 2, t0: 0.72, t1: 1.05, rot: 0.02 },
  { str: "eyes", italic: true, x: 1.06, y: -0.13, em: 0.075, b: 2, t0: 1.0, t1: 1.33, rot: -0.01 },
  { str: "predators", italic: true, x: 1.05, y: -0.89, em: 0.075, b: 2, t0: 1.28, t1: 1.85, rot: 0.015 },
]

export function create(ctx: Ctx): SceneInstance {
  const R = rng(10)

  // ---------------------------------------------------------------- build the stroke tables

  const main = sink(), walk = sink()
  const scr: Scratch[] = []
  const done: { b: number; t: number; x: number }[] = []
  // beat 1: one animal, slowly
  const dk = new Draw(-0.56, -0.1, 0.2, 1.08)
  dickinsonia(dk)
  // the first stroke starts at the front of the animal, which is where the blot is
  const inkBeat = [0, 0, 0]
  inkBeat[0] += emit(dk, R, main, scr, 0, 0.35, 7.1, 0.74)
  // beat 2: then, fast. [draw, start, end]
  const page: [(d: Draw) => void, Draw, number, number][] = [
    [trilobite, new Draw(0.36, -0.06, Math.PI / 2 + 0.06, 0.72), 0.55, 6.4],
    [fiveEyes, new Draw(-1.2, 0.55, 0.08, 0.6), 0.75, 6.0],
    [radiodont, new Draw(1.06, -0.52, 0.3, 0.86), 0.95, 8.2],
    [lobopod, new Draw(-0.3, 0.5, -0.04, 0.48), 1.3, 6.6],
    [lingulid, new Draw(1.47, 0.0, 1.25, 0.4), 1.7, 6.2],
    [chordate, new Draw(-1.2, -0.74, 0.08, 0.6), 2.1, 6.8],
    [laceCrab, new Draw(0.34, -0.66, 0.5, 0.46), 2.4, 8.4],
    [burrowWorm, new Draw(-0.36, -0.76, 0, 0.34), 3.0, 8.0],
    [scaled, new Draw(-1.45, 0.02, 1.4, 0.36), 3.3, 8.8],
    [bivalved, new Draw(1.45, 0.72, -0.1, 0.34), 3.7, 9.0],
    [stalked, new Draw(0.8, -0.03, 1.5, 0.38), 4.2, 9.4],
    [coneShell, new Draw(-1.47, -0.44, 1.9, 0.3), 4.8, 9.6],
    [eyeInset, new Draw(1.06, 0.1, 0, 0.3), 5.4, 10.2],
  ]
  for (const [fn, d, t0, t1] of page) {
    fn(d)
    inkBeat[1] += emit(d, R, main, scr, 1, t0, t1, 0.85)
    done.push({ b: 1, t: t1, x: d.ox })
  }
  // a leader from the inset to the eye it enlarges, and rules under the heading
  const extra = new Draw(0, 0, 0, 1)
  for (let k = 0; k < 9; k++) extra.ln(0.9 - k * 0.045, 0.115 + k * 0.006, 0.88 - k * 0.045, 0.118 + k * 0.006, 0.6, 0.3)
  extra.f((t) => [-0.62 + t * 1.24, 0.69 + 0.004 * Math.sin(t * 9)], 30, 0.9, 0.7)
  extra.f((t) => [-0.4 + t * 0.8, 0.675], 20, 0.5, 0.8)
  inkBeat[1] += emit(extra, R, main, scr, 1, 2.3, 3.2, 1)
  // the small one: drawn in its own frame, along the first stretch of its path
  const wd = new Draw(0, 0, 0, WS)
  walker(wd)
  inkBeat[1] += emit(wd, R, walk, scr, 1, 5.0, 9.8, 0.9, 0.35)
  const wRest: P2 = walkAt(0, 0, 0, [0, 0])
  // beat 3: leaders for the four words, then the trackway
  const lead = new Draw(0, 0, 0, 1)
  lead.q([1.47, 0.245], [1.48, 0.22], [1.48, 0.19], 0.7, 0.6)
  lead.q([0.06, -0.57], [0.12, -0.585], [0.17, -0.6], 0.7, 0.6)
  lead.q([1.06, -0.1], [1.062, -0.085], [1.06, -0.065], 0.7, 0.6)
  lead.q([1.05, -0.85], [1.04, -0.82], [1.02, -0.78], 0.7, 0.6)
  inkBeat[2] += emit(lead, R, main, scr, 2, 0.8, 2.0, 1)
  // footprints: two parallel rows of small prints set across the line of travel, as arthropod
  // trackways are preserved. Each is laid down when the body has passed over it, and then dries.
  const steps: { t: number; x: number; z: number }[] = []
  {
    const a: P2 = [0, 0], b: P2 = [0, 0]
    const STRIDE = 0.03
    for (let k = 0; k * STRIDE < 2.4; k++) {
      const u = 0.02 + k * STRIDE
      // invert `walked` for the moment the middle of the body is a little past this point
      let lo = 0, hi = 12
      for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (walked(m) < u + 0.02) lo = m; else hi = m }
      const t = WALK0 + lo
      const s = k % 2 ? 1 : -1
      const fp = new Draw(0, 0, 0, 1)
      for (const side of [s, -s]) {
        const off = side === s ? 0 : STRIDE * 0.5
        walkAt(u + off, 0, 0.062 * WS * side, a)
        walkAt(u + off, 0, 0.08 * WS * side, b)
        fp.l([[a[0], a[1]], [b[0], b[1]]], 1.5, 0.3)
      }
      emit(fp, R, main, [], 2, t, t + 0.08, 1, 0.2)
      walkAt(u, 0, 0, a)
      if (k % 2 === 0) steps.push({ t, x: a[0], z: -a[1] })
    }
  }

  // ---- where the pen in the hand is in beat 1: on the stroke being drawn, lifted between strokes, then
  // writing the caption, then gone (out of the frame by the end of the beat, so the next one starts clean)
  const PS: number[] = [] // [t0, t1, x0, y0, x1, y1] per segment of the first drawing, in the order the nib reaches them
  {
    const ord: number[] = []
    for (let i = 0; i < main.n; i++) if (main.C[i * 4] === 0) ord.push(i)
    ord.sort((a, b) => main.B[a * 4 + 2] - main.B[b * 4 + 2])
    for (const i of ord) PS.push(main.B[i * 4 + 2], main.B[i * 4 + 3], main.A[i * 4], main.A[i * 4 + 1], main.A[i * 4 + 2], main.A[i * 4 + 3])
  }
  const NPS = PS.length / 6
  const CAP = LETTERS.find((l) => l.b === 0)!
  const PEN_IN = 0.35, PEN_OUT = 7.72
  /** The nib's point at second t of beat 1: [x, y on the sheet, height above it]. */
  const penAt = (t: number, o: [number, number, number]) => {
    const lift = (ax: number, ay: number, bx: number, by: number, g: number) => {
      const e = E.io2(clamp(g))
      o[0] = ax + (bx - ax) * e
      o[1] = ay + (by - ay) * e
      o[2] = 4 * g * (1 - g) * Math.min(0.035, 0.008 + 0.25 * Math.hypot(bx - ax, by - ay))
    }
    if (t <= PS[0]) {
      o[0] = PS[2]
      o[1] = PS[3]
      o[2] = 0
      return
    }
    let lo = 0, hi = NPS - 1
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1
      if (PS[m * 6] <= t) lo = m
      else hi = m - 1
    }
    const k = lo * 6
    if (t <= PS[k + 1]) {
      const g = (t - PS[k]) / Math.max(PS[k + 1] - PS[k], 1e-5)
      o[0] = PS[k + 2] + (PS[k + 4] - PS[k + 2]) * g
      o[1] = PS[k + 3] + (PS[k + 5] - PS[k + 3]) * g
      o[2] = 0
      return
    }
    if (lo + 1 < NPS) return lift(PS[k + 4], PS[k + 5], PS[k + 8], PS[k + 9], (t - PS[k + 1]) / Math.max(PS[k + 6] - PS[k + 1], 1e-5))
    // the caption, in a running italic hand along its baseline
    const cw = CAP.str.length * CAP.em * 0.4
    const c0 = Math.max(CAP.t0, PS[k + 1] + 0.25)
    if (t < c0) return lift(PS[k + 4], PS[k + 5], CAP.x - cw / 2, CAP.y, (t - PS[k + 1]) / (c0 - PS[k + 1]))
    const g = clamp((t - c0) / (CAP.t1 - c0))
    o[0] = CAP.x - cw / 2 + cw * g + 0.008 * Math.sin(g * 70)
    o[1] = CAP.y + 0.012 * Math.abs(Math.sin(g * 36)) - 0.004
    o[2] = 0.002 * Math.max(0, Math.sin(g * 23))
  }
  const penP: [number, number, number] = [0, 0, 0]
  const penQ: [number, number, number] = [0, 0, 0]

  // ---------------------------------------------------------------- uniforms shared by everything

  const uAt = uniform(new THREE.Vector3()) // seconds into each beat (large once it has passed)
  const uPx = uniform(0.001) // world units per pixel at clip w = 1, for the camera being drawn
  const uRes = uniform(new THREE.Vector2(1280, 720))
  const uWalk = uniform(new THREE.Vector4()) // distance walked, flex, leg phase, flex phase
  const uLoupe = uniform(new THREE.Vector3(LOUPE_REST[0], 0, -LOUPE_REST[1])) // x, lift, z
  const uBlot = uniform(new THREE.Vector4(F0[0], F0[1], 0, 0)) // sheet xy, radius, wetness
  const uShudder = uniform(0)
  const uPen = uniform(new THREE.Vector4(0, 0, 0, 0)) // the pen that draws beat 1: nib tip x, z, height off the sheet, how much of it is there
  const uInLoupe = uniform(0)
  // beat 4: (soak radius from the trackway, how deep the drying has come in from the deckle, see-through, how far the paper has gone)
  const uSea = uniform(new THREE.Vector4())
  const uSeaT = uniform(0) // the sea's own clock (beat seconds)
  const holdInk = ctx.target({ hdr: false, fixed: [2, 2] })
  const tInk = uniformTexture(holdInk.texture)
  const tSea = uniformTexture(holdInk.texture)

  // ---------------------------------------------------------------- the ink layer: instanced capsules, max-blended

  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const quad = new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)
  const MAXB = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.MaxEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor } as const
  const beatNow = (b: F): F => select(b.lessThan(0.5), uAt.x, select(b.lessThan(1.5), uAt.y, uAt.z)) as F

  // TSL twin of `walkAt`: a point of the animal's own frame, bent along the path it walks
  const bz = (t: F): V2 => {
    const a = t.oneMinus()
    return vec2(BEZ[0][0], BEZ[0][1]).mul(a.mul(a).mul(a)).add(vec2(BEZ[1][0], BEZ[1][1]).mul(a.mul(a).mul(t).mul(3))).add(vec2(BEZ[2][0], BEZ[2][1]).mul(a.mul(t).mul(t).mul(3))).add(vec2(BEZ[3][0], BEZ[3][1]).mul(t.mul(t).mul(t))) as V2
  }
  const bzD = (t: F): V2 => {
    const a = t.oneMinus()
    return vec2(BEZ[1][0] - BEZ[0][0], BEZ[1][1] - BEZ[0][1]).mul(a.mul(a).mul(3)).add(vec2(BEZ[2][0] - BEZ[1][0], BEZ[2][1] - BEZ[1][1]).mul(a.mul(t).mul(6))).add(vec2(BEZ[3][0] - BEZ[2][0], BEZ[3][1] - BEZ[2][1]).mul(t.mul(t).mul(3))) as V2
  }
  const walkXf = (p_: V2, hip: V4): V2 => {
    // a leg swings about its hip; the wave of phases runs along the body
    const rel = p_.sub(hip.xy)
    const ang = sin(uWalk.z.add(hip.z)).mul(0.55).mul(hip.w).mul(uWalk.y.mul(0.6).add(clampN(uWalk.x.mul(30), 0, 1)))
    const c = cos(ang), s = sin(ang)
    const p = hip.xy.add(vec2(rel.x.mul(c).sub(rel.y.mul(s)), rel.x.mul(s).add(rel.y.mul(c))))
    // the flex: a wave down the body, in place
    const y = p.y.add(uWalk.y.mul(0.016).mul(sin(p.x.mul(34).add(uWalk.w))))
    const t = clampN(uWalk.x.add(S_REST).add(p.x).div(BEZ_LEN), 0, 1.3) as F
    const d = normalize(bzD(t))
    return bz(t).add(vec2(d.y.negate(), d.x).mul(y)) as V2
  }

  const strokeMat = (isWalker: boolean) => {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4"), aC = attribute("aC", "vec4")
    let p0 = aA.xy as V2, p1 = aA.zw as V2
    if (isWalker) {
      const aH = attribute("aH", "vec4") as V4
      p0 = walkXf(p0, aH)
      p1 = walkXf(p1, aH)
    }
    const now = beatNow(aC.x as F)
    const d = p1.sub(p0)
    const len = max(length(d), 1e-5)
    const dir = d.div(len)
    const nrm = vec2(dir.y.negate(), dir.x)
    const ctr = p0.add(p1).mul(0.5)
    const wpp = uPx.mul(viewProj.mul(vec4(ctr.x, 0, ctr.y.negate(), 1)).w)
    const minw = wpp.mul(0.8)
    const pad = max(max(aB.x, aB.y), minw).mul(2.3).add(wpp.mul(2.2))
    const local = vec2(positionGeometry.x.mul(len.mul(0.5).add(pad)).add(len.mul(0.5)), positionGeometry.y.mul(pad))
    const wp = p0.add(dir.mul(local.x)).add(nrm.mul(local.y))
    const clip = viewProj.mul(vec4(wp.x, 0, wp.y.negate(), 1))
    const m = new THREE.NodeMaterial()
    m.name = isWalker ? "cambrianWalker" : "cambrianInk"
    // (a stroke the nib has not reached is thrown off screen: it costs no fill)
    m.vertexNode = select(now.lessThan(aB.z), vec4(2, 2, 2, 1), clip) as THREE.Node<"vec4">
    const vL = local.toVarying()
    const vS = vec4(len, aB.x, aB.y, wpp).toVarying()
    const vT = vec4(aB.z, aB.w, now, aC.y).toVarying()
    m.fragmentNode = Fn(() => {
      const ln = vS.x, w = vS.w
      const hr = clampN(vT.z.sub(vT.x).div(max(vT.y.sub(vT.x), 1e-4)), 0, 1).toVar()
      const h = clampN(vL.x.div(ln), 0, hr).toVar()
      const wv = mixN(vS.y, vS.z, h).toVar()
      const r = max(wv, w.mul(0.8))
      const thin = clampN(wv.div(w.mul(0.8)), 0.25, 1)
      const dist = length(vL.sub(vec2(h.mul(ln), 0))).sub(r)
      const cov = clampN(float(0.5).sub(dist.div(w)), 0, 1).mul(thin).mul(vT.w).toVar()
      const age = vT.z.sub(mixN(vT.x, vT.y, h)).toVar()
      const wet = smoothstepRev(2.6, 0.5, age)
      const young = exp(age.mul(-0.06))
      // the nib: a glint that rides the head of the stroke while it is being drawn
      const act = step(0.0005, hr).mul(step(hr, 0.9995))
      const gd = length(vL.sub(vec2(hr.mul(ln), 0))).div(r.mul(1.3).add(w.mul(1.1)))
      const glint = exp(gd.mul(gd).negate()).mul(act)
      return vec4(cov, cov.mul(wet), cov.mul(young), glint)
    })()
    Object.assign(m, MAXB)
    return m
  }
  const strokeGeo = (s: Sink) => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", quad)
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(new Float32Array(s.A), 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(new Float32Array(s.B), 4))
    g.setAttribute("aC", new THREE.InstancedBufferAttribute(new Float32Array(s.C), 4))
    g.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(s.Hh), 4))
    g.instanceCount = s.n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return g
  }
  const inkScene = new THREE.Scene()
  const inkMain = new THREE.Mesh(strokeGeo(main), strokeMat(false))
  const inkWalk = new THREE.Mesh(strokeGeo(walk), strokeMat(true))
  inkMain.frustumCulled = inkWalk.frustumCulled = false
  inkScene.add(inkMain, inkWalk)

  // the lettering: IM Fell, written by the same nib (a canvas mask, revealed along the line)
  const fell = ctx.fonts.fell
  const AW = 2048, AH = 512
  const rects: [number, number, number, number][] = []
  const cv = document.createElement("canvas")
  cv.width = AW
  cv.height = AH
  {
    const c = cv.getContext("2d")!
    const r = rng(77)
    c.fillStyle = "#000"
    c.fillRect(0, 0, AW, AH)
    c.fillStyle = "#fff"
    c.textBaseline = "alphabetic"
    let x = 16, y = 0, rowH = 0
    for (const L of LETTERS) {
      const px = L.italic ? 132 : 176
      c.font = `${L.italic ? "italic " : ""}400 ${px}px ${fell}`
      const w = Math.ceil(c.measureText(L.str).width) + 44
      const h = Math.ceil(px * 1.36)
      if (x + w > AW) { x = 16; y += rowH + 8; rowH = 0 }
      rowH = Math.max(rowH, h)
      // letter by letter, so the hand shows: a wandering baseline and uneven weight
      let cx = x + 20
      for (const ch of L.str) {
        c.save()
        c.translate(cx, y + px * 1.02 + (r() - 0.5) * px * 0.03)
        c.rotate((r() - 0.5) * 0.035)
        c.globalAlpha = 0.86 + r() * 0.14
        c.fillText(ch, 0, 0)
        if (r() < 0.5) c.fillText(ch, 0.6, 0.4)
        c.restore()
        cx += c.measureText(ch).width
      }
      rects.push([x, y, w, h])
      x += w + 10
    }
  }
  const atlas = new THREE.CanvasTexture(cv)
  atlas.colorSpace = THREE.NoColorSpace
  atlas.anisotropy = 8
  const textGeo = new THREE.InstancedBufferGeometry()
  textGeo.setAttribute("position", quad)
  textGeo.setIndex([0, 1, 2, 0, 2, 3])
  {
    const aR: number[] = [], aU: number[] = [], aT: number[] = []
    LETTERS.forEach((L, i) => {
      const [x, y, w, h] = rects[i]
      const k = L.em / (L.italic ? 132 : 176)
      aR.push(L.x, L.y, (w * k) / 2, (h * k) / 2)
      aU.push(x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH)
      aT.push(L.b, L.t0, L.t1, L.rot)
    })
    textGeo.setAttribute("aR", new THREE.InstancedBufferAttribute(new Float32Array(aR), 4))
    textGeo.setAttribute("aU", new THREE.InstancedBufferAttribute(new Float32Array(aU), 4))
    textGeo.setAttribute("aT", new THREE.InstancedBufferAttribute(new Float32Array(aT), 4))
    textGeo.instanceCount = LETTERS.length
    textGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
  }
  const textMat = new THREE.NodeMaterial()
  textMat.name = "cambrianLetters"
  {
    const aR = attribute("aR", "vec4"), aU = attribute("aU", "vec4"), aT = attribute("aT", "vec4")
    const c = cos(aT.w), s = sin(aT.w)
    const q = positionGeometry.xy.mul(aR.zw)
    const wp = aR.xy.add(vec2(q.x.mul(c).sub(q.y.mul(s)), q.x.mul(s).add(q.y.mul(c))))
    const now = beatNow(aT.x as F)
    textMat.vertexNode = select(now.lessThan(aT.y), vec4(2, 2, 2, 1), viewProj.mul(vec4(wp.x, 0, wp.y.negate(), 1))) as THREE.Node<"vec4">
    const vQ = positionGeometry.xy.mul(0.5).add(0.5).toVarying()
    const vU = aU.toVarying()
    const vT = vec4(aT.y, aT.z, now, aR.z.div(aR.w)).toVarying()
    textMat.fragmentNode = Fn(() => {
      const a = texture(atlas, mixN(vU.xy, vU.zw, vQ)).r
      const fr = vT.z.sub(vT.x).div(vT.y.sub(vT.x)).toVar()
      // the hand moves along the line; within a letter it works top to bottom
      const lead = vQ.x.add(vQ.y.oneMinus().mul(0.012))
      const shown = smoothstepRev(0.012, 0, lead.sub(fr))
      const cov = a.mul(shown).toVar()
      const age = vT.z.sub(mixN(vT.x, vT.y, vQ.x))
      const wet = smoothstepRev(2.6, 0.5, age)
      const gd = length(vec2(vQ.x.sub(fr).mul(vT.w), vQ.y.sub(0.42)).div(0.16))
      const glint = exp(gd.mul(gd).negate()).mul(step(0, fr)).mul(step(fr, 1))
      return vec4(cov, cov.mul(wet), cov.mul(exp(age.mul(-0.06))), glint.mul(0.8))
    })()
    Object.assign(textMat, MAXB)
  }
  const letters = new THREE.Mesh(textGeo, textMat)
  letters.frustumCulled = false
  inkScene.add(letters)
  for (const m of [inkMain, inkWalk, letters]) m.layers.enable(1)

  // ---------------------------------------------------------------- the world rule: one lamp, and what ink does

  const KEYC = vec3(1.0, 0.86, 0.66)
  const FILL = vec3(0.4, 0.47, 0.62)
  const LP = vec3(LAMP.x, LAMP.y, LAMP.z)
  const D0 = LAMP.lengthSq()
  /** Light arriving from the lamp at p on a surface with normal n (1 on the flat sheet at the origin). */
  const lampE = (p: V3, n: V3): F => {
    const d = LP.sub(p)
    const r2 = dot(d, d)
    return max(dot(n, d.div(sqrt(r2))), 0).mul((D0 / (LAMP.y / Math.sqrt(D0))) * 1.0).div(r2) as F
  }
  const envOf = (r: V3): V3 => {
    const l = normalize(LP)
    const blob = exp(max(dot(r, l).oneMinus(), 0).mul(-26))
    const shade = exp(max(dot(r, l).oneMinus(), 0).mul(-3.5))
    return vec3(0.012, 0.011, 0.012).add(KEYC.mul(blob.mul(5).add(shade.mul(0.22)))).add(FILL.mul(0.1).mul(smoothstep(-0.2, 0.8, r.x.add(r.y.mul(0.4))))) as V3
  }
  /** One lit surface. `sh` is 1 in the light, 0 in shadow. Call inside an Fn. */
  const lampLit = (p: V3, n: V3, alb: V3, rough: Num, metal: Num, sh: Num): V3 => {
    const v = normalize(cameraPosition.sub(p)).toVar()
    const l = normalize(LP.sub(p)).toVar()
    const e = lampE(p, n).mul(sh).toVar()
    const ro = fl(rough), me = fl(metal)
    const f0 = mixN(vec3(0.04), alb, me)
    // shadows are blue-grey, never black: the fill is what is left in them
    const dif = alb.mul(me.oneMinus()).mul(KEYC.mul(e).mul(1.28).add(FILL.mul(n.y.mul(0.5).add(0.5)).mul(0.17)))
    const hv = normalize(l.add(v))
    const sp = pow(sat(dot(n, hv) as F), mixN(220, 12, ro)).mul(mixN(6, 0.25, ro)).mul(e)
    const fres = pow(sat(dot(n, v) as F).oneMinus(), 5)
    const env = envOf(reflect(v.negate(), n) as V3).mul(mixN(f0, vec3(1), fres.mul(0.6))).mul(mixN(1, 0.12, ro)).mul(me.mul(0.9).add(0.1))
    return dif.add(mixN(f0, vec3(1), fres.mul(0.4)).mul(KEYC).mul(sp)).add(env) as V3
  }

  const sdBox = (p: V2, bx: number, by: number): F => {
    const d = abs(p).sub(vec2(bx, by))
    return length(max(d, 0)).add(min(max(d.x, d.y), 0)) as F
  }
  const sdSeg = (p: V2, a: V2, b: V2): F => {
    const pa = p.sub(a), ba = b.sub(a)
    return length(pa.sub(ba.mul(clampN(dot(pa, ba).div(dot(ba, ba)), 0, 1)))) as F
  }
  /**
   * What the props do to the lamp's light on the desk plane: vec2(light 0..1, a caustic to add).
   * Each casts a tight contact shadow and a longer, softer one pushed away from the lamp.
   */
  const PEN_A: P2 = [2.46, 1.14], PEN_B: P2 = [2.96, 1.56]
  // the pen in the hand leans back toward the writer's right: from the nib up the holder
  const PEN_D = new THREE.Vector3(0.58, 0.56, 0.6).normalize()
  const BLOTTER = { x: -2.2, y: -0.3, rot: 0.32 }
  const shadowAt = Fn(([p]: [V2]) => {
    // (p is world xz) the shadow of something h above the desk lands this far along the light
    const away = p.sub(vec2(LAMP.x, LAMP.z)).div(LAMP.y).toVar()
    const s = float(1).toVar()
    const cast = (d: F, soft: number, k: Num) => s.mulAssign(smoothstepRev(soft, -soft * 0.2, d).mul(k).oneMinus())
    // the loupe: ring, legs, feet; its glass passes the light and gathers it to a spot
    const lc = uLoupe.xz
    const lift = uLoupe.y
    const lo = float(1).sub(uInLoupe)
    const ringH = lift.add(LOUPE_Y)
    const pr = p.sub(lc).sub(away.mul(ringH))
    const dr = abs(length(pr).sub(LOUPE_R + 0.012)).sub(0.03)
    const soft = lift.mul(0.5).add(0.035)
    s.mulAssign(sstep(soft, soft.mul(-0.2) as F, dr as F).mul(0.55).mul(lo).oneMinus())
    s.mulAssign(smoothstepRev(0.02, -0.02, length(pr).sub(LOUPE_R)).mul(0.1).mul(lo).oneMinus())
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5
      const foot = lc.add(vec2(Math.cos(a), Math.sin(a)).mul(LOUPE_R + 0.07)).add(away.mul(lift))
      const top = lc.add(vec2(Math.cos(a), Math.sin(a)).mul(LOUPE_R + 0.015)).add(away.mul(ringH))
      s.mulAssign(sstep(soft.mul(0.6) as F, 0, sdSeg(p, foot as V2, top as V2).sub(0.012) as F).mul(0.5).mul(lo).oneMinus())
      s.mulAssign(smoothstepRev(0.03, 0.0, length(p.sub(foot)).sub(0.018)).mul(0.5).mul(lo).mul(smoothstepRev(0.08, 0, lift)).oneMinus())
    }
    const cau = exp(dot(pr.sub(away.mul(0.05)), pr.sub(away.mul(0.05))).div(-0.006)).mul(0.5).mul(lo).mul(smoothstepRev(0.5, 0.05, lift))
    // ink bottle
    const pb = p.sub(vec2(BOTTLE[0], -BOTTLE[1]))
    cast(length(pb).sub(0.19), 0.03, 0.62)
    cast(sdSeg(pb, vec2(0, 0), away.mul(0.34) as V2).sub(0.17), 0.09, 0.5)
    // pen
    const pa = vec2(PEN_A[0], -PEN_A[1]), pq = vec2(PEN_B[0], -PEN_B[1])
    cast(sdSeg(p, pa.add(away.mul(0.012)) as V2, pq.add(away.mul(0.03)) as V2).sub(0.012), 0.025, 0.55)
    // the pen in the hand (beat 1): the nib's shadow meets its point on the paper, the holder's runs off soft
    If(uPen.w.greaterThan(0), () => {
      const tip = uPen.xy.add(away.mul(uPen.z))
      const nibE = tip.add(vec2(PEN_D.x, PEN_D.z).mul(0.15)).add(away.mul(PEN_D.y * 0.15))
      const top = tip.add(vec2(PEN_D.x, PEN_D.z).mul(1.5)).add(away.mul(PEN_D.y * 1.5))
      cast(sdSeg(p, tip as V2, nibE as V2).sub(0.007), 0.012, uPen.w.mul(0.5))
      cast(sdSeg(p, nibE as V2, top as V2).sub(0.02), 0.09, uPen.w.mul(0.38))
    })
    // blotter
    const bq = p.sub(vec2(BLOTTER.x, -BLOTTER.y))
    const cs = Math.cos(BLOTTER.rot), sn = Math.sin(BLOTTER.rot)
    const bl = vec2(bq.x.mul(cs).sub(bq.y.mul(sn)), bq.x.mul(sn).add(bq.y.mul(cs)))
    cast(sdBox(bl as V2, 0.3, 0.14), 0.03, 0.6)
    const bl2 = bl.sub(vec2(away.x.mul(cs).sub(away.y.mul(sn)), away.x.mul(sn).add(away.y.mul(cs))).mul(0.12))
    cast(sdBox(bl2 as V2, 0.3, 0.14), 0.1, 0.42)
    return vec2(s, cau)
  }) // (no setLayout: a laid-out function cannot see uniforms on WebGPU)

  /**
   * Ink on a surface. Reads the ink layer where this fragment is on screen and returns
   * vec4(coverage, wetness, youth, glint), feathered a little along `fx` (the laid furrows, as a
   * screen-space offset of about a third of a millimetre).
   */
  const inkAt = (fx: V2, tooth: F): V4 => {
    const c = tInk.sample(screenUV).level(L0).toVar()
    const a = tInk.sample(screenUV.add(fx)).level(L0)
    const b = tInk.sample(screenUV.sub(fx)).level(L0)
    // the bleed takes only where the tooth is open, so the edge is ragged, not blurred
    const bleed = max(a.r, b.r).mul(smoothstep(0.35, 0.75, tooth)).mul(0.55)
    const cov = max(c.r, bleed)
    return vec4(cov, c.g, c.b, c.a) as V4
  }
  /** The colour of the line: pale and blue-black while wet, purplish black dry, brown-black with age. */
  const inkCol = (wet: F, young: F): V3 => {
    const old = vec3(0.04, 0.022, 0.013)
    const dry = vec3(0.022, 0.018, 0.03)
    const wetc = vec3(0.03, 0.04, 0.08)
    return mixN(mixN(old, dry, smoothstep(0.05, 0.55, young)), wetc, wet.mul(wet)) as V3
  }

  // the standard vertex stage: world position and normal, interpolated
  const world = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz
  const stdVertex = viewProj.mul(vec4(world, 1))
  const vW = world.toVarying() as V3
  const vN = normalize(modelWorldMatrix.mul(vec4(normalGeometry, 0)).xyz).toVarying() as V3
  let made = 0
  const mk = (vertex: THREE.Node, fragment: THREE.Node, extra: Partial<THREE.NodeMaterial> = {}) => {
    const m = new THREE.NodeMaterial()
    m.name = `cambrian${++made}`
    m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    Object.assign(m, extra)
    return m
  }
  /** World units per pixel at this fragment, and the screen-space step that is `du` along world x. */
  const pxWorld = (p: V2) => {
    const dx = dFdx(p), dy = dFdy(p)
    const wpp = max(length(dx), length(dy))
    // invert the 2x2 Jacobian d(world xz)/d(pixel): the pixel step for one unit of world x
    const det = dx.x.mul(dy.y).sub(dx.y.mul(dy.x))
    const sx = vec2(dy.y, dx.y.negate()).div(det) // (px along screen x, px along screen y up)
    const sz = vec2(dy.x.negate(), dx.x).div(det) // the same for one unit of world z
    return { wpp, sx, sz }
  }

  // ---------------------------------------------------------------- the sheet

  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60)
  const paperGeo = new THREE.PlaneGeometry(HW * 2 + 0.16, HH * 2 + 0.16, 46, 28).rotateX(-Math.PI / 2)
  // one corner has lifted with the years; the rest lies flat (and shudders when the bead lands)
  const curl = (() => {
    const c = vec2(world.x.sub(HW), world.z.add(HH))
    const k = smoothstepRev(0.55, 0.0, length(c))
    const sh = uShudder.mul(sin(world.x.mul(7).add(world.z.mul(5)))).mul(0.006)
    return k.mul(k).mul(0.075).add(0.002).add(sh)
  })()
  const paperW = vec3(world.x, curl, world.z)
  const vPW = paperW.toVarying() as V3
  // the sheet's slow features (edge rag, cockle, foxing, show-through) never change: painted once into a map
  const bakeRT = ctx.target({ hdr: false, fixed: [2048, 1200] })
  const BW = HW + 0.08, BH = HH + 0.08
  const bakePass = ctx.pass(({ uv }) => {
    const s = uv.sub(0.5).mul(vec2(BW * 2, BH * 2)).toVar()
    const rag = fbm(s.mul(7)).sub(0.5).mul(0.022).add(vnoise(s.mul(70)).sub(0.5).mul(0.006)).add(vnoise(s.mul(260)).sub(0.5).mul(0.003))
    const cockle = fbm(s.mul(1.9).add(5))
    const vo = voronoi(s.mul(3.1).add(1.7)).toVar()
    const fox = smoothstepRev(0.2, 0.02, vo.x).mul(step(0.72, hash21(vo.yz))).mul(hash21(vo.yz.add(9.1)))
    const vo2 = voronoi(s.mul(17).add(4.4)).toVar()
    const speck = smoothstepRev(0.16, 0.03, vo2.x).mul(step(0.86, hash21(vo2.yz)))
    const row = floor(s.y.div(0.085))
    const inRow = smoothstepRev(0.3, 0.2, abs(fract(s.y.div(0.085)).sub(0.5)))
    const scrib = smoothstep(0.5, 0.62, vnoise(vec2(s.x.mul(-46).add(row.mul(7.7)), s.y.mul(70)))).mul(inRow)
    const block = smoothstep(0.1, 0.3, s.x.negate().sub(0.2)).mul(smoothstepRev(-0.25, -0.4, s.y)).mul(smoothstep(-0.95, -0.85, s.y)).mul(step(vnoise(vec2(row.mul(3.3), 1)), 0.8))
    return vec4(sat(fox.mul(0.5).add(speck.mul(0.38)) as F), scrib.mul(block), cockle, rag.mul(16).add(0.5))
  })
  bakePass.mat.name = "cambrianBake"
  const tBake = uniformTexture(bakeRT.texture)
  let baked = false

  const paperFrag = Fn(() => {
    const p = vPW.xz
    const s = vec2(p.x, p.y.negate()).toVar() // sheet coordinates
    const px = pxWorld(p as V2)
    const w = px.wpp.toVar()
    const sx = px.sx.toVar(), sz = px.sz.toVar()
    // ---- the deckle: a ragged, thinning edge
    const e = sdBox(s as V2, HW, HH).toVar()
    const bk = sampleRT(tBake, s.div(vec2(BW * 2, BH * 2)).add(0.5) as V2).toVar()
    const rag = bk.a.sub(0.5).div(16)
    const edge = e.add(rag).toVar()
    Discard(edge.greaterThan(0))
    const thinE = smoothstep(-0.02, 0, edge)
    // ---- the mould: chain lines every 25 mm, laid lines between them, both fading by footprint
    const ch = abs(fract(s.x.div(CHAIN).add(0.5)).sub(0.5)).mul(CHAIN)
    const chain = exp(ch.mul(ch).div(-0.00013)).mul(smoothstepRev(0.02, 0.004, w))
    const laidK = smoothstepRev(0.42, 0.16, w.div(LAID))
    const laid = sin(s.y.mul(TAU / LAID)).mul(laidK)
    // ---- fibres: long ones, short ones, and a slow cockle
    // (each octave is dropped once it is finer than the pixels that would have to carry it)
    const fib = float(0).toVar()
    for (let i = 0; i < 4; i++) {
      const fy = 62 * 2.2 ** i
      fib.addAssign(vnoise(s.mul(vec2(fy * 0.27, fy)).add(i * 5.3)).mul(0.5 ** i * 0.533).mul(smoothstepRev(0.5, 0.2, w.mul(fy))))
    }
    const fine = vnoise(s.mul(vec2(300, 1100))).sub(0.5).mul(smoothstepRev(0.0006, 0.0002, w))
    const cockle = bk.b
    // ---- the plate mark: the image area was pressed into the damp sheet
    const pm = sdBox(s as V2, HW - PM, HH - PM).toVar()
    const press = smoothstep(-0.014, 0.014, pm)
    const hgt = chain.mul(0.0011).add(laid.mul(0.00017)).add(fib.mul(0.0024)).add(fine.mul(0.0005)).add(cockle.mul(0.012)).add(press.mul(0.0016)).toVar()
    // ---- tone
    const alb = vec3(0.79, 0.745, 0.63).mul(fib.mul(0.16).add(0.92)).toVar()
    alb.mulAssign(chain.mul(0.05).oneMinus().mul(laid.mul(0.014).add(1)))
    alb.mulAssign(mixN(vec3(1), vec3(0.9, 0.84, 0.7), smoothstep(-0.55, 0.0, e).mul(0.55))) // browning toward the edges
    alb.mulAssign(mixN(vec3(1.0), vec3(1.035, 1.03, 1.02), press.oneMinus().mul(0.6))) // the pressed area is smoother
    // foxing: rust spots with soft halos, a few to the hand
    alb.mulAssign(mixN(vec3(1), vec3(0.8, 0.6, 0.38), bk.r))
    // show-through: a hand on the other side of the leaf, mirrored and faint
    alb.mulAssign(bk.g.mul(0.05).oneMinus())
    // ---- where the bead landed: wet paper is darker and more translucent, and dries to a tide line
    const bd = s.sub(uBlot.xy).toVar()
    const db = length(bd.mul(vec2(0.86, 1.0))).add(vnoise(s.mul(vec2(22, 80))).sub(0.5).mul(0.03)).toVar()
    const inB = sstep(uBlot.z as F, uBlot.z.sub(0.012) as F, db as F).toVar()
    // satellite drops thrown out by the landing
    for (let i = 0; i < 7; i++) {
      const a = i * 2.399 + 0.4, rr = BLOT_R * (1.5 + ((i * 0.618) % 1) * 1.6)
      const c = vec2(Math.cos(a) * rr, Math.sin(a) * rr * 0.8)
      inB.assign(max(inB, smoothstepRev(0.014 + 0.012 * ((i * 0.37) % 1), 0.004, length(bd.sub(c))).mul(step(0.02, uBlot.z))))
    }
    const wetB = inB.mul(uBlot.w)
    const td = db.sub(uBlot.z).div(0.005)
    const tide = exp(td.mul(td).negate()).mul(step(0.02, uBlot.z))
    alb.mulAssign(mixN(vec3(1), vec3(0.66, 0.63, 0.6), wetB.mul(0.8)))
    alb.mulAssign(tide.mul(mixN(0.07, 0.2, uBlot.w)).oneMinus())
    hgt.addAssign(inB.mul(uBlot.w.oneMinus()).mul(0.0005)) // dried, it stays a little cockled
    // ---- beat 4: water comes up through the sheet from the inky trackway (along the fibres, fastest
    // down the chain lines), and at the end it dries from the deckle inward
    const wetT = float(0).toVar()
    const thru = float(0).toVar()
    If(uSea.x.greaterThan(0.001), () => {
      const rg = fib.sub(0.5).mul(0.55).add(vnoise(s.mul(vec2(7, 26))).sub(0.5).mul(0.4)).add(chain.mul(0.14)).toVar()
      const dT = float(9).toVar()
      for (let i = 0; i < TRK.length - 1; i++) dT.assign(min(dT, sdSeg(s as V2, vec2(TRK[i][0], TRK[i][1]) as V2, vec2(TRK[i + 1][0], TRK[i + 1][1]) as V2)))
      const soak = smoothstep(0, 0.3, uSea.x.sub(dT).add(rg))
      const dry = smoothstep(0, 0.24, uSea.y.add(e).add(rg.mul(0.7)))
      wetT.assign(soak.mul(dry.oneMinus()))
      thru.assign(smoothstep(0.35, 1.3, uSea.x.sub(dT).add(rg)).mul(dry.oneMinus()).mul(uSea.z))
      // the front itself: a dark tide line
      alb.mulAssign(smoothstep(0.0, 0.25, wetT).mul(smoothstepRev(0.6, 0.25, wetT)).mul(0.22).oneMinus())
      alb.mulAssign(mixN(vec3(1), vec3(0.6, 0.6, 0.56), smoothstep(0, 0.5, wetT)))
    })
    // ---- normal from the height (screen derivatives: every term above is already band-limited)
    const hx = dFdx(hgt), hy = dFdy(hgt)
    const gx = hx.mul(sx.x).add(hy.mul(sx.y)) // d(height)/d(world x)
    const gz = hx.mul(sz.x).add(hy.mul(sz.y))
    const n = normalize(vec3(gx.negate(), 1, gz.negate().add(smoothstepRev(0.3, 0, length(vec2(p.x.sub(HW), p.y.add(HH)))).mul(0.25)))).toVar()
    // ---- ink
    const fx = vec2(sx.x, sx.y.negate()).div(uRes).mul(0.0045).mul(fib.mul(1.4).add(0.3))
    const I = inkAt(fx as V2, fib).toVar()
    const cov = I.x.mul(smoothstep(0.2, 0.75, wetT).oneMinus()).toVar() // the ink lets go of wet paper
    const wet = sat(I.y.div(max(I.x, 0.02)) as F).toVar()
    const young = sat(I.z.div(max(I.x, 0.02)) as F)
    // wet ink stands on the sheet: its edge is a slope that catches the lamp
    const bump = vec2(dFdx(I.y), dFdy(I.y)).mul(1.6)
    const nI = normalize(n.add(vec3(bump.x.negate(), 0, bump.y)).mul(1)).toVar()
    // dry ink sits in the tooth: it is thinner over the high fibres
    const take = cov.mul(mixN(fib.mul(0.3).add(0.85), 1, wet)).mul(mixN(1, 0.62, wet.mul(wet).mul(smoothstep(0.7, 1, wet)))).toVar()
    const ic = inkCol(wet, young)
    const base = alb.mul(mixN(vec3(1), ic, sat(take as F))).toVar()
    const sh = shadowAt(p as V2).toVar()
    const rough = mixN(mixN(mixN(0.93, 0.6, wetB), 0.3, wetT), 0.16, wet.mul(cov))
    const col = lampLit(vPW, mixN(n, nI, wet.mul(cov)) as V3, base as V3, rough as F, 0, sh.x).toVar()
    col.addAssign(base.mul(KEYC).mul(sh.y))
    // the nib's glint, and the thin bright fluff of the deckle
    col.addAssign(KEYC.mul(I.w.mul(I.w)).mul(2.2))
    col.assign(mixN(col, col.mul(1.12).add(vec3(0.02, 0.018, 0.014)), thinE.mul(0.5)))
    // soaked through, the sheet is a window: the sea under it, bent by the water's skin, the lamp glancing off
    If(thru.greaterThan(0.002), () => {
      const rp = vec2(vnoise(p.mul(5).add(vec2(uSeaT.mul(0.8), 0))), vnoise(p.mul(5).add(vec2(7.1, uSeaT.mul(0.7))))).sub(0.5).toVar()
      const seaC = tSea.sample(screenUV.add(rp.mul(0.014).mul(thru))).level(L0).rgb
      const nW = normalize(vec3(rp.x.mul(0.5), 1, rp.y.mul(0.5)))
      const gl = lampLit(vPW, nW as V3, vec3(0.02) as V3, 0.07, 0, sh.x)
      const veil = mixN(vec3(0.9, 0.84, 0.7), vec3(1), uSea.w)
      col.assign(mixN(col, seaC.mul(veil).add(gl.mul(mixN(1, 0.4, uSea.w))), thru.mul(mixN(0.8, 1, uSea.w))))
    })
    return vec4(col, 1)
  })()
  const paper = new THREE.Mesh(paperGeo, mk(viewProj.mul(vec4(paperW, 1)), paperFrag, { side: THREE.DoubleSide }))
  paper.frustumCulled = false
  scene.add(paper)

  // ---------------------------------------------------------------- the desk: oiled walnut

  const deskFrag = Fn(() => {
    const p = vW.xz
    const wpp = pxWorld(p as V2).wpp
    const q = vec2(p.x.mul(0.995).sub(p.y.mul(0.09)), p.x.mul(0.09).add(p.y.mul(0.995))).toVar()
    const warp = fbm(q.mul(vec2(0.5, 1.6)).add(2)).toVar()
    const rings = q.y.mul(14).add(warp.mul(4)).add(fbm(q.mul(vec2(1.2, 14))).mul(1.2)).toVar()
    const g = sin(rings.mul(TAU)).mul(0.5).add(0.5)
    const pore = vnoise(vec2(q.x.mul(14), q.y.mul(420))).mul(smoothstepRev(0.006, 0.002, wpp))
    const streak = vnoise(vec2(q.x.mul(2.2), q.y.mul(60)))
    const alb = mixN(vec3(0.028, 0.015, 0.009), vec3(0.075, 0.038, 0.018), g.mul(0.3).add(streak.mul(0.45)).add(warp.mul(0.5)).sub(0.1)).toVar()
    alb.mulAssign(pore.mul(0.45).oneMinus())
    const n = normalize(vec3(g.sub(0.5).mul(0.03), 1, pore.sub(0.3).mul(0.08).add(streak.sub(0.5).mul(0.03)))).toVar()
    const sh = shadowAt(p as V2).toVar()
    // the sheet's own shadow: tight under the edge, longer on the side away from the lamp
    const sq = vec2(p.x, p.y.negate())
    const away = p.sub(vec2(LAMP.x, LAMP.z)).div(LAMP.y)
    const ds = sdBox(sq as V2, HW, HH)
    const ds2 = sdBox(sq.sub(vec2(away.x, away.y.negate()).mul(0.035)) as V2, HW, HH)
    const lit = sh.x.mul(smoothstepRev(0.03, -0.03, ds).mul(0.5).oneMinus()).mul(smoothstepRev(0.07, -0.02, ds2).mul(0.5).oneMinus())
    const I = tInk.sample(screenUV).level(L0).toVar()
    const cov = I.x.mul(step(0.0, ds)).toVar()
    const wet = sat(I.y.div(max(I.x, 0.02)) as F)
    // ink does not sink into varnish: it stays up, and stays glossy longer
    const base = mixN(alb, vec3(0.012, 0.012, 0.02), cov.mul(0.92))
    const col = lampLit(vW, n as V3, base as V3, mixN(0.34, 0.1, cov.mul(wet.mul(0.6).add(0.4))) as F, 0, lit).toVar()
    col.addAssign(KEYC.mul(I.w.mul(I.w)).mul(1.6).mul(step(0, ds)))
    return vec4(col, 1)
  })()
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2).translate(0, -0.004, 0), mk(stdVertex, deskFrag))
  scene.add(desk)

  // ---------------------------------------------------------------- props

  const lit = (col: [number, number, number], rough: number, metal: number, tex?: (p: V3, n: V3) => { alb?: V3; rough?: F }) =>
    mk(
      stdVertex,
      Fn(() => {
        const n = normalize(vN).toVar()
        const t = tex?.(vW, n as V3)
        const alb = (t?.alb ?? vec3(col[0], col[1], col[2])) as V3
        return vec4(lampLit(vW, n as V3, alb, t?.rough ?? rough, metal, 1), 1)
      })(),
    )
  const BRASS: [number, number, number] = [0.78, 0.52, 0.2]
  // brass that has been handled: brighter where fingers go, a brown bloom in the recesses
  const brass = lit(BRASS, 0.3, 1, (p) => {
    const t = fbm(p.xz.mul(26).add(p.y.mul(40)))
    return { alb: mixN(vec3(0.4, 0.25, 0.1), vec3(BRASS[0], BRASS[1], BRASS[2]), smoothstep(0.25, 0.6, t)) as V3, rough: mixN(0.5, 0.24, t) as F }
  })
  const steel = lit([0.55, 0.56, 0.6], 0.25, 1)
  const wood = lit([0.11, 0.04, 0.02], 0.3, 0, (p) => ({ alb: mixN(vec3(0.07, 0.025, 0.012), vec3(0.2, 0.08, 0.035), vnoise(vec2(p.x.mul(60).add(p.z.mul(50)), p.y.mul(8).add(p.x.mul(3))))) as V3 }))
  const lathe = (pts: [number, number][], seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)

  // -- the loupe: a ring on three legs, a glass that shows the page under it, enlarged
  const loupe = new THREE.Group()
  loupe.add(new THREE.Mesh(lathe([[LOUPE_R - 0.004, LOUPE_Y - 0.035], [LOUPE_R + 0.03, LOUPE_Y - 0.035], [LOUPE_R + 0.036, LOUPE_Y - 0.02], [LOUPE_R + 0.036, LOUPE_Y + 0.02], [LOUPE_R + 0.026, LOUPE_Y + 0.034], [LOUPE_R + 0.006, LOUPE_Y + 0.036], [LOUPE_R - 0.004, LOUPE_Y + 0.02]], 72), brass))
  loupe.add(new THREE.Mesh(new THREE.TorusGeometry(LOUPE_R + 0.036, 0.007, 8, 72).rotateX(Math.PI / 2).translate(0, LOUPE_Y, 0), brass))
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.008, LOUPE_Y + 0.01, 10).translate(0, (LOUPE_Y - 0.03) / 2, 0), brass)
    leg.rotation.z = -0.27
    const hold = new THREE.Group()
    hold.add(leg)
    hold.position.set(Math.cos(a) * (LOUPE_R + 0.07), 0, Math.sin(a) * (LOUPE_R + 0.07))
    hold.rotation.y = -a
    loupe.add(hold)
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 8).scale(1, 0.6, 1).translate(Math.cos(a) * (LOUPE_R + 0.07), 0.008, Math.sin(a) * (LOUPE_R + 0.07)), brass)
    loupe.add(foot)
  }
  const loupeRT = ctx.target({ hdr: true, depth: true, fixed: [640, 640] })
  const inkLoupe = ctx.target({ hdr: false, fixed: [640, 640] })
  const tLoupe = uniformTexture(loupeRT.texture)
  const lensGeo = new THREE.SphereGeometry(0.62, 40, 10, 0, TAU, 0, 0.415).translate(0, LOUPE_Y + 0.012 - 0.62 * Math.cos(0.415), 0)
  const lens = new THREE.Mesh(
    lensGeo,
    mk(
      stdVertex,
      Fn(() => {
        const n = normalize(vN).toVar()
        const v = normalize(cameraPosition.sub(vW)).toVar()
        // the ray is bent toward the axis: a point of the glass shows the page nearer the middle
        const r = vW.xz.sub(uLoupe.xz).div(LOUPE_R).toVar()
        // (the view shifts a little with the eye, as it does through a thick lens)
        const par = v.xz.div(max(v.y, 0.3)).mul(-0.1)
        const rr = dot(r, r)
        const q = r.mul(rr.mul(0.16).add(0.84)).add(par).toVar()
        const uvL = vec2(q.x.mul(0.5).add(0.5), q.y.negate().mul(0.5).add(0.5))
        const ca = r.mul(rr).mul(0.006)
        const c = vec3(sampleRT(tLoupe, uvL.add(ca) as V2).r, sampleRT(tLoupe, uvL as V2).g, sampleRT(tLoupe, uvL.sub(ca) as V2).b).toVar()
        // the glass itself: a rim that darkens, the lamp on its surface, a little green in the thickness
        c.mulAssign(mixN(vec3(1), vec3(0.8, 0.9, 0.84), smoothstep(0.55, 1, rr)))
        c.mulAssign(smoothstepRev(1.02, 0.9, rr).mul(0.5).add(0.5))
        const fres = pow(sat(dot(n, v) as F).oneMinus(), 4)
        const refl = envOf(reflect(v.negate(), n) as V3)
        return vec4(c.add(refl.mul(fres.mul(0.5).add(0.045))), 1)
      })(),
    ),
  )
  loupe.add(lens)
  scene.add(loupe)
  const loupeCam = new THREE.OrthographicCamera(-LOUPE_R / LOUPE_M, LOUPE_R / LOUPE_M, LOUPE_R / LOUPE_M, -LOUPE_R / LOUPE_M, 0.1, 10)
  loupeCam.up.set(0, 0, -1)
  loupeCam.layers.set(1)
  paper.layers.enable(1)
  desk.layers.enable(1)

  // -- the ink bottle: thick glass, a brass collar, the ink's surface in the neck
  const bottle = new THREE.Group()
  bottle.position.set(BOTTLE[0], 0, -BOTTLE[1])
  const glass = mk(
    stdVertex,
    Fn(() => {
      const n = normalize(vN).toVar()
      const v = normalize(cameraPosition.sub(vW)).toVar()
      const fres = pow(sat(dot(n, v) as F).oneMinus(), 3)
      // dark with ink below the shoulder, bottle-green where the glass is empty
      const full = smoothstepRev(0.27, 0.22, vW.y)
      const body = mixN(vec3(0.02, 0.05, 0.035), vec3(0.006, 0.007, 0.014), full)
      const c = lampLit(vW, n as V3, body as V3, 0.06, 0, 1).toVar()
      c.addAssign(envOf(reflect(v.negate(), n) as V3).mul(fres.mul(0.7).add(0.06)))
      // light caught in the far wall
      c.addAssign(vec3(0.05, 0.11, 0.07).mul(pow(sat(dot(n, normalize(LP).negate()).mul(0.5).add(0.5) as F), 6)).mul(full.oneMinus().mul(0.8).add(0.2)))
      return vec4(c, 1)
    })(),
  )
  bottle.add(new THREE.Mesh(lathe([[0, 0], [0.17, 0], [0.19, 0.02], [0.19, 0.2], [0.165, 0.25], [0.085, 0.275], [0.08, 0.34], [0.1, 0.345], [0.1, 0.375], [0.066, 0.375], [0.062, 0.31], [0, 0.31]], 56), glass))
  bottle.add(new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.012, 8, 40).rotateX(Math.PI / 2).translate(0, 0.292, 0), brass))
  bottle.add(new THREE.Mesh(new THREE.CircleGeometry(0.062, 32).rotateX(-Math.PI / 2).translate(0, 0.33, 0), lit([0.006, 0.007, 0.016], 0.03, 0)))
  // its stopper, set down beside it
  const cork = new THREE.Mesh(lathe([[0, 0], [0.062, 0], [0.07, 0.07], [0.09, 0.075], [0.09, 0.1], [0, 0.1]], 28), lit([0.45, 0.3, 0.16], 0.9, 0, (p) => ({ alb: vec3(0.45, 0.3, 0.16).mul(vnoise(p.xz.mul(90).add(p.y.mul(120))).mul(0.5).add(0.6)) as V3 })))
  cork.position.set(-0.34, 0, 0.16)
  bottle.add(cork)
  scene.add(bottle)

  // -- the dip pen: a turned holder, a brass ferrule, a steel nib
  const pen = new THREE.Group()
  pen.add(new THREE.Mesh(lathe([[0, 0], [0.008, 0.005], [0.014, 0.2], [0.021, 0.5], [0.019, 0.62], [0.016, 0.66]], 14), wood))
  pen.add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.07, 14).translate(0, 0.69, 0), brass))
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.14, 12, 1, true).scale(1, 1, 0.42).translate(0, 0.79, 0), steel)
  ;(nib.material as THREE.NodeMaterial).side = THREE.DoubleSide
  pen.add(nib)
  {
    const dx = PEN_A[0] - PEN_B[0], dz = -(PEN_A[1] - PEN_B[1])
    pen.position.set(PEN_B[0], 0.024, -PEN_B[1])
    // lay it down along the desk, nib toward the sheet
    pen.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, -0.012, dz).normalize())
  }
  scene.add(pen)

  // -- the pen in the hand, for the first drawing: a steel nib (an arched shell with a slit, a breather hole and
  // wet ink on its point), a brass ferrule and a turned holder that leaves the frame where the hand would be
  const penW = new THREE.Group()
  // (black lacquered holder, worn to the wood where the fingers go)
  const lacquer = lit([0.02, 0.017, 0.015], 0.16, 0, (p) => ({ alb: mixN(vec3(0.018, 0.015, 0.014), vec3(0.16, 0.07, 0.03), smoothstep(0.62, 0.8, vnoise(p.xz.mul(40).add(p.y.mul(30)))).mul(0.5)) as V3 }))
  {
    const NU = 28, NV = 18, NL = 0.15
    const pos: number[] = [], uvs: number[] = [], idx: number[] = []
    for (let i = 0; i <= NU; i++) {
      const u = i / NU
      const r = 0.0006 + 0.0185 * Math.min(1, (u / 0.62) ** 0.9)
      const half = 0.55 + 2.0 * u ** 0.8 // how far the shell wraps: flat at the point, nearly a tube at the shoulder
      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * 2 - 1
        const ph = v * half
        pos.push(r * Math.sin(ph), u * NL, r * (Math.cos(ph) - 1) + 0.0012 * (1 - u))
        uvs.push(u, v * half * r)
      }
    }
    for (let i = 0; i < NU; i++)
      for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j
        idx.push(a, a + NV + 1, a + 1, a + 1, a + NV + 1, a + NV + 2)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("aNib", new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    const vU = attribute("aNib", "vec2").toVarying() as V2
    const nibMat = mk(
      stdVertex,
      Fn(() => {
        const u = vU.x, arc = vU.y
        // the slit runs from the point to the breather hole; the hole is round
        Discard(abs(arc).lessThan(0.00045).and(u.lessThan(0.5)))
        Discard(length(vec2(u.sub(0.53).mul(NL), arc)).lessThan(0.0021))
        const v = normalize(cameraPosition.sub(vW)).toVar()
        const n0 = normalize(vN).toVar()
        const n = select(dot(n0, v).lessThan(0), n0.negate(), n0)
        // wet ink on the point, drying back to steel; fine grinding lines along the tines
        const wetInk = smoothstepRev(0.34, 0.12, u.add(vnoise(vec2(arc.mul(900), u.mul(30))).mul(0.06)))
        const grind = vnoise(vec2(arc.mul(4000), u.mul(6))).mul(0.12).add(0.88)
        const alb = mixN(vec3(0.6, 0.61, 0.64).mul(grind), vec3(0.02, 0.025, 0.05), wetInk)
        return vec4(lampLit(vW, n as V3, alb as V3, mixN(0.2, 0.05, wetInk), mixN(1, 0.1, wetInk), 1), 1)
      })(),
      { side: THREE.DoubleSide },
    )
    penW.add(new THREE.Mesh(g, nibMat))
    penW.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.021, 0.1, 18).translate(0, NL + 0.04, -0.018), brass))
    penW.add(new THREE.Mesh(lathe([[0.019, 0], [0.017, 0.06], [0.015, 0.2], [0.022, 0.55], [0.026, 0.9], [0.022, 1.3], [0.012, 1.36], [0, 1.37]], 18).translate(0, NL + 0.09, -0.018), lacquer))
    const X = new THREE.Vector3().crossVectors(PEN_D, new THREE.Vector3(0, 1, 0)).normalize()
    const Z = new THREE.Vector3().crossVectors(X, PEN_D).normalize()
    penW.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, PEN_D, Z))
    penW.visible = false
  }
  scene.add(penW)

  // -- the rocker blotter: a curved foot faced with blotting paper, a knob to hold it by
  const blotter = new THREE.Group()
  blotter.position.set(BLOTTER.x, 0, -BLOTTER.y)
  blotter.rotation.y = BLOTTER.rot
  const pink = lit([0.6, 0.42, 0.38], 0.95, 0, (p) => {
    // the mirror images of everything it has ever dried
    const v = voronoi(p.xz.mul(24))
    const stain = smoothstepRev(0.3, 0.1, v.x).mul(step(0.55, hash21(v.yz)))
    return { alb: mixN(vec3(0.62, 0.44, 0.4).mul(vnoise(p.xz.mul(300)).mul(0.2).add(0.9)), vec3(0.08, 0.07, 0.12), stain.mul(0.7)) as V3 }
  })
  const foot = mk(stdVertex, pink.fragmentNode!, { side: THREE.DoubleSide })
  blotter.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.28, 24, 1, true, -0.52, 1.04).rotateX(Math.PI / 2).translate(0, 0.6, 0), foot))
  blotter.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.29).translate(0, 0.085, 0), wood))
  blotter.add(new THREE.Mesh(lathe([[0, 0.1], [0.03, 0.1], [0.022, 0.15], [0.05, 0.19], [0.055, 0.22], [0.035, 0.25], [0, 0.255]], 24), wood))
  scene.add(blotter)

  // ================================================================ beat 4: the living sea
  //
  // The same space as the desk: the water is under the sheet. Everything here is drawn only while
  // the sheet is wet (`seaOn`), into `seaRT`, whose alpha carries the distance to the eye for the
  // lens. While the lens is above the surface the wet paper looks down through it (the sheet's
  // shader reads `tSea`); below, the sea is the picture.

  const SUN = new THREE.Vector3(-0.4, 0.84, -0.36).normalize()
  const uSun = uniform(SUN.clone())
  const uPxK = uniform(0.001) // world units per pixel at distance 1
  const KEY_W = vec3(1.7, 1.52, 0.95) as V3
  const SKY_W = vec3(0.17, 0.26, 0.11) as V3
  const BNC_W = vec3(0.26, 0.25, 0.14) as V3
  const FOG_LO = vec3(0.06, 0.1, 0.032)
  const FOG_HI = vec3(0.3, 0.37, 0.13)
  /** Light through a few metres of green-gold water: what is left of a colour `dist` away, and the haze in front of it. */
  const seaFog = (c: V3, p: V3, dist: F): V3 => {
    const v = p.sub(cameraPosition).div(max(dist, 1e-3))
    const tr = exp(dist.mul(vec3(0.085, 0.058, 0.1)).negate())
    const up = smoothstep(-0.3, 0.8, v.y)
    const sunward = pow(sat(dot(v, uSun) as F), 5)
    const fog = mixN(FOG_LO, FOG_HI, up).add(vec3(0.2, 0.17, 0.06).mul(sunward))
    return mixN(fog, c, tr) as V3
  }
  /** Caustics: the surface's lensing, carried down the sun's rays, so floor, animals and motes agree. Around 1. */
  const caust = (p: V3): F => {
    // (the folded-sine caustic: each pass bends the lattice by the last, and light piles up along the folds)
    const q = mod(p.xz.sub(uSun.xz.div(uSun.y).mul(p.y)).mul(0.8), TAU).sub(250)
    const t = uSeaT.mul(0.5).add(23)
    let i: V2 = q as V2
    let c: F = float(1)
    for (let n = 0; n < 4; n++) {
      const tt = t.mul(1 - 3.5 / (n + 1))
      i = q.add(vec2(cos(tt.sub(i.x)).add(sin(tt.add(i.y))), sin(tt.sub(i.y)).add(cos(tt.add(i.x))))) as V2
      c = c.add(float(1).div(length(vec2(q.x.div(sin(i.x.add(tt)).div(0.005)), q.y.div(cos(i.y.add(tt)).div(0.005)))))) as F
    }
    return pow(abs(float(1.17).sub(pow(c.div(4), 1.4))), 8).mul(4.0).add(0.28) as F
  }
  const moundN = (q: V2): F => {
    let h: F = float(0)
    for (const m of MOUNDS) {
      const d = q.sub(vec2(m[0], m[1])).div(vec2(m[3], m[4]))
      h = h.add(exp(dot(d, d).negate()).mul(m[2])) as F
    }
    return h
  }
  const floorN = (q: V2): F => float(SEA_Y).add(sin(q.x.mul(0.31).add(1.3)).mul(sin(q.y.mul(0.27).add(0.4))).mul(0.2)).add(sin(q.x.mul(0.9).add(q.y.mul(0.5))).mul(0.05)).add(moundN(q)) as F

  const seaScene = new THREE.Scene()
  const seaRT = ctx.target({ hdr: true, depth: true, samples: 4 })
  const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const
  const OVER = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const
  const eyeD = (p: V3): F => length(cameraPosition.sub(p)) as F

  // ---- shadows of the cast on the mud: soft blobs pushed along the sun (x, z, radius, strength)
  const NBLOB = 8
  const blobV = Array.from({ length: NBLOB }, () => new THREE.Vector4(0, 0, 1, 0))
  const uBlob = uniformArray(blobV, "vec4")
  const blobShade = (q: V2): F => {
    let s: F = float(1)
    for (let i = 0; i < NBLOB; i++) {
      const b = uBlob.element(i) as unknown as V4
      const d = length(q.sub(b.xy).mul(vec2(1, 1.25)))
      s = s.mul(sstep(b.z, b.z.mul(0.25) as F, d as F).mul(b.w).oneMinus()) as F
    }
    return s
  }

  // ---- the floor: pale carbonate mud in ripple marks, shell hash, burrows; the mounds crusted and knobbly
  const floorGeo = new THREE.PlaneGeometry(110, 96, 200, 176).rotateX(-Math.PI / 2).translate(0, 0, -5)
  const floorW = vec3(world.x, floorN(world.xz as V2), world.z)
  const vFW = floorW.toVarying() as V3
  const floorFrag = Fn(() => {
    const p = vFW
    const q = p.xz.toVar()
    const d = eyeD(p).toVar()
    const px = d.mul(uPxK).toVar()
    const e = 0.07
    const gx = floorN(q.add(vec2(e, 0)) as V2).sub(floorN(q.sub(vec2(e, 0)) as V2)).div(2 * e)
    const gz = floorN(q.add(vec2(0, e)) as V2).sub(floorN(q.sub(vec2(0, e)) as V2)).div(2 * e)
    const big = fbm(q.mul(0.33).add(3.1)).toVar()
    const reef = smoothstep(0.16, 0.5, moundN(q as V2).add(big.sub(0.5).mul(0.5))).toVar()
    // ripple marks: 6 cm crests, wandering, dying out on the mounds and by their footprint
    const ph = q.x.mul(0.86).add(q.y.mul(0.5)).div(0.6).add(big.mul(4.2)).add(vnoise(q.mul(1.1)).mul(0.9)).mul(TAU).toVar()
    const rk = smoothstepRev(0.34, 0.1, px.div(0.6)).mul(reef.oneMinus()).mul(vnoise(q.mul(0.5).add(9)).mul(0.6).add(0.55)).toVar()
    const rip = sin(ph).mul(0.5).add(0.5)
    const rs = cos(ph).mul(rk).mul(0.8)
    // grain and shell hash, each only while it is bigger than a pixel
    const sand = hash21(floor(q.mul(170)))
    const grain = vnoise(q.mul(64)).sub(0.5).mul(smoothstepRev(0.02, 0.005, px)).mul(1.6).add(vnoise(q.mul(17)).sub(0.5).mul(smoothstepRev(0.07, 0.02, px)).mul(1.1)).add(sand.sub(0.5).mul(1.5).mul(smoothstepRev(0.0045, 0.0015, px)))
    const vo = voronoi(q.mul(5.3)).toVar()
    const hk = hash21(vo.yz)
    const fleck = smoothstepRev(0.16, 0.06, vo.x).mul(step(0.74, hk)).mul(smoothstepRev(0.09, 0.03, px))
    const vb = voronoi(q.mul(1.35).add(11.3)).toVar()
    const pit = smoothstepRev(0.085, 0.03, vb.x).mul(step(0.62, hash21(vb.yz))).mul(reef.oneMinus()).mul(smoothstepRev(0.16, 0.05, px))
    const rimP = smoothstepRev(0.15, 0.085, vb.x).mul(step(0.62, hash21(vb.yz))).mul(reef.oneMinus()).sub(pit)
    // the crust: a lumpy microbial rind, mottled, with sediment lying in its hollows
    const lump = fbm(q.mul(2.6).add(big.mul(3))).toVar()
    const knob = smoothstep(0.3, 0.72, lump).toVar()
    const fineK = vnoise(q.mul(13)).mul(smoothstepRev(0.08, 0.02, px))
    const n = normalize(vec3(gx.negate().sub(rs.mul(0.86)), 1, gz.negate().sub(rs.mul(0.5)))).toVar()
    const nk = normalize(n.add(vec3(vnoise(q.mul(3.1)).sub(0.5), 0, vnoise(q.mul(3.1).add(7.7)).sub(0.5)).mul(reef).mul(1.3)).add(vec3(vnoise(q.mul(11)).sub(0.5), 0, vnoise(q.mul(11).add(3.3)).sub(0.5)).mul(reef).mul(0.6).mul(smoothstepRev(0.08, 0.02, px)))).toVar()
    const mud = vec3(0.47, 0.43, 0.3).mul(rip.mul(rk).mul(0.34).add(float(1).sub(rk.mul(0.2)))).mul(grain.mul(0.3).add(1)).toVar()
    mud.assign(mixN(mud, vec3(0.5, 0.5, 0.3), smoothstep(0.42, 0.7, big).mul(0.5))) // a film of algae on the quiet patches
    mud.assign(mixN(mud, mixN(vec3(0.95, 0.9, 0.8), vec3(0.22, 0.17, 0.14), step(0.87, hk)), fleck.mul(0.85)))
    mud.mulAssign(pit.mul(0.72).oneMinus().mul(rimP.mul(0.12).add(1)))
    mud.assign(mixN(mud, mixN(vec3(0.9, 0.86, 0.74), vec3(0.14, 0.11, 0.08), step(0.5, fract(sand.mul(17)))), step(0.94, sand).mul(smoothstepRev(0.0045, 0.0015, px)).mul(0.8))) // shell grit and dark grains
    const crustC = mixN(vec3(0.16, 0.15, 0.07), vec3(0.34, 0.2, 0.15), smoothstep(0.3, 0.7, vnoise(q.mul(0.8).add(4)))).mul(knob.mul(0.7).add(0.5)).mul(fineK.mul(0.5).add(0.75))
    const crust = mixN(crustC, vec3(0.6, 0.56, 0.42), smoothstepRev(0.5, 0.2, lump).mul(0.55).mul(smoothstep(0.5, 0.9, n.y.add(0.2))))
    const alb = mixN(mud, crust, reef).toVar()
    const cs = caust(p).toVar()
    const sh = blobShade(q as V2)
    const ao = mixN(1, knob.mul(0.5).add(0.5), reef).mul(pit.mul(0.3).oneMinus())
    const col = alb.mul(KEY_W.mul(max(dot(nk, uSun), 0)).mul(cs).mul(sh).add(SKY_W.mul(1.15).mul(ao)).add(BNC_W.mul(0.2))).toVar()
    // wet grains throw the sun back along the crests
    col.addAssign(KEY_W.mul(pow(sat(dot(reflect(normalize(p.sub(cameraPosition)), nk), uSun) as F), 24)).mul(0.1).mul(cs).mul(sh).mul(reef.oneMinus()))
    return vec4(seaFog(col as V3, p, d), d.div(64))
  })()
  const seaFloor = new THREE.Mesh(floorGeo, mk(viewProj.mul(vec4(floorW, 1)), floorFrag))
  seaFloor.frustumCulled = false
  seaScene.add(seaFloor)

  // ---- the water beyond everything: the haze itself, round the lens
  const hazeW = positionGeometry.mul(110).add(cameraPosition)
  const vHZ = hazeW.toVarying() as V3
  const haze = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mk(viewProj.mul(vec4(hazeW, 1)), Fn(() => vec4(seaFog(vec3(0) as V3, vHZ, float(110)), 1))(), { side: THREE.BackSide, depthWrite: false }))
  haze.frustumCulled = false
  haze.renderOrder = -10
  seaScene.add(haze)

  // ---- the surface from below: Snell's window, the sheet lying on it, the rest a mirror of the deep
  const surfGeo = new THREE.PlaneGeometry(500, 500).rotateX(Math.PI / 2)
  const uSurf = uniform(new THREE.Vector2(1, 0)) // how much of the sheet is still paper (from below), a flash when the lens breaks through
  const surfFrag = Fn(() => {
    const p = vW
    const d = eyeD(p).toVar()
    const v = p.sub(cameraPosition).div(d).toVar()
    const q = p.xz
    const rp = vec2(vnoise(q.mul(0.9).add(vec2(uSeaT.mul(0.5), 0))), vnoise(q.mul(0.9).add(vec2(3.3, uSeaT.mul(0.44))))).sub(0.5).add(vec2(vnoise(q.mul(3.3).sub(vec2(0, uSeaT.mul(0.8)))), vnoise(q.mul(3.3).add(vec2(uSeaT.mul(0.7), 8.1)))).sub(0.5).mul(0.4)).toVar()
    const cosT = v.y.add(rp.x.mul(0.22)).add(rp.y.mul(0.14))
    const win = smoothstep(0.62, 0.7, cosT) // inside 48.6 degrees of straight up, the sky
    const sunDot = sat(dot(normalize(v.add(vec3(rp.x, 0, rp.y).mul(0.5))), uSun) as F)
    const sky = vec3(1.2, 1.3, 0.8).mul(rp.x.add(rp.y).mul(0.9).add(1)).add(vec3(4, 3.5, 2).mul(pow(sunDot, 60))).add(vec3(0.6, 0.55, 0.3).mul(pow(sunDot, 8)))
    const deep = mixN(FOG_LO.mul(1.5), vec3(0.3, 0.36, 0.17), rp.x.add(0.5).mul(rp.y.add(0.5)))
    const col = mixN(deep, sky, win).toVar()
    col.addAssign(vec3(0.7, 0.8, 0.42).mul(smoothstep(0.56, 0.64, cosT).mul(smoothstepRev(0.7, 0.64, cosT)))) // the bright rim of the window
    // the sheet, seen from under: wet paper with the lamp behind it
    const e = sdBox(vec2(q.x, q.y.negate()) as V2, HW, HH).add(rp.x.mul(0.05))
    const paperK = smoothstepRev(0.03, -0.03, e).mul(uSurf.x)
    col.assign(mixN(col, vec3(1.3, 1.12, 0.74).mul(vnoise(q.mul(vec2(40, 9))).mul(0.12).add(0.94)).mul(mixN(0.5, 1, win)), paperK.mul(0.86)))
    col.addAssign(vec3(1.6, 1.5, 1.1).mul(uSurf.y))
    return vec4(seaFog(col as V3, p, d.mul(0.7) as F), 1)
  })()
  const surface = new THREE.Mesh(surfGeo, mk(stdVertex, surfFrag))
  surface.frustumCulled = false
  seaScene.add(surface)

  // ---- algae: tufts of blades on the mounds, swaying, the light coming through them
  const NALG = 5200
  const algGeo = new THREE.InstancedBufferGeometry()
  {
    const base = new THREE.PlaneGeometry(1, 1, 1, 7).translate(0, 0.5, 0)
    algGeo.setAttribute("position", base.getAttribute("position"))
    algGeo.setIndex(base.getIndex())
    const aP = new Float32Array(NALG * 4), aQ = new Float32Array(NALG * 4)
    const ra = rng(1041)
    let n = 0
    while (n < NALG) {
      // a tuft: a few dozen blades from one holdfast
      const m = MOUNDS[Math.floor(ra() * MOUNDS.length)]
      const a = ra() * TAU, rr = Math.sqrt(ra()) * 1.25
      const tx = m[0] + Math.cos(a) * rr * m[3], tz = m[1] + Math.sin(a) * rr * m[4]
      if (moundAt(tx, tz) < 0.1 || (tx > -0.6 && tx < 2.4 && Math.abs(tz + 0.1) < 1.5)) continue
      const kind = ra()
      const tall = 0.14 + ra() * (kind < 0.3 ? 0.95 : 0.34)
      const k = 24 + Math.floor(ra() * 50)
      for (let j = 0; j < k && n < NALG; j++, n++) {
        const b = ra() * TAU, br = ra() * (kind < 0.3 ? 0.07 : 0.2)
        const x = tx + Math.cos(b) * br, z = tz + Math.sin(b) * br
        aP.set([x, floorY(x, z) - 0.02, z, tall * (0.55 + ra() * 0.6)], n * 4)
        aQ.set([ra() * TAU, ra() * TAU, (kind < 0.3 ? 0.011 : 0.02) * (0.7 + ra() * 0.6), kind], n * 4)
      }
    }
    algGeo.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4))
    algGeo.setAttribute("aQ", new THREE.InstancedBufferAttribute(aQ, 4))
    algGeo.instanceCount = NALG
    base.dispose()
  }
  const algMat = (() => {
    const aP = attribute("aP", "vec4") as V4, aQ = attribute("aQ", "vec4") as V4
    const t = positionGeometry.y
    const hgt = aP.w
    // the blade leans with the surge and trails its tip
    const sway = sin(uSeaT.mul(1.15).add(aQ.y).sub(t.mul(1.7))).mul(0.2).add(sin(uSeaT.mul(0.43).add(aP.x.mul(0.6))).mul(0.16)).add(0.1)
    const lean = sway.mul(t).mul(t).mul(hgt)
    const cy = cos(aQ.x), sy = sin(aQ.x)
    const wd = aQ.z.mul(float(1).sub(pow(t, 2.2).mul(0.85))).mul(positionGeometry.x.mul(2))
    const curl = sin(t.mul(3.1).add(aQ.y)).mul(0.05).mul(hgt)
    const pos = vec3(aP.x.add(cy.mul(wd)).add(lean.mul(0.8)).add(sy.mul(curl)), aP.y.add(t.mul(hgt).mul(float(1).sub(sway.mul(sway).mul(t).mul(0.3)))), aP.z.add(sy.mul(wd)).add(lean.mul(0.6)).sub(cy.mul(curl)))
    const vP = pos.toVarying() as V3
    const vT = vec3(t, aQ.w, positionGeometry.x).toVarying()
    const frag = Fn(() => {
      const d = eyeD(vP).toVar()
      const k = vT.y
      const c0 = mixN(mixN(vec3(0.2, 0.22, 0.035), vec3(0.06, 0.13, 0.035), smoothstep(0.3, 0.55, k)), vec3(0.3, 0.07, 0.05), smoothstep(0.78, 0.86, k))
      const rib = smoothstepRev(0.5, 0.0, abs(vT.z)).mul(0.5).add(0.6)
      const alb = c0.mul(mixN(0.35, 1.25, vT.x)).mul(rib)
      const col = alb.mul(KEY_W.mul(0.62).mul(caust(vP)).add(SKY_W.mul(1.6)))
      return vec4(seaFog(col as V3, vP, d), d.div(64))
    })()
    return mk(viewProj.mul(vec4(pos, 1)), frag, { side: THREE.DoubleSide })
  })()
  const algae = new THREE.Mesh(algGeo, algMat)
  algae.frustumCulled = false
  seaScene.add(algae)

  // ---- marine snow: motes in a box that travels with the lens, each a disc the size of its blur
  const uLens = uniform(new THREE.Vector4(2, 0.02, 0, 0)) // focus distance, aperture, -, -
  const cocAt = (d: F): F => clampN(abs(float(1).div(uLens.x).sub(float(1).div(max(d, 0.05)))).mul(uLens.y), 0, 0.02) as F
  const NSNOW = 2600, BOX = 9
  const snowGeo = new THREE.InstancedBufferGeometry()
  {
    snowGeo.setAttribute("position", quad)
    snowGeo.setIndex([0, 1, 2, 0, 2, 3])
    const a = new Float32Array(NSNOW * 4)
    const rs = rng(77)
    for (let i = 0; i < NSNOW * 4; i++) a[i] = rs()
    snowGeo.setAttribute("aS", new THREE.InstancedBufferAttribute(a, 4))
    snowGeo.instanceCount = NSNOW
  }
  const snowMat = (() => {
    const aS = attribute("aS", "vec4") as V4
    const drift = vec3(uSeaT.mul(0.05).add(sin(uSeaT.mul(0.5).add(aS.w.mul(40))).mul(0.012)), uSeaT.mul(-0.022).mul(aS.w.add(0.4)), uSeaT.mul(0.03))
    const c = fract(aS.xyz.add(drift).sub(cameraPosition.div(BOX))).sub(0.5).mul(BOX).add(cameraPosition)
    const vp = cameraViewMatrix.mul(vec4(c, 1))
    const d = vp.z.negate()
    const r0 = aS.w.mul(aS.w).mul(0.016).add(0.004)
    const r = r0.add(cocAt(d as F).mul(d).mul(0.62))
    const clip = cameraProjectionMatrix.mul(vec4(vp.xy.add(positionGeometry.xy.mul(r)), vp.z, 1))
    const lightV = caust(c as V3).mul(0.7).add(0.3).mul(smoothstepRev(0.2, 0.0, c.y)).mul(smoothstep(0.25, 0.9, d)).mul(exp(d.mul(-0.16)))
    const vS = vec4(positionGeometry.xy, r0.div(r), lightV).toVarying()
    const frag = Fn(() => {
      const rr = length(vS.xy)
      const disc = smoothstepRev(1, 0.8, rr).mul(mixN(1, rr.mul(rr).mul(0.6).add(0.55), smoothstepRev(0.5, 0.15, vS.z)))
      return vec4(vec3(1.5, 1.4, 0.85).mul(disc).mul(vS.z.mul(vS.z).add(0.012).min(1)).mul(vS.w).mul(0.85), 0)
    })()
    return mk(clip, frag, { ...ADD })
  })()
  const snow = new THREE.Mesh(snowGeo, snowMat)
  snow.frustumCulled = false
  snow.renderOrder = 5
  seaScene.add(snow)

  // ---- bubbles: two bursts where the lens breaks the surface, and threads of them rising from the mud
  const NBUB = 260
  const uBurst = uniform(new THREE.Vector4(-9, -9, 0, 0)) // seconds since the lens went through, and since it came back; x and z of the place
  const bubGeo = new THREE.InstancedBufferGeometry()
  {
    bubGeo.setAttribute("position", quad)
    bubGeo.setIndex([0, 1, 2, 0, 2, 3])
    const a = new Float32Array(NBUB * 4)
    const rb = rng(905)
    for (let i = 0; i < NBUB * 4; i++) a[i] = rb()
    bubGeo.setAttribute("aS", new THREE.InstancedBufferAttribute(a, 4))
    bubGeo.instanceCount = NBUB
  }
  const VENTS: [number, number][] = [[-2.6, -1.4], [2.9, -2.6], [0.9, 2.6]]
  const bubMat = (() => {
    const aS = attribute("aS", "vec4") as V4
    const kind = floor(aS.w.mul(5)) // 0, 1: the plunge; 2: the way out; 3, 4: threads from the mud
    const age = select(kind.lessThan(1.5), uBurst.x.sub(aS.x.mul(0.5)), select(kind.lessThan(2.5), uBurst.y.sub(aS.x.mul(0.4)), fract(uSeaT.mul(0.11).add(aS.x)).mul(9))).toVar()
    const sz = fract(aS.w.mul(31.7)).mul(fract(aS.w.mul(31.7))).mul(0.034).add(0.006)
    const ang = aS.y.mul(TAU)
    const burst = vec3(uBurst.z.add(cos(ang).mul(aS.z).mul(0.9)), max(age, 0).mul(sz.mul(26).add(1.1)).add(-2.6).add(aS.z.mul(1.6)).min(-0.02), uBurst.w.add(sin(ang).mul(aS.z).mul(0.9)))
    const vi = floor(aS.y.mul(3))
    const vx = select(vi.lessThan(0.5), float(VENTS[0][0]), select(vi.lessThan(1.5), float(VENTS[1][0]), float(VENTS[2][0])))
    const vz = select(vi.lessThan(0.5), float(VENTS[0][1]), select(vi.lessThan(1.5), float(VENTS[1][1]), float(VENTS[2][1])))
    const thread = vec3(vx.add(sin(age.mul(2.3).add(aS.z.mul(9))).mul(0.05)), float(SEA_Y + 0.1).add(age.mul(1.9)), vz.add(cos(age.mul(1.9).add(aS.z.mul(7))).mul(0.05)))
    const c = select(kind.lessThan(2.5), burst, thread)
    const wob = vec3(sin(age.mul(7).add(aS.x.mul(50))), 0, cos(age.mul(6.1).add(aS.y.mul(50)))).mul(0.035)
    const alive = step(0, age).mul(select(kind.lessThan(2.5), step(age, 2.6), float(1)))
    const vp = cameraViewMatrix.mul(vec4(c.add(wob), 1))
    const clip = cameraProjectionMatrix.mul(vec4(vp.xy.add(positionGeometry.xy.mul(sz).mul(select(kind.lessThan(2.5), float(1), float(0.55)))), vp.z, 1))
    const vS = vec3(positionGeometry.xy, vp.z.negate()).toVarying()
    const frag = Fn(() => {
      const rr = length(vS.xy)
      Discard(rr.greaterThan(1))
      const rim = smoothstep(0.55, 0.98, rr)
      const hl = exp(length(vS.xy.sub(vec2(-0.35, 0.45))).mul(-7))
      const lo = exp(length(vS.xy.sub(vec2(0.2, -0.55))).mul(-5)).mul(0.5)
      return vec4(vec3(1.3, 1.5, 1.0).mul(rim.mul(0.5).add(hl.mul(2.6)).add(lo)).mul(exp(vS.z.mul(-0.07))).mul(smoothstep(0.35, 0.9, vS.z)), 0)
    })()
    return mk(select(alive.greaterThan(0.5), clip, vec4(2, 2, 2, 1)) as THREE.Node, frag, { ...ADD })
  })()
  const bubbles = new THREE.Mesh(bubGeo, bubMat)
  bubbles.frustumCulled = false
  bubbles.renderOrder = 6
  seaScene.add(bubbles)

  // ---- the cast. Every animal is a toolkit herd lit by this sea; the ones that were drawn on the
  // plate carry an ink look as well (cream paper, a contour that follows the view, hatching in the
  // shade), mixed out as the water takes them and back in as it drains.
  const SL: Lights = { key: uSun as unknown as V3, keyCol: KEY_W, sky: SKY_W, bounce: BNC_W }
  const WATER: Water = { wet: 0.75, caustics: caust, absorb: seaFog }
  const WET: Partial<Record<Key, number>> = { vauxia: 0.15, chancelloria: 0.3, dinomischus: 0.45, wiwaxia: 0.55, olenoides: 0.4, hallucigenia: 0.5 } // (a sponge has no gloss)
  const LOOKX: Partial<Record<Key, Partial<Look>>> = { anomalocaris: { relief: 0.005, spec: 0.26, coat: 0.18 } } // (its cell relief glitters when the animal is small in the frame)
  const dress = (key: Key, uInk: F | null) => (n: SkinNodes, _lod: number, kind: "hide" | "cards") => {
    const z = ZOO[key]
    const m = underwaterMaterial(n, SL, { ...z.look, ...LOOKX[key], ...(kind === "cards" ? { spec: 0.06, rim: 0.08, coat: 0 } : null), surface: kind === "cards" ? "feathers" : z.surface, water: { ...WATER, wet: WET[key] ?? 0.5 } })
    const body = m.fragmentNode as unknown as V4
    m.fragmentNode = Fn(() => {
      const c = body.rgb.toVar()
      if (uInk) {
        const k = uInk.mul(step(n.seed, 0.0005)).toVar()
        If(k.greaterThan(0.002), () => {
          const nn = normalize(n.vN).toVar()
          const nv = abs(dot(nn, normalize(cameraPosition.sub(n.vW))))
          // the pen's version of the body: a contour where the form turns away, a line along every furrow
          // and joint (where the surface's facing changes within a pixel or two), hatching in the shade
          const line = smoothstepRev(0.55, 0.36, nv)
          const crease = smoothstep(0.07, 0.2, length(dFdx(nn)).add(length(dFdy(nn))))
          const px = screenUV.mul(uRes)
          const shade = smoothstepRev(0.1, -0.4, dot(nn, normalize(LP)))
          const hat = smoothstep(0.55, 0.8, sin(px.x.add(px.y).mul(0.7)).mul(0.5).add(0.5)).mul(shade).mul(0.7)
          const inked = mixN(vec3(0.8, 0.74, 0.6), vec3(0.035, 0.028, 0.03), sat(max(max(line, crease.mul(0.85)), hat) as F))
          c.assign(mixN(c, inked, k))
        })
      }
      return vec4(c, eyeD(n.vW).div(64))
    })()
    return m
  }
  const _pa = new Float32Array(6)
  /** A straight road through the origin: sessile animals are planted by (distance, lane) on one of four of these, for four facings. */
  const ROADS = [0.35, 1.9, 3.5, 5.1].map((a) => ({ c: Math.cos(a), s: Math.sin(a), path: makePath([[-90 * Math.cos(a), 0, -90 * Math.sin(a)], [0, 0, 0], [90 * Math.cos(a), 0, 90 * Math.sin(a)]], false, 64) }))
  /** Distance along `path` at which it passes closest to a point, searched from `from` on. */
  const sOf = (path: Path, x: number, y: number, z: number, from = 0, to = path.length) => {
    let best = from, bd = 1e9
    for (let i = 0; i <= 600; i++) {
      const s = from + ((to - from) * i) / 600
      path.at(s, _pa)
      const d = (x - _pa[0]) ** 2 + (y - _pa[1]) ** 2 + (z - _pa[2]) ** 2
      if (d < bd) { bd = d; best = s }
    }
    return best
  }
  let gLift = 0
  const liftedGround = (x: number, z: number) => floorY(x, z) + gLift
  const sinkOf = (T: number, a: number) => E.io2(clamp((T - (T_IN - 0.5 + a)) / 1.9)) * (1 - E.io2(clamp((T - (T_OUT - 1.05 - a * 0.5)) / 1.6)))

  type Hero = {
    key: Key; herd: Herd; path: Path; walker: boolean; s0: number; L: number; t0: number; t1: number
    sP: number; sS: number; cx: number; uInk: { value: number }; wet: number; sinkA: number; back: boolean
    pos: Float32Array; lead: Float32Array | null; len: number; name: string; lab: [number, number, number, number]; top: number
  }
  const heroes: Hero[] = []
  const heroOf = {} as Record<Key, Hero>
  /** When the wet front reaches a place on the sheet (seconds of the beat). */
  const wetTime = (u: number, v: number) => {
    return T_SOAK * clamp((trackD(u, v) + 0.9) / (SOAK_R + 1.3)) ** (1 / 0.85) // when the front is 0.9 past it: the paper there is a window
  }
  /**
   * A drawing that comes alive. `plate` is its Draw (place, facing, size); `real` its length in the
   * sea; `route` the way it goes, from under its place on the plate and back to it (y is used by
   * swimmers; walkers stand on the mud). A closed route is travelled once; `back` goes out and returns.
   */
  const hero = (key: Key, count: number, plate: [number, number, number, number], real: number, route: [number, number, number][], o: { back?: boolean; go?: number; lods?: LodSpec[]; name: string; lab: [number, number, number, number]; top: number; sinkA?: number; t0?: number }) => {
    const z = ZOO[key]
    const uI = uniform(1)
    const [ox, oy, rot, sc] = plate
    const hx = Math.cos(rot), hz = -Math.sin(rot)
    const walker = !!z.spec.gait
    const y0 = route[0][1]
    const pts: [number, number, number][] = o.back ? [[ox - hx * 3, y0, -oy - hz * 3], [ox, y0, -oy], ...route.slice(1)] : [[ox, y0, -oy], [ox + hx * 0.5, y0, -oy + hz * 0.5], ...route.slice(1), [ox - hx * 0.6, y0, -oy - hz * 0.6]]
    const path = makePath(pts, !o.back)
    // (a spec banks per unit of curvature in its own units: here a unit is `real / len` of those)
    const spec: CreatureSpec = z.spec.swim ? { ...z.spec, swim: { ...z.spec.swim, bank: (z.spec.swim.bank ?? 0) * (real / z.len) } } : z.spec
    const herd = makeHerd({ spec, count, path, lods: o.lods, material: dress(key, uI as unknown as F) })
    seaScene.add(herd.group)
    const s0 = o.back ? sOf(path, ox, y0, -oy) : 0
    const h: Hero = {
      key, herd, path, walker, s0, L: o.back ? (o.go ?? path.length - s0 - 0.2) : path.length, t0: o.t0 ?? T_IN - 0.7, t1: T_HOME - 0.1, sP: sc / z.len, sS: real / z.len, cx: herd.rig.centre[0], uInk: uI, wet: wetTime(ox, oy), sinkA: o.sinkA ?? 0,
      back: !!o.back, pos: new Float32Array(3), lead: key === "marrella" || key === "pikaia" ? new Float32Array(3) : null, len: real, name: o.name, lab: o.lab, top: o.top,
    }
    heroes.push(h)
    heroOf[key] = h
    return h
  }
  let seaT = 0
  /** The drive of a hero at beat time `seaT`: where along its route, how big, how far it has sunk from the paper. */
  const heroDrive = (h: Hero, d: Drive) => {
    const g = h.back ? trap(seaT, h.t0, T_OUT - 1.2, 0.8) * (1 - E.io2(clamp((seaT - (T_OUT - 1.0)) / 1.5))) : trap(seaT, h.t0, h.t1, 1.0)
    const sk = sinkOf(seaT, h.sinkA)
    const sc = mix(h.sP, h.sS, sk)
    const dist = h.s0 + h.L * g
    d.path = h.path
    d.scale = sc
    d.dist = dist - h.cx * sc
    d.lane = 0
    d.seed = 0
    d.time = seaT
    h.path.at(dist, _pa)
    if (h.walker) {
      gLift = (1 - sk) * (-0.02 - floorY(_pa[0], _pa[2]))
      d.ground = liftedGround
      d.rise = 0
      h.pos[1] = floorY(_pa[0], _pa[2]) + gLift
    } else {
      d.ground = null
      d.rise = (1 - sk) * (-0.05 - _pa[1])
      h.pos[1] = _pa[1] + d.rise
    }
    h.pos[0] = _pa[0]
    h.pos[2] = _pa[2]
    return sk
  }

  // -- the routes (x, y, z). The stage is the patch of mud under the sheet and the knoll beside it.
  const fy = (x: number, z: number, up: number): [number, number, number] => [x, floorY(x, z) + up, z]
  const hTri = hero("olenoides", 3, [0.36, -0.06, Math.PI / 2 + 0.06, 0.72], 0.82, [[0.36, 0, -0.06], [0.42, 0, -0.7], [0.85, 0, -1.1], [1.4, 0, -0.9], [1.55, 0, -0.3], [1.2, 0, 0.3], [0.7, 0, 0.55]], { name: "Olenoides", lab: [3.9, 6.3, 120, -150], top: 0.2, t0: T_IN - 0.9 })
  const hOpa = hero("opabinia", 2, [-1.2, 0.55, 0.08, 0.6], 0.85, [[-1.2, -14.6, -0.55], fy(0.1, -0.9, 1.0), fy(0.5, -2.1, 1.4), fy(-0.6, -3.0, 1.6), fy(-2.1, -2.7, 1.5), fy(-2.9, -1.5, 1.1), fy(-2.4, -0.6, 1.2)], { name: "Opabinia", lab: [7.8, 9.0, -150, -140], top: 0.22, sinkA: 0.15 })
  const hAno = hero("anomalocaris", 1, [1.06, -0.52, 0.3, 0.86], 3.9, [[1.06, -10.5, 0.52], [5, -10.9, -1.5], [6.6, -11.9, -6], [2, -12.7, -9.6], [-4, -13.2, -8], [-5.6, -13.4, -4], [-2.6, -13.3, -0.9], [0.9, -13.4, 1.3], [3.2, -12.8, 3.4], [1.8, -11.6, 4.6], [-1.5, -10.7, 2.6]], { name: "Anomalocaris", lab: [10.5, 12.0, 160, 150], top: 0.5, sinkA: -0.2, t0: T_IN + 0.9 })
  hero("hallucigenia", 3, [-0.3, 0.5, -0.04, 0.48], 0.42, [[-0.3, 0, -0.5], [0.0, 0, -0.53], [0.3, 0, -0.68], [0.5, 0, -0.95]], { back: true, go: 0.42, name: "Hallucigenia", lab: [6.9, 8.4, 150, -170], top: 0.25, sinkA: 0.3 })
  hero("pikaia", 26, [-1.2, -0.74, 0.08, 0.6], 0.5, [[-1.2, -15.2, 0.74], fy(0.2, 1.0, 0.6), fy(1.2, 0.5, 0.8), fy(1.3, -0.7, 1.1), fy(0.2, -1.5, 1.2), fy(-1.2, -1.3, 1.3), fy(-2.0, -0.3, 0.9), fy(-1.9, 0.5, 0.7)], { name: "Pikaia", lab: [9.1, 10.2, 150, -110], top: 0.15, sinkA: 0.25 })
  hero("marrella", 56, [0.34, -0.66, 0.5, 0.46], 0.27, [[0.34, -15.5, 0.66], fy(1.7, 0.3, 0.4), fy(2.4, -1.2, 0.5), fy(1.5, -2.6, 0.55), fy(-0.2, -2.8, 0.7), fy(-1.3, -1.2, 0.9), fy(-1.1, 0.4, 0.45)], { name: "Marrella", lab: [4.7, 6.5, -140, -130], top: 0.14, sinkA: 0.1 })
  hero("wiwaxia", 3, [-1.45, 0.02, 1.4, 0.36], 0.5, [[-1.45, floorY(-1.45, -0.02) + 0.005, -0.02], fy(-1.45 + Math.cos(1.4) * 0.5, -0.02 - Math.sin(1.4) * 0.5, 0.005), fy(-1.45 + Math.cos(1.4) * 1, -0.02 - Math.sin(1.4) * 1, 0.005)], { back: true, go: 0.3, name: "Wiwaxia", lab: [5.9, 7.3, -150, -150], top: 0.28, sinkA: 0.4, lods: [{ detail: 1, cover: 0.06 }, { detail: 0.45, cover: 0.02 }, { detail: 0.15, cover: 0 }] })

  // -- the many: a Marrella swarm circling just above the bottom, a Pikaia school that parts round the lens,
  // and second and third animals of the walkers going about their business farther off
  const ringPath = (cx: number, cz: number, r: number, up: number, n = 9, wob = 0.25) => makePath(Array.from({ length: n }, (_, i): [number, number, number] => {
    const a = -(i / n) * TAU, rr = r * (1 + wob * Math.sin(i * 2.4))
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr
    return [x, floorY(x, z) + up + 0.12 * Math.sin(i * 1.7), z]
  }), true)
  const swarmPath = ringPath(0.3, -0.9, 2.1, 0.42, 11, 0.16)
  const LENS_AT: [number, number, number] = [-0.3, -14.9, 0.2] // where the lens is when the school reaches it
  const schoolPath = makePath([[8, -13, -12], [5, -13.8, -7], [2.4, -14.4, -3.2], [0.8, -14.8, -1.3], LENS_AT, [-1.4, -15.0, 1.8], [-3, -14.6, 5], [-7, -13.5, 9]])
  const sLens = sOf(schoolPath, LENS_AT[0], LENS_AT[1], LENS_AT[2])
  const otherPaths: Partial<Record<Key, Path[]>> = {
    olenoides: [ringPath(-3.2, 2.4, 1.5, 0, 8), ringPath(4.6, -3.8, 1.3, 0, 8)],
    hallucigenia: [ringPath(-1.15, -1.55, 0.6, 0, 8), ringPath(-1.6, -1.4, 0.35, 0, 6)],
    wiwaxia: [ringPath(-2.6, -0.9, 0.7, 0.005, 8), ringPath(2.6, -2.6, 1.0, 0.005, 8)],
    opabinia: [ringPath(-5, -6, 3.0, 2.4, 8)],
  }
  const rv = rng(4711)
  const RND = new Float32Array(64 * 4)
  for (let i = 0; i < RND.length; i++) RND[i] = rv()
  RND.set([0.56, 0.66, 0.5, 0.62], 4)
  // the second animal of a swarm or school is the one its label points at: placed along its route so that it is in the frame while its name is up
  const LEAD_A: Partial<Record<Key, number>> = { marrella: 1.527, pikaia: 0.2 }
  let scatter = 0
  const fillOf = (h: Hero) => (i: number, d: Drive) => {
    if (i === 0) {
      heroDrive(h, d)
      return
    }
    const la = i === 1 ? LEAD_A[h.key] : undefined
    const a = RND[i * 4], b = RND[i * 4 + 1], c = RND[i * 4 + 2], e = RND[i * 4 + 3]
    d.ground = h.walker ? floorY : null
    d.rise = 0
    d.seed = 0.05 + a * 0.9
    d.time = seaT + a * 20
    d.scale = h.sS * (0.78 + 0.4 * b)
    if (h.key === "marrella") {
      // the swarm: strung along its ring, each with its own lane and height; when the predator comes through, it bursts
      d.path = swarmPath
      const sp = 1.1 * (1 + 0.1 * (c - 0.5))
      d.dist = sp * seaT + (la ?? a) * 7.5 + 0.2 * Math.sin(seaT * 0.9 + e * 6.3) + scatter * (c - 0.3) * 2.6
      d.lane = (b - 0.5) * 1.7 * (1 + 2.3 * scatter)
      d.rise = (e - 0.35) * 0.75 + scatter * e * 1.5 + 0.06 * Math.sin(seaT * 1.3 + a * 9)
    } else if (h.key === "pikaia") {
      // the school: it meets the lens at 9.4 s and opens round it
      d.path = schoolPath
      const s = sLens + 0.9 * (seaT - 9.75) + ((la ?? a) - 0.5) * 3.0
      const near = Math.exp(-(((s - sLens) / 0.8) ** 2))
      const sl = b < 0.5 ? -1 : 1, su = e < 0.5 ? -1 : 1
      d.dist = s
      d.lane = sl * (0.05 + Math.abs(b - 0.5) * 1.1 + 0.22 * near)
      d.rise = su * (0.03 + Math.abs(e - 0.5) * 0.6 + 0.12 * near)
    } else {
      const ps = otherPaths[h.key]
      const p = ps ? ps[(i - 1) % ps.length] : h.path
      d.path = p
      d.lane = 0
      d.dist = a * p.length + seaT * (h.key === "olenoides" ? 0.3 : h.key === "opabinia" ? 0.7 : h.key === "wiwaxia" ? 0.03 : 0.045) * (0.8 + 0.4 * b)
    }
  }
  const fills = heroes.map((h) => {
    const f = fillOf(h)
    if (!h.lead) return f
    const lead = h.lead
    return (i: number, d: Drive) => {
      f(i, d)
      if (i !== 1) return
      d.path.at(d.dist, _pa)
      const hl = Math.hypot(_pa[3], _pa[5]) || 1
      lead[0] = _pa[0] - (_pa[5] / hl) * d.lane
      lead[1] = _pa[1] + d.rise
      lead[2] = _pa[2] + (_pa[3] / hl) * d.lane
    }
  })

  // -- the floor's own animals: sponges, Dinomischus, Chancelloria, planted on the knoll and the mounds
  type Bed = { herd: Herd; n: number; x: Float32Array; z: Float32Array; sc: Float32Array; road: Uint8Array; fill: (i: number, d: Drive) => void }
  const bed = (key: Key, n: number, real: [number, number], spots: [number, number, number, number][], seed: number): Bed => {
    const z = ZOO[key]
    const herd = makeHerd({ spec: z.spec, count: n, path: ROADS[0].path, material: dress(key, null) })
    seaScene.add(herd.group)
    const x = new Float32Array(n), zz = new Float32Array(n), sc = new Float32Array(n), road = new Uint8Array(n)
    const r = rng(seed)
    for (let i = 0; i < n; i++) {
      // the first few stand where the lens will pass; the rest are scattered over the mounds
      const sp = spots[i < spots.length ? i : Math.floor(r() * spots.length)]
      const a = r() * TAU, rr = i < spots.length ? 0 : Math.sqrt(r()) * sp[2]
      x[i] = sp[0] + Math.cos(a) * rr
      zz[i] = sp[1] + Math.sin(a) * rr * (sp[3] || 1)
      sc[i] = mix(real[0], real[1], r()) / z.len
      road[i] = Math.floor(r() * 4)
      for (let k = 0; k < 3; k++) herd.tint[i * 3 + k] = 0.82 + r() * 0.36
    }
    const fill = (i: number, d: Drive) => {
      const R = ROADS[road[i]]
      d.path = R.path
      d.dist = 90 + x[i] * R.c + zz[i] * R.s
      d.lane = -x[i] * R.s + zz[i] * R.c
      d.rise = floorY(x[i], zz[i]) - 0.02
      d.ground = null
      d.scale = sc[i]
      d.seed = 0.1 + (i * 0.618) % 0.9
      d.time = seaT + i * 1.37
    }
    return { herd, n, x, z: zz, sc, road, fill }
  }
  const beds: Bed[] = [
    bed("vauxia", 34, [0.45, 0.8], [[-0.95, -1.4, 0, 1], [-1.65, -1.65, 0, 1], [-0.5, -1.9, 0, 1], [-2.2, -0.9, 0, 1], [-6.5, -7, 4.2, 0.8], [3.2, -9.5, 5.5, 0.6], [8.8, -3.5, 2.8, 1], [-8.5, 0.5, 2.2, 1.5]], 31),
    bed("dinomischus", 44, [0.2, 0.34], [[-0.05, -1.0, 0, 1], [0.12, -0.86, 0, 1], [-0.7, -0.95, 0, 1], [-1.0, -0.5, 0, 1], [1.1, 2.55, 0, 1], [-1.15, -1.55, 1.1, 0.8], [-6.5, -7, 4.2, 0.8], [3.2, -9.5, 5.5, 0.6], [1.5, 7.5, 3, 0.5], [0.5, 2.8, 1.2, 0.4]], 32),
    bed("chancelloria", 22, [0.5, 1.0], [[-1.95, -1.25, 0, 1], [-1.3, -2.2, 0, 1], [-6.5, -7, 4, 0.8], [3.2, -9.5, 5.2, 0.6], [8.8, -3.5, 2.6, 1], [-8.5, 0.5, 2, 1.5]], 33),
  ]

  // -- the trilobite's trackway: its own footfalls, taken from the rig along the route it will walk
  const NPRINT = 1400
  const uTrack = uniform(0) // how far along its route the trilobite's middle is
  const printGeo = new THREE.InstancedBufferGeometry()
  {
    printGeo.setAttribute("position", quad)
    printGeo.setIndex([0, 1, 2, 0, 2, 3])
    const a = new Float32Array(NPRINT * 4), b = new Float32Array(NPRINT * 2)
    const rig = hTri.herd.rig
    const d = makeDrive(hTri.path)
    d.scale = hTri.sS
    d.ground = floorY
    const last = new Float32Array(rig.legs * 2).fill(1e6)
    const f = [0, 0, 0]
    const stride = (ZOO.olenoides.spec.gait?.stride ?? 1) * hTri.sS
    let n = 0
    for (let k = 0; k * stride / 24 < hTri.L && n < NPRINT; k++) {
      const dist = (k * stride) / 24
      d.dist = dist - hTri.cx * hTri.sS
      d.time = 0
      rig.pose(d)
      for (let l = 0; l < rig.legs && n < NPRINT; l++) {
        if (!rig.foot(l, f)) continue
        if (Math.hypot(f[0] - last[l * 2], f[2] - last[l * 2 + 1]) < stride * 0.3) continue
        last[l * 2] = f[0]
        last[l * 2 + 1] = f[2]
        hTri.path.at(dist, _pa)
        a.set([f[0], floorY(f[0], f[2]) + 0.004, f[2], dist], n * 4)
        b.set([Math.atan2(_pa[5], _pa[3]), (n * 0.618) % 1], n * 2)
        n++
      }
    }
    printGeo.setAttribute("aP", new THREE.InstancedBufferAttribute(a, 4))
    printGeo.setAttribute("aQ", new THREE.InstancedBufferAttribute(b, 2))
    printGeo.instanceCount = n
  }
  const printMat = (() => {
    const aP = attribute("aP", "vec4") as V4, aQ = attribute("aQ", "vec2") as V2
    const c = cos(aQ.x), sn = sin(aQ.x)
    const sz = hTri.sS * (ZOO.olenoides.len * 0.032)
    // a scratch across the line of travel, as arthropod prints are
    const l = vec2(positionGeometry.x.mul(0.5), positionGeometry.y.mul(1.25)).mul(sz).mul(aQ.y.mul(0.5).add(0.8))
    const pos = vec3(aP.x.add(l.x.mul(c)).sub(l.y.mul(sn)), aP.y, aP.z.add(l.x.mul(sn)).add(l.y.mul(c)))
    const on = step(aP.w.add(hTri.len * 0.1), uTrack)
    const vS = vec3(positionGeometry.xy, uTrack.sub(aP.w)).toVarying()
    const vP = pos.toVarying() as V3
    const frag = Fn(() => {
      const r = length(vS.xy)
      const pit = smoothstepRev(0.62, 0.3, r)
      const lipK = smoothstep(0.55, 0.8, r).mul(smoothstepRev(1, 0.86, r)).mul(sat(vS.y.mul(0.6).add(0.4) as F))
      const d = eyeD(vP)
      const dark = seaFog(vec3(0.16, 0.14, 0.09).mul(SKY_W.mul(1.2).add(KEY_W.mul(0.1))) as V3, vP, d)
      const lite = seaFog(vec3(0.6, 0.56, 0.42).mul(KEY_W.mul(0.8)) as V3, vP, d)
      return vec4(mixN(dark, lite, lipK), max(pit.mul(0.85), lipK.mul(0.45)).mul(smoothstepRev(0.7, 0.3, d.mul(uPxK).div(sz))))
    })()
    return mk(select(on.greaterThan(0.5), viewProj.mul(vec4(pos, 1)), vec4(2, 2, 2, 1)) as THREE.Node, frag, { ...OVER, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  })()
  const prints = new THREE.Mesh(printGeo, printMat)
  prints.frustumCulled = false
  prints.renderOrder = 2
  seaScene.add(prints)

  // ---- the sea's lens: a macro lens's shallow focus from the distance in alpha, shafts from the sun, and the wobble of breaking the surface
  const SA = { tS: uniformTexture(seaRT.texture), uAsp: uniform(16 / 9), uSunUV: uniform(new THREE.Vector3(0.3, 1.4, 1)), uSplash: uniform(0), uShaft: uniform(1) }
  const seaLens = ctx.pass(({ uv, res }) => {
    const wob = vec2(vnoise(uv.mul(vec2(7, 11)).add(vec2(0, uSeaT.mul(3.1)))), vnoise(uv.mul(vec2(9, 6)).add(vec2(uSeaT.mul(2.7), 4)))).sub(0.5).mul(SA.uSplash).mul(0.07)
    const u0 = uv.add(wob).toVar()
    const c0 = sampleRT(SA.tS, u0 as V2).toVar()
    const d0 = c0.a.mul(64).toVar()
    const c = c0.rgb.toVar()
    const coc = max(cocAt(d0 as F), SA.uSplash.mul(0.012)).toVar()
    If(coc.greaterThan(0.0007), () => {
      const j = hash21(floor(uv.mul(res)).add(0.5)).mul(TAU).toVar()
      const acc = vec3(c).toVar()
      const ws = float(1).toVar()
      for (let i = 0; i < 14; i++) {
        const a = j.add(i * 2.39996)
        const t = sampleRT(SA.tS, u0.add(vec2(cos(a).div(SA.uAsp), sin(a)).mul(coc.mul(Math.sqrt((i + 0.5) / 14)))) as V2).toVar()
        // a sharp thing in front does not smear into the blur behind it
        const wt = mixN(sat(cocAt(t.a.mul(64) as F).div(coc).mul(1.4) as F), 1, step(d0.sub(0.05), t.a.mul(64))).mul(luma(t.rgb).mul(0.8).add(1)).toVar()
        acc.addAssign(t.rgb.mul(wt))
        ws.addAssign(wt)
      }
      c.assign(acc.div(ws))
    })
    // shafts: the caustics seen edge-on, fanning from where the sun stands over the water
    const dv = uv.sub(SA.uSunUV.xy).mul(vec2(SA.uAsp, 1)).toVar()
    const ang = dv.x.div(max(abs(dv.y), 0.05))
    const sh = vnoise(vec2(ang.mul(5.5).add(uSeaT.mul(0.11)), 1.7)).mul(vnoise(vec2(ang.mul(13).sub(uSeaT.mul(0.17)), 4.2))).mul(vnoise(vec2(ang.mul(2.1).add(uSeaT.mul(0.05)), 9.4)).add(0.4))
    const shaft = pow(sat(sh.mul(2.6) as F), 1.6).mul(exp(length(dv).mul(-1.25))).mul(step(0, dv.y.negate())).mul(sat(d0.div(7) as F)).mul(SA.uShaft)
    c.addAssign(vec3(1.5, 1.35, 0.7).mul(shaft).mul(0.26))
    return vec4(c, 1)
  }, SA)
  seaLens.mat.name = "cambrianSeaLens"

  // ---- the lens's way through the sea: where it is, what it looks at, how far it focuses, how wide it sees
  // [t, px, py, pz, lx, ly, lz, focus (0 = on the look point), aperture, fov]
  const CAMK: number[][] = [
    [2.3, -0.42, 1.5, 0.22, -0.45, 0, 0.1, 0, 0.004, 30],
    [T_IN, -0.45, 0.0, 0.14, -0.3, -5, -0.1, 3.2, 0.012, 34],
    [3.6, -2.2, -8.5, 1.9, 0.2, -15, -0.3, 0, 0.02, 40],
    [4.5, 1.5, -15.5, 0.35, 0.65, -15.82, -0.85, 0, 0.024, 40],
    [5.6, 1.95, -15.58, -0.05, 1.2, -15.8, -1.0, 0, 0.024, 40],
    [6.6, -0.75, -15.5, 0.8, -1.42, -15.76, -0.2, 0, 0.024, 40],
    [7.6, 0.25, -15.6, 0.2, -0.2, -15.74, -0.62, 0, 0.024, 38],
    [8.05, -0.45, -14.95, -0.15, -1.2, -14.5, -1.8, 0, 0.024, 40],
    [8.6, -1.25, -14.55, -1.2, -1.7, -14.2, -2.9, 0, 0.024, 42],
    [9.2, LENS_AT[0], LENS_AT[1], LENS_AT[2], 0.8, -14.75, -1.3, 1.4, 0.012, 44],
    [9.9, LENS_AT[0] - 0.06, LENS_AT[1], LENS_AT[2] + 0.12, 0.7, -14.8, -1.3, 1.1, 0.012, 44],
    [10.6, -0.58, -15.4, 3.68, -1.2, -14.3, 0.2, 0, 0.014, 48],
    [11.5, -0.3, -15.3, 3.9, 2.2, -13.6, 2.6, 0, 0.014, 48],
    [12.0, -0.6, -12.8, 2.6, 0.3, -15.6, 0.3, 0, 0.014, 44],
    [T_OUT, -0.75, 0.0, 0.35, -0.3, -7, 0.1, 6, 0.01, 36],
    [13.7, 0.5, 2.3, 0.75, 0.45, 0, -0.25, 0, 0.004, 31],
  ]

  // ---------------------------------------------------------------- the lens pass: focus that tells the scale, and the lamp in the air

  const stage = stageTarget(ctx)
  const inkRT = ctx.target({ hdr: false })
  const out = ctx.target({})
  const A = { tA: uniformTexture(stage.texture), uDof: uniform(0), uFy: uniform(0.5), uAsp: uniform(16 / 9), uKnock: uniform(0) }
  const air = ctx.pass(({ uv, res }) => {
    const c = sampleRT(A.tA, uv).rgb.toVar()
    // seen close and at a slant, only a band of the sheet is sharp
    const coc = A.uDof.mul(smoothstep(0.1, 0.62, abs(uv.y.sub(A.uFy)))).toVar()
    If(coc.greaterThan(0.0004), () => {
      const j = hash21(floor(uv.mul(res)).add(0.5)).mul(TAU).toVar()
      const acc = vec3(c).toVar()
      const ws = float(1).toVar()
      for (let i = 0; i < 12; i++) {
        const a = j.add(i * 2.39996)
        const t = sampleRT(A.tA, uv.add(vec2(cos(a).div(A.uAsp), sin(a)).mul(coc.mul(Math.sqrt((i + 0.5) / 12)))) as V2).rgb.toVar()
        const wt = luma(t).mul(1.5).add(1).toVar()
        acc.addAssign(t.mul(wt))
        ws.addAssign(wt)
      }
      c.assign(acc.div(ws))
    })
    // the lamp is up and to the left, out of frame: its warmth hangs in the air on that side
    const d = length(uv.sub(vec2(-0.12, 1.2)).mul(vec2(A.uAsp, 1)))
    c.addAssign(vec3(0.05, 0.032, 0.014).mul(exp(d.mul(-1.5))))
    return vec4(c, 1)
  }, A)
  air.mat.name = "cambrianAir"

  // ---------------------------------------------------------------- the schedule: sound from the stroke table

  const cues: Cue[] = []
  const sv = new THREE.Vector3()
  {
    // one grain of scratch per stroke, its length and pitch from the stroke's own speed; thinned to
    // about fifteen a second when the page fills
    const lastAt = [-1, -1, -1]
    for (const s of [...scr].sort((a, b) => a.b - b.b || a.t - b.t)) {
      const gap = s.b === 0 ? 0.045 : 0.066
      if (s.t - lastAt[s.b] < gap) continue
      lastAt[s.b] = s.t
      cues.push({ b: s.b, at: s.t, s: "scratch", o: { dur: clamp(s.dur, 0.05, 0.4), f: 2500 + clamp(s.spd / 2.5) * 3200 + ((cues.length * 37) % 9) * 60, g: s.b === 0 ? 1.1 : 0.75, pan: clamp(s.x / 2, -0.8, 0.8) } })
    }
    // the nib in the bottle (up and to the right)
    for (const [b, at] of [[0, 0.12], [0, 5.9], [1, 0.12], [1, 0.3], [1, 4.4], [2, 0.2]] as const) {
      cues.push({ b, at, s: "glass", o: { f: H(72), g: 0.16, pan: 0.7 } }, { b, at: at + 0.01, s: "tick", o: { f: 4200, g: 0.3, pan: 0.7 } })
    }
    // the bead lands (the transition plays the hit itself; this is the sheet answering)
    cues.push({ b: 0, at: 0.02, s: "splash", o: { g: 0.35 }, pos: [0.2, -0.6, 0] })
    cues.push({ b: 0, at: 7.9, s: "pluck", o: { f: H(12), g: 0.35, pan: -0.2 } })
    // a note for every drawing finished, climbing
    const scale = [8, 9, 10, 12, 15, 16, 18, 20, 24, 27, 30, 32, 36]
    done.forEach((d, i) => cues.push({ b: 1, at: d.t, s: "pluck", o: { f: H(scale[i % scale.length]) * 2, g: 0.32, pan: clamp(d.x / 2, -0.8, 0.8) } }))
    cues.push({ b: 1, at: 0.5, s: "whoosh", o: { f: 500, dur: 0.8, g: 0.35 } }, { b: 1, at: 0.6, s: "pad", o: { f: H(4), dur: 11, g: 0.8 } }, { b: 1, at: 10.6, s: "bell", o: { f: H(24), g: 0.3 } })
    // the selection, the flex, the walk
    cues.push({ b: 2, at: 2.6, s: "select", o: { g: 0.9 } }, { b: 2, at: 2.62, s: "marimba", o: { f: H(16), g: 0.4 } })
    cues.push({ b: 2, at: 3.3, s: "page", o: { g: 0.3 } }, { b: 2, at: 3.55, s: "page", o: { g: 0.22 } })
    for (const st of steps) if (st.x < 2.6) cues.push({ b: 2, at: st.t, s: "tick", o: { f: 5200 + ((st.x * 977) % 600), g: 0.2 }, pos: () => listenerPos(sv.set(st.x, 0, st.z), cam) })
    // the loupe: lifted, swung over, set down
    cues.push({ b: 2, at: 4.4, s: "whoosh", o: { f: 700, dur: 1.3, g: 0.22, pan: 0.6 } })
    cues.push({ b: 2, at: 6.0, s: "stone", o: { g: 0.6 }, pos: () => listenerPos(loupe.position, cam) }, { b: 2, at: 6.01, s: "glass", o: { f: H(40), g: 0.3 }, pos: () => listenerPos(loupe.position, cam) }, { b: 2, at: 6.07, s: "tick", o: { f: 3000, g: 0.35 }, pos: () => listenerPos(loupe.position, cam) })
    cues.push({ b: 2, at: 7.7, s: "bell", o: { f: H(36), g: 0.25, pan: 0.8 } })
  }
  {
    // beat 4. The page wets through (a hiss, the paper giving), each drawing lets go with a note, the
    // lens goes under (a riser into the splash, the low end opening), and the sea has its own small
    // sounds, each where its animal is: the click and scuttle of the trilobite's legs, the blips of
    // bubbles, a soft rush as the school goes by, and the predator's pass, which is felt more than heard.
    const at = (h: Hero) => () => listenerPos(sv.set(h.pos[0], h.pos[1], h.pos[2]), cam, 2.2)
    cues.push({ b: 3, at: 0.05, s: "hiss", o: { g: 0.22, dur: 2.3 } }, { b: 3, at: 0.35, s: "squelch", o: { g: 0.28 }, pos: [0.35, 0.3, 0] }, { b: 3, at: 1.3, s: "squelch", o: { g: 0.2 }, pos: [-0.3, -0.2, 0] })
    heroes.forEach((h, i) => cues.push({ b: 3, at: h.wet + 0.45, s: "pluck", o: { f: H([12, 16, 9, 18, 20, 24, 15][i % 7]) * 2, g: 0.2 }, pos: at(h) }))
    cues.push({ b: 3, at: T_IN - 0.9, s: "riser", o: { dur: 0.9, g: 0.4 } }, { b: 3, at: T_IN, s: "splash", o: { g: 0.9 } }, { b: 3, at: T_IN + 0.02, s: "sub", o: { g: 0.8 } }, { b: 3, at: T_IN + 0.12, s: "rumble", o: { g: 0.3, dur: 2.2 } })
    for (let k = 0; k < 16; k++) {
      const u = (k * 0.618) % 1
      cues.push({ b: 3, at: T_IN + 0.18 + k * 0.11 + u * 0.05, s: "pluck", o: { f: 1300 + u * 1900 + k * 40, g: 0.1 * (1 - k / 22), dur: 0.07 }, pos: [u * 1.6 - 0.8, 0.1 + k * 0.05, 0.2] })
      if (k < 10) cues.push({ b: 3, at: T_OUT + 0.1 + k * 0.12 + u * 0.05, s: "pluck", o: { f: 1500 + u * 1700, g: 0.08 * (1 - k / 14), dur: 0.07 }, pos: [u * 1.6 - 0.8, -0.3, 0.3] })
    }
    // threads of bubbles from the mud
    for (let k = 0; k < 9; k++) cues.push({ b: 3, at: 4.1 + k * 0.93, s: "pluck", o: { f: 1900 + ((k * 733) % 900), g: 0.05, dur: 0.06 }, pos: () => listenerPos(sv.set(VENTS[k % 3][0], SEA_Y + 0.8, VENTS[k % 3][1]), cam, 2.2) })
    // the trilobite: every footfall of the wave is too many to hear; a tick for each pair as it lands
    for (let t = 3.75; t < 6.5; t += 0.085) cues.push({ b: 3, at: t, s: "tick", o: { f: 2500 + ((t * 977) % 800), g: 0.13 * smooth(3.7, 4.3, t) * (1 - smooth(5.6, 6.5, t)), vary: 0.5 }, pos: at(hTri) })
    cues.push({ b: 3, at: 8.0, s: "whoosh", o: { f: 900, dur: 1.0, g: 0.12 }, pos: at(hOpa) })
    cues.push({ b: 3, at: 9.3, s: "whoosh", o: { f: 1700, dur: 0.9, g: 0.16 }, pos: [0.2, 0, 0.2] }, { b: 3, at: 9.5, s: "shimmer", o: { g: 0.14, dur: 1.2 } })
    for (let k = 0; k < 5; k++) cues.push({ b: 3, at: 9.5 + k * 0.1, s: "flap", o: { g: 0.1, f: 500 + k * 60 }, pos: [k % 2 ? 0.7 : -0.7, 0, -0.3] })
    cues.push({ b: 3, at: 10.2, s: "rumble", o: { g: 0.55, dur: 2.6 }, pos: at(hAno) }, { b: 3, at: 10.5, s: "whoosh", o: { f: 130, dur: 1.9, g: 0.5 }, pos: at(hAno) }, { b: 3, at: 11.0, s: "sub", o: { g: 0.55 } })
    for (let k = 0; k < 7; k++) cues.push({ b: 3, at: 10.75 + k * 0.045, s: "flap", o: { g: 0.13, f: 700 + k * 90 }, pos: [((k * 0.618) % 1) * 1.8 - 0.9, -0.3, 0.3] })
    cues.push({ b: 3, at: T_OUT - 1.0, s: "riser", o: { dur: 1.0, g: 0.3 } }, { b: 3, at: T_OUT, s: "splash", o: { g: 0.7 } }, { b: 3, at: 14.1, s: "page", o: { g: 0.2 } }, { b: 3, at: 15.0, s: "page", o: { g: 0.16 } })
    cues.push({ b: 3, at: T_DRY, s: "bell", o: { f: H(24), g: 0.22 } }, { b: 3, at: T_DRY + 0.02, s: "pluck", o: { f: H(12), g: 0.3, pan: -0.2 } })
  }
  // how fast ink is going down, per tenth of a second of each beat (for the bed)
  const rate: Float32Array[] = [new Float32Array(140), new Float32Array(160), new Float32Array(140)]
  for (const s of scr) {
    const r = rate[s.b]
    const i0 = Math.floor(s.t * 10), i1 = Math.floor((s.t + s.dur) * 10)
    for (let i = Math.max(0, i0); i <= Math.min(r.length - 1, i1); i++) r[i] += (s.spd * s.dur) / (i1 - i0 + 1) * 10
  }
  // (beats past the drawn ones, such as the living-sea beat added to the script, draw no ink yet)
  const inkRate = (b: number, t: number) => (t < 0 || !rate[b] ? 0 : rate[b][Math.min(rate[b].length - 1, Math.floor(t * 10))] ?? 0)

  // ---------------------------------------------------------------- camera poses: what is framed, and from how high

  /** Pose: target in the sheet (u, v) and the camera's height. The frame is 0.953 h wide at 16:9. */
  type Pose = [number, number, number]
  const P_DICK: Pose = [-0.62, 0.0, 2.75]
  // (from the whip on, the sheet's top edge is held at the same height in the frame: the headline has the desk)
  const bandV = (h: number) => HH - 0.1233 * h
  const P_WHIP: Pose = [-0.2, bandV(3.55), 3.55]
  const P_WIDE: Pose = [0.25, bandV(5.75), 5.75]
  const P_BOX: Pose = [wRest[0] + 0.25, bandV(3.0), 3.0]
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3()
  const TILT = 0.2, ROLL = -0.035
  const place = (c: THREE.PerspectiveCamera, u: number, v: number, h: number, roll = ROLL) => {
    c.position.set(u, h, -v + h * TILT)
    c.up.set(0, 1, 0)
    c.lookAt(u, 0, -v)
    c.rotateZ(roll)
    c.updateMatrixWorld()
  }
  // the opening frame is the one the bead lands in: solve for the pose that puts the blot where
  // the transition drops it (THAW_HIT, in the frame)
  const P_START: Pose = [F0[0], F0[1], 0.95]
  {
    const c = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60)
    for (let i = 0; i < 6; i++) {
      place(c, P_START[0], P_START[1], P_START[2])
      c.updateProjectionMatrix()
      v0.set(F0[0], 0, -F0[1]).project(c)
      const fw = 0.953 * P_START[2], fh = fw * (9 / 16)
      P_START[0] += ((v0.x - (THAW_HIT[0] * 2 - 1)) * fw) / 2
      P_START[1] += ((v0.y - (THAW_HIT[1] * 2 - 1)) * fh) / 2
    }
  }
  const pose: Pose = [0, 0, 1]
  const toward = (p: Pose, k: number) => {
    pose[0] += (p[0] - pose[0]) * k
    pose[1] += (p[1] - pose[1]) * k
    pose[2] = Math.exp(Math.log(pose[2]) + (Math.log(p[2]) - Math.log(pose[2])) * k) // height in log space
  }

  // ---------------------------------------------------------------- per-frame state

  const st = { sel: [0, 0, 0, 0], selA: 0, ink: 0, band: 0, dof: 0, fy: 0.5, loupeOn: true, knock: 0, seaOn: false, under: false, dive: 0, splash: 0 }
  const POSTSEA: PostOpts = { tone: "aces", exposure: 0.98, bloom: 0.32, bloomThresh: 1.0, bloomRadius: 0.8, contrast: 1.2, sat: 1.12, vignette: 0.46, grain: 0.02, ca: 0.0016, lift: [0.004, 0.008, 0.002], gain: [1.04, 1.0, 0.9] }
  // the lens's keys with the desk's own pose at both ends (filled each frame: the desk pose drifts)
  const NK = CAMK.length + 2
  const KT = new Float32Array(NK), KV = new Float32Array(NK * 9), kv = new Float32Array(9)
  for (let i = 0; i < CAMK.length; i++) {
    const k = CAMK[i]
    KT[i + 1] = k[0]
    for (let j = 0; j < 9; j++) KV[(i + 1) * 9 + j] = k[j + 1]
    if (k[7] === 0) KV[(i + 1) * 9 + 6] = Math.hypot(k[1] - k[4], k[2] - k[5], k[3] - k[6])
  }
  KT[NK - 1] = 16
  /** Cubic Hermite through the keys in time (tangents by finite difference, flat at both ends) into `kv`. */
  const camAt = (T: number) => {
    let i = 0
    while (i < NK - 2 && T > KT[i + 1]) i++
    const h = KT[i + 1] - KT[i], x = clamp((T - KT[i]) / h)
    const x2 = x * x, x3 = x2 * x
    const a = 2 * x3 - 3 * x2 + 1, b = x3 - 2 * x2 + x, c = -2 * x3 + 3 * x2, d = x3 - x2
    for (let j = 0; j < 9; j++) {
      const p0 = KV[i * 9 + j], p1 = KV[(i + 1) * 9 + j]
      // (tangents limited as for a monotone spline: a key is never overshot, so the lens cannot dip through the mud)
      const sl = (p1 - p0) / h
      let m0 = 0, m1 = 0
      if (i > 0) {
        const sp = (p0 - KV[(i - 1) * 9 + j]) / (KT[i] - KT[i - 1])
        if (sp * sl > 0) m0 = Math.sign(sl) * Math.min(Math.abs((p1 - KV[(i - 1) * 9 + j]) / (KT[i + 1] - KT[i - 1])), 3 * Math.abs(sp), 3 * Math.abs(sl))
      }
      if (i + 2 < NK) {
        const sn = (KV[(i + 2) * 9 + j] - p1) / (KT[i + 2] - KT[i + 1])
        if (sn * sl > 0) m1 = Math.sign(sl) * Math.min(Math.abs((KV[(i + 2) * 9 + j] - p0) / (KT[i + 2] - KT[i])), 3 * Math.abs(sn), 3 * Math.abs(sl))
      }
      kv[j] = a * p0 + b * h * m0 + c * p1 + d * h * m1
    }
  }
  // labels: one per animal that came off the plate, on the type layer, pinned to it by a leader
  type Lab = { a: number; ax: number; ay: number; x: number; y: number; w: number; h: number; left: boolean }
  const labs: Lab[] = heroes.map(() => ({ a: 0, ax: 0, ay: 0, x: 0, y: 0, w: 0, h: 0, left: false }))
  const LAB_NAME = 44, LAB_SRC = 27
  const labelOut: LabelInfo[] = []
  const labelPool: LabelInfo[] = heroes.map((h) => ({ id: h.key, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] }))
  const wp: P2 = [0, 0]
  const port: Portal = { c: [[0, 0], [0, 0], [0, 0], [0, 0]], a: 1, shade: 1 }
  const POST: PostOpts = { tone: "aces", exposure: 0.92, bloom: 0.16, bloomThresh: 1.15, bloomRadius: 0.7, contrast: 1.08, sat: 1.04, vignette: 0.36, grain: 0.022, ca: 0.0012, lift: [0.004, 0.005, 0.01], gain: [1.03, 1.0, 0.95] }
  // the headline is dark ink while it lies on the sheet and cream when the desk is under it
  const INKS: string[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const ch = (a: number, b: number) => Math.round(mix(a, b, t)).toString(16).padStart(2, "0")
    INKS.push(`#${ch(0x2b, 0xf6)}${ch(0x1d, 0xea)}${ch(0x14, 0xd2)}`)
  }
  const TITLES: TitleOpts = { color: INKS[0], y: 178, delay: [0.5, 1.45, 0.3, 0.5], maxLine: 40 }
  const HD = makeDrive(ROADS[0].path)
  const TRACK: { key: Key; t0: number; t1: number; ramp: number; up: number }[] = [
    { key: "olenoides", t0: 3.9, t1: 6.2, ramp: 0.7, up: 0.05 },
    { key: "wiwaxia", t0: 6.0, t1: 7.2, ramp: 0.5, up: 0.08 },
    { key: "hallucigenia", t0: 7.0, t1: 8.2, ramp: 0.5, up: 0.08 },
    { key: "opabinia", t0: 7.9, t1: 8.9, ramp: 0.45, up: 0 },
    { key: "anomalocaris", t0: 10.3, t1: 11.9, ramp: 0.6, up: 0 },
  ]
  const HUD = { color: INKS[0], shadow: undefined as string | undefined }
  const sheetQuad = [new THREE.Vector3(-HW, 0, -HH), new THREE.Vector3(HW, 0, -HH), new THREE.Vector3(HW, 0, HH), new THREE.Vector3(-HW, 0, HH)]

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1), t2 = s.at(2)
    uAt.value.set(clamp(t0, -9, 999), clamp(t1, -9, 999), clamp(t2, -9, 999))

    // ---- the one that leaves
    const tau = t2 - WALK0
    const u = walked(tau)
    const flex = s.k(2, 3.25, 3.5, E.out2) * (1 - s.k(2, 3.8, 4.3, E.io2))
    uWalk.value.set(u, flex, (u / 0.03) * Math.PI, s.time * 17)
    walkAt(u, 0, 0, wp)

    // ---- the bead that `thaw` drops: a blot that spreads, soaks in and dries to a tide line
    const land = Math.max(0, t0)
    uBlot.value.z = t0 < 0 ? 0 : BLOT_R * (0.35 + 0.65 * E.out3(clamp(land / 0.5))) * (1 + 0.12 * clamp(land / 6))
    uBlot.value.w = t0 < 0 ? 0 : 1 - smooth(1.2, 5.5, land)
    const knock = t0 >= 0 && s.beat === 0 ? Math.exp(-land * 5) : 0
    uShudder.value = knock * Math.sin(land * 46)

    // ---- the loupe: at rest on the edge of the sheet; in the last beat it is lifted, swung over
    // and set down ahead of the animal
    const sw = s.k(2, 4.4, 6.0, E.io3)
    const liftK = Math.sin(Math.PI * clamp(sw)) ** 0.7
    const setT = t2 - 6.0
    const settle = s.beat === 2 && setT > 0 ? Math.exp(-setT * 9) * Math.cos(setT * 40) : 0
    const lx = mix(LOUPE_REST[0], LOUPE_SET[0], sw) + 0.18 * liftK * Math.sin(sw * 3.1)
    const lz = -mix(LOUPE_REST[1], LOUPE_SET[1], sw) - 0.22 * liftK
    const ly = 0.42 * liftK + 0.004 * settle
    loupe.position.set(lx, ly, lz)
    loupe.rotation.set(0.1 * liftK * Math.cos(sw * 4) + 0.012 * settle, sw * 2.3, -0.14 * liftK * Math.sin(sw * 3.3))
    uLoupe.value.set(lx, ly, lz)

    // ---- the pen in the hand: down into the blot as the bead lands, along every stroke, up and away at the end
    const pv = s.beat === 0 && t0 > -0.9 && t0 < 8 ? 1 : 0
    penW.visible = pv > 0
    if (pv) {
      penAt(t0, penP)
      const away = 0.9 * (1 - E.out3(clamp((t0 + 0.9) / (PEN_IN + 0.9)))) + 1.1 * E.in2(clamp((t0 - PEN_OUT) / (8 - PEN_OUT)))
      const hgt = penP[2] + 0.0006
      penW.position.set(penP[0] + PEN_D.x * away, hgt + PEN_D.y * away, -penP[1] + PEN_D.z * away)
      uPen.value.set(penP[0] + PEN_D.x * away, -penP[1] + PEN_D.z * away, hgt + PEN_D.y * away, 1 - smooth(0.5, 0.95, away))
    } else uPen.value.w = 0

    // ---- camera
    pose[0] = P_START[0]
    pose[1] = P_START[1]
    pose[2] = P_START[2]
    // ride the first strokes, then crane up until the whole animal is in frame
    {
      // (the lens follows the nib, a little behind it: the mean of where it was over the last half second)
      let ax = 0, ay = 0
      for (let i = 0; i < 5; i++) {
        penAt(Math.max(0, t0 - 0.12 * i), penQ)
        ax += penQ[0] / 5
        ay += penQ[1] / 5
      }
      toward([ax + 0.04, ay - 0.02, 1.25], s.k(0, 0.15, 0.9, E.io2))
    }
    toward(P_DICK, s.k(0, 1.9, 8, E.io3))
    // then, fast: a whip back that overshoots, and a long pull as the page fills
    toward(P_WHIP, E.outBack(s.k(1, 0.5, 1.5, E.out2)))
    toward(P_WIDE, s.k(1, 1.5, 11, E.io2))
    // push in on the box, then go with the animal
    const push = s.k(2, 2.3, 3.6, E.io3)
    toward(P_BOX, push)
    const track = s.k(2, WALK0 + 0.1, WALK0 + 1.4, E.io2)
    const lead = 0.34
    const hT = 3.0 + 0.25 * s.k(2, 5, 8, E.io2)
    toward([Math.min(wp[0] + lead, 1.34), bandV(hT), hT], track)
    // it has gone: ease back until the plate lies whole on the desk (the next cut turns it like a page)
    toward([0.45, bandV(5.3), 5.3], s.k(2, 6.9, 8, E.io2))
    // Every keyed move above ends inside its beat's duration, so advancing at any moment of a hold starts the
    // next beat from the frame on screen. What moves through a hold is on the scene's running clock, which
    // does not restart at a beat boundary: a slow breathing of the height on top of the hand-held drift.
    const creep = 0.022 * (0.5 - 0.5 * Math.cos(s.time * 0.11)) + 0.008 * Math.sin(s.time * 0.047 + 1)
    let h = pose[2] * (1 + creep)
    let cu = pose[0], cv = pose[1]
    // a hand-held drift in proportion to the frame, and the knock of the landing
    const dr = h * 0.006
    cu += dr * (Math.sin(s.time * 0.31) + 0.5 * Math.sin(s.time * 0.73 + 1)) + s.mouse.x * h * 0.012
    cv += dr * (Math.sin(s.time * 0.27 + 2) + 0.5 * Math.sin(s.time * 0.61)) + s.mouse.y * h * 0.009
    h *= 1 + 0.004 * Math.sin(s.time * 0.23 + 4)
    cv += knock * 0.012 * Math.sin(land * 38)
    h *= 1 - knock * 0.02 * Math.cos(land * 31)
    // small knocks as drawings are finished, and one as the loupe is set down
    let fin = 0
    if (s.beat === 1) for (const d of done) if (t1 > d.t) fin += Math.exp(-(t1 - d.t) * 9)
    cu += fin * h * 0.0016 * Math.sin(s.time * 61)
    cv += (fin * h * 0.0016 + Math.abs(settle) * 0.006) * Math.sin(s.time * 53 + 1)
    cam.aspect = s.w / s.h
    // (a frame narrower than 16:9 backs off so the plate still fits)
    const fit = Math.max(1, (16 / 9 / cam.aspect) ** 0.8)
    place(cam, cu, cv, h * fit, ROLL - 0.012 * s.k(1, 0.5, 11, E.io2) + 0.006 * Math.sin(s.time * 0.19))
    cam.fov = 30
    cam.near = 0.1
    cam.far = 60
    // ---- beat 4: the sheet wets through, and the lens goes down through it into the sea and comes back
    const T = s.beat === 3 ? s.at(3) : -1
    seaT = T
    st.seaOn = T > 0.02 && T < T_DRY + 0.25
    st.under = false
    st.dive = 0
    st.splash = 0
    uSea.value.set(0, 0, 0, 0)
    if (st.seaOn) {
      uSeaT.value = T
      uSea.value.set((SOAK_R + 1.3) * clamp(T / T_SOAK) ** 0.85, 1.5 * E.io2(clamp((T - 13.5) / (T_DRY - 13.5))), 1, smooth(1.5, 2.75, T) * (1 - smooth(13.0, 14.0, T)))
      // the desk's pose as it is now is the first and the last key
      const dp = cam.position, hh = h * fit
      for (let e = 0; e < 2; e++) {
        const o = (e ? NK - 1 : 0) * 9
        KV[o] = dp.x; KV[o + 1] = dp.y; KV[o + 2] = dp.z
        KV[o + 3] = cu; KV[o + 4] = 0; KV[o + 5] = -cv
        KV[o + 6] = hh; KV[o + 7] = 0.002; KV[o + 8] = 30
      }
      camAt(T)
      // while an animal is featured the lens looks at it and focuses on it, wherever its route has taken it
      for (let i = 0; i < TRACK.length; i++) {
        const tk = TRACK[i], hr = heroOf[tk.key]
        const w = smooth(tk.t0, tk.t0 + tk.ramp, T) * (1 - smooth(tk.t1 - tk.ramp, tk.t1, T))
        if (w <= 0) continue
        heroDrive(hr, HD)
        kv[3] = mix(kv[3], hr.pos[0], w)
        kv[4] = mix(kv[4], hr.pos[1] + tk.up, w)
        kv[5] = mix(kv[5], hr.pos[2], w)
        kv[6] = mix(kv[6], Math.hypot(kv[0] - hr.pos[0], kv[1] - hr.pos[1], kv[2] - hr.pos[2]), w)
      }
      const inSea = smooth(2.3, 3.6, T) * (1 - smooth(12.2, 13.6, T))
      st.dive = inSea
      // hand-held, in proportion to how close the lens is working
      const hx = 0.03 * inSea
      cam.position.set(kv[0] + hx * (Math.sin(s.time * 0.53) + 0.5 * Math.sin(s.time * 1.13 + 1)), kv[1] + hx * 0.6 * Math.sin(s.time * 0.47 + 2), kv[2] + hx * Math.sin(s.time * 0.41 + 4))
      // (never let the lens lie in the surface itself: it is above it or below it)
      if (Math.abs(cam.position.y) < 0.012) cam.position.y = T < 8 ? -0.012 : 0.012
      cam.up.set(0, 1, 0)
      cam.lookAt(kv[3] + hx * 0.7 * Math.sin(s.time * 0.37 + 5), kv[4] + hx * 0.4 * Math.sin(s.time * 0.61), kv[5])
      cam.rotateZ((ROLL + 0.006 * Math.sin(s.time * 0.19)) * (1 - inSea) + 0.02 * inSea * Math.sin(s.time * 0.29))
      cam.fov = kv[8] * (cam.aspect < 16 / 9 ? fit : 1)
      cam.near = mix(0.1, 0.03, inSea)
      cam.far = mix(60, 130, inSea)
      cam.updateMatrixWorld()
      cam.updateProjectionMatrix()
      st.under = cam.position.y < 0
      uLens.value.set(Math.max(0.15, kv[6]), kv[7], 0, 0)
      uPxK.value = (2 * Math.tan((cam.fov * Math.PI) / 360)) / s.h
      // breaking the surface, both ways
      const tin = T - T_IN, tout = T - T_OUT
      uBurst.value.set(tin, tout, -0.3, 0.3)
      st.splash = Math.exp(-Math.abs(tin) * (tin < 0 ? 9 : 2.6)) + Math.exp(-Math.abs(tout) * (tout > 0 ? 9 : 2.6))
      uSurf.value.set(1, Math.exp(-Math.abs(tin) * 7) + Math.exp(-Math.abs(tout) * 7))
      // the cast
      scatter = smooth(10.7, 11.15, T) * (1 - smooth(11.8, 12.9, T))
      for (let i = 0; i < heroes.length; i++) {
        const hr = heroes[i]
        hr.uInk.value = Math.max(1 - smooth(hr.wet + 0.2, hr.wet + 1.0, T), smooth(T_HOME - 0.55, T_HOME + 0.2, T))
        hr.herd.update(cam, fills[i])
        // (after the update, the drive's last word may be another animal's: ask again for the hero itself)
        const sk = heroDrive(hr, HD)
        if (i < NBLOB) {
          const up = Math.max(0, hr.pos[1] - floorY(hr.pos[0], hr.pos[2]))
          const sz = mix(hr.sP, hr.sS, sk) * ZOO[hr.key].len
          blobV[i].set(hr.pos[0] - (SUN.x / SUN.y) * up, hr.pos[2] - (SUN.z / SUN.y) * up, sz * (0.5 + 0.05 * up), (0.62 / (1 + 0.3 * up)) * sk)
        }
      }
      uTrack.value = hTri.s0 + hTri.L * trap(T, hTri.t0, hTri.t1, 1.0)
      for (const b of beds) b.herd.update(cam, b.fill)
      // the sun, on the frame
      v1.copy(cam.position).addScaledVector(SUN, 60).project(cam)
      SA.uSunUV.value.set(v1.x * 0.5 + 0.5, v1.y * 0.5 + 0.5, 1)
      // labels
      for (let i = 0; i < heroes.length; i++) {
        const hr = heroes[i], lb = labs[i]
        lb.a = smooth(hr.lab[0], hr.lab[0] + 0.35, T) * (1 - smooth(hr.lab[1] - 0.35, hr.lab[1], T))
        if (lb.a <= 0) continue
        const lp = hr.lead ?? hr.pos
        v1.set(lp[0], lp[1] + hr.top, lp[2]).project(cam)
        // (a label lets go of an animal that swims out of the frame; it does not snap off)
        lb.a *= v1.z > 1 ? 0 : 1 - smooth(0.78, 0.96, Math.max(Math.abs(v1.x), Math.abs(v1.y)))
        if (lb.a <= 0) continue
        lb.ax = (v1.x * 0.5 + 0.5) * DW
        lb.ay = (0.5 - v1.y * 0.5) * DH
        lb.w = Math.max(hr.name.length * LAB_NAME * 0.47, LAB_SRC_TEXT.length * LAB_SRC * 0.62) + 36
        lb.h = LAB_NAME + LAB_SRC + 40
        lb.left = hr.lab[2] < 0
        lb.x = clamp(lb.ax + hr.lab[2] - (lb.left ? lb.w : 0), 70, DW - 70 - lb.w)
        lb.y = clamp(lb.ay + hr.lab[3] - (hr.lab[3] < 0 ? lb.h : 0), 330, DH - 240 - lb.h)
      }
    } else for (const lb of labs) lb.a = 0

    // ---- what is under the headline: sheet or desk
    v0.set(-1.0, 0, -HH).project(cam)
    const edgeY = (0.5 - v0.y * 0.5) * DH
    v0.set(-HW, 0, -0.6).project(cam)
    const edgeX = (v0.x * 0.5 + 0.5) * DW
    st.band = Math.max(smooth(120, 250, edgeY) + (1 - smooth(120, 250, edgeY)) * smooth(60, 200, edgeX), smooth(1.2, 2.4, T) * (1 - smooth(14.2, 15.4, T)))
    // (the headline of a beat arrives after the frame has moved, so the old one leaves in the old colour)
    const col = INKS[Math.round(clamp(st.band) * 12)]
    TITLES.color = col
    HUD.color = col
    HUD.shadow = st.band > 0.5 ? "rgba(0,0,0,0.5)" : undefined
    // (while the pen in the hand can pass under the type, dark ink on paper keeps a paper-coloured halo)
    TITLES.shadow = st.dive > 0.3 ? "rgba(4,18,8,0.55)" : penW.visible && st.band < 0.5 ? "rgba(240,230,205,0.95)" : undefined

    // ---- the selection box, around the small one's place on the plate
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (let i = 0; i < 4; i++) {
      walkAt(0, (i & 1 ? 0.17 : -0.11) * WS, (i & 2 ? 0.1 : -0.1) * WS, wp)
      v1.set(wp[0], 0, -wp[1]).project(cam)
      const px = (v1.x * 0.5 + 0.5) * DW, py = (0.5 - v1.y * 0.5) * DH
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
    }
    st.sel[0] = x0; st.sel[1] = y0; st.sel[2] = x1 - x0; st.sel[3] = y1 - y0
    for (let i = 0; i < 4; i++) {
      v1.copy(sheetQuad[i]).project(cam)
      port.c[i][0] = v1.x
      port.c[i][1] = v1.y
    }

    // ---- focus: shallow while the lens is close, gone by the time the page is in frame
    st.dof = 0.02 * (1 - smooth(1.0, 2.6, h))
    v1.set(s.beat === 0 ? mix(F0[0], P_DICK[0], s.k(0, 1.9, 8, E.io3)) : cu, 0, -(s.beat === 0 ? mix(F0[1], P_DICK[1], s.k(0, 1.9, 8, E.io3)) : cv)).project(cam)
    st.fy = clamp(v1.y * 0.5 + 0.5, 0.2, 0.8)
    // is the loupe in the picture? (its second view of the page is skipped when it is not)
    v1.set(lx, LOUPE_Y, lz).project(cam)
    st.loupeOn = Math.abs(v1.x) < 1.35 && Math.abs(v1.y) < 1.5 && !st.under
    st.knock = knock

    // ---- sound: the bed follows d(ink)/dt
    const b = s.beat
    const r = inkRate(b, s.t)
    st.ink = r
    if (s.live) {
      ctx.synth.bed("air", clamp(0.25 + r * 0.5) * (t0 < 0 ? s.enter : 1) * (1 - st.dive))
      if (st.seaOn) ctx.synth.bed("water", clamp(0.25 * smooth(0.2, 2, T) * (1 - smooth(14, T_DRY, T)) + 0.75 * st.dive))
    }
  }

  const drawInk = (c: THREE.Camera, target: THREE.RenderTarget, px: number) => {
    const r = ctx.renderer
    uPx.value = px
    r.setClearColor(0x000000, 0)
    r.setRenderTarget(target)
    r.render(inkScene, c)
  }

  return {
    cues,
    update,
    warm: () => [
      { pass: bakePass, target: bakeRT },
      { scene: inkScene, camera: cam, target: inkRT },
      { scene: inkScene, camera: loupeCam, target: inkLoupe },
      { scene, camera: loupeCam, target: loupeRT },
      { scene, camera: cam, target: stage },
      { pass: air, target: out },
      { scene: seaScene, camera: cam, target: seaRT },
      { pass: seaLens, target: out },
    ],
    render(s) {
      const r = ctx.renderer
      const P = cam.projectionMatrix.elements
      if (!baked) {
        bakePass.render(bakeRT)
        baked = true
      }
      if (st.loupeOn) {
        // the page under the glass, drawn again from straight above at the glass's own scale
        loupeCam.position.set(uLoupe.value.x, 3, uLoupe.value.z)
        loupeCam.lookAt(uLoupe.value.x, 0, uLoupe.value.z)
        loupeCam.updateMatrixWorld()
        drawInk(loupeCam, inkLoupe, ((2 * LOUPE_R) / LOUPE_M / inkLoupe.width))
        tInk.value = inkLoupe.texture
        uRes.value.set(loupeRT.width, loupeRT.height)
        uInLoupe.value = 1
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(loupeRT)
        r.render(scene, loupeCam)
      }
      if (st.seaOn) {
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(seaRT)
        r.render(seaScene, cam)
        tSea.value = seaRT.texture
        if (st.under) {
          // below the surface the sea is the whole picture
          SA.tS.value = seaRT.texture
          SA.uAsp.value = s.w / s.h
          SA.uSplash.value = st.splash
          SA.uShaft.value = st.dive
          seaLens.render(out)
          POSTSEA.exposure = 0.98 + 0.5 * st.splash
          POSTSEA.bloom = 0.32 + 0.4 * st.splash
          ctx.finish(out.texture, POSTSEA)
          return
        }
      }
      drawInk(cam, inkRT, 2 / (P[5] * s.h))
      tInk.value = inkRT.texture
      uRes.value.set(s.w, s.h)
      uInLoupe.value = 0
      lens.visible = st.loupeOn
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      A.tA.value = stage.texture
      A.uDof.value = st.dof
      A.uFy.value = st.fy
      A.uAsp.value = s.w / s.h
      air.render(out)
      POST.bloom = 0.16 + 0.1 * clamp(st.ink * 0.2) + 0.3 * st.knock + 0.4 * st.splash
      POST.exposure = 0.92 + 0.2 * st.knock + 0.5 * st.splash
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      titles(g, s, ctx.def, TITLES)
      // the deck's selection frame picks out one small animal; it does not stay in it
      const a = s.k(2, 2.6, 2.75, E.out3) * (1 - s.k(2, 6.2, 6.9, E.io2))
      if (s.beat === 2 && a > 0) {
        const pad = 12 + 2.5 * Math.sin(s.time * 2.2) + 46 * (1 - s.k(2, 2.6, 2.95, E.outBack))
        g.selbox(st.sel[0] - pad, st.sel[1] - pad, st.sel[2] + pad * 2, st.sel[3] + pad * 2, a)
      }
      // beat 4: each animal named as the lens finds it: a hairline from the animal to its name
      for (let i = 0; i < labs.length; i++) {
        const lb = labs[i]
        if (lb.a <= 0.01) continue
        if (ctx.debugLabels) {
          g.rect(lb.x, lb.y, lb.w, lb.h, { fill: "#ff00ff" })
          continue
        }
        const ex = lb.left ? lb.x + lb.w : lb.x, ey = lb.y + LAB_NAME + 14
        g.rect(lb.x - 6, lb.y - 4, lb.w + 12, lb.h + 8, { fill: "rgba(5,20,10,0.4)", r: 10, alpha: lb.a })
        g.line(lb.ax, lb.ay, ex, ey, { color: "#fff3d6", lw: 1.6, alpha: lb.a * 0.9 })
        g.line(lb.x + 14, ey, lb.x + lb.w - 14, ey, { color: "#fff3d6", lw: 1.6, alpha: lb.a * 0.9 })
        g.rect(lb.ax - 3.5, lb.ay - 3.5, 7, 7, { fill: "#fff3d6", r: 3.5, alpha: lb.a })
        g.text(heroes[i].name, lb.x + 18, lb.y + LAB_NAME, { size: LAB_NAME, font: "fell", italic: true, color: "#fff6dc", alpha: lb.a, p: clamp(lb.a * 1.4), style: "fade", by: "glyph", shadow: { color: "rgba(0,14,6,0.8)", blur: 8 } })
        g.text(LAB_SRC_TEXT, lb.x + 18, lb.y + LAB_NAME + 18 + LAB_SRC, { size: LAB_SRC, font: "mono", color: "#e9ecc4", alpha: lb.a * 0.95, shadow: { color: "rgba(0,14,6,0.8)", blur: 6 } })
      }
    },
    hud: () => HUD,
    labels: () => {
      labelOut.length = 0
      for (let i = 0; i < labs.length; i++) {
        const lb = labs[i]
        if (lb.a < 0.5) continue
        const o = labelPool[i], x0 = (lb.x / DW) * 2 - 1, x1 = ((lb.x + lb.w) / DW) * 2 - 1, y0 = 1 - (lb.y / DH) * 2, y1 = 1 - ((lb.y + lb.h) / DH) * 2
        o.corners[0][0] = x0; o.corners[0][1] = y0; o.corners[1][0] = x1; o.corners[1][1] = y0
        o.corners[2][0] = x1; o.corners[2][1] = y1; o.corners[3][0] = x0; o.corners[3][1] = y1
        labelOut.push(o)
      }
      return labelOut
    },
    portal: (s) => (s.beat >= 2 ? port : null), // the sheet's own quad, for the page turn
    dispose() {
      disposeTree(scene)
      disposeTree(inkScene)
      for (const h of heroes) h.herd.dispose()
      for (const b of beds) b.herd.dispose()
      disposeTree(seaScene)
      atlas.dispose()
    },
  }
}
