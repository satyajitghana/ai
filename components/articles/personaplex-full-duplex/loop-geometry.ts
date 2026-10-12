// The loop deck's world, built once at module load with the port of Anatomy's
// kit (components/articles/anatomy-machine-skill/iso-kit.ts). World units are
// about one px of the drawing, x and y on the floor, z up.
//
// The object: a deck with one platter whose top carries 17 concentric tracks,
// a record head on an arm over them, a 16-contact stepping switch with a bin
// beside it, and a microphone. The platter is the temporal transformer's KV
// ring: one turn is CONTEXT frames, so a frame written at the head comes back
// under it exactly CONTEXT frames later and is recorded over. Static parts are
// path strings here; the tape's contents, the index mark, the hub screws, the
// wiper and the falling chip are rebuilt per frame by the exported builders.

import { mcos, msin } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import type { Flat, Plan, Plane, SolidPaths, Tone, LineTone } from "@/components/articles/anatomy-machine-skill/iso-kit"
import { CONTEXT, DEP_Q, inView } from "./loop-model"

export const WIDTH = 640
export const HEIGHT = 330
export const AZIMUTH = 58
export const ELEVATION = 34

export type Item =
  | { kind: "solid"; paths: SolidPaths; tone: Tone; crease?: Tone | "none" }
  | { kind: "line"; d: string; tone: LineTone }
  | { kind: "dots"; points: Flat[]; size: number; tone: Tone }
  | { kind: "halo"; d: string }

const PLATE: Plan = { x: -124, y: -62, w: 236, d: 118, r: 8 }
const PLATE_H = 10
const FOOT_H = 5

// Platter
const PC: Plane = [-58, 0]
const PLATTER_R = 54
const PLATTER_Z = 8
export const TOP = 14
// Tracks, outer to inner: the agent's text, its 8 codebooks, the user's 8.
const PITCH = 1.575
export const TEXT_BAND: [number, number] = [50.4, 52.6]
export const AGENT_BAND: [number, number] = [36.2, 36.2 + 8 * PITCH]
export const USER_BAND: [number, number] = [22, 22 + 8 * PITCH]
// The head reaches in over the tracks from a post outside the platter, at the
// front right, so the frames it has just written turn toward the reader.
const HEAD_ANGLE = (25 * Math.PI) / 180
const POST_R = 62
const STEP = (Math.PI * 2) / CONTEXT // one frame of platter turn

// Stepping switch
const TC: Plane = [52, -30]
const BANK_R = 13.5
const TURRET_Z = 7
const CONTACT_H = 3
const contactAngle = (i: number) => ((148 - i * 12) * Math.PI) / 180

// Bin
const BIN: Plan = { x: 78, y: -48, w: 30, d: 30, r: 1 }
const WALL = 1.2
const BIN_H = 10
export const CHIP_FROM: [number, number, number] = [91.5, -33, 9.6]
export const CHIP_FLOOR = WALL

// Microphone
const MC: Plane = [40, 30]

// Record head

const POST: Plane = [PC[0] + POST_R * mcos(HEAD_ANGLE), PC[1] + POST_R * msin(HEAD_ANGLE)]

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [POST[0], POST[1], 27], [MC[0], MC[1], 24], [PC[0], PC[1], 19]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: AZIMUTH, elevation: ELEVATION },
)

export const at = (x: number, y: number, z: number) => k.iso([x, y, z], P)
const byDepth = <T extends [number, number]>(points: T[]) =>
  [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))
const polar = (c: Plane, r: number, a: number): Plane => [c[0] + r * mcos(a), c[1] + r * msin(a)]

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
  // Label plate: three rule lines that stand for printed text.
  const label: Plan = { x: -6, y: 38, w: 28, d: 12, r: 1.2 }
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), "lo"))
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), "faint"))
  for (const [to, y] of [
    [12, 41.6],
    [8, 44],
    [5, 46.4],
  ] as const)
    out.push(L(k.lineOnTop([-2, y], [to, y], 0.8, P), "lo"))
  out.push(D([at(label.x + 2.2, label.y + 6, 0.8), at(label.x + label.w - 2.2, label.y + 6, 0.8)], 0.4))
  return out
}

// Wires lie on the plate and run under the parts they connect, so both ends
// end under a fill painted after them.
function wires(): Item[] {
  const [px, py] = POST
  const stepperToHead: Plane[] = [
    [35, -27],
    [20, -27],
    [px + 2, py - 2],
  ]
  const micToHead: Plane[] = [
    [MC[0] - 4, MC[1]],
    [px + 12, py + 4],
    [px + 2, py + 1],
  ]
  return [L(k.onTop(stepperToHead, 0.05, P), "mid"), L(k.onTop(micToHead, 0.05, P), "mid")]
}

