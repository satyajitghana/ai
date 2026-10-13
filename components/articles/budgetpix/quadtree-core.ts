// Shared, framework-free core of the BudgetPix quadtree widget.
//
// A 256x256 scene is drawn procedurally (no image file), then tokenised the
// way BudgetPix's encoder decides its layout (arXiv 2610.12307, Sec. 3.2 and
// App. C.4):
//   - base patch p = 16 px, so the dense grid is 16x16 = 256 tokens, with
//     token scales p, 2p, 4p (16, 32, 64 px), as for JiT-B/16 at 256^2;
//   - entropy of a 512-bin luma histogram per cell, in bits (0 to 9);
//   - start from the 4p cells: keep a cell as one token if
//     H <= tau_4p + delta, else split it into four 2p cells, each kept if
//     H <= tau_2p + delta, else split into four p tokens;
//   - tau_2p = 6.0 and tau_4p = 4.0 bits (the paper's values, from APT);
//   - "budget mode": delta is bisected so the image gets at most B tokens.
//
// Every transcendental goes through lib/dmath so SSR and the browser agree.

import { mexp, mlog2, msin } from "@/lib/dmath"

export const SIDE = 256
export const P = 16
export const DENSE = (SIDE / P) * (SIDE / P) // 256
export const BINS = 512
export const TAU_2P = 6.0
export const TAU_4P = 4.0

// integer hash -> [0, 1); exact on every engine
function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

// bilinear value noise on an integer lattice of spacing `cell` px
function vnoise(x: number, y: number, cell: number, s: number): number {
  const gx = Math.floor(x / cell)
  const gy = Math.floor(y / cell)
  const fx = x / cell - gx
  const fy = y / cell - gy
  const a = hash(gx, gy, s)
  const b = hash(gx + 1, gy, s)
  const c = hash(gx, gy + 1, s)
  const d = hash(gx + 1, gy + 1, s)
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

export type Scene = { rgb: Float32Array; luma: Float32Array }

let cached: Scene | null = null

// A meadow under a clear sky: a smooth sky (cheap), a soft sun, a kite in
// four flat colours with a ribbon tail, grass with a small pond, and one
// leafy tree (expensive).
export function scene(): Scene {
  if (cached) return cached
  const rgb = new Float32Array(SIDE * SIDE * 3)
  const luma = new Float32Array(SIDE * SIDE)
  const horizon = 150
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      let r: number, g: number, b: number
      if (y < horizon + 6 * msin(x / 37)) {
        // sky: a smooth vertical gradient
        const t = y / horizon
        r = mix(0.52, 0.58, t)
        g = mix(0.7, 0.76, t)
        b = mix(0.93, 0.95, t)
        // one faint cloud
        const cl = mexp(-(((x - 70) / 38) ** 2) - (((y - 112) / 9) ** 2))
        r = mix(r, 0.95, 0.55 * cl)
        g = mix(g, 0.96, 0.55 * cl)
        b = mix(b, 0.98, 0.55 * cl)
        // sun with a soft rim
        const ds = Math.sqrt((x - 206) ** 2 + (y - 42) ** 2)
        const sun = 1 - smooth(13, 19, ds)
        r = mix(r, 1.0, sun)
        g = mix(g, 0.93, sun)
        b = mix(b, 0.7, sun)
      } else {
        // meadow: gradient plus grass texture
        const t = (y - horizon) / (SIDE - horizon)
        const grass = vnoise(x, y * 1.6, 3, 7) - 0.5
        const blades = hash(x, y, 11) - 0.5
        r = mix(0.42, 0.24, t) + 0.05 * grass + 0.035 * blades
        g = mix(0.66, 0.48, t) + 0.07 * grass + 0.045 * blades
        b = mix(0.3, 0.18, t) + 0.03 * grass + 0.02 * blades
        // a still pond: flat and smooth
        const pe = ((x - 62) / 46) ** 2 + ((y - 214) / 18) ** 2
        if (pe < 1) {
          const w = smooth(1, 0.82, pe)
          r = mix(r, mix(0.5, 0.42, (y - 196) / 36), w)
          g = mix(g, mix(0.66, 0.58, (y - 196) / 36), w)
          b = mix(b, mix(0.82, 0.74, (y - 196) / 36), w)
        }
      }
      // tree: trunk and a leafy crown
      if (x > 168 && x < 180 && y > 128 && y < 186) {
        const bark = vnoise(x, y, 2, 19) - 0.5
        r = 0.38 + 0.12 * bark
        g = 0.26 + 0.09 * bark
        b = 0.16 + 0.06 * bark
      }
      const dc = ((x - 174) / 34) ** 2 + ((y - 112) / 30) ** 2
      if (dc < 1 + 0.25 * (vnoise(x, y, 5, 23) - 0.5)) {
        const leaf = vnoise(x, y, 3, 29)
        const fleck = hash(x, y, 31)
        const sh = (y - 82) / 60
        r = 0.12 + 0.22 * leaf + 0.18 * fleck - 0.06 * sh
        g = 0.32 + 0.38 * leaf + 0.24 * fleck - 0.1 * sh
        b = 0.08 + 0.1 * leaf + 0.08 * fleck
      }
      // kite: a diamond in four colours with spars, and a ribbon tail
      const kx = (x - 78) / 22
      const ky = (y - 50) / 30
      if (Math.abs(kx) + Math.abs(ky) < 1) {
        const q = (kx < 0 ? 0 : 1) + (ky < 0 ? 0 : 2)
        const pal = [
          [0.86, 0.2, 0.18],
          [0.98, 0.78, 0.15],
          [0.18, 0.36, 0.8],
          [0.12, 0.62, 0.36],
        ][q]
        const stripe = Math.floor((x + y) / 4) % 2 === 0 ? 0.08 : -0.08
        r = pal[0] + stripe
        g = pal[1] + stripe
        b = pal[2] + stripe
        if (Math.abs(kx) < 0.06 || Math.abs(ky) < 0.05) {
          r = 0.12
          g = 0.1
          b = 0.1
        }
      }
      const tailY = 80 + (x - 78) * 0.9
      if (x > 78 && x < 138 && Math.abs(y - (tailY + 9 * msin((x - 78) / 7))) < 1.4) {
        r = 0.2
        g = 0.18
        b = 0.2
      }
      for (const bx of [94, 110, 126]) {
        const by = 80 + (bx - 78) * 0.9 + 9 * msin((bx - 78) / 7)
        const dx = x - bx
        const dy = y - by
        if (Math.abs(dy) < 4 - Math.abs(dx) * 0.5 && Math.abs(dx) < 7) {
          const c = (bx / 16) % 2 === 0 ? [0.95, 0.3, 0.5] : [0.98, 0.7, 0.2]
          r = c[0]
          g = c[1]
          b = c[2]
        }
      }
      // sensor noise of about one 8-bit level, then 8-bit quantisation
      const n = (hash(x, y, 3) - 0.5) * 0.006
      const i = y * SIDE + x
      r = Math.round(clamp01(r + n) * 255) / 255
      g = Math.round(clamp01(g + n) * 255) / 255
      b = Math.round(clamp01(b + n) * 255) / 255
      rgb[i * 3] = r
      rgb[i * 3 + 1] = g
      rgb[i * 3 + 2] = b
      luma[i] = 0.299 * r + 0.587 * g + 0.114 * b
    }
  }
  cached = { rgb, luma }
  return cached
}

