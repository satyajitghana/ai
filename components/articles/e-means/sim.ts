// Deterministic 2-D k-means toys for the e-means article: Lloyd's algorithm and
// e-means (mini-batch EMA updates, cosine-annealed step, dead-cluster revival,
// last-epoch-mean finalization), written from Algorithm 1 of arXiv 2611.09501 and
// the FAISS reference (contrib/e_means/base.py, e_means.py). Pure functions, a
// seeded PRNG, and only exact arithmetic plus lib/dmath wrappers, so the server
// and the browser compute byte-identical traces (no hydration mismatch).

import { mcos, mlog, mpow, msin } from "@/lib/dmath"

export type Pt = [number, number]

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A Gaussian mixture in the unit square: G blobs on a jittered grid, Zipf-ish
// sizes (blob g gets weight 1/(g+1)), so some blobs are dense and some sparse.
export function makeData(seed: number, n: number, G: number): Pt[] {
  const rnd = mulberry32(seed * 7919 + 17)
  const side = Math.ceil(Math.sqrt(G))
  const centres: Pt[] = []
  const spread: number[] = []
  for (let g = 0; g < G; g++) {
    const gx = (g % side) + 0.5
    const gy = Math.floor(g / side) + 0.5
    centres.push([
      0.08 + (0.84 * (gx + (rnd() - 0.5) * 0.5)) / side,
      0.08 + (0.84 * (gy + (rnd() - 0.5) * 0.5)) / side,
    ])
    spread.push((0.035 + 0.04 * rnd()) / (side / 3))
  }
  const w = centres.map((_, g) => 1 / (g + 1))
  const order = centres.map((_, g) => g)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const wsum = w.reduce((a, b) => a + b, 0)
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    let r = rnd() * wsum
    let g = 0
    while (g < G - 1 && r >= w[g]) {
      r -= w[g]
      g++
    }
    const c = centres[order[g]]
    const s = spread[order[g]]
    // Box-Muller
    const u1 = Math.max(rnd(), 1e-12)
    const u2 = rnd()
    const rad = Math.sqrt(-2 * mlog(u1))
    const x = c[0] + s * rad * mcos(2 * Math.PI * u2)
    const y = c[1] + s * rad * msin(2 * Math.PI * u2)
    pts.push([Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))])
  }
  return pts
}

function nearest(p: Pt, C: Pt[]): number {
  let best = 0
  let bd = Infinity
  for (let j = 0; j < C.length; j++) {
    const dx = p[0] - C[j][0]
    const dy = p[1] - C[j][1]
    const d = dx * dx + dy * dy
    if (d < bd) {
      bd = d
      best = j
    }
  }
  return best
}

export function mse(X: Pt[], C: Pt[]): number {
  let s = 0
  for (const p of X) {
    const c = C[nearest(p, C)]
    const dx = p[0] - c[0]
    const dy = p[1] - c[1]
    s += dx * dx + dy * dy
  }
  return s / X.length
}

export function labels(X: Pt[], C: Pt[]): number[] {
  return X.map((p) => nearest(p, C))
}

// Random initialization: k distinct data points (Algorithm 1, line 2).
export function initCentroids(X: Pt[], k: number, seed: number): Pt[] {
  const rnd = mulberry32(seed * 104729 + 3)
  const idx = X.map((_, i) => i)
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (idx.length - i))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, k).map((i) => [X[i][0], X[i][1]] as Pt)
}

export type Frame = { epoch: number; C: Pt[]; mse: number }

// Lloyd: assign every point, move every centroid to the mean of its points.
// An empty cluster keeps its position (Faiss would split it; with random
// initialization from the data that is rare, and we report it as dead).
export function runLloyd(X: Pt[], C0: Pt[], iters: number): Frame[] {
  let C = C0.map((c) => [c[0], c[1]] as Pt)
  const frames: Frame[] = [{ epoch: 0, C, mse: mse(X, C) }]
  for (let it = 1; it <= iters; it++) {
    const sx = new Array(C.length).fill(0)
    const sy = new Array(C.length).fill(0)
    const cnt = new Array(C.length).fill(0)
    for (const p of X) {
      const j = nearest(p, C)
      sx[j] += p[0]
      sy[j] += p[1]
      cnt[j]++
    }
    C = C.map((c, j) => (cnt[j] > 0 ? ([sx[j] / cnt[j], sy[j] / cnt[j]] as Pt) : c))
    frames.push({ epoch: it, C, mse: mse(X, C) })
  }
  return frames
}

// The shipped FAISS laws (contrib/e_means/base.py): batch law, then the step law.
export const BATCH_LAWS = {
  throughput: [0.035134, 0.134749, 0.876473, 0.813344],
  quality: [0.00439175, 0.134749, 0.876473, 0.813344],
} as const
export const ALPHA_LAW = [0.8244, -0.4617, 0.9003, -0.4498, -0.1057] as const

export function roundPow2(v: number): number {
  if (v <= 1) return 1
  let lo = 1
  while (lo * 2 <= v) lo *= 2
  const hi = 2 * lo
  return v / lo < hi / v ? lo : hi
}

