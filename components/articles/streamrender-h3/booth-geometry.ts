// The projection booth, built once at module load with the site's port of
// Anatomy's kit (components/articles/anatomy-machine-skill/iso-kit.ts). World
// units are about one px, x and y on the floor, z up; the line of machines
// runs along +x in the order a frame travels:
//
//   stage (the game engine) -> camera -> belt -> magazine (collect a chunk)
//   -> press (the two-step DiT) -> decoder (pairs) -> platter (painted, not
//   yet shown) -> projector (24 fps) -> screen, and a stopwatch on the bench.
//
// Static parts are path strings here. Parts that change shape (the stacks,
// the film pack, the sprocket, the needle, the picture on the screen) have
// builders exported for the live component.

import { mcos, msin } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import type { Flat, Plan, SolidPaths, Tone, LineTone } from "@/components/articles/anatomy-machine-skill/iso-kit"

export const WIDTH = 640
export const HEIGHT = 290
const AZIMUTH = 58
const ELEVATION = 30

// colour is the subject on the stage and on the frame cards: the semantic
// palette. Each class maps to CSS tokens in machine.tsx.
export type Paint = "road" | "grass" | "barrier" | "car" | "rival" | "film"

export type Item =
  | { kind: "solid"; paths: SolidPaths; tone: Tone; crease?: Tone | "none"; paint?: Paint }
  | { kind: "line"; d: string; tone: LineTone; free?: boolean }
  | { kind: "dots"; points: Flat[]; size: number; tone: Tone }
  | { kind: "halo"; d: string }
  | { kind: "area"; d: string; paint: Paint | "screen" }

const PLATE: Plan = { x: -166, y: -44, w: 304, d: 88, r: 8 }
const PLATE_H = 10
const FOOT_H = 5
export const CY = -8

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-36, CY, 49], [-101, CY, 30], [101, CY - 8, 38], [101, CY + 8, 38]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: AZIMUTH, elevation: ELEVATION },
)

export const at = (x: number, y: number, z: number) => k.iso([x, y, z], P)
const byDepth = <T extends [number, number]>(points: T[]) =>
  [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))

let solids = 0
const S = (paths: SolidPaths, tone: Tone = "mid", crease: Tone | "none" = "faint", paint?: Paint): Item => {
  solids += 1
  return { kind: "solid", paths, tone, crease, paint }
}
const L = (d: string, tone: LineTone = "lo", free = false): Item => ({ kind: "line", d, tone, free })
const D = (points: Flat[], size = 0.45, tone: Tone = "mid"): Item => ({ kind: "dots", points, size, tone })
const A = (d: string, paint: Paint | "screen"): Item => ({ kind: "area", d, paint })

// The kit's sideSeam (not in the site's port): the visible near half of a
// rounded plan at height z, from one silhouette edge round to the other, so a
// seam wraps the corners and ends exactly on the outline.
export function seamOf(plan: Plan, z: number, steps = 2) {
  const ring = k.roundedPlan(plan, steps)
  const flat = ring.map(([x, y]) => at(x, y, z))
  const n = ring.length
  let lo = 0
  let hi = 0
  let near = 0
  ring.forEach(([x, y], i) => {
    if (flat[i]![0] < flat[lo]![0]) lo = i
    if (flat[i]![0] > flat[hi]![0]) hi = i
    if (k.depthOf([x, y, 0], P) > k.depthOf([ring[near]![0], ring[near]![1], 0], P)) near = i
  })
  const walk = (from: number, to: number) => {
    const out: number[] = [from]
    for (let i = from; i !== to; ) {
      i = (i + 1) % n
      out.push(i)
    }
    return out
  }
  const a = walk(lo, hi)
  const chain = a.includes(near) ? a : walk(hi, lo)
  return k.pathOf(chain.map((i) => flat[i]!))
}
const nearSeam = (plan: Plan, z: number) => seamOf(plan, z, 2)

