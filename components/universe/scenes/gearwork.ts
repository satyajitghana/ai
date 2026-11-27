// Scene 16, gearwork: "The sky, as a machine you can hold." The classical age.
//
// Idea. The Antikythera mechanism, twice: as it was found (a calcified green-white lump on a
// museum mount, in cold light) and as it was made (a shoebox of bronze wheels in a wooden case,
// in lamplight, a hand on its crank, agreeing with the Moon in the window).
//
// Staging. One room, one table, one machine built from the published reconstruction: Freeth's
// tooth counts, laid out so every pair really meshes, every angle `phase + rate * years(T)`. So the
// ratios on screen are the true ones: the 223 turns 0.11258 times a year, the Saros pointer four
// turns in 223 months, the Moon pointer 254 times in 19 years. Beat 0: the lump on its mount; the
// first wheel breaks free and sheds its crust a tooth at a time; the fragments come together; the
// crank turns and the Moon crosses the window at the pointer's rate. Beat 1: the lens goes in
// through the top, through a spoke opening of the big wheel, along an arbor (a dolly zoom) to the
// 27 driving the 223, out of the back to the spiral dial; then everything stops and goes green.
//
// Story parameter. `turn`: years of mechanism time, a closed-form integral of the crank's rate.
// World rule. `lit`: a cold key and two oil lamps mixed by `warm`; a surface is filed bronze or
// crust according to one `clean` front per part. Units: centimetres.
//
// What is sourced and what is staging is in R/beats/gearwork.md.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, cross, dFdx, dFdy, Discard, dot, exp, float, floor, Fn, fract, fwidth, If, int, length, Loop, max, min, mix as mixN, normalGeometry, normalize, positionGeometry, pow, reflect, sign, sin, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { makeAim, makeHerd, skinMaterial, solveGrip, type CreatureSpec, type Drive, type GripShape, type Lights } from "../engine/creature"
import * as HM from "../engine/creature/hand"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { titles, wrap, type TitleOpts } from "../engine/titles"
import { fbm, hash21, sampleRT, vnoise, vnoise3, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { MESH_DUR, MESH_IN, MESH_WHEEL } from "../transitions/mesh"

// ---------------------------------------------------------------- the clock and the story parameter

const START = MESH_DUR * (1 - MESH_IN)
const B0 = 15.5 // beat 0's length: the story clock T runs on through it
const T_FREE = 3.0 // the first wheel breaks free
const T_ASM = 5.0 // the fragments come together
const T_CRANK = 9.0 // the hand takes the crank
const T_STOP0 = 24.7, T_STOP1 = 26.3 // the train runs down
/** The crank's rate in years of the mechanism per second: (from, to, change). */
const RAMPS: [number, number, number][] = [[T_FREE, T_FREE + 1.6, 0.02], [T_CRANK, T_CRANK + 1.6, 0.025], [T_STOP0, T_STOP1, -0.045]]
const rateAt = (T: number) => RAMPS.reduce((s, r) => s + r[2] * smooth(r[0], r[1], T), 0)
/** Years turned by T: the integral of the rate (a smoothstep integrates to x^3 - x^4 / 2). */
const yearsAt = (T: number) =>
  RAMPS.reduce((s, r) => {
    if (T <= r[0]) return s
    const x = Math.min(1, (T - r[0]) / (r[1] - r[0]))
    return s + r[2] * ((r[1] - r[0]) * (x * x * x - (x * x * x * x) / 2) + Math.max(0, T - r[1]))
  }, 0)
const YR_END = yearsAt(99)

// ---------------------------------------------------------------- the train
// Tooth counts: Freeth et al. 2006, Supplementary Notes 3, the gear table ("our best fit" column) and
// the trains as they print them (b2-l1+l2-m1+m3-e3+e4-f1+f2-g1 = 64/38 x 53/96 x 27/223 x 188/53 x 30/54).
// m3 (27) and n1 (53) do not survive: the paper's own proposals. e4 is 188 in its train (CT: 187 to 191);
// b1 is "223/224" (224 here, so the opening wheel is not mistaken for the 223).

const TAU = Math.PI * 2
const OY = 16.5 // the b axis above the table: mechanism coordinates are world minus (0, OY, 0)
const CASE = { hw: 9.5, y0: -16.5, y1: 15, hz: 5 } // 19 x 31.5 x 10 (Freeth et al. 2006, "uncertain")
type Ax = { x: number; y: number; w: number }
const WB = -1 // b turns clockwise seen from the front, once a year
const WL = -WB * (64 / 38)
const WM = -WL * (53 / 96)
const WE = -WM * (27 / 223) // 0.11258 turns a year
const WF = -WE * (188 / 53)
const WG = -WF * (30 / 54) // four turns in 223 months
const WN = -WM * (15 / 53) // five turns in 19 years
const WC = -WB * (64 / 38)
const WD = -WC * (48 / 24)
const WE2 = -WD * (127 / 32) // 254 / 19 turns a year: the Moon
const AX: Record<string, Ax> = {
  b: { x: 0, y: 0, w: WB },
  l: { x: 1.72, y: 1.66, w: WL },
  m: { x: -0.6, y: 4.3, w: WM },
  e: { x: 0, y: -1.5, w: WE },
  f: { x: 1.915, y: -6.84, w: WF },
  g: { x: 0, y: -7.3, w: WG },
  n: { x: 0, y: 5.8, w: WN },
  c: { x: -2.246, y: -0.817, w: WC },
  d: { x: -3.73, y: -1.63, w: WD },
  e2: { x: 0, y: -1.5, w: WE2 },
}
type GearDef = { name: string; n: number; ax: string; z: number; th: number; by?: string; rp: number; ph: number }
const GEARS: GearDef[] = [
  { name: "b1", n: 224, ax: "b", z: 2.7, th: 0.27, rp: 0.047 * 112, ph: MESH_WHEEL.rot },
  { name: "b2", n: 64, ax: "b", z: 1.6, th: 0.23, rp: 0, ph: 0 },
  { name: "l1", n: 38, ax: "l", z: 1.6, th: 0.14, by: "b2", rp: 0, ph: 0 },
  { name: "l2", n: 53, ax: "l", z: 0.9, th: 0.14, rp: 0, ph: 0 },
  { name: "m1", n: 96, ax: "m", z: 0.9, th: 0.2, by: "l2", rp: 0, ph: 0 },
  { name: "m2", n: 15, ax: "m", z: 0.2, th: 0.14, rp: 0, ph: 0 },
  { name: "n1", n: 53, ax: "n", z: 0.2, th: 0.14, by: "m2", rp: 0, ph: 0 },
  { name: "m3", n: 27, ax: "m", z: -0.6, th: 0.16, rp: 0, ph: 0 },
  { name: "e3", n: 223, ax: "e", z: -0.6, th: 0.16, by: "m3", rp: 0, ph: 0 },
  { name: "e4", n: 188, ax: "e", z: -2.0, th: 0.14, rp: 0, ph: 0 },
  { name: "f1", n: 53, ax: "f", z: -2.0, th: 0.14, by: "e4", rp: 0, ph: 0 },
  { name: "f2", n: 30, ax: "f", z: -2.7, th: 0.14, rp: 0, ph: 0 },
  { name: "g1", n: 54, ax: "g", z: -2.7, th: 0.14, by: "f2", rp: 0, ph: 0 },
  { name: "c1", n: 38, ax: "c", z: 1.6, th: 0.14, by: "b2", rp: 0, ph: 0 },
  { name: "c2", n: 48, ax: "c", z: 0.9, th: 0.14, rp: 0, ph: 0 },
  { name: "d1", n: 24, ax: "d", z: 0.9, th: 0.14, by: "c2", rp: 0, ph: 0 },
  { name: "d2", n: 127, ax: "d", z: 0.2, th: 0.14, rp: 0, ph: 0 },
  { name: "e2", n: 32, ax: "e2", z: 0.2, th: 0.14, by: "d2", rp: 0, ph: 0 },
]
const GEAR = Object.fromEntries(GEARS.map((g) => [g.name, g]))
// each pair's module from its axes' spacing, and the driven wheel's phase so that tooth meets gap
for (const g of GEARS) {
  if (!g.by) continue
  const a = GEAR[g.by]
  const A = AX[a.ax], Bx = AX[g.ax]
  const dist = Math.hypot(Bx.x - A.x, Bx.y - A.y)
  const mod = (2 * dist) / (a.n + g.n)
  a.rp = (mod * a.n) / 2
  g.rp = (mod * g.n) / 2
  const al = Math.atan2(Bx.y - A.y, Bx.x - A.x)
  g.ph = al + Math.PI - (a.n / g.n) * (a.ph + Math.PI / a.n - al)
}
// the pin-and-slot pair that rides on the 223: two wheels of 50, their axes 1.1 mm apart
const K_R = 2.35, K_OFF = 0.11, K_N = 50, K_RP = K_R / 2
const A1 = { n: 48, rp: 0.047 * 24 } // the crown wheel on the crank's shaft
const CRANK_W = (WB * 224) / 48 // one turn of the crank is 78 days
const CRANK = { x: 12.4, r: 2.5, z: 3.25, knob: 5.6, kr: 0.75 } // where the crank's arm is, its throw, its shaft's depth, the knob's length and radius (the crank is an assumption: only its keyway survives)

// the Saros spiral on the lower back dial: four turns, 223 cells, 51 of them with a glyph
const SAROS = { r0: 2.5, pitch: 0.86, turns: 4, cells: 223 }
const METON = { r0: 1.7, pitch: 0.78, turns: 5, cells: 235 }
const GLYPH: boolean[] = (() => {
  const g: boolean[] = []
  for (let c = 0; c < SAROS.cells; c++) g.push(Math.floor(((c + 0.5) * 38) / 223) !== Math.floor(((c - 0.5) * 38) / 223))
  // (where a lunar and a solar possibility fall a month apart: 13 more, 51 in all)
  let extra = 0
  for (let c = 4; c < SAROS.cells && extra < 13; c++) if (g[c] && !g[c + 1] && c % 3 === 0) { g[c + 1] = true; extra++; c += 12 }
  return g
})()
const STOP_CELL = (() => {
  let c = 96
  while (!GLYPH[c] || GLYPH[c + 1]) c++
  return c
})()
/** The Saros pointer's unwrapped angle along the spiral (0 at its inner end). */
const sarosPsi = (yr: number) => ((STOP_CELL + 0.5) * SAROS.turns * TAU) / SAROS.cells - TAU * Math.abs(WG) * (YR_END - yr)
const metonPsi = (yr: number) => 7.3 * TAU + TAU * Math.abs(WN) * yr
// the Moon's elongation from the Sun: the angle between the two front pointers. Full in the window at T = 11.6.
const D_RATE = TAU * (254 / 19 - 1)
const D0 = Math.PI - D_RATE * yearsAt(11.6)

// the hand on the crank: the toolkit's macro hand (`hand.makeHand`), an overhand power grip solved round the knob,
// which lies across the proximal phalanges of index, middle and ring; the little finger curls past its end
const HAND0 = HM.makeHand({ side: "R" })
const KNOB_HL = { x: 0.093, y: -0.0285, z0: -0.047, z1: 0.019 } // hand-local, before the map (metres)
const GRIP_AT = HAND0.map.p([KNOB_HL.x, KNOB_HL.y, (KNOB_HL.z0 + KNOB_HL.z1) / 2]) as [number, number, number]
const BAR: GripShape = { kind: "capsule", a: HAND0.map.p([KNOB_HL.x, KNOB_HL.y, KNOB_HL.z0]), b: HAND0.map.p([KNOB_HL.x, KNOB_HL.y, KNOB_HL.z1]), r: CRANK.kr / 100 }
const HAND: CreatureSpec = {
  ...HAND0.spec,
  poses: {
    ...HAND0.spec.poses,
    // (the little finger overhangs the knob's end, so nothing stops it: it closes as in a fist, not left half-bent)
    knob: { ...solveGrip(HAND0.spec, BAR, { whole: true, wrap: true, max: [1.6, 1.9, 1.5], maxOf: { thumb: [0.7, 0.9, 1.1] }, pre: { thumb: [0.5, 0.15, 0.65] }, slack: 0.75, gap: 0.0003 }), little: [[1.3, -0.08], [1.7], [1.0]] },
  },
}

const GREEK = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ"

// the window: its wall's depth, and the sky turned so the opening (seen from about where the lens stands in beat 0)
// looks a little over the sea's horizon; the Moon's radius in degrees (drawn larger than its true 0.26 so its phase reads)
const WALL_D = 15
const MOON_R = 0.62
const SKY_ROT = /*@__PURE__*/ (() => {
  const d0 = new THREE.Vector3(-20, 11.25, -45 - WALL_D).sub(new THREE.Vector3(-14, 18.5, 50)).normalize()
  const el = (2.6 * Math.PI) / 180
  const q = new THREE.Quaternion().setFromUnitVectors(d0, new THREE.Vector3(0, Math.sin(el), -Math.cos(el)))
  return new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q))
})()

// ---------------------------------------------------------------- small TSL helpers

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
/** smoothstep whose edges may be nodes and may fall. */
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sat1 = (x: F): F => clampN(x, 0, 1) as F
const isK = (k: F, n: number): F => step(n - 0.5, k).mul(step(k, n + 0.5)) as F
const qrot = (q: V4, v: V3): V3 => v.add(cross(q.xyz, cross(q.xyz, v).add(v.mul(q.w))).mul(2)) as V3

// ---------------------------------------------------------------- geometry: every moving thing is a "part" in one mesh

const NP = 64
const K_BRONZE = 0, K_FRONT = 1, K_BACK = 2, K_WOOD = 3, K_BALL = 4, K_LINEN = 5, K_PIN = 6, K_LUMP = 7
/** Fragment A as found: the stack of wheels sunk in one calcified lump about 3 cm thick, b1 in a dish of crust. */
const LUMP = { z0: 0.95, crumble0: T_FREE + 0.5, crumble1: T_ASM + 0.7 }
type Part = {
  id: number
  name: string
  hp: THREE.Vector3 // assembled, in mechanism coordinates
  hq: THREE.Quaternion
  mp: THREE.Vector3 // as found, on the mount
  mq: THREE.Quaternion
  t0: number // when it leaves the mount
  spin: (yr: number) => number // about its own z
  thr: number // how much of it survives (noise threshold; 0 none)
  crust: number
  c0: number // its crust goes between c0 and c1
  c1: number
  seed: number
  inside: number // 1 for what the case shuts in
  rad: number // its radius (wheels), for the flakes
  pose?: (p: Part, T: number, yr: number, pos: THREE.Vector3, q: THREE.Quaternion) => void
}