export function recipe(n: number, k: number, T: number, law: "throughput" | "quality") {
  const [c, bk, bn, bt] = BATCH_LAWS[law]
  const raw = c * mpow(k, bk) * mpow(n, bn) * mpow(T, bt)
  let B = roundPow2(raw)
  B = law === "throughput" ? Math.min(B, roundPow2(n / 2)) : Math.min(B, Math.floor(n / 2))
  B = Math.max(1, Math.min(B, n))
  const [ac, ak, aB, an, aT] = ALPHA_LAW
  const alphaRaw = ac * mpow(k, ak) * mpow(B, aB) * mpow(n, an) * mpow(T, aT)
  const alpha0 = Math.min(Math.max(alphaRaw, 1e-4), 1)
  const steps = Math.ceil(n / B) * T
  return { rawB: raw, B, alphaRaw, alpha0, steps }
}

// Equation 5: cosine from alpha0 down to 0.1 * alpha0.
export function scheduledAlpha(alpha0: number, t: number, M: number): number {
  const f = Math.min(t, M) / Math.max(1, M)
  return alpha0 * (0.1 + 0.9 * 0.5 * (1 + mcos(Math.PI * f)))
}

export type EmeansOpts = {
  epochs: number
  B: number
  alpha0: number
  revival: boolean
  seed: number
  framesPerEpoch: number
  // false holds the step at alpha0 (no cosine); with B = n and alpha0 = 1 that is Lloyd.
  cosine?: boolean
}

export type EmeansResult = {
  frames: Frame[]
  final: Pt[]
  finalMse: number
  revivals: number
}

export function runEmeans(X: Pt[], C0: Pt[], o: EmeansOpts): EmeansResult {
  const n = X.length
  const k = C0.length
  const rnd = mulberry32(o.seed * 15485863 + 11)
  // N_j starts tiny so S_j / N_j returns the initial centroid exactly.
  const N = new Array(k).fill(2 ** -16)
  const C = C0.map((c) => [c[0], c[1]] as Pt)
  const perEpoch = Math.ceil(n / o.B)
  const M = perEpoch * o.epochs
  const frames: Frame[] = [{ epoch: 0, C: C.map((c) => [c[0], c[1]] as Pt), mse: mse(X, C) }]
  const every = Math.max(1, Math.round(perEpoch / o.framesPerEpoch))
  let t = 0
  let revivals = 0
  // last-epoch statistics for the closing mean
  let ex = new Array(k).fill(0)
  let ey = new Array(k).fill(0)
  let ec = new Array(k).fill(0)
  const order = X.map((_, i) => i)
  for (let e = 0; e < o.epochs; e++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    ex = new Array(k).fill(0)
    ey = new Array(k).fill(0)
    ec = new Array(k).fill(0)
    for (let b = 0; b < perEpoch; b++) {
      const lo = b * o.B
      const hi = Math.min(n, lo + o.B)
      const sx = new Array(k).fill(0)
      const sy = new Array(k).fill(0)
      const cnt = new Array(k).fill(0)
      for (let q = lo; q < hi; q++) {
        const p = X[order[q]]
        const j = nearest(p, C)
        sx[j] += p[0]
        sy[j] += p[1]
        cnt[j]++
      }
      const alpha = o.cosine === false ? o.alpha0 : scheduledAlpha(o.alpha0, t, M)
      const gamma = 1 - alpha
      for (let j = 0; j < k; j++) {
        // N_j <- gamma N_j + alpha n_j ; c_j <- c_j + (alpha n_j / N_new)(mean_j - c_j)
        const Nn = gamma * N[j] + alpha * cnt[j]
        if (cnt[j] > 0) {
          const w = (alpha * cnt[j]) / Nn
          C[j] = [C[j][0] + w * (sx[j] / cnt[j] - C[j][0]), C[j][1] + w * (sy[j] / cnt[j] - C[j][1])]
          ex[j] += sx[j]
          ey[j] += sy[j]
          ec[j] += cnt[j]
        }
        N[j] = Nn
      }
      t++
      if (o.revival && t % 5 === 0) revivals += revive(N, C, rnd)
      if (t % every === 0 || b === perEpoch - 1) {
        frames.push({ epoch: e + (b + 1) / perEpoch, C: C.map((c) => [c[0], c[1]] as Pt), mse: mse(X, C) })
      }
    }
  }
  // Last-epoch-mean finalization (Algorithm 1, line 12).
  const final = C.map((c, j) => (ec[j] > 0 ? ([ex[j] / ec[j], ey[j] / ec[j]] as Pt) : c))
  return { frames, final, finalMse: mse(X, final), revivals }
}

// Clusters whose mass fell below 0.1 x mean are rebuilt by splitting a donor
// drawn in proportion to its mass; donor and child each get half the mass.
function revive(N: number[], C: Pt[], rnd: () => number): number {
  const k = N.length
  const mean = N.reduce((a, b) => a + b, 0) / k
  const thr = 0.1 * mean
  const dead: number[] = []
  const alive: number[] = []
  for (let j = 0; j < k; j++) (N[j] < thr ? dead : alive).push(j)
  let done = 0
  for (const d of dead) {
    if (alive.length === 0) break
    const tot = alive.reduce((a, j) => a + N[j], 0)
    let r = rnd() * tot
    let pick = 0
    while (pick < alive.length - 1 && r >= N[alive[pick]]) {
      r -= N[alive[pick]]
      pick++
    }
    const donor = alive[pick]
    alive.splice(pick, 1) // without replacement
    const eps = 1e-3
    const c = C[donor]
    C[d] = [c[0] * (1 + eps), c[1] * (1 - eps)]
    C[donor] = [c[0] * (1 - eps), c[1] * (1 + eps)]
    N[donor] /= 2
    N[d] = N[donor]
    done++
  }
  return done
}
