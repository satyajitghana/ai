"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import { mexp, msin } from "@/lib/dmath"

// What makes a frame look painted, one layer at a time, on a small scene of our
// own (a hill, a far ridge, a tree, a cloaked walker, a few blades of grass in
// front of him). The layers and their constants are Painted Valley's:
//   ramp   lit = smoothstep(0, w, N·L + 0.06); the valley's people use w = 0.035
//          (src/valley/wanderer.js). The slider runs w from 1 (soft) to 0.035.
//   shade  a colour of its own, cooler and deeper, not the lit colour darkened.
//   ink    each figure part writes a small alpha (cloak 0.03, hat 0.06, skin 0.21);
//          a line wherever two different alphas meet, unless the thing that is not
//          the figure is nearer (so grass in front of him is not inked); the line is
//          the colour under it times (0.2, 0.14, 0.15), mixed 0.92 (src/lib/frame.js).
//   fog    1 - exp(-distance x density), toward a haze colour (src/lib/glsl.js).
//   paint  a Kuwahara pass: four overlapping quadrants, each weighted by
//          1 / (1e-7 + v^4 x 1e12) where v is its colour variance; radius 2 in the
//          middle distance, 1 near and far, 0 where alpha < 0.6 (src/lib/frame.js).
// Everything here is drawn per pixel into a 360x200 canvas after mount.

const W = 360
const H = 200
const STAGES = ["flat", "ramp", "ink", "fog", "paint"] as const
type Stage = (typeof STAGES)[number]

const SUN = norm([-0.8, 0.55, 0.3])
const FOG = [0.72, 0.8, 0.86]

