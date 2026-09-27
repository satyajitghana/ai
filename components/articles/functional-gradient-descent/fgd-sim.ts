import { mcos, mexp, msin, mtanh } from "@/lib/dmath"

// A 1-D version of the paper's toy problem (its Figure 1 is the 2-D one):
// minimise L(f) = 1/2 * integral over [0,1] of (f(x) - f*(x))^2 dx.
//
// In L^2 the functional gradient of this loss is the residual itself,
// grad L(f) = f - f*. It is a whole function, so a program can only hold an
// approximation g_t of it. Three ways of holding it run here, plus a network:
//
//   adaptive  Algorithm 1 of the paper. g_t is piecewise constant on dyadic
//             cells. Before each step it certifies an upper bound U on
//             ||g_t - grad L(f_t)|| and splits the worst cell until
//             (1 + eps) U < eps ||g_t||, then steps f <- f - eta g.
//   grid16    the same step on a fixed grid of 16 cells, never refined.
//   grid128   the same on 128 fixed cells.
//   net       parameter-space training of a 16-unit ReLU network with Adam
//             on the same loss.
//
// Everything is deterministic: the transcendental calls go through lib/dmath,
// the network's initial weights come from a seeded integer PRNG, and the rest
// is + - * / and sqrt, which IEEE-754 pins exactly. Server and browser compute
// the same numbers, so the SVG hydrates without a mismatch.

export const Q = 2048 // midpoint quadrature for the L^2 integral
export const T = 40 // steps shown
export const ETA = 0.25 // step size, every FGD variant
export const EPS = 0.5 // the paper's tolerance epsilon
export const THRESH = EPS / (1 + EPS) // certified bound on U/||g||: 1/3
export const MAX_DEPTH = 10 // cells no narrower than 1/1024
export const NET_UNITS = 16
export const NET_LR = 0.02 // best final loss of 0.01, 0.02, 0.05, 0.1, 0.2
const NET_Q = 512 // quadrature the network trains on
export const PLOT_N = 400

// Theorem 3.10 (iii) with alpha = beta = K = mu = 1 (L^2 fitting, B = H):
// r = alpha - K eta / 2 - (beta + 3/2 K eta) * e/(1-e), e = eps/(1+eps).
const E_REL = THRESH
export const R_CONST = 1 - ETA / 2 - (1 + 1.5 * ETA) * (E_REL / (1 - E_REL))
export const RATE = 1 - 2 * ETA * R_CONST // per-step contraction of L - L*

// --- the target f* -----------------------------------------------------------
// A smooth wave, a sharp step at x = 0.3 and a wave packet near x = 0.72: three
// scales, so a single cell width is wrong almost everywhere.
const TAU = 2 * Math.PI
const A1 = 0.4
const A2 = 0.35
const X0 = 0.3
const WSTEP = 0.008
const A3 = 0.3
const X1 = 0.72
const SPREAD = 0.045
const OMEGA = TAU * 10

export function target(x: number): number {
  const u = (x - X1) / SPREAD
  return A1 * msin(TAU * x) + A2 * mtanh((x - X0) / WSTEP) + A3 * mexp(-u * u) * msin(OMEGA * x)
}

function targetSlope(x: number): number {
  const u = (x - X1) / SPREAD
  const th = mtanh((x - X0) / WSTEP)
  const e = mexp(-u * u)
  return (
    A1 * TAU * mcos(TAU * x) +
    (A2 / WSTEP) * (1 - th * th) +
    A3 * e * ((-2 * u / SPREAD) * msin(OMEGA * x) + OMEGA * mcos(OMEGA * x))
  )
}

// A global bound on |f*''|, term by term: (2 pi)^2 A1 for the sine;
// max|2 tanh sech^2| = 4/(3 sqrt 3) < 0.7699 for the step; for the packet
// |G''| <= 2/s^2, |G'| <= sqrt(2) e^(-1/2) / s < 0.858 / s, |S'| <= w, |S''| <= w^2.
const M2 =
  A1 * TAU * TAU +
  (0.7699 * A2) / (WSTEP * WSTEP) +
  A3 * (2 / (SPREAD * SPREAD) + ((2 * 0.858) / SPREAD) * OMEGA + OMEGA * OMEGA)

