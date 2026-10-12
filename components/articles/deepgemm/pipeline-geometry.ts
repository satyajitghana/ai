// The DeepGEMM workshop, built once at module load with the site's port of
// the isometric-figures (Anatomy) kit. World units are about one px of the
// drawing: x along the bench, y toward the viewer, z up.
//
// Back left, a rack of tiles (global memory). In front of it a rail, and a
// carriage on it (the TMA copy engine) that ferries a tile to one of three
// bins (shared-memory stages). On the right, a gantry with one press head (the
// tensor core) that moves between two stations (the two math warpgroups).
// Each station has a die, a small dial with 14 bit marks (the WGMMA
// accumulator), a lever (promotion), and a larger dial with 24 (the FP32
// register on the CUDA-core side).
//
// Static parts are path strings here. The parts that change shape (the ram,
// the needles, the levers) have builders the live component calls per frame.

import { mcos, msin } from "@/lib/dmath"
import * as k from "@/components/articles/anatomy-machine-skill/iso-kit"
import type { Flat, Plan, SolidPaths, Tone, LineTone } from "@/components/articles/anatomy-machine-skill/iso-kit"
import { ACC_BITS, FP32_BITS, STAGES } from "./pipeline-model"

export const WIDTH = 640
export const HEIGHT = 310
const AZIMUTH = 52

export type Part = "rack" | "tma" | "bins" | "press" | "narrow" | "lever" | "wide"

export type Item =
  | { kind: "solid"; paths: SolidPaths; tone: Tone; crease?: Tone | "none"; part?: Part }
  | { kind: "line"; d: string; tone: LineTone; part?: Part; free?: boolean }
  | { kind: "dots"; points: Flat[]; size: number; tone: Tone; part?: Part }
  | { kind: "halo"; d: string }

const PLATE: Plan = { x: -152, y: -42, w: 300, d: 80, r: 8 }
const PLATE_H = 9
const FOOT_H = 5

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-140, -40, 55], [-106, -16, 55], [131, -6, 51], [-17, -18, 51], [131, -18, 51]],
  WIDTH,
  HEIGHT,
  { pad: 6, azimuth: AZIMUTH, elevation: 30 },
)
export const at = (x: number, y: number, z: number) => k.iso([x, y, z], P)

let solids = 0
const S = (paths: SolidPaths, tone: Tone = "mid", crease: Tone | "none" = "faint", part?: Part): Item => {
  solids += 1
  return { kind: "solid", paths, tone, crease, part }
}
const L = (d: string, tone: LineTone = "lo", part?: Part, free?: boolean): Item => ({ kind: "line", d, tone, part, free })
const D = (points: Flat[], size = 0.45, tone: Tone = "mid", part?: Part): Item => ({ kind: "dots", points, size, tone, part })
const tag = (items: Item[], part: Part) => items.map((item) => (item.kind === "halo" ? item : { ...item, part }))
const byDepth = <T extends [number, number]>(points: T[]) =>
  [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))

// ---------------------------------------------------------------- bench
function bench(): Item[] {
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
  // ruler strip along the TMA rail
  const strip: Plan = { x: -142, y: 25, w: 104, d: 5.5, r: 1 }
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), "lo", "none"))
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.6, 3.2], P)
  out.push(L(ticks.minor, "lo"), L(ticks.major, "mid"))
  // label plate, front right
  const label: Plan = { x: -30, y: 22, w: 26, d: 9, r: 1.2 }
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), "lo"))
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), "faint"))
  for (const [from, to, y] of [
    [-26, -10, 24.4],
    [-26, -14, 26.4],
    [-26, -17, 28.4],
  ] as const)
    out.push(L(k.lineOnTop([from, y], [to, y], 0.8, P), "lo", undefined, true))
  out.push(D([at(label.x + 2, label.y + 4.5, 0.8), at(label.x + label.w - 2, label.y + 4.5, 0.8)], 0.4))
  return out
}