// The drive: a motor whose rubber idler wheel turns the platter at its rim.
function motor(): Item[] {
  const [mx, my] = polar(PC, PLATTER_R + 4, (150 * Math.PI) / 180)
  return [
    S(k.cylinder(mx, my, 6, 0, 7, P, 32, 0.5), "mid"),
    L(k.sideArc(mx, my, 6, 3.5, P, 20), "faint"),
    S(k.cylinder(mx, my, 1.2, 7, 1, P, 12), "mid", "none"),
    S(k.cylinder(mx, my, 4, PLATTER_Z, 5, P, 28), "lo"),
    L(k.knurl(mx, my, 4, PLATTER_Z, PLATTER_Z + 5, 28, P, 0.5), "faint"),
  ]
}

function platter(): Item[] {
  const [cx, cy] = PC
  return [
    S(k.cylinder(cx, cy, 20, 0, PLATTER_Z, P, 48, 0.6), "mid"),
    L(k.sideArc(cx, cy, 20, 4, P, 28), "faint"),
    S(k.cylinder(cx, cy, PLATTER_R, PLATTER_Z, TOP - PLATTER_Z, P, 96, 1), "hi", "lo"),
    L(k.knurl(cx, cy, PLATTER_R, PLATTER_Z, TOP, 140, P, 0.9), "faint"),
  ]
}

// Track rings: band edges lo, dividers faint.
function tracks(): Item[] {
  const [cx, cy] = PC
  const edges = [TEXT_BAND[0], TEXT_BAND[1], AGENT_BAND[0], AGENT_BAND[1], USER_BAND[0], USER_BAND[1]]
  const dividers: number[] = []
  for (let i = 1; i < 8; i++) dividers.push(AGENT_BAND[0] + i * PITCH, USER_BAND[0] + i * PITCH)
  return [L(dividers.map((r) => k.ring(cx, cy, r, TOP, P, 120)).join(""), "faint"), L(edges.map((r) => k.ring(cx, cy, r, TOP, P, 120)).join(""), "lo")]
}

function hub(): Item[] {
  const [cx, cy] = PC
  return [S(k.cylinder(cx, cy, 10, TOP, 2, P, 40, 0.5), "mid"), L(k.ring(cx, cy, 13, TOP, P, 48), "faint")]
}
function hubCap(): Item[] {
  const [cx, cy] = PC
  return [S(k.cylinder(cx, cy, 4.6, TOP + 2, 3, P, 28, 0.4), "hi", "lo"), D([at(cx, cy, TOP + 5)], 0.5, "hi")]
}

function stepper(): Item[] {
  const [cx, cy] = TC
  const plan: Plan = { x: cx - 20, y: cy - 19, w: 40, d: 38, r: 3 }
  const out: Item[] = [
    S(k.slabOf(plan, 0, 4, P, 4, 0.6), "mid"),
    D(k.corners(plan, 2.4).map(([x, y]) => at(x, y, 4)), 0.42),
    S(k.cylinder(cx, cy, 17, 4, TURRET_Z - 4, P, 64, 0.6), "mid"),
    L(k.ring(cx, cy, BANK_R, TURRET_Z, P, 56), "faint"),
  ]
  const contacts = Array.from({ length: DEP_Q }, (_, i) => ({ i, at: polar(TC, BANK_R, contactAngle(i)) }))
  contacts.sort((a, b) => k.depthOf([a.at[0], a.at[1], 0], P) - k.depthOf([b.at[0], b.at[1], 0], P))
  for (const { i, at: [x, y] } of contacts) out.push(S(k.cylinder(x, y, 1.15, TURRET_Z, CONTACT_H, P, 14), i < 8 ? "hi" : "mid", "none"))
  out.push(S(k.cylinder(cx, cy, 2, TURRET_Z, 3.4, P, 18), "mid", "none"))
  out.push(S(k.cylinder(cx, cy, 3.2, TURRET_Z + 3.4, 1.6, P, 24, 0.3), "hi", "lo"))
  return out
}

const WIPER_Z = TURRET_Z + CONTACT_H + 0.4
export function wiperAt(position: number) {
  // contactAngle is linear in the step index, so a fractional position is the
  // wiper between two contacts.
  const angle = contactAngle(position)
  const from = polar(TC, 3.2, angle)
  const to = polar(TC, BANK_R, angle)
  return { d: k.lineOnTop(from, to, WIPER_Z, P), tip: at(to[0], to[1], WIPER_Z) }
}

