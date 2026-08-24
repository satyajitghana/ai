"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The loss surface, in the two shapes the landscape papers contrast.
//
// Li et al. (arXiv:1712.09913) made these pictures respectable by fixing the
// thing that made earlier ones meaningless: you cannot just pick two random
// directions in weight space and plot loss along them, because a network is
// invariant to rescaling a filter and its normalisation together, so the
// apparent sharpness of a minimum can be changed arbitrarily without changing
// the network at all. Filter normalisation rescales each random direction to
// match the norm of the corresponding filter, which makes two such plots
// comparable. Everything below is a stand-in for that picture, not a trained
// network: the shapes are hand-authored so the contrast is legible.
//
// Drawn on a canvas rather than in SVG, which is also why the arithmetic here
// does not go through lib/dmath: nothing computed in this file is serialised
// into the DOM, so there is no server/client string to disagree about.

const W = 660
const H = 420

// viridis, the same eleven control points matplotlib uses
const VIRIDIS: [number, number, number][] = [
  [0.267004, 0.004874, 0.329415],
  [0.282623, 0.140926, 0.457517],
  [0.253935, 0.265254, 0.529983],
  [0.206756, 0.371758, 0.553117],
  [0.163625, 0.471133, 0.558148],
  [0.127568, 0.566949, 0.550556],
  [0.134692, 0.658636, 0.517649],
  [0.266941, 0.748751, 0.440573],
  [0.477504, 0.821444, 0.318195],
  [0.741388, 0.873449, 0.149561],
  [0.993248, 0.906157, 0.143936],
]

