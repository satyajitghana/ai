// A path tracer in flatland: a two-dimensional room, a one-dimensional image. Small enough to run in a page
// and to draw every ray, built to mirror the two estimators ThreeRT's kernel has (renderer/shaders/pathtrace.wgsl):
//
//  - offline: a full path per sample. At each vertex the light is sampled directly (next-event estimation: a point on
//    the lamp, a shadow ray), then the path bounces on a cosine-distributed direction, up to `bounces` times.
//  - live: the camera hit gets its direct light as above, the path bounces once, and ends there in a radiance cache:
//    a world-space grid of cells holding the light that leaves surfaces in them (pathtrace.wgsl `cache_end`). A cell
//    is trusted after CACHE_WARM samples; until then, and on one sample in TRAIN_EVERY, the pixel traces a fresh
//    path from that point and adds it to the cell (`cache_train`).
//
// Flatland's diffuse BRDF is albedo / 2 (the integral of cos over a half circle is 2); cosine sampling has pdf cos / 2,
// so the throughput of a bounce is multiplied by the albedo. A lamp of length A sampled uniformly gives
// f · Le · cos(x) · cos(y) / r · A.
//
// Every random number comes from a seeded generator, and every trig call goes through lib/dmath.

import { masin, mcos, msin } from "@/lib/dmath"

export type RGB = [number, number, number]
export type V2 = [number, number]

export type Seg = { a: V2; b: V2; n: V2; albedo: RGB; emit?: RGB }

const WHITE: RGB = [0.73, 0.73, 0.73]
const RED: RGB = [0.63, 0.065, 0.05]
const GREEN: RGB = [0.14, 0.45, 0.091]
export const LAMP_LE: RGB = [10, 8.6, 6.2]
export const LAMP: [number, number] = [0.42, 0.58] // x span on the ceiling

function seg(a: V2, b: V2, n: V2, albedo: RGB, emit?: RGB): Seg {
  return { a, b, n, albedo, emit }
}

// The room: y up, 0..1. A lamp in the ceiling, a red wall, a green wall, and a block on the floor that casts a shadow.
export const SEGS: Seg[] = [
  seg([0, 0], [1, 0], [0, 1], WHITE), // floor
  seg([0, 1], [LAMP[0], 1], [0, -1], WHITE), // ceiling, left of the lamp
  seg([LAMP[1], 1], [1, 1], [0, -1], WHITE), // ceiling, right
  seg([LAMP[0], 0.998], [LAMP[1], 0.998], [0, -1], [0, 0, 0], LAMP_LE), // lamp
  seg([0, 0], [0, 1], [1, 0], RED), // left wall
  seg([1, 0], [1, 1], [-1, 0], GREEN), // right wall
  seg([0.56, 0], [0.56, 0.34], [-1, 0], WHITE), // block, left face
  seg([0.56, 0.34], [0.78, 0.34], [0, 1], WHITE), // block, top
  seg([0.78, 0.34], [0.78, 0], [1, 0], WHITE), // block, right face
]
const LAMP_I = 3

export const CAM: V2 = [0.07, 0.62]
export const PIXELS = 64
const FOV = 1.6 // radians across the image
const CAM_DIR = -0.42 // radians below horizontal, the centre of view

export function pixelDir(i: number, jitter: number): V2 {
  const a = CAM_DIR + FOV / 2 - ((i + jitter) / PIXELS) * FOV
  return [mcos(a), msin(a)]
}

// mulberry32
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Hit = { t: number; p: V2; s: number }

export function intersect(o: V2, d: V2, tmax = 1e9): Hit | null {
  let best: Hit | null = null
  for (let s = 0; s < SEGS.length; s++) {
    const g = SEGS[s]
    // only surfaces facing the ray
    if (g.n[0] * d[0] + g.n[1] * d[1] >= 0) continue
    const ex = g.b[0] - g.a[0], ey = g.b[1] - g.a[1]
    const den = d[0] * ey - d[1] * ex
    if (Math.abs(den) < 1e-12) continue
    const wx = g.a[0] - o[0], wy = g.a[1] - o[1]
    const t = (wx * ey - wy * ex) / den
    const u = (wx * d[1] - wy * d[0]) / den
    if (t > 1e-5 && t < tmax && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, p: [o[0] + d[0] * t, o[1] + d[1] * t], s }
  }
  return best
}

