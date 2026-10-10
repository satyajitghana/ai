import { mcos, mexp, msin } from "@/lib/dmath"

// A toy pair of "images" for the correspondence explorer. Nothing here comes
// from FreeMatching: it is a 32 x 20 grid of hand-built feature vectors, made
// so that the failure the paper is about can be seen in a few cells.
//
// Image A: a diamond ("star") at the upper left, a small ring at the upper
// right, on a grass-like background. Image B is an "edit" of A: the star has
// been moved across the frame, rotated and enlarged, the ring nudged, the
// background regenerated (snow instead of grass), and optionally the star's
// appearance changed and a second copy of it added.
//
// Every cell carries an 8-d feature:
//   object cell    [is-star, is-ring, cos(.8 pi u), sin(.8 pi u), cos(.8 pi v), sin(.8 pi v), 0, 0] (scaled)
//   background A   [0, 0, small texture x4, 1, 0]
//   background B   [0, 0, small texture x4, 0, 1]
// where (u, v) in [-1, 1] are the cell's coordinates in its object's own frame.
// So a point keeps its feature wherever the object goes; that is what an
// "identity-preserving" feature would do, and the thing the explorer is about
// is how you search for it.

export const COLS = 32
export const ROWS = 20
export const DIM = 8

export type Obj = "star" | "ring" | "dup" | "bg"

export type Cell = {
  obj: Obj
  u: number
  v: number
  f: number[]
}

type Placement = { cx: number; cy: number; rot: number; scale: number }

const STAR_R = 3.6
const RING_R = 2.8

// Integer hash -> [-1, 1). Math.imul and >>> are exact on every engine.
function hash(x: number, y: number, k: number, seed: number) {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(k + 1, 2246822519) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return ((h >>> 0) % 20000) / 10000 - 1
}

export function starPlacement(img: "A" | "B", motion: number): Placement {
  if (img === "A") return { cx: 6, cy: 6, rot: 0, scale: 1 }
  return { cx: 6 + 20 * motion, cy: 6 + 8 * motion, rot: 0.9 * motion, scale: 1 + 0.15 * motion }
}

export function ringPlacement(img: "A" | "B", motion: number): Placement {
  if (img === "A") return { cx: 24, cy: 4, rot: 0, scale: 1 }
  return { cx: 24 - 3 * motion, cy: 4 + 0.5 * motion, rot: 0.4 * motion, scale: 1 }
}

const DUP: Placement = { cx: 8, cy: 15, rot: -0.6, scale: 1.05 }

// Object-local coordinates of grid point (x, y) under a placement and radius.
function local(x: number, y: number, p: Placement, r: number) {
  const dx = x - p.cx
  const dy = y - p.cy
  const c = mcos(-p.rot)
  const s = msin(-p.rot)
  return { u: (c * dx - s * dy) / (r * p.scale), v: (s * dx + c * dy) / (r * p.scale) }
}

const inStar = (u: number, v: number) => Math.abs(u) + Math.abs(v) <= 1
const inRing = (u: number, v: number) => {
  const d = Math.sqrt(u * u + v * v)
  return d >= 0.45 && d <= 1
}

function objFeature(kind: "star" | "ring", u: number, v: number) {
  const pu = 0.8 * Math.PI * u
  const pv = 0.8 * Math.PI * v
  return [kind === "star" ? 1 : 0, kind === "ring" ? 1 : 0, 0.9 * mcos(pu), 0.9 * msin(pu), 0.9 * mcos(pv), 0.9 * msin(pv), 0, 0]
}

export type SceneOpts = { motion: number; edit: number; duplicate: boolean }

export function buildImage(img: "A" | "B", o: SceneOpts): Cell[] {
  const cells: Cell[] = []
  const star = starPlacement(img, o.motion)
  const ring = ringPlacement(img, o.motion)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ls = local(x, y, star, STAR_R)
      const lr = local(x, y, ring, RING_R)
      const ld = local(x, y, DUP, STAR_R)
      let cell: Cell
      if (inStar(ls.u, ls.v)) cell = { obj: "star", u: ls.u, v: ls.v, f: objFeature("star", ls.u, ls.v) }
      else if (inRing(lr.u, lr.v)) cell = { obj: "ring", u: lr.u, v: lr.v, f: objFeature("ring", lr.u, lr.v) }
      else if (img === "B" && o.duplicate && inStar(ld.u, ld.v)) cell = { obj: "dup", u: ld.u, v: ld.v, f: objFeature("star", ld.u, ld.v) }
      else {
        const f = [0, 0, 0, 0, 0, 0, img === "A" ? 1 : 0, img === "B" ? 1 : 0]
        for (let k = 2; k < 6; k++) f[k] = 0.25 * hash(x, y, k, img === "A" ? 11 : 29)
        cell = { obj: "bg", u: 0, v: 0, f }
      }
      // The edit changes the star's appearance in B, the identity stays.
      if (img === "B" && (cell.obj === "star" || cell.obj === "dup") && o.edit > 0) {
        for (let k = 0; k < DIM; k++) cell.f[k] += 0.7 * o.edit * hash(x, y, k, 57)
      }
      cells.push(cell)
    }
  }
  return cells
}

export function cosine(a: number[], b: number[]) {
  let d = 0
  let na = 0
  let nb = 0
  for (let k = 0; k < DIM; k++) {
    d += a[k] * b[k]
    na += a[k] * a[k]
    nb += b[k] * b[k]
  }
  return na > 0 && nb > 0 ? d / Math.sqrt(na * nb) : 0
}

// Where the query cell of A truly lands in B (from the scene's own transform),
// or null for a background cell, which has no counterpart after the edit.
export function truth(qx: number, qy: number, o: SceneOpts) {
  const a = buildImageCell("A", qx, qy, o)
  if (a.obj === "bg") return null
  const p = a.obj === "star" ? starPlacement("B", o.motion) : ringPlacement("B", o.motion)
  const r = a.obj === "star" ? STAR_R : RING_R
  const c = mcos(p.rot)
  const s = msin(p.rot)
  const lx = a.u * r * p.scale
  const ly = a.v * r * p.scale
  return { x: p.cx + c * lx - s * ly, y: p.cy + s * lx + c * ly }
}

function buildImageCell(img: "A" | "B", x: number, y: number, o: SceneOpts) {
  return buildImage(img, o)[y * COLS + x]
}

export type Match = { x: number; y: number; score: number }

export function search(sim: number[], qx: number, qy: number, radius: number | null): Match {
  let best = -2
  let bx = qx
  let by = qy
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (radius !== null && (Math.abs(x - qx) > radius || Math.abs(y - qy) > radius)) continue
      const s = sim[y * COLS + x]
      if (s > best) {
        best = s
        bx = x
        by = y
      }
    }
  }
  return { x: bx, y: by, score: best }
}

// Soft-argmax: the softmax-weighted mean position. This is what a regression
// head that reads attention-weighted positions tends toward: one blended answer.
export function softArgmax(sim: number[], tau: number) {
  let m = -2
  for (const s of sim) if (s > m) m = s
  let z = 0
  let sx = 0
  let sy = 0
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const w = mexp((sim[y * COLS + x] - m) / tau)
      z += w
      sx += w * x
      sy += w * y
    }
  }
  return { x: sx / z, y: sy / z }
}
