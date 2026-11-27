// Scene 9, strata: "Microbes start making oxygen."
//
// Idea. We read two billion years off a cliff, bottom to top, and then the lens freezes.
//
// Story parameter. `height`: the crane's place in the column (`craneY(beat, t)`, metres of staging).
// Then `frost` (a clock the ice grows on) and `thaw` (cracks, melt, one wipe). Every event is a time
// on a beat clock: a bed lands at (beat, tau), a tag is pinned at (beat, tau), a crack starts at a
// second of beat 4. Nothing is accumulated and nothing depends on the camera.
//
// World rule. `bedAt(y)`: one table of beds, each with a colour, a thickness, a relief (how far it
// stands out of the face) and texture weights. It is baked into three 1-D lookup textures, its GPU
// twin, and read by everything: the slabs take their size and ledge from it and their surface from
// the lookup at each pixel's own height, a talus block is shaded as the bed it fell from, the tags
// hang at heights read from it, the notebook's drawn column is the same table. One sun (`lit`): a
// low warm key from the left, blue-grey sky fill, ledge shadows marched along the sun's ray through
// the relief profile, and the props' shadows as capsules projected onto the face.
//
// The column (the colours are a drawing, as the speaker says):
//   0 to 4.6     green-grey shale and grey siltstone; a laminated carbonate with domes (stromatolite
//                laminae are convex upward); brassy detrital pyrite, which only survives without oxygen
//   4.6 to 8.8   banded iron formation: silver-black iron oxide and red chert, centimetre mesobands
//                that resolve first and millimetre microbands that appear only when the lens is near
//   8.8 to 13.2  the onset, then red, grey, red, grey, red: oxygen rose and fell
//   13.2 to 18.6 red beds: cross-bedded sandstone (foresets tangential at the base, truncated at the
//                top), ripple marks on the bedding planes; no pyrite from here up
//   18.6 to 21.8 pale diamictite, poorly sorted, with dropstones: laminae pressed down beneath each
//                stone, squeezed up at its edges, draped over it
//   21.8 to top  a pale laminated carbonate sitting sharply on the glacial bed
// Nothing grows anywhere: no lichen, no soil.
//
// Nothing holds still. Through every hold the crane creeps in on the dated bed (`HOLDS`) and the operator
// breathes; the sun (`uSun`) climbs, drops for the cold and returns, so the shadow under each ledge
// lengthens and slides; cloud shadows cross the face. Small events, each a time on a beat clock or a loop
// on the ambient one: dust trickling off the ledges, stones worked out once as chains of parabolas
// (`STONE_EV`), seeps running down from bedding planes (`SEEPS`), the plaques lifting on their pins, icicles.
// "Then the air changes" is seen: the beds above the 2,460 plaque are laid grey and rust on camera
// (`OX_T`, the lookup `pcT`), from the bedding planes and joints inward behind an ochre front, wavering
// through the interval where oxygen rose and fell. Every beat clock used this way has finished by the end
// of its beat, so the next beat starts from exactly the frame the last one ended on.
//
// The pane. The frost is a field of arrival times baked once into a texture: nuclei on a jittered
// grid start from the edges inward, each grows six arms at one speed, side branches leave the arms
// at sixty degrees and tertiaries leave those, and everything thickens sideways slowly, so
// "what is ice at time t" is one comparison per pixel. The same texture carries the crack network
// (distance to the nearest crack and the moment the crack reached that point).

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraProjectionMatrix, cameraProjectionMatrixInverse, cameraViewMatrix, cameraWorldMatrix, clamp as clampN, cos, cross, dFdx, dFdy, dot, exp, float, floor, Fn, fract, fwidth, If, length, Loop, max, min, mix as mixN, mod, normalGeometry, normalize, positionGeometry, pow, select, sign, sin, smoothstep, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvGeometry, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, LABEL_MIN, labelFloor, labelReport, screenPx, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { hash11, hash21, hash22, L0, rot, sampleRT, sat, smoothstepRev, vnoise, voronoi, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, PostOpts, SceneInstance, State } from "../engine/types"
import { SELECT } from "../engine/ui"

// ---------------------------------------------------------------- the column
type RGB = [number, number, number]
export type Bed = {
  y0: number; y1: number
  /** sRGB, as painted. */
  col: RGB
  /** Metres the bed stands out of the face. */
  relief: number
  lam: number; iron: number; cross: number; clast: number; strom: number; pyr: number
  /** Laid down grey and iron-bearing, and oxidised on camera: 0 no, 1 ends red, 2 ends grey (the oxygen fell again). */
  ox?: number
  seed: number
  /** Pitch of its thud, as a harmonic of D1. */
  tone: number
}
const TOP = 23.2
const Y = { siltTop: 4.6, bifTop: 8.8, onsetTop: 9.6, flickerTop: 13.2, redTop: 18.6, iceTop: 21.8 }

const BEDS: Bed[] = (() => {
  const R = rng(909)
  const out: Bed[] = []
  let y = 0
  const j = (c: RGB, a = 0.035): RGB => [clamp(c[0] + (R() - 0.5) * a), clamp(c[1] + (R() - 0.5) * a), clamp(c[2] + (R() - 0.5) * a)]
  const push = (th: number, col: RGB, o: Partial<Bed>) => {
    out.push({ y0: y, y1: y + th, col: j(col), relief: 0.2, lam: 0.5, iron: 0, cross: 0, clast: 0, strom: 0, pyr: 0, tone: 3, seed: R(), ...o })
    y += th
  }
  const fill = (to: number, lo: number, hi: number, f: (i: number, th: number) => void) => {
    let i = 0
    while (y < to - 1e-3) {
      let th = Math.min(to - y, lo + R() * (hi - lo))
      if (to - y - th < lo * 0.7) th = to - y
      f(i++, th)
    }
  }
  const SHALE: RGB = [0.31, 0.35, 0.31], SLATE: RGB = [0.23, 0.25, 0.27], SILT: RGB = [0.43, 0.43, 0.39]
  fill(0.9, 0.12, 0.34, (i, th) => push(th, i % 2 ? SLATE : SHALE, { relief: 0.14 + 0.12 * R(), lam: 0.7, pyr: 1, tone: 4 }))
  push(0.7, [0.48, 0.46, 0.38], { relief: 0.3, lam: 1, strom: 1, pyr: 0.4, tone: 5 })
  fill(1.85, 0.08, 0.24, (i, th) => push(th, i % 2 ? SHALE : SLATE, { relief: 0.2 + 0.1 * R(), lam: 0.7, pyr: 1, tone: 4 }))
  push(2.2 - y, [0.41, 0.42, 0.38], { relief: 0.56, lam: 0.5, pyr: 0.8, tone: 3 }) // the ledge the hammer lies on
  fill(Y.siltTop, 0.06, 0.24, (i, th) => push(th, i % 3 === 1 ? SLATE : i % 3 ? SHALE : SILT, { relief: i === 0 ? 0.06 : i % 3 === 0 ? 0.24 + 0.1 * R() : 0.08 + 0.08 * R(), lam: 0.8, pyr: 1, tone: 4 + (i % 3) }))
  fill(Y.bifTop, 0.14, 0.52, (i, th) => push(th, i % 2 ? [0.21, 0.185, 0.2] : [0.3, 0.15, 0.13], { relief: 0.3 + 0.24 * R(), lam: 0.25, iron: 1, tone: 2 }))
  push(Y.onsetTop - y, [0.4, 0.27, 0.22], { relief: 0.2, lam: 0.6, iron: 0.45, tone: 3 })
  const RED: RGB = [0.5, 0.2, 0.14], GREY: RGB = [0.39, 0.4, 0.39]
  for (const [th, red] of [[0.62, 1], [0.5, 0], [0.66, 1], [0.42, 0], [0.74, 1], [0.3, 0], [0.36, 1]] as const) push(th, red ? RED : GREY, { relief: red ? 0.3 + 0.08 * R() : 0.1, lam: 0.55, cross: red ? 0.45 : 0, tone: red ? 6 : 4 })
  const REDS: RGB[] = [[0.5, 0.21, 0.15], [0.55, 0.26, 0.17], [0.44, 0.18, 0.15], [0.52, 0.3, 0.22], [0.47, 0.24, 0.21]]
  fill(Y.redTop, 0.22, 0.9, (i, th) => push(th, REDS[i % REDS.length], { relief: 0.12 + 0.3 * R(), lam: 0.35, cross: i % 4 === 3 ? 0.15 : 1, tone: 5 + (i % 2) }))
  const ICE: RGB[] = [[0.55, 0.58, 0.61], [0.63, 0.63, 0.61], [0.5, 0.54, 0.58]]
  fill(Y.iceTop, 0.55, 1.0, (i, th) => push(th, ICE[i % 3], i % 2 ? { relief: 0.14, lam: 1, clast: 0.12, tone: 8 } : { relief: 0.24 + 0.1 * R(), lam: 0.1, clast: 1, tone: 7 }))
  fill(TOP, 0.2, 0.4, (i, th) => push(th, i % 2 ? [0.78, 0.68, 0.58] : [0.71, 0.6, 0.51], { relief: 0.42 - 0.07 * i, lam: 0.9, tone: 9 }))
  for (const b of out) if (b.y0 >= Y.flickerTop - 1e-3 && b.y1 <= Y.redTop + 1e-3) b.ox = 1
  // The middle of the column, 4.6 to 13.2 m, is laid out by hand with a generator of its own (so the beds
  // above and below keep the places they had): beds of plainly different thickness, the massive ones proud
  // and the thin shaly partings weathered back into shadow.
  const Q = rng(2460)
  const mid: Bed[] = []
  let ym = Y.siltTop
  const put = (th: number, col: RGB, o: Partial<Bed>) => {
    const c: RGB = [clamp(col[0] + (Q() - 0.5) * 0.04), clamp(col[1] + (Q() - 0.5) * 0.03), clamp(col[2] + (Q() - 0.5) * 0.03)]
    mid.push({ y0: ym, y1: ym + th, col: c, relief: 0.2, lam: 0.5, iron: 0, cross: 0, clast: 0, strom: 0, pyr: 0, tone: 3, seed: Q(), ...o })
    ym += th
  }
  // banded iron formation: thick jasper-and-hematite beds standing proud, thin recessed partings between them
  const JASPER: RGB = [0.34, 0.13, 0.11], STEEL: RGB = [0.2, 0.185, 0.2], PARTING: RGB = [0.15, 0.14, 0.15]
  const BIF: [number, number, number][] = [[0.34, 0.34, 0], [0.07, 0.07, 2], [0.72, 0.56, 1], [0.1, 0.1, 2], [0.22, 0.3, 0], [0.52, 0.5, 0], [0.06, 0.05, 2], [0.14, 0.2, 1], [0.86, 0.58, 1], [0.09, 0.08, 2], [0.28, 0.4, 0], [0.12, 0.12, 2], [0.44, 0.52, 1]]
  const bifSum = BIF.reduce((a, b) => a + b[0], 0)
  BIF.forEach(([th, relief, kind], i) => put(i === BIF.length - 1 ? Y.bifTop - ym : (th * (Y.bifTop - Y.siltTop)) / bifSum, kind === 2 ? PARTING : kind ? JASPER : STEEL, { relief, lam: kind === 2 ? 0.9 : 0.25, iron: kind === 2 ? 0.35 : 1, tone: 2 }))
  put(Y.onsetTop - ym, [0.4, 0.27, 0.22], { relief: 0.2, lam: 0.6, iron: 0.45, tone: 3, ox: 1 })
  // red, grey, red, grey, red: the reds are massive sandstones of different hue, the greys thin and set back
  const FLICK: [number, number, RGB | null][] = [[0.86, 0.5, [0.5, 0.2, 0.14]], [0.3, 0.08, null], [0.52, 0.34, [0.56, 0.27, 0.16]], [0.24, 0.06, null], [0.98, 0.56, [0.43, 0.165, 0.13]], [0.22, 0.1, null], [0.48, 0.4, [0.52, 0.23, 0.18]]]
  FLICK.forEach(([th, relief, col], i) => put(i === FLICK.length - 1 ? Y.flickerTop - ym : th, col ?? GREY, { relief, lam: col ? 0.45 : 0.8, cross: col ? 0.45 : 0, tone: col ? 6 : 4, ox: col ? 1 : 2 }))
  const lo = out.findIndex((b) => b.y0 >= Y.siltTop - 1e-3), hi = out.findIndex((b) => b.y0 >= Y.flickerTop - 1e-3)
  out.splice(lo, hi - lo, ...mid)
  return out
})()

/** The world rule: the bed at height y (metres above the foot). */
export function bedAt(y: number): Bed {
  let lo = 0, hi = BEDS.length - 1
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (BEDS[m].y1 <= y) lo = m + 1
    else hi = m
  }
  return BEDS[lo]
}

// ---------------------------------------------------------------- the crane
const FOV = 34
const TANH = Math.tan((FOV * Math.PI) / 360)
const kk = (t: number, a: number, b: number, e: (x: number) => number = E.io3) => e(clamp((t - a) / (b - a)))
/** Where the lens is in the column. Each rise ends dead on a dated bed. */
function craneY(b: number, t: number) {
  if (b <= 0) return mix(1.7, 3.6, kk(t, 0.8, 4.8))
  if (b === 1) return 3.6 + 5.5 * kk(t, 0.3, 3.4) + 3.3 * kk(t, 4.2, 6.4)
  if (b === 2) return 12.4 + 7.3 * kk(t, 0.2, 3.4)
  return 19.7 + 2.0 * kk(t, 0.5, 2.6)
}
/** How far the lens stands off the face. */
function craneD(b: number, t: number) {
  if (b <= 0) return mix(9.6, 8.2, kk(t, 0.5, 10, E.out2))
  if (b === 1) return mix(8.2, 6.6, kk(t, 0.3, 3.4)) - 3.4 * Math.sin(Math.PI * kk(t, 0.4, 3.1, E.io2)) ** 2 + 0.9 * kk(t, 4.2, 6.4) - 0.4 * kk(t, 6.4, 11.5, E.out2)
  if (b === 2) return mix(mix(7.1, 11.5, kk(t, 0.2, 1.8)), 8.2, kk(t, 1.7, 3.6)) - 0.5 * kk(t, 3.6, 11, E.out2)
  return mix(7.7, 7.0, kk(t, 0.5, 2.6)) + 0.35 * kk(t, 2.6, 9.5, E.out2)
}
const STOPS: [number, number][] = [[0, 4.8], [1, 3.4], [1, 6.4], [2, 3.4], [3, 2.6]]
/**
 * The holds: [beat, from, to, beat of the next move (-1: none), its from, its to, the tag the lens creeps in on, weight].
 * Each is a ramp that finishes exactly as its beat does, so nothing jumps when the next beat's clock starts.
 */
const HOLDS: [number, number, number, number, number, number, number, number][] = [
  [0, 4.8, 10, 1, 0.3, 2.2, 0, 1.6],
  [1, 3.4, 4.2, 1, 4.2, 5.4, 1, 0.25],
  [1, 6.4, 11.5, 2, 0.2, 1.6, 3, 1],
  [2, 3.4, 11, 3, 0.5, 2.0, 4, 1.25],
  [3, 2.6, 9.5, -1, 0, 0, 5, 1.5],
]
const FALL = 0.5 // seconds a bed takes to be laid
const WAVE = 0.3 // seconds a bed takes to land from left to right
const X0 = -3.5 // the wave's reference x (lands at tau there)

/** When each bed lands: (beat, seconds into it). Beds the first frame shows were always there. */
const BED_T = BEDS.map((bed) => {
  for (let b = 0; b < 4; b++)
    for (let t = 0; t <= 9; t += 1 / 60)
      if (craneY(b, t) + 0.42 * craneD(b, t) * TANH >= bed.y0) return b === 0 && t === 0 ? { b: 0, tau: -100 } : { b, tau: t - FALL }
  return { b: 3, tau: 2.6 }
})

/**
 * When the rust reaches each bed, in seconds of "Then the air changes": the bed between the two dates first,
 * as its tags go in, then bed by bed up the face, never before a bed has been laid. Beds laid later arrive red.
 */
const OX_T = BEDS.map((bed, i) => {
  if (!bed.ox) return 0
  const T = BED_T[i]
  if (bed.y0 < Y.onsetTop - 1e-3) return 3.0
  if (T.b > 1) return 0
  return Math.min(9.2, Math.max(T.b === 1 ? T.tau + FALL + 0.6 : 0, 5.3 + (bed.y0 - Y.onsetTop) * 0.5))
})

// ---------------------------------------------------------------- tags, pinned as the crane stops
const TAGS = [
  { a: "before 2,460", u: "million years ago", x: 3.3, y: 4.0, b: 0, tau: 4.5 },
  { a: "2,460", u: "million years ago", x: 1.75, y: Y.bifTop, b: 1, tau: 2.9 },
  { a: "2,426", u: "million years ago", x: 3.7, y: Y.onsetTop + 0.05, b: 1, tau: 3.3 },
  { a: "perhaps until 2.2", u: "billion years ago", x: 3.2, y: 13.12, b: 1, tau: 6.3 },
  { a: "about 720", u: "million years ago", x: 3.3, y: Y.redTop + 0.95, b: 2, tau: 3.3 },
  { a: "635", u: "million years ago", x: 3.4, y: Y.iceTop + 0.1, b: 3, tau: 2.5 },
]
const TAG_W = 1.27
const TAG_H = 0.6
// how tall the print is, as fractions of the tag: the numeral's capitals and the unit's
const TAG_NUM = 0.25
const TAG_UNIT = 0.135

