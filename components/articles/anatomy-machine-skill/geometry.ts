// The machine's world, built once at module load (Anatomy's workflow step 6:
// "Build geometry once"). World units are about one px of the drawing, x and
// y on the floor, z up. Everything static is a path string here; the only
// parts rebuilt per frame are the dial needle and the extruded block, which
// change shape, so their builders are exported for the live component.
//
// The object: a bench with nine stations in a row and a carriage that carries
// the one-line prompt along a rail in front of them. Each station is one stage
// of what the Anatomy skill makes Claude do, in the order SKILL.md lists it.

import { matan2, mcos, msin } from "@/lib/dmath"
import * as k from "./iso-kit"
import type { Flat, Plan, SolidPaths, Tone, LineTone } from "./iso-kit"

export const WIDTH = 640
export const HEIGHT = 300
export const AZIMUTH = 58
export const ELEVATION = 30

export type Item =
  | { kind: "solid"; paths: SolidPaths; tone: Tone; crease?: Tone | "none"; flat?: boolean }
  | { kind: "line"; d: string; tone: LineTone }
  | { kind: "dots"; points: Flat[]; size: number; tone: Tone }
  | { kind: "halo"; d: string }

const PLATE: Plan = { x: -142, y: -40, w: 284, d: 86, r: 8 }
const PLATE_H = 10
const FOOT_H = 5
const CY = -15
const Z0 = 2
export const STATION_X = [-120, -90, -60, -30, 0, 30, 60, 90, 120]

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, CY, 37], [-120, CY - 12, 33], [60, CY, 32], [90, CY - 12, 35]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: AZIMUTH, elevation: ELEVATION },
)

export const at = (x: number, y: number, z: number) => k.iso([x, y, z], P)
const byDepth = <T extends [number, number]>(points: T[]) =>
  [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))

let solids = 0
const S = (paths: SolidPaths, tone: Tone = "mid", crease: Tone | "none" = "faint"): Item => {
  solids += 1
  return { kind: "solid", paths, tone, crease }
}
const L = (d: string, tone: LineTone = "lo"): Item => ({ kind: "line", d, tone })
const D = (points: Flat[], size = 0.45, tone: Tone = "mid"): Item => ({ kind: "dots", points, size, tone })

function base(): Item[] {
  const out: Item[] = [{ kind: "halo", d: k.slabOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P).fill }]
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 6.4, -PLATE_H - FOOT_H, 1.6, P, 28), "lo"))
    out.push(S(k.cylinder(x, y, 4.8, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), "mid"))
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), "mid"))
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), "lo"))
  const screws = k.corners(PLATE, 10)
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), "lo"))
  out.push(D(screws.map(([x, y]) => at(x, y, 0)), 0.5))
  const strip: Plan = { x: -100, y: 33, w: 228, d: 6, r: 1 }
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), "lo", "none"))
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P)
  out.push(L(ticks.minor, "lo"), L(ticks.major, "mid"))
  const label: Plan = { x: -134, y: 29, w: 26, d: 11, r: 1.2 }
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), "lo"))
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), "faint"))
  for (const [from, to, y] of [
    [-130, -114, 32.4],
    [-130, -118, 34.6],
    [-130, -121, 36.8],
  ] as const)
    out.push(L(k.lineOnTop([from, y], [to, y], 0.8, P), "lo"))
  out.push(D([at(label.x + 2.2, label.y + 5.5, 0.8), at(label.x + label.w - 2.2, label.y + 5.5, 0.8)], 0.4))
  return out
}

function plinth(cx: number): Item[] {
  const plan: Plan = { x: cx - 12.5, y: CY - 14, w: 25, d: 27, r: 2 }
  return [S(k.slabOf(plan, 0, Z0, P, 4, 0.5), "lo"), D(k.corners(plan, 2.2).map(([x, y]) => at(x, y, Z0)), 0.38, "lo")]
}