// ---------------------------------------------------------------- base
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
  // ruler strip along the front, ticks rooted on its back edge
  const strip: Plan = { x: -96, y: 33, w: 86, d: 5, r: 1 }
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), "lo", "none"))
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.6, 0.6, [1.6, 3], P)
  out.push(L(ticks.minor, "lo"), L(ticks.major, "mid"))
  // label plate, front left: three rule lines stand for engraved text
  const label: Plan = { x: -158, y: 27, w: 16, d: 10, r: 1.2 }
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), "lo"))
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), "faint"))
  for (const [from, to, y] of [
    [-155, -146, 30.4],
    [-155, -148, 32.4],
    [-155, -150, 34.4],
  ] as const)
    out.push(L(k.lineOnTop([from, y], [to, y], 0.8, P), "lo", true))
  out.push(D([at(label.x + 13.6, label.y + 2.2, 0.8), at(label.x + 13.6, label.y + 7.8, 0.8)], 0.4))
  return out
}

// Two signal wires on the bench top: the lever starts the stopwatch, the
// screen stops it. Both end under the stopwatch's foot, which is painted later.
export const DIAL = { x: 52, y: 26, r: 9 }
function wires(): Item[] {
  const lane = 31
  const left = k.pathOf([at(-137, 21, 0), at(-137, lane, 0), at(44, lane, 0), at(45, 30, 0)])
  const right = k.pathOf([at(101, -2, 0), at(101, 27, 0), at(61.6, 27, 0)])
  return [L(left, "lo"), L(right, "lo"), D([at(-137, 21, 0), at(101, -2, 0)], 0.7, "mid")]
}

// ---------------------------------------------------------------- stage
// The game engine: a tray of flat colour, one block per semantic class.
export const LANE_DY = 5.4 // lane 0 is the near lane; lane 1 is LANE_DY further back
const CAR_PLAN: Plan = { x: -149, y: CY + 0.8, w: 6.5, d: 3.6, r: 0.6 }
function stage(): Item[] {
  const tray: Plan = { x: -160, y: -30, w: 44, d: 38, r: 2 }
  const road: Plan = { x: -159.4, y: CY - 6.4, w: 42.8, d: 12.4, r: 0.3 }
  const out: Item[] = [
    S(k.slabOf(tray, 0, 4, P, 6, 0.8), "mid"),
    S(k.slabOf(k.insetPlan(tray, 1.4), 4, 0.3, P, 6), "lo", "none", "grass"),
    S(k.slabOf(road, 4.3, 0.3, P, 2), "lo", "none", "road"),
  ]
  const segs = [-157, -143.5, -130]
  for (const x of segs) out.push(S(k.slabOf({ x, y: road.y - 1.6, w: 10, d: 1.3, r: 0.3 }, 4.3, 1.8, P, 2), "lo", "lo", "barrier"))
  const rival: Plan = { x: -134, y: CY - 4.6, w: 6.5, d: 3.6, r: 0.6 }
  out.push(S(k.slabOf(rival, 4.6, 2.2, P, 3), "lo", "lo", "rival"))
  out.push(S(k.slabOf(k.insetPlan(rival, 0.8), 6.8, 1, P, 3), "lo", "lo", "rival"))
  out.push(D(k.corners(tray, 2.4).map(([x, y]) => at(x, y, 4)), 0.4))
  return out
}
// The player's car, drawn at lane 0 and moved across with translateAlong.
export function car(): Item[] {
  return [
    S(k.slabOf(CAR_PLAN, 4.6, 2.2, P, 3), "lo", "lo", "car"),
    S(k.slabOf(k.insetPlan(CAR_PLAN, 0.8), 6.8, 1, P, 3), "lo", "lo", "car"),
  ]
}
function stageFront(): Item[] {
  const out: Item[] = []
  for (const x of [-157, -143.5, -130]) out.push(S(k.slabOf({ x, y: CY + 6.2, w: 10, d: 1.3, r: 0.3 }, 4.3, 1.8, P, 2), "lo", "lo", "barrier"))
  return out
}

