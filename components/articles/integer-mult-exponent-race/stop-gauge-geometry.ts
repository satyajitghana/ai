// The stop gauge's world, built once at module load (Anatomy workflow step 6).
// World units are about one px; x runs along the rails, y toward the front,
// z up. Moving parts (the carriage, the two stops, main's pin) are built at
// x = 0 and moved with translateAlong; the steel band and the dial needle
// change shape, so their builders are exported for the live component.
//
// The machine: a bench stop gauge. Two ground rods on end brackets, one per
// network (bit in front, complex behind). Each rod carries a clamp collar set
// at that network's saving. A carriage rides both rods and a constant-force
// spring (a steel band off a drum) pulls it toward larger savings, so it comes
// to rest against whichever collar is nearer: the weaker network. Its index
// foot reads the saving on a ruler in units of 1e-4, and a dial-caliper dial,
// driven by a pinion on the rack between the rods, turns once per 1e-4.

import { mcos, msin } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import type { Flat, LineTone, Plan, Point3, SolidPaths, Tone } from "@/components/articles/anatomy-machine-skill/iso-kit"
import { SCALE } from "./stop-gauge-model"

export const WIDTH = 640
export const HEIGHT = 286
const AZIMUTH = 58

export type Item =
  | { kind: "solid"; paths: SolidPaths; tone: Tone; crease?: Tone | "none" }
  | { kind: "line"; d: string; tone: LineTone; width?: number }
  | { kind: "dots"; points: Flat[]; size: number; tone: Tone }
  | { kind: "halo"; d: string }

const PLATE: Plan = { x: -152, y: -36, w: 294, d: 82, r: 8 }
const PLATE_H = 10
const FOOT_H = 5
export const ROD_Y = { complex: -16, bit: 16 } as const
const ROD_Z = 9
const ROD_FROM = -130
const ROD_TO = 124

// The scale: x of a saving given in units of 1e-4.
const X0 = -96
const UNIT = 20
export const xOf = (per1e4: number) => X0 + (per1e4 - SCALE.from) * UNIT

const DRUM = { x: 116, y: 0, r: 6 }
const BAND = { y: 5.5, d: 0.5, z0: 5.6, z1: 10.4 }

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [xOf(4.6) - 17, 0, 23], [xOf(13) - 17, 0, 23], [xOf(13) + 4, ROD_Y.complex, 21], [-142, -28, 18]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: AZIMUTH },
)

const at = (x: number, y: number, z: number) => k.iso([x, y, z], P)
const byDepth = <T extends [number, number]>(points: T[]) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))

let solids = 0
const S = (paths: SolidPaths, tone: Tone = "mid", crease: Tone | "none" = "faint"): Item => {
  solids += 1
  return { kind: "solid", paths, tone, crease }
}
const L = (d: string, tone: LineTone = "lo", width?: number): Item => ({ kind: "line", d, tone, width })
const D = (points: Flat[], size = 0.45, tone: Tone = "mid"): Item => ({ kind: "dots", points, size, tone })

// A circle on a face of constant x: a bore round a rod where it leaves a bracket.
function ringOnX([px, py, pz]: Point3, radius: number, steps = 28) {
  const points: Flat[] = []
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2
    points.push(at(px, py + radius * mcos(angle), pz + radius * msin(angle)))
  }
  return k.pathOf(points, true)
}

// A slotted screw head on a top face: a small cylinder with its slot.
function screwHead(x: number, y: number, z: number, r = 1.5): Item[] {
  return [S(k.cylinder(x, y, r, z, 0.8, P, 16), "mid"), L(k.lineOnTop([x - r, y], [x + r, y], z + 0.8, P), "lo")]
}