const XS: number[] = []
const FSTAR: number[] = []
const SLOPE: number[] = []
for (let i = 0; i < Q; i++) {
  const x = (i + 0.5) / Q
  XS.push(x)
  FSTAR.push(target(x))
  SLOPE.push(Math.abs(targetSlope(x)))
}

export const PLOT_X: number[] = []
export const PLOT_TARGET: number[] = []
for (let i = 0; i < PLOT_N; i++) {
  const x = i / (PLOT_N - 1)
  PLOT_X.push(x)
  PLOT_TARGET.push(target(x))
}

function lossOf(values: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < Q; i++) {
    const r = values[i] - FSTAR[i]
    s += r * r
  }
  return (0.5 * s) / Q
}

// --- piecewise-constant representations --------------------------------------
type Cell = {
  d: number // depth: width 2^-d
  j: number // index at that depth
  h: number // width
  lo: number // first quadrature index inside
  hi: number // one past the last
  mid: number // f*(midpoint): the only place f* is read
  e2: number // h * (sup-norm error bound)^2: this cell's share of U^2
  v: number // value of f_t on the cell
}

function makeCell(d: number, j: number, v: number): Cell {
  const n = 1 << d
  const h = 1 / n
  const lo = (j * Q) / n
  const hi = ((j + 1) * Q) / n
  // Local Lipschitz bound: the largest |f*'| at the quadrature points in the
  // cell, plus M2 times the farthest any point of the cell sits from one.
  let m = 0
  for (let i = lo; i < hi; i++) if (SLOPE[i] > m) m = SLOPE[i]
  const lip = m + (M2 * 0.5) / Q
  // g is read at the midpoint, so |g - grad L| <= lip * h / 2 on the cell.
  const e = (lip * h) / 2
  return { d, j, h, lo, hi, mid: target((j + 0.5) * h), e2: h * e * e, v }
}

export type Frame = {
  loss: number
  edges: number[] // cell boundaries, or the network's kinks
  values: number[] // f_t on each cell (empty for the network)
  gvalues: number[] // g_t on each cell (empty for the network)
  samples: number[] // f_t at PLOT_X
  cells: number
  splits: number // cells split at this step before the update
  ratio: number // certified U / ||g_t|| at this step (NaN for the network)
  capped: boolean // the tolerance could not be met at MAX_DEPTH
}

function sampleCells(cells: Cell[]): number[] {
  const out: number[] = []
  let k = 0
  for (let i = 0; i < PLOT_N; i++) {
    const x = PLOT_X[i]
    while (k < cells.length - 1 && x >= (cells[k].j + 1) * cells[k].h) k++
    out.push(cells[k].v)
  }
  return out
}

function frameOf(cells: Cell[], splits: number, ratio: number, capped: boolean): Frame {
  const dense = new Float64Array(Q)
  for (const c of cells) for (let i = c.lo; i < c.hi; i++) dense[i] = c.v
  const edges = [0]
  for (const c of cells) edges.push((c.j + 1) * c.h)
  return {
    loss: lossOf(dense),
    edges,
    values: cells.map((c) => c.v),
    gvalues: cells.map((c) => c.v - c.mid),
    samples: sampleCells(cells),
    cells: cells.length,
    splits,
    ratio,
    capped,
  }
}

function bound(cells: Cell[]): { U: number; G: number } {
  let u2 = 0
  let g2 = 0
  for (const c of cells) {
    const g = c.v - c.mid
    u2 += c.e2
    g2 += c.h * g * g
  }
  return { U: Math.sqrt(u2), G: Math.sqrt(g2) }
}

function runAdaptive(): Frame[] {
  let cells: Cell[] = [makeCell(0, 0, 0)]
  const frames: Frame[] = []
  for (let t = 0; t <= T; t++) {
    let splits = 0
    let capped = false
    let b = bound(cells)
    // the while loop of Algorithm 1
    while (!((1 + EPS) * b.U < EPS * b.G)) {
      let worst = -1
      let wv = -1
      for (let q = 0; q < cells.length; q++) {
        const c = cells[q]
        if (c.d < MAX_DEPTH && c.e2 > wv) {
          wv = c.e2
          worst = q
        }
      }
      if (worst < 0) {
        capped = true
        break
      }
      const c = cells[worst]
      cells = [
        ...cells.slice(0, worst),
        makeCell(c.d + 1, 2 * c.j, c.v),
        makeCell(c.d + 1, 2 * c.j + 1, c.v),
        ...cells.slice(worst + 1),
      ]
      splits++
      b = bound(cells)
    }
    frames.push(frameOf(cells, splits, b.G > 0 ? b.U / b.G : Infinity, capped))
    for (const c of cells) c.v = c.v - ETA * (c.v - c.mid)
  }
  return frames
}

