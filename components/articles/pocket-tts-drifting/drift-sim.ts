import { mcos, mexp, mlog } from "@/lib/dmath"

// A 2-D drifting toy, computed exactly the way the drifting paper's Algorithm 2
// and Kyutai's `Drifting._drift` compute the field, minus the network.
//
// - Data ("positives"): three fixed clusters.
// - Generated samples ("negatives"): particles that start as one tight blob.
// - Each training step: pairwise distances from every generated sample to
//   [data, other generated samples], divided by their mean (the per-frame
//   normalisation), logits = -d / tau, a softmax over the target axis and one
//   over the generated axis, geometric mean A = sqrt(A_row * A_col), then
//     W_pos = A_pos * sum(A_neg),  W_neg = A_neg * sum(A_pos)
//     V     = W_pos @ y_pos - W_neg @ y_neg - (sum W_pos - sum W_neg) * x
//   and every sample moves by ETA * V. In the real model a network is trained
//   so its output moves that way; here the samples move directly, which is the
//   update the loss ||x - stopgrad(x + V)||^2 asks for.
// - "learned" tau takes one gradient step per training step on
//   -mean log P(data | sample), the kernel read as a classifier, exactly the
//   auxiliary loss of the blog post; only tau sees this loss.
//
// Everything is deterministic: a fixed LCG seeds the points, exp/log go through
// lib/dmath, the rest is + - * / sqrt.

export type Pt = [number, number]

export const N_GEN = 36
export const STEPS = 160
export const ETA = 0.5
const TAU_LR = 0.08
const SELF = 1e9

function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0x100000000
  }
}
function gauss(rng: () => number): number {
  const u1 = Math.max(1e-9, rng())
  const u2 = rng()
  return Math.sqrt(-2 * mlog(u1)) * mcos(2 * Math.PI * u2)
}

// Three data clusters in a 0..10 box; generated samples start as a tight blob
// in the top-right, away from all of them.
const CENTERS: Pt[] = [
  [2.4, 7.2],
  [5.2, 2.2],
  [8.0, 6.6],
]
export const DATA: Pt[] = (() => {
  const rng = makeRng(7)
  const out: Pt[] = []
  for (const [cx, cy] of CENTERS)
    for (let i = 0; i < 12; i++) out.push([cx + 0.45 * gauss(rng), cy + 0.45 * gauss(rng)])
  return out
})()
export const START: Pt[] = (() => {
  const rng = makeRng(42)
  return Array.from({ length: N_GEN }, () => [8.6 + 0.18 * gauss(rng), 9.0 + 0.18 * gauss(rng)] as Pt)
})()

const dist = (a: Pt, b: Pt) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

// exp for the inner loop. lib/dmath's mexp pins Math.exp by rounding through
// toPrecision, which is right for a handful of calls and far too slow for the
// ~800k a run makes here. This one is built only from + - * / and
// Math.round, which IEEE-754 makes identical on every engine, so it is just
// as deterministic: x = k ln2 + r with |r| <= ln2 / 2, e^r by a degree-11
// Taylor polynomial (relative error under 1e-13), 2^k from an exact table.
// Inputs below -60 return 0: every caller subtracts the row max first, so
// e^-60 (about 1e-26) is already nothing next to the 1 that the max became.
const LN2 = 0.6931471805599453
const POW2: number[] = (() => {
  const t: number[] = []
  let v = 1
  for (let k = 0; k <= 90; k++) {
    t.push(v)
    v /= 2
  }
  return t
})()
export function fexp(x: number): number {
  if (x < -60) return 0
  if (x > 0) return mexp(x)
  const k = Math.round(-x / LN2)
  const r = x + k * LN2
  let term = 1
  let sum = 1
  for (let i = 1; i <= 11; i++) {
    term = (term * r) / i
    sum += term
  }
  return sum * POW2[k]
}

export type Step = { x: Pt[]; move: Pt[]; tau: number; vrms: number }