type V3 = [number, number, number]
function norm(v: number[]): V3 {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: number[], b: number[], t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// integer hash noise: deterministic, no trig
function hash(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

// [lit paint, shade paint]
const PAINT: Record<string, [V3, V3]> = {
  meadow: [[0.42, 0.72, 0.26], [0.16, 0.38, 0.3]],
  ridge: [[0.46, 0.62, 0.5], [0.3, 0.38, 0.52]],
  tree: [[0.3, 0.58, 0.24], [0.08, 0.28, 0.26]],
  trunk: [[0.42, 0.3, 0.2], [0.2, 0.14, 0.16]],
  cloud: [[1.0, 0.99, 0.95], [0.66, 0.7, 0.86]],
  cloak: [[0.14, 0.32, 0.64], [0.07, 0.13, 0.4]],
  hat: [[0.95, 0.74, 0.34], [0.66, 0.46, 0.26]],
  skin: [[0.95, 0.68, 0.5], [0.62, 0.36, 0.3]],
  grass: [[0.5, 0.8, 0.3], [0.2, 0.44, 0.24]],
}
const INK: Record<string, number> = { cloak: 0.03, hat: 0.06, skin: 0.21 }

type Hit = { kind: string; n: V3; depth: number; alpha: number } | null

const ridgeY = (x: number) => 92 + 9 * msin(x * 0.031) + 5 * msin(x * 0.083 + 1.3)
const hillY = (x: number) => 122 + 0.0016 * (x - 250) * (x - 250) - 10

function sphere(px: number, py: number, cx: number, cy: number, r: number): V3 | null {
  const dx = (px - cx) / r, dy = (cy - py) / r
  const d2 = dx * dx + dy * dy
  if (d2 > 1) return null
  return [dx, dy, Math.sqrt(1 - d2)]
}

// what is seen at a pixel, nearest first
function sceneAt(x: number, y: number): Hit {
  // grass blades in front of the walker
  for (const [bx, lean, tall] of [[226, 6, 26], [238, -4, 30], [251, 5, 22], [214, -3, 18]] as const) {
    const t = (200 - y) / tall
    if (t >= 0 && t <= 1) {
      const cx = bx + lean * t * t
      const half = 1.6 * (1 - t) + 0.3
      if (Math.abs(x - cx) < half) return { kind: "grass", n: norm([lean * 0.05, 0.5, 0.8]), depth: 5, alpha: 1 }
    }
  }
  // the walker: hat, head, cloak (a cone)
  const fx = 232, top = 118
  if (Math.abs(x - fx) <= 17 && Math.abs(y - top) <= 3.2) {
    const e = ((x - fx) / 17) ** 2 + ((y - top) / 3.2) ** 2
    if (e <= 1) return { kind: "hat", n: norm([(x - fx) / 30, 0.85, 0.5]), depth: 8, alpha: INK.hat }
  }
  if (y < top && y > top - 8 && Math.abs(x - fx) <= 6) {
    const s = sphere(x, y, fx, top - 3, 6)
    if (s) return { kind: "hat", n: norm([s[0], s[1] + 0.4, s[2]]), depth: 8, alpha: INK.hat }
  }
  {
    const s = sphere(x, y, fx, top + 6, 5)
    if (s && y > top + 2) return { kind: "skin", n: s, depth: 8, alpha: INK.skin }
  }
  if (y > top + 8 && y < 196) {
    const t = (y - (top + 8)) / (196 - top - 8)
    const half = 9 + 13 * t
    const u = (x - fx) / half
    if (Math.abs(u) <= 1) return { kind: "cloak", n: norm([u * 0.9, 0.15, Math.sqrt(1 - u * u * 0.81)]), depth: 8, alpha: INK.cloak }
  }
  // the tree: a trunk and a crown of clumps
  const clumps: [number, number, number][] = [[84, 70, 20], [62, 84, 17], [104, 84, 18], [80, 92, 19], [96, 60, 14]]
  let best: Hit = null, bestZ = -1
  for (const [cx, cy, r] of clumps) {
    const s = sphere(x, y, cx, cy, r)
    if (s && s[2] * r + cy * 0.01 > bestZ) {
      bestZ = s[2] * r + cy * 0.01
      best = { kind: "tree", n: s, depth: 30, alpha: 1 }
    }
  }
  if (best) return best
  if (x > 76 && x < 88 && y > 86 && y < hillY(x) + 4) return { kind: "trunk", n: norm([(x - 82) / 6, 0, 1]), depth: 30, alpha: 1 }
  // the near hill
  const hy = hillY(x)
  if (y >= hy) {
    const slope = 0.0032 * (x - 250)
    const depth = 6 + 2600 / Math.max(8, y - 88)
    return { kind: "meadow", n: norm([-slope, 1, 0.35]), depth, alpha: 1 }
  }
  // the far ridge
  const ry = ridgeY(x)
  if (y >= ry) {
    const dy = ridgeY(x + 1) - ry
    return { kind: "ridge", n: norm([dy * 0.5, 0.7, 0.7]), depth: 420, alpha: 1 }
  }
  // clouds: heaps of spheres
  for (const [cx, cy, r] of [[270, 52, 18], [292, 46, 22], [316, 54, 16], [300, 62, 15], [150, 40, 13], [166, 36, 16], [182, 42, 12]] as [number, number, number][]) {
    const s = sphere(x, y, cx, cy, r)
    if (s) return { kind: "cloud", n: s, depth: 2000, alpha: 0.5 }
  }
  return null // sky
}

type Opts = { stage: number; ramp: number; ink: number; ownShade: boolean }

function render(o: Opts): Uint8ClampedArray {
  const w = 1 - o.ramp * (1 - 0.035) // 1 (soft) to 0.035 (the valley's step)
  const rgb = new Float32Array(W * H * 3)
  const alpha = new Float32Array(W * H)
  const depth = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const hit = sceneAt(x + 0.5, y + 0.5)
      let c: V3
      if (!hit) {
        c = mix([0.2, 0.46, 0.82], [0.68, 0.82, 0.92], Math.min(1, y / 110))
        alpha[i] = 0.5
        depth[i] = 1e5
      } else {
        const [lit, shadeOwn] = PAINT[hit.kind]
        const shade: V3 = o.ownShade ? shadeOwn : [lit[0] * 0.45, lit[1] * 0.45, lit[2] * 0.45]
        if (o.stage === 0) c = lit
        else {
          const l = sstep(0, w, dot(hit.n, SUN) + 0.06)
          c = mix(shade, lit, l)
        }
        // brush marks on the meadow (the valley's strokes.js idea, one size)
        if (hit.kind === "meadow" && o.stage > 0) {
          const m = vnoise(x * 0.22, y * 0.6) - 0.5 + (hash(x * 7, y * 3) - 0.5) * 0.35
          c = [c[0] * (1 + m * 0.35), c[1] * (1 + m * 0.3), c[2] * (1 + m * 0.3)]
        }
        if (hit.kind === "tree" && o.stage > 0) {
          const m = vnoise(x * 0.35, y * 0.35) - 0.5 + (hash(x, y) - 0.5) * 0.6
          c = [c[0] * (1 + m * 0.6), c[1] * (1 + m * 0.5), c[2] * (1 + m * 0.5)]
        }
        alpha[i] = hit.alpha
        depth[i] = hit.depth
      }
      rgb[i * 3] = c[0]
      rgb[i * 3 + 1] = c[1]
      rgb[i * 3 + 2] = c[2]
    }
  }
  // fog
  if (o.stage >= 3) {
    for (let i = 0; i < W * H; i++) {
      if (depth[i] >= 2000) continue // sky and clouds are painted with the sky, not fogged
      const f = 1 - mexp(-depth[i] * 0.0022)
      for (let k = 0; k < 3; k++) rgb[i * 3 + k] += (FOG[k] - rgb[i * 3 + k]) * f
    }
  }
  // paint: the valley's Kuwahara, weights and radius rule as in frame.js
  let out = rgb
  if (o.stage >= 4) {
    out = new Float32Array(W * H * 3)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        let r = 2
        const away = depth[i]
        if (away < 16 || away > 140) r = 1
        if (alpha[i] < 0.6) r = 0
        if (r === 0) {
          out[i * 3] = rgb[i * 3]; out[i * 3 + 1] = rgb[i * 3 + 1]; out[i * 3 + 2] = rgb[i * 3 + 2]
          continue
        }
        const m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        const s = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        for (let j = -r; j <= r; j++) {
          for (let ii = -r; ii <= r; ii++) {
            const xx = Math.min(W - 1, Math.max(0, x + ii)), yy = Math.min(H - 1, Math.max(0, y + j))
            const q = (yy * W + xx) * 3
            for (let k = 0; k < 3; k++) {
              const v = rgb[q + k] / (1 + rgb[q + k])
              const vv = v * v
              if (ii <= 0 && j <= 0) { m[k] += v; s[k] += vv }
              if (ii >= 0 && j <= 0) { m[3 + k] += v; s[3 + k] += vv }
              if (ii <= 0 && j >= 0) { m[6 + k] += v; s[6 + k] += vv }
              if (ii >= 0 && j >= 0) { m[9 + k] += v; s[9 + k] += vv }
            }
          }
        }
        const n = (r + 1) * (r + 1)
        let tot = 0
        const sum = [0, 0, 0]
        for (let q = 0; q < 4; q++) {
          let v = 0
          const mean = [0, 0, 0]
          for (let k = 0; k < 3; k++) {
            mean[k] = m[q * 3 + k] / n
            v += Math.abs(s[q * 3 + k] / n - mean[k] * mean[k])
          }
          const wq = 1 / (1e-7 + v * v * v * v * 1e12)
          for (let k = 0; k < 3; k++) sum[k] += mean[k] * wq
          tot += wq
        }
        for (let k = 0; k < 3; k++) {
          const ok = sum[k] / tot
          out[i * 3 + k] = ok / (1 - Math.min(ok, 0.985))
        }
      }
    }
  }
  // ink, from the alphas, after the paint (as in frame.js's last pass)
  const px = new Uint8ClampedArray(W * H * 4)
  const reach = o.ink
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      let c: V3 = [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]]
      if (o.stage >= 2 && reach > 0) {
        const a = alpha[i], da = depth[i]
        let e = 0
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + ox * reach, yy = y + oy * reach
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
          const q = yy * W + xx
          const b = alpha[q], db = depth[q]
          if (Math.min(a, b) >= 0.23) continue
          if (Math.max(a, b) >= 0.23 && (a < b ? db < da : da < db)) continue
          e = Math.max(e, Math.abs(a - b))
        }
        const line = sstep(0.008, 0.022, e) * 0.92
        c = mix(c, [Math.min(c[0], 1.2) * 0.2, Math.min(c[1], 1.2) * 0.14, Math.min(c[2], 1.2) * 0.15], line)
      }
      px[i * 4] = Math.round(Math.min(1, Math.max(0, c[0])) * 255)
      px[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, c[1])) * 255)
      px[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, c[2])) * 255)
      px[i * 4 + 3] = 255
    }
  }
  return px
}

