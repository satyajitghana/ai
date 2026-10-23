// A line-for-line port of d3-turbo's Box decoding, from the repository's own
// d3_compose.py (vllm-sr/d3-turbo at a0f3e9e): expected() reads each edge as the
// mean of its 128-bin distribution, order_edges() repairs crossed edges into a
// one-bin sliver, confidence() is the share of 512 quasi-random (R4 sequence)
// draws from the four edge distributions whose box has IoU >= 0.5 with the
// reported box, and calibrate() maps that share through the piecewise-linear
// table in decision_config.json (systemone.box_calibration). I checked the port
// against the Python on six synthetic cases; it agrees to four decimals.

import { mexp, mpow } from "@/lib/dmath"

export const BINS = 128
const IOU_HIT = 0.5

export const CALIBRATION: [number, number][] = [
  [0.0, 0.0], [0.001953, 0.0], [0.003906, 0.0], [0.005859, 0.0], [0.007812, 0.030303],
  [0.017578, 0.045455], [0.052734, 0.144928], [0.119141, 0.173913], [0.181641, 0.375],
  [0.279297, 0.387755], [0.345703, 0.5], [0.361328, 0.571429], [0.376953, 0.571429],
  [0.449219, 0.637681], [0.53125, 0.666667], [0.587891, 0.666667], [0.591797, 0.769231],
  [0.615234, 0.783784], [0.65625, 0.8], [0.658203, 0.8], [0.701172, 0.889831],
  [0.753906, 0.905797], [0.802734, 0.93736], [0.884766, 0.956522], [0.890625, 0.971429],
  [0.898438, 0.972274], [0.951172, 0.986711], [0.964844, 0.997406], [0.982422, 1.0],
  [0.984375, 1.0], [0.986328, 1.0], [0.988281, 1.0], [0.990234, 1.0], [0.992188, 1.0],
  [0.994141, 1.0], [0.996094, 1.0], [0.998047, 1.0], [1.0, 1.0],
]

function r4Points(n: number): number[][] {
  let phi = 1.0
  for (let i = 0; i < 64; i++) phi = mpow(1 + phi, 1 / 5)
  const alphas = [0, 1, 2, 3].map((d) => mpow(1 / phi, d + 1) % 1)
  const out: number[][] = []
  for (let i = 0; i < n; i++) out.push(alphas.map((a) => (0.5 + a * (i + 1)) % 1.0))
  return out
}

export const POINTS = r4Points(512)

export type Box = { top: number; bottom: number; left: number; right: number }

/** A 128-bin distribution: a Gaussian bump at `mu` (fraction of the image) with spread `sd`. */
export function gauss(mu: number, sd: number): number[] {
  const p: number[] = []
  let total = 0
  for (let k = 0; k < BINS; k++) {
    const z = ((k + 0.5) / BINS - mu) / sd
    const v = mexp(-0.5 * z * z)
    p.push(v)
    total += v
  }
  return p.map((v) => v / total)
}

function expected(p: number[]): number {
  let s = 0
  let t = 0
  p.forEach((v, k) => {
    s += (v * (k + 0.5)) / p.length
    t += v
  })
  return s / t
}

function orderEdges(a: number, b: number): [number, number] {
  if (a < b) return [a, b]
  const mid = (a + b) / 2
  const half = 0.5 / BINS
  let lo = Math.max(0, mid - half)
  let hi = Math.min(1, mid + half)
  if (lo >= hi) {
    if (hi >= 1) lo = Math.max(0, hi - 2 * half)
    else hi = lo + 2 * half
  }
  return [lo, hi]
}

export function decode(edges: number[][]): Box {
  const [t0, b0, l0, r0] = edges.map(expected)
  const [top, bottom] = orderEdges(t0, b0)
  const [left, right] = orderEdges(l0, r0)
  return { top, bottom, left, right }
}

/** The four edges of every draw (top, bottom, left, right), one draw per R4 point. */
export function draws(edges: number[][]): number[][] {
  const cdfs = edges.map((p) => {
    const t = p.reduce((a, b) => a + b, 0)
    let c = 0
    return p.map((v) => (c += v / t))
  })
  return POINTS.map((pt) =>
    pt.map((u, d) => {
      const cdf = cdfs[d]
      let i = 0
      while (i < cdf.length && cdf[i] < u) i++
      return (Math.min(i, BINS - 1) + 0.5) / BINS
    }),
  )
}

export function iou(a: Box, b: Box): number {
  const ih = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const iw = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const inter = ih * iw
  const area = Math.max(0, a.bottom - a.top) * Math.max(0, a.right - a.left)
  const rep = Math.max(0, b.bottom - b.top) * Math.max(0, b.right - b.left)
  const union = area + rep - inter
  return union > 0 ? inter / union : 0
}

export function confidence(edges: number[][], box: Box): { share: number; hits: boolean[] } {
  const hits = draws(edges).map(([top, bottom, left, right]) => {
    if (!(top < bottom && left < right)) return false
    return iou({ top, bottom, left, right }, box) >= IOU_HIT
  })
  return { share: hits.filter(Boolean).length / hits.length, hits }
}

export function calibrate(v: number): number {
  const t = CALIBRATION
  if (v <= t[0][0]) return t[0][1]
  for (let i = 0; i < t.length - 1; i++) {
    const [x0, y0] = t[i]
    const [x1, y1] = t[i + 1]
    if (v <= x1) return x1 === x0 ? y0 : y0 + ((y1 - y0) * (v - x0)) / (x1 - x0)
  }
  return t[t.length - 1][1]
}
