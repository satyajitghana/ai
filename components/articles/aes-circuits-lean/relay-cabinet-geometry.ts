// The relay bench's world, built once at module load with the site's port of
// the Anatomy kit. World units are about one px of the drawing; x runs along
// the bench (the signal's direction), y toward the viewer, z up.
//
// Parts, left to right: a bank of eight slide switches (the input byte), a bus
// strip, four relay trays (Top, MUL1, Inverter, Bottom: the blocks of Table 2,
// one socket per gate, square cans for AND and round cans for XOR), a bus
// strip between each, a bank of eight lamps (the output byte) and a dial gauge
// with forty divisions that counts gate levels. A rotary selector in front
// picks which circuit is racked. Everything static is a path string here; the
// moving parts (relays, switch knobs, needle, selector pointer) are built at
// rest and moved, or rebuilt, by the live component.

import { mcos, msin } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import type { Flat, LineTone, Plan, SolidPaths, Tone } from "@/components/articles/anatomy-machine-skill/iso-kit"
import { BLOCKS, DIAL_LEVELS, ROWS, SOCKETS } from "./relay-cabinet-model"

export const WIDTH = 640
export const HEIGHT = 250
export const AZIMUTH = 68
export const ELEVATION = 34

export type Item =
  | { kind: "solid"; paths: SolidPaths; tone: Tone; crease?: Tone | "none"; className?: string }
  | { kind: "line"; d: string; tone: LineTone; free?: boolean }
  | { kind: "dots"; points: Flat[]; size: number; tone: Tone }
  | { kind: "halo"; d: string }

let solids = 0
const S = (paths: SolidPaths, tone: Tone = "mid", crease: Tone | "none" = "faint", className?: string): Item => {
  solids += 1
  return { kind: "solid", paths, tone, crease, className }
}
const L = (d: string, tone: LineTone = "lo", free = false): Item => ({ kind: "line", d, tone, free })
const D = (points: Flat[], size = 0.45, tone: Tone = "mid"): Item => ({ kind: "dots", points, size, tone })

// ---- layout -------------------------------------------------------------
const CY = -4
const GAP = 7
const PITCH = 3.8
const RACK_ROWS = 4
const PAD = 2.4
const TRAY_H = 3
const TRAY_D = RACK_ROWS * PITCH + PAD * 2
const BANK_W = 31
const BANK_H = 5
const DIAL_R = 10
const DIAL_TOP = 17

const COLS = SOCKETS.map(({ and, xor }) => Math.ceil((and + xor) / RACK_ROWS))
let cursor = -136
const INPUT_X = cursor
cursor += BANK_W + GAP
export const TRAY_X = COLS.map((cols) => {
  const x = cursor
  cursor += cols * PITCH + PAD * 2 + GAP
  return x
})
const LAMP_X = cursor
cursor += BANK_W + GAP
export const DIAL_CX = cursor + DIAL_R - 1
const RIGHT = DIAL_CX + DIAL_R
const PLATE: Plan = { x: INPUT_X - 9, y: -20, w: RIGHT + 9 - (INPUT_X - 9), d: 44, r: 8 }
const PLATE_H = 8
const FOOT_H = 5
export const SELECT = { cx: TRAY_X[2]! - GAP / 2, cy: 13 }

const trayPlan = (b: number): Plan => ({ x: TRAY_X[b]!, y: CY - TRAY_D / 2, w: COLS[b]! * PITCH + PAD * 2, d: TRAY_D, r: 1.4 })

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [DIAL_CX, CY - DIAL_R, DIAL_TOP], [DIAL_CX + DIAL_R, CY, DIAL_TOP], [DIAL_CX, CY + DIAL_R, DIAL_TOP]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: AZIMUTH, elevation: ELEVATION },
)

const at = (x: number, y: number, z: number) => k.iso([x, y, z], P)
const depth = (x: number, y: number, z = 0) => k.depthOf([x, y, z], P)
const byDepth = <T extends [number, number]>(points: T[]) => [...points].sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1]))