// One drifting update. Returns the moved samples, the field RMS, and the
// gradient of -mean log P(data) with respect to log tau. Flat arrays: row i
// is generated sample i, columns 0..P-1 are data, P..P+n-1 are the samples.
function drift(x: Pt[], tau: number) {
  const n = x.length
  const P = DATA.length
  const m = P + n
  const d = new Float64Array(n * m)
  let sum = 0
  let cnt = 0
  for (let i = 0; i < n; i++)
    for (let k = 0; k < m; k++) {
      if (k - P === i) {
        d[i * m + k] = -1
        continue
      }
      const y = k < P ? DATA[k] : x[k - P]
      const v = dist(x[i], y)
      d[i * m + k] = v
      sum += v
      cnt++
    }
  // per-frame normalisation: divide by the mean of all real distances
  const scale = Math.max(1e-6, sum / cnt)
  const logit = new Float64Array(n * m)
  for (let j = 0; j < n * m; j++) logit[j] = d[j] < 0 ? -SELF : -(d[j] / scale) / tau
  // softmax over targets (each row) and over generated samples (each column)
  const row = new Float64Array(n * m)
  for (let i = 0; i < n; i++) {
    let mx = -Infinity
    for (let k = 0; k < m; k++) mx = Math.max(mx, logit[i * m + k])
    let z = 0
    for (let k = 0; k < m; k++) z += row[i * m + k] = fexp(logit[i * m + k] - mx)
    for (let k = 0; k < m; k++) row[i * m + k] /= z
  }
  const col = new Float64Array(n * m)
  for (let k = 0; k < m; k++) {
    let mx = -Infinity
    for (let i = 0; i < n; i++) mx = Math.max(mx, logit[i * m + k])
    let z = 0
    for (let i = 0; i < n; i++) z += col[i * m + k] = fexp(logit[i * m + k] - mx)
    for (let i = 0; i < n; i++) col[i * m + k] /= z
  }
  const out: Pt[] = []
  let ss = 0
  let gradLogTau = 0
  for (let i = 0; i < n; i++) {
    const A = new Float64Array(m)
    let sPos = 0
    let sNeg = 0
    for (let k = 0; k < m; k++) {
      if (k - P === i) continue
      A[k] = Math.sqrt(Math.max(1e-12, row[i * m + k] * col[i * m + k]))
      if (k < P) sPos += A[k]
      else sNeg += A[k]
    }
    // W_pos = A_pos * sum(A_neg), W_neg = A_neg * sum(A_pos)
    let vx = 0
    let vy = 0
    for (let k = 0; k < m; k++) {
      if (k - P === i) continue
      const y = k < P ? DATA[k] : x[k - P]
      const w = k < P ? A[k] * sNeg : -A[k] * sPos
      vx += w * (y[0] - x[i][0])
      vy += w * (y[1] - x[i][1])
    }
    ss += vx * vx + vy * vy
    out.push([x[i][0] + ETA * vx, x[i][1] + ETA * vy])
    // d/dlog(tau) of log P(data | x_i) = (E_pos[d] - E_all[d]) / tau, in
    // normalised distance units, with E under the row softmax restricted to
    // the data columns (E_pos) or over all columns (E_all).
    let pPos = 0
    let ePos = 0
    let eAll = 0
    for (let k = 0; k < m; k++) {
      if (k - P === i) continue
      const dn = d[i * m + k] / scale
      const p = row[i * m + k]
      eAll += p * dn
      if (k < P) {
        pPos += p
        ePos += p * dn
      }
    }
    if (pPos > 1e-12) gradLogTau += -((ePos / pPos - eAll) / tau)
  }
  return { out, vrms: Math.sqrt(ss / n), gradLogTau: gradLogTau / n }
}

export function simulate(mode: "fixed" | "learned", tau0: number): Step[] {
  let x = START.map((p) => [p[0], p[1]] as Pt)
  let logTau = mlog(tau0)
  const steps: Step[] = []
  for (let s = 0; s <= STEPS; s++) {
    const tau = mexp(logTau)
    const r = drift(x, tau)
    steps.push({ x, move: r.out.map((p, i) => [p[0] - x[i][0], p[1] - x[i][1]] as Pt), tau, vrms: r.vrms })
    x = r.out
    if (mode === "learned") logTau = Math.max(mlog(0.005), Math.min(mlog(20), logTau - TAU_LR * r.gradLogTau))
  }
  return steps
}

// Two readouts a reader can check against the picture.
//   miss   mean distance from each data point to its nearest generated sample
//          (high = data left uncovered)
//   spread RMS distance of the generated samples from their own centroid
//          (data's own is about 2.6 here; near 0 = collapsed)
export function readout(x: Pt[]) {
  let miss = 0
  for (const y of DATA) {
    let best = Infinity
    for (const p of x) best = Math.min(best, dist(p, y))
    miss += best
  }
  let cx = 0
  let cy = 0
  for (const p of x) {
    cx += p[0]
    cy += p[1]
  }
  cx /= x.length
  cy /= x.length
  let sp = 0
  for (const p of x) sp += (p[0] - cx) ** 2 + (p[1] - cy) ** 2
  return { miss: miss / DATA.length, spread: Math.sqrt(sp / x.length) }
}

export const DATA_SPREAD = readout(DATA).spread
