import { mcos, mlog } from "@/lib/dmath"

// The Wong-Zakai picture behind iSSFM, computed from scratch on one seeded
// Brownian path. Nothing here is learned.
//
// - A Brownian path W on [0, 1] is drawn at M fine steps.
// - Its shifted Legendre coefficients are I^(n) = sum_k P~_n(tau_k) dW_k, a
//   Riemann sum for the Ito integral of P~_n against dW, so I^(0) = W(1) - W(0)
//   and I^(n) ~ N(0, 1 / (2n + 1)).
// - The degree-N smooth driver is Wdot^(N)(tau) = sum_{n<N} (2n + 1) I^(n) P~_n(tau),
//   and W^(N) is its integral from 0 (the polynomial path the network sees).
// - The SDE dX = b(X) dt + SIG dW is integrated by Euler-Maruyama on the fine
//   grid (the reference). The random ODE dX/dt = b(X) + SIG Wdot^(N)(t) is
//   integrated by Heun on the same grid. Wong-Zakai says the second converges
//   to the first, pathwise, as N grows.

export const M = 2048
export const SIG = 1.0
export const X0 = 0.3
export const NS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]

export const drift = (x: number) => 4 * (x - x * x * x)

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Shifted Legendre polynomials P~_0..P~_{K-1} at u in [0, 1], by Bonnet's recurrence.
function legendre(u: number, K: number, out: Float64Array) {
  const x = 2 * u - 1
  out[0] = 1
  if (K > 1) out[1] = x
  for (let n = 1; n + 1 < K; n++) out[n + 1] = ((2 * n + 1) * x * out[n] - n * out[n - 1]) / (n + 1)
}

export type Path = {
  W: Float64Array // M + 1 points
  dW: Float64Array // M increments
  I: Float64Array // first KMAX shifted Legendre coefficients
  X: Float64Array // SDE reference, M + 1 points
}

export const KMAX = 32

export function makePath(seed: number): Path {
  const rnd = mulberry32(seed)
  const dt = 1 / M
  const sd = Math.sqrt(dt)
  const dW = new Float64Array(M)
  for (let i = 0; i < M; i += 2) {
    const u1 = Math.max(rnd(), 1e-12)
    const u2 = rnd()
    const r = Math.sqrt(-2 * mlog(u1))
    dW[i] = r * mcos(2 * Math.PI * u2) * sd
    if (i + 1 < M) dW[i + 1] = r * mcos(2 * Math.PI * u2 - Math.PI / 2) * sd
  }
  const W = new Float64Array(M + 1)
  for (let i = 0; i < M; i++) W[i + 1] = W[i] + dW[i]
  const I = new Float64Array(KMAX)
  const P = new Float64Array(KMAX)
  for (let i = 0; i < M; i++) {
    legendre((i + 0.5) * dt, KMAX, P)
    for (let n = 0; n < KMAX; n++) I[n] += P[n] * dW[i]
  }
  const X = new Float64Array(M + 1)
  X[0] = X0
  for (let i = 0; i < M; i++) X[i + 1] = X[i] + drift(X[i]) * dt + SIG * dW[i]
  return { W, dW, I, X }
}

export type Smooth = {
  Wn: Float64Array // polynomial path W^(N), M + 1 points
  Wdot: Float64Array // its derivative, M + 1 points
  Xn: Float64Array // random-ODE solution, M + 1 points
  supW: number // sup |W^(N) - W|
  supX: number // sup |X^(N) - X|
  endX: number // |X^(N)(1) - X(1)|
}

export function smooth(p: Path, N: number): Smooth {
  const dt = 1 / M
  const P = new Float64Array(KMAX)
  const Wdot = new Float64Array(M + 1)
  for (let i = 0; i <= M; i++) {
    legendre(i * dt, N, P)
    let v = 0
    for (let n = 0; n < N; n++) v += (2 * n + 1) * p.I[n] * P[n]
    Wdot[i] = v
  }
  const Wn = new Float64Array(M + 1)
  for (let i = 0; i < M; i++) Wn[i + 1] = Wn[i] + 0.5 * (Wdot[i] + Wdot[i + 1]) * dt
  const Xn = new Float64Array(M + 1)
  Xn[0] = X0
  for (let i = 0; i < M; i++) {
    const k1 = drift(Xn[i]) + SIG * Wdot[i]
    const xp = Xn[i] + k1 * dt
    const k2 = drift(xp) + SIG * Wdot[i + 1]
    Xn[i + 1] = Xn[i] + 0.5 * (k1 + k2) * dt
  }
  let supW = 0
  let supX = 0
  for (let i = 0; i <= M; i++) {
    supW = Math.max(supW, Math.abs(Wn[i] - p.W[i]))
    supX = Math.max(supX, Math.abs(Xn[i] - p.X[i]))
  }
  return { Wn, Wdot, Xn, supW, supX, endX: Math.abs(Xn[M] - p.X[M]) }
}

// RMS of the rough path's finite-difference slope dW/dt at the fine step: about
// 1 / sqrt(dt), and it grows without bound as dt -> 0. This is the "derivative"
// a naive Eulerian loss would have to differentiate through.
export function roughSlopeRms(p: Path): number {
  let s = 0
  for (let i = 0; i < M; i++) s += (p.dW[i] * M) ** 2
  return Math.sqrt(s / M)
}

export function rms(a: Float64Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * a[i]
  return Math.sqrt(s / a.length)
}