// ---- base -----------------------------------------------------------------
function base(): Item[] {
  const out: Item[] = [{ kind: "halo", d: k.slabOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P).fill }]
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H, 1.6, P, 28), "lo"))
    out.push(S(k.cylinder(x, y, 4.6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), "mid"))
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), "mid"))
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), "lo"))
  const screws = k.corners(PLATE, 9.5)
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), "lo"))
  out.push(D(screws.map(([x, y]) => at(x, y, 0)), 0.5))
  // a ruler strip along the front edge, ticks rooted on its back edge
  const strip: Plan = { x: TRAY_X[2]! + 6, y: PLATE.y + PLATE.d - 13, w: LAMP_X + BANK_W - TRAY_X[2]! - 6, d: 5.5, r: 1 }
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), "lo", "none"))
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 3.8, 5, strip.y + 0.6, 0.6, [1.6, 3.2], P)
  out.push(L(ticks.minor, "lo"), L(ticks.major, "mid"))
  // label plate with three rule lines standing for engraved text
  const label: Plan = { x: INPUT_X - 1, y: PLATE.y + PLATE.d - 15, w: 26, d: 10, r: 1.2 }
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), "lo"))
  out.push(L(k.planOutline(k.insetPlan(label, 1.3), 0.8, P, 4), "faint"))
  const ruleY = label.y + 3.4
  for (const [len, dy] of [
    [17, 0],
    [12, 1.9],
    [14.5, 3.8],
  ] as const)
    out.push(L(k.lineOnTop([label.x + 4, ruleY + dy], [label.x + 4 + len, ruleY + dy], 0.8, P), "lo", true))
  out.push(D([at(label.x + 2.2, label.y + label.d / 2, 0.8), at(label.x + label.w - 2.2, label.y + label.d / 2, 0.8)], 0.4))
  return out
}

// ---- input switch bank ----------------------------------------------------
const SWITCH_PITCH = 3.4
export const SWITCH_X = Array.from({ length: 8 }, (_, i) => INPUT_X + BANK_W / 2 + (i - 3.5) * SWITCH_PITCH)
export const SWITCH_THROW = 4.6
const KNOB_Y0 = CY - 3.6
function bank(x0: number, kind: "in" | "out"): Item[] {
  const plan: Plan = { x: x0, y: CY - 9, w: BANK_W, d: 18, r: 2 }
  const out: Item[] = [S(k.slabOf(plan, 0, BANK_H, P, 6, 0.6), "mid")]
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), BANK_H, P, 6), "faint"))
  out.push(D(k.corners(plan, 1.9).map(([x, y]) => at(x, y, BANK_H)), 0.42))
  // a header strip at the back edge with one terminal per bit
  const header: Plan = { x: x0 + 2.4, y: CY - 7.6, w: BANK_W - 4.8, d: 2.2, r: 0.6 }
  out.push(S(k.slabOf(header, BANK_H, 1.2, P, 3), "lo"))
  out.push(D(SWITCH_X.map((sx) => at(sx - INPUT_X + x0, CY - 6.5, BANK_H + 1.2)), 0.38, "hi"))
  if (kind === "in") {
    for (const sx of SWITCH_X) out.push(L(k.planOutline({ x: sx - 0.85, y: KNOB_Y0 - 1.6, w: 1.7, d: SWITCH_THROW + 3.2, r: 0.85 }, BANK_H, P, 4), "lo"))
  }
  return out
}
const knobSolid = (i: number) =>
  S(k.slabOf({ x: SWITCH_X[i]! - 1.2, y: KNOB_Y0 - 1.2, w: 2.4, d: 2.4, r: 0.5 }, BANK_H, 2.6, P, 3, 0.3), "hi", "lo")
export const knobOffset = (on: number) => k.translateAlong(P, [0, on * SWITCH_THROW, 0])

export const LAMP_XS = SWITCH_X.map((sx) => sx - INPUT_X + LAMP_X)
const LAMP_Y = CY + 1
const lampParts = (i: number) => ({
  bezel: S(k.cylinder(LAMP_XS[i]!, LAMP_Y, 1.5, BANK_H, 1, P, 20), "mid"),
  lens: S(k.cylinder(LAMP_XS[i]!, LAMP_Y, 1.05, BANK_H + 1, 0.8, P, 18), "hi", "lo"),
})

// ---- bus strips -----------------------------------------------------------
function bus(x0: number, x1: number): Item[] {
  const plan: Plan = { x: x0 - 0.4, y: CY - 6.5, w: x1 - x0 + 0.8, d: 13, r: 0.6 }
  const out: Item[] = [S(k.slabOf(plan, 0, 0.8, P, 3), "lo")]
  const traces: string[] = []
  for (let i = 0; i < 8; i++) {
    const y = CY - 5.25 + i * 1.5
    traces.push(k.lineOnTop([plan.x, y], [plan.x + plan.w, y], 0.8, P))
  }
  out.push(L(traces.join(""), "faint"))
  return out
}