function buildParts() {
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], aG: number[] = [], aA: number[] = [], aK: number[] = [], aC: number[] = [], idx: number[] = []
  const parts: Part[] = []
  let cur = 0, kind = K_BRONZE
  const R = rng(223)
  const v = (x: number, y: number, z: number, nx: number, ny: number, nz: number, a: number, cav = 0, u = -1, w = -1) => {
    pos.push(x, y, z)
    nor.push(nx, ny, nz)
    uvs.push(u, w)
    aG.push(cur)
    aA.push(a)
    aK.push(kind)
    aC.push(cav)
    return pos.length / 3 - 1
  }
  const quad = (a: number, b: number, c: number, d: number) => idx.push(a, b, c, a, c, d)
  const part = (name: string, o: Partial<Part> = {}): Part => {
    const p: Part = { id: parts.length, name, hp: new THREE.Vector3(), hq: new THREE.Quaternion(), mp: new THREE.Vector3(), mq: new THREE.Quaternion(), t0: T_ASM, spin: () => 0, thr: 0.62, crust: 1, c0: 5, c1: 7, seed: R() * 40, inside: 1, rad: 0, ...o }
    parts.push(p)
    cur = p.id
    kind = K_BRONZE
    return p
  }
  /** A ring or disc about z: faces at z0 and z1, an outer wall, an inner wall when r0 > 0. */
  const ring = (r0: number, r1: number, z0: number, z1: number, seg: number, cx = 0, cy = 0, sides = 0) => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1)
      const fr = i / seg
      // a square section is a ring of four flat sides
      const k = sides === 4 ? 1 / Math.cos(Math.PI / 4) : 1
      for (const [z, nz] of [[z1, 1], [z0, -1]] as const) quad(v(cx + r0 * c0, cy + r0 * s0, z, 0, 0, nz, fr, 0.3), v(cx + r1 * k * c0, cy + r1 * k * s0, z, 0, 0, nz, fr), v(cx + r1 * k * c1, cy + r1 * k * s1, z, 0, 0, nz, fr), v(cx + r0 * c1, cy + r0 * s1, z, 0, 0, nz, fr, 0.3))
      const am = (a0 + a1) / 2
      const n0 = sides ? [Math.cos(am), Math.sin(am)] : [c0, s0], n1 = sides ? n0 : [c1, s1]
      quad(v(cx + r1 * k * c0, cy + r1 * k * s0, z0, n0[0], n0[1], 0, fr), v(cx + r1 * k * c1, cy + r1 * k * s1, z0, n1[0], n1[1], 0, fr), v(cx + r1 * k * c1, cy + r1 * k * s1, z1, n1[0], n1[1], 0, fr), v(cx + r1 * k * c0, cy + r1 * k * s0, z1, n0[0], n0[1], 0, fr))
      if (r0 > 0.01) quad(v(cx + r0 * c0, cy + r0 * s0, z0, -c0, -s0, 0, fr, 0.6), v(cx + r0 * c1, cy + r0 * s1, z0, -c1, -s1, 0, fr, 0.6), v(cx + r0 * c1, cy + r0 * s1, z1, -c1, -s1, 0, fr, 0.6), v(cx + r0 * c0, cy + r0 * s0, z1, -c0, -s0, 0, fr, 0.6))
    }
  }
  /** A box: centre, size, a turn about z; `face` maps a texture onto its +z (1) or -z (-1) face. */
  const box = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rz = 0, face = 0, fracAxis = 1) => {
    const c = Math.cos(rz), s = Math.sin(rz)
    const P = (x: number, y: number, z: number): [number, number, number] => [cx + (x * c - y * s) * sx * 0.5, cy + (x * s + y * c) * sy * 0.5 * 1, cz + z * sz * 0.5]
    const Pn = (x: number, y: number, z: number): [number, number, number] => [cx + (x * sx * 0.5) * c - (y * sy * 0.5) * s, cy + (x * sx * 0.5) * s + (y * sy * 0.5) * c, cz + z * sz * 0.5]
    void P
    const F6: [number[], number[], number[]][] = [
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    ]
    for (const [n, a, b] of F6) {
      const ids: number[] = []
      for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const q = [n[0] + a[0] * i + b[0] * j, n[1] + a[1] * i + b[1] * j, n[2] + a[2] * i + b[2] * j]
        const w = Pn(q[0], q[1], q[2])
        const fr = fracAxis === 1 ? q[1] * 0.5 + 0.5 : q[0] * 0.5 + 0.5
        const tex = face !== 0 && n[2] === face
        // the back plate is read from behind: its u runs the other way
        ids.push(v(w[0], w[1], w[2], n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2], fr, 0, tex ? (face > 0 ? q[0] * 0.5 + 0.5 : 0.5 - q[0] * 0.5) : -1, tex ? q[1] * 0.5 + 0.5 : -1))
      }
      quad(ids[0], ids[1], ids[2], ids[3])
    }
  }
  /** A wheel with hand-cut triangular teeth: tips and pits rounded, pitch and depth a little uneven. */
  const wheel = (n: number, rp: number, th: number, rin: number, seed: number) => {
    const Rg = rng(seed)
    const p = TAU / n
    const h = Math.min(0.17, 0.84 * p * rp)
    const rr = rp - h / 2
    const out: [number, number, number, number][] = [] // angle, radius, tooth fraction, cavity
    for (let k = 0; k < n; k++) {
      const a0 = k * p + (Rg() - 0.5) * 0.07 * p
      const rt = rp + (h / 2) * (1 + (Rg() - 0.5) * 0.16)
      const fr = k / n
      out.push([a0, rr, fr, 1], [a0 + 0.07 * p, rr + 0.09 * h, fr, 0.8], [a0 + 0.455 * p, rt - 0.07 * h, fr, 0.1], [a0 + 0.5 * p, rt, fr, 0], [a0 + 0.545 * p, rt - 0.07 * h, fr, 0.1], [a0 + 0.93 * p, rr + 0.09 * h, fr, 0.8])
    }
    const z1 = th / 2, z0 = -th / 2
    const M = out.length
    for (let i = 0; i < M; i++) {
      const A = out[i], Bq = out[(i + 1) % M]
      const ax = Math.cos(A[0]) * A[1], ay = Math.sin(A[0]) * A[1], bx = Math.cos(Bq[0]) * Bq[1], by = Math.sin(Bq[0]) * Bq[1]
      const ex = bx - ax, ey = by - ay, el = Math.hypot(ex, ey) || 1
      const nx = ey / el, ny = -ex / el
      const fr = A[2]
      quad(v(ax, ay, z0, nx, ny, 0, fr, A[3]), v(bx, by, z0, nx, ny, 0, fr, Bq[3]), v(bx, by, z1, nx, ny, 0, fr, Bq[3]), v(ax, ay, z1, nx, ny, 0, fr, A[3]))
      const ia = [Math.cos(A[0]) * rin, Math.sin(A[0]) * rin], ib = [Math.cos(Bq[0]) * rin, Math.sin(Bq[0]) * rin]
      for (const [z, nz] of [[z1, 1], [z0, -1]] as const) quad(v(ia[0], ia[1], z, 0, 0, nz, fr, 0.25), v(ax, ay, z, 0, 0, nz, fr, A[3] * 0.7), v(bx, by, z, 0, 0, nz, fr, Bq[3] * 0.7), v(ib[0], ib[1], z, 0, 0, nz, fr, 0.25))
      if (rin > 0.3) quad(v(ia[0], ia[1], z0, -Math.cos(A[0]), -Math.sin(A[0]), 0, fr, 0.5), v(ib[0], ib[1], z0, -Math.cos(Bq[0]), -Math.sin(Bq[0]), 0, fr, 0.5), v(ib[0], ib[1], z1, -Math.cos(Bq[0]), -Math.sin(Bq[0]), 0, fr, 0.5), v(ia[0], ia[1], z1, -Math.cos(A[0]), -Math.sin(A[0]), 0, fr, 0.5))
    }
  }
  const qz = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a)

  // ---- the wheels. As found they lie pressed together in one lump (Fragment A), a little askew.
  const squeeze = (z: number) => 2.7 + (z - 2.7) * 0.2
  GEARS.forEach((g, i) => {
    const A = AX[g.ax]
    const big = g.name === "b1"
    const p = part(g.name, { rad: g.rp, spin: (yr) => g.ph + TAU * A.w * yr, t0: T_ASM + 0.15 + i * 0.09, thr: big ? 0.78 : 0.5 + R() * 0.2, c0: big ? T_FREE - 0.15 : T_ASM + 0.4 + i * 0.12, c1: big ? T_FREE + 2.6 : T_ASM + 2.2 + i * 0.12 })
    p.hp.set(A.x, A.y, g.z)
    p.mp.set(A.x + (big ? 0 : (R() - 0.5) * 0.3), A.y + (big ? 0 : (R() - 0.5) * 0.3), squeeze(g.z))
    if (!big) p.mq.setFromEuler(new THREE.Euler((R() - 0.5) * 0.09, (R() - 0.5) * 0.09, 0))
    if (big) {
      // four spokes, a hub, the stubs of the pillars on the rim
      wheel(g.n, g.rp, g.th, 4.5, 11)
      ring(0.24, 1.15, -g.th / 2, g.th / 2, 28)
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 4
        box(Math.cos(a) * 2.8, Math.sin(a) * 2.8, 0, 3.5, 0.95, g.th * 0.9, a)
        box(Math.cos(a + 0.5) * 4.78, Math.sin(a + 0.5) * 4.78, g.th / 2 + 0.3, 0.5, 0.44, 0.6, a + 0.5)
      }
    } else {
      wheel(g.n, g.rp, g.th, 0.2, 31 + i * 7)
      // a square boss where the wheel sits on its arbor
      ring(0, 0.21, -g.th / 2 - 0.1, g.th / 2 + 0.1, 4, 0, 0, 4)
    }
  })
  // ---- the pair on the 223: positions ride the big wheel, angles from the fixed wheel they run round
  const e3 = GEAR.e3
  const carrier = (yr: number) => e3.ph + TAU * WE * yr + 0.5
  const kPose = (off: number, z: number, wob: number) => (p: Part, _T: number, yr: number, o: THREE.Vector3) => {
    const a = carrier(yr)
    o.set(AX.e.x + Math.cos(a) * (K_R + off), AX.e.y + Math.sin(a) * (K_R + off), z)
    void wob
  }
  const kSpin = (yr: number) => {
    const a = carrier(yr)
    const rel = TAU * WE2 * yr - a // the fixed wheel as the carrier sees it
    return Math.PI - (rel + Math.PI / K_N) + a
  }
  {
    const p5 = part("e5", { spin: (yr) => TAU * WE2 * yr, t0: T_ASM + 1.9, c0: 6.2, c1: 7.6 })
    p5.hp.set(AX.e.x, AX.e.y, -1.1)
    p5.mp.set(AX.e.x, AX.e.y, squeeze(-1.1))
    wheel(K_N, K_RP, 0.14, 0.2, 501)
    const k1 = part("k1", { spin: kSpin, t0: T_ASM + 2.0, c0: 6.3, c1: 7.7, pose: kPose(0, -1.1, 0) })
    k1.hp.set(AX.e.x + K_R, AX.e.y, -1.1)
    k1.mp.set(AX.e.x + K_R, AX.e.y, squeeze(-1.1))
    wheel(K_N, K_RP, 0.14, 0.16, 502)
    ring(0, 0.07, -0.42, 0.07, 8, 0.72, 0) // the pin
    // the second wheel turns on an axis 1.1 mm off: the pin in its slot speeds it and slows it
    const k2 = part("k2", {
      spin: (yr) => {
        const s = kSpin(yr) - carrier(yr)
        return carrier(yr) + s + Math.atan2(K_OFF * Math.sin(s), 0.72 - K_OFF * Math.cos(s)) * -1
      },
      t0: T_ASM + 2.1, c0: 6.4, c1: 7.8, pose: kPose(K_OFF, -1.45, 1),
    })
    k2.hp.set(AX.e.x + K_R + K_OFF, AX.e.y, -1.45)
    k2.mp.set(AX.e.x + K_R, AX.e.y, squeeze(-1.45))
    wheel(K_N, K_RP, 0.14, 0.16, 503)
    box(0.72, 0, 0.09, 0.5, 0.2, 0.05) // the slot's cheeks
    box(0.72, 0.17, 0.11, 0.56, 0.06, 0.08)
    box(0.72, -0.17, 0.11, 0.56, 0.06, 0.08)
  }
  // ---- arbors: square where a wheel sits, round between (ISAW Papers 4)
  const ARB: [string, number, number][] = [["b", 5.2, -0.2], ["l", 2.0, 0.5], ["m", 1.3, -1.0], ["e", 0.6, -3.1], ["f", -1.6, -3.1], ["g", -2.3, -4.9], ["n", 0.6, -4.9], ["c", 2.0, 0.5], ["d", 1.3, -0.2]]
  ARB.forEach(([ax, z1, z0], i) => {
    const A = AX[ax]
    const p = part("arbor-" + ax, { spin: (yr) => TAU * A.w * yr, t0: T_ASM + 0.5 + i * 0.08, thr: 0, c0: T_ASM + 1 + i * 0.1, c1: T_ASM + 2.4 + i * 0.1 })
    p.hp.set(A.x, A.y, 0)
    p.mp.set(A.x, A.y, 2.7 - (2.7 - (z0 + z1) / 2) * 0.2 - (z0 + z1) / 2)
    ring(0, 0.13, z0, z1, 10)
    ring(0.13, 0.26, z1 - 0.12, z1, 10) // a collar
  })
  // ---- the crank: a crown wheel on a shaft through the right side, an arm, a knob
  const crankQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) // local z along world x
  {
    const p = part("crank", { spin: (yr) => TAU * CRANK_W * yr, t0: T_ASM + 2.5, thr: 0.0, c0: 7.2, c1: 8.4, inside: 0 })
    p.hp.set(GEAR.b1.rp + 0.12, 0, CRANK.z)
    p.hq.copy(crankQ)
    p.mp.set(15, -9, 1.5)
    p.mq.copy(crankQ).multiply(qz(1.1))
    wheel(A1.n, A1.rp, 0.16, 0.2, 77)
    const zOut = CRANK.x - p.hp.x
    ring(0, 0.2, 0, zOut, 10)
    box(CRANK.r / 2, 0, zOut, CRANK.r + 0.6, 0.55, 0.22) // the arm
    ring(0, CRANK.kr, zOut, zOut + CRANK.knob, 16, CRANK.r, 0) // the knob
    ring(0, CRANK.kr + 0.16, zOut + CRANK.knob - 0.22, zOut + CRANK.knob, 16, CRANK.r, 0)
  }
  // ---- pointers on the front: the Sun's and the Moon's, and the little half-silvered ball that shows the phase
  const sunA = (yr: number) => Math.PI / 2 + TAU * WB * yr
  const moonA = (yr: number) => sunA(yr) - (D0 + D_RATE * yr) // the dial reads clockwise, so east of the Sun is a smaller angle
  {
    const s = part("sun", { spin: sunA, t0: 8.5, thr: 0, c0: 8.5, c1: 9.2, inside: 0, crust: 0.3 })
    s.hp.set(0, 0, 4.95)
    s.mp.set(-8, -12, 1.5)
    box(3.0, 0, 0, 6.6, 0.3, 0.07)
    box(6.2, 0, 0.05, 0.5, 0.5, 0.07, Math.PI / 4)
    ring(0, 0.5, -0.05, 0.06, 14)
    const m = part("moon", { spin: moonA, t0: 8.6, thr: 0, c0: 8.6, c1: 9.3, inside: 0, crust: 0.3 })
    m.hp.set(0, 0, 5.12)
    m.mp.set(-6, -13, 1.5)
    box(2.5, 0, 0, 5.4, 0.24, 0.07)
    ring(0, 0.62, -0.05, 0.06, 14)
    ring(0.3, 0.42, 0.05, 0.14, 14, 1.9, 0)
    const b = part("ball", {
      spin: () => 0, t0: 8.6, thr: 0, crust: 0, inside: 0,
      pose: (_p, _T, yr, o, q) => {
        const a = moonA(yr)
        o.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 5.2)
        // the white half faces the reader at full Moon
        q.setFromAxisAngle(_Y, D0 + D_RATE * yr + Math.PI)
      },
    })
    b.hp.set(1.9, 0, 5.2)
    b.mp.set(-6, -13, 1.5)
    kind = K_BALL
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 16; j++) {
        const P2 = (ii: number, jj: number) => {
          const th = (ii / 10) * Math.PI, ph = (jj / 16) * TAU
          const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]
          return v(n[0] * 0.29, n[1] * 0.29, n[2] * 0.29, n[0], n[1], n[2], 0)
        }
        quad(P2(i, j), P2(i, j + 1), P2(i + 1, j + 1), P2(i + 1, j))
      }
  }
  // ---- pointers on the back: each carries a pin that rides its spiral's groove, so it reads longer every turn
  const spiralPtr = (name: string, ax: string, S: typeof SAROS, psi: (yr: number) => number, sgn: number, a0: number) => {
    const A = AX[ax]
    const ang = (yr: number) => a0 + sgn * psi(yr)
    const p = part(name, { spin: ang, t0: 7.0, thr: 0, c0: 7.2, c1: 8.2, inside: 0, crust: 0.3 })
    p.hp.set(A.x, A.y, -4.95)
    p.mp.set(9 + A.y * 0.2, -11, 1.5)
    const L = S.r0 + S.pitch * S.turns + 0.3
    box(L / 2 - 0.3, 0.13, 0, L + 0.6, 0.07, 0.07)
    box(L / 2 - 0.3, -0.13, 0, L + 0.6, 0.07, 0.07)
    box(L, 0, 0, 0.1, 0.33, 0.07)
    ring(0, 0.46, -0.06, 0.06, 14)
    const s = part(name + "-pin", {
      spin: ang, t0: 7.0, thr: 0, c0: 7.2, c1: 8.2, inside: 0, crust: 0.3,
      pose: (_p, _T, yr, o) => {
        const r = S.r0 + (S.pitch * psi(yr)) / TAU
        const a = ang(yr)
        o.set(A.x + Math.cos(a) * r, A.y + Math.sin(a) * r, -4.99)
      },
    })
    s.hp.set(A.x + 3, A.y, -4.99)
    s.mp.copy(p.mp)
    box(0, 0, 0, 0.5, 0.4, 0.09)
    ring(0, 0.07, -0.02, 0.2, 8) // the pin, down into the groove
    box(0.32, 0, 0, 0.16, 0.1, 0.09, 0) // the index
  }
  // seen from behind the picture is mirrored: the spirals wind the way the pointers turn
  spiralPtr("saros", "g", SAROS, sarosPsi, Math.sign(WG), 0.4)
  spiralPtr("meton", "n", METON, metonPsi, Math.sign(WN), 1.1)
  // ---- plates. Of each only a piece survives.
  {
    const cy = (CASE.y0 + CASE.y1) / 2, hgt = CASE.y1 - CASE.y0
    const fp = part("front", { t0: 7.9, thr: 0.42, c0: 8.0, c1: 9.3, inside: 0, seed: 3.1 })
    fp.hp.set(0, cy, 4.6)
    fp.mp.set(-14.5, 1.5, 1.2)
    fp.mq.copy(qz(0.22))
    kind = K_FRONT
    box(0, 0, 0, CASE.hw * 2, hgt, 0.2, 0, 1)
    const bp = part("back", { t0: 6.7, thr: 0.44, c0: 6.9, c1: 8.3, inside: 0, seed: 9.4 })
    bp.hp.set(0, cy, -4.6)
    bp.mp.set(14.5, 0.5, 1.2)
    bp.mq.setFromAxisAngle(_Y, Math.PI).multiply(qz(0.17))
    kind = K_BACK
    box(0, 0, 0, CASE.hw * 2, hgt, 0.2, 0, -1)
    // ---- the wooden case: two sides, a floor and a lid (a sliver of it survives)
    const wood = (name: string, t0: number, hp: [number, number, number], s: [number, number, number], mp: [number, number, number]) => {
      const w = part(name, { t0, thr: 0, crust: 0.25, c0: t0 + 0.2, c1: t0 + 1.3, inside: 0 })
      w.hp.set(...hp)
      w.mp.set(...mp)
      w.mq.copy(qz((R() - 0.5) * 0.6))
      kind = K_WOOD
      box(0, 0, 0, s[0], s[1], s[2])
      return w
    }
    wood("floor", 6.2, [0, CASE.y0 + 0.35, 0], [CASE.hw * 2 + 1.4, 0.7, CASE.hz * 2 + 0.6], [-9, -15.2, 1.4])
    wood("left", 6.9, [-CASE.hw - 0.35, cy, 0], [0.7, hgt, CASE.hz * 2 + 0.6], [-19, -8, 1.4])
    wood("right", 7.1, [CASE.hw + 0.35, cy, 0], [0.7, hgt, CASE.hz * 2 + 0.6], [20, -9, 1.4])
    const lid = wood("lid", 8.3, [0, CASE.y1 + 0.35, 0], [CASE.hw * 2 + 1.4, 0.7, CASE.hz * 2 + 0.6], [6, -15.6, 1.4])
    // beat 1: the lid is slid back, and the lens goes in over it
    lid.pose = (p, T, _yr, o) => {
      // (sideways in its grooves, out of the lens's way: it comes in over the top and leaves over the back)
      o.x -= 23 * smooth(B0 + 0.1, B0 + 1.7, T)
      o.y += 0.25 * Math.sin(Math.PI * smooth(B0 + 0.1, B0 + 1.7, T))
      void p
    }
  }
  // ---- the mount: a linen-covered board and the clear pins the pieces stand on. It is pushed back to the wall.
  {
    const away = (p: Part, T: number, _yr: number, o: THREE.Vector3) => {
      const k = E.io3(clamp((T - T_ASM + 0.3) / 1.7))
      o.z -= 44 * k
      o.x += 44 * k // clear of the window
      void p
    }
    const bd = part("board", { t0: 99, thr: 2, crust: 0, inside: 0, pose: away })
    bd.hp.set(0, 0, 0)
    bd.mp.set(0, -1.5, 0.35)
    kind = K_LINEN
    box(0, 0, 0, 56, 30, 0.7)
    const pins = part("pins", { t0: 99, thr: 2, crust: 0, inside: 0, pose: away })
    pins.mp.set(0, 0, 0)
    kind = K_PIN
    for (const [x, y] of [[-4.1, -4.4], [4.3, -4.2], [0, 5.6], [-14.5, -4.5], [-12.5, 6], [14.5, -5.5], [13, 7], [-9, -13.6], [6, -14], [-19, -8], [20, -9]]) ring(0, 0.16, 0.7, 1.35, 8, x, y)
  }

  // ---- the lump: an irregular cake of corrosion and sea lime round the wheels. Front: a raised, cracked rim
  // round b1 and a lower floor between its spokes, where the wheels under it show; sides: the broken section,
  // layered; back: flat on the pins. It crumbles away as the pieces lift.
  {
    const p = part("lump", { t0: 99, thr: 1.5, crust: 1, c0: 99, c1: 100, inside: 0, seed: 17.3 })
    p.mp.set(0, 0, 0)
    kind = K_LUMP
    const NA = 120, NF = 16, NW = 7
    const Rl = rng(4242)
    const ph = Array.from({ length: 8 }, () => Rl() * TAU)
    const outline = (a: number) => {
      let r = 7.3 + 0.95 * Math.sin(2 * a + ph[0]) + 0.55 * Math.sin(3 * a + ph[1]) + 0.32 * Math.sin(5 * a + ph[2]) + 0.16 * Math.sin(9 * a + ph[3]) + 0.08 * Math.sin(17 * a + ph[4])
      // a straight break across the upper right, where Fragment A parted from the rest
      const cut = 6.1 / Math.max(0.2, Math.cos(a - 0.75))
      r = Math.min(r, cut + 0.3 * Math.sin(7 * a))
      return Math.max(5.95, r)
    }
    const zFront = (r: number, a: number, R: number) => {
      const n = 0.12 * Math.sin(3 * a + ph[5] + r * 0.9) + 0.08 * Math.sin(7 * a + ph[6] - r * 1.7) + 0.05 * Math.sin(13 * a + r * 3.1)
      const floor = 2.05 + n // between the spokes: the lower wheels' teeth break through it
      const rim = 2.66 + 0.14 * Math.sin(2 * a + ph[7]) + n * 1.3 // a raised lip of crust round the big wheel, up to its face
      const k = smooth(4.7, 5.6, r)
      const edge = smooth(R - 1.6, R, r) // and down to the broken edge
      return mix(floor, rim, k) - edge * edge * 1.1
    }
    // grid of positions: rows 0..NF on the front (centre to outline), NF+1..NF+NW down the side, then the back
    const rows: [number, number, number][][] = []
    for (let i = 0; i <= NF; i++) {
      const row: [number, number, number][] = []
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * TAU, R = outline(a), r = R * Math.pow(i / NF, 0.8)
        row.push([Math.cos(a) * r, Math.sin(a) * r, zFront(r, a, R)])
      }
      rows.push(row)
    }
    for (let i = 1; i <= NW; i++) {
      const row: [number, number, number][] = []
      const t = i / NW
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * TAU, R = outline(a)
        const zt = zFront(R, a, R)
        // the section bulges a little and is ragged in layers
        const bul = 0.25 * Math.sin(Math.PI * t) + 0.07 * Math.sin(t * 19 + a * 5)
        const r = R + bul
        row.push([Math.cos(a) * r, Math.sin(a) * r, mix(zt, LUMP.z0, t)])
      }
      rows.push(row)
    }
    {
      const row: [number, number, number][] = []
      for (let j = 0; j < NA; j++) row.push([0, 0, LUMP.z0])
      rows.push(row)
    }
    const NRw = rows.length
    const at = (i: number, j: number) => rows[Math.max(0, Math.min(NRw - 1, i))][((j % NA) + NA) % NA]
    const nrm = (i: number, j: number): [number, number, number] => {
      const a = at(i + 1, j), b = at(i - 1, j), c = at(i, j + 1), d = at(i, j - 1)
      const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - d[0], c[1] - d[1], c[2] - d[2]]
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
      // rows run outward then down: the cross product points out of the lump on the front; the back faces -z
      if (i === 0) n = [0, 0, 1]
      if (i >= NRw - 1) n = [0, 0, -1]
      const l = Math.hypot(n[0], n[1], n[2]) || 1
      return [n[0] / l, n[1] / l, n[2] / l]
    }
    const ids: number[][] = rows.map((row, i) => row.map((q, j) => {
      const n = nrm(i, j)
      return v(q[0], q[1], q[2], n[0], n[1], n[2], j / NA, i > NF && i < NRw - 1 ? 0.2 : 0)
    }))
    for (let i = 0; i < NRw - 1; i++) for (let j = 0; j < NA; j++) quad(ids[i][j], ids[i + 1][j], ids[i + 1][(j + 1) % NA], ids[i][(j + 1) % NA])
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute("aG", new THREE.Float32BufferAttribute(aG, 1))
  geo.setAttribute("aA", new THREE.Float32BufferAttribute(aA, 1))
  geo.setAttribute("aK", new THREE.Float32BufferAttribute(aK, 1))
  geo.setAttribute("aC", new THREE.Float32BufferAttribute(aC, 1))
  geo.setIndex(idx)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
  return { geo, parts, tris: idx.length / 3 }
}
const _Y = /*@__PURE__*/ new THREE.Vector3(0, 1, 0)
const _Z = /*@__PURE__*/ new THREE.Vector3(0, 0, 1)
const _X = /*@__PURE__*/ new THREE.Vector3(1, 0, 0)