// 01 Intake hopper: the one-line prompt drops in through a slot.
function intake(cx: number): Item[] {
  const cy = CY
  const body: Plan = { x: cx - 9, y: cy - 12, w: 18, d: 16, r: 2 }
  return [
    S(k.cylinder(cx, cy - 4, 3.8, Z0, 2, P, 24), "lo"),
    S(k.cylinder(cx, cy - 4, 2.6, Z0 + 2, 12, P, 24), "mid", "none"),
    L(k.sideArc(cx, cy - 4, 2.6, 9, P, 14), "faint"),
    S(k.slabOf(body, 16, 12, P, 6, 0.6), "mid"),
    L(k.planOutline(k.insetPlan(body, 2), 28, P, 6), "faint"),
    L(k.planOutline({ x: cx - 6.5, y: cy - 5.6, w: 13, d: 2.2, r: 1 }, 28, P, 4), "lo"),
    S(k.slabOf({ x: cx - 5, y: cy - 5.1, w: 10, d: 1.2, r: 0.3 }, 28, 5, P, 2), "hi", "lo"),
    D([at(cx - 7, cy - 10, 28), at(cx + 7, cy - 10, 28), at(cx - 7, cy + 2, 28), at(cx + 7, cy + 2, 28)], 0.4),
    S(k.cylinder(cx + 5.5, cy + 0.5, 1.8, 28, 2.2, P, 18), "mid"),
    L(k.knurl(cx + 5.5, cy + 0.5, 1.8, 28, 30.2, 16, P, 0.3), "lo"),
  ]
}

// 02 Sizing gate: three gauge blocks, Figure, Hero, Epic, and a rider.
const GATE = [
  { dx: -7.5, h: 4 },
  { dx: -1.5, h: 8 },
  { dx: 4.5, h: 13 },
]
export const GATE_X = GATE.map(({ dx }) => dx + 2.5)
function gate(cx: number): Item[] {
  const cy = CY
  const out: Item[] = [S(k.slabOf({ x: cx - 10, y: cy - 10, w: 20, d: 13, r: 1.5 }, Z0, 3, P, 4, 0.5), "mid")]
  for (const { dx, h } of GATE) {
    const plan: Plan = { x: cx + dx, y: cy - 8, w: 5, d: 9, r: 0.6 }
    out.push(S(k.slabOf(plan, Z0 + 3, h, P, 3, 0.4), "hi", "lo"))
    out.push(L(k.planOutline(k.insetPlan(plan, 1), Z0 + 3 + h, P, 3), "faint"))
  }
  const rail: Plan = { x: cx - 10, y: cy + 5, w: 20, d: 2.4, r: 0.8 }
  out.push(S(k.slabOf(rail, Z0, 2, P, 3), "lo"))
  out.push(D([at(cx - 8.6, cy + 6.2, Z0 + 2), at(cx + 8.6, cy + 6.2, Z0 + 2)], 0.35))
  return out
}
export const RIDER = (cx: number) => S(k.slabOf({ x: cx - 1.8, y: CY + 4.4, w: 3.6, d: 3.6, r: 0.7 }, Z0 + 2, 2.2, P, 3, 0.3), "hi", "lo")

// 03 Truth gauge: a dial gauge whose needle is the model's value.
const DIAL_R = 9
const DIAL_TOP = 21
function truth(cx: number): Item[] {
  const cy = CY
  const ticks = k.radialTicks(cx, cy, DIAL_R - 1.6, 40, 5, DIAL_TOP, [1, 2], P)
  return [
    S(k.slabOf({ x: cx - 7, y: cy - 7, w: 14, d: 14, r: 2 }, Z0, 2, P, 4, 0.4), "mid"),
    S(k.cylinder(cx, cy - DIAL_R - 0.6, 1.1, 18, 4, P, 14), "mid"),
    S(k.cylinder(cx, cy, 1.8, Z0 + 2, 12, P, 18), "mid", "none"),
    S(k.cylinder(cx, cy, DIAL_R, 16, DIAL_TOP - 16, P, 64, 0.8), "hi", "lo"),
    L(k.knurl(cx, cy, DIAL_R, DIAL_TOP - 2.4, DIAL_TOP, 60, P, 0.3), "lo"),
    L(k.sideArc(cx, cy, DIAL_R, DIAL_TOP - 2.4, P, 32), "faint"),
    L(k.ring(cx, cy, DIAL_R - 1.2, DIAL_TOP, P, 56), "lo"),
    L(ticks.minor, "lo"),
    L(ticks.major, "mid"),
    L(k.ring(cx, cy, 0.9, DIAL_TOP, P, 12), "hi"),
  ]
}
export function needleAt(cx: number, value: number) {
  const angle = value * Math.PI * 1.6
  const r = DIAL_R - 2.4
  return k.lineOnTop([cx - msin(angle) * 1.6, CY + mcos(angle) * 1.6], [cx + msin(angle) * r, CY - mcos(angle) * r], DIAL_TOP + 0.1, P)
}