// ---- relay trays ----------------------------------------------------------
export interface Relay {
  block: number
  socket: number
  and: boolean
  xorIndex: number
  item: Item
  cap: Item
  key: number
}
const socketAt = (b: number, s: number): [number, number] => {
  const plan = trayPlan(b)
  const col = Math.floor(s / RACK_ROWS)
  const row = s % RACK_ROWS
  return [plan.x + PAD + PITCH / 2 + col * PITCH, plan.y + PAD + PITCH / 2 + row * PITCH]
}
function trayBase(b: number): Item[] {
  const plan = trayPlan(b)
  const out: Item[] = [S(k.slabOf(plan, 0, TRAY_H, P, 4, 0.5), "mid")]
  out.push(L(k.planOutline(k.insetPlan(plan, 1.1), TRAY_H, P, 4), "faint"))
  const { and, xor } = SOCKETS[b]!
  const rings: string[] = []
  for (let s = 0; s < and + xor; s++) {
    const [x, y] = socketAt(b, s)
    rings.push(s < and ? k.planOutline({ x: x - 1.55, y: y - 1.55, w: 3.1, d: 3.1, r: 0.5 }, TRAY_H, P, 3) : k.ring(x, y, 1.55, TRAY_H, P, 18))
  }
  out.push(L(rings.join(""), "lo"))
  out.push(D(byDepth(k.corners(plan, 0.75)).map(([x, y]) => at(x, y, TRAY_H)), 0.32))
  return out
}
function relays(b: number): Relay[] {
  const { and, xor } = SOCKETS[b]!
  const out: Relay[] = []
  for (let s = 0; s < and + xor; s++) {
    const [x, y] = socketAt(b, s)
    const isAnd = s < and
    const item = isAnd
      ? S(k.slabOf({ x: x - 1.3, y: y - 1.3, w: 2.6, d: 2.6, r: 0.45 }, TRAY_H, 4, P, 3, 0.25), "hi", "lo", "and")
      : S(k.cylinder(x, y, 1.25, TRAY_H, 3.2, P, 16), "hi", "lo")
    const cap = isAnd ? D([at(x, y, TRAY_H + 4)], 0.42, "hi") : L(k.ring(x, y, 0.55, TRAY_H + 3.2, P, 12), "lo")
    out.push({ block: b, socket: s, and: isAnd, xorIndex: isAnd ? -1 : s - and, item, cap, key: depth(x, y) })
  }
  return out.sort((a, c) => a.key - c.key)
}
export const relayLift = (gone: number) => k.translateAlong(P, [0, 0, gone * 9])

// ---- depth gauge ----------------------------------------------------------
function gauge(): Item[] {
  const cx = DIAL_CX
  const cy = CY
  const ticks = k.radialTicks(cx, cy, DIAL_R - 1.6, DIAL_LEVELS, 5, DIAL_TOP, [1, 2.1], P)
  const foot: Plan = { x: cx - 8, y: cy - 8, w: 16, d: 16, r: 2 }
  return [
    S(k.slabOf(foot, 0, 2, P, 4, 0.4), "mid"),
    D(byDepth(k.corners(foot, 1.8)).map(([x, y]) => at(x, y, 2)), 0.38),
    S(k.cylinder(cx, cy, 2.6, 2, 1.4, P, 20), "lo"),
    S(k.cylinder(cx, cy, 1.9, 3.4, DIAL_TOP - 4 - 3.4, P, 20), "mid", "none"),
    L(k.sideArc(cx, cy, 1.9, 8, P, 14), "faint"),
    S(k.cylinder(cx, cy - DIAL_R - 0.7, 1.2, DIAL_TOP - 3.4, 3.4, P, 14), "mid"),
    S(k.cylinder(cx, cy, DIAL_R, DIAL_TOP - 4, 4, P, 64, 0.8), "hi", "lo"),
    L(k.knurl(cx, cy, DIAL_R, DIAL_TOP - 2.4, DIAL_TOP, 64, P, 0.3), "lo"),
    L(k.sideArc(cx, cy, DIAL_R, DIAL_TOP - 2.4, P, 32), "faint"),
    L(k.ring(cx, cy, DIAL_R - 1.2, DIAL_TOP, P, 64), "lo"),
    L(ticks.minor, "lo"),
    L(ticks.major, "mid"),
    L(k.lineOnTop([cx, cy - (DIAL_R - 1.2)], [cx, cy - (DIAL_R - 4.4)], DIAL_TOP, P), "hi"),
  ]
}
export function needleAt(levels: number) {
  const angle = (levels / DIAL_LEVELS) * Math.PI * 2
  const r = DIAL_R - 2.4
  const cx = DIAL_CX
  return k.lineOnTop([cx - msin(angle) * 1.8, CY + mcos(angle) * 1.8], [cx + msin(angle) * r, CY - mcos(angle) * r], DIAL_TOP + 0.05, P)
}
export const HUB = k.ring(DIAL_CX, CY, 0.9, DIAL_TOP + 0.05, P, 12)