function runGrid(depth: number): Frame[] {
  const n = 1 << depth
  const cells: Cell[] = []
  for (let j = 0; j < n; j++) cells.push(makeCell(depth, j, 0))
  const frames: Frame[] = []
  for (let t = 0; t <= T; t++) {
    const b = bound(cells)
    frames.push(frameOf(cells, 0, b.G > 0 ? b.U / b.G : Infinity, false))
    for (const c of cells) c.v = c.v - ETA * (c.v - c.mid)
  }
  return frames
}

// --- the network: f(x) = c + sum_j a_j relu(w_j x + b_j) ------------------------
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function runNet(): Frame[] {
  const H = NET_UNITS
  const rnd = mulberry32(7)
  const p = new Float64Array(3 * H + 1) // w[0..H), b[H..2H), a[2H..3H), c
  for (let j = 0; j < H; j++) {
    const sign = rnd() < 0.5 ? -1 : 1
    const w = sign * (2 + 4 * rnd())
    const kink = rnd()
    p[j] = w
    p[H + j] = -w * kink
    // output weights start at zero, so f_0 = 0 exactly as for the FGD runs
  }
  const n = p.length
  const m1 = new Float64Array(n)
  const m2 = new Float64Array(n)
  const xt: number[] = []
  const yt: number[] = []
  for (let i = 0; i < NET_Q; i++) {
    const x = (i + 0.5) / NET_Q
    xt.push(x)
    yt.push(target(x))
  }
  const f = (x: number) => {
    let s = p[3 * H]
    for (let j = 0; j < H; j++) {
      const z = p[j] * x + p[H + j]
      if (z > 0) s += p[2 * H + j] * z
    }
    return s
  }
  const frames: Frame[] = []
  let b1t = 1
  let b2t = 1
  for (let t = 0; t <= T; t++) {
    const dense = new Float64Array(Q)
    for (let i = 0; i < Q; i++) dense[i] = f(XS[i])
    const kinks: number[] = []
    for (let j = 0; j < H; j++) {
      const k = -p[H + j] / p[j]
      if (k > 0 && k < 1) kinks.push(k)
    }
    kinks.sort((a, b) => a - b)
    frames.push({
      loss: lossOf(dense),
      edges: kinks,
      values: [],
      gvalues: [],
      samples: PLOT_X.map(f),
      cells: H,
      splits: 0,
      ratio: NaN,
      capped: false,
    })
    // one full-batch Adam step on the quadrature loss
    const gr = new Float64Array(n)
    for (let i = 0; i < NET_Q; i++) {
      const x = xt[i]
      const r = (f(x) - yt[i]) / NET_Q
      for (let j = 0; j < H; j++) {
        const z = p[j] * x + p[H + j]
        if (z > 0) {
          const dz = r * p[2 * H + j]
          gr[j] += dz * x
          gr[H + j] += dz
          gr[2 * H + j] += r * z
        }
      }
      gr[3 * H] += r
    }
    b1t *= 0.9
    b2t *= 0.999
    for (let q = 0; q < n; q++) {
      m1[q] = 0.9 * m1[q] + 0.1 * gr[q]
      m2[q] = 0.999 * m2[q] + 0.001 * gr[q] * gr[q]
      const mh = m1[q] / (1 - b1t)
      const vh = m2[q] / (1 - b2t)
      p[q] -= (NET_LR * mh) / (Math.sqrt(vh) + 1e-8)
    }
  }
  return frames
}

export type MethodId = "adaptive" | "grid16" | "grid128" | "net"
export type Runs = Record<MethodId, Frame[]>

let cache: Runs | null = null
export function simulate(): Runs {
  if (!cache) {
    cache = { adaptive: runAdaptive(), grid16: runGrid(4), grid128: runGrid(7), net: runNet() }
  }
  return cache
}

// Step at which the adaptive run first fails to certify its tolerance.
export function firstCapped(frames: Frame[]): number {
  const i = frames.findIndex((f) => f.capped)
  return i < 0 ? frames.length : i
}