// ---------------------------------------------------------------- the engraved plates (Greek capitals as script: seeded letters, no words)

const PX_F = 80, PX_B = 108 // texels per centimetre
function paintFront(c: CanvasRenderingContext2D, w: number, h: number) {
  const R = rng(150)
  const X = (x: number) => (x / (CASE.hw * 2) + 0.5) * w, Y = (y: number) => ((CASE.y1 - y) / (CASE.y1 - CASE.y0)) * h
  const s = PX_F
  c.fillStyle = "#000"
  c.fillRect(0, 0, w, h)
  c.strokeStyle = c.fillStyle = "#fff"
  c.textAlign = "center"
  c.textBaseline = "middle"
  const circle = (r: number, lw: number) => {
    c.lineWidth = lw
    c.beginPath()
    c.arc(X(0), Y(0), r * s, 0, TAU)
    c.stroke()
  }
  const tick = (a: number, r0: number, r1: number, lw: number) => {
    c.lineWidth = lw
    c.beginPath()
    c.moveTo(X(Math.cos(a) * r0), Y(Math.sin(a) * r0))
    c.lineTo(X(Math.cos(a) * r1), Y(Math.sin(a) * r1))
    c.stroke()
  }
  const arcText = (r: number, a0: number, n: number, size: number, step: number) => {
    c.font = `600 ${size}px "Times New Roman", Times, serif`
    for (let i = 0; i < n; i++) {
      const a = a0 - i * step
      c.save()
      c.translate(X(Math.cos(a) * r), Y(Math.sin(a) * r))
      c.rotate(Math.PI / 2 - a)
      c.fillText(GREEK[Math.floor(R() * 24)], 0, 0)
      c.restore()
    }
  }
  // the zodiac scale: 360 divisions in twelve signs; outside it the movable calendar ring of 365 days, a hole under each day
  for (const r of [4.75, 5.55, 5.85, 5.95, 6.75, 7.05]) circle(r, r > 5.8 && r < 6 ? 3 : 6)
  for (let i = 0; i < 360; i++) tick((i / 360) * TAU, 5.55, i % 30 === 0 ? 4.75 : i % 10 === 0 ? 5.25 : i % 5 === 0 ? 5.36 : 5.44, i % 30 === 0 ? 5 : 2)
  for (let i = 0; i < 365; i++) {
    const a = Math.PI / 2 - (i / 365) * TAU
    tick(a, 5.95, i % 30 === 0 ? 6.75 : i % 5 === 0 ? 6.2 : 6.1, i % 30 === 0 ? 3 : 1.6)
    c.beginPath()
    c.arc(X(Math.cos(a + 0.0086) * 6.9), Y(Math.sin(a + 0.0086) * 6.9), 2.2, 0, TAU)
    c.fill()
  }
  for (let k = 0; k < 12; k++) {
    const a = Math.PI / 2 - ((k + 0.5) / 12) * TAU
    const n = 5 + Math.floor(R() * 4)
    arcText(5.02, a + (n - 1) * 0.027, n, 26, 0.054)
    arcText(6.47, a + (n - 2) * 0.023, n - 1, 22, 0.046)
    // key letters on the scale, which the lists above and below answer to
    arcText(5.7, a + 0.2, 1, 13, 0)
    arcText(5.7, a - 0.12, 1, 13, 0)
  }
  // a rosette of turned circles at the hub
  for (const r of [0.75, 0.85, 3.1]) circle(r, 2)
  // the star calendar: lines of capitals, scriptio continua, above and below the dials
  const lines = (y0: number, y1: number, x0: number, x1: number, size: number) => {
    c.font = `600 ${size}px "Times New Roman", Times, serif`
    for (let y = y0; y > y1; y -= (size * 1.5) / s) {
      const end = x1 - R() * 2.2
      for (let x = x0; x < end; x += (size * 0.82) / s) {
        if (R() < 0.04) continue
        c.fillText(GREEK[Math.floor(R() * 24)], X(x), Y(y))
      }
    }
  }
  lines(14.2, 7.9, -8.6, 8.8, 15)
  lines(-8.0, -15.9, -8.6, 8.8, 15)
  c.lineWidth = 2
  c.strokeRect(X(-9.1), Y(14.6), 18.2 * s, 6.9 * s)
  c.strokeRect(X(-9.1), Y(-7.6), 18.2 * s, 8.6 * s)
}
function paintBack(c: CanvasRenderingContext2D, w: number, h: number) {
  const R = rng(205)
  // (drawn as the reader behind the case sees it: x runs the other way)
  const X = (x: number) => (0.5 - x / (CASE.hw * 2)) * w, Y = (y: number) => ((CASE.y1 - y) / (CASE.y1 - CASE.y0)) * h
  const s = PX_B
  c.fillStyle = "#000"
  c.fillRect(0, 0, w, h)
  c.strokeStyle = c.fillStyle = "#fff"
  c.textAlign = "center"
  c.textBaseline = "middle"
  const spiral = (ax: Ax, S: typeof SAROS, sgn: number, a0: number, glyphs: boolean[] | null) => {
    const at = (psi: number, dr: number): [number, number] => {
      const r = S.r0 + (S.pitch * psi) / TAU + dr
      const a = a0 + sgn * psi
      return [X(ax.x + Math.cos(a) * r), Y(ax.y + Math.sin(a) * r)]
    }
    // the groove the pin rides in, and the scale's outer line one turn out
    c.lineWidth = 4.2
    c.beginPath()
    for (let i = 0; i <= S.turns * 240; i++) {
      const q = at((i / 240) * TAU, 0)
      if (i) c.lineTo(q[0], q[1])
      else c.moveTo(q[0], q[1])
    }
    c.stroke()
    c.lineWidth = 2
    c.beginPath()
    for (let i = 0; i <= 240; i++) {
      const q = at(((S.turns - 1) * 240 + i) / 240 * TAU, S.pitch)
      if (i) c.lineTo(q[0], q[1])
      else c.moveTo(q[0], q[1])
    }
    c.stroke()
    const cell = (S.turns * TAU) / S.cells
    for (let k = 0; k <= S.cells; k++) {
      const a = at(k * cell, 0.04), b = at(k * cell, S.pitch - 0.04)
      c.lineWidth = 1.8
      c.beginPath()
      c.moveTo(a[0], a[1])
      c.lineTo(b[0], b[1])
      c.stroke()
      if (k === S.cells) break
      const psi = (k + 0.5) * cell
      const ang = a0 + sgn * psi
      const put = (dr: number, size: number, n: number) => {
        const q = at(psi, dr)
        c.save()
        c.translate(q[0], q[1])
        // upright to someone reading round the dial, from behind
        c.rotate(Math.PI / 2 + ang * -1 + Math.PI)
        c.scale(-1, 1)
        c.font = `600 ${size}px "Times New Roman", Times, serif`
        let str = ""
        for (let i = 0; i < n; i++) str += GREEK[Math.floor(R() * 24)]
        c.fillText(n === 0 ? (R() < 0.6 ? "Σ" : "Η") : str, 0, 0)
        c.restore()
      }
      if (glyphs) {
        // an eclipse possibility: Σ for the Moon, Η for the Sun, and an index letter under it
        if (glyphs[k]) {
          put(S.pitch * 0.6, 34, 0)
          put(S.pitch * 0.26, 17, 1)
        }
      } else {
        put(S.pitch * 0.62, 17, 2 + Math.floor(R() * 2))
        if (R() < 0.3) put(S.pitch * 0.3, 15, 1)
      }
    }
    // the little dial inside
    c.lineWidth = 2.4
    for (const [dx, r, n] of [[-0.95, 0.8, glyphs ? 3 : 4]] as const) {
      const cx = X(ax.x + dx), cy = Y(ax.y - 0.2)
      c.beginPath()
      c.arc(cx, cy, r * s, 0, TAU)
      c.stroke()
      for (let i = 0; i < n; i++) {
        c.beginPath()
        c.moveTo(cx, cy)
        c.lineTo(cx + Math.cos((i / n) * TAU + 0.5) * r * s, cy + Math.sin((i / n) * TAU + 0.5) * r * s)
        c.stroke()
      }
    }
  }
  spiral(AX.g, SAROS, Math.sign(WG), 0.4, GLYPH)
  spiral(AX.n, METON, Math.sign(WN), 1.1, null)
  // the lettered margins beside the dials
  c.font = `600 17px "Times New Roman", Times, serif`
  for (const [x0, x1, y0, y1] of [[-9.1, -6.4, 14.5, 9.8], [6.4, 9.1, 14.5, 9.8], [-9.1, -6.6, -0.2, -2.2], [6.6, 9.1, -0.2, -2.2], [-9.1, -6.4, -11.5, -16.2], [6.4, 9.1, -11.5, -16.2]])
    for (let y = y0; y > y1; y -= 26 / s)
      for (let x = x0; x < x1 - R() * 0.8; x += 14.5 / s) {
        if (R() < 0.05) continue
        c.save()
        c.translate(X(x), Y(y))
        c.scale(-1, 1)
        c.fillText(GREEK[Math.floor(R() * 24)], 0, 0)
        c.restore()
      }
}