// ---- rotary selector ------------------------------------------------------
const SEL_R = 3.2
const SEL_Z = 1.6
const SEL_H = 2.8
export const SELECT_ANGLES = [-0.8, 0, 0.8]
function selector(): Item[] {
  const { cx, cy } = SELECT
  const plate: Plan = { x: cx - 7, y: cy - 5.5, w: 14, d: 11, r: 1.6 }
  const detents = SELECT_ANGLES.map((a) => at(cx + msin(a) * 5.4, cy - mcos(a) * 5.4, SEL_Z))
  return [
    S(k.slabOf(plate, 0, SEL_Z, P, 4, 0.4), "mid"),
    D(detents, 0.5, "hi"),
    D(byDepth([
      [plate.x + 1.6, plate.y + plate.d - 1.6],
      [plate.x + plate.w - 1.6, plate.y + plate.d - 1.6],
    ]).map(([x, y]) => at(x, y, SEL_Z)), 0.38),
    S(k.cylinder(cx, cy, SEL_R + 0.6, SEL_Z, 0.8, P, 28), "lo"),
    S(k.cylinder(cx, cy, SEL_R, SEL_Z + 0.8, SEL_H, P, 32, 0.4), "hi", "lo"),
    L(k.knurl(cx, cy, SEL_R, SEL_Z + 0.8, SEL_Z + 0.8 + SEL_H, 36, P, 0.3), "lo"),
  ]
}
export function pointerAt(angle: number) {
  const { cx, cy } = SELECT
  const z = SEL_Z + 0.8 + SEL_H
  return k.lineOnTop([cx - msin(angle) * 0.6, cy + mcos(angle) * 0.6], [cx + msin(angle) * (SEL_R - 0.5), cy - mcos(angle) * (SEL_R - 0.5)], z, P)
}

// ---- assembly -------------------------------------------------------------
export interface Art {
  base: Item[]
  input: Item[]
  buses: Item[][]
  trays: Item[][]
  relays: Relay[][]
  lampBank: Item[]
  gauge: Item[]
  selector: Item[]
  knobs: Item[]
  lamps: { bezel: Item; lens: Item }[]
  solids: number
}

function build(): Art {
  solids = 0
  const busX: [number, number][] = [[INPUT_X + BANK_W, TRAY_X[0]!]]
  for (let b = 0; b < BLOCKS.length; b++) {
    const end = trayPlan(b).x + trayPlan(b).w
    busX.push([end, b + 1 < BLOCKS.length ? TRAY_X[b + 1]! : LAMP_X])
  }
  const art: Art = {
    base: base(),
    input: bank(INPUT_X, "in"),
    buses: busX.map(([a, b]) => bus(a, b)),
    trays: BLOCKS.map((_, b) => trayBase(b)),
    relays: BLOCKS.map((_, b) => relays(b)),
    lampBank: bank(LAMP_X, "out"),
    gauge: gauge(),
    selector: selector(),
    knobs: SWITCH_X.map((_, i) => knobSolid(i)),
    lamps: SWITCH_X.map((_, i) => lampParts(i)),
    solids: 0,
  }
  art.solids = solids
  return art
}

export const ART = build()
export const SOCKET_TOTAL = SOCKETS.reduce((sum, { and, xor }) => sum + and + xor, 0)
export const ROW_COUNT = ROWS.length