const NOTES: Record<Stage, string> = {
  flat: "Flat colour: every thing in its lit paint. Already a picture, but nothing is turned toward or away from the sun.",
  ramp: "Light and shade: lit = smoothstep(0, w, N·L + 0.06). At w = 1 it is a soft gradient; at the valley's 0.035 it is a step, and each thing is two tones.",
  ink: "Ink: the walker's parts write their own small alphas; a line goes wherever two different alphas meet, unless the other thing is nearer. The grass blades in front of him stay uninked.",
  fog: "Air: 1 − exp(−distance × density) mixes each thing toward a haze colour, so the far ridge sinks back and the near hill does not.",
  paint: "The finish: a Kuwahara pass. Each pixel takes the mean of the calmest of four overlapping quadrants, so edges stay and the areas between go flat. The walker and the sky ask to be left alone (alpha below 0.6).",
}

export function PaintStages() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [stage, setStage] = useState(4)
  const [ramp, setRamp] = useState(1)
  const [ink, setInk] = useState(1)
  const [ownShade, setOwnShade] = useState(true)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext("2d")
    if (!cv || !ctx) return
    const img = ctx.createImageData(W, H)
    img.data.set(render({ stage, ramp, ink, ownShade }))
    ctx.putImageData(img, 0, 0)
  }, [stage, ramp, ink, ownShade])

  const w = 1 - ramp * (1 - 0.035)
  const name = STAGES[stage]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what makes it look painted · one layer at a time</span>
        <span className="text-muted-foreground/50">our scene, the valley&apos;s constants</span>
      </div>
      <div className="p-3 sm:p-4">
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="w-full rounded-md border"
          style={{ imageRendering: "pixelated", aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label={`A small drawn scene: a far ridge, a hill, a tree and a cloaked walker with grass in front of him, rendered up to the "${name}" layer.`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">layers up to</span>
          {STAGES.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(i)}
              aria-pressed={stage === i}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                stage === i ? "border-foreground/40 bg-foreground text-background" : i < stage ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">ramp w = {w.toFixed(3)}</span>
            <Range min={0} max={1} step={0.01} value={ramp} onChange={(e) => setRamp(Number(e.target.value))} className="w-full cursor-pointer" aria-label="Width of the light-to-shade ramp" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">ink reach {ink} px</span>
            <Range min={0} max={3} step={1} value={ink} onChange={(e) => setInk(Number(e.target.value))} className="w-full cursor-pointer" aria-label="How far the ink test looks, in pixels" />
          </label>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <input type="checkbox" checked={ownShade} onChange={(e) => setOwnShade(e.target.checked)} />
          shade is its own colour (off: the lit colour × 0.45)
        </label>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{NOTES[name]}</p>
      </div>
    </figure>
  )
}