// 04 Parts tray: forty pegs, the minimum parts list.
export const PEGS = 40
function parts(cx: number): Item[] {
  const cy = CY
  const tray: Plan = { x: cx - 11, y: cy - 11, w: 22, d: 21, r: 1.5 }
  const out: Item[] = [S(k.slabOf(tray, Z0, 3, P, 4, 0.5), "mid"), L(k.planOutline(k.insetPlan(tray, 1.6), Z0 + 3, P, 4), "faint")]
  const pegs: [number, number][] = []
  for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) pegs.push([cx - 8.4 + col * 2.4, cy - 7.5 + row * 3.6])
  for (const [x, y] of byDepth(pegs)) out.push(S(k.cylinder(x, y, 0.7, Z0 + 3, 2.4, P, 10), "hi", "none"))
  return out
}

// 05 Extrusion press: a plan on the die is lifted into a prism.
export const BLOCK_PLAN = (cx: number): Plan => ({ x: cx - 4.5, y: CY - 5, w: 9, d: 9, r: 0.8 })
export const BLOCK_Z = Z0 + 4
export const BLOCK_MAX = 13
function pressBack(cx: number): Item[] {
  const cy = CY
  return [
    S(k.slabOf({ x: cx - 10.5, y: cy - 11, w: 21, d: 19, r: 1.5 }, Z0, 3, P, 4, 0.5), "mid"),
    S(k.slabOf({ x: cx - 6.5, y: cy - 7, w: 13, d: 13, r: 1 }, Z0 + 3, 1, P, 3), "lo"),
    L(k.planOutline(k.insetPlan(BLOCK_PLAN(cx), -0.6), BLOCK_Z, P, 3), "lo"),
    S(k.cylinder(cx - 8, cy - 8.5, 1.3, Z0 + 3, 29, P, 14), "mid", "none"),
    S(k.cylinder(cx + 8, cy - 8.5, 1.3, Z0 + 3, 29, P, 14), "mid", "none"),
  ]
}
function pressFront(cx: number): Item[] {
  const cy = CY
  const head: Plan = { x: cx - 10.5, y: cy - 11, w: 21, d: 19, r: 1.5 }
  return [
    S(k.cylinder(cx - 8, cy + 5.5, 1.3, Z0 + 3, 29, P, 14), "mid", "none"),
    S(k.cylinder(cx + 8, cy + 5.5, 1.3, Z0 + 3, 29, P, 14), "mid", "none"),
    S(k.cylinder(cx, cy - 0.5, 2.6, 26, 8, P, 22), "mid"),
    L(k.sideArc(cx, cy - 0.5, 2.6, 29, P, 14), "faint"),
    S(k.slabOf(head, 34, 4, P, 4, 0.6), "mid"),
    D(byDepth(k.corners(head, 2.5)).map(([x, y]) => at(x, y, 38)), 0.42),
  ]
}
export const blockAt = (cx: number, h: number) => k.slabOf(BLOCK_PLAN(cx), BLOCK_Z, Math.max(0.3, h), P, 3, 0.4)