// ---------------------------------------------------------------- rack (global memory)
const RACK = { x0: -140, x1: -106, y0: -40, y1: -16, wall: 2, shelves: [3, 17, 31, 45], top: 51 }
export const RACK_X = (RACK.x0 + RACK.x1) / 2
function rack(): Item[] {
  const { x0, x1, y0, y1, wall, shelves, top } = RACK
  const out: Item[] = []
  out.push(S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: 1.4, r: 0.3 }, 0, top, P, 2), "lo"))
  out.push(S(k.slabOf({ x: x0, y: y0, w: wall, d: y1 - y0, r: 0.4 }, 0, top, P, 2, 0.4), "mid"))
  const inner = { x: x0 + wall, w: x1 - x0 - wall * 2 }
  shelves.forEach((z, i) => {
    const shelf: Plan = { x: inner.x, y: y0 + 1.4, w: inner.w, d: y1 - y0 - 1.4, r: 0.3 }
    out.push(S(k.slabOf(shelf, z - 1.6, 1.6, P, 2, 0.3), i === 0 ? "lo" : "mid"))
    if (i === shelves.length - 1) return
    for (const cx of [inner.x + 5.5, inner.x + 15, inner.x + 24.5]) {
      const tile: Plan = { x: cx - 4, y: y0 + 4, w: 8, d: 14, r: 0.5 }
      out.push(S(k.slabOf(tile, z, 3, P, 2, 0.3), "hi", "lo"))
      out.push(L(k.lineOnTop([cx - 4, y0 + 11], [cx + 4, y0 + 11], z + 3, P), "faint"))
    }
  })
  out.push(S(k.slabOf({ x: x1 - wall, y: y0, w: wall, d: y1 - y0, r: 0.4 }, 0, top, P, 2, 0.4), "mid"))
  const cap: Plan = { x: x0 - 1, y: y0 - 1, w: x1 - x0 + 2, d: y1 - y0 + 2, r: 1 }
  out.push(S(k.slabOf(cap, top, 2.4, P, 3, 0.6), "mid"))
  out.push(D(byDepth(k.corners(cap, 2.2)).map(([x, y]) => at(x, y, top + 2.4)), 0.42))
  return tag(out, "rack")
}

// ---------------------------------------------------------------- bins (shared-memory stages)
export const BIN_X = [-84, -66, -48]
const BIN_Y0 = -28
const BIN_D = 20
const BIN_Z = 3
const WALL_H = 6
export const TILE_Z = BIN_Z + 1
export const tileSolid = (cx: number, y: number, z: number) => {
  const plan: Plan = { x: cx - 4, y: y - 6, w: 8, d: 12, r: 0.5 }
  return {
    body: k.slabOf(plan, z, 3, P, 2, 0.3),
    seam: k.lineOnTop([cx - 4, y], [cx + 4, y], z + 3, P),
  }
}
function binsTray(): Item[] {
  const tray: Plan = { x: -95, y: -31, w: 58, d: 27, r: 1.5 }
  return tag(
    [
      S(k.slabOf(tray, 0, BIN_Z, P, 4, 0.5), "mid"),
      D(byDepth(k.corners(tray, 2)).map(([x, y]) => at(x, y, BIN_Z)), 0.4, "lo"),
    ],
    "bins",
  )
}
export function binBack(i: number): Item[] {
  const cx = BIN_X[i]!
  const x0 = cx - 7
  return tag(
    [
      S(k.slabOf({ x: x0, y: BIN_Y0, w: 14, d: BIN_D, r: 0.4 }, BIN_Z, 1, P, 2), "lo", "none"),
      S(k.slabOf({ x: x0, y: BIN_Y0, w: 14, d: 1.2, r: 0.2 }, BIN_Z + 1, WALL_H, P, 2), "mid"),
      S(k.slabOf({ x: x0, y: BIN_Y0, w: 1.2, d: BIN_D, r: 0.2 }, BIN_Z + 1, WALL_H, P, 2), "mid"),
    ],
    "bins",
  )
}
export function binFront(i: number): Item[] {
  const cx = BIN_X[i]!
  const x0 = cx - 7
  return tag(
    [
      S(k.slabOf({ x: x0 + 12.8, y: BIN_Y0, w: 1.2, d: BIN_D, r: 0.2 }, BIN_Z + 1, WALL_H, P, 2), "mid"),
      S(k.slabOf({ x: x0, y: BIN_Y0 + BIN_D - 1.2, w: 14, d: 1.2, r: 0.2 }, BIN_Z + 1, WALL_H, P, 2, 0.3), "mid"),
      D([at(x0 + 2, BIN_Y0 + BIN_D - 0.6, BIN_Z + 1 + WALL_H), at(x0 + 12, BIN_Y0 + BIN_D - 0.6, BIN_Z + 1 + WALL_H)], 0.36, "lo"),
    ],
    "bins",
  )
}
export const BIN_TILE_Y = BIN_Y0 + BIN_D / 2