function binBack(): Item[] {
  const { x, y, w, d } = BIN
  return [
    S(k.slabOf(BIN, 0, WALL, P, 4, 0.3), "lo"),
    S(k.slabOf({ x, y, w: WALL, d, r: 0.3 }, WALL, BIN_H - WALL, P, 2), "mid"),
    S(k.slabOf({ x: x + WALL, y, w: w - WALL, d: WALL, r: 0.3 }, WALL, BIN_H - WALL, P, 2), "mid"),
  ]
}
// The discarded predictions already in the bin.
const PILE: [number, number, number][] = [
  [86, -40, 0],
  [96, -37, 0],
  [90, -29, 0],
  [100, -27, 0],
  [96, -36.8, 1],
]
function pile(): Item[] {
  return [...PILE]
    .sort((p, q) => k.depthOf(p, P) - k.depthOf(q, P))
    .map(([px, py, lift]) => S(chipAt(px, py, WALL + lift), "lo"))
}
export function chipAt(x: number, y: number, z: number) {
  return k.slabOf({ x: x - 1.6, y: y - 1.6, w: 3.2, d: 3.2, r: 0.5 }, z, 1, P, 2, 0.2)
}
function spout(): Item[] {
  const plan: Plan = { x: 64, y: -36, w: 26.5, d: 6, r: 1 }
  return [
    S(k.slabOf({ x: 63.5, y: -35.5, w: 5, d: 5, r: 0.6 }, TURRET_Z, BIN_H - TURRET_Z, P, 3), "mid"),
    S(k.slabOf(plan, BIN_H, 1.4, P, 3, 0.3), "mid"),
    L(k.planOutline({ x: 66, y: -34.4, w: 22.5, d: 2.8, r: 1.2 }, BIN_H + 1.4, P, 4), "lo"),
  ]
}
function binFront(): Item[] {
  const { x, y, w, d } = BIN
  const front: Plan = { x, y: y + d - WALL, w, d: WALL, r: 0.3 }
  const side: Plan = { x: x + w - WALL, y, w: WALL, d: d - WALL, r: 0.3 }
  return [
    S(k.slabOf(side, WALL, BIN_H - WALL, P, 2), "mid"),
    S(k.slabOf(front, WALL, BIN_H - WALL, P, 2), "mid"),
  ]
}

// A rounded rectangle laid along the head's radius: `from` and `to` are radii
// from the platter centre, `half` the half-width across it.
function radialBar(from: number, to: number, half: number, r: number) {
  const c = mcos(HEAD_ANGLE)
  const sn = msin(HEAD_ANGLE)
  return k.roundedPlan({ x: from, y: -half, w: to - from, d: half * 2, r }, 3).map(([u, v]) => [PC[0] + u * c - v * sn, PC[1] + u * sn + v * c] as Plane)
}
const along = (r: number): Plane => polar(PC, r, HEAD_ANGLE)

function head(): Item[] {
  const [px, py] = POST
  const shoe = radialBar(USER_BAND[0] - 0.8, TEXT_BAND[1] + 0.8, 3.6, 0.6)
  const arm = radialBar(USER_BAND[0] - 3, POST_R - 5, 2.8, 1)
  const clamp = radialBar(POST_R - 5, POST_R + 5, 4.5, 1.5)
  const screwAt = (r: number, side: number, z: number) => {
    const [x, y] = along(r)
    return at(x - side * msin(HEAD_ANGLE), y + side * mcos(HEAD_ANGLE), z)
  }
  const end0 = along(USER_BAND[0] - 1.5)
  const end1 = along(POST_R - 6.5)
  return [
    S(k.cylinder(px, py, 5, 0, 2.5, P, 32, 0.4), "lo"),
    S(k.cylinder(px, py, 2.6, 2.5, 14, P, 20), "mid", "none"),
    L(k.sideArc(px, py, 2.6, 9, P, 14), "faint"),
    S(k.extrude(shoe, TOP + 0.25, 3.75, P, 0.3), "hi", "lo"),
    S(k.extrude(arm, 18, 2.5, P, 0.4), "mid"),
    D([at(end0[0], end0[1], 20.5), at(end1[0], end1[1], 20.5)], 0.4),
    S(k.extrude(clamp, 16.5, 6, P, 0.5), "mid"),
    D([screwAt(POST_R - 3, -3, 22.5), screwAt(POST_R - 3, 3, 22.5), screwAt(POST_R + 3, -3, 22.5), screwAt(POST_R + 3, 3, 22.5)], 0.4),
    S(k.cylinder(px, py, 2.6, 22.5, 3.5, P, 24, 0.3), "hi", "lo"),
    L(k.knurl(px, py, 2.6, 22.5, 26, 22, P, 0.5), "lo"),
  ]
}