// 06 Painter's rack: cards dealt far to near, the order SVG paints in.
export const CARDS = [11, 8, 13, 9, 12].map((h, i) => ({ h, y: CY - 9 + i * 4.4 }))
function rackBase(cx: number): Item[] {
  const cy = CY
  const plan: Plan = { x: cx - 10.5, y: cy - 12, w: 21, d: 23, r: 1.5 }
  return [
    S(k.slabOf(plan, Z0, 3, P, 4, 0.5), "mid"),
    L(CARDS.map(({ y }) => k.lineOnTop([cx - 9, y], [cx + 9, y], Z0 + 3, P)).join(""), "faint"),
  ]
}
export const cardSolid = (cx: number, index: number) => {
  const { h, y } = CARDS[index]!
  return S(k.slabOf({ x: cx - 8, y: y - 0.6, w: 16, d: 1.2, r: 0.3 }, Z0 + 3, h, P, 2), "hi", "lo")
}

// 07 Shader chamber: glass between two electrodes; the plasma is WebGL.
export const CHAMBER = { r: 8, z0: 6.5, z1: 28, gap: [12.5, 22] as [number, number] }
function chamberBack(cx: number): Item[] {
  const cy = CY
  const { r, z0, z1 } = CHAMBER
  return [
    S(k.cylinder(cx, cy, r + 1.6, Z0, z0 - Z0, P, 40, 0.6), "mid"),
    L(k.knurl(cx, cy, r + 1.6, Z0 + 0.6, z0 - 0.6, 40, P, 0), "faint"),
    L(k.backArc(cx, cy, r, z0, P, 28), "lo"),
    L(k.backArc(cx, cy, r, z1, P, 28), "lo"),
    S(k.cylinder(cx, cy, 1.1, z0, CHAMBER.gap[0] - z0, P, 14), "mid", "none"),
    S(k.cylinder(cx, cy, 1.1, CHAMBER.gap[1], z1 - CHAMBER.gap[1], P, 14), "mid", "none"),
  ]
}
export function chamberFront(cx: number): Item[] {
  const cy = CY
  const { r, z0, z1 } = CHAMBER
  const [vx, vy] = k.towardViewer(P)
  const facing = matan2(vy, vx)
  const side = (angle: number) => k.segment([cx + r * mcos(angle), cy + r * msin(angle), z0], [cx + r * mcos(angle), cy + r * msin(angle), z1], P)
  return [
    L(k.sideArc(cx, cy, r, z0, P, 28), "lo"),
    L(side(facing - Math.PI / 2) + side(facing + Math.PI / 2), "lo"),
    L(side(facing - 0.9), "faint"),
    S(k.cylinder(cx, cy, r + 1.6, z1, 3, P, 40, 0.6), "mid"),
    D([at(cx - 5, cy - 5, z1 + 3), at(cx + 5, cy - 5, z1 + 3), at(cx - 5, cy + 5, z1 + 3), at(cx + 5, cy + 5, z1 + 3)], 0.4),
  ]
}
export const PLASMA_BOX = (cx: number): [number, number, number, number] => {
  const pts = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [CHAMBER.gap[0] - 3, CHAMBER.gap[1] + 3].map((z) => at(cx + sx * (CHAMBER.r - 0.5), CY + sy * (CHAMBER.r - 0.5), z))))
  const xs = pts.map(([x]) => x)
  const ys = pts.map(([, y]) => y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}
export const PLASMA_FALLBACK = (cx: number) => {
  const pts: Flat[] = []
  for (let i = 0; i <= 12; i++) {
    const z = CHAMBER.gap[0] + ((CHAMBER.gap[1] - CHAMBER.gap[0]) * i) / 12
    pts.push(at(cx + (i % 2 ? 0.6 : -0.6), CY, z))
  }
  return k.pathOf(pts)
}