// ---------------------------------------------------------------- small events on the face
/** Stones that come away and fall: [beat, seconds in, x, the height they leave from]. Clear of the plaques, and from beds already laid. */
const STONE_EV: [number, number, number, number][] = [[0, 1.5, -0.6, 1.9], [0, 5.7, -1.3, 4.6], [0, 7.4, 0.3, 4.9], [0, 9.0, -2.6, 4.2], [1, 3.7, -0.9, 9.4], [1, 7.5, -1.7, 13.1], [1, 9.7, 0.4, 13.0], [2, 6.1, -1.1, 20.5], [2, 9.1, 0.5, 20.3], [3, 3.7, -1.6, 23.0], [3, 6.3, 0.1, 23.1], [3, 8.1, -2.4, 22.9]]
const NST = STONE_EV.length
const SEG = 10 // flights a stone may make between bounces
/** Seeps: [x, the bedding plane the water comes out of, beat, seconds in, how far it runs, width]. */
const SEEPS: [number, number, number, number, number, number][] = [[-1.0, 5.45, 0, 5.2, 2.6, 0.15], [5.4, 9.9, 1, 3.5, 2.4, 0.09], [-0.5, 13.2, 1, 6.8, 2.8, 0.12], [-1.5, 20.6, 2, 3.6, 2.6, 0.12], [0.3, 22.95, 3, 2.2, 3.0, 0.1]]
const NSEEP = SEEPS.length
const SEEP_V = 0.55 // metres a second: quick for a seep, slow enough to watch

// ---------------------------------------------------------------- the pane
const FROST0 = 2.4 // beat 3: seconds in at which the first ice shows
const FROST_RATE = 0.9
const BREATH = [1.2, 3.7, 6.7, 9.3]
const CRACK0 = 0.15 // beat 4
const MELT0 = 1.3
const WIPE: [number, number] = [3.3, 4.5]
const NSEG = 72
const ICE_ASP = 16 / 9
/** The crack network: polylines racing out of one point, each segment with the times its ends are reached. */
const CRACKS = (() => {
  const R = rng(635)
  const seg: { a: [number, number]; b: [number, number]; ta: number; tb: number }[] = []
  const reports: { t: number; x: number }[] = []
  const O: [number, number] = [0.22, -0.08]
  const SPEED = 2.6
  const grow = (x: number, y: number, ang: number, t: number, n: number, depth: number) => {
    for (let i = 0; i < n && seg.length < NSEG; i++) {
      const len = 0.05 + 0.07 * R()
      ang += (R() - 0.5) * 0.7
      const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len
      seg.push({ a: [x, y], b: [nx, ny], ta: t, tb: t + len / SPEED })
      t += len / SPEED
      x = nx
      y = ny
      if (depth < 2 && R() < 0.3 && seg.length < NSEG - 6) grow(x, y, ang + (R() < 0.5 ? 1 : -1) * (0.6 + 0.5 * R()), t + 0.02, 3 + Math.floor(R() * 4), depth + 1)
      if (Math.abs(x) > 1.0 || Math.abs(y) > 0.6) break
    }
  }
  const starts = [0, 0.34, 0.62, 0.95, 1.22]
  starts.forEach((t0, i) => {
    const ang = 0.5 + i * 1.31 + (R() - 0.5) * 0.4
    reports.push({ t: t0, x: clamp(O[0] + Math.cos(ang) * 0.5, -1, 1) })
    grow(O[0], O[1], ang, t0, 12, 0)
  })
  while (seg.length < NSEG) seg.push({ a: [9, 9], b: [9, 9], ta: 99, tb: 99 })
  return { seg, reports }
})()