// ---------------------------------------------------------------- the camera's path

type Key = { t: number; p: [number, number, number]; l: [number, number, number]; fov: number; stop?: boolean }
const mech = (x: number, y: number, z: number): [number, number, number] => [x, y + OY, z]
function buildKeys(): Key[] {
  // the opening frame is the transition's last: the four-spoked wheel, full frame
  const hF = (GEAR.b1.rp + 0.07) / MESH_WHEEL.r
  const dist = hF / (2 * Math.tan((30 * Math.PI) / 360))
  const ox = -(MESH_WHEEL.cx - 0.5) * hF * (16 / 9), oy = OY - (MESH_WHEEL.cy - 0.5) * hF
  // where a spoke opening of the big wheel will be when the lens goes through it
  const T_THRU = B0 + 4.9
  const b1 = GEAR.b1
  let op = b1.ph + TAU * WB * yearsAt(T_THRU) + Math.PI / 4
  while (op < 0.2) op += Math.PI / 2
  while (op > 0.2 + Math.PI / 2) op -= Math.PI / 2
  const th: [number, number] = [Math.cos(op) * 3.2, Math.sin(op) * 3.2]
  const mm: [number, number, number] = [AX.m.x + ((AX.e.x - AX.m.x) * GEAR.m3.rp) / 5.83, AX.m.y + ((AX.e.y - AX.m.y) * GEAR.m3.rp) / 5.83, -0.6]
  return [
    { t: -START - 0.4, p: [ox, oy, 2.7 + dist], l: [ox, oy, 2.7], fov: 30, stop: true },
    { t: 1.0, p: [ox, oy, 2.7 + dist - 0.9], l: [ox, oy, 2.7], fov: 30 },
    { t: 2.7, p: [ox - 1.6, oy + 0.6, 2.7 + dist + 6], l: [ox - 1.0, oy - 0.1, 2.7], fov: 30 },
    { t: 5.0, p: [-17, 21.5, 52], l: [-3.5, 15.2, 1], fov: 30 },
    { t: 9.0, p: [-22, 17.5, 63], l: [-9, 15.2, 0], fov: 30, stop: true },
    { t: 12.5, p: [-12, 18.5, 46], l: [-2.6, 16.1, 4], fov: 30, stop: true },
    { t: B0, p: [-9, 22.5, 40], l: [-2.4, 19, 3], fov: 30 },
    { t: B0 + 1.9, p: [3.4, 45, 9.5], l: [2.6, 31, 3.5], fov: 32 },
    { t: B0 + 2.8, p: [2.9, 36, 3.95], l: [2.6, 24, 3.2], fov: 34 },
    { t: B0 + 3.6, p: mech(th[0] * 1.15, 8.4, 3.75), l: mech(th[0], th[1] + 1.2, 3.1), fov: 36 },
    { t: B0 + 4.5, p: mech(th[0] * 1.04, th[1] + 1.6, 3.5), l: mech(th[0] * 0.8, th[1] * 0.7, 1.9), fov: 38 },
    { t: T_THRU, p: mech(th[0], th[1], 2.72), l: mech(1.2, 1.1, 1.6), fov: 38 },
    { t: B0 + 5.7, p: mech(2.0, 0.72, 2.14), l: mech(1.08, 1.04, 1.6), fov: 30, stop: true },
    { t: B0 + 6.6, p: mech(4.4, 6.7, 1.28), l: mech(-0.6, 4.3, 0.5), fov: 22 },
    { t: B0 + 8.1, p: mech(1.3, 5.1, -0.24), l: mech(...mm), fov: 50, stop: true },
    // out the way a hand would go: down behind the wheels, up between them and the back plate, over its top edge
    { t: B0 + 8.7, p: mech(3.6, 3.0, -3.45), l: mech(1.0, -2.8, -1.0), fov: 44 },
    { t: B0 + 9.25, p: mech(3.0, 10.5, -2.7), l: mech(0.4, 2.0, 0.4), fov: 40 },
    { t: B0 + 9.8, p: mech(2.8, 21, -7.8), l: mech(1.2, 4, -6.2), fov: 36 },
    { t: B0 + 10.6, p: mech(3.4, -3.2, -17), l: mech(0.4, -7.0, -4.6), fov: 31 },
    { t: B0 + 11.3, p: mech(3.0, -5.3, -19), l: mech(0.4, -7.0, -4.6), fov: 30, stop: true },
    { t: B0 + 16.5, p: mech(5.6, -3.4, -31), l: mech(0.2, -5.4, -4.6), fov: 30 },
  ]
}

