import { mcos, mexp, mlog, msin, mtanh } from "@/lib/dmath"

// Seeded PRNG (mulberry32): the same numbers on the server and the client,
// so nothing the widgets draw can differ between SSR and hydration.
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gauss(r: () => number) {
  const u = Math.max(r(), 1e-9)
  const v = r()
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
}

// Poisson sample by inversion; fine for the small rates used here.
export function poisson(r: () => number, lam: number) {
  const L = mexp(-lam)
  let k = 0
  let p = r()
  while (p > L && k < 60) {
    k += 1
    p *= r()
  }
  return k
}

export const tanh = mtanh
export const sin = msin

export function pearson(x: number[], y: number[]) {
  const n = x.length
  let mx = 0
  let my = 0
  for (let i = 0; i < n; i++) {
    mx += x[i]
    my += y[i]
  }
  mx /= n
  my /= n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx
    const b = y[i] - my
    sxy += a * b
    sxx += a * a
    syy += b * b
  }
  if (sxx === 0 || syy === 0) return 0
  return sxy / Math.sqrt(sxx * syy)
}