// ---------------------------------------------------------------- TMA rail and carriage
const RAIL: Plan = { x: -146, y: 16, w: 108, d: 4, r: 1 }
export const CARRIAGE_Y = 18
function rail(): Item[] {
  const out: Item[] = [S(k.slabOf(RAIL, 0, 2.4, P, 3, 0.4), "mid")]
  out.push(D([RACK_X, ...BIN_X].map((x) => at(x, RAIL.y + 2, 2.4)), 0.42, "lo"))
  for (const x of [RAIL.x - 4.2, RAIL.x + RAIL.w + 0.2]) out.push(S(k.slabOf({ x, y: 13, w: 4, d: 10, r: 1 }, 0, 5, P, 3, 0.4), "mid"))
  return tag(out, "tma")
}
// built at x = 0, moved with translateAlong
export function carriage(): Item[] {
  const plate: Plan = { x: -8, y: 12.5, w: 16, d: 11, r: 1.6 }
  return tag(
    [
      S(k.slabOf({ x: -7.5, y: 13.5, w: 3, d: 9, r: 0.6 }, 0.6, 1.8, P, 2), "lo"),
      S(k.slabOf({ x: 4.5, y: 13.5, w: 3, d: 9, r: 0.6 }, 0.6, 1.8, P, 2), "lo"),
      S(k.slabOf(plate, 2.4, 2.2, P, 4, 0.5), "mid"),
      L(k.planOutline(k.insetPlan(plate, 1.4), 4.6, P, 3), "faint"),
      D([at(-6, 22, 4.6), at(6, 22, 4.6), at(-6, 14, 4.6), at(6, 14, 4.6)], 0.38, "lo"),
    ],
    "tma",
  )
}
export const CARRIAGE_TILE = tileSolid(0, CARRIAGE_Y, 4.6)

// ---------------------------------------------------------------- press (tensor core)
export const STATION_X = [24, 94]
const STATION_Y = -12
const DIE_TOP = 10.5
const HEAD_Z = [36, 46] as const
const BEAM: Plan = { x: -17, y: -18, w: 148, d: 12, r: 1.2 }
const POST_X = [-12, 126]
function anvil(cx: number): Item[] {
  const base: Plan = { x: cx - 10, y: STATION_Y - 10, w: 20, d: 20, r: 1.6 }
  const die: Plan = { x: cx - 6, y: STATION_Y - 6, w: 12, d: 12, r: 0.8 }
  return tag(
    [
      S(k.slabOf(base, 0, 9, P, 4, 0.6), "mid"),
      D(byDepth(k.corners(base, 2)).map(([x, y]) => at(x, y, 9)), 0.4),
      S(k.slabOf(die, 9, DIE_TOP - 9, P, 3, 0.3), "hi", "lo"),
      L(k.planOutline(k.insetPlan(die, 2), DIE_TOP, P, 3), "faint"),
    ],
    "press",
  )
}
function posts(): Item[] {
  const out: Item[] = []
  for (const x of POST_X) {
    out.push(S(k.cylinder(x, STATION_Y, 5.2, 0, 2.6, P, 28, 0.4), "lo"))
    out.push(S(k.cylinder(x, STATION_Y, 3.2, 2.6, HEAD_Z[1] - 2.6, P, 24), "mid", "none"))
    out.push(L(k.sideArc(x, STATION_Y, 3.2, 20, P, 16), "faint"))
  }
  return tag(out, "press")
}
function beam(): Item[] {
  return tag(
    [
      S(k.slabOf(BEAM, HEAD_Z[1], 5, P, 3, 0.6), "mid"),
      L(k.lineOnTop([BEAM.x + 4, STATION_Y], [BEAM.x + BEAM.w - 4, STATION_Y], HEAD_Z[1] + 5, P), "faint"),
      D(POST_X.flatMap((x) => [at(x - 3, STATION_Y - 3.5, HEAD_Z[1] + 5), at(x + 3, STATION_Y + 3.5, HEAD_Z[1] + 5)]), 0.42),
    ],
    "press",
  )
}
// head and pad built at x = 0; the ram's length changes, so it is rebuilt
export const HEAD = (() => {
  const head: Plan = { x: -8, y: STATION_Y - 4.5, w: 16, d: 9, r: 1.2 }
  return [
    S(k.slabOf(head, HEAD_Z[0], HEAD_Z[1] - HEAD_Z[0], P, 3, 0.5), "mid"),
    L(k.sideArc(0, STATION_Y, 2.2, HEAD_Z[0] - 0.01, P, 12), "faint"),
    D([at(-5.5, STATION_Y + 4.5, HEAD_Z[0] + 6), at(5.5, STATION_Y + 4.5, HEAD_Z[0] + 6)], 0.4),
  ].map((item) => ({ ...item, part: "press" as Part })) as Item[]
})()
const PAD_H = 1.6
const RAM_REST = 19 // pad bottom at rest
export const padBottom = (down: number) => RAM_REST + (DIE_TOP - RAM_REST) * down
export const ramAt = (down: number) => {
  const z = padBottom(down) + PAD_H
  return k.cylinder(0, STATION_Y, 2, z, HEAD_Z[0] - z, P, 18)
}
export const PAD = k.cylinder(0, STATION_Y, 4.4, RAM_REST, PAD_H, P, 28, 0.4)

