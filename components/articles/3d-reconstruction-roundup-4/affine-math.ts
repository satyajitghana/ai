import { mcos, mexp, mlog } from "@/lib/dmath"

// A one-row toy of AffineGS's argument. Three surfaces (a wall, an object, the
// floor) have true metric depth D. A monocular network returns relative depth
// 1/d that is affine in D within each surface but with a different scale and
// shift per surface: the "piecewise-linear distortion" the paper measures.
// We then turn d back into metric depth three ways and measure the error
// against the truth:
//   global   one scale and shift for the whole row (what DN-Splatter and DRGS do)
//   regions  one scale and shift per surface, boundaries known (the paper's K = 3 analysis)
//   affinegs the paper's estimator: scale from the ratio of gradients of d and of the
//            current render, shift from the affine model, both smoothed by a guided
//            filter guided by d, then one global refit to the render.
// Everything is deterministic (seeded noise) so the server and browser agree.

export const N = 360
export const REGION_EDGES = [0.35, 0.65]

export type AffineResult = {
  x: number[]
  truth: number[]
  render: number[]
  global: number[]
  regions: number[]
  affinegs: number[]
  region: number[]
}

function regionOf(x: number): number {
  return x < REGION_EDGES[0] ? 0 : x < REGION_EDGES[1] ? 1 : 2
}

function trueDepth(x: number): number {
  if (x < REGION_EDGES[0]) return 3.2 - 0.8 * x
  if (x < REGION_EDGES[1]) return 1.4 + 4.8 * (x - 0.5) * (x - 0.5)
  return 1.6 + 2.2 * (x - 0.65)
}

// Small LCG + Box-Muller on a fixed seed: same numbers on every engine.
function noiseSeries(n: number, seed: number): number[] {
  let s = seed >>> 0
  const u = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s + 0.5) / 4294967296
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(-2 * mlog(u()))
    const c = mcos(2 * Math.PI * u())
    out.push(Number((r * c).toPrecision(12)))
  }
  // light smoothing: render errors are blotchy, not white
  return out.map((_, i) => {
    let acc = 0
    let c = 0
    for (let k = -3; k <= 3; k++) {
      const j = i + k
      if (j >= 0 && j < n) {
        acc += out[j]
        c++
      }
    }
    return (acc / c) * 1.6
  })
}

const NOISE = noiseSeries(N, 7)

function lstsq(xs: number[], ys: number[]): [number, number] {
  const n = xs.length
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
  }
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  return [a, (sy - a * sx) / n]
}

function box(v: number[], r: number): number[] {
  const n = v.length
  const pre = [0]
  for (let i = 0; i < n; i++) pre.push(pre[i] + v[i])
  return v.map((_, i) => {
    const lo = Math.max(0, i - r)
    const hi = Math.min(n - 1, i + r)
    return (pre[hi + 1] - pre[lo]) / (hi - lo + 1)
  })
}

// He et al.'s guided filter in 1D.
function guided(I: number[], p: number[], r: number, eps: number): number[] {
  const mI = box(I, r)
  const mp = box(p, r)
  const mIp = box(
    I.map((v, i) => v * p[i]),
    r,
  )
  const mII = box(
    I.map((v) => v * v),
    r,
  )
  const a = I.map((_, i) => (mIp[i] - mI[i] * mp[i]) / (mII[i] - mI[i] * mI[i] + eps))
  const b = I.map((_, i) => mp[i] - a[i] * mI[i])
  const ma = box(a, r)
  const mb = box(b, r)
  return I.map((v, i) => ma[i] * v + mb[i])
}

function percentile(v: number[], q: number): number {
  const s = [...v].sort((p, q2) => p - q2)
  const idx = (s.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

function grad(v: number[]): number[] {
  const n = v.length
  return v.map((_, i) => {
    if (i === 0) return v[1] - v[0]
    if (i === n - 1) return v[n - 1] - v[n - 2]
    return (v[i + 1] - v[i - 1]) / 2
  })
}

export function simulate(disagree: number, renderNoise: number, radius = 15): AffineResult {
  const x = Array.from({ length: N }, (_, i) => i / (N - 1))
  const region = x.map(regionOf)
  const truth = x.map(trueDepth)
  const A = [1, 1 - 0.45 * disagree, 1 + 0.6 * disagree]
  const B = [0, 0.9 * disagree, -1.1 * disagree]
  const rel = truth.map((D, i) => A[region[i]] * D + B[region[i]]) // 1/d
  const d = rel.map((r) => 1 / r)

  // The current 3DGS render: right on average, with a floater dent on the wall,
  // a bump on the floor, and blotchy noise.
  const render = truth.map(
    (D, i) =>
      D -
      0.3 * mexp(-((x[i] - 0.18) * (x[i] - 0.18)) / 0.0016) +
      0.2 * mexp(-((x[i] - 0.82) * (x[i] - 0.82)) / 0.0012) +
      renderNoise * NOISE[i],
  )

  // global: one scale and shift for the whole row, fitted to the true depth
  const [ga, gb] = lstsq(truth, rel)
  const global = rel.map((r) => (r - gb) / ga)

  // regions: one scale and shift per surface, fitted to the true depth
  const regions = new Array<number>(N)
  for (let k = 0; k < 3; k++) {
    const idx = region.map((g, i) => (g === k ? i : -1)).filter((i) => i >= 0)
    const [a, b] = lstsq(
      idx.map((i) => truth[i]),
      idx.map((i) => rel[i]),
    )
    for (const i of idx) regions[i] = (rel[i] - b) / a
  }

  // affinegs: gradient-ratio scale, affine shift, guided filter, global refit
  const gd = grad(d)
  const gD = grad(render)
  let alpha = gd.map((g, i) => Math.abs(g) / (d[i] * d[i] * Math.abs(gD[i]) + 1e-6))
  const lo = percentile(alpha, 0.05)
  const hi = percentile(alpha, 0.95)
  alpha = alpha.map((a) => Math.min(hi, Math.max(lo, a)))
  const beta = alpha.map((a, i) => 1 / d[i] - a * render[i])
  const dmin = Math.min(...d)
  const dmax = Math.max(...d)
  const guide = d.map((v) => (v - dmin) / (dmax - dmin))
  const r = radius
  const eps = 1e-3
  const aS = guided(guide, alpha, r, eps).map((a) => Math.min(hi, Math.max(lo, a)))
  const bS = guided(guide, beta, r, eps)
  const corrected = d.map((v, i) => (1 - bS[i] * v) / (aS[i] * v))
  const [ra, rb] = lstsq(corrected, render)
  const affinegs = corrected.map((c) => ra * c + rb)

  return { x, truth, render, global, regions, affinegs, region }
}

export function errors(target: number[], truth: number[], tol = 0.05): { mae: number; inlier: number } {
  let s = 0
  let ok = 0
  for (let i = 0; i < truth.length; i++) {
    const e = Math.abs(target[i] - truth[i])
    s += e
    if (e <= tol) ok++
  }
  return { mae: s / truth.length, inlier: (100 * ok) / truth.length }
}