export function create(ctx: Ctx): SceneInstance {
  const built = buildParts()
  const parts = built.parts
  const LUMP_ID = parts.findIndex((p) => p.name === "lump")
  const KEYS = buildKeys()

  // ---------------------------------------------------------------- uniforms: the world rule's inputs

  const LAMPS = [new THREE.Vector3(-15, 9.6, 12.5), new THREE.Vector3(12.5, 4.3, -13.5)]
  const U = {
    cam: uniform(new THREE.Vector3()),
    fwd: uniform(new THREE.Vector3(0, 0, -1)),
    warm: uniform(0), // 0 the museum's cold light, 1 lamplight
    flick: uniform(1),
    green: uniform(0), // the patina coming back at the end
    time: uniform(0),
    caseOn: uniform(0), // the case throws a shadow once it stands
    lamp0: uniform(LAMPS[0].clone()),
    lamp1: uniform(LAMPS[1].clone()),
    sky: uniform(new THREE.Vector4(0, 0, 0, 0)), // the Moon's place in the window (x, y), its elongation, the stars' drift
    dust: uniform(0),
    top: uniform(0), // the lid is off: light falls into the case
    clock: uniform(0), // the story clock, for what is thrown and falls
  }
  const aP = Array.from({ length: NP }, () => new THREE.Vector4()) // position, clean front
  const aQ = Array.from({ length: NP }, () => new THREE.Vector4(0, 0, 0, 1))
  const aS = Array.from({ length: NP }, () => new THREE.Vector4()) // crust, survives, occlusion, seed
  const uP = uniformArray(aP, "vec4"), uQ = uniformArray(aQ, "vec4"), uS = uniformArray(aS, "vec4")

  const COLD = vec3(0.93, 0.96, 1.0).mul(1.55)
  const COLD_DIR = vec3(-0.5, 0.62, 0.6).normalize()
  const LAMPC = vec3(1.0, 0.56, 0.22)
  const WIN = vec3(-20, 11, -52) // the window's middle
  const SKY_M = uniform(SKY_ROT)
  const TOP_DIR = vec3(0.12, 0.93, 0.34).normalize()

  type Lit = { diff: V3; spec: (pw: number) => V3; aniso: (T: V3, pw: number) => V3; env: (R: V3) => V3 }
  /** The world rule: what light reaches a point with this normal. */
  const lightAt = (P: V3, N: V3, V: V3, shadow?: F, inside?: F): Lit => {
    // inside the case light comes down from the open top: less of it the deeper a wheel sits
    const occ = inside ? inside.mul(mixN(float(0.86), float(0.25), sstep(OY - 9, OY + 15, P.y))).oneMinus() : float(1)
    const cold = COLD.mul(U.warm.mul(-0.93).add(1)).mul(occ)
    const lamp = (Lp: V3) => {
      const d = Lp.sub(P)
      const dl = length(d)
      return { L: d.div(dl) as V3, col: LAMPC.mul(U.warm).mul(U.flick).mul(float(520).div(dl.mul(dl).add(60))).mul(occ) as V3 }
    }
    const a = lamp(U.lamp0 as unknown as V3), b = lamp(U.lamp1 as unknown as V3)
    const sh = shadow ?? float(1)
    const amb = mixN(vec3(0.19, 0.195, 0.21), vec3(0.022, 0.02, 0.028), U.warm).mul(N.y.mul(0.35).add(0.75))
    // moonlight from the window, a little
    const moon = vec3(0.34, 0.42, 0.56).mul(max(dot(N, normalize(WIN.sub(P))), 0)).mul(U.warm.mul(0.22).add(0.1).add(U.green.mul(0.5)))
    // lamplight thrown back down by the ceiling, into the open case
    const top = LAMPC.mul(U.top).mul(1.5)
    const diff = cold.mul(max(dot(N, COLD_DIR), 0)).add(a.col.mul(max(dot(N, a.L), 0)).mul(sh)).add(b.col.mul(max(dot(N, b.L), 0))).add(top.mul(max(dot(N, TOP_DIR), 0))).add(amb.mul(occ)).add(moon.mul(occ)) as V3
    const spec = (pw: number): V3 => {
      const hl = (L: V3) => pow(max(dot(N, normalize(L.add(V))), 0), pw)
      return cold.mul(hl(COLD_DIR as V3)).add(a.col.mul(hl(a.L)).mul(sh)).add(b.col.mul(hl(b.L))).add(top.mul(hl(TOP_DIR as V3))) as V3
    }
    /** Turned or brushed metal: the highlight is a streak across the tool marks. */
    const aniso = (T: V3, pw: number): V3 => {
      const hl = (L: V3) => {
        const th = dot(T, normalize(L.add(V)))
        return pow(max(th.mul(th).oneMinus(), 0), pw).mul(sat1(dot(N, L).mul(3) as F))
      }
      return cold.mul(hl(COLD_DIR as V3)).mul(0.4).add(a.col.mul(hl(a.L))).add(b.col.mul(hl(b.L))).add(top.mul(hl(TOP_DIR as V3))) as V3
    }
    /** What polished metal sees of the room: the lamps as soft lobes, the museum's ceiling, the window. */
    const env = (R: V3): V3 => {
      const lobe = (Lp: V3) => pow(max(dot(R, normalize(Lp.sub(P))), 0), 26).mul(7).add(pow(max(dot(R, normalize(Lp.sub(P))), 0), 3).mul(0.5))
      const room = mixN(vec3(0.34, 0.38, 0.44), vec3(0.05, 0.036, 0.03), U.warm).mul(R.y.mul(0.5).add(0.6))
      const ceil = cold.mul(pow(max(R.y, 0), 2.5)).mul(0.9)
      const win = vec3(0.16, 0.24, 0.42).mul(pow(max(dot(R, normalize(WIN.sub(P))), 0), 60)).mul(3)
      return room.add(ceil).add(win).add(LAMPC.mul(U.warm).mul(U.flick).mul(lobe(U.lamp0 as unknown as V3).add(lobe(U.lamp1 as unknown as V3)))).mul(occ).add(top.mul(pow(max(dot(R, TOP_DIR), 0), 5)).mul(1.6)) as V3
    }
    return { diff, spec, aniso, env }
  }
  const depthOf = (P: V3): F => dot(P.sub(U.cam), U.fwd) as F
  /** Relief from a height field: tilt the normal by the height's slope across the pixel. */
  const bump = (P: V3, N: V3, h: F, k: number): V3 => {
    const sx = dFdx(P).toVar(), sy = dFdy(P).toVar()
    const r1 = cross(sy, N), r2 = cross(N, sx)
    const det = dot(sx, r1).toVar()
    const g = r1.mul(dFdx(h)).add(r2.mul(dFdy(h)))
    return normalize(N.mul(abs(det)).sub(g.mul(sign(det)).mul(k))) as V3
  }

  // ---------------------------------------------------------------- the parts' material

  const texF = canvasTex(Math.round(CASE.hw * 2 * PX_F), Math.round((CASE.y1 - CASE.y0) * PX_F), paintFront)
  const texB = canvasTex(Math.round(CASE.hw * 2 * PX_B), Math.round((CASE.y1 - CASE.y0) * PX_B), paintBack)
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const scene = new THREE.Scene()
  const partMat = new THREE.NodeMaterial()
  {
    const gi = int(attribute("aG", "float").add(0.5))
    const P4 = uP.element(gi) as unknown as V4
    const Q4 = uQ.element(gi) as unknown as V4
    const S4 = uS.element(gi) as unknown as V4
    const aA = attribute("aA", "float") as unknown as F
    const world = Fn(() => {
      // crust stands proud of the metal, lumpy, and fills the gaps between teeth
      const cleanV = sstep(aA, aA.add(0.012), P4.w as F)
      const lump = vnoise3(positionGeometry.mul(2.4).add(S4.w)).mul(0.11).add(vnoise3(positionGeometry.mul(9).add(S4.w)).mul(0.03)).add(0.015)
      const lp = positionGeometry.add(normalGeometry.mul(lump.mul(S4.x).mul(cleanV.oneMinus())))
      return P4.xyz.add(qrot(Q4, lp as V3)).add(vec3(0, OY, 0))
    })()
    partMat.vertexNode = viewProj.mul(vec4(world, 1))
    const vW = world.toVarying() as unknown as V3
    const vN = qrot(Q4, normalGeometry as unknown as V3).toVarying() as unknown as V3
    const vL = positionGeometry.toVarying() as unknown as V3
    const vLn = normalGeometry.toVarying() as unknown as V3
    const vA = aA.toVarying() as unknown as F
    // the direction a tool ran in: round a wheel, along a plate
    const vT = qrot(Q4, mixN(vec3(positionGeometry.y.negate(), positionGeometry.x, 0), vec3(1, 0, 0), step(0.5, attribute("aK", "float"))) as unknown as V3).toVarying() as unknown as V3
    const vK = attribute("aK", "float").toVarying() as unknown as F
    const vC = attribute("aC", "float").toVarying() as unknown as F
    const vS = S4.toVarying() as unknown as V4
    const vFront = P4.w.toVarying() as unknown as F
    const vUV = uvAttr().toVarying() as unknown as V2
    partMat.fragmentNode = Fn(() => {
      // what the sea left: the rest is gone
      const plate = isK(vK, K_FRONT).add(isK(vK, K_BACK)).toVar()
      // (a plate breaks into a few big pieces, a wheel into bites)
      // (the lump goes from its broken edge inward, in crumbs)
      const lumpK = isK(vK, K_LUMP)
      const crumb = length(vL.xy).mul(0.11).add(vnoise3(vL.mul(4.5).add(1.3)).mul(0.22)).sub(0.3).mul(lumpK)
      Discard(vnoise3(vL.mul(mixN(float(0.42), float(0.14), plate)).add(vS.w)).add(vnoise3(vL.mul(1.9).add(vS.w)).mul(0.1)).add(crumb).greaterThan(vS.y))
      const Ng = normalize(vN).toVar()
      const V = normalize(U.cam.sub(vW)).toVar()
      const metal = isK(vK, K_BRONZE).add(plate).toVar()
      // ---- engraving, on the plates: the cut is dark, its lower lip catches the light
      const tx = 1 / 1600
      const eF = texture(texF, vUV).r, eF2 = texture(texF, vUV.add(vec2(-tx, tx))).r
      const eB = texture(texB, vUV).r, eB2 = texture(texB, vUV.add(vec2(tx * 0.8, tx * 0.8))).r
      const onF = isK(vK, K_FRONT).mul(step(0, vUV.x)), onB = isK(vK, K_BACK).mul(step(0, vUV.x))
      const cut = eF.mul(onF).add(eB.mul(onB)).toVar()
      const lip = eF.sub(eF2).mul(onF).add(eB.sub(eB2).mul(onB)).toVar()
      // ---- is the crust off here yet? A front runs round each wheel, tooth by tooth.
      const rag = vnoise(vL.xy.mul(7).add(vS.w)).sub(0.5).mul(0.02)
      const clean = sstep(0, 0.012, vFront.sub(vA).add(rag)).toVar()
      // ---- crust: its lumps, warped so nothing lines up with the metal under it
      const wq = vL.xy.mul(0.8).add(vec2(vnoise(vL.xy.mul(1.6).add(vS.w)), vnoise(vL.yx.mul(1.6).add(3.1))).mul(1.3)).add(vL.z.mul(0.6)).toVar()
      const g0 = fbm(wq.add(vS.w)).toVar()
      const g1 = fbm(wq.mul(3.4).add(11.3)).toVar()
      // detail is faded out by its footprint: a pattern finer than about two pixels would only shimmer (moire in the macro)
      const fpx = length(fwidth(vL)).toVar()
      const aa = (freq: number): F => sstep(0.45, 0.12, fpx.mul(freq) as F)
      const fine = vnoise3(vL.mul(24)).sub(0.5).mul(aa(24)).add(0.5).toVar()
      // and at the end the green comes back, pits and cuts first
      const back = sstep(1.05, 1.3, vC.mul(0.4).add(cut.mul(0.45)).add(g0.mul(0.8)).add(U.green.mul(1.45)) as F).toVar()
      clean.mulAssign(back.oneMinus())
      // ---- filed bronze (low-tin: redder than brass)
      const r = length(vL.xy)
      const face = abs(vLn.z).mul(isK(vK, K_BRONZE)).add(plate).toVar()
      // turning marks on the faces, kept only while each ring spans 20 px or more: finer, they beat against the
      // pixel grid and the lens blur turned that into a lattice of blobs across the faces in macro
      const turn = sin(r.mul(64)).mul(sstep(0.32, 0.08, fwidth(r.mul(64)))).mul(face).mul(plate.oneMinus())
      const file = vnoise(vec2(vL.z.mul(60), atan(vL.y, vL.x).mul(r).mul(9))).sub(0.5).mul(aa(60)).mul(face.oneMinus()).mul(isK(vK, K_BRONZE)) // file strokes across the flanks
      const brush = vnoise(vec2(vL.x.mul(4), vL.y.mul(120))).sub(0.5).mul(aa(120)).mul(plate)
      // (a single value noise on diagonal axes drew a diamond lattice on the faces in macro: fbm turns each octave)
      const wq2 = vec2(vL.x.mul(0.8).sub(vL.y.mul(0.6)), vL.x.mul(0.6).add(vL.y.mul(0.8))).mul(3.3).add(vL.z.mul(2)).add(2.2)
      const wear = fbm(vL.xy.mul(1.3).add(vS.w)).mul(0.7).add(fbm(wq2).sub(0.5).mul(0.3).add(0.22))
      const F0 = vec3(0.8, 0.45, 0.21).mul(wear.mul(0.34).add(0.74)).mul(turn.mul(0.12).add(file.mul(0.3)).add(brush.mul(0.2)).add(1)).toVar()
      // oil and dirt in the pits between teeth and round the hubs; the cut letters filled dark
      F0.mulAssign(mixN(float(1), float(0.22), vC.mul(vC).mul(0.8)))
      F0.assign(mixN(F0, vec3(0.035, 0.022, 0.015), cut.mul(0.9)))
      const hCr = fbm(wq.yx.mul(1.7).add(31.7)).mul(0.11).add(vnoise3(vL.mul(11).add(5.5)).mul(aa(11)).mul(0.03)).add(fine.mul(0.022)).add(vnoise3(vL.mul(70)).mul(aa(70)).mul(0.01))
      const N = bump(vW, Ng as V3, hCr.mul(clean.mul(metal).oneMinus()).mul(sat1(vS.x.mul(3) as F)).mul(mixN(float(1), float(0.12), back)) as F, 0.8).toVar()
      N.assign(normalize(N.add(Ng.mul(turn.mul(0.03))).add(vec3(lip, lip.negate(), 0).mul(0.7).mul(clean))))
      const lit = lightAt(vW, N as V3, V as V3, undefined, vS.z)
      const Rv = reflect(V.negate(), N)
      const fres = pow(sat1(dot(N, V).oneMinus() as F), 4)
      const envc = lit.env(Rv as V3).toVar()
      const bright = F0.mul(envc.mul(0.55).add(lit.spec(70).mul(0.6)).add(lit.aniso(normalize(vT) as V3, 22).mul(face).mul(0.55)).add(lit.diff.mul(mixN(float(0.13), float(0.42), plate)))).add(envc.mul(fres).mul(0.2)).add(lit.diff.mul(max(lip, 0)).mul(0.3))
      // cuprite brown-black under grey-green under white calcite, a little bright malachite
      // (after the photographs of Fragment A: dark olive and brown-black, tan where the lime sits, a little bright green)
      const cr = mixN(vec3(0.075, 0.1, 0.075), vec3(0.2, 0.235, 0.17), g1).toVar()
      cr.assign(mixN(cr, vec3(0.06, 0.04, 0.03), sstep(0.5, 0.3, g0).mul(0.9)))
      cr.assign(mixN(cr, vec3(0.07, 0.27, 0.17), sstep(0.6, 0.8, vnoise3(vL.mul(3.1).add(7))).mul(0.36)))
      cr.assign(mixN(cr, vec3(0.5, 0.43, 0.3), sstep(0.62, 0.9, g0.mul(0.55).add(g1.mul(0.6))).mul(0.8)))
      cr.mulAssign(fine.mul(0.3).add(0.82))
      cr.mulAssign(mixN(float(1), float(0.5), cut.mul(0.7)))
      // ---- Fragment A's own lump: laid down in layers over two thousand years, cracked as it dried, and
      // where it is broken across, the wheels inside show in section as thin dark bands with their teeth
      const isL = isK(vK, K_LUMP).toVar()
      If(isL.greaterThan(0.5), () => {
        const side = sstep(0.75, 0.35, abs(vLn.z) as F).toVar()
        const zz = vL.z.add(g0.sub(0.5).mul(0.22)).add(vnoise(vL.xy.mul(0.7)).sub(0.5).mul(0.18)).toVar()
        const band = fract(zz.mul(3.1)).toVar()
        const lime = sstep(0.55, 0.75, band).mul(sstep(1.0, 0.85, band)).toVar()
        // calcite pale and chalky, cuprite red-brown, a thin dark seam between each layer
        cr.assign(mixN(cr, vec3(0.42, 0.38, 0.29).mul(fine.mul(0.4).add(0.75)), lime.mul(side).mul(0.75)))
        cr.assign(mixN(cr, vec3(0.16, 0.07, 0.04), sstep(0.3, 0.42, band).mul(sstep(0.52, 0.42, band)).mul(side).mul(0.6)))
        cr.mulAssign(sstep(0.0, 0.05, band).mul(side).mul(0.55).oneMinus())
        // teeth in section: at the depths the wheels lie, a row of small triangles of dark metal
        const ang = atan(vL.y, vL.x)
        const sec = float(0).toVar()
        for (const [zb, n] of [[2.7, 224], [2.38, 64], [2.24, 96], [2.08, 223], [1.86, 188], [1.62, 54]] as const) {
          const tri = abs(fract(ang.mul(n / TAU)).sub(0.5)).mul(2)
          const dz = abs(vL.z.sub(zb)).div(0.075)
          sec.assign(max(sec, step(dz, tri.oneMinus().mul(0.8).add(0.2)).mul(sstep(0.3, 1.0, side))))
        }
        cr.assign(mixN(cr, vec3(0.05, 0.075, 0.055).add(vec3(0.07, 0.03, 0.01).mul(g1)), sec.mul(0.85)))
        // cracks: shrinkage lines on the face, deeper where they cross
        const cq = vL.xy.mul(0.55).add(vec2(vnoise(vL.xy.mul(1.1).add(3.3)), vnoise(vL.yx.mul(1.1).add(9.1))).mul(0.9))
        const c1 = abs(vnoise(cq.add(vS.w)).sub(0.5)), c2 = abs(vnoise(cq.mul(2.3).add(5.7)).sub(0.5))
        const crack = max(sstep(0.035, 0.008, c1 as F), sstep(0.03, 0.006, c2 as F).mul(0.6))
        cr.mulAssign(crack.mul(0.85).oneMinus())
        // more green on the lump's face than in the cracks: malachite blooms
        // (Fragment A is mostly dark olive and brown-black, with tan lime and only a little bright green)
        const grit = fbm(vL.xy.mul(1.35).add(vS.w.add(4.1))).toVar()
        const tan = sstep(0.58, 0.74, grit as F).mul(sstep(0.45, 0.62, vnoise(vL.xy.mul(0.6).add(2.9)) as F))
        const lumpC = mixN(mixN(vec3(0.045, 0.038, 0.026), vec3(0.1, 0.095, 0.06), grit), vec3(0.36, 0.31, 0.22), tan.mul(0.8)).mul(fine.mul(0.5).add(0.75))
        cr.assign(mixN(cr, lumpC, side.oneMinus().mul(0.78)))
        // the floor between the spokes lies in the shadow of the rim and the wheel
        cr.mulAssign(mixN(float(0.45), float(1), sstep(1.95, 2.6, vL.z as F)).mul(side.oneMinus()).add(side))
        cr.assign(mixN(cr, vec3(0.06, 0.2, 0.14).mul(g1.add(0.5)), sstep(0.7, 0.86, vnoise3(vL.mul(1.4).add(2.2))).mul(side.oneMinus()).mul(0.3)))
      })
      // (the green that comes back is a thin skin, not a crust)
      cr.assign(mixN(cr, vec3(0.23, 0.3, 0.2).mul(g1.mul(0.8).add(0.6)).mul(mixN(float(1), float(0.35), cut)), back.mul(0.85)))
      const dull = cr.mul(lit.diff).add(lit.spec(14).mul(0.015))
      const col = mixN(dull, bright, clean.mul(metal)).toVar()
      // ---- the things that are not bronze
      If(metal.add(isL).lessThan(0.5), () => {
        const flat = lightAt(vW, Ng as V3, V as V3, undefined, vS.z)
        // wood: boxwood boards, grain along their length
        const g = vnoise(vec2(vL.x.mul(0.6).add(vL.z.mul(0.9)), vL.y.mul(11).add(vL.z.mul(7)))).mul(0.6).add(vnoise(vec2(vL.x.mul(3), vL.y.mul(60).add(vL.z.mul(50)))).mul(0.4))
        const wood = mixN(vec3(0.13, 0.065, 0.03), vec3(0.36, 0.2, 0.09), g).mul(mixN(float(0.5), float(1), clean))
        // the board: grey linen, and the shadow the big wheel throws on it
        const weave = sin(vW.x.mul(46)).mul(sin(vW.y.mul(46))).mul(0.05).add(0.95)
        const bq = vW.xy.sub(vec2(0.7, OY - 0.8))
        const shade = sstep(0.9, 0.0, abs(length(bq).sub(4.95)) as F).mul(0.5).add(sstep(1.9, 0.6, length(bq)).mul(0.5))
        const linen = vec3(0.27, 0.262, 0.25).mul(weave).mul(shade.mul(0.6).oneMinus())
        const ball = mixN(vec3(0.02, 0.02, 0.025), vec3(0.92, 0.9, 0.84), step(0, vLn.z))
        const alb = wood.mul(isK(vK, K_WOOD)).add(linen.mul(isK(vK, K_LINEN))).add(ball.mul(isK(vK, K_BALL))).add(vec3(0.5, 0.58, 0.62).mul(isK(vK, K_PIN)))
        col.assign(alb.mul(flat.diff).add(flat.spec(30).mul(isK(vK, K_PIN).mul(0.5).add(isK(vK, K_BALL).mul(0.25)).add(0.02))))
      })
      // dust settling on every upward face
      col.assign(mixN(col, vec3(0.5, 0.5, 0.48).mul(lit.diff), U.dust.mul(sat1(N.y as F)).mul(0.5)))
      return vec4(col, depthOf(vW))
    })()
    partMat.side = THREE.DoubleSide
  }
  const partMesh = new THREE.Mesh(built.geo, partMat)
  partMesh.frustumCulled = false
  scene.add(partMesh)

  // ---------------------------------------------------------------- the room: a table by a window, two lamps

  const room = new THREE.Group()
  scene.add(room)
  const R_TABLE = 0, R_WALL = 1, R_CLAY = 2, R_STONE = 3, R_TIMBER = 4
  const roomGeo = (() => {
    const pos: number[] = [], nor: number[] = [], kd: number[] = [], idx: number[] = []
    const quadP = (a: number[], b: number[], c: number[], d: number[], n: number[], k: number) => {
      const o = pos.length / 3
      pos.push(...a, ...b, ...c, ...d)
      for (let i = 0; i < 4; i++) {
        nor.push(...n)
        kd.push(k)
      }
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
    }
    quadP([-110, 0, 110], [110, 0, 110], [110, 0, -45], [-110, 0, -45], [0, 1, 0], R_TABLE)
    // the wall behind, a thick rubble-and-ashlar wall with the window cut through it: the opening splays
    // inward (wider on the room side, as a deep window does), stone in the reveals, a timber lintel, a stone sill
    const wx0 = -34, wx1 = -6, wy0 = 1.5, wy1 = 21, Z = -45 // the room side of the opening
    const ox0 = -30.5, ox1 = -9.5, oy0 = 4, oy1 = 18.5, OZ = Z - WALL_D // the outer side
    quadP([-110, 0, Z], [wx0, 0, Z], [wx0, 70, Z], [-110, 70, Z], [0, 0, 1], R_WALL)
    quadP([wx1, 0, Z], [110, 0, Z], [110, 70, Z], [wx1, 70, Z], [0, 0, 1], R_WALL)
    quadP([wx0, 0, Z], [wx1, 0, Z], [wx1, wy0, Z], [wx0, wy0, Z], [0, 0, 1], R_WALL)
    quadP([wx0, wy1, Z], [wx1, wy1, Z], [wx1, 70, Z], [wx0, 70, Z], [0, 0, 1], R_WALL)
    const qn = (a: number[], b: number[], c: number[], d: number[], k: number) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
      const l = Math.hypot(n[0], n[1], n[2])
      quadP(a, b, c, d, [n[0] / l, n[1] / l, n[2] / l], k)
    }
    qn([wx0, wy0, Z], [ox0, oy0, OZ], [ox1, oy0, OZ], [wx1, wy0, Z], R_STONE) // the sill's slope
    qn([wx0, wy0, Z], [wx0, wy1, Z], [ox0, oy1, OZ], [ox0, oy0, OZ], R_STONE) // left jamb
    qn([wx1, wy0, Z], [ox1, oy0, OZ], [ox1, oy1, OZ], [wx1, wy1, Z], R_STONE) // right jamb
    qn([wx0, wy1, Z], [wx1, wy1, Z], [ox1, oy1, OZ], [ox0, oy1, OZ], R_STONE) // the soffit
    // a stone sill standing proud of the wall, and a timber lintel over the opening
    const slab = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, k: number) => {
      qn([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], k)
      qn([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], k)
      qn([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], k)
      qn([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], k)
      qn([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], k)
    }
    slab(wx0 - 2.5, wx1 + 2.5, wy0 - 1.6, wy0, Z, Z + 3.2, R_STONE)
    slab(wx0 - 4, wx1 + 4, wy1, wy1 + 3.4, Z, Z + 1.6, R_TIMBER)
    // one board shutter, folded back flat against the wall beside the opening
    slab(wx1 + 0.4, wx1 + 11.4, wy0 + 0.6, wy1 - 0.4, Z, Z + 0.9, R_TIMBER)
    // the other walls, far off in the dark
    quadP([-110, 0, 110], [-110, 0, Z], [-110, 70, Z], [-110, 70, 110], [1, 0, 0], R_WALL)
    quadP([110, 0, Z], [110, 0, 110], [110, 70, 110], [110, 70, Z], [-1, 0, 0], R_WALL)
    quadP([110, 0, 110], [-110, 0, 110], [-110, 70, 110], [110, 70, 110], [0, 0, -1], R_WALL)
    // two clay lamps (wheel-made bowls with a nozzle), one on a stand
    const lathe = (cx: number, cy: number, cz: number, prof: [number, number][], seg: number, sx = 1) => {
      for (let i = 0; i < prof.length - 1; i++)
        for (let j = 0; j < seg; j++) {
          const a0 = (j / seg) * TAU, a1 = ((j + 1) / seg) * TAU
          const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]
          const sl = Math.atan2(r0 - r1, y1 - y0)
          const P3 = (r: number, y: number, a: number) => [cx + Math.cos(a) * r * sx, cy + y, cz + Math.sin(a) * r]
          const am = (a0 + a1) / 2
          quadP(P3(r0, y0, a0), P3(r0, y0, a1), P3(r1, y1, a1), P3(r1, y1, a0), [Math.cos(am) * Math.cos(sl), Math.sin(sl), Math.sin(am) * Math.cos(sl)], R_CLAY)
        }
    }
    const bowl: [number, number][] = [[0.1, -2.1], [1.5, -2.1], [2.5, -1.3], [2.6, -0.7], [1.9, -0.2], [0.8, -0.1], [0.7, -0.5], [0.1, -0.6]]
    for (const L of LAMPS) {
      lathe(L.x - 2.2, L.y - 0.4, L.z, bowl, 14)
      lathe(L.x - 0.6, L.y - 0.9, L.z, [[0.1, -0.6], [0.75, -0.6], [0.8, 0], [0.45, 0.25], [0.2, 0.1]], 8, 2.2) // the nozzle
      const base = L.y - 2.5
      if (base > 0.5) lathe(L.x - 2.2, 0, L.z, [[2.6, 0], [2.4, 0.5], [0.7, 1.1], [0.55, base - 0.8], [1.9, base - 0.2], [2.0, base]], 12)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute("aK", new THREE.Float32BufferAttribute(kd, 1))
    g.setIndex(idx)
    return g
  })()
  {
    const m = new THREE.NodeMaterial()
    const vW = positionGeometry.toVarying() as unknown as V3
    const vN = normalGeometry.toVarying() as unknown as V3
    const vK = attribute("aK", "float").toVarying() as unknown as F
    m.fragmentNode = Fn(() => {
      const P = vW
      const N = normalize(vN).toVar()
      const V = normalize(U.cam.sub(P)).toVar()
      // the case's shadow from the lamp in front: is the ray to the lamp inside the box?
      const o = P.sub(vec3(0, OY + (CASE.y0 + CASE.y1) / 2, 0))
      const d = (U.lamp0 as unknown as V3).sub(P)
      const bx = vec3(CASE.hw + 0.7, (CASE.y1 - CASE.y0) / 2, CASE.hz + 0.3)
      const inv = vec3(1).div(d)
      const t1 = bx.negate().sub(o).mul(inv), t2 = bx.sub(o).mul(inv)
      const tn = max(max(min(t1.x, t2.x), min(t1.y, t2.y)), min(t1.z, t2.z))
      const tf = min(min(max(t1.x, t2.x), max(t1.y, t2.y)), max(t1.z, t2.z))
      const hit = step(tn, tf).mul(step(0, tf)).mul(step(tn, 1))
      const sh = mixN(float(1), sstep(0.0, 0.25, tn.sub(tf).add(0.25) as F), hit.mul(U.caseOn)).toVar()
      // contact: darker close under the case
      const under = sstep(9, 0, length(max(abs(P.xz).sub(vec2(CASE.hw, CASE.hz)), 0))).mul(sstep(6, 0, P.y)).mul(U.caseOn)
      const lit = lightAt(P, N as V3, V as V3, sh as F)
      // an oak table: boards along x, pores, a waxed sheen; a limewashed wall; fired clay
      const bd = floor(P.z.div(11.5))
      const g = vnoise(vec2(P.x.mul(0.16).add(bd.mul(7.7)), P.z.mul(2.1))).mul(0.6).add(vnoise(vec2(P.x.mul(1.2), P.z.mul(26))).mul(0.4)).toVar()
      const gap = sstep(0.1, 0.02, abs(fract(P.z.div(11.5)).sub(0.5)).oneMinus().sub(0.5) as F)
      const table = mixN(vec3(0.16, 0.085, 0.04), vec3(0.4, 0.24, 0.12), g).mul(hash21(vec2(bd, 3)).mul(0.25).add(0.8)).mul(gap.mul(0.7).oneMinus())
      const wall = vec3(0.52, 0.5, 0.46).mul(fbm(P.xy.mul(0.09)).mul(0.5).add(0.6)).mul(vnoise(P.xy.mul(2.3)).mul(0.14).add(0.9))
      const clay = vec3(0.56, 0.27, 0.15).mul(vnoise3(P.mul(2.2)).mul(0.3).add(0.8))
      // dressed limestone in the reveals and the sill: courses, blocks, mortar, chisel texture, a little soot
      const ny = abs(N.y)
      const sc = mixN(mixN(vec2(P.z, P.y), vec2(P.x, P.y), sstep(0.5, 0.7, abs(N.z) as F)), vec2(P.x, P.z), sstep(0.6, 0.8, ny as F)).toVar()
      const course = floor(sc.y.div(4.2))
      const bxs = sc.x.div(7.5).add(hash21(vec2(course, 1.3)).mul(0.7))
      const blk = vec2(floor(bxs), course)
      const jt = min(abs(fract(bxs).sub(0.5)).oneMinus().sub(0.5).mul(7.5), abs(fract(sc.y.div(4.2)).sub(0.5)).oneMinus().sub(0.5).mul(4.2))
      const mortar = sstep(0.25, 0.06, jt as F)
      const stoneC = mixN(vec3(0.5, 0.45, 0.36), vec3(0.62, 0.57, 0.47), hash21(blk)).mul(vnoise(sc.mul(1.7)).mul(0.25).add(0.82)).mul(vnoise(sc.mul(9)).mul(0.16).add(0.88))
      const stone = mixN(stoneC, vec3(0.3, 0.27, 0.22), mortar.mul(0.8))
      // oak, adzed: grain along the beam or board, darker with age and smoke
      const tg = vnoise(vec2(P.x.mul(0.5).add(P.y.mul(0.1)), P.y.mul(7).add(P.z.mul(5)))).mul(0.6).add(vnoise(vec2(P.x.mul(2.5), P.y.mul(40))).mul(0.4))
      const timber = mixN(vec3(0.07, 0.04, 0.022), vec3(0.2, 0.12, 0.06), tg).mul(sstep(0.04, 0.0, abs(fract(P.x.div(3.7)).sub(0.5)).oneMinus().sub(0.5) as F).mul(0.5).oneMinus())
      const alb = table.mul(isK(vK, R_TABLE)).add(wall.mul(isK(vK, R_WALL))).add(clay.mul(isK(vK, R_CLAY))).add(stone.mul(isK(vK, R_STONE))).add(timber.mul(isK(vK, R_TIMBER)))
      const sheen = lit.spec(26).mul(isK(vK, R_TABLE)).mul(g.mul(0.1).add(0.03))
      const col = alb.mul(lit.diff).mul(under.mul(0.6).oneMinus()).add(sheen)
      return vec4(col, depthOf(P))
    })()
    m.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(roomGeo, m)
    mesh.frustumCulled = false
    room.add(mesh)
  }
  // ---- the window: a night over the sea, seen through the wall. Shaded by direction, so the stars are at
  // infinity; turned so the opening frames the southern sky a few degrees over the horizon (the room is a model's
  // size, and a true horizon would sit at the window's head). Stars by magnitude (most of them faint, a few bright,
  // white to orange), dimmed and reddened near the horizon and scintillating there; the Milky Way faint; the Moon
  // where the pointer says, with the phase it says and earthshine on its dark limb; its path on the water.
  {
    const m = new THREE.NodeMaterial()
    const vW = positionGeometry.toVarying() as unknown as V3
    const DEG = 180 / Math.PI
    m.fragmentNode = Fn(() => {
      const d0 = normalize(vW.sub(U.cam))
      const d = SKY_M.mul(d0).toVar()
      const el = d.y.asin().mul(DEG).toVar()
      const az = atan(d.x, d.z.negate()).mul(DEG).toVar()
      const s = vec2(az, el).toVar()
      const fp = max(length(fwidth(s)), 0.004).toVar() // degrees per pixel
      const full = cos(U.sky.z).negate().mul(0.5).add(0.5).toVar() // 1 at full Moon
      const mo = U.sky.xy
      const toMoon = length(s.sub(mo)).toVar()
      const moonUp = sstep(-0.6, 0.4, mo.y as F)
      // ---- the air: deep blue-black overhead, paler toward the horizon, lit blue round a bright Moon
      const hz = sstep(9, 0, el as F)
      const sky = mixN(vec3(0.0035, 0.0045, 0.009), vec3(0.011, 0.013, 0.02), hz).toVar()
      sky.addAssign(vec3(0.007, 0.011, 0.02).mul(full.mul(full)).mul(moonUp).mul(exp(toMoon.mul(-0.09)).mul(0.8).add(0.3)))
      sky.addAssign(vec3(0.035, 0.045, 0.065).mul(full).mul(moonUp).mul(exp(toMoon.mul(-1.1))))
      // ---- the stars, turned with the year about the southern pole under the sea
      const a = U.sky.w
      const rel = s.sub(vec2(0, -36))
      const rq = vec2(rel.x.mul(cos(a)).sub(rel.y.mul(sin(a))), rel.x.mul(sin(a)).add(rel.y.mul(cos(a)))).toVar()
      const ext = exp(float(-0.07).div(max(sin(max(el, 0.3).div(DEG)), 0.005))).toVar() // extinction by airmass
      const twinkle = sin(U.time.mul(9.3).add(rq.x.mul(53))).mul(sin(U.time.mul(6.1).add(rq.y.mul(71)))).mul(sstep(6, 0, el as F)).mul(0.45).add(1)
      const stars = vec3(0).toVar()
      const layer = (cellDeg: number, p: number, m0: number, m1: number, salt: number) => {
        const g = rq.div(cellDeg).add(salt)
        const cell = floor(g)
        const h = hash21(cell)
        const sp = fract(g).sub(vec2(hash21(cell.add(7.1)), hash21(cell.add(3.3))).mul(0.8).add(0.1)).mul(cellDeg)
        const mag = mixN(float(m0), float(m1), pow(hash21(cell.add(5.9)), 0.45))
        const flux = pow(float(10), mag.mul(-0.4)).mul(step(p, h))
        // a point spread over at least a pixel, its total kept: a faint star is dim, never aliased away
        const sg = max(float(0.022), fp.mul(0.55))
        const psf = exp(dot(sp, sp).div(sg.mul(sg)).mul(-0.5)).mul(float(0.022).div(sg).pow(2))
        const bv = hash21(cell.add(1.7))
        const col = mixN(mixN(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.97, 0.9), sstep(0.1, 0.5, bv as F)), vec3(1.0, 0.72, 0.45), sstep(0.7, 1.0, bv as F))
        stars.addAssign(col.mul(flux).mul(psf))
      }
      layer(1.5, 0.5, 0.2, 3.2, 0.0)
      layer(0.5, 0.3, 3.0, 5.6, 17.0)
      sky.addAssign(stars.mul(ext).mul(twinkle).mul(mixN(vec3(1), vec3(1.0, 0.62, 0.38), ext.oneMinus())).mul(6).mul(float(1).sub(full.mul(moonUp).mul(0.25))))
      // ---- the Milky Way: a faint band of unresolved light with a dark rift down it
      const mw = rq.y.mul(0.94).sub(rq.x.mul(0.34)).sub(14).toVar()
      const cloud = fbm(rq.mul(0.16).add(3.1)).toVar()
      const band = exp(mw.mul(mw).mul(-1 / 70)).mul(cloud.mul(1.2).add(0.2)).mul(sstep(0.4, 0.75, fbm(rq.mul(0.5).add(8.2)) as F).mul(0.5).add(0.5))
      const rift = sstep(1.4, 0.2, abs(mw.add(cloud.sub(0.5).mul(3))) as F).mul(0.7)
      sky.addAssign(vec3(0.011, 0.012, 0.016).mul(band).mul(rift.oneMinus()).mul(ext).mul(float(1).sub(full.mul(moonUp).mul(0.5))))
      // ---- the Moon: a lit ball, the Sun's direction from the elongation, earthshine on the rest
      const mq = s.sub(mo).div(MOON_R).toVar()
      const r2 = dot(mq, mq).toVar()
      const D = U.sky.z
      If(r2.lessThan(1), () => {
        const n = vec3(mq.x, mq.y, sqrt(r2.oneMinus()))
        const L = vec3(sin(D), 0, cos(D).negate())
        // the maria as the Moon shows them (dark seas upper right and centre, bright highlands south), and craters
        const mare = sstep(0.42, 0.25, length(mq.sub(vec2(0.25, 0.3))) as F).add(sstep(0.32, 0.16, length(mq.sub(vec2(-0.25, 0.2))) as F)).add(sstep(0.22, 0.1, length(mq.sub(vec2(0.05, -0.05))) as F).mul(0.6))
        const alb = sat1(mare.mul(0.5).add(vnoise(mq.mul(5.2).add(4.2)).sub(0.5).mul(0.35)) as F).mul(-0.42).add(1).mul(vnoise(mq.mul(17)).mul(0.12).add(0.88))
        const cosI = dot(n, L)
        const lit = sstep(-0.03, 0.08, cosI as F).mul(max(cosI, 0).mul(0.55).add(0.45))
        const earth = float(0.018).mul(cos(D).mul(0.5).add(0.5)).mul(sstep(0.02, -0.06, cosI as F))
        const disc = vec3(1.0, 0.96, 0.88).mul(alb).mul(lit).mul(3.2).add(vec3(0.6, 0.72, 0.95).mul(alb).mul(earth))
        // the limb is soft by half a pixel
        sky.assign(mixN(sky, disc.add(sky.mul(0.3)), sstep(1, float(1).sub(fp.div(MOON_R).mul(2.2)), sqrt(r2) as F).mul(moonUp)))
      })
      // ---- below the horizon: the sea, an island on it, the Moon's road of glitter
      const hzEl = float(-0.15)
      If(el.lessThan(hzEl), () => {
        const depth = hzEl.sub(el)
        const sea = vec3(0.0025, 0.0045, 0.008).add(vec3(0.008, 0.011, 0.018).mul(sstep(1.5, 0, depth as F))).toVar()
        const wx = az.sub(mo.x).div(depth.mul(0.9).add(0.35))
        const road = exp(wx.mul(wx).mul(-1.2))
        const ripple = vnoise(vec2(az.mul(3).div(depth.add(0.3)), float(9).div(depth.add(0.12)).add(U.time.mul(0.8))))
        const glint = sstep(0.55, 0.9, ripple as F).mul(road).mul(moonUp).mul(full.mul(0.85).add(0.15))
        sea.addAssign(vec3(0.95, 0.9, 0.78).mul(glint).mul(0.55).mul(exp(depth.mul(-0.25))))
        sky.assign(sea)
      })
      const isle = sstep(1.5, 3.2, az as F).mul(sstep(9.5, 6.8, az as F)).mul(vnoise(vec2(az.mul(0.8), 1.7)).mul(0.5).add(0.6)).mul(0.95)
      If(el.greaterThan(hzEl).and(el.lessThan(hzEl.add(isle))), () => {
        sky.assign(vec3(0.0018, 0.0026, 0.004).add(vec3(0.004, 0.005, 0.007).mul(full).mul(moonUp)))
      })
      // a little haze sitting on the water
      sky.addAssign(vec3(0.006, 0.008, 0.012).mul(exp(abs(el.sub(hzEl)).mul(-1.3))).mul(full.mul(0.7).add(0.3)))
      return vec4(sky, depthOf(vW))
    })()
    const g = new THREE.PlaneGeometry(64, 52)
    g.translate(-20, 11, -45 - WALL_D - 0.6)
    const mesh = new THREE.Mesh(g, m)
    mesh.frustumCulled = false
    room.add(mesh)
  }
  // ---- the flames: a teardrop each, leaning as it flickers
  const flameGeo = new THREE.InstancedBufferGeometry()
  flameGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3))
  flameGeo.setIndex([0, 1, 2, 0, 2, 3])
  flameGeo.setAttribute("aL", new THREE.InstancedBufferAttribute(new Float32Array(LAMPS.flatMap((l, i) => [l.x + 1.0, l.y - 0.75, l.z, i * 3.7])), 4))
  flameGeo.instanceCount = 2
  flameGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
  {
    const m = new THREE.NodeMaterial()
    const aL = attribute("aL", "vec4") as unknown as V4
    const sway = sin(U.time.mul(7.3).add(aL.w)).mul(0.12).add(sin(U.time.mul(13.1).add(aL.w.mul(2))).mul(0.06))
    const vc = cameraViewMatrix.mul(vec4(aL.xyz, 1))
    const q = positionGeometry.xy
    m.vertexNode = cameraProjectionMatrix.mul(vec4(vc.x.add(q.x.mul(0.62)).add(sway.mul(q.y).mul(q.y)), vc.y.add(q.y.mul(2.5)), vc.z, 1))
    const vQ = q.toVarying() as unknown as V2
    m.fragmentNode = Fn(() => {
      const w = sqrt(sat1(vQ.y.oneMinus() as F)).mul(vQ.y.mul(2.4).add(0.25)).mul(0.9)
      const d = abs(vQ.x).div(max(w, 0.001))
      const body = sstep(1, 0.2, d as F).mul(sstep(0, 0.07, vQ.y)).mul(U.warm).mul(U.flick)
      const core = mixN(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.86, 0.55), sstep(0.9, 0.1, d as F).mul(sstep(0.9, 0.2, vQ.y)))
      // (blue at the wick)
      const col = mixN(core, vec3(0.2, 0.35, 1.0), sstep(0.16, 0.0, vQ.y).mul(0.6)).mul(body).mul(9)
      return vec4(col, 0)
    })()
    Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(flameGeo, m)
    mesh.frustumCulled = false
    mesh.renderOrder = 5
    room.add(mesh)
  }

  // ---------------------------------------------------------------- the rule of ages: a bar of the same bronze, engraved

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "steel", ink: "#1c0f06", light: "rgba(255,226,170,0.55)", debug: ctx.debugLabels, fonts: { name: ctx.fonts.fell, mono: ctx.fonts.mono } }
  const ruleMat = new THREE.NodeMaterial()
  const uRuleSpec = uniform(0.5)
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    // hand-finished: long strokes of the file, a few pits, verdigris creeping in at the ends and the bevel
    const brush = vnoise(vec2(st.x.mul(70), st.y.mul(240))).mul(0.6).add(vnoise(vec2(st.x.mul(260), st.y.mul(700))).mul(0.4)).toVar()
    const tone = fbm(st.mul(vec2(40, 4))).toVar()
    const metal = vec3(0.86, 0.55, 0.3).mul(brush.mul(0.24).add(0.84)).mul(tone.mul(0.2).add(0.88))
    const patina = sstep(0.55, 0.9, tone.add(abs(st.x.sub(0.5)).mul(0.5)).add(st.y.oneMinus().mul(0.16)).add(U.green.mul(0.34)) as F).mul(0.55)
    const base = mixN(metal, vec3(0.3, 0.5, 0.42), patina).toVar()
    // the lamp's long reflection along the bar, sliding as the flame moves
    const glint = exp(st.x.sub(uRuleSpec).mul(st.x.sub(uRuleSpec)).mul(-9)).mul(brush.mul(0.6).add(0.4))
    const light = mixN(vec3(0.62, 0.7, 0.8), vec3(0.95, 0.62, 0.34).mul(U.flick), U.warm).mul(mixN(float(0.95), float(0.8), U.warm))
    const lit = base.mul(light).add(vec3(1.0, 0.7, 0.4).mul(glint).mul(U.warm).mul(0.22).mul(patina.oneMinus())).toVar()
    const col = mixN(lit, cut.rgb.mul(mixN(float(1), float(0.7), U.warm)), on)
    return vec4(ctx.debugLabels ? mixN(col, cut.rgb.mul(4), on) : col, -1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 10
  rule.frustumCulled = false
  scene.add(rule)

  // ---------------------------------------------------------------- targets, focus, post

  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), blur: uniform(0), focus: uniform(10), asp: uniform(16 / 9), far: uniform(1) }
  // depth of field: view depth rides in alpha; a tap may not smear what is sharper than itself
  const dof = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    // (what is far behind the subject stops at a soft blur: a wall should not turn to mist)
    const coc = (d: F): F => min(sat1(abs(d.sub(D.focus)).div(max(d, 0.01)).mul(step(0, d)) as F), D.far) as F
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    If(r0.greaterThan(0.0007), () => {
      Loop(20, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(20))
        const a = fi.mul(2.39996)
        const o = vec2(cos(a), sin(a)).mul(rr).mul(r0).div(vec2(D.asp, 1))
        const t = sampleRT(D.tT, uv.add(o) as V2).toVar()
        const w = sat1(coc(t.a as F).mul(D.blur).div(rr.mul(r0).add(1e-5)).mul(1.4).add(step(c0.a, t.a)) as F)
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    return vec4(acc.rgb.div(acc.a), 1)
  }, D)

  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 600)
  const GAIN: [number, number, number] = [1.02, 1, 0.97]
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.3, bloomThresh: 1.25, bloomRadius: 0.7, contrast: 1.08, sat: 1.04, vignette: 0.3, grain: 0.024, ca: 0.0008, halation: 0.3, lift: [0.004, 0.006, 0.012], gain: GAIN }
  const CLEAR = ageCardClear(ctx.def.id, START)
  const TITLES: TitleOpts = { color: "#fbf1dc", delay: [CLEAR + 0.1, 0.5], shadow: "rgba(8,5,3,0.7)", maxLine: 22, subs: ctx.def.beats.map((b) => (b.sub ? wrap(b.sub, 58) : null)) }
  const HUD = { color: "#fbf1dc", shadow: "rgba(8,5,3,0.7)" }

  // ---------------------------------------------------------------- the camera: a Hermite path through the keys

  const cv = new Float32Array(7)
  const kv = (k: Key, i: number) => (i < 3 ? k.p[i] : i < 6 ? k.l[i - 3] : Math.log(k.fov))
  function camAt(T: number) {
    let i = 0
    while (i < KEYS.length - 2 && T > KEYS[i + 1].t) i++
    const a = KEYS[i], b = KEYS[i + 1]
    const h = b.t - a.t
    const x = clamp((T - a.t) / h)
    const x2 = x * x, x3 = x2 * x
    const h00 = 2 * x3 - 3 * x2 + 1, h10 = x3 - 2 * x2 + x, h01 = -2 * x3 + 3 * x2, h11 = x3 - x2
    for (let c = 0; c < 7; c++) {
      const tan = (j: number) => {
        const k = KEYS[j]
        if (k.stop || j === 0 || j === KEYS.length - 1) return 0
        const p = KEYS[j - 1], n = KEYS[j + 1]
        return 0.5 * ((kv(n, c) - kv(k, c)) / (n.t - k.t) + (kv(k, c) - kv(p, c)) / (k.t - p.t))
      }
      cv[c] = h00 * kv(a, c) + h10 * h * tan(i) + h01 * kv(b, c) + h11 * h * tan(i + 1)
    }
  }
  const st = { T: 0, yr: 0, rate: 0, warm: 0, knock: 0, focus: 20 }
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vF = new THREE.Vector3()
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion()

  /** Where a part is at T (into vA, qA): between the mount and the machine, lifted clear on the way, turned by the train. */
  function poseOf(p: Part, T: number, yr: number) {
    const k = clamp((T - p.t0) / 1.25)
    const kp = k <= 0 ? 0 : k >= 1 ? 1 : E.outBack(k) * 0.35 + E.io3(k) * 0.65
    vA.copy(p.mp).lerp(p.hp, kp)
    vA.z += 3.2 * Math.sin(Math.PI * clamp(k)) * (p.t0 < 90 ? 1 : 0)
    qA.copy(p.mq).slerp(p.hq, E.io2(k))
    if (p.pose && (k >= 1 || p.t0 > 90)) p.pose(p, T, yr, vA, qA)
    else if (p.pose && k > 0) {
      vB.copy(p.hp)
      qB.copy(p.hq)
      p.pose(p, T, yr, vB, qB)
      vA.lerp(vB, E.io3(k))
    }
    qA.multiply(qB.setFromAxisAngle(_Z, p.spin(yr)))
  }

  // ---------------------------------------------------------------- flakes: the crust letting go, where and when each tooth comes clean

  const FL_G = 150
  const flakeGeo2 = new THREE.InstancedBufferGeometry()
  {
    const NFL = 5200
    const R = rng(77)
    const fa = new Float32Array(NFL * 4), fb = new Float32Array(NFL * 4), fc = new Float32Array(NFL * 4)
    let n = 0
    const emit = (p: Part, tau: number, lx: number, ly: number, lz: number, speed: number, size = 1) => {
      if (n >= NFL) return
      poseOf(p, tau, yearsAt(tau))
      vB.set(lx, ly, lz).applyQuaternion(qA).add(vA)
      vB.y += OY
      // out from the wheel's middle, and toward the lens
      vF.set(lx, ly, 0).normalize().applyQuaternion(qA).multiplyScalar(speed * (0.4 + R()))
      vF.x += (R() - 0.5) * 3
      vF.y += R() * 5 - 1
      vF.z += 1.5 + R() * 6
      const tl = (vF.y + Math.sqrt(vF.y * vF.y + 2 * FL_G * Math.max(0.01, vB.y - 0.06))) / FL_G
      fa.set([vB.x, vB.y, vB.z, tau], n * 4)
      fb.set([vF.x, vF.y, vF.z, tl], n * 4)
      fc.set([(0.045 + R() * R() * 0.2) * size, R(), R(), (R() - 0.5) * 34], n * 4)
      n++
    }
    // the knock of the last pair engaging shakes dust off the lump
    for (let i = 0; i < 190; i++) {
      const a = R() * TAU, rr = 1 + R() * 4.3
      emit(parts[0], 0.02 + R() * R() * 0.5, Math.cos(a) * rr, Math.sin(a) * rr, 0.2, 1.5, 0.6)
    }
    for (const p of parts) {
      if (p.crust < 0.9 || p.t0 > 90) continue
      const plate = p.name === "front" || p.name === "back"
      const cnt = p.rad > 0 ? Math.round(24 + p.rad * (p.name === "b1" ? 170 : 60)) : plate ? 280 : 30
      for (let i = 0; i < cnt; i++) {
        const fr = R()
        const tau = p.c0 + (fr / 1.03) * (p.c1 - p.c0)
        if (p.rad > 0) {
          const a = fr * TAU, rr = p.rad * (R() < 0.62 ? 1 : Math.sqrt(R()))
          emit(p, tau, Math.cos(a) * rr, Math.sin(a) * rr, (R() - 0.5) * 0.2, 5)
        } else if (plate) emit(p, tau, (R() - 0.5) * 19, (fr - 0.5) * 31.5, p.name === "front" ? 0.15 : -0.15, 3)
        else emit(p, tau, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4, (R() - 0.5) * 3, 3)
      }
    }
    // (last, so it never takes a wheel's flakes) the lump breaking up: crumbs and lime dust from its face and its broken edge
    for (let i = 0; i < 420; i++) {
      const a = R() * TAU, rr = 5 + R() * 2.6
      emit(parts[LUMP_ID], LUMP.crumble0 + R() * (LUMP.crumble1 - LUMP.crumble0), Math.cos(a) * rr, Math.sin(a) * rr, 1.2 + R() * 1.8, 2.5, 1.3)
    }
    flakeGeo2.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    flakeGeo2.setIndex([0, 1, 2, 0, 2, 3])
    flakeGeo2.setAttribute("iA", new THREE.InstancedBufferAttribute(fa, 4))
    flakeGeo2.setAttribute("iB", new THREE.InstancedBufferAttribute(fb, 4))
    flakeGeo2.setAttribute("iC", new THREE.InstancedBufferAttribute(fc, 4))
    flakeGeo2.instanceCount = n
    flakeGeo2.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    const m = new THREE.NodeMaterial()
    const iA = attribute("iA", "vec4") as unknown as V4, iB = attribute("iB", "vec4") as unknown as V4, iC = attribute("iC", "vec4") as unknown as V4
    const age = U.clock.sub(iA.w)
    const tt = clampN(age, 0, iB.w)
    const landed = step(iB.w, age)
    const c = iA.xyz.add(iB.xyz.mul(tt)).add(vec3(0, tt.mul(tt).mul(-FL_G / 2), 0))
    // tumbling in the air, flat on the table
    const ang = iC.y.mul(40).add(tt.mul(iC.w))
    const e1 = mixN(normalize(vec3(cos(ang), sin(ang), cos(ang.mul(1.7)).mul(0.6))), vec3(cos(ang), 0, sin(ang)), landed)
    const e2 = mixN(normalize(vec3(sin(ang).negate(), cos(ang), sin(ang.mul(1.3)).mul(0.6))), vec3(sin(ang).negate(), 0, cos(ang)), landed)
    const world = c.add(e1.mul(positionGeometry.x).add(e2.mul(positionGeometry.y).mul(0.72)).mul(iC.x).mul(step(0, age)))
    m.vertexNode = viewProj.mul(vec4(world, 1))
    const vW = world.toVarying() as unknown as V3
    const vQ = positionGeometry.xy.toVarying() as unknown as V2
    const vC = iC.toVarying() as unknown as V4
    m.fragmentNode = Fn(() => {
      // a chip, not a square
      Discard(length(vQ).add(vnoise(vQ.mul(2.6).add(vC.y.mul(50))).sub(0.5).mul(0.8)).greaterThan(0.95))
      const lit = lightAt(vW, normalize(vec3(0, 0.75, 0.66)) as V3, vec3(0, 0, 1) as V3)
      const alb = mixN(mixN(vec3(0.09, 0.06, 0.045), vec3(0.2, 0.3, 0.25), sstep(0.15, 0.4, vC.z)), vec3(0.52, 0.53, 0.46), sstep(0.6, 0.8, vC.z))
      return vec4(alb.mul(lit.diff), depthOf(vW))
    })()
    m.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(flakeGeo2, m)
    mesh.frustumCulled = false
    scene.add(mesh)
  }
  // ---- dust in the air: it shows in the lamp's light, and when everything stops it comes down
  const moteGeo = new THREE.InstancedBufferGeometry()
  {
    const NM = 520
    const R = rng(1901)
    const ma = new Float32Array(NM * 4)
    for (let i = 0; i < NM; i++) ma.set([(R() - 0.5) * 60, 1 + R() * 40, i % 3 ? -3 - R() * 30 : 4 + R() * 30, R()], i * 4)
    moteGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    moteGeo.setIndex([0, 1, 2, 0, 2, 3])
    moteGeo.setAttribute("iA", new THREE.InstancedBufferAttribute(ma, 4))
    moteGeo.instanceCount = NM
    moteGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    const m = new THREE.NodeMaterial()
    const iA = attribute("iA", "vec4") as unknown as V4
    const fall = max(U.clock.sub(T_STOP1), 0).mul(iA.w.mul(0.9).add(0.5))
    const c = vec3(iA.x.add(sin(U.time.mul(0.31).add(iA.w.mul(40))).mul(0.5)), max(iA.y.sub(fall).add(sin(U.time.mul(0.23).add(iA.w.mul(17))).mul(0.4)), 0.05), iA.z.add(cos(U.time.mul(0.27).add(iA.w.mul(29))).mul(0.5)))
    const vc = cameraViewMatrix.mul(vec4(c, 1))
    m.vertexNode = cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(iA.w.mul(0.05).add(0.035))), vc.z, 1))
    const vQ = positionGeometry.xy.toVarying() as unknown as V2
    const vP = c.toVarying() as unknown as V3
    m.fragmentNode = Fn(() => {
      const a = sstep(1, 0.2, length(vQ))
      const d0 = (U.lamp0 as unknown as V3).sub(vP), d1 = (U.lamp1 as unknown as V3).sub(vP)
      const lamp = LAMPC.mul(U.warm).mul(float(160).div(dot(d0, d0).add(40)).add(float(160).div(dot(d1, d1).add(40))))
      const col = lamp.add(vec3(0.3, 0.36, 0.46).mul(U.warm.oneMinus()).mul(0.5)).mul(a).mul(U.dust.mul(0.8).add(0.25))
      return vec4(col, 0)
    })()
    Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor })
    const mesh = new THREE.Mesh(moteGeo, m)
    mesh.frustumCulled = false
    mesh.renderOrder = 6
    scene.add(mesh)
  }

  // ---------------------------------------------------------------- the hand on the crank

  const aim = makeAim()
  const handLights = (P: V3): Lights => {
    const d = (U.lamp0 as unknown as V3).sub(P)
    const dl = length(d)
    return {
      key: normalize(mixN(COLD_DIR, d.div(dl), U.warm)) as V3,
      keyCol: mixN(COLD, LAMPC.mul(U.flick).mul(float(520).div(dl.mul(dl).add(60))), U.warm) as V3,
      sky: mixN(vec3(0.16, 0.18, 0.22), vec3(0.03, 0.035, 0.06), U.warm) as V3,
      bounce: vec3(0.16, 0.08, 0.035).mul(U.warm) as V3,
    }
  }
  const herd = makeHerd({
    spec: HAND, count: 1, path: aim, lods: [{ detail: 1, cover: 0 }],
    material: (n) => {
      const m = skinMaterial(n, handLights(n.vW), HM.handLook(HAND0, { skin: 0x8a5c44, hair: 0.45, veins: 0.5, callus: 0.25 }))
      m.fragmentNode = vec4((m.fragmentNode as unknown as V4).rgb, depthOf(n.vW))
      return m
    },
  })
  scene.add(herd.group)
  const hand = { k: 0, grip: 0, time: 0, roll: 0 }
  const fillHand = (_i: number, d: Drive) => {
    d.dist = 0
    d.lane = 0
    // (a hand that is off is put far below the table, where the herd culls it)
    d.rise = hand.k < 0.002 ? -1e6 : 0
    d.time = hand.time
    d.scale = 100
    d.seed = 0.41
    d.ch.knob = hand.grip
    d.ch.curl = 0.35 * (1 - hand.grip)
    d.roll = hand.roll
  }
  // The frame of the hand in the world: its knob axis (model z) along the crank's shaft (world +x), the forearm
  // (model x) coming up from in front and below, the back of the hand (model y) up. Z = X x Y.
  const knob = new THREE.Vector3(), hX = new THREE.Vector3(), hY = new THREE.Vector3(), hO = new THREE.Vector3(), r0 = new THREE.Vector3(), u0 = new THREE.Vector3()
  const KNOB_C = new THREE.Vector3(CRANK.x + CRANK.knob / 2, OY, CRANK.z)
  const FORE0 = new THREE.Vector3(0, 0.36, -1).normalize()
  const ELBOW0 = KNOB_C.clone().addScaledVector(FORE0, -GRIP_AT[0] * 100).addScaledVector(new THREE.Vector3().crossVectors(_X, FORE0), -GRIP_AT[1] * 100).addScaledVector(_X, -GRIP_AT[2] * 100)
  const aimO = [0, 0, 0], aimD = [1, 0, 0]
  function placeHand(T: number, yr: number, time: number) {
    const th = TAU * CRANK_W * yr
    knob.set(KNOB_C.x, OY + CRANK.r * Math.sin(th), CRANK.z - CRANK.r * Math.cos(th))
    // it comes in from the lower right, takes the knob, and at the very end lets go and draws back
    const k = smooth(T_CRANK - 1.0, T_CRANK - 0.05, T) * (1 - smooth(T_STOP1 + 0.2, T_STOP1 + 1.5, T))
    hand.k = k
    hand.grip = smooth(T_CRANK - 0.45, T_CRANK - 0.02, T) * (1 - smooth(T_STOP1 + 0.1, T_STOP1 + 0.5, T))
    hand.time = time
    // the elbow follows the knob by half, as an arm does; the forearm points from it to the grip
    hO.copy(knob).sub(KNOB_C).multiplyScalar(0.45).add(ELBOW0)
    hX.copy(knob).sub(hO)
    hX.x = 0
    hX.normalize()
    hY.crossVectors(_X, hX) // Y = Z x X
    knob.x += (1 - k) * 6
    knob.y -= (1 - k) * 8
    knob.z += (1 - k) * 22
    hO.copy(knob).addScaledVector(hX, -GRIP_AT[0] * 100).addScaledVector(hY, -GRIP_AT[1] * 100).addScaledVector(_X, -GRIP_AT[2] * 100)
    // the rig's frame for a heading: right = horizontal, up = right x heading; roll turns up toward right
    r0.set(-hX.z, 0, hX.x).normalize()
    u0.crossVectors(r0, hX)
    hand.roll = Math.atan2(hY.dot(r0), hY.dot(u0))
    hO.toArray(aimO)
    hX.toArray(aimD)
    aim.set(aimO, aimD)
  }

  function update(s: State) {
    const over = s.beat === 0 ? Math.max(0, s.at(0) - B0) : 0
    const T = s.beat === 0 ? Math.min(s.at(0), B0) : B0 + s.at(1)
    const yr = yearsAt(T) + rateAt(B0) * over
    st.T = T
    st.yr = yr
    st.rate = rateAt(T)
    // ---- light: cold while it is a find, lamplight once it is a machine, cold again when it stops
    const warm = smooth(T_ASM - 0.6, T_ASM + 3.2, T) * (1 - 0.94 * smooth(T_STOP1 + 0.6, T_STOP1 + 3.8, T))
    st.warm = warm
    U.warm.value = warm
    U.flick.value = 0.93 + 0.05 * Math.sin(s.time * 9.1) + 0.035 * Math.sin(s.time * 23.7 + 1.3) + 0.03 * Math.sin(s.time * 3.3)
    U.green.value = smooth(T_STOP1 + 0.4, T_STOP1 + 4.6, T)
    U.dust.value = smooth(T_STOP1, T_STOP1 + 4.5, T)
    U.time.value = s.time
    U.clock.value = T
    U.caseOn.value = smooth(6.4, 8.4, T)
    for (let i = 0; i < 2; i++) {
      const L = i ? U.lamp1.value : U.lamp0.value
      L.copy(LAMPS[i])
      L.x += 1.0 + 0.1 * Math.sin(s.time * 7.3 + i * 3.7)
      L.y += 0.4
    }
    // ---- the Moon in the window: its longitude from the Sun is the angle between the two pointers
    const Dm = D0 + D_RATE * yr
    const u = ((((Dm - Math.PI) / Math.PI) % 2) + 3) % 2 - 1 // -1..1, 0 at full
    // (degrees in the window's sky: across, and up from the horizon; the stars turn once a year, as at a fixed hour)
    U.sky.value.set(-u * 4.6, 1.2 + 3.7 * (1 - u * u), Dm, 0.35 - TAU * yr)

    // ---- every part: where it is between the mount and the machine, how far round it has turned, how clean it is
    const lidOff = smooth(B0 + 0.1, B0 + 1.7, T)
    const shut = smooth(6.4, 8.9, T) * (1 - 0.1 * lidOff)
    U.top.value = lidOff * warm
    for (const p of parts) {
      poseOf(p, T, yr)
      const front = p.crust > 0 ? clamp((T - p.c0) / (p.c1 - p.c0)) * 1.03 : 2
      aP[p.id].set(vA.x, vA.y, vA.z, front)
      aQ[p.id].set(qA.x, qA.y, qA.z, qA.w)
      const heal = smooth(p.t0 - 0.2, p.t0 + 1.0, T)
      const keep = p.id === LUMP_ID ? mix(1.9, -0.4, smooth(LUMP.crumble0, LUMP.crumble1, T)) : p.thr >= 2 ? 9 : mix(p.thr, 1.5, heal)
      aS[p.id].set(p.crust, keep, p.inside * shut, p.seed)
    }

    // ---- camera
    camAt(T)
    const land = Math.max(0, T)
    const knock = T >= 0 && T < 2 ? Math.exp(-land * 5.5) : 0
    st.knock = knock
    const amb = clamp(Math.hypot(cv[0] - cv[3], cv[1] - cv[4], cv[2] - cv[5]) * 0.0035, 0.002, 0.25)
    cam.position.set(
      cv[0] + amb * (Math.sin(s.time * 0.37) + 0.5 * Math.sin(s.time * 0.83 + 1)) + amb * 4 * s.mouse.x + knock * 0.14 * Math.sin(land * 43),
      cv[1] + amb * (Math.sin(s.time * 0.29 + 2) + 0.5 * Math.sin(s.time * 0.67)) + amb * 3 * s.mouse.y + knock * 0.1 * Math.cos(land * 37),
      cv[2] + amb * 0.6 * Math.sin(s.time * 0.23 + 4),
    )
    vF.set(cv[3], cv[4], cv[5])

    cam.up.set(0.012 * Math.sin(s.time * 0.21), 1, 0)
    cam.fov = Math.exp(cv[6])
    cam.aspect = s.w / s.h
    const dist = cam.position.distanceTo(vF)
    cam.near = clamp(dist * 0.06, 0.02, 2)
    cam.far = 600
    cam.lookAt(vF)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    U.cam.value.copy(cam.position)
    cam.getWorldDirection(U.fwd.value)
    placeHand(T, yr, s.time)
    herd.update(cam, fillHand)
    // ---- focus: on the subject; racked to the window and back while the Moon crosses
    const rack = smooth(10.9, 11.5, T) * (1 - smooth(12.1, 12.8, T))
    const macro = smooth(B0 + 2.6, B0 + 4, T) * (1 - smooth(B0 + 10, B0 + 11, T))
    // (the window's sky is a plane just outside the wall: rack to its depth along the view)
    const skyDepth = vB.set(-20, 11, -45 - WALL_D - 0.6).sub(cam.position).dot(U.fwd.value)
    st.focus = mix(dist, skyDepth, rack)
    D.focus.value = st.focus
    D.blur.value = mix(0.012, 0.015, macro) + 0.012 * rack + 0.02 * Math.sin(Math.PI * smooth(B0 + 9.8, B0 + 10.6, T))
    D.asp.value = cam.aspect
    // (while the window is in shot the far blur stays small, so its stars stay points)
    const winOn = smooth(7.5, 9, T) * (1 - smooth(B0, B0 + 1.2, T))
    D.far.value = mix(mix(0.5, 0.2, winOn), 1, Math.max(rack, macro))

    // ---- the rule: where it sat in the last scene, in this scene's light
    // (a wider lens would keystone a leaning bar: lean it less)
    placeRule(rule, cam, { dist: cam.near * 6, lean: (0.18 * Math.tan((30 * Math.PI) / 360)) / Math.tan((cam.fov * Math.PI) / 360) })
    face.update(ctx.def.id, ruleArrival(ctx.def.id, s.at(0), START), ruleStyle)
    uRuleSpec.value = 0.32 + 0.1 * Math.sin(s.time * 0.17) + 0.03 * Math.sin(s.time * 7.3)

    if (s.live) {
      ctx.synth.bed("hum", clamp(st.rate / 0.045) * 0.5 * warm)
      ctx.synth.bed("air", 0.2 * (1 - warm) * (T < 0 ? s.enter : 1))
    }
  }

  // ---------------------------------------------------------------- sound

  const lp: [number, number, number] = [0, 0, 0]
  const at = (x: number, y: number, z: number) => () => listenerPos(vA.set(x, y + OY, z), cam, st.focus, lp)
  const cueT = (T: number, c: Omit<Cue, "b" | "at">): Cue => (T < B0 ? { b: 0, at: T, ...c } : { b: 1, at: T - B0, ...c })
  const cues: Cue[] = [...ruleCues(ctx.def.id, { start: START })]
  {
    // the hand-off lands; the first wheel breaks free
    cues.push(cueT(0.02, { s: "thud", o: { f: H(3), g: 0.5 }, pos: [0.1, 0, 0] }), cueT(T_FREE - 0.05, { s: "crack", o: { f: 1900, g: 0.3 }, pos: at(4, 3, 2.7) }), cueT(T_FREE, { s: "gear", o: { f: H(28), g: 0.5, dur: 0.5 }, pos: at(5, 0, 2.7) }))
    // a ratchet on every quarter turn of the crank, a click per tooth of the 223 while the lens is beside it
    let q = Math.floor(Math.abs(CRANK_W) * yearsAt(T_FREE) * 4), e = Math.floor(Math.abs(WE) * yearsAt(B0 + 6) * 223), last = -1
    for (let T = T_FREE; T < T_STOP1; T += 1 / 120) {
      const y = yearsAt(T)
      const nq = Math.floor(Math.abs(CRANK_W) * y * 4)
      if (nq !== q && T - last > 0.06) {
        q = nq
        last = T
        cues.push(cueT(T, { s: "gear", o: { f: H(36 + (nq % 4) * 2), g: T < T_CRANK ? 0.22 : 0.34, dur: 0.14 }, pos: T < B0 ? at(CRANK.x, 0, 3.8) : at(5, 0, 2.7) }))
      }
      const ne = Math.floor(Math.abs(WE) * y * 223)
      if (ne !== e) {
        e = ne
        if (T > B0 + 6.2 && T < B0 + 10) cues.push(cueT(T, { s: "tick", o: { f: H(22), g: 0.75, wet: 0.5 }, pos: at(-0.53, 3.67, -0.6) }), cueT(T + 0.03, { s: "knap", o: { f: H(44), g: 0.22 }, pos: at(-0.53, 3.67, -0.6) }))
      }
    }
    // crust letting go, part by part; each piece landing home; the case shutting
    // the lump letting go of the wheels: a dry crunch, then crumbs
    for (let k = 0; k < 6; k++) cues.push(cueT(LUMP.crumble0 + ((LUMP.crumble1 - LUMP.crumble0) * (k + 0.2)) / 6, { s: k % 2 ? "tick" : "crack", o: { f: 900 + k * 230, g: 0.2 - k * 0.02 }, pos: at(k % 2 ? 6 : -6, (k % 3) * 2 - 2, 2.4) }))
    parts.forEach((p, i) => {
      if (p.t0 > 90) return
      if (p.crust > 0.5) for (let k = 0; k < 3; k++) cues.push(cueT(p.c0 + ((p.c1 - p.c0) * (k + 0.3)) / 3 + (i % 5) * 0.023, { s: "tick", o: { f: 2600 + ((i * 37 + k * 11) % 9) * 190, g: 0.16 }, pos: at(p.hp.x, p.hp.y, p.hp.z) }))
      cues.push(cueT(p.t0 + 1.05 + (i % 3) * 0.021, { s: p.name === "front" || p.name === "back" ? "anvil" : p.inside ? "knap" : "thud", o: { f: H(p.inside ? 30 + (i % 7) * 2 : 5 + (i % 3)), g: p.inside ? 0.16 : 0.32 }, pos: at(p.hp.x, p.hp.y, p.hp.z) }))
    })
    cues.push(
      cueT(T_ASM - 0.3, { s: "scratch", o: { f: 110, g: 0.3, dur: 1.5 }, pos: [0, -0.3, 0.4] }),
      cueT(T_ASM - 0.2, { s: "pad", o: { f: H(4), dur: 5, g: 0.3 } }),
      cueT(T_ASM + 0.1, { s: "whoosh", o: { f: H(6), dur: 2.4, g: 0.3 } }),
      cueT(8.95, { s: "thump", o: { f: H(3), g: 0.5 }, pos: at(0, 15, 0) }),
      cueT(11.6, { s: "shimmer", o: { f: H(24), dur: 2, g: 0.2 }, pos: [-0.5, 0.1, 0.9] }),
      // beat 1: the lid, the flight, the dolly zoom, out of the back
      cueT(B0 + 0.1, { s: "scratch", o: { f: 90, g: 0.4, dur: 1.5 }, pos: at(0, 15.4, 0) }),
      cueT(B0 + 2.2, { s: "whoosh", o: { f: H(5), dur: 2.6, g: 0.35 } }),
      cueT(B0 + 6.6, { s: "riser", o: { f: H(8), dur: 1.7, g: 0.25 } }),
      cueT(B0 + 9.7, { s: "whoosh", o: { f: H(4), dur: 1.2, g: 0.4 } }),
      // the pointer is on an eclipse; and that is the last thing it does
      cueT(T_STOP1 - 0.05, { s: "bell", o: { f: H(12), g: 0.45 }, pos: at(0.3, -7.3, -5) }),
      cueT(T_STOP1 - 0.02, { s: "gear", o: { f: H(20), g: 0.4, dur: 0.2 }, pos: at(0.3, -7.3, -5) }),
      cueT(T_STOP1 + 1.4, { s: "pad", o: { f: H(2), dur: 4.5, g: 0.16 } }),
    )
  }

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: dof, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      D.tT.value = stage.texture
      dof.render(out)
      POST.exposure = mix(0.92, 1.05, st.warm) + 0.12 * st.knock - 0.14 * U.green.value
      POST.sat = 1.04 - 0.2 * U.green.value
      GAIN[0] = mix(0.97, 1.03, st.warm)
      GAIN[2] = mix(1.04, 0.95, st.warm)
      POST.bloom = ctx.debugLabels ? 0 : mix(0.12, 0.34, st.warm)
      if (ctx.debugLabels) POST.ca = POST.halation = 0
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(8,5,3,0.75)", color: "#fbf1dc" })
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face)],
    dispose() {
      face.dispose()
      texF.dispose()
      texB.dispose()
      flameGeo.dispose()
      herd.dispose()
      disposeTree(scene)
    },
  }
}