// The steering lever: a knob that slides in a slot, one end per lane.
export const KNOB_X = [-143, -131]
const GATE: Plan = { x: -150, y: 13, w: 26, d: 8, r: 1.5 }
function gate(): Item[] {
  const slot: Plan = { x: -145, y: 16.2, w: 16, d: 1.6, r: 0.8 }
  return [
    S(k.slabOf(GATE, 0, 4, P, 4, 0.6), "mid"),
    L(k.planOutline(slot, 4, P, 4), "lo"),
    D([at(GATE.x + 2.2, GATE.y + 4, 4), at(GATE.x + GATE.w - 2.2, GATE.y + 4, 4)], 0.42),
  ]
}
export function knob(): Item[] {
  const x = KNOB_X[0]!
  const y = 17
  return [
    S(k.cylinder(x, y, 0.7, 4, 4, P, 12), "mid", "none"),
    S(k.cylinder(x, y, 2.2, 8, 3, P, 24, 0.3), "hi", "lo"),
    L(k.knurl(x, y, 2.2, 8, 11, 22, P, 0.3), "lo"),
  ]
}

// ---------------------------------------------------------------- camera
const BODY: Plan = { x: -109, y: CY - 6, w: 15, d: 12, r: 1.5 }
function camera(): Item[] {
  const cx = -101.5
  const out: Item[] = [
    S(k.cylinder(cx, CY, 3.6, 0, 2, P, 24), "lo"),
    S(k.cylinder(cx, CY, 1.6, 2, 14.5, P, 16), "mid", "none"),
    L(k.sideArc(cx, CY, 1.6, 9, P, 12), "faint"),
    S(k.slabOf({ x: -107.5, y: CY - 5, w: 12, d: 10, r: 1 }, 16.5, 1.5, P, 3), "lo"),
    // the lens hood points back at the stage; it is drawn before the body
    S(k.slabOf({ x: -114, y: CY - 3.5, w: 5.4, d: 7, r: 0.8 }, 20, 7, P, 3, 0.4), "mid"),
    S(k.slabOf(BODY, 18, 10.5, P, 4, 0.8), "mid"),
    L(k.planOutline(k.insetPlan(BODY, 1.6), 28.5, P, 4), "faint"),
    // the exit slot on the +x face, where each exposed frame leaves
    L(k.pathOf([at(-94, CY - 3.8, 23.7), at(-94, CY + 3.8, 23.7), at(-94, CY + 3.8, 24.5), at(-94, CY - 3.8, 24.5)], true), "lo"),
  ]
  for (const rx of [-105.2, -97.8]) {
    out.push(S(k.cylinder(rx, CY, 3.4, 28.5, 1.4, P, 32, 0.3), "mid"))
    out.push(L(k.ring(rx, CY, 2.2, 29.9, P, 24), "faint"))
    out.push(D([at(rx, CY, 29.9)], 0.5, "hi"))
  }
  return out
}

// ---------------------------------------------------------------- belt
export const CARD = 7
export const CT = 0.6 // one frame card's thickness
export const BELT_Z = 24
const BELT: Plan = { x: -94, y: CY - 4.5, w: 22, d: 9, r: 0.8 }
function belt(): Item[] {
  return [
    S(k.cylinder(-76, CY, 2.6, 0, 1.5, P, 20), "lo"),
    S(k.cylinder(-76, CY, 1.1, 1.5, 20, P, 14), "mid", "none"),
    S(k.slabOf(BELT, 21.5, 2.2, P, 3, 0.4), "mid"),
    S(k.slabOf(k.insetPlan(BELT, 0.7), 23.7, 0.3, P, 3), "lo", "none"),
  ]
}
// A frame card at the origin: its centre is moved by the live code.
export const cardPlan = (cx: number, cy: number): Plan => ({ x: cx - CARD / 2, y: cy - CARD / 2, w: CARD, d: CARD, r: 0.3 })
// The flat-colour map printed on a card's top: grass, a band of road, a car.
export function inlay(cx: number, cy: number, z: number) {
  const g = k.planOutline({ x: cx - 3, y: cy - 3, w: 6, d: 6, r: 0.2 }, z, P, 1)
  const r = k.planOutline({ x: cx - 3, y: cy - 1.2, w: 6, d: 2.4, r: 0 }, z, P, 1)
  const c = k.planOutline({ x: cx - 1.6, y: cy - 0.1, w: 1.6, d: 0.9, r: 0 }, z, P, 1)
  return { grass: g, road: r, car: c }
}
export const BELT_CARD = k.slabOf(cardPlan(0, CY), 0, CT, P, 2)
export const BELT_INLAY = inlay(0, CY, CT)

