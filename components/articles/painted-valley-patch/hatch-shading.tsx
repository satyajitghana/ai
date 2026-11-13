"use client"

import { useEffect, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog2, msin } from "@/lib/dmath"

// Coloured Pencil's shading, ported from its src/pencil.js onto a ball and a
// block of our own. Each object carries two fields, h1 = p·a and h2 = p·b, with p
// in the object's own coordinates and a, b the file's default slants
// ([0.62, 1, 0.34] and [-0.78, 1, 0.22], normalised): strokes lie along their
// level lines, so they stay on the object when it moves. How many are drawn is
// picked per pixel from g = |∇h| in pixels, in whole octaves:
//   k = -log2(g·px), s = 2^floor(k), stroke centres at integer h·s,
// so neighbouring strokes are between px and 2·px apart on screen, and the
// half-way strokes of the next octave fade in with t = frac(k). Darkness
// D = 1 - clamp(lit^0.8) sets how wide and hard the strokes are pressed:
// own-colour strokes cover 0.45 + 0.4·D, the blue-violet shade pencil
// clamp((D - 0.24)·1.35, 0, 0.82). Drawn per pixel into a canvas after mount.

const W = 360
const H = 210

type V3 = [number, number, number]
const norm = (v: V3): V3 => {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const A = norm([0.62, 1, 0.34])
const B = norm([-0.78, 1, 0.22])
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const fract = (x: number) => x - Math.floor(x)
const pcHash = (n: number) => fract(msin(n * 127.1) * 43758.5453)

function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  let fx = x - ix, fy = y - iy, fz = z - iz
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  )
}

const pcStroke = (Wd: number, d: number) => sstep(Wd * 0.5 + 1, Wd * 0.5 - 1, d) * Math.min(1, Wd * 0.6)
// pcStrokes, with g (the field's change per pixel) passed in
function pcStrokes(h: number, cover: number, g: number, px: number) {
  g += 1e-9
  const k = -mlog2(g * px), kf = Math.floor(k), t = k - kf, s = 2 ** kf, P = 1 / (g * s), x = h * s
  const ic = Math.floor(x + 0.5), im = Math.floor(x) + 0.5
  const Wd = (cover * P) / (1 + t) * 1.3
  const a = pcStroke(Wd * (0.65 + 0.7 * pcHash(ic / s + 3.7)), Math.abs(x - ic) * P) * (0.55 + 0.45 * pcHash(ic / s))
  const b = pcStroke(Wd * t * (0.65 + 0.7 * pcHash(im / s + 3.7)), Math.abs(x - im) * P) * (0.55 + 0.45 * pcHash(im / s))
  return Math.max(a, b)
}

// rotation of the block about y then x
const ROT_Y = 0.6, ROT_X = 0.42
const rot = (v: V3, inv: boolean): V3 => {
  const cy = mcos(inv ? -ROT_Y : ROT_Y), sy = msin(inv ? -ROT_Y : ROT_Y)
  const cx = mcos(inv ? -ROT_X : ROT_X), sx = msin(inv ? -ROT_X : ROT_X)
  if (!inv) {
    const a: V3 = [v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy]
    return [a[0], a[1] * cx - a[2] * sx, a[1] * sx + a[2] * cx]
  }
  const a: V3 = [v[0], v[1] * cx - v[2] * sx, v[1] * sx + v[2] * cx]
  return [a[0] * cy + a[2] * sy, a[1], -a[0] * sy + a[2] * cy]
}

type Hit = { id: number; p: V3; n: V3; z: number }