// 08 Copy stand: one camera looking down at the framed card.
function copyStand(cx: number): Item[] {
  const cy = CY
  const card: Plan = { x: cx - 6.5, y: cy - 4, w: 13, d: 10, r: 0.5 }
  return [
    S(k.slabOf({ x: cx - 11, y: cy - 12, w: 22, d: 22, r: 1.5 }, Z0, 2, P, 4, 0.5), "mid"),
    S(k.slabOf(card, Z0 + 2, 0.6, P, 2), "hi", "none"),
    L(k.planOutline(k.insetPlan(card, 1.2), Z0 + 2.6, P, 2), "lo"),
    D(k.corners(card, 1.2).map(([x, y]) => at(x, y, Z0 + 2.6)), 0.4, "hi"),
    S(k.cylinder(cx, cy - 9.5, 2.6, Z0 + 2, 2, P, 20), "lo"),
    S(k.cylinder(cx, cy - 9.5, 1.5, Z0 + 4, 26, P, 16), "mid", "none"),
    S(k.cylinder(cx, cy + 1, 3.4, 23, 6, P, 28, 0.4), "hi", "lo"),
    L(k.sideArc(cx, cy + 1, 3.4, 25, P, 18) + k.sideArc(cx, cy + 1, 3.4, 26.5, P, 18), "faint"),
    S(k.slabOf({ x: cx - 1.4, y: cy - 11, w: 2.8, d: 13.5, r: 1 }, 29, 2.4, P, 3), "mid"),
    D([at(cx, cy - 9.5, 31.4), at(cx, cy + 1, 31.4)], 0.42),
  ]
}

// 09 Loupe: the 4x look and the line-end check.
function loupe(cx: number): Item[] {
  const cy = CY
  const card: Plan = { x: cx - 6.5, y: cy - 5, w: 13, d: 9, r: 0.4 }
  return [
    S(k.slabOf({ x: cx - 10.5, y: cy - 12, w: 21, d: 21, r: 1.5 }, Z0, 2, P, 4, 0.5), "mid"),
    S(k.slabOf(card, Z0 + 2, 0.5, P, 2), "hi", "none"),
    L(
      [0, 1, 2, 3, 4].map((i) => k.lineOnTop([cx - 5 + i * 2.5, cy - 4.2], [cx - 5 + i * 2.5, cy - 2.6 + (i % 2) * 0.8], Z0 + 2.5, P)).join("") +
        k.lineOnTop([cx - 5.6, cy - 4.2], [cx + 5.6, cy - 4.2], Z0 + 2.5, P),
      "lo",
    ),
    S(k.cylinder(cx, cy, 5.2, 14, 1.4, P, 40, 0.5), "hi", "lo"),
    L(k.ring(cx, cy, 4, 15.4, P, 36), "faint"),
    S(k.cylinder(cx + 8, cy, 2.4, Z0 + 2, 1.6, P, 18), "lo"),
    S(k.cylinder(cx + 8, cy, 1.3, Z0 + 3.6, 12.4, P, 14), "mid", "none"),
    S(k.slabOf({ x: cx + 3.6, y: cy - 1.3, w: 6, d: 2.6, r: 1 }, 16, 2, P, 3), "mid"),
    D([at(cx + 8, cy, 18)], 0.42),
  ]
}

// The carriage and the prompt card it carries, built at x = 0 and moved
// with translateAlong (kit/iso-kit.ts:437).
export const RAIL: Plan = { x: -136, y: 15, w: 272, d: 4, r: 1 }
function rail(): Item[] {
  const out: Item[] = [S(k.slabOf(RAIL, 0, 2.5, P, 3, 0.4), "mid")]
  out.push(D(STATION_X.map((x) => at(x, RAIL.y + 2, 2.5)), 0.4, "lo"))
  for (const x of [RAIL.x - 4.5, RAIL.x + RAIL.w + 0.5]) out.push(S(k.slabOf({ x, y: 11, w: 4, d: 12, r: 1 }, 0, 6, P, 3, 0.4), "mid"))
  return out
}
function carriage(): Item[] {
  const plan: Plan = { x: -7, y: 12, w: 14, d: 10, r: 2 }
  return [
    S(k.slabOf(plan, 2.5, 2.5, P, 4, 0.5), "mid"),
    D([at(-5, 20.4, 5), at(5, 20.4, 5)], 0.4, "lo"),
    S(k.slabOf({ x: -5.5, y: 15.6, w: 11, d: 1.3, r: 0.3 }, 5, 10, P, 2), "hi", "lo"),
    L(k.lineOnTop([-4, 16.9], [2.5, 16.9], 15, P) + k.lineOnTop([-4, 16.9], [0.5, 16.9], 15, P), "faint"),
  ]
}

