"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowsClockwiseIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// A 2D field of locally-coupled Kuramoto oscillators, rendered as a phase map
// (hue = phase). Each cell pulls toward its four neighbours; raise the coupling
// and incoherent speckle organises into travelling spiral waves and chimera-like
// domains — the same emergent order Un-0 harnesses as computation. Canvas-drawn,
// so it only runs client-side; the article's prose and the order-parameter ring
// carry the idea for no-JS/agent readers.

const GRID = 72 // GRID×GRID oscillators

// Cyclic phase→RGB lookups, each built from colour stops interpolated around the
// 2π wheel so they wrap cleanly. Designed palettes (not just a neon rainbow) — the
// reader can switch between them. Each varies luminance so the waves read as depth.
type RGB = [number, number, number]

function buildLUT(stops: RGB[]): RGB[] {
  return Array.from({ length: 360 }, (_, d) => {
    const t = (d / 360) * stops.length
    const i = Math.floor(t) % stops.length
    const j = (i + 1) % stops.length
    const f = t - Math.floor(t)
    const a = stops[i]
    const b = stops[j]
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    ] as RGB
  })
}

const PALETTES: { id: string; label: string; lut: RGB[] }[] = [
  {
    id: "ember",
    label: "ember (indigo · cyan · coral)",
    lut: buildLUT([
      [43, 45, 107],
      [63, 182, 200],
      [232, 224, 200],
      [217, 104, 90],
    ]),
  },
  {
    id: "twilight",
    label: "twilight (navy · violet · gold)",
    lut: buildLUT([
      [24, 22, 48],
      [122, 84, 178],
      [233, 222, 224],
      [214, 150, 70],
    ]),
  },
  {
    id: "terminal",
    label: "terminal (mono teal)",
    lut: buildLUT([
      [18, 26, 30],
      [40, 120, 130],
      [126, 214, 214],
      [40, 120, 130],
    ]),
  },
  {
    id: "spectrum",
    label: "spectrum (full phase wheel)",
    lut: buildLUT([
      [220, 70, 70],
      [220, 200, 70],
      [70, 200, 110],
      [70, 200, 210],
      [80, 90, 220],
      [200, 80, 200],
    ]),
  },
]

function seedPhases(mode: "noise" | "spiral", seed: number): Float32Array {
  const p = new Float32Array(GRID * GRID)
  let s = seed * 9301 + 49297
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const c = (GRID - 1) / 2
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      p[y * GRID + x] =
        mode === "spiral"
          ? Math.atan2(y - c, x - c) + 0.06 * Math.hypot(x - c, y - c)
          : rand() * 2 * Math.PI
    }
  }
  return p
}

export function KuramotoField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [k, setK] = useState(2.6)
  const [playing, setPlaying] = useState(true)
  const [mode, setMode] = useState<"noise" | "spiral">("noise")
  const [palette, setPalette] = useState("ember")
  const [r, setR] = useState(0)

  const phases = useRef(seedPhases("noise", 1))
  const seedN = useRef(1)
  const kRef = useRef(k)
  kRef.current = k
  const lutRef = useRef<RGB[]>(PALETTES[0].lut)
  lutRef.current = PALETTES.find((p) => p.id === palette)?.lut ?? PALETTES[0].lut

  // natural frequencies: a gentle radial gradient → seeds travelling target waves
  const omega = useRef<Float32Array>(
    (() => {
      const o = new Float32Array(GRID * GRID)
      const c = (GRID - 1) / 2
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++)
          o[y * GRID + x] = 1.0 + 0.9 * (Math.hypot(x - c, y - c) / c - 0.5)
      return o
    })()
  )

  const reseed = (m: "noise" | "spiral") => {
    seedN.current += 1
    setMode(m)
    phases.current = seedPhases(m, seedN.current)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // offscreen GRID×GRID image we scale up smoothly to the display canvas
    const off = document.createElement("canvas")
    off.width = GRID
    off.height = GRID
    const octx = off.getContext("2d")!
    const img = octx.createImageData(GRID, GRID)

    const resize = () => {
      const w = canvas.clientWidth
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(w * dpr)
      ctx.imageSmoothingEnabled = true
    }
    resize()
    window.addEventListener("resize", resize)

    let raf = 0
    let last = 0
    const draw = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 0.04) : 0.016
      last = t
      const th = phases.current
      const om = omega.current
      const K = kRef.current
      const next = playing ? new Float32Array(GRID * GRID) : th

      if (playing) {
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            const i = y * GRID + x
            const c = th[i]
            // toroidal 4-neighbour coupling
            const up = th[((y - 1 + GRID) % GRID) * GRID + x]
            const dn = th[((y + 1) % GRID) * GRID + x]
            const lf = th[y * GRID + ((x - 1 + GRID) % GRID)]
            const rt = th[y * GRID + ((x + 1) % GRID)]
            const coupling =
              Math.sin(up - c) + Math.sin(dn - c) + Math.sin(lf - c) + Math.sin(rt - c)
            next[i] = c + dt * (om[i] + (K / 4) * coupling)
          }
        }
        phases.current = next
      }

      // paint phase → colour, and accumulate the global order parameter
      const lut = lutRef.current
      let sx = 0
      let sy = 0
      for (let i = 0; i < GRID * GRID; i++) {
        const ph = next[i]
        const deg = (((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)
        const [cr, cg, cb] = lut[Math.min(359, (deg * 360) | 0)]
        const o = i * 4
        img.data[o] = cr
        img.data[o + 1] = cg
        img.data[o + 2] = cb
        img.data[o + 3] = 255
        sx += Math.cos(ph)
        sy += Math.sin(ph)
      }
      octx.putImageData(img, 0, 0)
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height)

      if (playing) setR(Math.hypot(sx, sy) / (GRID * GRID))
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [playing])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>2D coupled-oscillator field · hue = phase</span>
        <span className="tabular-nums">r = {r.toFixed(2)}</span>
      </div>

      <div className="p-4">
        <canvas
          ref={canvasRef}
          className="aspect-square w-full rounded-md"
          aria-label="A grid of coupled oscillators coloured by phase; raising coupling forms travelling spiral waves."
        />

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>coupling strength K</span>
              <span className="text-foreground tabular-nums">{k.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={0.05}
              value={k}
              onChange={(e) => setK(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-foreground"
              aria-label="coupling strength"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
              {playing ? "pause" : "play"}
            </button>
            <button
              type="button"
              onClick={() => reseed("noise")}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded border px-2 py-1 transition-colors hover:text-foreground",
                mode === "noise" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <ArrowsClockwiseIcon size={12} weight="bold" />
              seed: noise
            </button>
            <button
              type="button"
              onClick={() => reseed("spiral")}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors hover:text-foreground",
                mode === "spiral" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              seed: spiral
            </button>

            <label className="ml-auto flex items-center gap-1.5 text-muted-foreground">
              <span className="sr-only">colour palette</span>
              palette
              <select
                value={palette}
                onChange={(e) => setPalette(e.target.value)}
                className="cursor-pointer rounded border bg-background px-2 py-1 font-mono text-xs text-foreground"
                aria-label="colour palette"
              >
                {PALETTES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            From random phase the field is pure speckle (low K). Raise the coupling and
            neighbours fall into step, carving out travelling spiral waves and
            chimera-like domains where order and chaos coexist — the structure Un-0
            decodes into pixels.
          </p>
        </div>
      </div>
    </figure>
  )
}
