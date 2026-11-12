// A two-input SwiGLU unit small enough to edit three ways and draw the result.
//
//   g = Wg x + bg          (the gate projection: the matrix Deletion Tuning masks)
//   u = Wu x + bu          (the up projection)
//   h = silu(g) * u        (six hidden neurons)
//   y = d . h + c          (the down projection: the matrix a closed-form edit writes)
//
// The "old task" is the base unit's own sign on a 21 x 21 grid over [-1, 1]^2,
// so the base scores 100% on it by definition and every edit is measured by how
// many of those 441 cells keep their sign. The "new task" is seven labelled
// points (toy-weights.ts) in which the base gets some wrong.
//
// Every edit was computed from the weights in toy-weights.ts and its result
// is frozen in toy-frozen.ts; this module applies and scores them. Transcendentals go through lib/dmath so the server render and
// the browser agree to the bit.

import { mexp } from "@/lib/dmath"

import { BEST_MASKS, CLOSED_DELTAS, LORA_DELTAS } from "./toy-frozen"
import { BASE, NEW_POINTS, type Unit } from "./toy-weights"

export const H = 6
export const GRID = 21

const silu = (z: number) => z / (1 + mexp(-z))

export type Pt = { x: number; y: number; label: 1 | -1 }

export function hidden(n: Unit, x0: number, x1: number): number[] {
  const h: number[] = []
  for (let j = 0; j < H; j++) {
    const g = n.wg[j][0] * x0 + n.wg[j][1] * x1 + n.bg[j]
    const u = n.wu[j][0] * x0 + n.wu[j][1] * x1 + n.bu[j]
    h.push(silu(g) * u)
  }
  return h
}

export function forward(n: Unit, x0: number, x1: number): number {
  const h = hidden(n, x0, x1)
  let y = n.c
  for (let j = 0; j < H; j++) y += n.d[j] * h[j]
  return y
}

export const gridPoints: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let r = 0; r < GRID; r++)
    for (let q = 0; q < GRID; q++) out.push([-1 + (2 * q) / (GRID - 1), 1 - (2 * r) / (GRID - 1)])
  return out
})()

export const signs = (n: Unit) => gridPoints.map(([a, b]) => (forward(n, a, b) >= 0 ? 1 : -1))

export const BASE_SIGNS = signs(BASE)

export function score(n: Unit) {
  const s = signs(n)
  let kept = 0
  for (let i = 0; i < s.length; i++) if (s[i] === BASE_SIGNS[i]) kept++
  let right = 0
  for (const p of NEW_POINTS) if ((forward(n, p.x, p.y) >= 0 ? 1 : -1) === p.label) right++
  return { signs: s, kept, right }
}

const clone = (n: Unit): Unit => ({
  wg: n.wg.map((r) => [...r]),
  bg: [...n.bg],
  wu: n.wu.map((r) => [...r]),
  bu: [...n.bu],
  d: [...n.d],
  c: n.c,
})

// ── Deletion: a 0/1 mask over the 12 gate weights ──────────────────────────
// bit k of `mask` set means gate weight (row k >> 1, column k & 1) is deleted.
export function applyMask(mask: number): Unit {
  const n = clone(BASE)
  for (let k = 0; k < 2 * H; k++) if (mask & (1 << k)) n.wg[k >> 1][k & 1] = 0
  return n
}

export const popcount = (m: number) => {
  let c = 0
  for (let k = 0; k < 2 * H; k++) if (m & (1 << k)) c++
  return c
}

// The best mask with at most `k` deletions, by exhaustive search over all
// 4,096 masks: most new-task points right first, then most old cells kept,
// then fewest deletions. Deletion Tuning learns its mask with a sharpened
// sigmoid because 2^(billions) masks cannot be enumerated; twelve can. The
// search ran offline (4,096 x 448 forward passes); toy-frozen.ts holds the
// winners.
export const bestMasks = BEST_MASKS

// ── LoRA, rank one, on the gate matrix: Wg + a b^T, trained by gradient ──
// descent on the new points only (logistic loss on 4y, learning rate 1,
// central-difference gradients). b starts at zero, as LoRA's
// B factor does, so step 0 is the base unit. The trajectory is stored at a few
// step counts; it keeps moving after the new points are all right.
export const LORA_STEPS = [0, 50, 100, 200, 400, 800] as const

export const loraTrajectory: Unit[] = LORA_DELTAS.map((delta) => {
  const n = clone(BASE)
  for (let j = 0; j < H; j++) for (let i = 0; i < 2; i++) n.wg[j][i] += delta[j][i]
  return n
})

// ── Closed-form edit of the down projection, MEMIT-style ──────────────────
// Solve  min_dd  sum_i (dd . h_i - r_i)^2 + lambda * n * dd^T C dd
// where h_i are the hidden vectors at the new points, r_i the change in y each
// one needs (zero if it is already right by a margin of 0.3, else the change
// that reaches that margin), and C the second moment
// of h over the 441 grid cells we want left alone. Closed form:
//   dd = (K^T K + lambda n C)^-1 K^T r     (a 6 x 6 solve)
export const LAMBDAS = [0, 0.001, 0.01, 0.1, 1] as const

export const closedForm: Unit[] = CLOSED_DELTAS.map((dd) => {
  const n = clone(BASE)
  for (let j = 0; j < H; j++) n.d[j] += dd[j]
  return n
})

/** How many of the unit's 43 parameters (12 gate, 12 up, 6 down, 13 biases) differ from the base. */
export function changed(n: Unit): number {
  let c = 0
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < 2; i++) {
      if (n.wg[j][i] !== BASE.wg[j][i]) c++
      if (n.wu[j][i] !== BASE.wu[j][i]) c++
    }
    if (n.bg[j] !== BASE.bg[j]) c++
    if (n.bu[j] !== BASE.bu[j]) c++
    if (n.d[j] !== BASE.d[j]) c++
  }
  if (n.c !== BASE.c) c++
  return c
}