export interface Station {
  id: number
  name: string
  object: string
  cite: string
  does: string
}

export const STATIONS: Station[] = [
  {
    id: 1,
    name: "Intake",
    object: "hopper",
    cite: "SKILL.md:2-3 · frontmatter description",
    does: "Until a request matches, Claude sees only the skill's name and this description. It names isometric figures, explainers and diagrams, so a plain ask for an explanatory figure routes here.",
  },
  {
    id: 2,
    name: "Size it",
    object: "gauge blocks",
    cite: "SKILL.md:54-58 · workflow step 1",
    does: "Figure (40-80 parts, about 30-90 min), Hero (80-150 parts, 2-4 h) or Epic (6 h or more, never started without asking). This bench is a Figure.",
  },
  {
    id: 3,
    name: "Truth first",
    object: "dial gauge",
    cite: "SKILL.md:59 · kit/react/live.tsx:101 spring()",
    does: "The real numbers go into a small pure model first; the motion, readout and caption all read from it. The needle here rides the kit's sub-stepped spring.",
  },
  {
    id: 4,
    name: "Parts list",
    object: "tray of 40 pegs",
    cite: "SKILL.md:61 · workflow step 4",
    does: "At least 40 parts, grouped base, structure, mechanism, controls and one lit subject, each sitting on another part, written before any geometry.",
  },
  {
    id: 5,
    name: "Build once",
    object: "extrusion press",
    cite: "kit/iso-kit.ts:156 extrude() · :236 slabOf()",
    does: "Every solid is a floor plan lifted into a prism: paper fill, four side tones by facing, a lighter top, a crease and an outline. Static paths are computed once.",
  },
  {
    id: 6,
    name: "Paint back to front",
    object: "card rack",
    cite: "kit/iso-kit.ts:65 depthOf() · kit/audit.mjs:1807 settle()",
    does: "SVG has no depth buffer, so parts are painted far to near by depthOf. Past a few dozen overlaps the audit ray-casts every pair and sets the order keys.",
  },
  {
    id: 7,
    name: "Shader layer",
    object: "plasma chamber",
    cite: "kit/gl.mjs:64 glLayer() · :1 GLSL_ISO",
    does: "Fire, water, plasma and light go in a WebGL canvas between a back and a front SVG, in the same camera: the GLSL repeats the kit's projection.",
  },
  {
    id: 8,
    name: "One camera, one card",
    object: "copy stand",
    cite: "kit/iso-kit.ts:54 iso() · kit/react/draw.tsx:163 Plate",
    does: "Every point goes through one orthographic projection, azimuth and elevation, then the figure sits in a card with number, title, hint and live readout.",
  },
  {
    id: 9,
    name: "Verify like a critic",
    object: "loupe",
    cite: "SKILL.md:67-73 · scripts/lines.mjs",
    does: "Screenshots at desktop and 390 px, contact sheets of motion, 4x close-ups of every joint, and a check that fails any line ending in mid-air.",
  },
]

export interface Art {
  base: Item[]
  stations: { back: Item[]; front: Item[] }[]
  rail: Item[]
  carriage: Item[]
  chamberFront: Item[]
  solids: number
}

function build(): Art {
  solids = 0
  const builders: [(cx: number) => Item[], (cx: number) => Item[]][] = [
    [intake, () => []],
    [gate, () => []],
    [truth, () => []],
    [parts, () => []],
    [pressBack, pressFront],
    [rackBase, () => []],
    [chamberBack, () => []],
    [copyStand, () => []],
    [loupe, () => []],
  ]
  const art: Art = {
    base: base(),
    stations: STATION_X.map((cx, i) => {
      const [back, front] = builders[i]!
      return { back: [...plinth(cx), ...back(cx)], front: front(cx) }
    }),
    rail: rail(),
    carriage: carriage(),
    chamberFront: chamberFront(STATION_X[6]!),
    solids: 0,
  }
  RIDER(0)
  blockAt(0, 1)
  CARDS.forEach((_, i) => cardSolid(0, i))
  art.solids = solids
  return art
}

export const ART = build()