// ---------------------------------------------------------------- dials and lever
const NARROW = { dx: -12, dy: 21, r: 6.4, z: 10, stem: 6 }
const WIDE = { dx: 14, dy: 20, r: 8, z: 9 }
const LEVER = { dx: 1, dy: 19, z: 6.5, len: 13 }
const SWEEP = (300 * Math.PI) / 180
const START = (-150 * Math.PI) / 180

function dialTicks(cx: number, cy: number, r: number, bits: number, z: number, majorEvery: number) {
  const minor: string[] = []
  const major: string[] = []
  for (let i = 0; i <= bits; i++) {
    const a = START + (i / bits) * SWEEP
    const big = i % majorEvery === 0 || i === bits
    const inner = r - (big ? 2 : 1.1)
    const sx = msin(a)
    const sy = -mcos(a)
    ;(big ? major : minor).push(k.lineOnTop([cx + sx * inner, cy + sy * inner], [cx + sx * r, cy + sy * r], z, P))
  }
  return { minor: minor.join(""), major: major.join("") }
}

function narrowDial(cx: number): Item[] {
  const x = cx + NARROW.dx
  const y = NARROW.dy
  const top = NARROW.z + 3.4
  const t = dialTicks(x, y, NARROW.r - 1.2, ACC_BITS, top, 7)
  return tag(
    [
      S(k.cylinder(x, y, 3.4, 0, 1.4, P, 20), "lo"),
      S(k.cylinder(x, y, 1.5, 1.4, NARROW.z - 1.4, P, 14), "mid", "none"),
      S(k.cylinder(x, y, NARROW.r, NARROW.z, top - NARROW.z, P, 48, 0.6), "hi", "lo"),
      L(k.knurl(x, y, NARROW.r, top - 1.6, top, 44, P, 0.25), "lo"),
      L(k.sideArc(x, y, NARROW.r, top - 1.6, P, 28), "faint"),
      L(k.ring(x, y, NARROW.r - 1, top, P, 40), "lo"),
      L(t.minor, "lo"),
      L(t.major, "mid"),
      L(k.ring(x, y, 0.8, top, P, 12), "hi"),
    ],
    "narrow",
  )
}
function wideDial(cx: number): Item[] {
  const x = cx + WIDE.dx
  const y = WIDE.dy
  const box: Plan = { x: x - 10, y: y - 9.5, w: 20, d: 19, r: 1.6 }
  const top = WIDE.z + 3.4
  const t = dialTicks(x, y, WIDE.r - 1.2, FP32_BITS, top, 4)
  return tag(
    [
      S(k.slabOf(box, 0, WIDE.z - 2, P, 4, 0.5), "mid"),
      D(byDepth(k.corners(box, 1.8)).map(([px, py]) => at(px, py, WIDE.z - 2)), 0.38),
      S(k.cylinder(x, y, WIDE.r + 0.6, WIDE.z - 2, 2, P, 48), "lo"),
      S(k.cylinder(x, y, WIDE.r, WIDE.z, top - WIDE.z, P, 56, 0.6), "hi", "lo"),
      L(k.knurl(x, y, WIDE.r, top - 1.6, top, 56, P, 0.25), "lo"),
      L(k.sideArc(x, y, WIDE.r, top - 1.6, P, 32), "faint"),
      L(k.ring(x, y, WIDE.r - 1, top, P, 48), "lo"),
      L(t.minor, "lo"),
      L(t.major, "mid"),
      L(k.ring(x, y, 0.8, top, P, 12), "hi"),
    ],
    "wide",
  )
}
function leverBase(cx: number): Item[] {
  const x = cx + LEVER.dx
  const y = LEVER.dy
  const block: Plan = { x: x - 2.4, y: y - 3.5, w: 4.8, d: 7, r: 0.6 }
  return tag(
    [
      S(k.slabOf({ x: x - 3.6, y: y - 5, w: 7.2, d: 10, r: 0.8 }, 0, 1.2, P, 3), "lo"),
      S(k.slabOf(block, 1.2, LEVER.z - 1.2 + 1.2, P, 2, 0.3), "mid"),
      L(k.lineOnTop([x - 2.4, y], [x + 2.4, y], LEVER.z + 1.2, P), "faint"),
    ],
    "lever",
  )
}