// Shannon entropy (bits) of the 512-bin luma histogram of a square cell
export function cellEntropy(luma: Float32Array, x0: number, y0: number, size: number): number {
  const hist = new Uint16Array(BINS)
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      const k = Math.min(BINS - 1, Math.floor(luma[y * SIDE + x] * BINS))
      hist[k]++
    }
  }
  const n = size * size
  let h = 0
  for (let k = 0; k < BINS; k++) {
    if (hist[k] === 0) continue
    const q = hist[k] / n
    h -= q * mlog2(q)
  }
  return Math.round(h * 1e6) / 1e6
}

export type Cell = { x: number; y: number; s: number }
export type Entropies = { h4: number[]; h2: number[] } // 4x4 coarse cells, 8x8 mid cells

let ent: Entropies | null = null
export function entropies(): Entropies {
  if (ent) return ent
  const { luma } = scene()
  const h4: number[] = []
  const h2: number[] = []
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) h4.push(cellEntropy(luma, i * 64, j * 64, 64))
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) h2.push(cellEntropy(luma, i * 32, j * 32, 32))
  ent = { h4, h2 }
  return ent
}

// the quadtree at offset delta
export function layout(delta: number): Cell[] {
  const { h4, h2 } = entropies()
  const out: Cell[] = []
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      if (h4[j * 4 + i] <= TAU_4P + delta) {
        out.push({ x: i * 64, y: j * 64, s: 64 })
        continue
      }
      for (let dj = 0; dj < 2; dj++) {
        for (let di = 0; di < 2; di++) {
          const ci = i * 2 + di
          const cj = j * 2 + dj
          if (h2[cj * 8 + ci] <= TAU_2P + delta) {
            out.push({ x: ci * 32, y: cj * 32, s: 32 })
          } else {
            for (let q = 0; q < 4; q++) out.push({ x: ci * 32 + (q % 2) * 16, y: cj * 32 + Math.floor(q / 2) * 16, s: 16 })
          }
        }
      }
    }
  }
  return out
}

// budget mode: the smallest delta whose layout fits in `budget` tokens
export function fitBudget(budget: number): { delta: number; cells: Cell[] } {
  let lo = -10
  let hi = 10
  if (layout(lo).length <= budget) return { delta: lo, cells: layout(lo) }
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2
    if (layout(mid).length <= budget) hi = mid
    else lo = mid
  }
  return { delta: Math.round(hi * 1000) / 1000, cells: layout(hi) }
}

// FLOPs of one transformer block relative to the dense grid, for a token
// fraction f: projections + MLP (ratio 4) cost 24*N*D^2, attention scores
// and mixing cost 4*N^2*D, so the ratio is (6*D*f + N*f^2) / (6*D + N).
export function blockFlopRatio(f: number, n: number, d: number): number {
  return (6 * d * f + n * f * f) / (6 * d + n)
}
export function attnShare(n: number, d: number): number {
  return n / (6 * d + n)
}