function base(): Item[] {
  const out: Item[] = [{ kind: "halo", d: k.slabOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P).fill }]
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 6.4, -PLATE_H - FOOT_H, 1.6, P, 28), "lo"))
    out.push(S(k.cylinder(x, y, 4.8, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), "mid"))
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), "mid"))
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), "faint"))
  const screws = k.corners(PLATE, 10)
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), "lo"))
  out.push(D(screws.map(([x, y]) => at(x, y, 0)), 0.5))

  // The rack the carriage's pinion runs on: teeth across its top, edge to edge.
  const rack: Plan = { x: -126, y: -3, w: 230, d: 6, r: 0.6 }
  out.push(S(k.slabOf(rack, 0, 2, P, 3, 0.3), "lo"))
  const teeth: string[] = []
  for (let x = rack.x + 2; x <= rack.x + rack.w - 2; x += 2) teeth.push(k.lineOnTop([x, rack.y], [x, rack.y + rack.d], 2, P))
  out.push(L(teeth.join(""), "faint"))
  out.push(D([at(rack.x + 1.2, 0, 2), at(rack.x + rack.w - 1.2, 0, 2)], 0.4))

  // The ruler: a tick every 0.25e-4, a major line every 1e-4, a long one at 10^-3.
  const from = xOf(SCALE.from - 0.25)
  const strip: Plan = { x: from, y: 33, w: xOf(SCALE.to + 0.25) - from, d: 6, r: 1 }
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), "lo", "none"))
  const minor: string[] = []
  const major: string[] = []
  for (let q = SCALE.from * 4; q <= SCALE.to * 4 + 1e-9; q++) {
    const v = q / 4
    const x = xOf(v)
    if (v === SCALE.thousandth) continue
    if (q % 4 === 0) major.push(k.lineOnTop([x, strip.y], [x, strip.y + 3.4], 0.6, P))
    else minor.push(k.lineOnTop([x, strip.y], [x, strip.y + 1.8], 0.6, P))
  }
  out.push(L(minor.join(""), "lo"), L(major.join(""), "mid"))
  out.push(L(k.lineOnTop([xOf(SCALE.thousandth), strip.y], [xOf(SCALE.thousandth), strip.y + strip.d], 0.6, P), "hi"))

  // Label plate, three rule lines that stand for its printed text.
  const label: Plan = { x: -146, y: 30, w: 30, d: 12, r: 1.2 }
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), "lo"))
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), "faint"))
  for (const [x0, x1, y] of [
    [-142, -124, 33.6],
    [-142, -128, 36],
    [-142, -131, 38.4],
  ] as const)
    out.push(L(k.lineOnTop([x0, y], [x1, y], 0.8, P), "lo"))
  out.push(D([at(label.x + 2.2, label.y + 6, 0.8), at(label.x + label.w - 2.2, label.y + 6, 0.8)], 0.4))
  return out
}

const BRACKET_H = 18
function bracket(x: number, faceRings: boolean): Item[] {
  const plan: Plan = { x, y: -28, w: 12, d: 56, r: 2 }
  const out: Item[] = [S(k.slabOf(plan, 0, BRACKET_H, P, 5, 0.8), "mid")]
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), BRACKET_H, P, 5), "faint"))
  if (faceRings) for (const y of [ROD_Y.complex, ROD_Y.bit]) out.push(L(ringOnX([x + 12, y, ROD_Z], 3.2), "lo"))
  for (const y of [ROD_Y.complex, ROD_Y.bit]) out.push(...screwHead(x + 6, y, BRACKET_H))
  out.push(D([at(x + 6, -24, BRACKET_H), at(x + 6, 24, BRACKET_H)], 0.45))
  return out
}

const rod = (y: number): Item[] => [S(k.slabOf({ x: ROD_FROM, y: y - 2, w: ROD_TO - ROD_FROM, d: 4, r: 1.8 }, ROD_Z - 2, 4, P, 3), "mid")]

function drumLower(): Item[] {
  const { x, y, r } = DRUM
  return [
    S(k.cylinder(x, y, 2, 0, 3.8, P, 18), "mid", "none"),
    S(k.cylinder(x, y, 7.6, 3.8, 0.8, P, 40, 0.4), "mid"),
    S(k.cylinder(x, y, r, 4.6, 6.8, P, 40), "hi", "lo"),
    L(k.sideArc(x, y, r, BAND.z0, P, 28) + k.sideArc(x, y, r, BAND.z1, P, 28), "faint"),
  ]
}
function drumUpper(): Item[] {
  const { x, y } = DRUM
  return [S(k.cylinder(x, y, 7.6, 11.4, 0.8, P, 40, 0.4), "mid"), S(k.cylinder(x, y, 2.4, 12.2, 1.2, P, 20), "mid"), D([at(x, y, 13.4)], 0.5, "hi")]
}

// The band runs from the carriage's clamp (at the carriage's contact face) to
// the drum's tangent point. It is the one solid rebuilt every frame.
export const bandAt = (xc: number) => k.slabOf({ x: xc, y: BAND.y, w: Math.max(0.5, DRUM.x - xc), d: BAND.d, r: 0 }, BAND.z0, BAND.z1 - BAND.z0, P, 1)

// Carriage, local x with the contact face at 0.
const DIAL = { x: -17, y: 0, r: 9.5, z0: 19, z1: 22.5 }
function carriageBody(): Item[] {
  const out: Item[] = []
  const bushings: Plan[] = []
  for (const y of [ROD_Y.complex, ROD_Y.bit]) for (const x of [-34, -11]) bushings.push({ x, y: y - 6, w: 11, d: 12, r: 1.2 })
  for (const plan of bushings.sort((a, b) => k.depthOf([a.x + a.w / 2, a.y + a.d / 2, 0], P) - k.depthOf([b.x + b.w / 2, b.y + b.d / 2, 0], P))) {
    out.push(S(k.slabOf(plan, 3, 12, P, 3, 0.4), "mid"))
    out.push(D([at(plan.x + plan.w / 2, plan.y + plan.d, 9)], 0.45, "mid"))
  }
  out.push(S(k.slabOf({ x: -5, y: 3, w: 5, d: 8, r: 0.6 }, 4, 11, P, 3), "lo"))
  const plate: Plan = { x: -36, y: -24, w: 36, d: 48, r: 3 }
  out.push(S(k.slabOf(plate, 15, 4, P, 6, 0.8), "mid"))
  out.push(L(k.planOutline(k.insetPlan(plate, 2.6), 19, P, 6), "faint"))
  out.push(D(k.corners(plate, 4.6).map(([x, y]) => at(x, y, 19)), 0.5))
  return out
}