function mic(): Item[] {
  const [cx, cy] = MC
  return [
    S(k.cylinder(cx, cy, 7, 0, 2, P, 40, 0.5), "mid"),
    S(k.cylinder(cx, cy, 0.9, 2, 10, P, 12), "mid", "none"),
    S(k.cylinder(cx, cy, 2, 12, 1.5, P, 18), "mid"),
    S(k.cylinder(cx, cy, 3.6, 13.5, 8.5, P, 32), "hi", "lo"),
    L(k.knurl(cx, cy, 3.6, 13.5, 22, 30, P, 0.8), "faint"),
    L(k.sideArc(cx, cy, 3.6, 16, P, 16), "lo"),
    S(k.cylinder(cx, cy, 3.1, 22, 1, P, 28, 0.3), "mid"),
  ]
}

// ---- Rebuilt per frame -------------------------------------------------------

const angleOf = (written: number, frame: number) => HEAD_ANGLE + (written - frame - 0.5) * STEP

function arcPoints(r: number, a0: number, a1: number, z: number) {
  const count = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 120)))
  const out: Flat[] = []
  for (let i = 0; i <= count; i++) {
    const a = a0 + ((a1 - a0) * i) / count
    const [x, y] = polar(PC, r, a)
    out.push(at(x, y, z))
  }
  return out
}
function sector([r0, r1]: [number, number], a0: number, a1: number) {
  return k.pathOf([...arcPoints(r1, a0, a1, TOP), ...arcPoints(r0, a1, a0, TOP)], true)
}
// Sine dots ride the user's tracks, one dot every m frames, m chosen per ring
// so the dots sit about 1.6 units apart.
const SINE_RINGS = Array.from({ length: 8 }, (_, i) => {
  const r = USER_BAND[0] + (i + 0.5) * PITCH
  return { r, every: Math.ceil(1.6 / (r * STEP)) }
})
const DOT = 0.55
function dotPath(points: Flat[]) {
  return points.map(([x, y]) => `M${(x - DOT).toFixed(1)} ${y.toFixed(1)}a${DOT} ${DOT} 0 1 0 ${2 * DOT} 0a${DOT} ${DOT} 0 1 0 ${-2 * DOT} 0`).join("")
}

export interface Tape {
  voice: string
  text: string
  call: string
  sine: string
  index: string
  screws: Flat[]
}

export function tapeAt(written: number): Tape {
  const out = { voice: "", text: "", call: "", sine: [] as Flat[] }
  for (const { kind, from, to } of inView(written)) {
    const a0 = angleOf(written, to - 0.5) // newest edge of the run
    const a1 = angleOf(written, from - 0.5) // oldest edge
    if (kind === "voice") out.voice += sector(AGENT_BAND, a0, a1)
    if (kind === "text") out.text += sector(TEXT_BAND, a0, a1)
    if (kind === "call") out.call += sector([USER_BAND[0], TEXT_BAND[1]], a0, a1)
    if (kind !== "call")
      for (const { r, every } of SINE_RINGS)
        for (let g = Math.ceil(from / every) * every; g < to; g += every) {
          const [x, y] = polar(PC, r, angleOf(written, g))
          out.sine.push(at(x, y, TOP))
        }
  }
  // Slot 0 of the ring, where frames 0, 3000, 6000 ... are written.
  const zero = angleOf(written, 0) + 0.5 * STEP
  const index = k.onTop([polar(PC, TEXT_BAND[1], zero), polar(PC, PLATTER_R, zero)], TOP, P)
  const screws = [0, 1, 2, 3].map((q) => {
    const [x, y] = polar(PC, 7.6, zero + (q * Math.PI) / 2)
    return at(x, y, TOP + 2)
  })
  return { voice: out.voice, text: out.text, call: out.call, sine: dotPath(out.sine), index, screws }
}

export interface Art {
  base: Item[]
  wires: Item[]
  motor: Item[]
  platter: Item[]
  tracks: Item[]
  hub: Item[]
  hubCap: Item[]
  stepper: Item[]
  binBack: Item[]
  pile: Item[]
  spout: Item[]
  binFront: Item[]
  head: Item[]
  mic: Item[]
  solids: number
}

function build(): Art {
  solids = 0
  const art: Art = {
    base: base(),
    wires: wires(),
    motor: motor(),
    platter: platter(),
    tracks: tracks(),
    hub: hub(),
    hubCap: hubCap(),
    stepper: stepper(),
    binBack: binBack(),
    pile: pile(),
    spout: spout(),
    binFront: binFront(),
    head: head(),
    mic: mic(),
    solids: 0,
  }
  art.solids = solids + 1 // and the falling chip, built per frame
  return art
}

export const ART = build()