// ---------------------------------------------------------------- magazine
export const MAG_X = -64
const MAG_BASE: Plan = { x: MAG_X - 8, y: CY - 8, w: 16, d: 16, r: 1.5 }
const POSTS: [number, number][] = [
  [MAG_X - 4.5, CY - 4.5],
  [MAG_X + 4.5, CY - 4.5],
  [MAG_X - 4.5, CY + 4.5],
  [MAG_X + 4.5, CY + 4.5],
]
export const MAG_Z = 3
function post(x: number, y: number): Item[] {
  return [S(k.cylinder(x, y, 0.7, MAG_Z, 19.5, P, 12), "mid", "none"), D([at(x, y, MAG_Z + 19.5)], 0.45, "hi")]
}
function magazineBack(): Item[] {
  return [
    S(k.slabOf(MAG_BASE, 0, MAG_Z, P, 4, 0.5), "mid"),
    L(k.planOutline(k.insetPlan(cardPlan(MAG_X, CY), -0.6), MAG_Z, P, 2), "lo"),
    D(k.corners(MAG_BASE, 1.8).map(([x, y]) => at(x, y, MAG_Z)), 0.38, "lo"),
    ...post(...POSTS[0]!),
    ...post(...POSTS[1]!),
  ]
}
function magazineFront(): Item[] {
  return [...post(...POSTS[2]!), ...post(...POSTS[3]!)]
}

// ---------------------------------------------------------------- press
export const PRESS_X = -36
export const DIE_Z = 7
export const PLATEN_Z = 28
const BED: Plan = { x: PRESS_X - 16, y: CY - 13, w: 32, d: 26, r: 2 }
const COLS: [number, number][] = [
  [PRESS_X - 13, CY - 10],
  [PRESS_X + 13, CY - 10],
  [PRESS_X - 13, CY + 10],
  [PRESS_X + 13, CY + 10],
]
const column = ([x, y]: [number, number]): Item[] => [
  S(k.cylinder(x, y, 2.4, 6, 1.4, P, 20), "lo"),
  S(k.cylinder(x, y, 1.6, 7.4, 31, P, 16), "mid", "none"),
  L(k.sideArc(x, y, 1.6, 22, P, 12), "faint"),
]
function pressBack(): Item[] {
  return [
    S(k.slabOf(BED, 0, 6, P, 6, 0.8), "mid"),
    L(k.planOutline(k.insetPlan(BED, 2), 6, P, 6), "faint"),
    S(k.slabOf({ x: PRESS_X - 5.5, y: CY - 5.5, w: 11, d: 11, r: 1 }, 6, 1, P, 3, 0.3), "lo"),
    ...column(COLS[0]!),
    ...column(COLS[1]!),
  ]
}
// The platen and its ram, built at rest and moved down by the live code.
export function platen(): Item[] {
  const plan: Plan = { x: PRESS_X - 6.5, y: CY - 6.5, w: 13, d: 13, r: 1 }
  return [
    S(k.cylinder(PRESS_X, CY, 2, PLATEN_Z + 3, 11, P, 20), "mid", "none"),
    L(k.sideArc(PRESS_X, CY, 2, PLATEN_Z + 5, P, 14), "faint"),
    S(k.slabOf(plan, PLATEN_Z, 3, P, 4, 0.5), "hi", "lo"),
    L(k.planOutline(k.insetPlan(plan, 1.5), PLATEN_Z + 3, P, 4), "faint"),
    D(k.corners(plan, 1.5).map(([x, y]) => at(x, y, PLATEN_Z + 3)), 0.38),
  ]
}
function pressFront(): Item[] {
  const crown: Plan = { x: PRESS_X - 16, y: CY - 13, w: 32, d: 26, r: 2 }
  const out: Item[] = [...column(COLS[2]!), ...column(COLS[3]!)]
  out.push(S(k.slabOf(crown, 38.4, 4.6, P, 6, 0.8), "mid"))
  out.push(D(byDepth(k.corners(crown, 3)).map(([x, y]) => at(x, y, 43)), 0.45))
  out.push(S(k.cylinder(PRESS_X, CY, 6.5, 43, 1.2, P, 40), "lo"))
  out.push(S(k.cylinder(PRESS_X, CY, 5.6, 44.2, 5.2, P, 40, 0.4), "mid"))
  out.push(L(k.knurl(PRESS_X, CY, 5.6, 44.2, 49.4, 36, P, 0.6), "faint"))
  out.push(L(k.ring(PRESS_X, CY, 3.4, 49.4, P, 28), "lo"))
  out.push(D([at(PRESS_X, CY, 49.4)], 0.5, "hi"))
  return out
}