function carriageTop(): Item[] {
  const out: Item[] = []
  const foot: Plan = { x: -3, y: 24, w: 6, d: 15, r: 0.8 }
  out.push(S(k.slabOf(foot, 3.4, 2, P, 3, 0.3), "mid"))
  out.push(S(k.slabOf({ x: -3, y: 24, w: 6, d: 2.4, r: 0.4 }, 5.4, 13.6, P, 2), "mid"))
  out.push(L(k.lineOnTop([0, 26.4], [0, 39], 5.4, P), "hi", 1))
  const { x, y, r, z0, z1 } = DIAL
  out.push(S(k.cylinder(x, y, r + 1, z0, 0.8, P, 48), "lo"))
  out.push(S(k.cylinder(x, y, r, z0 + 0.8, z1 - z0 - 0.8, P, 64, 0.6), "mid"))
  out.push(L(k.knurl(x, y, r, z1 - 2.2, z1, 64, P, 0.3), "lo"))
  out.push(L(k.sideArc(x, y, r, z1 - 2.2, P, 32), "faint"))
  out.push(L(k.ring(x, y, r - 1.2, z1, P, 56), "lo"))
  const ticks = k.radialTicks(x, y, r - 1.7, 50, 5, z1, [1, 2], P)
  out.push(L(ticks.minor, "lo"), L(ticks.major, "mid"))
  out.push(L(k.ring(x, y, 1.3, z1, P, 16), "mid"))
  // Lock screw on the dial bezel, on the side that faces the viewer.
  out.push(S(k.cylinder(x + r * 0.62, y + r * 0.62 + 2.6, 1.5, z0 + 0.8, 2.6, P, 16), "mid"))
  return out
}

// The needle: one turn per 1e-4. Angle 0 points to -y, clockwise from above,
// as the kit's radialTicks count.
export function needleAt(turn: number) {
  const a = turn * Math.PI * 2
  const { x, y, r, z1 } = DIAL
  const sx = msin(a)
  const sy = -mcos(a)
  return k.onTop(
    [
      [x - sx * 2.2, y - sy * 2.2],
      [x + sx * (r - 2.2), y + sy * (r - 2.2)],
    ],
    z1 + 0.1,
    P,
  )
}

// A clamp collar, local x with its contact face at 0, on the rod at y.
function stop(y: number): Item[] {
  const plan: Plan = { x: 0, y: y - 6, w: 9, d: 12, r: 1.2 }
  return [
    S(k.slabOf(plan, 3, 12, P, 3, 0.5), "mid"),
    L(k.lineOnTop([0, y + 3.4], [9, y + 3.4], 15, P), "lo"),
    S(k.cylinder(4.5, y - 1.2, 2.8, 15, 1, P, 24), "mid"),
    S(k.cylinder(4.5, y - 1.2, 2.3, 16, 4.4, P, 24, 0.3), "mid"),
    L(k.knurl(4.5, y - 1.2, 2.3, 16, 20.4, 22, P, 0.4), "lo"),
    D([at(1.6, y - 4.6, 15), at(7.4, y - 4.6, 15)], 0.38),
  ]
}

function mainPin(): Item[] {
  return [S(k.cylinder(0, 37, 2.2, 0.6, 0.6, P, 20), "lo"), S(k.cylinder(0, 37, 1.3, 1.2, 1.9, P, 16), "mid", "none"), S(k.cylinder(0, 37, 1.8, 3.1, 0.6, P, 20, 0.3), "hi", "lo")]
}

export interface Art {
  base: Item[]
  leftBracket: Item[]
  backRod: Item[]
  drumLower: Item[]
  drumUpper: Item[]
  frontRod: Item[]
  rightBracket: Item[]
  carriageBody: Item[]
  carriageTop: Item[]
  stops: { bit: Item[]; complex: Item[] }
  mainPin: Item[]
  solids: number
}

function build(): Art {
  solids = 0
  const art: Art = {
    base: base(),
    leftBracket: bracket(-142, true),
    backRod: rod(ROD_Y.complex),
    drumLower: drumLower(),
    drumUpper: drumUpper(),
    frontRod: rod(ROD_Y.bit),
    rightBracket: bracket(ROD_TO, false),
    carriageBody: carriageBody(),
    carriageTop: carriageTop(),
    stops: { bit: stop(ROD_Y.bit), complex: stop(ROD_Y.complex) },
    mainPin: mainPin(),
    solids: 0,
  }
  art.solids = solids + 1 // the band
  return art
}

export const ART = build()
export const moveTo = (x: number) => k.translateAlong(P, [x, 0, 0])