function viridis(t: number): [number, number, number] {
  const u = Math.min(1, Math.max(0, t)) * (VIRIDIS.length - 1)
  const i = Math.min(VIRIDIS.length - 2, Math.floor(u))
  const f = u - i
  const a = VIRIDIS[i]
  const b = VIRIDIS[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

/** Deterministic value noise: a seeded lattice, smoothstep-interpolated. */
function makeNoise(seed: number) {
  const lattice = new Map<string, number>()
  let s = (seed * 7919) % 2147483646 || 1
  const next = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const at = (i: number, j: number) => {
    const k = `${i},${j}`
    let v = lattice.get(k)
    if (v === undefined) {
      v = next()
      lattice.set(k, v)
    }
    return v
  }
  return (x: number, y: number, freq: number) => {
    const fx = x * freq
    const fy = y * freq
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    let dx = fx - i
    let dy = fy - j
    dx = dx * dx * (3 - 2 * dx)
    dy = dy * dy * (3 - 2 * dy)
    return (
      at(i, j) * (1 - dx) * (1 - dy) +
      at(i + 1, j) * dx * (1 - dy) +
      at(i, j + 1) * (1 - dx) * dy +
      at(i + 1, j + 1) * dx * dy
    )
  }
}

const noise = makeNoise(7)

function heightAt(x: number, y: number, rough: number): number {
  const r2 = x * x + y * y
  const bowl = 0.55 * (1.35 * x * x + 0.85 * y * y)
  if (rough <= 0.001) return bowl + 0.03 * Math.cos(3 * x) * Math.cos(3 * y)

  let n = 0
  let amp = 1
  let freq = 2
  for (let o = 0; o < 5; o++) {
    n += amp * (noise(x + 1, y + 1, freq) - 0.5)
    amp *= 0.55
    freq *= 2
  }
  const taper = Math.pow(Math.min(1, Math.max(0, (r2 - 0.015) / 0.3)), 0.85)
  const well = 1.15 * (1 - Math.exp(-r2 / 0.055))
  return (1 - rough) * bowl + rough * (well + 0.3 * bowl) + rough * 0.62 * n * taper
}

type Pt = { x: number; y: number; z: number }

export function LossSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rough, setRough] = useState(0)
  const [yaw, setYaw] = useState(0.7)
  const [lr, setLr] = useState(55)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const dragRef = useRef<{ x: number; yaw: number } | null>(null)

  const N = 74
  const PITCH = 0.82
  const ZSCALE = 0.8

  // Gradient descent with momentum, by finite differences on the surface.
  const path = useCallback((): Pt[] => {
    const h = 0.012
    const rate = (lr / 1000) * (rough > 0.5 ? 0.55 : 1)
    let x = -0.86
    let y = 0.72
    let vx = 0
    let vy = 0
    const pts: Pt[] = []
    for (let i = 0; i < 220; i++) {
      const z = heightAt(x, y, rough)
      pts.push({ x, y, z })
      const gx = (heightAt(x + h, y, rough) - heightAt(x - h, y, rough)) / (2 * h)
      const gy = (heightAt(x, y + h, rough) - heightAt(x, y - h, rough)) / (2 * h)
      vx = 0.82 * vx - rate * gx
      vy = 0.82 * vy - rate * gy
      x = Math.min(0.99, Math.max(-0.99, x + vx))
      y = Math.min(0.99, Math.max(-0.99, y + vy))
    }
    return pts
  }, [lr, rough])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // sample the grid
    const zs: number[][] = []
    let zmin = Infinity
    let zmax = -Infinity
    for (let i = 0; i <= N; i++) {
      const row: number[] = []
      for (let j = 0; j <= N; j++) {
        const x = -1 + (2 * j) / N
        const y = -1 + (2 * i) / N
        const z = heightAt(x, y, rough)
        row.push(z)
        if (z < zmin) zmin = z
        if (z > zmax) zmax = z
      }
      zs.push(row)
    }
    const span = Math.max(1e-9, zmax - zmin)

    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    const cp = Math.cos(PITCH)
    const sp = Math.sin(PITCH)

    const proj = (x: number, y: number, z: number) => {
      const xr = x * cy - y * sy
      const yr = x * sy + y * cy
      const zr = (z - zmin) * ZSCALE
      return { sx: xr, sy: yr * sp + zr * cp, d: yr * cp - zr * sp }
    }

    // fit: one pass to find the extent, so the surface fills the canvas
    let lox = Infinity
    let hix = -Infinity
    let loy = Infinity
    let hiy = -Infinity
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const p = proj(-1 + (2 * j) / N, -1 + (2 * i) / N, zs[i][j])
        if (p.sx < lox) lox = p.sx
        if (p.sx > hix) hix = p.sx
        if (p.sy < loy) loy = p.sy
        if (p.sy > hiy) hiy = p.sy
      }
    }
    const m = 0.06
    const scale = Math.min((W * (1 - 2 * m)) / (hix - lox), (H * (1 - 2 * m)) / (hiy - loy))
    const ox = W / 2 - ((lox + hix) / 2) * scale
    const oy = H / 2 + ((loy + hiy) / 2) * scale
    const screen = (x: number, y: number, z: number) => {
      const p = proj(x, y, z)
      return { x: ox + p.sx * scale, y: oy - p.sy * scale, d: p.d }
    }

    ctx.clearRect(0, 0, W, H)

    // cells, painted far to near
    type Cell = { d: number; i: number; j: number }
    const cells: Cell[] = []
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const d =
          proj(-1 + (2 * j) / N, -1 + (2 * i) / N, zs[i][j]).d +
          proj(-1 + (2 * (j + 1)) / N, -1 + (2 * (i + 1)) / N, zs[i + 1][j + 1]).d
        cells.push({ d, i, j })
      }
    }
    cells.sort((a, b) => b.d - a.d)

    const light = [-0.45, -0.55, 0.7]
    const llen = Math.sqrt(light[0] ** 2 + light[1] ** 2 + light[2] ** 2)

    for (const { i, j } of cells) {
      const x0 = -1 + (2 * j) / N
      const x1 = -1 + (2 * (j + 1)) / N
      const y0 = -1 + (2 * i) / N
      const y1 = -1 + (2 * (i + 1)) / N
      const a = screen(x0, y0, zs[i][j])
      const b = screen(x0, y1, zs[i + 1][j])
      const c = screen(x1, y1, zs[i + 1][j + 1])
      const e = screen(x1, y0, zs[i][j + 1])

      const zAvg = (zs[i][j] + zs[i + 1][j] + zs[i + 1][j + 1] + zs[i][j + 1]) / 4
      const [r, g, bl] = viridis((zAvg - zmin) / span)

      // lambert from the cell's own slope
      const dzdx = ((zs[i][j + 1] - zs[i][j]) / (2 / N)) * ZSCALE
      const dzdy = ((zs[i + 1][j] - zs[i][j]) / (2 / N)) * ZSCALE
      const nlen = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1)
      const lam = (-dzdx * light[0] - dzdy * light[1] + light[2]) / (nlen * llen)
      const sh = Math.min(1.3, Math.max(0, 0.6 + 0.52 * lam))

      ctx.fillStyle = `rgb(${Math.round(r * sh * 255)},${Math.round(g * sh * 255)},${Math.round(bl * sh * 255)})`
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(c.x, c.y)
      ctx.lineTo(e.x, e.y)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = ctx.fillStyle
      ctx.lineWidth = 0.6
      ctx.stroke()
    }

    // the descent trajectory
    const pts = path()
    const upto = Math.max(2, Math.min(pts.length, step))
    if (upto > 1) {
      ctx.lineJoin = "round"
      ctx.lineCap = "round"
      for (const [width, colour] of [
        [4.5, "rgba(255,255,255,0.9)"],
        [2.2, "rgb(255,92,205)"],
      ] as const) {
        ctx.beginPath()
        for (let k = 0; k < upto; k++) {
          const p = screen(pts[k].x, pts[k].y, pts[k].z + 0.012)
          if (k === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.lineWidth = width
        ctx.strokeStyle = colour
        ctx.stroke()
      }
      const head = screen(pts[upto - 1].x, pts[upto - 1].y, pts[upto - 1].z + 0.012)
      ctx.beginPath()
      ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = "rgb(255,92,205)"
      ctx.fill()
      ctx.strokeStyle = "rgba(255,255,255,0.95)"
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }, [rough, yaw, step, path])

  // animate the walk
  useEffect(() => {
    if (!running) return
    let raf = 0
    const tick = () => {
      setStep((s) => {
        if (s >= 220) {
          setRunning(false)
          return s
        }
        return s + 2
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const finalLoss = (() => {
    const pts = path()
    return pts[Math.max(0, Math.min(pts.length - 1, step - 1))]?.z ?? 0
  })()

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          loss over two filter-normalised directions in weight space — drag to orbit
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {rough < 0.02 ? "well-conditioned" : rough > 0.7 ? "chaotic" : "in between"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto rounded-lg" style={{ background: "rgb(9,11,15)" }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="A three-dimensional loss surface. At roughness zero it is a smooth bowl with a single minimum; raising roughness turns the rim into chaotic ridges around a central crater. A pink trajectory shows gradient descent walking downhill to the minimum."
            style={{ width: W, height: H, touchAction: "pan-y" }}
            className="mx-auto block min-w-[560px] cursor-grab active:cursor-grabbing"
            onPointerDown={(ev) => {
              dragRef.current = { x: ev.clientX, yaw }
              ev.currentTarget.setPointerCapture(ev.pointerId)
            }}
            onPointerMove={(ev) => {
              const d = dragRef.current
              if (!d) return
              setYaw(d.yaw + (ev.clientX - d.x) * 0.008)
            }}
            onPointerUp={() => {
              dragRef.current = null
            }}
          />
        </div>

        <div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              roughness
            </span>
            <Range
              min={0}
              max={100}
              step={2}
              value={Math.round(rough * 100)}
              onChange={(e) => {
                setRough(Number(e.target.value) / 100)
                setStep(0)
                setRunning(false)
              }}
              className="flex-1"
              aria-label="how chaotic the landscape is, from a clean bowl to a jagged surface"
              accent="oklch(0.68 0.13 85)"
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {rough.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              learning rate
            </span>
            <Range
              min={10}
              max={140}
              step={5}
              value={lr}
              onChange={(e) => {
                setLr(Number(e.target.value))
                setStep(0)
                setRunning(false)
              }}
              className="flex-1"
              aria-label="step size for the descent"
              accent="oklch(0.60 0.15 255)"
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {(lr / 1000).toFixed(3)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (step >= 220) setStep(0)
              setRunning((r) => !r)
            }}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 font-mono text-[10px] transition-colors",
              running
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {running ? "pause" : step >= 220 ? "run again" : "run gradient descent"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(0)
              setRunning(false)
            }}
            className="cursor-pointer rounded-full border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            reset
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            step {Math.min(220, step)} / 220 · height at the walker{" "}
            <span className="tabular-nums text-foreground">{finalLoss.toFixed(3)}</span>
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This is what the word <em>loss</em>{" "}refers to before anyone plots it against compute: a
          surface over the weights, and training is a walk downhill on it. Two directions are drawn
          here because two is what fits on a screen —{" "}
          <span className="text-foreground">the real surface has one axis per parameter</span>, so a
          frontier model&rsquo;s is a landscape in something like a trillion dimensions.
          <br />
          <br />
          Turn the roughness up and the walk starts getting caught, which is the picture people
          reach for when they say optimisation is hard. It is worth being precise about what the
          scaling laws in the rest of this piece actually claim, because it is not about this
          picture at all. They say nothing about the route. They predict{" "}
          <span className="text-foreground">how low the floor sits</span>{" "}once you have finished
          walking — as a function of how big the model is, how much it read, and how much arithmetic
          you were willing to buy.
        </p>
      </div>
    </figure>
  )
}