// ---------------------------------------------------------------- decoder
export const DEC_X = -8.5 // centre of the holding slot
const DEC: Plan = { x: -14, y: CY - 9, w: 18, d: 18, r: 2 }
export const DEC_Z = 14
function decoder(): Item[] {
  const a: Plan = { x: DEC_X - 4, y: CY - 4, w: 8, d: 8, r: 0.8 }
  const b: Plan = { x: DEC_X + 4.5, y: CY - 4, w: 8, d: 8, r: 0.8 }
  return [
    S(k.slabOf(DEC, 0, DEC_Z, P, 6, 0.8), "mid"),
    L(seamOf(DEC, 3.5, 6), "faint"),
    L(k.planOutline(a, DEC_Z, P, 3) + k.planOutline(b, DEC_Z, P, 3), "lo"),
    L(k.planOutline(k.insetPlan(b, 1.4), DEC_Z, P, 3), "faint"),
    D(k.corners(DEC, 1.8).map(([x, y]) => at(x, y, DEC_Z)), 0.4),
  ]
}

// ---------------------------------------------------------------- platter
export const PLAT = { x: 24, y: CY, r: 17, z: 12.6, hub: 4.4, film: 2.6 }
function platterBack(): Item[] {
  const { x, y, r, z } = PLAT
  return [
    S(k.cylinder(x, y, 6, 0, 2, P, 28), "lo"),
    S(k.cylinder(x, y, 2.4, 2, z - 1.6 - 2, P, 18), "mid", "none"),
    S(k.cylinder(x, y, r, z - 1.6, 1.6, P, 72, 0.6), "mid"),
    L(k.ring(x, y, r - 2.4, z, P, 64), "faint"),
    D([0, 1, 2, 3, 4, 5].map((i) => at(x + (r - 1.2) * mcos((i * Math.PI) / 3), y + (r - 1.2) * msin((i * Math.PI) / 3), z)), 0.38, "lo"),
  ]
}
// the pack of painted frames waiting on the platter: radius grows with count
export const PACK_PER_FRAME = 6.2
export const packRadius = (frames: number) => Math.sqrt(PLAT.hub * PLAT.hub + frames * PACK_PER_FRAME)
export const packOf = (frames: number) => k.cylinder(PLAT.x, PLAT.y, packRadius(frames), PLAT.z, PLAT.film, P, 48)
export const packRing = (index: number) => k.ring(PLAT.x, PLAT.y, packRadius(index + 0.5), PLAT.z + PLAT.film, P, 40)
function hub(): Item[] {
  const { x, y, z, hub } = PLAT
  return [
    S(k.cylinder(x, y, hub, z, PLAT.film + 1.2, P, 32, 0.3), "mid"),
    L(k.ring(x, y, 2, z + PLAT.film + 1.2, P, 20), "lo"),
    D([at(x, y, z + PLAT.film + 1.2)], 0.6, "hi"),
  ]
}