export const needleAt = (station: number, which: "narrow" | "wide", value: number) => {
  const cx = STATION_X[station]!
  const dial = which === "narrow" ? NARROW : WIDE
  const bits = which === "narrow" ? ACC_BITS : FP32_BITS
  const x = cx + dial.dx
  const y = dial.dy
  const a = START + (Math.min(value, bits) / bits) * SWEEP
  const r = dial.r - 2.2
  return k.lineOnTop([x - msin(a) * 1.4, y + mcos(a) * 1.4], [x + msin(a) * r, y - mcos(a) * r], dial.z + 3.5, P)
}
// the lever turns in the y-z plane about an axis along x
export const leverAt = (station: number, pull: number) => {
  const x = STATION_X[station]! + LEVER.dx
  const theta = ((-28 + 80 * pull) * Math.PI) / 180
  const from: [number, number, number] = [x, LEVER.dy, LEVER.z + 1.2]
  const to: [number, number, number] = [x, LEVER.dy + msin(theta) * LEVER.len, LEVER.z + 1.2 + mcos(theta) * LEVER.len]
  return { arm: k.segment(from, to, P), knob: at(to[0], to[1], to[2]), pivot: at(from[0], from[1], from[2]) }
}

// ---------------------------------------------------------------- assembly
export interface Art {
  bench: Item[]
  rack: Item[]
  tray: Item[]
  binBack: Item[][]
  binFront: Item[][]
  anvils: Item[]
  posts: Item[]
  beam: Item[]
  stations: { narrow: Item[]; lever: Item[]; wide: Item[] }[]
  rail: Item[]
  carriage: Item[]
  solids: number
}

function build(): Art {
  solids = 0
  const art: Art = {
    bench: bench(),
    rack: rack(),
    tray: binsTray(),
    binBack: Array.from({ length: STAGES }, (_, i) => binBack(i)),
    binFront: Array.from({ length: STAGES }, (_, i) => binFront(i)),
    anvils: STATION_X.flatMap(anvil),
    posts: posts(),
    beam: beam(),
    stations: STATION_X.map((cx) => ({ narrow: narrowDial(cx), lever: leverBase(cx), wide: wideDial(cx) })),
    rail: rail(),
    carriage: carriage(),
    solids: 0,
  }
  // moving solids: head, ram, pad, three bin tiles and the carriage tile
  art.solids = solids + HEAD.filter((i) => i.kind === "solid").length + 2 + STAGES + 1
  return art
}

export const ART = build()