// orthographic: screen (x, y) at a given zoom maps to view (u, v)
function cast(u: number, v: number): Hit | null {
  let best: Hit | null = null
  // ball, centre (-1.25, 0, 0), radius 1; object coordinates are relative to its centre
  {
    const dx = u + 1.25, dy = v
    const d2 = dx * dx + dy * dy
    if (d2 <= 1) {
      const z = Math.sqrt(1 - d2)
      best = { id: 1, p: [dx, dy, z], n: [dx, dy, z], z }
    }
  }
  // block, centre (1.25, 0, 0), half size 0.72, rotated; slab test in object space
  {
    const o = rot([u - 1.25, v, 5], true)
    const d = rot([0, 0, -1], true)
    let t0 = -1e9, t1 = 1e9, axis = -1, sign = 1
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) {
        if (Math.abs(o[k]) > 0.72) { t0 = 1; t1 = 0 }
        continue
      }
      const a = Math.min((-0.72 - o[k]) / d[k], (0.72 - o[k]) / d[k])
      const b = Math.max((-0.72 - o[k]) / d[k], (0.72 - o[k]) / d[k])
      // the face the ray enters through faces back along the ray
      if (a > t0) { t0 = a; axis = k; sign = d[k] > 0 ? -1 : 1 }
      if (b < t1) t1 = b
    }
    if (t0 <= t1 && axis >= 0) {
      const p: V3 = [o[0] + d[0] * t0, o[1] + d[1] * t0, o[2] + d[2] * t0]
      const nObj: V3 = [0, 0, 0]
      nObj[axis] = sign
      const z = 5 - t0
      if (!best || z > best.z) best = { id: 2, p, n: rot(nObj, false), z }
    }
  }
  return best
}

type Opts = { light: number; zoom: number; px: number; shadePencil: boolean }

// the cast depends only on the zoom: keep the last one, so dragging the light or the spacing is cheap
type Geo = { zoom: number; id: Int8Array; h1: Float32Array; h2: Float32Array; at: V3[]; n: V3[] }
let last: Geo | null = null
function geometry(zoom: number): Geo {
  if (last && last.zoom === zoom) return last
  const scale = 40 * zoom // pixels per unit
  const cx = W / 2, cy = H / 2 + 4
  const g: Geo = { zoom, id: new Int8Array(W * H), h1: new Float32Array(W * H), h2: new Float32Array(W * H), at: new Array(W * H), n: new Array(W * H) }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const hit = cast((x + 0.5 - cx) / scale, (cy - y - 0.5) / scale)
      if (!hit) continue
      g.id[i] = hit.id
      g.h1[i] = dot(hit.p, A)
      g.h2[i] = dot(hit.p, B)
      g.at[i] = hit.p
      g.n[i] = hit.n
    }
  }
  last = g
  return g
}