// ---------------------------------------------------------------- projector
export const SPROCKET = { x: 51.5, y: CY, r: 3.6, z: 23.6 }
function projector(): Item[] {
  const bodyPlan: Plan = { x: 46, y: CY - 7, w: 19, d: 14, r: 1.5 }
  const out: Item[] = [
    S(k.slabOf({ x: 45, y: CY - 8, w: 21, d: 16, r: 1.5 }, 0, 3, P, 4, 0.5), "lo"),
    S(k.cylinder(55.5, CY, 2.4, 3, 7, P, 18), "mid", "none"),
    S(k.slabOf(bodyPlan, 10, 12, P, 4, 0.8), "mid"),
    L(k.planOutline(k.insetPlan(bodyPlan, 1.6), 22, P, 4), "faint"),
    // the lens hood runs into the screen cabinet's side port
    S(k.slabOf({ x: 65, y: CY - 3, w: 10.4, d: 6, r: 0.8 }, 13, 6, P, 3, 0.4), "mid"),
    S(k.cylinder(SPROCKET.x, SPROCKET.y, SPROCKET.r, 22, 1.6, P, 32, 0.3), "mid"),
    L(k.ring(SPROCKET.x, SPROCKET.y, 1.2, SPROCKET.z, P, 14), "lo"),
    S(k.cylinder(60.4, CY, 3.2, 22, 5.6, P, 28, 0.4), "mid"),
    L(k.sideArc(60.4, CY, 3.2, 24, P, 18) + k.sideArc(60.4, CY, 3.2, 25.6, P, 18), "faint"),
    S(k.cylinder(60.4, CY, 2.2, 27.6, 1, P, 20), "lo"),
  ]
  return out
}
// the film runs from the platter's hub up to the sprocket
export const LEADER = k.pathOf([at(PLAT.x, PLAT.y, PLAT.z + PLAT.film + 1.2), at(SPROCKET.x - SPROCKET.r + 0.4, SPROCKET.y, SPROCKET.z)])
const end = at(SPROCKET.x - SPROCKET.r + 0.4, SPROCKET.y, SPROCKET.z)
export const LEADER_END: [number, number] = [Math.round(end[0] * 10) / 10, Math.round(end[1] * 10) / 10]
export function sprocketTeeth(turn: number) {
  const out: string[] = []
  for (let i = 0; i < 12; i++) {
    const a = turn + (i / 12) * Math.PI * 2
    const ca = mcos(a)
    const sa = msin(a)
    out.push(k.lineOnTop([SPROCKET.x + ca * (SPROCKET.r - 1.1), SPROCKET.y + sa * (SPROCKET.r - 1.1)], [SPROCKET.x + ca * SPROCKET.r, SPROCKET.y + sa * SPROCKET.r], SPROCKET.z, P))
  }
  return out.join("")
}