// One recorded ray, for drawing: kind "path" (a bounce), "shadow" (to the lamp, lit or blocked), "cache" (where a
// live path stopped and read a cell).
export type Ray = { from: V2; to: V2; kind: "path" | "shadow" | "blocked"; depth: number }

function cosSample(n: V2, u: number): V2 {
  // angle from the normal with pdf cos(θ) / 2 on (-π/2, π/2)
  const th = masin(2 * u - 1)
  const c = mcos(th), s = msin(th)
  return [n[0] * c - n[1] * s, n[0] * s + n[1] * c]
}

function direct(p: V2, s: number, r: () => number, rays: Ray[] | null, depth: number): RGB {
  const g = SEGS[s]
  if (g.emit) return [0, 0, 0]
  const L = SEGS[LAMP_I]
  const lx = LAMP[0] + (LAMP[1] - LAMP[0]) * r()
  const y: V2 = [lx, L.a[1]]
  const dx = y[0] - p[0], dy = y[1] - p[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  const d: V2 = [dx / dist, dy / dist]
  const cx = g.n[0] * d[0] + g.n[1] * d[1]
  const cy = -(L.n[0] * d[0] + L.n[1] * d[1])
  if (cx <= 0 || cy <= 0) return [0, 0, 0]
  const h = intersect([p[0] + g.n[0] * 1e-4, p[1] + g.n[1] * 1e-4], d, dist - 1e-3)
  const blocked = h !== null && h.s !== LAMP_I
  if (rays) rays.push({ from: p, to: blocked && h ? h.p : y, kind: blocked ? "blocked" : "shadow", depth })
  if (blocked) return [0, 0, 0]
  const k = (cx * cy / dist) * (LAMP[1] - LAMP[0]) * 0.5
  return [g.albedo[0] * L.emit![0] * k, g.albedo[1] * L.emit![1] * k, g.albedo[2] * L.emit![2] * k]
}

// Radiance leaving surface point p (segment s) toward the previous vertex, by a full path of up to `left` bounces.
function outgoing(p: V2, s: number, left: number, r: () => number, rays: Ray[] | null, depth: number): RGB {
  const g = SEGS[s]
  const out = direct(p, s, r, rays, depth)
  if (left <= 0) return out
  const d = cosSample(g.n, r())
  const o: V2 = [p[0] + g.n[0] * 1e-4, p[1] + g.n[1] * 1e-4]
  const h = intersect(o, d)
  if (!h) return out
  if (rays) rays.push({ from: p, to: h.p, kind: "path", depth: depth + 1 })
  if (SEGS[h.s].emit) return out // the lamp's light was already sampled directly at p
  const li = outgoing(h.p, h.s, left - 1, r, rays, depth + 1)
  return [out[0] + g.albedo[0] * li[0], out[1] + g.albedo[1] * li[1], out[2] + g.albedo[2] * li[2]]
}

// ---- the radiance cache: a grid over the room, one cell per (cell, facing) ----
export const CELLS = 10
export const CACHE_WARM = 4
export const TRAIN_EVERY = 8

export type Cache = { sum: Float64Array; n: Uint32Array }
export const newCache = (): Cache => ({ sum: new Float64Array(CELLS * CELLS * 4 * 3), n: new Uint32Array(CELLS * CELLS * 4) })

export function cellOf(p: V2, s: number): number {
  const n = SEGS[s].n
  // a point is keyed a little in front of its surface, as the kernel's CACHE_FACE does
  const cx = Math.min(CELLS - 1, Math.max(0, Math.floor((p[0] + n[0] * 0.01) * CELLS)))
  const cy = Math.min(CELLS - 1, Math.max(0, Math.floor((p[1] + n[1] * 0.01) * CELLS)))
  const face = n[1] > 0.5 ? 0 : n[1] < -0.5 ? 1 : n[0] > 0 ? 2 : 3
  return (cy * CELLS + cx) * 4 + face
}

export type Sample = { rgb: RGB; rays: Ray[]; cacheCell: number | null; cacheP: V2 | null }

// One sample of pixel i. `bounces` is the offline path length; `live` ends the path in the cache after one bounce.
export function sample(i: number, r: () => number, bounces: number, live: boolean, cache: Cache, record: boolean): Sample {
  const rays: Ray[] | null = record ? [] : null
  const d = pixelDir(i, r())
  const h = intersect(CAM, d)
  const res: Sample = { rgb: [0, 0, 0], rays: rays ?? [], cacheCell: null, cacheP: null }
  if (!h) return res
  if (rays) rays.push({ from: CAM, to: h.p, kind: "path", depth: 0 })
  const g = SEGS[h.s]
  if (g.emit) {
    res.rgb = [g.emit[0], g.emit[1], g.emit[2]]
    return res
  }
  if (!live) {
    res.rgb = outgoing(h.p, h.s, bounces, r, rays, 0)
    return res
  }
  // live: direct light at the camera hit, one bounce, then the cache
  const dl = direct(h.p, h.s, r, rays, 0)
  if (bounces <= 0) {
    res.rgb = dl
    return res
  }
  const d1 = cosSample(g.n, r())
  const h1 = intersect([h.p[0] + g.n[0] * 1e-4, h.p[1] + g.n[1] * 1e-4], d1)
  if (!h1 || SEGS[h1.s].emit) {
    res.rgb = dl
    return res
  }
  if (rays) rays.push({ from: h.p, to: h1.p, kind: "path", depth: 1 })
  const c = cellOf(h1.p, h1.s)
  let lo: RGB
  if (cache.n[c] < CACHE_WARM || r() < 1 / TRAIN_EVERY) {
    // a training path (or a cold cell): trace on from h1, and feed the cell
    const fresh = outgoing(h1.p, h1.s, bounces - 1, r, null, 1)
    cache.sum[c * 3] += fresh[0]
    cache.sum[c * 3 + 1] += fresh[1]
    cache.sum[c * 3 + 2] += fresh[2]
    cache.n[c]++
    lo = cache.n[c] < CACHE_WARM ? fresh : cacheValue(cache, c)
  } else {
    lo = cacheValue(cache, c)
  }
  res.cacheCell = c
  res.cacheP = h1.p
  res.rgb = [dl[0] + g.albedo[0] * lo[0], dl[1] + g.albedo[1] * lo[1], dl[2] + g.albedo[2] * lo[2]]
  return res
}

export function cacheValue(cache: Cache, c: number): RGB {
  const n = Math.max(1, cache.n[c])
  return [cache.sum[c * 3] / n, cache.sum[c * 3 + 1] / n, cache.sum[c * 3 + 2] / n]
}

// Reference: many samples, a long path, no cache.
export function reference(spp: number, seed = 7): RGB[] {
  const r = rng(seed)
  const c = newCache()
  const img: RGB[] = []
  for (let i = 0; i < PIXELS; i++) {
    const acc: RGB = [0, 0, 0]
    for (let k = 0; k < spp; k++) {
      const s = sample(i, r, 8, false, c, false).rgb
      acc[0] += s[0]; acc[1] += s[1]; acc[2] += s[2]
    }
    img.push([acc[0] / spp, acc[1] / spp, acc[2] / spp])
  }
  return img
}

// Display: exposure, x / (1 + x), then sRGB's curve approximated by a square root (enough for a swatch).
export function toCss(c: RGB, exposure = 1.6): string {
  const t = (v: number) => {
    const x = Math.max(0, v * exposure)
    return Math.round(255 * Math.sqrt(x / (1 + x)))
  }
  return `rgb(${t(c[0])},${t(c[1])},${t(c[2])})`
}

// Relative RMS error of the luminance, against the reference.
export function relErr(img: RGB[], ref: RGB[]): number {
  const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  let e = 0, m = 0
  for (let i = 0; i < img.length; i++) {
    const a = lum(img[i]), b = lum(ref[i])
    e += (a - b) * (a - b)
    m += b * b
  }
  return Math.sqrt(e / Math.max(1e-12, m))
}
