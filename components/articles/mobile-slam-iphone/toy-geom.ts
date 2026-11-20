// Small 2D geometry kit shared by this article's two widgets. Everything that
// reaches the DOM goes through lib/dmath, so server and client agree.
import { matan2, mcos, mlog, msin } from "@/lib/dmath"

export type V2 = [number, number]
export type Seg = { a: V2; b: V2 }

/** Seeded PRNG (mulberry32): the same points on every render and every engine. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gauss(r: () => number) {
  const u = Math.max(r(), 1e-12)
  const v = r()
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
}

export function rot(th: number, p: V2): V2 {
  const c = mcos(th)
  const s = msin(th)
  return [c * p[0] - s * p[1], s * p[0] + c * p[1]]
}

export function wrap(a: number) {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x < -Math.PI) x += 2 * Math.PI
  return x
}

/** First hit of the ray o + t d (d unit) on any segment, within maxR. */
export function raycast(o: V2, d: V2, segs: Seg[], maxR: number): number | null {
  let best: number | null = null
  for (const s of segs) {
    const ex = s.b[0] - s.a[0]
    const ey = s.b[1] - s.a[1]
    const den = d[0] * ey - d[1] * ex
    if (Math.abs(den) < 1e-12) continue
    const wx = s.a[0] - o[0]
    const wy = s.a[1] - o[1]
    const t = (wx * ey - wy * ex) / den
    const u = (wx * d[1] - wy * d[0]) / den
    if (t > 1e-6 && u >= 0 && u <= 1 && t <= maxR && (best === null || t < best)) best = t
  }
  return best
}

/** Distance from p to a segment, and the segment's line as n.x + d = 0 (n unit). */
export function segLine(p: V2, s: Seg) {
  const ex = s.b[0] - s.a[0]
  const ey = s.b[1] - s.a[1]
  const L2 = ex * ex + ey * ey
  const u = Math.min(1, Math.max(0, ((p[0] - s.a[0]) * ex + (p[1] - s.a[1]) * ey) / L2))
  const cx = s.a[0] + u * ex
  const cy = s.a[1] + u * ey
  const dist = Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy))
  const L = Math.sqrt(L2)
  const n: V2 = [-ey / L, ex / L]
  const d = -(n[0] * s.a[0] + n[1] * s.a[1])
  return { dist, n, d }
}

export type M3 = number[] // row-major 3x3

export function inv3(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ]
}

export function mul3(x: M3, y: M3): M3 {
  const o: M3 = new Array(9).fill(0)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += x[r * 3 + k] * y[k * 3 + c]
  return o
}

export function mv3(m: M3, v: number[]) {
  return [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2])
}

/** Axes of the 2x2 covariance [[a, b], [b, c]]: radii at k sigma and the angle in degrees. */
export function ellipse(a: number, b: number, c: number, k: number) {
  const m = (a + c) / 2
  const q = Math.sqrt(((a - c) / 2) * ((a - c) / 2) + b * b)
  const l1 = Math.max(m + q, 0)
  const l2 = Math.max(m - q, 0)
  const ang = (0.5 * matan2(2 * b, a - c) * 180) / Math.PI
  return { rx: k * Math.sqrt(l1), ry: k * Math.sqrt(l2), ang }
}

/** A deterministic number for an SVG attribute. */
export const f1 = (v: number) => Math.round(v * 10) / 10