// ---------------------------------------------------------------- screen
const CAB: Plan = { x: 75, y: CY - 8, w: 52, d: 16, r: 1.5 }
export const SCREEN = { x0: 79.5, x1: 122.5, z0: 6.5, z1: 34, y: CY + 8 }
const onFace = (x: number, z: number) => at(x, SCREEN.y + 0.01, z)
function cabinet(): Item[] {
  const { x0, x1, z0, z1 } = SCREEN
  const out: Item[] = [
    S(k.slabOf({ x: CAB.x + 2, y: CAB.y + 2, w: CAB.w - 4, d: CAB.d - 4, r: 1 }, 0, 1.5, P, 4), "lo"),
    S(k.slabOf(CAB, 1.5, 36.5, P, 4, 0.8), "mid"),
    L(k.planOutline(k.insetPlan(CAB, 1.6), 38, P, 4), "faint"),
  ]
  // vents on the lid: closed slots
  for (let i = 0; i < 5; i++) out.push(L(k.planOutline({ x: 100 + i * 4, y: CY - 4, w: 1.4, d: 8, r: 0.7 }, 38, P, 3), "lo"))
  // the screen: a bezel on the front face with the picture inside it
  out.push(L(k.pathOf([onFace(x0 - 1.2, z0 - 1.2), onFace(x1 + 1.2, z0 - 1.2), onFace(x1 + 1.2, z1 + 1.2), onFace(x0 - 1.2, z1 + 1.2)], true), "lo"))
  out.push(A(k.pathOf([onFace(x0, z0), onFace(x1, z0), onFace(x1, z1), onFace(x0, z1)], true), "screen"))
  out.push(D([onFace(x0 - 0.6 + 1.2 + 42.4, 3.4), onFace(x0 + 3, 3.4)], 0.42))
  return out
}
export const SCREEN_EDGE = k.pathOf(
  [onFace(SCREEN.x0 - 1.2, SCREEN.z0 - 1.2), onFace(SCREEN.x1 + 1.2, SCREEN.z0 - 1.2), onFace(SCREEN.x1 + 1.2, SCREEN.z1 + 1.2), onFace(SCREEN.x0 - 1.2, SCREEN.z1 + 1.2)],
  true,
)
// The picture on the screen: the painted view behind the player's car.
// `lane` is the lane the displayed frame shows (0..1), `scroll` its frame index.
export function picture(lane: number, scroll: number) {
  const { x0, x1, z0, z1 } = SCREEN
  const cx = (x0 + x1) / 2
  const hz = z0 + (z1 - z0) * 0.58
  const sky = k.pathOf([onFace(x0, hz), onFace(x1, hz), onFace(x1, z1), onFace(x0, z1)], true)
  const road = k.pathOf([onFace(x0 + 5, z0), onFace(x1 - 5, z0), onFace(cx + 1.6, hz), onFace(cx - 1.6, hz)], true)
  // centre-line dashes, perspective-spaced, moving down the screen per frame
  const dashes: string[] = []
  const u = (scroll / 6) % 1
  for (let i = 0; i < 4; i++) {
    const s0 = (i + u) / 4
    const s1 = Math.min(1, s0 + 0.09)
    const zOf = (s: number) => z0 + (hz - z0) * (1 - (1 - s) * (1 - s))
    const w = (s: number) => 0.7 * (1 - s) + 0.1
    dashes.push(k.pathOf([onFace(cx - w(s0), zOf(s0)), onFace(cx + w(s0), zOf(s0)), onFace(cx + w(s1), zOf(s1)), onFace(cx - w(s1), zOf(s1))], true))
  }
  // the car seen from behind: body, roof; lane 0 left of the centre line
  const carX = cx - 8 + lane * 16
  const body = k.pathOf([onFace(carX - 5, z0 + 2), onFace(carX + 5, z0 + 2), onFace(carX + 5, z0 + 6), onFace(carX - 5, z0 + 6)], true)
  const roof = k.pathOf([onFace(carX - 3.4, z0 + 6), onFace(carX + 3.4, z0 + 6), onFace(carX + 2.6, z0 + 8.6), onFace(carX - 2.6, z0 + 8.6)], true)
  const wheels = k.pathOf([onFace(carX - 4.6, z0 + 0.8), onFace(carX - 2.6, z0 + 0.8), onFace(carX - 2.6, z0 + 2), onFace(carX - 4.6, z0 + 2)], true) +
    k.pathOf([onFace(carX + 2.6, z0 + 0.8), onFace(carX + 4.6, z0 + 0.8), onFace(carX + 4.6, z0 + 2), onFace(carX + 2.6, z0 + 2)], true)
  const verge = k.pathOf([onFace(x0, z0), onFace(x1, z0), onFace(x1, hz), onFace(x0, hz)], true)
  return { sky, verge, road, dashes: dashes.join(""), body, roof, wheels }
}