export function create(ctx: Ctx): SceneInstance {
  const stage = stageTarget(ctx)
  const soft = ctx.target({ scale: 0.25 })
  const half = ctx.target({ scale: 0.5 }) // the pane: frost, refraction, fog and beads, at half resolution
  const out = ctx.target({})
  const ice = ctx.target({ hdr: true, fixed: [1600, 900] })
  const world = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 400)
  const R = rng(2426)
  const texes: THREE.Texture[] = []

  // ---------------------------------------------------------------- bedAt, on the GPU
  const LUTN = 4096
  const colD = new Uint8Array(LUTN * 4), paD = new Uint8Array(LUTN * 4), pbD = new Uint8Array(LUTN * 4), pcD = new Uint8Array(LUTN * 4)
  for (let i = 0; i < LUTN; i++) {
    const b = bedAt(((i + 0.5) / LUTN) * TOP)
    // oxidation: when (seconds into "Then the air changes") the rust reaches this bed, whether it ends red, whether it takes part, how much it wavers
    pcD.set([(OX_T[BEDS.indexOf(b)] / 16) * 255, b.ox === 1 ? 255 : 0, b.ox ? 255 : 0, (b.y0 < Y.onsetTop ? 0.5 : b.y0 < Y.flickerTop ? 1 : 0.6) * 255], i * 4)
    colD.set([b.col[0] * 255, b.col[1] * 255, b.col[2] * 255, 255], i * 4)
    paD.set([(b.relief / 0.6) * 255, b.lam * 255, b.iron * 255, b.cross * 255], i * 4)
    pbD.set([b.clast * 255, b.strom * 255, b.pyr * 255, b.seed * 255], i * 4)
  }
  const lutTex = (d: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(d, LUTN, 1, THREE.RGBAFormat)
    t.magFilter = t.minFilter = THREE.LinearFilter
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.needsUpdate = true
    texes.push(t)
    return t
  }
  const colT = lutTex(colD, true), paT = lutTex(paD, false), pbT = lutTex(pbD, false), pcT = lutTex(pcD, false)
  const lut = (t: THREE.Texture, y: F): V4 => texture(t).sample(vec2(clampN(y.div(TOP), 0.0005, 0.9995), 0.5)).level(L0) as V4
  // Value noise from a texture: the lattice is baked once (256 squared, repeating), and a lookup with
  // the smoothstep done by hand is one fetch where the hashed version is four hashes.
  const noiseT = (() => {
    const r = rng(4242)
    const d = new Uint16Array(256 * 256 * 4)
    for (let i = 0; i < d.length; i++) d[i] = THREE.DataUtils.toHalfFloat(r())
    const t = new THREE.DataTexture(d, 256, 256, THREE.RGBAFormat, THREE.HalfFloatType)
    t.magFilter = t.minFilter = THREE.LinearFilter
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.needsUpdate = true
    texes.push(t)
    return t
  })()
  const tn = (p: THREE.Node): F => {
    const q = vec2(p as V2).toVar()
    const f = fract(q).toVar()
    return texture(noiseT).sample(floor(q).add(f.mul(f).mul(f.mul(-2).add(3))).add(0.5).div(256)).level(L0).x as F
  }

  // ---------------------------------------------------------------- uniforms
  const SUNJ = new THREE.Vector3(-0.78, 0.38, 0.5).normalize()
  const U = {
    uAt: uniform(new THREE.Vector4()), // seconds into each beat
    uTime: uniform(0),
    uCam: uniform(new THREE.Vector3()),
    uTopY: uniform(6), // the column is built up to here
    uCold: uniform(0),
    uSnow: uniform(0),
    uKick: uniform(0), // the lock of the hand-off: dust off every ledge
    uSun: uniform(SUNJ.clone()), // the sun moves through every beat: ledge shadows lengthen and slide
    uIce: uniform(0), // icicles: how far the cold has got
  }
  const stP = Array.from({ length: NST }, () => new THREE.Vector4(0, -50, 0, 0)) // where each stone is, and its size (0: not yet loose)
  const stR = Array.from({ length: NST }, () => new THREE.Vector4()) // its tumble angle, a seed, the height it came from
  const uStP = uniformArray(stP, "vec4"), uStR = uniformArray(stR, "vec4")
  const seepA = SEEPS.map((q, i) => new THREE.Vector4(q[0], q[1], q[5], 0.37 + i * 0.61))
  const seepB = SEEPS.map(() => new THREE.Vector4())
  const uSeepA = uniformArray(seepA, "vec4"), uSeepB = uniformArray(seepB, "vec4")
  const NCAP = 8
  const capA = Array.from({ length: NCAP }, () => new THREE.Vector4(0, -50, 0, 0.01)) // xyz, radius
  const capB = Array.from({ length: NCAP }, () => new THREE.Vector4(0, -50, 0, 0)) // xyz, strength
  const uCapA = uniformArray(capA, "vec4"), uCapB = uniformArray(capB, "vec4")
  const NDS = 6
  const dropstones = (() => {
    const lamBeds = BEDS.filter((b) => b.y0 >= Y.redTop && b.clast > 0 && b.clast < 0.5)
    return Array.from({ length: NDS }, (_, i) => {
      const b = lamBeds[i % lamBeds.length]
      const ry = 0.05 + 0.06 * R()
      return new THREE.Vector4(-1.4 + i * 1.32 + R() * 0.5, mix(b.y0 + ry * 2.2, b.y1 - ry * 2.6, R()), ry * (1.1 + 0.7 * R()), ry)
    })
  })()
  const uDS = uniformArray(dropstones, "vec4")

  const SUN = U.uSun as unknown as V3
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const sq = (x: F): F => x.mul(x) as F
  const mat = (vertex: THREE.Node | null, fragment: THREE.Node, o: THREE.MaterialParameters = {}) => {
    const m = new THREE.NodeMaterial()
    if (vertex) m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    m.setValues(o)
    return m
  }
  const atOf = (b: F): F => select(b.lessThan(0.5), U.uAt.x, select(b.lessThan(1.5), U.uAt.y, select(b.lessThan(2.5), U.uAt.z, U.uAt.w))) as F

  // ---------------------------------------------------------------- the world rule: one sun
  const sunCol = mixN(vec3(4.6, 3.35, 2.05), vec3(1.25, 1.35, 1.55), U.uCold)
  const skyFill = (N: V3) => mixN(vec3(0.1, 0.14, 0.23), vec3(0.24, 0.32, 0.5), N.y.mul(0.5).add(0.5)).mul(U.uCold.mul(1.5).add(1)).add(vec3(0.24, 0.15, 0.09).mul(sat(N.y.negate() as F)).mul(U.uCold.oneMinus()))
  /** Shadow of the ledges above a point of the face: a short march toward the sun through the relief profile. */
  const ledgeShadow = (P: V3): F => {
    const occ = float(0).toVar()
    for (const s of [0.05, 0.1, 0.18, 0.3, 0.48, 0.8]) {
      const q = P.add(SUN.mul(s)).toVar()
      const r = lut(paT, q.y as F).x.mul(0.6).mul(step(q.y, U.uTopY))
      occ.assign(max(occ, smoothstep(0, 0.02 + s * 0.09, r.sub(q.z))))
    }
    return occ.oneMinus() as F
  }
  /** Shadows of the props: each a capsule, slid along the sun's ray onto the plane the point is in. */
  const propShadow = (P: V3): F => {
    const sh = float(1).toVar()
    Loop(NCAP, ({ i }) => {
      const a = (uCapA.element(i) as unknown as V4).toVar()
      const b = (uCapB.element(i) as unknown as V4).toVar()
      If(b.w.greaterThan(0.001), () => {
        const a2 = a.xy.sub(SUN.xy.mul(a.z.sub(P.z).div(SUN.z))).toVar()
        const b2 = b.xy.sub(SUN.xy.mul(b.z.sub(P.z).div(SUN.z))).toVar()
        const ab = b2.sub(a2).toVar()
        const h = clampN(dot(P.xy.sub(a2), ab).div(max(dot(ab, ab), 1e-6)), 0, 1)
        const d = length(P.xy.sub(a2).sub(ab.mul(h)))
        const gap = max(mixN(a.z, b.z, h).sub(P.z), 0)
        const pen = a.w.mul(0.5).add(gap.mul(0.16))
        sh.mulAssign(smoothstep(a.w.sub(pen), a.w.add(pen), d).oneMinus().mul(b.w).mul(exp(gap.mul(-1.6))).oneMinus())
      })
    })
    return sh as F
  }
  const lit = (alb: V3, N: V3, P: V3, sh: F, ao: F, gloss: F): V3 => {
    const V = normalize(U.uCam.sub(P)).toVar()
    const ndl = sat(dot(N, SUN) as F)
    const hv = normalize(SUN.add(V))
    const spec = pow(sat(dot(N, hv) as F), 38).mul(gloss).mul(sh).mul(ndl)
    // cloud shadows crossing the face: broad, soft-edged, fainter under the overcast of the cold
    const cloud = mixN(mixN(0.5, 0.8, U.uCold), 1, smoothstep(0.36, 0.62, tn(vec2(P.x.mul(0.085).sub(U.uTime.mul(0.17)).add(P.y.mul(0.03)), P.y.mul(0.06).add(U.uTime.mul(0.021)).add(5))))).toVar()
    const c = alb.mul(sunCol.mul(ndl).mul(sh).mul(cloud).add(skyFill(N).mul(ao))).add(sunCol.mul(spec).mul(0.5).mul(cloud))
    // a little air between the lens and the far end of the face
    const d = length(U.uCam.sub(P))
    const haze = mixN(vec3(0.62, 0.6, 0.6), vec3(0.74, 0.8, 0.88), U.uCold)
    return mixN(c, haze, exp(d.mul(-0.024)).oneMinus().mul(0.8)) as V3
  }
  const bump = (Rp: V3, N: V3, h: F, k: number): V3 => {
    const dpdx = dFdx(Rp).toVar(), dpdy = dFdy(Rp).toVar()
    const r1 = cross(dpdy, N).toVar(), r2 = cross(N, dpdx).toVar()
    const det = dot(dpdx, r1).toVar()
    const g = r1.mul(dFdx(h)).add(r2.mul(dFdy(h))).mul(sign(det))
    return normalize(N.mul(abs(det)).sub(g.mul(k))) as V3
  }
  /**
   * The surface of the bed at a point of rock. `Rp` is the point where it lies in the column (a
   * fallen block passes the place it came from), `top` is 1 on a bedding plane seen from above.
   * Returns albedo, a height for the bump, gloss, and a glint.
   */
  const rock = (Rp: V3, top: F, slabSeed: F, en: F) => {
    const y = Rp.y
    const xs = Rp.x.add(Rp.z.mul(0.8)).toVar()
    const pa = lut(paT, y as F).toVar(), pb = lut(pbT, y as F).toVar()
    const lam = pa.y, iron = pa.z, crossW = pa.w, clastW = pb.x, strom = pb.y, pyr = pb.z, seed = pb.w
    // pixel-aware: a pattern of `f` cycles a metre shows only while a cycle is wider than a few pixels
    const fy = max(max(fwidth(y), fwidth(xs).mul(0.35)), 1e-5).toVar()
    const show = (f: number): F => smoothstepRev(0.5, 0.14, fy.mul(f) as F)
    const side = top.oneMinus()
    const ys = float(y).toVar()
    // stromatolite laminae: convex upward
    const hump = sq(fract(xs.div(0.62).add(seed.mul(5))).mul(2).sub(1) as F).oneMinus()
    ys.subAssign(strom.mul(0.11).mul(hump))
    // dropstones: the laminae are pressed down beneath, squeezed up at the edges, draped above
    const stone = float(0).toVar(), dome = float(0).toVar()
    If(clastW.greaterThan(0.02).and(clastW.lessThan(0.6)), () => {
      Loop(NDS, ({ i }) => {
        const d = (uDS.element(i) as unknown as V4).toVar()
        const dx = xs.sub(d.x).toVar(), dy = y.sub(d.y).toVar()
        If(abs(dx).lessThan(d.z.mul(7)).and(abs(dy).lessThan(d.w.mul(7))), () => {
          const below = exp(sq(dx.div(d.z) as F).negate()).mul(-0.85).add(exp(sq(abs(dx).sub(d.z.mul(1.4)).div(d.z.mul(0.4)) as F).negate()).mul(0.36)).mul(d.w).mul(exp(abs(dy.add(d.w)).div(d.w.mul(-1.4))))
          const above = exp(sq(dx.div(d.z.mul(1.8)) as F).negate()).mul(1.15).mul(d.w).mul(exp(abs(dy.sub(d.w)).div(d.w.mul(-1.5))))
          ys.subAssign(mixN(below, above, smoothstep(d.w.negate(), d.w, dy)))
          const el = length(vec2(dx.div(d.z), dy.div(d.w))).toVar()
          stone.assign(max(stone, smoothstepRev(1, 0.9, el)))
          dome.assign(max(dome, el.mul(el).oneMinus().mul(d.w)))
        })
      })
    })
    const c = lut(colT, y as F).rgb.toVar()
    const h = float(0).toVar()
    // The air changes. These beds were laid grey, their iron ferrous; oxygen gets in along the bedding planes
    // and the joints and the red works inward from them (`en`: 0 on a plane or joint, 1 in the heart of the
    // bed), behind an ochre front. Through the interval where oxygen rose and fell the front advances and
    // falls back, and the thin beds between the reds end grey, rust left only along their cracks.
    const rusty = float(0).toVar()
    If(en.greaterThan(-0.5), () => {
      const pc = lut(pcT, y as F).toVar()
      If(pc.z.greaterThan(0.5), () => {
        const tb = U.uAt.y
        const age = tb.sub(pc.x.mul(16)).toVar()
        const isRed = step(0.5, pc.y).toVar()
        const env = smoothstepRev(11.2, 9.2, tb).mul(pc.w)
        const osc = sin(tb.mul(1.75).sub(y.mul(1.15))).mul(0.5).add(0.5).mul(env)
        const grown = float(1).sub(exp(max(age, 0).div(-1.2))).mul(step(0, age))
        const L = mixN(mixN(osc.mul(0.62).add(0.07), osc.mul(-0.58).add(1), isRed).mul(grown), mixN(0.07, 1, isRed), smoothstep(10.4, 11.4, tb)).toVar()
        const mr = en.mul(0.7).add(tn(vec2(xs.mul(1.3).add(seed.mul(9)), y.mul(4.1))).mul(0.45)).add(tn(vec2(xs.mul(9), y.mul(17))).mul(0.1))
        const d = L.mul(1.5).sub(mr).toVar()
        const rust = smoothstep(-0.03, 0.05, d).toVar()
        const lum = dot(c, vec3(0.3, 0.5, 0.2)).toVar()
        const greyC = mixN(c, vec3(0.84, 0.95, 0.84).mul(lum.mul(1.3).add(0.035)), isRed)
        const redC = mixN(mixN(c, vec3(0.2, 0.042, 0.022), 0.82), c, isRed)
        c.assign(mixN(greyC, redC, rust))
        const front = smoothstepRev(0.13, 0.0, abs(d.sub(0.03)) as F).mul(smoothstepRev(11.4, 10.2, tb)).mul(step(0, age))
        c.assign(mixN(c, vec3(0.36, 0.17, 0.035), front.mul(0.75)))
        rusty.assign(rust.mul(isRed))
        // bleached mottles in the reds: patches the iron was reduced out of again
        c.assign(mixN(c, vec3(0.3, 0.3, 0.26).mul(lum.mul(2).add(0.3)), smoothstep(0.66, 0.82, tn(vec2(xs.mul(0.8).add(seed.mul(13)), y.mul(2.7)))).mul(rusty).mul(0.42).mul(top.oneMinus())))
      })
    })
    // lamination
    const lamv = tn(vec2(ys.mul(70), seed.mul(31).add(1))).sub(0.5).mul(show(70)).add(tn(vec2(ys.mul(330), seed.mul(17).add(7))).sub(0.5).mul(0.7).mul(show(330))).mul(side).toVar()
    c.mulAssign(lam.mul(lamv).mul(1.5).add(1))
    h.addAssign(lam.mul(lamv).mul(0.012))
    // banded iron: centimetre mesobands first, millimetre microbands when the lens is near
    const gloss = float(0.04).toVar()
    const flash = float(0).toVar()
    If(iron.greaterThan(0.01), () => {
      const w = clampN(fy.mul(46), 0.05, 0.5)
      // the bands are folded: an open fold the length of the outcrop, and tight crinkles (kinks with sharp
      // hinges) in the zones that took the strain
      const kz = smoothstep(0.42, 0.7, tn(vec2(xs.mul(0.45).add(seed.mul(3)), y.mul(2.3))))
      const kink = abs(fract(xs.mul(2.9).add(tn(vec2(y.mul(4.5), seed.mul(7))).mul(1.4))).mul(2).sub(1)).sub(0.5).mul(0.05).mul(kz).mul(show(6))
      ys.addAssign(sin(xs.mul(0.9).add(seed.mul(20))).mul(0.045).add(tn(vec2(xs.mul(0.6), seed.mul(5))).sub(0.5).mul(0.16)).add(kink).mul(iron))
      // macrobands a hand thick, chert-rich or iron-rich, set how thick the mesobands inside them are
      const macro = tn(vec2(ys.mul(6.5), seed.mul(3).add(2))).toVar()
      const meso = smoothstep(w.negate().add(0.5), w.add(0.5), tn(vec2(ys.mul(46), seed.mul(11))).add(macro.sub(0.5).mul(0.55).mul(show(6.5)))).toVar()
      const micro = smoothstep(0.35, 0.65, tn(vec2(ys.mul(230), 3.3)))
      const m = mixN(meso, mixN(meso, micro, 0.6), show(230)).toVar()
      // red jasper, here and there a tawny chert, against steel-grey hematite and magnetite
      const jasper = mixN(vec3(0.36, 0.05, 0.03), vec3(0.4, 0.2, 0.05), smoothstep(0.62, 0.8, tn(vec2(ys.mul(17), seed.mul(29)))).mul(0.8))
      // (the oxide weathers to a pale blue-grey in outcrop, not to black: Dales Gorge, Soudan)
      const steel = mixN(vec3(0.04, 0.043, 0.056), vec3(0.135, 0.15, 0.185), tn(vec2(ys.mul(29), seed.mul(41))))
      const band = mixN(jasper, steel, m)
      c.assign(mixN(c, mixN(c.mul(0.8), band, show(46).mul(0.5).add(0.5)), iron.mul(0.92).mul(side.mul(0.7).add(0.3))))
      // hairline quartz veins cutting across the banding
      const vein = smoothstepRev(0.014, 0.004, abs(tn(vec2(xs.mul(1.1).add(y.mul(2.6)), seed.mul(7).add(y.mul(0.3)))).sub(0.5)) as F).mul(show(40)).mul(iron).mul(side)
      c.assign(mixN(c, vec3(0.5, 0.47, 0.44), vein.mul(0.4).mul(smoothstep(0.5, 0.7, tn(vec2(xs.mul(0.7).add(3), y.mul(1.9)))))))
      gloss.addAssign(iron.mul(m).mul(tn(Rp.xy.mul(23)).mul(0.22).add(0.06)))
      // the chert is the harder: it stands a little proud of the oxide, band by band
      h.addAssign(iron.mul(float(0.5).sub(m)).mul(0.009).mul(side).add(macro.sub(0.5).mul(0.016).mul(iron).mul(side)))
      // specular hematite: plates that flash as the sun and the lens move
      const fl = tn(Rp.xy.mul(190).add(Rp.z.mul(70))).toVar()
      flash.assign(step(0.84, fl).mul(m).mul(iron).mul(show(190)).mul(pow(sin(fl.mul(140).add(dot(U.uCam, vec3(2.3, 1.9, 1.1)).mul(4)).add(U.uSun.y.mul(60))).mul(0.5).add(0.5), 6)))
    })
    // cross-bedding: foresets tangential to the base of each set and truncated at its top
    If(crossW.greaterThan(0.01), () => {
      const SET = 0.46
      const sv = ys.div(SET).add(seed.mul(3.7)).toVar()
      const si = floor(sv).toVar()
      const v = fract(sv)
      const dir = select(hash11(si.mul(7.3).add(seed.mul(91))).greaterThan(0.2), 1, -1)
      const ph = xs.mul(dir).sub(sqrt(v).mul(SET * 3.4))
      const cl = tn(vec2(ph.mul(34), si.mul(5.1))).sub(0.5).mul(show(34)).mul(side)
      const base = smoothstepRev(0.06, 0, v).mul(show(8))
      c.mulAssign(crossW.mul(cl).mul(0.6).add(1).mul(crossW.mul(base).mul(0.22).oneMinus()))
      h.addAssign(crossW.mul(cl).mul(0.006))
    })
    // a bedding plane seen from above: ripple marks, sharp at the crest and round in the trough
    If(top.greaterThan(0.5), () => {
      const f = fract(Rp.x.div(0.075).add(tn(vec2(Rp.z.mul(4), seed.mul(9))).mul(0.8)))
      const p = abs(f.mul(2).sub(1)).oneMinus()
      h.addAssign(p.mul(p).mul(0.006).mul(crossW.mul(0.8).add(0.2)).mul(smoothstepRev(0.5, 0.15, fwidth(Rp.x).div(0.075) as F)))
      c.mulAssign(1.12)
    })
    // diamictite: clasts of every size in mud
    If(clastW.greaterThan(0.01), () => {
      const big = clastW.mul(side)
      for (const [f, amt] of [[4.5, 1], [17, 0.8]] as const) {
        const vo = voronoi(vec2(xs, y).mul(f).add(seed.mul(13))).toVar()
        const hc = hash21(vo.yz.add(3.1)).toVar()
        const rad = hc.mul(hc).mul(0.4).add(0.07)
        const aa = clampN(fy.mul(f * 1.5), 0.02, 0.3)
        const inC = smoothstep(rad.sub(aa), rad, vo.x).oneMinus().mul(step(0.42, hash21(vo.yz.add(9.7)))).mul(show(f * 1.2)).mul(big).toVar()
        const k = hash21(vo.yz.add(21.3)).toVar()
        const cc = select(k.lessThan(0.3), vec3(0.42, 0.25, 0.21), select(k.lessThan(0.55), vec3(0.07, 0.075, 0.085), select(k.lessThan(0.8), vec3(0.6, 0.58, 0.54), vec3(0.4, 0.33, 0.22))))
        c.assign(mixN(c, cc, inC.mul(amt)))
        h.addAssign(inC.mul(sq(vo.x.div(rad) as F).oneMinus()).mul(0.035 / f))
      }
    })
    If(stone.greaterThan(0.001), () => {
      const sp = tn(Rp.xy.mul(140))
      c.assign(mixN(c, mixN(vec3(0.34, 0.2, 0.17), vec3(0.62, 0.56, 0.5), sp), stone))
      h.addAssign(dome.mul(0.7))
    })
    // detrital pyrite: brassy grains, only in the beds laid down without oxygen
    const glint = float(0).toVar()
    If(pyr.greaterThan(0.01), () => {
      const vp = voronoi(vec2(xs, y).mul(95).add(5)).toVar()
      const hp = hash21(vp.yz).toVar()
      const pt = step(0.9, hp).mul(smoothstepRev(0.24, 0.1, vp.x)).mul(pyr).mul(show(95))
      const tw = pow(sin(hp.mul(40).add(dot(U.uCam, vec3(2.1, 1.7, 1.3)).mul(2.6))).mul(0.5).add(0.5), 8)
      glint.assign(pt.mul(tw.mul(7).add(0.25)))
      c.assign(mixN(c, vec3(0.5, 0.38, 0.13), pt.mul(0.8)))
    })
    // spalls: flakes that have come off the face, at two sizes; the skin that is left is duller
    const sp = smoothstep(0.5, 0.72, tn(vec2(xs.mul(0.55).add(seed.mul(40)), y.mul(5.5).add(seed.mul(17)))).add(tn(vec2(xs.mul(2.1), y.mul(13))).mul(0.3)).sub(0.15)).mul(side).toVar()
    h.subAssign(sp.mul(0.022))
    c.assign(mixN(mixN(c, vec3(dot(c, vec3(0.33))).mul(0.92), 0.3), c.mul(1.08), sp))
    // varnish running down from under each ledge, dust lying on top of it, and a slow drift of hue along the face
    const under = smoothstep(0.03, 0.3, lut(paT, y.add(0.2) as F).x.sub(pa.x))
    c.mulAssign(under.mul(tn(vec2(xs.mul(5), y.mul(0.4))).mul(0.5).add(0.25)).mul(side).oneMinus())
    c.assign(mixN(c, vec3(0.36, 0.32, 0.27), top.mul(0.25)))
    c.mulAssign(mixN(vec3(1.07, 1, 0.9), vec3(0.93, 1, 1.08), tn(vec2(xs.mul(0.16), y.mul(0.4).add(3)))))
    // weather: dark streaks running down from the ledges, bleached patches, grain
    const streak = tn(vec2(xs.mul(2.3), y.mul(0.22).add(9)))
    c.mulAssign(smoothstep(0.5, 0.85, streak).mul(0.4).mul(side).oneMinus())
    // desert varnish: narrow black drips hanging from the lip of each ledge, long under the proud ones
    const drip = smoothstep(0.6, 0.86, tn(vec2(xs.mul(7.5), y.mul(0.5).add(seed.mul(3))))).mul(smoothstep(0.02, 0.2, lut(paT, y.add(0.45) as F).x.sub(pa.x).add(under.mul(0.3)))).mul(show(7.5))
    c.mulAssign(drip.mul(0.5).mul(side).oneMinus())
    c.mulAssign(tn(vec2(xs.mul(0.35).add(2), y.mul(0.5))).mul(0.4).add(0.8))
    c.mulAssign(slabSeed.mul(0.22).add(0.89))
    const gr = tn(Rp.xy.add(Rp.z).mul(48)).sub(0.5).mul(show(48))
    h.addAssign(gr.mul(0.004).add(tn(Rp.xy.add(Rp.z).mul(7)).mul(0.012)))
    c.mulAssign(gr.mul(0.16).add(1))
    return { c, h: h as F, gloss: gloss as F, glint: glint as F, flash: flash as F }
  }
  /** Rime and blown snow: on what faces up, and creeping down the face. */
  const snowOn = (col: V3, N: V3, P: V3, sh: F): V3 => {
    const n = tn(P.xy.mul(3.1)).mul(0.6).add(tn(P.xy.mul(13)).mul(0.4))
    const k = sat(smoothstep(0.25, 0.8, N.y).add(smoothstep(U.uSnow.mul(-0.9).add(1.15), U.uSnow.mul(-0.9).add(1.45), n.add(N.z.mul(0.25)))).mul(U.uSnow) as F)
    const sn = vec3(0.86, 0.9, 0.96).mul(sunCol.mul(sat(dot(N, SUN) as F)).mul(sh).mul(0.5).add(skyFill(N).mul(1.6)))
    return mixN(col, sn, k.mul(0.94)) as V3
  }

  // ---------------------------------------------------------------- the slabs
  const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed()
  // A bed is one continuous sheet the length of the cliff: a strip finely divided along its length,
  // so its front can stand proud here and fall back there, with rounded shoulders.
  const strip = new THREE.BoxGeometry(1, 1, 1, 220, 4, 1).toNonIndexed()
  const slabGeo = new THREE.InstancedBufferGeometry()
  slabGeo.setAttribute("position", strip.getAttribute("position"))
  slabGeo.setAttribute("normal", strip.getAttribute("normal"))
  const ZBACK = -1.6
  const XC = 3, XW = 74
  {
    const aA: number[] = [], aB: number[] = []
    BEDS.forEach((bed, bi) => {
      const T = BED_T[bi]
      aA.push(bed.y0, bed.y1 - bed.y0, bed.relief, bed.seed)
      aB.push(T.b, T.tau, BEDS.length - 1 - bi < 3 ? 1 : 0, 0)
    })
    slabGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(new Float32Array(aA), 4))
    slabGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(new Float32Array(aB), 4))
    slabGeo.instanceCount = BEDS.length
  }
  /** Through-going joints: a function of x alone, so one fracture crosses many beds. In joint spacings. */
  const jointU = (x: F): F => x.add(vnoise(vec2(x.mul(0.13), 4.2)).mul(4)).div(6.5) as F
  const SL = (() => {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const lp = positionGeometry
    const x = lp.x.mul(XW).add(XC).toVar()
    const seed = aA.w
    // the bed is laid down as sediment: a front runs along the cliff, the bed thickens and then compacts
    const a = atOf(aB.x as F).sub(aB.y).sub(x.sub(X0).mul(WAVE / 14)).toVar()
    const fall = clampN(a.div(FALL), 0, 1).toVar()
    const v = max(a.sub(FALL), 0).toVar()
    const grow = fall.mul(exp(v.mul(-8)).mul(cos(v.mul(22))).mul(0.3).add(1))
    // near the props the face is kept plainer, so that what is pinned to it sits on it
    const mk = mixN(0.3, 1, smoothstep(3.0, 5.5, abs(x.sub(2))))
    const cell = floor(jointU(x as F))
    const zOff = hash21(vec2(cell, floor(seed.mul(97)))).sub(0.5).mul(0.11)
    const prof = vnoise(vec2(x.mul(0.45), seed.mul(61))).sub(0.5).mul(0.26).add(vnoise(vec2(x.mul(1.7), seed.mul(23))).sub(0.5).mul(0.09))
    // blocks that have fallen out leave a notch; the last beds are a broken skyline
    const gone = smoothstep(0.71, 0.74, vnoise(vec2(x.mul(0.3).add(seed.mul(40)), seed.mul(7)))).toVar()
    // the weathering profile of a bed: its top edge rounded off, and from the middle of the column up its foot
    // undercut, deeper the prouder it stands, so every massive bed overhangs the parting beneath it
    const mid = step(4.5, aA.x)
    const sn = vnoise(vec2(x.mul(0.8), seed.mul(13))).toVar()
    const shoulder = smoothstep(0.1, 1, lp.y.mul(2)).mul(sn.mul(0.07).add(0.04)).add(smoothstep(0.1, 1, lp.y.mul(-2)).mul(mixN(sn.mul(0.07).add(0.04), aA.z.mul(sn.mul(0.3).add(0.22)), mid)))
    // blocks spalled out between cross-joints: a square-cut recess the depth of a hand to a forearm
    const blk = floor(jointU(x as F).mul(3.4).add(seed.mul(13)))
    const hb = hash21(vec2(blk, floor(seed.mul(131)))).toVar()
    const spall = step(0.74, hb).mul(step(0.2, aA.y)).mul(mid).mul(aA.z.mul(hb.sub(0.74).mul(1.6).add(0.22)))
    // what stands out is kept small near the props (their pins clear it); what falls back cannot hide them
    const outw = zOff.add(prof)
    const zf = aA.z.add(max(outw, 0).mul(mk)).add(min(outw, 0).mul(mixN(mk, 1, mid))).sub(gone.mul(0.3).add(shoulder).mul(mixN(mk, 1, mid))).sub(spall)
    const sky = aB.z.mul(smoothstep(0.55, 0.6, vnoise(vec2(x.mul(0.21).add(seed.mul(9)), 1.5))))
    const hgt = aA.y.mul(sky.oneMinus())
    const z = mixN(float(ZBACK), zf, lp.z.add(0.5).mul(step(0, a)))
    const rest = vec3(x, aA.x.add(lp.y.add(0.5).mul(hgt)), z).toVar()
    const kick = U.uKick.mul(sin(aA.x.mul(9).add(seed.mul(20)))).mul(0.012)
    const P = vec3(x, aA.x.add(lp.y.add(0.5).mul(hgt).mul(grow)).add(kick), z)
    return {
      clip: viewProj.mul(vec4(P, 1)),
      vR: rest.toVarying("slR"),
      vP: P.toVarying("slP"),
      vN: normalGeometry.toVarying("slN"),
      vE: vec2(lp.y.add(0.5).mul(aA.y), lp.y.oneMinus().sub(0.5).mul(aA.y)).toVarying("slE"),
      vS: vec2(seed, exp(v.mul(-5)).mul(step(FALL, a))).toVarying("slS"),
    }
  })()
  const slabFrag = Fn(() => {
    const Nf = normalize(SL.vN).toVar()
    const Rp = SL.vR
    const top = step(0.5, Nf.y).toVar()
    const front = step(0.5, Nf.z).toVar()
    // the face is not flat: light it by the surface that is really there
    const Ng = normalize(cross(dFdx(SL.vP), dFdy(SL.vP))).toVar()
    const N0 = Ng.mul(sign(dot(Ng, Nf).add(1e-4))).toVar()
    // the bedding planes above and below: the shoulder is rounded off and the parting behind it dark
    const e = max(min(SL.vE.x, SL.vE.y).add(tn(Rp.xy.mul(8)).sub(0.5).mul(0.05)), 0).toVar()
    // joints: fractures that run through several beds at once
    const u = jointU(Rp.x.add(sin(Rp.y.mul(1.7)).mul(0.07)).add(tn(Rp.yy.mul(3)).mul(0.05)) as F).toVar()
    const bid = floor(u.add(0.5)).toVar()
    const dj = abs(u.sub(bid)).mul(6.5).toVar()
    const run = step(0.3, hash21(vec2(bid, floor(Rp.y.div(3.7).add(hash11(bid).mul(3)))))).toVar()
    const crack = smoothstepRev(0.045, 0.008, dj as F).mul(run).mul(front).toVar()
    // how deep in the bed this point is, from the nearest bedding plane or joint: what the rust has to cross
    const en = min(min(SL.vE.x, SL.vE.y).div(max(SL.vE.x.add(SL.vE.y).mul(0.5), 0.02)), mixN(1, dj.div(0.55), run)).clamp(0, 1)
    const rk = rock(Rp as V3, top as F, float(0.5), en as F)
    const hgt = rk.h.sub(exp(e.div(-0.03)).mul(0.012).mul(front)).sub(crack.mul(0.03)).toVar()
    const N = bump(Rp as V3, N0 as V3, hgt as F, 1.25).toVar()
    // (ledges are taken at their nominal relief, so a bed is not shaded by its own average front)
    // a seep: water out of a bedding plane, darkening a streak that lengthens and widens down the face, catching
    // the light where it runs; in the cold it sets to ice
    const wet = float(0).toVar()
    Loop(NSEEP, ({ i }) => {
      const A = (uSeepA.element(i) as unknown as V4).toVar()
      const run = (uSeepB.element(i) as unknown as V4).x.toVar()
      If(run.greaterThan(0.001).and(abs(Rp.x.sub(A.x)).lessThan(0.7)), () => {
        const dy = A.y.sub(Rp.y).toVar()
        const mx = A.x.add(tn(vec2(Rp.y.mul(1.3), A.w.mul(9))).sub(0.5).mul(0.34)).add(tn(vec2(Rp.y.mul(9), A.w)).sub(0.5).mul(0.05))
        const wd = A.z.mul(dy.mul(0.55).add(1)).mul(tn(vec2(Rp.y.mul(3.1), A.w.mul(5))).mul(0.7).add(0.65))
        wet.assign(max(wet, smoothstepRev(1, 0.3, abs(Rp.x.sub(mx)).div(wd) as F).mul(step(0, dy)).mul(smoothstepRev(0, -0.22, dy.sub(run) as F))))
      })
    })
    const iced = wet.mul(U.uCold).toVar()
    rk.c.assign(mixN(rk.c.mul(wet.mul(0.62).oneMinus()), vec3(0.6, 0.7, 0.8), iced.mul(0.6)))
    const nominal = lut(paT, Rp.y as F).x.mul(0.6).toVar()
    const sh = ledgeShadow(vec3(Rp.xy, nominal) as V3).mul(propShadow(Rp as V3)).toVar()
    // a recess (a spalled block, an undercut) sees less sky the deeper it is
    const ao = mixN(0.6, 1, smoothstep(0, 0.1, e)).mul(crack.mul(0.75).oneMinus()).mul(sat(nominal.sub(Rp.z).sub(0.05).mul(2.2) as F).mul(front).mul(0.55).oneMinus())
    const col = lit(rk.c, N as V3, SL.vP as V3, sh as F, ao as F, rk.gloss.add(wet.mul(1.1)).add(iced.mul(1.4)) as F).toVar()
    col.addAssign(sunCol.mul(0.07).mul(smoothstep(0.6, 0.95, tn(vec2(Rp.x.mul(26), Rp.y.mul(2.2).add(U.uTime.mul(1.5))))).mul(wet).mul(sh).mul(U.uCold.oneMinus())))
    col.addAssign(vec3(1, 0.82, 0.4).mul(rk.glint).add(vec3(0.8, 0.85, 1).mul(rk.flash)).mul(sh).mul(sat(dot(N0, SUN).mul(2) as F)).mul(U.uCold.oneMinus()))
    // dust on the bed that has just been laid
    col.assign(mixN(col, vec3(0.75, 0.68, 0.6).mul(sunCol).mul(0.25), SL.vS.y.mul(0.2)))
    return vec4(snowOn(col as V3, N as V3, Rp as V3, sh as F), 1)
  })()
  const slabs = new THREE.Mesh(slabGeo, mat(SL.clip, slabFrag))
  slabs.frustumCulled = false
  world.add(slabs)

  // ---------------------------------------------------------------- talus: blocks that fell from the beds above
  const talusGeo = new THREE.InstancedBufferGeometry()
  talusGeo.setAttribute("position", cube.getAttribute("position"))
  talusGeo.setAttribute("normal", cube.getAttribute("normal"))
  const slope = (x: number, z: number) => 1.25 * Math.exp(-Math.max(z, 0) / 1.5) * (0.55 + 0.45 * Math.sin(x * 0.7 + 1) * Math.sin(x * 0.23) + 0.3)
  {
    const N = 760
    const aP = new Float32Array(N * 4), aQ = new Float32Array(N * 4), aD = new Float32Array(N * 4)
    const q = new THREE.Quaternion(), eu = new THREE.Euler()
    for (let i = 0; i < N; i++) {
      const z = 0.25 + R() * R() * 4.6
      const x = -12 + R() * 26
      // bigger blocks roll further
      const s = (0.04 + 0.2 * R() * R()) * (0.7 + 0.25 * z)
      aP.set([x, slope(x, z) * (0.75 + 0.3 * R()) + s * 0.2, z, s], i * 4)
      eu.set((R() - 0.5) * 0.9, R() * 6.28, (R() - 0.5) * 0.9)
      q.setFromEuler(eu)
      aQ.set([q.x, q.y, q.z, q.w], i * 4)
      // where it came from: anywhere in the column above (talus is a sample of the whole cliff)
      const src = bedAt(0.3 + R() * (TOP - 0.6))
      aD.set([0.8 + R() * 1.4, Math.min(src.y1 - src.y0, (0.2 + R() * 0.45) * s), (src.y0 + src.y1) / 2, R()], i * 4)
    }
    talusGeo.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4))
    talusGeo.setAttribute("aQ", new THREE.InstancedBufferAttribute(aQ, 4))
    talusGeo.setAttribute("aD", new THREE.InstancedBufferAttribute(aD, 4))
    talusGeo.instanceCount = N
  }
  const TL = (() => {
    const aP = attribute("aP", "vec4"), aQ = attribute("aQ", "vec4"), aD = attribute("aD", "vec4")
    const turn = (v: V3): V3 => v.add(cross(aQ.xyz, cross(aQ.xyz, v).add(v.mul(aQ.w))).mul(2)) as V3
    const dims = vec3(aD.x, aD.y.div(aP.w).min(0.7), aD.w.mul(0.6).add(0.6)).mul(aP.w)
    const loc = positionGeometry.mul(dims)
    const P = aP.xyz.add(turn(loc as V3))
    return { clip: viewProj.mul(vec4(P, 1)), vP: P.toVarying("tlP"), vN: turn(normalGeometry as V3).toVarying("tlN"), vR: vec3(aP.x.mul(3.7).add(loc.x), aD.z.add(loc.y.mul(0.9)), loc.z).toVarying("tlR"), vS: aD.w.toVarying("tlS") }
  })()
  const talus = new THREE.Mesh(
    talusGeo,
    mat(
      TL.clip,
      Fn(() => {
        const N0 = normalize(TL.vN).toVar()
        const rk = rock(TL.vR as V3, float(0), TL.vS as F, float(-1))
        const N = bump(TL.vP as V3, N0 as V3, rk.h, 1.2).toVar()
        const ao = smoothstep(0, 0.9, TL.vP.y).mul(0.55).add(0.45)
        const col = lit(mixN(rk.c, vec3(0.15, 0.14, 0.125), 0.68) as V3, N as V3, TL.vP as V3, propShadow(TL.vP as V3), ao as F, rk.gloss)
        return vec4(snowOn(col, N as V3, TL.vP as V3, float(1)), 1)
      })(),
    ),
  )
  talus.frustumCulled = false
  world.add(talus)

  // the ground: scree and dust running out from the foot
  {
    const g = new THREE.PlaneGeometry(90, 50, 90, 50).rotateX(-Math.PI / 2).translate(2, 0, 24.6)
    const p = g.getAttribute("position")
    for (let i = 0; i < p.count; i++) p.setY(i, slope(p.getX(i), p.getZ(i)) * 0.8 - 0.05)
    g.computeVertexNormals()
    const vP = positionGeometry.toVarying("grP"), vN = normalGeometry.toVarying("grN")
    const ground = new THREE.Mesh(
      g,
      mat(
        viewProj.mul(vec4(positionGeometry, 1)),
        Fn(() => {
          const vo = voronoi(vP.xz.mul(24)).toVar()
          const k = hash21(vo.yz)
          const peb = smoothstepRev(0.42, 0.3, vo.x).mul(smoothstepRev(0.5, 0.15, fwidth(vP.x).mul(24) as F))
          // the scree is the cliff, broken: each pebble takes the colour of some bed
          const alb = mixN(vec3(0.12, 0.115, 0.105), lut(colT, k.mul(TOP) as F).rgb, peb.mul(0.3)).mul(vnoise(vP.xz.mul(1.3)).mul(0.4).add(0.8)).toVar()
          const N = bump(vP as V3, normalize(vN) as V3, peb.mul(0.006).add(vnoise(vP.xz.mul(30)).mul(0.004)) as F, 1.5)
          const ao = smoothstep(0, 1.4, vP.z).mul(0.5).add(0.5)
          const col = lit(alb as V3, N, vP as V3, propShadow(vP as V3), ao as F, float(0.03))
          return vec4(snowOn(col, N, vP as V3, float(1)), 1)
        })(),
      ),
    )
    ground.frustumCulled = false
    world.add(ground)
  }

  // the sky: pale and hazy behind the beds that have not been laid yet
  {
    const far = cameraProjectionMatrixInverse.mul(vec4(positionGeometry.xy.mul(2), 1, 1))
    const dir = cameraWorldMatrix.mul(vec4(far.xyz.div(far.w), 0)).xyz.toVarying("skD")
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      mat(
        vec4(positionGeometry.xy.mul(2), 1, 1),
        Fn(() => {
          const d = normalize(dir).toVar()
          const el = d.y
          const warm = mixN(vec3(0.9, 0.74, 0.58), vec3(0.2, 0.33, 0.56), smoothstep(-0.05, 0.42, el))
          const sunward = pow(sat(dot(d, SUN) as F), 6)
          const cl = vnoise(vec2(d.x.div(d.z.abs().add(0.4)).mul(1.4).add(U.uTime.mul(0.006)), el.mul(7))).mul(smoothstep(0.02, 0.5, el))
          const c = warm.add(vec3(0.7, 0.45, 0.2).mul(sunward)).mul(cl.mul(0.3).add(0.9))
          return vec4(mixN(c, vec3(0.62, 0.68, 0.78).mul(cl.mul(0.12).add(0.94)), U.uCold), 1)
        })(),
        { depthTest: false, depthWrite: false },
      ),
    )
    sky.frustumCulled = false
    sky.renderOrder = -10
    world.add(sky)
  }

  // ---------------------------------------------------------------- stones that come away and fall
  // Each is worked out once, here: a flight, a bounce off whatever ledge is proud enough to catch it (or the
  // talus), another flight. What is kept is where and how fast it left each bounce, so its place at any
  // second of its beat is one parabola, and scrubbing back throws it up again.
  const GRAV = 9.8
  const stSeg = new Float32Array(NST * SEG * 7)
  const stN = new Int32Array(NST), stEnd = new Float32Array(NST)
  const bounces: { b: number; at: number; p: THREE.Vector3; k: number }[] = []
  STONE_EV.forEach(([b, tau, x, ys], si) => {
    let bed = bedAt(ys)
    while (bed.relief < 0.25 && bed.y0 > 0.2) bed = bedAt(bed.y0 - 0.01)
    const r = 0.075 + 0.05 * R()
    stP[si].w = r
    stR[si].set(0, R(), (bed.y0 + bed.y1) / 2, 0)
    let px = x, py = bed.y1 + r, pz = bed.relief + 0.04, vx = (R() - 0.5) * 0.7, vy = 0.4, vz = 0.8 + 0.4 * R()
    let t0 = 0, n = 0, k = 0, end = 4
    const keep = () => stSeg.set([t0, px, py, pz, vx, vy, vz], (si * SEG + n++) * 7)
    keep()
    for (let t = 1 / 240; t < 4 && n < SEG; t += 1 / 240) {
      const u = t - t0, uq = u - 1 / 240
      const qx = px + vx * u, qy = py + vy * u - 0.5 * GRAV * u * u, qz = pz + vz * u
      const wy = vy - GRAV * u
      const gy = slope(qx, qz) * 0.8 - 0.05 + r
      let hit = 0
      if (qy < gy) hit = 1
      else if (qz - r * 0.5 < bedAt(qy - r).relief && wy < 0 && bedAt(py + vy * uq - 0.5 * GRAV * uq * uq - r).relief <= pz + vz * uq - r * 0.5) hit = 2
      if (!hit) continue
      const top = hit === 1 ? gy : bedAt(qy - r).y1 + r
      vx = vx * 0.55 + (R() - 0.5) * (hit === 1 ? 0.5 : 0.9)
      vy = Math.abs(wy) * (hit === 1 ? 0.42 : 0.36)
      vz = hit === 1 ? vz * 0.6 + 0.5 : Math.max(vz, 0) * 0.5 + 0.7 + 0.5 * R()
      px = qx
      py = top
      pz = qz
      t0 = t
      bounces.push({ b, at: tau + t, p: new THREE.Vector3(px, py, pz), k: k++ })
      if (vy < 0.7 || k >= 6) {
        end = t
        vx = vy = vz = 0
        keep()
        break
      }
      keep()
    }
    stN[si] = n
    stEnd[si] = end
  })
  {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", cube.getAttribute("position"))
    g.setAttribute("normal", cube.getAttribute("normal"))
    g.setAttribute("aI", new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: NST }, (_, i) => i)), 1))
    g.instanceCount = NST
    const idx = attribute("aI", "float").add(0.5).toInt()
    const A = (uStP.element(idx) as unknown as V4).toVar(), B = (uStR.element(idx) as unknown as V4).toVar()
    // a slabby block, tumbling about two axes
    const turn = (v: V3): V3 => {
      const a = rot(v.yz as V2, B.x as F)
      const b2 = rot(vec2(v.x, a.y) as V2, B.x.mul(0.6).add(B.y.mul(6)) as F)
      return vec3(b2.x, a.x, b2.y) as V3
    }
    const loc = positionGeometry.mul(vec3(1.5, 0.75, 1.1)).mul(A.w)
    const P = A.xyz.add(turn(loc as V3))
    const vP = P.toVarying("stP"), vN = turn(normalGeometry as V3).toVarying("stN"), vR = vec3(A.x.mul(2.1).add(loc.x), B.z.add(loc.y), loc.z).toVarying("stR"), vS = B.y.toVarying("stS")
    const stones = new THREE.Mesh(
      g,
      mat(
        viewProj.mul(vec4(P, 1)),
        Fn(() => {
          const N0 = normalize(vN).toVar()
          const rk = rock(vR as V3, float(0), vS as F, float(-1))
          // a fresh break: cleaner than the talus it will lie on
          return vec4(snowOn(lit(mixN(rk.c, vec3(0.15, 0.14, 0.125), 0.25) as V3, N0 as V3, vP as V3, ledgeShadow(vP as V3), float(0.85), rk.gloss), N0 as V3, vP as V3, float(1)), 1)
        })(),
      ),
    )
    stones.frustumCulled = false
    world.add(stones)
  }

  // ---------------------------------------------------------------- dust and fine scree trickling off the ledges
  // Every proud bed keeps dust on its top, and sheds it in fits: grains leave the lip, fall as far as the next
  // ledge that can catch them, and a thin veil hangs in the air behind them. A loop on the ambient clock.
  {
    const a: number[] = [], b: number[] = []
    let sites = 0
    for (let bi = 1; bi < BEDS.length - 1 && sites < 46; bi++) {
      const bed = BEDS[bi]
      if (bed.relief < 0.28 || bed.relief - BEDS[bi + 1].relief < 0.08) continue
      // how far a grain falls before something catches it
      let fall = Math.min(bed.y1, 4.5)
      for (let k = bi - 1; k >= 0; k--)
        if (BEDS[k].relief > bed.relief + 0.06) {
          fall = Math.min(4.5, bed.y1 - BEDS[k].y1)
          break
        }
      for (let e = 0; e < (bed.relief > 0.45 ? 2 : 1); e++) {
        // (never over a plaque: the face between x = 0.8 and 4.9 is left alone)
        const x = R() < 0.72 ? -4.6 + R() * 5.2 : 5.0 + R() * 3.4
        const per = Math.sqrt(fall / 3.2) + 0.5 + R() * 0.8
        for (let i = 0; i < 22; i++) {
          a.push(x, bed.y1, bed.relief + 0.03, fall)
          b.push(R(), per, i < 18 ? 0.95 : 0.16, i < 18 ? 0.01 + 0.014 * R() * R() : 0.12 + 0.1 * R())
        }
        sites++
      }
    }
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(new Float32Array(a), 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(new Float32Array(b), 4))
    g.instanceCount = a.length / 4
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const age = fract(U.uTime.div(aB.y).add(aB.x)).mul(aB.y).toVar()
    const fallen = age.mul(age).mul(3.2).mul(mixN(1, 0.45, step(0.05, aB.w))).toVar()
    const fit = smoothstep(0.05, 0.55, sin(U.uTime.mul(0.33).add(aA.x.mul(1.7)).add(aA.y.mul(0.9))))
    const on = step(fallen, aA.w).mul(fit).mul(step(aA.y, U.uTopY)).mul(smoothstep(0, 0.08, age))
    const c = vec3(aA.x.add(aB.x.sub(0.5).mul(0.07)).add(sin(age.mul(3).add(aB.x.mul(40))).mul(0.015)).add(age.mul(0.1)), aA.y.sub(fallen), aA.z.add(age.mul(0.09)).add(aB.x.mul(0.05)))
    const vc = cameraViewMatrix.mul(vec4(c, 1))
    const q = positionGeometry.xy
    const vQ = q.toVarying("trQ")
    // a grain is never let shrink under a pixel and a half: it would sparkle in and out
    const size = max(aB.w, vc.z.negate().mul(0.0019))
    const vA = aB.z.mul(on).toVarying("trA")
    const vY = aA.y.toVarying("trY")
    const trickle = new THREE.Mesh(
      g,
      mat(
        cameraProjectionMatrix.mul(vec4(vc.xy.add(q.mul(size).mul(vec2(1, mixN(1.9, 1, step(0.05, aB.w)))).mul(step(0.001, on))), vc.z, vc.w)),
        Fn(() => {
          const al = smoothstepRev(1, 0.35, length(vQ) as F).mul(vA)
          const dustC = mixN(vec3(0.62, 0.55, 0.46), lut(colT, vY as F).rgb.mul(1.8), 0.35)
          return vec4(dustC.mul(sunCol.mul(0.42).add(mixN(vec3(0.22), vec3(0.45, 0.5, 0.6), U.uCold))).mul(al), al)
        })(),
        { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor },
      ),
    )
    trickle.frustumCulled = false
    trickle.renderOrder = 5
    world.add(trickle)
  }

  // ---------------------------------------------------------------- icicles under the ledges of the glacial beds
  {
    const a: number[] = [], b: number[] = []
    const hang = (x: number, bed: Bed, n: number) => {
      for (let i = 0; i < n; i++) {
        const L = (0.16 + 0.5 * R() * R()) * (i === 0 ? 1.4 : 1)
        a.push(x + (R() - 0.5) * 0.5, bed.y0 + 0.01, bed.relief - 0.02 - 0.05 * R(), L)
        b.push(R() * 0.55, 0.02 + 0.07 * L, R(), 0)
      }
    }
    for (let bi = 1; bi < BEDS.length; bi++) {
      const bed = BEDS[bi]
      if (bed.y0 < 16.6 || bed.relief - BEDS[bi - 1].relief < 0.06) continue
      for (let c = 0; c < 7; c++) hang(R() < 0.7 ? -5.2 + R() * 6.2 : 5.3 + R() * 3.6, bed, 2 + Math.floor(R() * 4))
      // and where a seep crosses the lip
      for (const q of SEEPS) if (q[1] > bed.y0 && q[1] - q[4] < bed.y0) hang(q[0], bed, 6)
    }
    const g = new THREE.InstancedBufferGeometry()
    const cone = new THREE.ConeGeometry(1, 1, 6, 3).rotateX(Math.PI).translate(0, -0.5, 0).toNonIndexed()
    g.setAttribute("position", cone.getAttribute("position"))
    g.setAttribute("normal", cone.getAttribute("normal"))
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(new Float32Array(a), 4))
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(new Float32Array(b), 4))
    g.instanceCount = a.length / 4
    cone.dispose()
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    // each starts when the cold reaches it and lengthens for as long as the cold holds
    const len = aA.w.mul(smoothstep(aB.x, aB.x.add(0.45), U.uIce)).toVar()
    const lp = positionGeometry
    const bend = sin(lp.y.mul(7).add(aB.z.mul(30))).mul(0.12).mul(lp.y.negate())
    const P = vec3(aA.x.add(lp.x.add(bend).mul(aB.y)), aA.y.add(lp.y.mul(len)), aA.z.add(lp.z.mul(aB.y))).mul(step(0.004, len))
    const vP = P.toVarying("icP"), vN = normalGeometry.toVarying("icN")
    const icicles = new THREE.Mesh(
      g,
      mat(
        viewProj.mul(vec4(P, 1)),
        Fn(() => {
          const N = normalize(vec3(vN.x, vN.y.mul(0.15), vN.z)).toVar()
          const V = normalize(U.uCam.sub(vP))
          const fres = pow(sat(dot(N, V) as F).oneMinus(), 2.5)
          const base = vec3(0.6, 0.72, 0.84).mul(skyFill(N as V3).mul(1.7).add(sunCol.mul(sat(dot(N, SUN) as F)).mul(0.35)))
          const spec = pow(sat(dot(N, normalize(SUN.add(V))) as F), 60)
          return vec4(base.add(vec3(0.5, 0.56, 0.66).mul(fres)).add(sunCol.mul(spec).mul(0.6)), 1)
        })(),
      ),
    )
    icicles.frustumCulled = false
    world.add(icicles)
  }

  // ---------------------------------------------------------------- dust along a bedding plane as a bed lands
  const PUFFS = 9
  const dustGeo = new THREE.InstancedBufferGeometry()
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  dustGeo.setIndex([0, 1, 2, 0, 2, 3])
  {
    const a: number[] = [], b: number[] = []
    BEDS.forEach((bed, bi) => {
      const T = BED_T[bi]
      if (T.tau < -50) return
      for (let i = 0; i < PUFFS; i++) {
        const x = -7 + (i + R()) * (18 / PUFFS)
        a.push(x, bed.y0, bed.relief + 0.12, R())
        b.push(T.b, T.tau + FALL + ((x - X0) * WAVE) / 14, R(), R())
      }
    })
    // the hand-off: every ledge in the first frame sheds dust when the last bed locks
    for (const bed of BEDS) {
      if (bed.y0 > 6 || bed.relief < 0.2) continue
      for (let i = 0; i < 4; i++) {
        a.push(-6 + R() * 16, bed.y1, bed.relief + 0.05, R())
        b.push(0, 0.02 + R() * 0.2, R(), R())
      }
    }
    // and a puff wherever a falling stone strikes
    for (const h of bounces)
      for (let i = 0; i < 2; i++) {
        a.push(h.p.x, h.p.y, h.p.z, R() * (h.k ? 0.6 : 1))
        b.push(h.b, h.at, R(), R())
      }
    dustGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(new Float32Array(a), 4))
    dustGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(new Float32Array(b), 4))
    dustGeo.instanceCount = a.length / 4
  }
  {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const age = atOf(aB.x as F).sub(aB.y).toVar()
    const on = step(0, age).mul(step(age, 3))
    const grow = age.mul(1.3).add(1).mul(aA.w.mul(0.1).add(0.07))
    const c = vec3(aA.x.add(aB.z.sub(0.5).mul(age).mul(0.5)), aA.y.add(age.mul(0.22)).sub(age.mul(age).mul(0.03)), aA.z.add(age.mul(aB.w.mul(0.5).add(0.2))))
    const vc = cameraViewMatrix.mul(vec4(c, 1))
    const q = positionGeometry.xy
    const vQ = q.toVarying("duQ")
    const vA = exp(age.mul(-1.7)).mul(smoothstep(0, 0.06, age)).mul(on).mul(smoothstep(2.5, 5.5, vc.z.negate())).toVarying("duA")
    const dust = new THREE.Mesh(
      dustGeo,
      mat(
        cameraProjectionMatrix.mul(vec4(vc.xy.add(q.mul(grow).mul(vec2(2.6, 1)).mul(on)), vc.z, vc.w)),
        Fn(() => {
          const a = exp(dot(vQ, vQ).mul(-3)).sub(0.05).max(0).mul(vA).mul(0.2)
          return vec4(vec3(0.6, 0.52, 0.44).mul(sunCol.mul(0.3).add(0.25)).mul(a), a)
        })(),
        { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor },
      ),
    )
    dust.frustumCulled = false
    dust.renderOrder = 5
    world.add(dust)
  }

  // ---------------------------------------------------------------- props: the staff, the hammer
  const reliefAt = (y: number) => bedAt(y).relief
  const props = (() => {
    const pos: number[] = [], nor: number[] = [], col: number[] = []
    const m4 = new THREE.Matrix4()
    const add = (g: THREE.BufferGeometry, m: THREE.Matrix4, c: [number, number, number, number]) => {
      const n = g.index ? g.toNonIndexed() : g
      n.applyMatrix4(m)
      const p = n.getAttribute("position"), nn = n.getAttribute("normal")
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i))
        nor.push(nn.getX(i), nn.getY(i), nn.getZ(i))
        col.push(...c)
      }
      if (n !== g) n.dispose()
      g.dispose()
    }
    // the scale staff: bands of one hand's width, unnumbered, leaning on the face
    const foot = new THREE.Vector3(2.42, slope(2.42, 1.0) * 0.8 + 0.02, 1.0)
    const head = new THREE.Vector3(2.08, 2.12, reliefAt(2.12) + 0.03)
    const axis = head.clone().sub(foot)
    const len = axis.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize())
    const BANDS = 16
    for (let i = 0; i < BANDS; i++) {
      const c = foot.clone().addScaledVector(axis, (i + 0.5) / BANDS)
      m4.compose(c, q, new THREE.Vector3(1, 1, 1))
      add(new THREE.BoxGeometry(0.034, len / BANDS, 0.034), m4, i % 2 ? [0.74, 0.72, 0.66, 0.15] : [0.5, 0.035, 0.03, 0.15])
    }
    m4.compose(foot.clone().addScaledVector(axis, -0.02), q, new THREE.Vector3(1, 1, 1))
    add(new THREE.CylinderGeometry(0.012, 0.004, 0.09, 8), m4, [0.3, 0.3, 0.32, 0.8])
    // the hammer, on the ledge: square face one way, pick the other, a blue grip
    const hy = 2.2 + 0.04, hz = 0.3, hx = 3.5, HS = 1.8
    const STEEL: [number, number, number, number] = [0.34, 0.35, 0.37, 0.9]
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5)
    const lay = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: [number, number, number, number], rx = 0, rz = 0) => {
      const e = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz))
      const p = new THREE.Vector3(x, y, z).multiplyScalar(HS).applyQuaternion(qz).add(new THREE.Vector3(hx, hy, hz))
      m4.compose(p, qz.clone().multiply(e), new THREE.Vector3(HS, HS, HS))
      add(g, m4, c)
    }
    lay(new THREE.BoxGeometry(0.03, 0.032, 0.075), 0, 0, 0.03, STEEL)
    lay(new THREE.CylinderGeometry(0.002, 0.02, 0.1, 4), 0, 0, -0.055, STEEL, -Math.PI / 2)
    lay(new THREE.CylinderGeometry(0.011, 0.011, 0.17, 8), 0.1, 0, 0, STEEL, 0, Math.PI / 2)
    lay(new THREE.CylinderGeometry(0.017, 0.015, 0.15, 10), 0.25, 0, 0, [0.05, 0.16, 0.5, 0.25], 0, Math.PI / 2)
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute("aC", new THREE.Float32BufferAttribute(col, 4))
    // their shadows on the face
    capA[0].set(foot.x, foot.y, foot.z, 0.022)
    capB[0].set(head.x, head.y, head.z, 0.8)
    const h0 = new THREE.Vector3(0, 0, -0.1 * HS).applyQuaternion(qz), h1 = new THREE.Vector3(0.32 * HS, 0, 0).applyQuaternion(qz)
    capA[1].set(hx + h0.x, hy, hz + h0.z, 0.02)
    capB[1].set(hx + h1.x, hy, hz + h1.z, 0.7)
    return g
  })()
  {
    const aC = attribute("aC", "vec4").toVarying("prC")
    const vP = positionGeometry.toVarying("prP"), vN = normalGeometry.toVarying("prN")
    const m = new THREE.Mesh(props, mat(viewProj.mul(vec4(positionGeometry, 1)), Fn(() => vec4(lit(aC.rgb as V3, normalize(vN) as V3, vP as V3, float(1), float(0.9), aC.w as F), 1))()))
    m.frustumCulled = false
    world.add(m)
  }

  // ---------------------------------------------------------------- the tags and their pins
  const typer = ctx.fonts.typer
  const CELL = { w: 700, h: 330 }
  // A tag stands off the rock on its pin: proud of the proudest bed anywhere behind the tag, by more
  // than the face's own unevenness, so no ledge can come between the lens and the print.
  const TAG_SMAX = 2.2
  const tagPinZ = TAGS.map((t) => {
    let z = 0
    for (let y = t.y - TAG_H * TAG_SMAX; y <= t.y + 0.1; y += 0.02) z = Math.max(z, reliefAt(y))
    return z + 0.2
  })
  const tagTex = canvasTex(CELL.w * 2, CELL.h * 3, (c) => {
    const r = rng(77)
    TAGS.forEach((t, i) => {
      const x = (i % 2) * CELL.w, y = Math.floor(i / 2) * CELL.h
      c.fillStyle = "#e3d1a4"
      c.fillRect(x, y, CELL.w, CELL.h)
      // manila: fibres and a thumbed edge
      for (let k = 0; k < 260; k++) {
        c.fillStyle = `rgba(${r() < 0.5 ? "120,90,40" : "255,250,230"},${0.04 + r() * 0.07})`
        c.fillRect(x + r() * CELL.w, y + r() * CELL.h, 6 + r() * 40, 1)
      }
      c.fillStyle = "#f4ecd6"
      c.fillRect(x + 10, y + 10, CELL.w - 20, CELL.h - 20)
      c.strokeStyle = "#1d1a16"
      c.lineWidth = 7
      c.strokeRect(x + 10, y + 10, CELL.w - 20, CELL.h - 20)
      // the eyelet
      c.fillStyle = "#b9a373"
      c.beginPath()
      c.arc(x + CELL.w / 2, y + 40, 15, 0, 6.3)
      c.fill()
      c.fillStyle = "#141210"
      c.textAlign = "center"
      c.textBaseline = "alphabetic"
      let size = 118
      c.font = `400 ${size}px ${typer}`
      const wd = c.measureText(t.a).width
      if (wd > CELL.w - 60) size *= (CELL.w - 60) / wd
      c.font = `400 ${size}px ${typer}`
      c.strokeStyle = "#141210"
      c.lineWidth = 3.5
      c.strokeText(t.a, x + CELL.w / 2, y + 190)
      c.fillText(t.a, x + CELL.w / 2, y + 190)
      c.font = `400 62px ${typer}`
      c.fillStyle = "#141210"
      c.lineWidth = 2
      c.strokeText(t.u, x + CELL.w / 2, y + 278)
      c.fillText(t.u, x + CELL.w / 2, y + 278)
    })
  })
  texes.push(tagTex)
  const tagGeo = new THREE.InstancedBufferGeometry()
  {
    const p = new THREE.PlaneGeometry(1, 1, 10, 6)
    tagGeo.setAttribute("position", p.getAttribute("position"))
    tagGeo.setAttribute("uv", p.getAttribute("uv"))
    tagGeo.setIndex(p.getIndex())
    const a = new Float32Array(TAGS.length * 4), b = new Float32Array(TAGS.length * 4)
    TAGS.forEach((t, i) => {
      a.set([t.x, t.y, tagPinZ[i], i], i * 4)
      b.set([t.b, t.tau, R(), R()], i * 4)
    })
    tagGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4))
    tagGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4))
    tagGeo.instanceCount = TAGS.length
  }
  const tagS = TAGS.map(() => 1)
  const uTagS = uniformArray(tagS, "float")
  const PIN_DY = 0.045 // the pin goes through the eyelet, this far under the tag's top edge
  /** How far a tag swings on its pin, seconds after it was pinned: a kick that rings down, then the wind. */
  const swingJS = (a: number, time: number, seed: number) => (a < 0 ? 0 : 0.3 * Math.exp(-a * 2.6) * Math.cos(a * 8.5) + 0.034 * Math.sin(time * 1.7 + seed * 6) + 0.016 * Math.sin(time * 3.1 + seed * 11) + 0.02 * Math.sin(time * 0.6 + seed * 3))
  const TG = (() => {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const a = atOf(aB.x as F).sub(aB.y).toVar()
    const on = step(0, a)
    const swing = exp(a.mul(-2.6)).mul(cos(a.mul(8.5))).mul(0.3).add(sin(U.uTime.mul(1.7).add(aB.z.mul(6))).mul(0.034)).add(sin(U.uTime.mul(3.1).add(aB.z.mul(11))).mul(0.016)).add(sin(U.uTime.mul(0.6).add(aB.z.mul(3))).mul(0.02))
    // local, pin at the origin: x across, y down the tag
    const sc = (uTagS.element(aA.w.add(0.5).toInt()) as unknown as F).toVar()
    const lx = positionGeometry.x.mul(TAG_W).mul(sc), ly = positionGeometry.y.sub(0.5).mul(TAG_H).add(PIN_DY).mul(sc)
    const down = ly.negate().div(sc.mul(TAG_H))
    // the free edge lifts off the rock and flutters
    const gust = sin(U.uTime.mul(0.9).add(aB.w.mul(6))).mul(0.5).add(0.5)
    // (a gust gets under one lower corner more than the other, and the paper lifts on its pin)
    const corner = lx.div(sc.mul(TAG_W)).mul(sin(U.uTime.mul(0.47).add(aB.w.mul(9)))).add(0.75)
    const fl = down.mul(down).mul(gust.mul(gust).mul(0.042).add(0.012).add(exp(a.mul(-1.6)).mul(0.025))).mul(corner).mul(sin(U.uTime.mul(8.5).add(lx.mul(11)).add(aB.w.mul(20))).mul(0.35).add(0.75))
    const P = vec3(aA.x.add(lx.mul(cos(swing))).sub(ly.mul(sin(swing))), aA.y.add(lx.mul(sin(swing))).add(ly.mul(cos(swing))), aA.z.add(fl)).mul(on)
    const cell = vec2(mod(aA.w, 2), floor(aA.w.div(2)))
    const uvA = vec2(uvGeometry().x.add(cell.x).div(2), float(3).sub(cell.y).sub(uvGeometry().y.oneMinus()).div(3))
    return { clip: viewProj.mul(vec4(P, 1)), vP: P.toVarying("tgP"), vUV: uvA.toVarying("tgU"), vF: fl.toVarying("tgF") }
  })()
  const tags = new THREE.Mesh(
    tagGeo,
    mat(
      TG.clip,
      Fn(() => {
        if (ctx.debugLabels) return vec4(4, 0, 4, 1)
        const alb = texture(tagTex, TG.vUV).rgb
        // the paper's own curl as its normal
        const N = normalize(vec3(dFdx(TG.vF).mul(-60), dFdy(TG.vF).mul(-60), 1)).toVar()
        const sh = ledgeShadow(TG.vP as V3)
        return vec4(lit(alb as V3, N as V3, TG.vP as V3, sh, float(1), float(0.05)), 1)
      })(),
      { side: THREE.DoubleSide },
    ),
  )
  tags.frustumCulled = false
  world.add(tags)
  const pinGeo = new THREE.InstancedBufferGeometry()
  {
    const shaft = new THREE.CylinderGeometry(0.012, 0.009, 0.9, 8).rotateX(Math.PI / 2).translate(0, 0, -0.4).toNonIndexed()
    const knob = new THREE.SphereGeometry(0.034, 12, 8).translate(0, 0, 0.06).toNonIndexed()
    const cat = (n: string) => new THREE.Float32BufferAttribute([...(shaft.getAttribute(n).array as Float32Array), ...(knob.getAttribute(n).array as Float32Array)], 3)
    pinGeo.setAttribute("position", cat("position"))
    pinGeo.setAttribute("normal", cat("normal"))
    pinGeo.setAttribute("aA", tagGeo.getAttribute("aA"))
    pinGeo.setAttribute("aB", tagGeo.getAttribute("aB"))
    pinGeo.instanceCount = TAGS.length
    shaft.dispose()
    knob.dispose()
  }
  {
    const aA = attribute("aA", "vec4"), aB = attribute("aB", "vec4")
    const a = atOf(aB.x as F).sub(aB.y).toVar()
    // it arrives point first, and is tapped home twice
    const fly = smoothstep(-0.22, 0, a).oneMinus().mul(1.6)
    const outz = float(0.05).sub(step(0, a).mul(0.025)).sub(step(0.25, a).mul(0.025)).add(fly)
    const P = vec3(aA.xy, aA.z).add(positionGeometry).add(vec3(0, 0, outz)).mul(step(-0.22, a))
    const vP = P.toVarying("pnP"), vN = normalGeometry.toVarying("pnN")
    const pins = new THREE.Mesh(pinGeo, mat(viewProj.mul(vec4(P, 1)), Fn(() => vec4(lit(vec3(0.62, 0.4, 0.12), normalize(vN) as V3, vP as V3, float(1), float(1), float(2.5)), 1))()))
    pins.frustumCulled = false
    world.add(pins)
  }

  // ---------------------------------------------------------------- the notebook page, taped to the face
  const PAGE = { x: 0.45, y: 1.02, w: 0.5, h: 0.7 }
  const pageTex = canvasTex(500, 700, (c, w, h) => {
    const r = rng(31)
    const fell = ctx.fonts.fell
    c.fillStyle = "#efe6cf"
    c.fillRect(0, 0, w, h)
    c.strokeStyle = "rgba(90,120,170,0.3)"
    c.lineWidth = 1
    for (let y = 60; y < h; y += 26) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(w, y)
      c.stroke()
    }
    const ink = "#27303f"
    const wob = () => (r() - 0.5) * 2.4
    // the column, drawn by hand from the same table the cliff is built from
    const X0c = 70, X1c = 190, Y0c = h - 46, Y1c = 96
    const yy = (m: number) => Y0c + ((Y1c - Y0c) * m) / TOP
    c.strokeStyle = ink
    c.lineWidth = 2.2
    for (const bed of BEDS) {
      const a = yy(bed.y0), b = yy(bed.y1)
      const xr = X1c + bed.relief * 60
      const [cr, cg, cb] = bed.col
      c.fillStyle = `rgba(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)},0.55)`
      c.fillRect(X0c, b, xr - X0c, a - b)
      c.beginPath()
      c.moveTo(X0c + wob(), a + wob())
      c.lineTo(xr + wob(), a + wob())
      c.lineTo(xr + wob(), b + wob())
      c.stroke()
      // hatching by kind: bands, cross-beds, clasts
      c.lineWidth = 1
      if (bed.iron > 0.5) for (let q = b + 3; q < a; q += 4) { c.beginPath(); c.moveTo(X0c, q); c.lineTo(xr, q + wob()); c.stroke() }
      if (bed.cross > 0.5) for (let q = X0c + 6; q < xr; q += 11) { c.beginPath(); c.moveTo(q + 8, b + 2); c.quadraticCurveTo(q + 2, a - 3, q - 6, a - 1); c.stroke() }
      if (bed.clast > 0.5) for (let q = 0; q < 7; q++) { c.beginPath(); c.arc(X0c + 8 + r() * (xr - X0c - 16), b + 4 + r() * Math.max(1, a - b - 8), 2 + r() * 3.5, 0, 6.3); c.stroke() }
      c.lineWidth = 2.2
    }
    c.beginPath()
    c.moveTo(X0c, Y0c)
    c.lineTo(X0c + wob(), Y1c)
    c.stroke()
    c.fillStyle = ink
    c.textBaseline = "middle"
    c.font = `italic 400 30px ${fell}`
    for (const m of [Y.bifTop, Y.onsetTop + 0.9, Y.redTop, Y.iceTop + 0.6]) {
      c.beginPath()
      c.moveTo(292, yy(m))
      c.lineTo(X1c + 44, yy(m))
      c.lineWidth = 1.4
      c.stroke()
    }
    // the note's own instruction, with an arrow
    c.save()
    c.translate(36, (Y0c + Y1c) / 2 + 90)
    c.rotate(-Math.PI / 2)
    c.restore()
    c.beginPath()
    c.moveTo(36, Y0c - 190)
    c.lineTo(36, Y1c + 30)
    c.lineTo(30, Y1c + 44)
    c.moveTo(36, Y1c + 30)
    c.lineTo(42, Y1c + 44)
    c.lineWidth = 2
    c.stroke()
    // tape
    c.fillStyle = "rgba(214,196,140,0.9)"
    for (const [tx, ty, rt] of [[30, 12, -0.5], [w - 30, 12, 0.5], [30, h - 12, 0.45], [w - 34, h - 14, -0.6]] as const) {
      c.save()
      c.translate(tx, ty)
      c.rotate(rt)
      c.fillRect(-46, -15, 92, 30)
      c.restore()
    }
  })
  texes.push(pageTex)
  {
    const g = new THREE.PlaneGeometry(PAGE.w, PAGE.h, 8, 10).translate(PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h / 2, 0)
    let z = 0
    for (let yq = PAGE.y; yq <= PAGE.y + PAGE.h; yq += 0.05) z = Math.max(z, reliefAt(yq))
    const uvn = uvGeometry()
    // the corner the tape has let go of lifts in the wind
    const lift = sq(uvn.x.mul(uvn.y.oneMinus()) as F).mul(sin(U.uTime.mul(2.3)).mul(0.5).add(0.7)).mul(0.11)
    const P = vec3(positionGeometry.xy, lift.add(z + 0.03))
    const vP = P.toVarying("pgP"), vU = uvn.toVarying("pgU"), vL = lift.toVarying("pgL")
    const page = new THREE.Mesh(
      g,
      mat(
        viewProj.mul(vec4(P, 1)),
        Fn(() => {
          const N = normalize(vec3(dFdx(vL).mul(-40), dFdy(vL).mul(-40), 1))
          return vec4(lit(texture(pageTex, vU).rgb as V3, N as V3, vP as V3, float(1), float(1), float(0.04)), 1)
        })(),
        { side: THREE.DoubleSide },
      ),
    )
    page.frustumCulled = false
    world.add(page)
    capA[2].set(PAGE.x + PAGE.w / 2, PAGE.y + 0.08, z + 0.05, 0.2)
    capB[2].set(PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h - 0.08, z + 0.04, 0.45)
  }

  // ================================================================ the pane
  const G = {
    tS: uniformTexture(stage.texture),
    tB: uniformTexture(soft.texture),
    tI: uniformTexture(ice.texture),
    tH: uniformTexture(half.texture),
    uAsp: uniform(16 / 9),
    uBlurR: uniform(0),
    uFc: uniform(-1), // the frost clock
    uCc: uniform(-1), // the crack clock
    uMc: uniform(-1), // the melt clock
    uWipe: uniform(0),
    uDef: uniform(0), // focus on the glass
    uBreath: uniform(0),
    uThaw: uniform(0), // how far each breath has set the frost back where it landed
    uCold: uniform(0),
    uTime: uniform(0),
    uTag: uniform(new THREE.Vector2(-9, -9)), // where the current tag is on the pane
    uTagR: uniform(new THREE.Vector2(0.1, 0.1)), // and its half size there
  }
  const segA = CRACKS.seg.map((s) => new THREE.Vector4(s.a[0], s.a[1], s.b[0], s.b[1]))
  const segT = CRACKS.seg.map((s) => new THREE.Vector4(s.ta, s.tb, 0, 0))
  const uSegA = uniformArray(segA, "vec4"), uSegT = uniformArray(segT, "vec4")
  const BREATH_C: [number, number] = [-0.12, -0.2]
  const CORNER: [number, number] = [0.78, 0.42] // where the clock is
  /** R: the second ice reaches this pixel. G: how thick it grows there. B: when the nearest crack point breaks. A: distance to that crack. */
  const bake = ctx.pass(({ uv }) => {
    const q0 = uv.sub(0.5).mul(vec2(ICE_ASP, 1)).toVar()
    // arms curve a little: the pane is not a perfect plate
    const q = q0.add(vec2(vnoise(q0.mul(3.1).add(7)), vnoise(q0.mul(3.1).add(19))).sub(0.5).mul(0.07)).toVar()
    const CELLG = 0.6
    const VA = 0.3, VS = 0.012
    const gi = floor(q.div(CELLG)).toVar()
    const T = float(99).toVar(), ridge = float(0).toVar()
    for (let jy = -1; jy <= 1; jy++)
      for (let jx = -1; jx <= 1; jx++) {
        const g = gi.add(vec2(jx, jy)).toVar()
        const hh = hash22(g.add(11.5)).toVar()
        const c = g.add(hh.mul(0.8).add(0.1)).mul(CELLG).toVar()
        const h2 = hash22(g.add(47.3)).toVar()
        // nuclei at the edges start first; the corner by the clock and the breathed-on patch are early
        const de = max(min(float(ICE_ASP / 2).sub(abs(c.x)), float(0.5).sub(abs(c.y))), -0.1)
        const t0 = de.mul(5).add(h2.x.mul(1.2)).sub(exp(dot(c.sub(vec2(...CORNER)), c.sub(vec2(...CORNER))).div(-0.07)).mul(1.4)).sub(exp(dot(c.sub(vec2(...BREATH_C)), c.sub(vec2(...BREATH_C))).div(-0.05)).mul(1.5)).max(0)
        const p = rot(q.sub(c) as V2, h2.y.mul(6.28) as F).toVar()
        const r = length(p), th = atan(p.y, p.x)
        const th2 = mod(th.add(Math.PI / 6), Math.PI / 3).sub(Math.PI / 6)
        const a = r.mul(cos(th2)).toVar(), b = abs(r.mul(sin(th2))).toVar()
        const P1 = h2.x.mul(0.03).add(0.04), P2 = 0.017
        // the arm; a side branch at sixty degrees; a tertiary off the side branch
        const tm = a.div(VA).add(b.div(VS))
        const ar = a.sub(b.mul(0.57735)).toVar()
        const arn = max(floor(ar.div(P1).add(0.5)), 1).mul(P1).toVar()
        const l = b.mul(1.1547).toVar()
        const s1 = abs(ar.sub(arn)).mul(0.866).toVar()
        const t1 = arn.div(VA).add(l.div(VA * 0.6)).add(s1.div(VS))
        const lr = l.sub(s1.mul(0.57735)).toVar()
        const lrm = max(floor(lr.div(P2).add(0.5)), 1).mul(P2).toVar()
        const p2 = abs(lr.sub(lrm)).mul(0.866)
        const t2 = arn.div(VA).add(lrm.div(VA * 0.6)).add(s1.mul(1.1547).div(VA * 0.4)).add(p2.div(VS))
        const t = t0.add(min(tm, min(t1, t2))).toVar()
        const rd = max(exp(b.div(-0.006)), max(exp(s1.div(-0.004)).mul(0.75), exp(p2.div(-0.0026)).mul(0.5)))
        ridge.assign(select(t.lessThan(T), rd, ridge))
        T.assign(min(T, t))
      }
    // the cracks
    const cd = float(9).toVar(), ct = float(99).toVar()
    Loop(NSEG, ({ i }) => {
      const s = (uSegA.element(i) as unknown as V4).toVar()
      const tt = (uSegT.element(i) as unknown as V4).toVar()
      const ab = s.zw.sub(s.xy).toVar()
      const h = clampN(dot(q0.sub(s.xy), ab).div(max(dot(ab, ab), 1e-7)), 0, 1).toVar()
      const d = length(q0.sub(s.xy).sub(ab.mul(h))).toVar()
      If(d.lessThan(cd), () => {
        cd.assign(d)
        ct.assign(mixN(tt.x, tt.y, h))
      })
    })
    return vec4(T, ridge, ct, cd)
  }, { uSegA, uSegT } as never)
  let baked = false

  const blur = ctx.pass(({ uv }) => {
    const acc = vec3(0).toVar()
    const N = 8
    for (let i = 0; i < N; i++) {
      const a = i * 2.39996, r = Math.sqrt((i + 0.5) / N)
      acc.addAssign(sampleRT(G.tS, uv.add(vec2(Math.cos(a) * r, Math.sin(a) * r * ICE_ASP).mul(G.uBlurR)) as V2).rgb)
    }
    return vec4(acc.div(N), 1)
  }, G)

  const glass = ctx.pass(({ uv, res }) => {
    const q = uv.sub(0.5).mul(vec2(G.uAsp, 1)).toVar()
    const uvI = q.div(vec2(ICE_ASP, 1)).add(0.5).toVar()
    const I = sampleRT(G.tI, clampN(uvI, 0.001, 0.999) as V2).toVar()
    // a breath on the pane melts the frost back where it lands; the ferns then grow in again over the wet patch
    const bd = length(q.sub(vec2(...BREATH_C)).mul(vec2(0.8, 1.15))).toVar()
    // frost grows in from the pane's edges: toward the middle it arrives later and stays thin, so the cliff reads through it
    const de = min(G.uAsp.mul(0.5).sub(abs(q.x)), float(0.5).sub(abs(q.y)))
    const mid = smoothstep(0.06, 0.34, de.add(tn(q.mul(3.3)).sub(0.5).mul(0.08))).toVar()
    const since = G.uFc.sub(G.uThaw.mul(exp(bd.mul(bd).div(-0.11)))).sub(I.x).sub(mid.mul(4.4)).toVar()
    const cov = smoothstep(0, 0.35, since).toVar()
    const thick = cov.mul(I.y.mul(0.6).add(0.4)).mul(sat(since.mul(0.25) as F).mul(0.5).add(0.6)).mul(mid.mul(0.55).oneMinus()).toVar()
    // the slope of the ice, from the screen's own derivatives (one lookup of the field, not five)
    const grad = vec2(dFdx(thick), dFdy(thick)).mul(res.x.mul(3.2 / 1600)).toVar()

    // ---- what has melted
    const broke = step(I.z, G.uCc)
    const n1 = tn(q.mul(34))
    const meltR = float(1).sub(exp(max(G.uMc, 0).mul(-0.22))).mul(0.06).mul(n1.mul(0.9).add(0.35))
    const M = smoothstepRev(1, 0.6, I.w.div(max(meltR, 1e-5)) as F).mul(broke).mul(step(0, G.uMc)).toVar()
    // beads that gather on a crack and run, leaving a clear track
    const bead = float(0).toVar(), beadN = vec2(0).toVar()
    If(G.uMc.greaterThan(0), () => {
      const COLS = 26
      const cx0 = floor(q.x.mul(COLS / 1.8)).toVar()
      for (let j = -1; j <= 1; j++) {
        const ci = cx0.add(j).toVar()
        const h = hash22(vec2(ci, 7.7)).toVar(), h3 = hash11(ci.mul(3.7).add(1.3)).toVar()
        const ts = h.x.mul(h.x).mul(8).add(0.15)
        const tau = max(G.uMc.sub(ts), 0).toVar()
        const y0 = float(0.46).sub(h.y.mul(0.62))
        const fallen = tau.mul(0.03).add(tau.mul(tau).mul(0.022)).add(sin(tau.mul(2.3).add(h3.mul(6))).mul(0.012).mul(min(tau, 1)))
        const yh = y0.sub(fallen).toVar()
        const px = ci.add(0.5).mul(1.8 / COLS).add(sin(q.y.mul(21).add(h3.mul(40))).mul(0.009)).add(sin(q.y.mul(57).add(h3.mul(17))).mul(0.004))
        const dxp = q.x.sub(px).toVar()
        const w = h3.mul(0.004).add(0.0045)
        const on = step(0.42, h3).mul(step(0.001, tau))
        M.assign(max(M, smoothstep(0, 0.5, abs(dxp).div(w).oneMinus()).mul(step(yh, q.y)).mul(step(q.y, y0)).mul(on)))
        const rb = w.mul(1.9)
        const dv = vec2(dxp, q.y.sub(yh).mul(0.78)).div(rb).toVar()
        const inB = smoothstepRev(1, 0.8, length(dv)).mul(on)
        bead.assign(max(bead, inB))
        beadN.assign(mixN(beadN, dv, inB))
      }
    })
    // the wipe: a hand's width swept along an arc about the elbow
    const wet = float(0).toVar(), rim = float(0).toVar()
    If(G.uWipe.greaterThan(0), () => {
      const pv = q.sub(vec2(0.25, -1.25)).toVar()
      const r = length(pv), th = atan(pv.y, pv.x)
      const TH0 = 2.2, TH1 = 1.02
      const cur = mixN(TH0, TH1, G.uWipe)
      const nb = tn(vec2(th.mul(9), 3)).sub(0.5).mul(0.05)
      const band = smoothstep(1.0, 1.04, r.add(nb)).mul(smoothstepRev(1.44, 1.39, r.add(nb.mul(1.3)) as F))
      const swept = smoothstep(cur, cur.add(0.03), th).mul(smoothstepRev(TH0 + 0.02, TH0 - 0.03, th.add(nb)))
      // the fingers leave streaks
      const streak = smoothstep(0.66, 0.9, tn(vec2(r.mul(130), 1.7))).mul(0.3).add(smoothstep(0.78, 0.95, tn(vec2(r.mul(47), th.mul(4)))).mul(0.2))
      wet.assign(band.mul(swept))
      M.assign(max(M, wet.mul(streak.oneMinus())))
      // slush pushed to the edges of the stroke and ahead of the hand
      const e1 = exp(sq(r.add(nb).sub(1.02).div(0.012) as F).negate()).add(exp(sq(r.add(nb.mul(1.3)).sub(1.415).div(0.014) as F).negate()))
      const lead = exp(sq(th.sub(cur).div(0.02) as F).negate()).mul(band).mul(step(G.uWipe, 0.995))
      rim.assign(e1.mul(swept).add(lead).mul(cov))
    })
    // the ice stays thin over the tag being read
    const clr = smoothstep(1.3, 2.1, max(abs(uv.x.sub(G.uTag.x)).div(G.uTagR.x), abs(uv.y.sub(G.uTag.y)).div(G.uTagR.y)).add(tn(q.mul(9)).mul(0.25))).toVar()
    bead.mulAssign(clr)
    const F0 = thick.mul(M.oneMinus()).add(rim.mul(0.8)).mul(clr).toVar()
    const wasIce = cov.mul(M).mul(clr).toVar()

    // ---- the cliff through it
    const speck = vec2(tn(floor(uv.mul(res))), tn(floor(uv.mul(res)).add(37))).sub(0.5)
    const off = grad.mul(-0.028).mul(M.oneMinus()).mul(clr).add(speck.mul(F0).mul(0.012)).add(beadN.mul(bead).mul(-0.02)).add(vec2(tn(q.mul(60)), tn(q.mul(60).add(9))).sub(0.5).mul(wasIce).mul(wet.oneMinus()).mul(0.003)).toVar()
    const uvr = clampN(uv.add(off), 0.001, 0.999).toVar()
    const sharp = sampleRT(G.tS, uvr as V2).rgb
    const softC = sampleRT(G.tB, uvr as V2).rgb
    const col = mixN(sharp, softC, sat(G.uDef.mul(clr).mul(bead.oneMinus()).mul(wet.mul(0.85).oneMinus()).mul(mid.mul(0.5).oneMinus()).add(F0.mul(0.5)) as F)).toVar()
    // breath: a patch of condensation, blooming and shrinking back
    const fog = smoothstepRev(0.5, 0.05, bd.add(tn(q.mul(7)).mul(0.12)) as F).mul(G.uBreath).mul(cov.mul(0.5).oneMinus()).toVar()
    const drops = tn(q.mul(260)).mul(0.25).add(0.85)
    col.assign(mixN(col, mixN(softC, vec3(0.72, 0.76, 0.82), 0.62).mul(drops), fog.mul(0.85).mul(clr)))
    // the ice itself: lit from the side the sun is on, thick on the ridges
    const n = normalize(vec3(grad.mul(-22), 1)).toVar()
    const Lg = normalize(vec3(-0.55, 0.45, 0.7))
    const dif = sat(dot(n, Lg) as F)
    // backlit: the ice passes the cliff through, a little colder and darker, and the light it scatters is on the
    // crystals' arms and the faces turned to the sky, so the arms read bright against what is behind them
    const back = softC.dot(vec3(0.3, 0.5, 0.2)).toVar()
    const trans = col.mul(vec3(0.78, 0.86, 0.97)).mul(thick.mul(0.25).oneMinus())
    const scat = vec3(0.74, 0.84, 1.0).mul(back.mul(0.55).add(0.32)).mul(I.y.mul(0.75).add(0.2)).mul(mixN(float(0.85), 1.15, dif))
    const iceW = sat(cov.mul(I.y.mul(0.75).add(0.05).add(sat(since.mul(0.08) as F).mul(0.12))).mul(mid.mul(0.5).oneMinus()).mul(M.oneMinus()).add(rim).mul(clr) as F).toVar()
    col.assign(mixN(col, trans, sat(cov.mul(M.oneMinus()).mul(clr) as F)))
    col.assign(mixN(col, scat, iceW))
    // the growing edge: ice that formed in the last second is thin and clear and catches the light, so every
    // advancing tip is a bright point that moves
    const tipI = cov.mul(smoothstepRev(1.1, 0.25, since)).mul(I.y.mul(0.7).add(0.3)).mul(M.oneMinus()).mul(clr).mul(step(G.uCc, 0))
    col.addAssign(vec3(0.75, 0.85, 1.05).mul(tipI).mul(0.55))
    const spark = step(0.985, tn(floor(uv.mul(res)).add(91))).mul(I.y).mul(F0)
    col.addAssign(vec3(1.2, 1.25, 1.35).mul(pow(dif, 10).mul(F0).mul(0.5).add(spark.mul(1.6))))
    // water left where ice was: a film, small beads, running beads
    col.mulAssign(wasIce.mul(0.06).oneMinus())
    const small = smoothstep(0.8, 0.88, tn(q.mul(150))).mul(wasIce).mul(bead.oneMinus()).toVar()
    col.addAssign(vec3(0.9, 0.95, 1).mul(small).mul(0.12))
    const hi = smoothstepRev(0.5, 0.2, length(beadN.sub(vec2(-0.35, 0.4))) as F).mul(bead)
    col.assign(col.mul(bead.mul(sq(length(beadN) as F)).mul(0.45).oneMinus()).add(vec3(1.5, 1.5, 1.55).mul(hi)))
    // how much of this pixel is the pane's doing: the rest is the cliff, which the last pass takes at full resolution
    return vec4(col, sat(G.uDef.mul(clr).mul(4).add(F0.mul(8)).add(fog.mul(8)).add(bead.mul(8)).add(small.mul(8)) as F))
  }, G)

  // the last pass, at full resolution: the cliff where the pane is clear, the pane where it is not, and the cracks
  const comp = ctx.pass(({ uv }) => {
    const q = uv.sub(0.5).mul(vec2(G.uAsp, 1)).toVar()
    const H = sampleRT(G.tH, uv).toVar()
    const col = mixN(sampleRT(G.tS, uv).rgb, H.rgb, H.a).toVar()
    If(G.uCc.greaterThan(0), () => {
      const I = sampleRT(G.tI, clampN(q.div(vec2(ICE_ASP, 1)).add(0.5), 0.001, 0.999) as V2).toVar()
      const cov = smoothstep(0, 0.35, G.uFc.sub(I.x))
      const broke = step(I.z, G.uCc)
      const clr = smoothstep(1.3, 2.1, max(abs(uv.x.sub(G.uTag.x)).div(G.uTagR.x), abs(uv.y.sub(G.uTag.y)).div(G.uTagR.y)).add(tn(q.mul(9)).mul(0.25)))
      // cracks: a dark line with a bright lip on the sunward side
      const cw = float(0.002)
      const line = smoothstepRev(1.4, 0.4, I.w.div(cw) as F).mul(broke).mul(cov).toVar()
      const tip = exp(G.uCc.sub(I.z).mul(-7)).mul(broke)
      col.assign(mixN(col, col.mul(0.35), line.mul(0.8).mul(clr)))
      col.addAssign(vec3(1.3, 1.35, 1.5).mul(smoothstepRev(4, 1.2, I.w.div(cw) as F).mul(line.oneMinus()).mul(broke).mul(cov).mul(clr).mul(tip.mul(2.4).add(0.28))))
    })
    return vec4(col, 1)
  }, G)

  // ---------------------------------------------------------------- this frame's numbers
  const W = { frost: 0, cold: 0, def: 0, land: 0, selA: 0, sel: [0, 0, 0, 0] as [number, number, number, number], glassOn: false }
  const tgt = new THREE.Vector3()
  const LC = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const LOUT = TAGS.map(() => ({ px: 0, inFrame: 0, underType: 0, clip: [[0, 0], [0, 0], [0, 0], [0, 0]] as [[number, number], [number, number], [number, number], [number, number]] }))
  const LINFO: LabelInfo[] = TAGS.map((t, i) => ({ id: t.a, corners: LOUT[i].clip }))
  const LBL: LabelInfo[] = []
  const v0 = new THREE.Vector3()
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.2, bloomThresh: 0.9, bloomRadius: 0.7, vignette: 0.3, ca: 0.0006, sat: 1.04, contrast: 1.08, lift: [0.004, 0.006, 0.013], gain: [1, 1, 1], grain: 0.022 }
  const TITLES: TitleOpts = { color: "#ffffff", shadow: "rgba(8,10,16,0.9)", delay: [0.5, 0.4, 0.5, 0.4], maxLine: 26 }
  const HUD = { color: "#ffffff", shadow: "rgba(0,0,0,0.75)" }
  const tagSeed = TAGS.map((_, i) => (tagGeo.getAttribute("aB").array as Float32Array)[i * 4 + 2])

  // ---------------------------------------------------------------- sound
  const cues: Cue[] = []
  BEDS.forEach((bed, i) => {
    const T = BED_T[i]
    if (T.tau < -50) return
    const at = Math.max(0, T.tau + FALL)
    cues.push({ b: T.b, at, s: "thud", o: { f: H(bed.iron > 0.5 ? 2 : 3) * (1 + 0.04 * (i % 3)), g: 0.3 + 0.5 * Math.min(1, bed.y1 - bed.y0), }, pos: [-0.55, 0.7, 0.5] })
    cues.push({ b: T.b, at: at + WAVE, s: "thud", o: { f: H(2), g: 0.14 }, pos: [0.7, 0.7, 0.7] })
    if (bed.tone >= 5) cues.push({ b: T.b, at: at + 0.02, s: "marimba", o: { f: H(bed.tone * 2), g: 0.13 }, pos: [-0.2, 0.6, 0.5] })
  })
  const tagWorld = TAGS.map((t) => new THREE.Vector3(t.x, t.y, 0.3))
  TAGS.forEach((t, i) => {
    const pos = () => listenerPos(tagWorld[i], cam, 6)
    cues.push({ b: t.b, at: t.tau, s: "knap", o: { f: H(56 + i * 2), g: 0.8 }, pos }, { b: t.b, at: t.tau + 0.25, s: "knap", o: { f: H(64 + i * 2), g: 1 }, pos }, { b: t.b, at: t.tau + 0.27, s: "marimba", o: { f: H(16 + i * 2), g: 0.2 }, pos }, { b: t.b, at: t.tau + 0.05, s: "page", o: { g: 0.6 }, pos })
  })
  for (const [b, t] of STOPS) cues.push({ b, at: t - 0.05, s: "sub", o: { g: 0.5 } }, { b, at: t - 0.03, s: "gear", o: { dur: 3, g: 0.3 }, pos: [0, -0.8, -0.3] })
  cues.push({ b: 1, at: 3.7, s: "select", o: { g: 0.8 } })
  cues.push(
    { b: 0, at: 0.02, s: "rumble", o: { f: 90, dur: 2.2, g: 0.5 } },
    { b: 1, at: 0.4, s: "whoosh", o: { f: 180, dur: 1.4, g: 0.35 } },
    { b: 2, at: 0.2, s: "whoosh", o: { f: 140, dur: 2.6, g: 0.6 } },
    { b: 2, at: BREATH[0], s: "hiss", o: { dur: 1.1, g: 0.8 } },
    { b: 2, at: BREATH[1], s: "hiss", o: { dur: 1.1, g: 0.7 } },
    { b: 2, at: FROST0, s: "pad", o: { f: H(3), dur: 8, g: 0.6 } },
    { b: 2, at: FROST0 + 0.1, s: "glass", o: { f: H(48), g: 0.35, pan: 0.8 } },
    { b: 3, at: 0.5, s: "pad", o: { f: H(4), dur: 7, g: 0.55 } },
    { b: 3, at: MELT0, s: "sizzle", o: { dur: 2.6, g: 0.5 }, pos: [0.2, 0, -0.1] },
    { b: 3, at: MELT0 + 0.9, s: "splash", o: { g: 0.25 }, pos: [-0.4, -0.5, -0.1] },
    { b: 3, at: WIPE[0], s: "scratch", o: { f: 900, dur: WIPE[1] - WIPE[0], g: 2.4, pan: -0.5 } },
    { b: 3, at: WIPE[0] + 0.5, s: "scratch", o: { f: 1300, dur: 0.6, g: 1.8, pan: 0.4 } },
    { b: 3, at: WIPE[1], s: "glass", o: { f: H(40), g: 0.3, pan: 0.6 } },
  )
  // ice ticking as the arms advance, sparser as the pane fills
  for (let i = 0; i < 16; i++) cues.push({ b: 2, at: FROST0 + 0.3 + i * 0.33 + (i % 3) * 0.07, s: "glass", o: { f: H(56 + ((i * 7) % 16)), g: 0.16 - i * 0.006, pan: ((i * 37) % 20) / 10 - 1 } })
  CRACKS.reports.forEach((r, i) => {
    cues.push({ b: 3, at: CRACK0 + r.t, s: "crack", o: { f: 1700 - i * 150, g: 1.1 - i * 0.08 }, pos: [r.x, 0.1, -0.15] }, { b: 3, at: CRACK0 + r.t + 0.01, s: "glass", o: { f: H(72 + i * 5), g: 0.3 }, pos: [r.x, 0.1, -0.15] })
  })
  cues.push({ b: 3, at: CRACK0, s: "sub", o: { g: 0.6 } })
  // the new small events: a stone striking (duller each bounce), sand trickling in the holds, water starting to run,
  // the rust arriving, ice creaking on the face
  for (const h of bounces) cues.push({ b: h.b, at: h.at, s: "knap", o: { f: H(34 - h.k * 3), g: 0.55 * 0.72 ** h.k, wet: 1.4 }, pos: () => listenerPos(h.p, cam, 7) })
  for (const [b, at, x] of [[0, 6.2, -0.5], [0, 8.4, 0.6], [1, 8.3, -0.6], [1, 10.4, 0.5], [2, 4.6, -0.4], [3, 5.2, 0.3], [3, 7.4, -0.5]] as const) cues.push({ b, at, s: "hiss", o: { f: 5200, dur: 1.3, g: 0.13 }, pos: [x, -0.3, 0.6] })
  SEEPS.forEach((q, i) => cues.push({ b: q[2], at: q[3] + 0.3, s: "splash", o: { g: 0.1 }, pos: [i % 2 ? 0.6 : -0.6, 0.3, 0.6] }))
  cues.push({ b: 1, at: 3.0, s: "shimmer", o: { f: H(12), dur: 1.6, g: 0.16 }, pos: [0.2, 0.1, 0.5] })
  BEDS.forEach((bed, i) => {
    if (bed.ox && OX_T[i] > 4) cues.push({ b: 1, at: OX_T[i], s: "shimmer", o: { f: H(bed.ox === 1 ? 12 : 9) * (1 + 0.5 * ((i * 3) % 4)), dur: 1.4, g: 0.1 }, pos: [-0.5 + ((i * 5) % 7) / 6, 0.4, 0.6] })
  })
  for (const [at, f, x] of [[5.2, 210, -0.7], [7.9, 160, 0.5], [10.1, 240, -0.2]] as const) cues.push({ b: 2, at, s: "scratch", o: { f, dur: 0.5, g: 0.5 }, pos: [x, 0.2, 0.5] }, { b: 2, at: at + 0.42, s: "crack", o: { f: 700, g: 0.22 }, pos: [x, 0.2, 0.5] })

  function update(s: State) {
    const asp = s.w / s.h
    const b = s.beat
    const t = Math.min(s.t, 60)
    const t0 = clamp(s.at(0), -10, 60)
    U.uAt.value.set(clamp(s.at(0), -50, 60), clamp(s.at(1), -50, 60), clamp(s.at(2), -50, 60), clamp(s.at(3), -50, 60))
    U.uTime.value = s.time
    G.uTime.value = s.time
    G.uAsp.value = asp

    // ---- the crane: a rise that ends dead on a dated bed, and the arm's small settle
    let cy = craneY(b, Math.max(t, 0))
    const dist = craneD(b, Math.max(t, 0))
    let nod = 0
    for (const [sb, st] of STOPS) {
      const v = s.at(sb) - st
      if (v > 0 && v < 6) {
        const e = Math.exp(-v * 5.5)
        cy += 0.055 * e * Math.sin(v * 13)
        nod += 0.006 * e * Math.cos(v * 13)
      }
    }
    // the hand-off: the lens tips from looking up along the face to square on, and takes the knock of the last bed
    const tip = t0 < 0 ? 1 - E.io3(clamp(1 + t0 / 2.5)) : 0
    const land = Math.max(t0, 0)
    W.land = land
    const knock = b === 0 && t0 >= 0 ? Math.exp(-land * 4.5) : 0
    U.uKick.value = knock * Math.cos(land * 30)
    const drift = 1 - tip
    // the crane never quite stops: through each hold it creeps in on the dated bed, and the operator breathes
    let push = 0, truck = 0
    for (const h of HOLDS) {
      const w = s.k(h[0], h[1], h[2], E.lin) * (h[3] < 0 ? 1 : 1 - s.k(h[3], h[4], h[5], E.io2)) * h[7]
      push += w
      truck += w * (TAGS[h[6]].x - 1.1) * 0.24
    }
    cy += 0.14 * push
    const hx = (0.05 * Math.sin(s.time * 0.31) + 0.03 * Math.sin(s.time * 0.53 + 1) + 0.028 * Math.sin(s.time * 1.37 + 0.4)) * drift
    const hy = (0.035 * Math.sin(s.time * 0.27 + 2) + 0.02 * Math.sin(s.time * 0.61) + 0.02 * Math.sin(s.time * 1.57 + 1.1)) * drift
    const tx = 1.1 + 0.25 * s.k(1, 0.3, 3.4) - 0.2 * s.k(2, 0.2, 3.4) + truck
    const yaw = 0.44 * (1 - 0.6 * tip) - 0.07 * s.k(1, 0.3, 3) + 0.1 * s.k(2, 0.2, 2) - 0.05 * s.k(3, 0.5, 2.6) - 0.04 * push + s.mouse.x * 0.03
    // the lens tilts up behind the arm on the second rise, so the first tag stays in the frame while the headline is said
    const lag = b === 1 ? 0.95 * Math.sin(Math.PI * kk(t, 0.25, 3.1, E.io2)) * (1 - 0.35 * kk(t, 1.6, 3.1)) : 0
    tgt.set(tx + hx * 0.5, cy + hy * 0.5 + tip * 2.6 - lag, 0.15)
    const d = mix(dist - 0.8 * push, 4.4, tip)
    cam.position.set(tgt.x - Math.sin(yaw) * d + hx, mix(cy + 0.03 * dist + hy + s.mouse.y * 0.1, 0.75, tip) + knock * 0.05 * Math.sin(land * 34), 0.15 + Math.cos(yaw) * d * mix(1, 0.55, tip))
    cam.aspect = asp
    cam.fov = FOV * (asp < 16 / 9 ? Math.min(1.5, 16 / 9 / asp) : 1)
    cam.updateProjectionMatrix()
    cam.lookAt(tgt)
    cam.rotation.x += nod + 0.0016 * Math.sin(s.time * 1.57) * drift
    cam.rotation.y += 0.0014 * Math.sin(s.time * 1.13 + 2) * drift
    cam.rotation.z += (0.0035 * Math.sin(s.time * 0.23) + 0.0012 * Math.sin(s.time * 1.9 + 0.7)) * drift + knock * 0.006 * Math.sin(land * 27)
    cam.updateMatrixWorld()
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
    U.uCam.value.copy(cam.position)

    // ---- the sun: it climbs through the first two beats (the shadow under every ledge lengthens), drops low and flat
    // for the cold, and comes back. Its z stays put, so the face keeps its exposure while the relief changes.
    const elev = clamp(0.36 + 0.5 * s.k(0, 0, 10, E.lin) + 0.46 * s.k(1, 0, 11.5, E.lin) - 0.9 * s.k(2, 0.3, 11, E.lin) + 0.6 * s.k(3, 0, 9.5, E.lin) + 0.04 * Math.sin(s.time * 0.13), 0.3, 1.36)
    const sy = 0.5 * elev
    U.uSun.value.set(-Math.sqrt(1 - 0.25 - sy * sy), sy, 0.5)

    // ---- how much of the column is there
    let top = 0
    for (let i = 0; i < BEDS.length; i++) {
      const T = BED_T[i]
      if (s.at(T.b) - T.tau > FALL * 0.8) top = BEDS[i].y1
    }
    U.uTopY.value = top

    // ---- the cold
    const cold = s.k(2, 1.6, 6, E.io2) * (1 - 0.7 * s.k(3, 0.4, 4.5, E.io2))
    W.cold = cold
    U.uCold.value = cold
    G.uCold.value = cold
    // rime: it comes quickly at first and then keeps creeping down the face for as long as the cold holds
    U.uSnow.value = (0.26 * s.k(2, 2.6, 7.5, E.io2) + 0.14 * s.k(2, 7, 11, E.lin)) * (1 - 0.6 * s.k(3, 1, 5, E.io2))

    // ---- stones: where each is on its parabola
    for (let i = 0; i < NST; i++) {
      const a = s.at(STONE_EV[i][0]) - STONE_EV[i][1]
      if (a < 0) {
        stP[i].y = -50
        continue
      }
      const ta = Math.min(a, stEnd[i])
      let k = i * SEG * 7
      for (let j = 1; j < stN[i] && stSeg[k + 7] <= ta; j++) k += 7
      const u = ta - stSeg[k]
      stP[i].x = stSeg[k + 1] + stSeg[k + 4] * u
      stP[i].y = stSeg[k + 2] + stSeg[k + 5] * u - 0.5 * 9.8 * u * u
      stP[i].z = stSeg[k + 3] + stSeg[k + 6] * u
      stR[i].x = ta * 7
    }
    // ---- seeps run for as long as their own clocks say, and stay
    for (let i = 0; i < NSEEP; i++) seepB[i].x = SEEP_V * clamp(s.at(SEEPS[i][2]) - SEEPS[i][3], 0, SEEPS[i][4] / SEEP_V)
    // (most of their length before the pane closes over, the rest through the hold; they go after the wipe, where the cleared arc shows it)
    U.uIce.value = (0.7 * s.k(2, 1.8, 5.5, E.out2) + 0.3 * s.k(2, 5.5, 11, E.lin)) * (1 - s.k(3, 4.6, 9, E.io2))

    // ---- the tags: the size floor (a numeral and its unit stay readable wherever the crane is), and the one the pane keeps clear
    let cur = -1
    for (let i = 0; i < TAGS.length; i++) {
      const T = TAGS[i]
      v0.set(T.x, T.y - TAG_H / 2, tagPinZ[i])
      tagS[i] = Math.max(labelFloor(v0, TAG_H * TAG_NUM, cam, LABEL_MIN.number), labelFloor(v0, TAG_H * TAG_UNIT, cam, LABEL_MIN.unit)) * 1.04
      if (s.at(T.b) - T.tau >= 0) cur = i
    }
    if (cur >= 0) {
      v0.set(TAGS[cur].x, TAGS[cur].y - (TAG_H / 2) * tagS[cur], tagPinZ[cur]).project(cam)
      G.uTag.value.set(v0.x * 0.5 + 0.5, v0.y * 0.5 + 0.5)
      const hh = (screenPx(v0.set(TAGS[cur].x, TAGS[cur].y, tagPinZ[cur]), TAG_H * tagS[cur], cam) / 720) * 0.5
      G.uTagR.value.set((hh * TAG_W) / TAG_H / asp, hh)
    } else G.uTag.value.set(-9, -9)

    // ---- the tags' shadows swing with them
    for (let i = 0; i < TAGS.length; i++) {
      const T = TAGS[i]
      const a = s.at(T.b) - T.tau
      const sw = swingJS(a, s.time, tagSeed[i])
      const k = 3 + (i % (NCAP - 3))
      // (only the tags near the lens need a shadow: the last ones pinned reuse the first slots)
      if (a < 0 || Math.abs(T.y - cy) > 6) {
        if (Math.abs(T.y - cy) > 6 && a >= 0) continue
        capB[k].w = 0
        continue
      }
      const cxm = Math.sin(sw) * (TAG_H / 2) * tagS[i], cym = -Math.cos(sw) * (TAG_H / 2) * tagS[i]
      capA[k].set(T.x + cxm - Math.cos(sw) * TAG_W * 0.3 * tagS[i], T.y + cym - Math.sin(sw) * TAG_W * 0.3 + PIN_DY, tagPinZ[i] + 0.03, 0.22 * tagS[i])
      capB[k].set(T.x + cxm + Math.cos(sw) * TAG_W * 0.3 * tagS[i], T.y + cym + Math.sin(sw) * TAG_W * 0.3 + PIN_DY, tagPinZ[i] + 0.03, 0.5)
    }

    // ---- the selection box on the bed between the two dates
    W.selA = s.beat === 1 ? s.k(1, 3.7, 3.95, E.lin) * (1 - s.k(1, 4.25, 4.5, E.lin)) : 0
    if (W.selA > 0) {
      v0.set(1.75, Y.onsetTop - 0.02, reliefAt(9.2)).project(cam)
      const x0 = (v0.x * 0.5 + 0.5) * DW, y0 = (1 - (v0.y * 0.5 + 0.5)) * DH
      v0.set(3.75, Y.bifTop + 0.02, reliefAt(9.2)).project(cam)
      W.sel = [x0, y0, (v0.x * 0.5 + 0.5) * DW - x0, (1 - (v0.y * 0.5 + 0.5)) * DH - y0]
    }

    // ---- the pane
    // The frost clock. Fast at first, then slow enough that tips are still advancing when the hold ends, and it
    // keeps creeping (more and more slowly) for as long as the beat is held. Beat 4 starts from where a full hold
    // leaves it, and the last of it closes in a rush under the first crack, which hides any difference.
    const inB3 = s.beat <= 2
    const te = inB3 ? s.at(2) : 11 + Math.max(s.at(3), 0)
    const fc = te < 5.5 ? (te - FROST0) * 0.84 : te < 11 ? 2.6 + (te - 5.5) * 0.4 : inB3 ? 4.8 + 1.8 * (1 - Math.exp(-(te - 11) / 9)) : 4.8 + 35.2 * E.io2(clamp((te - 11) / 1.6))
    G.uFc.value = clamp(fc, -1, 40)
    // (what the type and the grade follow: the pane whitening, as before)
    W.frost = clamp(((s.at(2) - FROST0) * FROST_RATE) / 7)
    G.uCc.value = clamp(s.at(3) - CRACK0, -1, 40)
    G.uMc.value = clamp(s.at(3) - MELT0, -1, 60)
    G.uWipe.value = s.k(3, WIPE[0], WIPE[1], E.io2)
    const t2 = s.at(2)
    let br = 0, thawed = 0
    for (const bt of BREATH) {
      const v = te - bt
      if (v > 0) {
        br = Math.max(br, smooth(0, 0.5, v) * Math.exp(-Math.max(0, v - 0.5) * 0.75))
        thawed = Math.max(thawed, smooth(0, 0.7, v) * Math.exp(-Math.max(0, v - 0.7) * 0.55))
      }
    }
    G.uBreath.value = br
    G.uThaw.value = 2.9 * thawed
    // focus goes to the glass as it ices, and back to the rock when the hand has cleared it
    W.def = 0.6 * s.k(2, 3.8, 6.2, E.io2) * (1 - s.k(3, WIPE[0] + 0.3, WIPE[1] + 0.9, E.io2))
    G.uDef.value = W.def
    G.uBlurR.value = 0.001 + 0.0045 * W.def
    W.glassOn = b >= 2 && (t2 > BREATH[0] - 0.05 || b > 2)

    if (s.live) {
      const moving = Math.abs(craneY(b, Math.max(t, 0) + 0.05) - craneY(b, Math.max(t, 0))) * 6
      ctx.synth.bed("wind", clamp(0.22 + 0.02 * cy + 0.3 * Math.min(1, moving) + 0.35 * cold))
      if (b === 3) ctx.synth.bed("water", clamp(0.5 * s.k(3, MELT0, MELT0 + 2.5)))
    }
  }

  return {
    cues,
    update,
    warm: () => [
      { scene: world, camera: cam, target: stage },
      { pass: bake, target: ice },
      { pass: blur, target: soft },
      { pass: glass, target: half },
      { pass: comp, target: out },
    ],

    render() {
      const r = ctx.renderer
      if (!baked) {
        bake.render(ice)
        baked = true
      }
      r.setRenderTarget(stage)
      r.render(world, cam)
      POST.exposure = 1 + 0.25 * Math.exp(-W.land * 3) * (W.land > 0 ? 1 : 0)
      POST.bloom = 0.2 + 0.1 * W.frost
      POST.bloomThresh = 0.9
      POST.sat = mix(1.04, 0.9, W.cold)
      // the cold is in the grade, not in a white veil: blue-black shadows, steel highlights, more contrast
      POST.contrast = 1.08 + 0.12 * W.cold
      POST.lift = [0.004 - 0.006 * W.cold, 0.006 - 0.002 * W.cold, 0.013 + 0.01 * W.cold]
      POST.gain = [1 - 0.08 * W.cold, 1 - 0.025 * W.cold, 1 + 0.04 * W.cold]
      POST.vignette = 0.3 + 0.12 * W.frost
      if (W.glassOn) {
        G.tS.value = stage.texture
        blur.render(soft)
        G.tB.value = soft.texture
        G.tI.value = ice.texture
        glass.render(half)
        G.tH.value = half.texture
        comp.render(out)
        ctx.finish(out.texture, POST)
      } else ctx.finish(stage.texture, POST)
    },

    type(g, s) {
      // on ice the type is ink; on rock it is light
      const ink = smooth(0.3, 0.5, W.frost)
      TITLES.color = ink > 0.5 ? "#132030" : "#ffffff"
      TITLES.shadow = ink > 0.5 ? "rgba(240,246,255,0.9)" : "rgba(8,10,16,0.9)"
      titles(g, s, ctx.def, TITLES)
      if (W.selA > 0) g.selbox(W.sel[0], W.sel[1], W.sel[2], W.sel[3], W.selA * (1 - clamp(s.exit * 2)), SELECT)
    },

    labels(s) {
      LBL.length = 0
      for (let i = 0; i < TAGS.length; i++) {
        const T = TAGS[i]
        const a = s.at(T.b) - T.tau
        if (a < 0.4) continue
        const sw = swingJS(a, s.time, tagSeed[i])
        const cs = Math.cos(sw), sn = Math.sin(sw), k = tagS[i]
        const pt = (j: number, lx: number, ly: number) => LC[j].set(T.x + (lx * cs - ly * sn) * k, T.y + (lx * sn + ly * cs) * k, tagPinZ[i])
        pt(0, -TAG_W / 2, PIN_DY)
        pt(1, TAG_W / 2, PIN_DY)
        pt(2, TAG_W / 2, PIN_DY - TAG_H)
        pt(3, -TAG_W / 2, PIN_DY - TAG_H)
        const o = LOUT[i]
        // a tag is meant to be read while the whole of it is in the frame; the crane leaves the old ones below
        let inside = true
        for (let j = 0; j < 4; j++) {
          v0.copy(LC[j]).project(cam)
          if (Math.abs(v0.x) > 0.92 || Math.abs(v0.y) > 0.92) inside = false
        }
        if (!inside) continue
        labelReport(T.a, LC, cam, o)
        LBL.push(LINFO[i])
      }
      return LBL
    },

    hud: () => {
      HUD.color = W.frost > 0.4 ? "#132030" : "#ffffff"
      HUD.shadow = W.frost > 0.4 ? "rgba(240,246,255,0.8)" : "rgba(0,0,0,0.75)"
      return HUD
    },

    dispose() {
      disposeTree(world)
      cube.dispose()
      strip.dispose()
      for (const t of texes) t.dispose()
    },
  }
}