function render(o: Opts) {
  const L = norm([mcos(o.light), 0.55, msin(o.light) * 0.6 + 0.55])
  const { id, h1, h2, at, n } = geometry(o.zoom)
  const D = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    if (!id[i]) continue
    const lit = Math.max(0, dot(n[i], L)) * 0.9 + 0.1
    D[i] = 1 - Math.min(1, Math.max(0, lit ** 0.8))
  }
  const grad = (f: Float32Array, x: number, y: number) => {
    const i = y * W + x
    const ix = x + 1 < W && id[i + 1] === id[i] ? f[i + 1] - f[i] : x > 0 && id[i - 1] === id[i] ? f[i] - f[i - 1] : 0
    const iy = y + 1 < H && id[i + W] === id[i] ? f[i + W] - f[i] : y > 0 && id[i - W] === id[i] ? f[i] - f[i - W] : 0
    return Math.sqrt(ix * ix + iy * iy)
  }
  const local: Record<number, V3> = { 1: [0.86, 0.36, 0.3], 2: [0.3, 0.55, 0.78] }
  const out = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const paper: V3 = [0.975, 0.955, 0.915]
      let c: V3 = [1, 1, 1]
      if (id[i]) {
        const p = at[i]
        const col = local[id[i]]
        const d = D[i]
        const tooth = noise3(p[0] * 19, p[1] * 19, p[2] * 19) * 0.6 + noise3(p[0] * 47 + 5, p[1] * 47, p[2] * 47) * 0.4
        const wob1 = 0.012 * msin(p[0] * 5 + p[1] * 3) + 0.01 * msin(p[2] * 6.3 - p[1] * 4.1)
        const wob2 = 0.012 * msin(p[2] * 4.6 + p[0] * 2.7) + 0.01 * msin(p[1] * 5.9 + p[0] * 3.3)
        const shade: V3 = [col[0] * 0.5 * 0.45 + 0.24 * 0.55, col[1] * 0.5 * 0.45 + 0.2 * 0.55, col[2] * 0.5 * 0.45 + 0.62 * 0.55]
        const layer = (base: V3, tint: V3, amt: number): V3 => {
          const a = Math.min(1, Math.max(0, amt))
          return [base[0] * (1 + (tint[0] - 1) * a), base[1] * (1 + (tint[1] - 1) * a), base[2] * (1 + (tint[2] - 1) * a)]
        }
        c = layer(c, [1, 0.9, 0.56], (1 - sstep(0, 0.4, d)) * 0.34 * (0.45 + 0.9 * tooth))
        c = layer(c, col, (0.36 + 0.45 * sstep(0, 0.7, d)) * (0.5 + 0.85 * tooth))
        c = layer(c, col, pcStrokes(h1[i] + wob1, 0.45 + 0.4 * d, grad(h1, x, y), o.px) * (0.62 + 0.5 * d) * (0.55 + 0.8 * tooth))
        if (o.shadePencil) {
          const cover = Math.min(0.82, Math.max(0, (d - 0.24) * 1.35))
          c = layer(c, shade, pcStrokes(h2[i] + wob2, cover, grad(h2, x, y), o.px) * (0.5 + 0.75 * tooth) * 0.95)
        }
        // a soft graphite line where one thing ends against another
        const edge = [1, -1, W, -W].some((k) => i + k >= 0 && i + k < W * H && id[i + k] !== id[i])
        if (edge) c = [c[0] * 0.35, c[1] * 0.32, c[2] * 0.36]
      }
      out[i * 4] = Math.round(Math.min(1, c[0] ** (1 / 2.2)) * paper[0] * 255)
      out[i * 4 + 1] = Math.round(Math.min(1, c[1] ** (1 / 2.2)) * paper[1] * 255)
      out[i * 4 + 2] = Math.round(Math.min(1, c[2] ** (1 / 2.2)) * paper[2] * 255)
      out[i * 4 + 3] = 255
    }
  }
  return out
}

export function HatchShading() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [light, setLight] = useState(2.3)
  const [zoom, setZoom] = useState(1.6)
  const [px, setPx] = useState(5)
  const [shadePencil, setShadePencil] = useState(true)

  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (!ctx) return
    const img = ctx.createImageData(W, H)
    img.data.set(render({ light, zoom, px, shadePencil }))
    ctx.putImageData(img, 0, 0)
  }, [light, zoom, px, shadePencil])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>coloured pencil · strokes along level lines</span>
        <span className="text-muted-foreground/50">pencil.js, ported</span>
      </div>
      <div className="p-3 sm:p-4">
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="w-full rounded-md border"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label="A red ball and a blue block shaded in coloured-pencil strokes: light strokes of each object's own colour on the lit side, harder strokes and a blue-violet cross-hatch in shade."
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">light</span>
            <Range min={0} max={6.28} step={0.02} value={light} onChange={(e) => setLight(Number(e.target.value))} className="w-full cursor-pointer" aria-label="Light direction" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">walk in</span>
            <Range min={0.7} max={1.9} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full cursor-pointer" aria-label="How close the camera is" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">px = {px}</span>
            <Range min={3} max={12} step={1} value={px} onChange={(e) => setPx(Number(e.target.value))} className="w-full cursor-pointer" aria-label="Stroke spacing in pixels" />
          </label>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <input type="checkbox" checked={shadePencil} onChange={(e) => setShadePencil(e.target.checked)} />
          the second, blue-violet pencil across the shade
        </label>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Turn the light and the strokes stay where they are; only how hard and how wide they are pressed changes.
          Walk in and the strokes grow with the object until they are twice <code>px</code>{" "}apart, then the strokes
          half-way between them fade in and the spacing drops back to <code>px</code>: an octave. No stroke slides
          along the surface. The block&apos;s flat faces get straight parallel strokes; the ball&apos;s get curves,
          because a plane cuts a sphere in circles.
        </p>
      </div>
    </figure>
  )
}