// ---------------------------------------------------------------- stopwatch
export const DIAL_TOP = 7.4
const FULL_S = 2 // one turn of the hand is two seconds
function stopwatch(): Item[] {
  const { x, y, r } = DIAL
  const t = k.radialTicks(x, y, r - 1.4, 40, 10, DIAL_TOP, [1, 2.2], P)
  const half = k.radialTicks(x, y, r - 1.4, 4, 4, DIAL_TOP, [2.2, 2.2], P)
  return [
    S(k.cylinder(x, y - r - 1.4, 1.3, 2, 4, P, 14), "mid"),
    S(k.cylinder(x, y - r - 1.4, 1.9, 6, 1.4, P, 16, 0.3), "mid"),
    S(k.cylinder(x, y, r + 1, 0, 2, P, 56), "lo"),
    S(k.cylinder(x, y, r, 2, DIAL_TOP - 2, P, 64, 0.8), "hi", "lo"),
    L(k.knurl(x, y, r, DIAL_TOP - 2.2, DIAL_TOP, 60, P, 0.3), "lo"),
    L(k.ring(x, y, r - 1.2, DIAL_TOP, P, 56), "lo"),
    L(t.minor, "lo"),
    L(t.major + half.major, "mid"),
    L(k.ring(x, y, 0.8, DIAL_TOP, P, 12), "hi"),
  ]
}
export function needleAt(seconds: number) {
  const a = (seconds / FULL_S) * Math.PI * 2
  const r = DIAL.r - 2.2
  const sa = msin(a)
  const ca = mcos(a)
  return k.lineOnTop([DIAL.x - sa * 1.6, DIAL.y + ca * 1.6], [DIAL.x + sa * r, DIAL.y - ca * r], DIAL_TOP + 0.1, P)
}

// ---------------------------------------------------------------- stacks
// A stack of n frame cards is one prism, rebuilt as it grows, with a faint
// seam where each card meets the next.
export function stackOf(cx: number, z: number, n: number) {
  const plan = cardPlan(cx, CY)
  const paths = k.slabOf(plan, z, Math.max(0.01, n * CT), P, 2)
  const seams: string[] = []
  for (let i = 1; i < n; i++) seams.push(nearSeam(plan, z + i * CT))
  const top = inlay(cx, CY, z + n * CT)
  return { paths, seams: seams.join(""), top }
}
export const markSeam = (cx: number, z: number, index: number) => nearSeam(cardPlan(cx, CY), z + (index + 0.5) * CT)

export interface Art {
  base: Item[]
  wires: Item[]
  stage: Item[]
  stageFront: Item[]
  gate: Item[]
  camera: Item[]
  belt: Item[]
  magazineBack: Item[]
  magazineFront: Item[]
  pressBack: Item[]
  pressFront: Item[]
  decoder: Item[]
  platterBack: Item[]
  hub: Item[]
  projector: Item[]
  cabinet: Item[]
  stopwatch: Item[]
  car: Item[]
  knob: Item[]
  platen: Item[]
  solids: number
}

function build(): Art {
  solids = 0
  const art: Art = {
    base: base(),
    wires: wires(),
    stage: stage(),
    stageFront: stageFront(),
    gate: gate(),
    camera: camera(),
    belt: belt(),
    magazineBack: magazineBack(),
    magazineFront: magazineFront(),
    pressBack: pressBack(),
    pressFront: pressFront(),
    decoder: decoder(),
    platterBack: platterBack(),
    hub: hub(),
    projector: projector(),
    cabinet: cabinet(),
    stopwatch: stopwatch(),
    car: car(),
    knob: knob(),
    platen: platen(),
    solids: 0,
  }
  // the live parts: belt card, three stacks, the pack
  art.solids = solids + 5
  return art
}

export const ART = build()
