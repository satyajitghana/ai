import { mcos, mtanh } from "@/lib/dmath"

// The μLattice bump kernel, transcribed from src/mulattice/kernel.py:
//   b(t)     = cos²(πt/3) for |t| < 3/2, else 0
//   φ_z(x)   = b(x − z) / sqrt(Σ_j b(x − j)²)        (1D, three candidate cells)
//   φ_(zx,zy)(x, y) = φ_zx(x) · φ_zy(y)              (2D product, 3 × 3 cells)
// so Σ φ² over the nine cells is exactly 1.

export const SUPPORT = 1.5

export function bump(t: number): number {
  if (Math.abs(t) >= SUPPORT) return 0
  const c = mcos((Math.PI * t) / 3)
  return c * c
}

export type Phi1 = { z: number[]; w: number[] }

export function phi1(x: number): Phi1 {
  const lo = Math.ceil(x - SUPPORT)
  const z = [lo, lo + 1, lo + 2]
  const b = z.map((zi) => bump(x - zi))
  const norm = Math.sqrt(b.reduce((s, v) => s + v * v, 0)) || 1
  return { z, w: b.map((v) => v / norm) }
}

export type Cell = { x: number; y: number; w: number }

export function phi2(x: number, y: number): Cell[] {
  const px = phi1(x)
  const py = phi1(y)
  const out: Cell[] = []
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out.push({ x: px.z[i], y: py.z[j], w: px.w[i] * py.w[j] })
    }
  }
  return out
}

// 1D kernel D_1(q, k) = Σ_z φ_z(q) φ_z(k); 2D is the product of the two axes.
function d1(q: number, k: number): number {
  const a = phi1(q)
  const b = phi1(k)
  let s = 0
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (a.z[i] === b.z[j]) s += a.w[i] * b.w[j]
    }
  }
  return s
}

export function kernelD(qx: number, qy: number, kx: number, ky: number): number {
  return d1(qx, kx) * d1(qy, ky)
}

// Deterministic key addresses: scale · tanh(g) with g from a seeded PRNG,
// the same squashing the model applies to W_a·h. Identical on server and client.
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

export function keyAddresses(n: number, scale: number, seed = 7): [number, number][] {
  const r = mulberry32(seed)
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    // sum of three uniforms, centred: a cheap bell shape with spread ~1
    const gx = (r() + r() + r() - 1.5) * 1.6
    const gy = (r() + r() + r() - 1.5) * 1.6
    out.push([scale * mtanh(gx), scale * mtanh(gy)])
  }
  return out
}
