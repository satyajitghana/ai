"use client"

import { useEffect, useRef, useState } from "react"

import type { LayerLens, ModelMeta } from "./types"
import { fmtNeuron, peakOf } from "./types"
import { showToken } from "./data"
import type { Style } from "./scene"

const COLS = 64

const COLORS = {
  dark: { bg: "#0d1117", dot: [150, 170, 200], match: [255, 176, 74], match2: [255, 116, 181], up: [255, 176, 74], down: [182, 156, 255], sel: [255, 255, 255], fed: [255, 116, 181], feeds: [107, 217, 255] },
  light: { bg: "#ffffff", dot: [70, 85, 120], match: [200, 100, 0], match2: [196, 24, 95], up: [200, 100, 0], down: [106, 63, 214], sel: [10, 10, 20], fed: [196, 24, 95], feeds: [0, 111, 156] },
}

export function NeuronGrid(p: {
  meta: ModelMeta
  lens: LayerLens | undefined
  layer: number
  selected: { layer: number; neuron: number } | null
  styles: Style[]
  theme: "dark" | "light"
  onPick: (layer: number, neuron: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [zoom, setZoom] = useState<"fit" | "m" | "l">("fit")
  const rows = Math.ceil(p.meta.neurons / COLS)
  const CELL = 14
  // gutters for the index labels, in canvas pixels
  const LEFT = 44
  const TOP = 18
  const W = LEFT + COLS * CELL
  const H = TOP + rows * CELL
  const cssScale = zoom === "fit" ? null : zoom === "m" ? 1.5 : 2.2

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const pal = COLORS[p.theme]
    const dpr = Math.min(2, window.devicePixelRatio || 1) * (cssScale ?? 1)
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = pal.bg
    ctx.fillRect(0, 0, W, H)
    // index labels: column every 8, row start index every 4 rows
    ctx.fillStyle = `rgba(${pal.dot[0]},${pal.dot[1]},${pal.dot[2]},0.9)`
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace"
    ctx.textBaseline = "middle"
    ctx.textAlign = "center"
    for (let x = 0; x < COLS; x += 8) ctx.fillText(String(x), LEFT + x * CELL + CELL / 2, TOP / 2)
    ctx.textAlign = "right"
    for (let y = 0; y < rows; y += 4) ctx.fillText(`N${y * COLS}`, LEFT - 6, TOP + y * CELL + CELL / 2)
    const lensNow = p.lens
    const peaks = lensNow ? lensNow.actMax.map((_, i) => peakOf(lensNow, i)) : []
    const amax = peaks.length ? Math.max(1, ...peaks) : 1
    const byN = new Map<number, string>()
    for (const s of p.styles) if (s.layer === p.layer) byN.set(s.neuron, s.kind)
    for (let n = 0; n < p.meta.neurons; n++) {
      const x = LEFT + (n % COLS) * CELL, y = TOP + Math.floor(n / COLS) * CELL
      const a = peaks.length ? Math.min(1, Math.log1p(peaks[n]) / Math.log1p(amax)) : 0.2
      const k = byN.get(n) as keyof typeof pal | undefined
      let rgb = pal.dot
      let alpha = 0.1 + 0.55 * a * a
      if (k && k in pal && k !== "bg") {
        rgb = pal[k] as number[]
        alpha = 1
      }
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
    }
    if (p.selected && p.selected.layer === p.layer) {
      const n = p.selected.neuron
      ctx.strokeStyle = `rgb(${pal.sel.join(",")})`
      ctx.lineWidth = 2
      const sx = LEFT + (n % COLS) * CELL, sy = TOP + Math.floor(n / COLS) * CELL
      ctx.strokeRect(sx, sy, CELL, CELL)
      // crosshair guides along the row and column, so the cell is easy to spot
      ctx.globalAlpha = 0.35
      ctx.fillStyle = `rgb(${pal.sel.join(",")})`
      ctx.fillRect(LEFT, sy + CELL / 2 - 0.5, COLS * CELL, 1)
      ctx.fillRect(sx + CELL / 2 - 0.5, TOP, 1, rows * CELL)
      ctx.globalAlpha = 1
    }
  }, [p.lens, p.layer, p.selected, p.styles, p.theme, p.meta.neurons, rows, W, H, cssScale])

  // keep the selected neuron in view when it changes or the zoom changes
  useEffect(() => {
    const el = scroller.current
    const c = ref.current
    if (!el || !c || !p.selected || p.selected.layer !== p.layer) return
    const k = c.getBoundingClientRect().width / W
    const n = p.selected.neuron
    const cx = (LEFT + (n % COLS) * CELL + CELL / 2) * k
    const cy = (TOP + Math.floor(n / COLS) * CELL + CELL / 2) * k
    const left = c.offsetLeft + cx - el.clientWidth / 2
    const top = c.offsetTop + cy - el.clientHeight / 2
    el.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: "smooth" })
  }, [p.selected, p.layer, zoom, W])

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const py = ((e.clientY - r.top) / r.height) * H
    const x = Math.floor((px - LEFT) / CELL)
    const y = Math.floor((py - TOP) / CELL)
    const n = y * COLS + x
    return x >= 0 && x < COLS && y >= 0 && y < rows && n < p.meta.neurons ? n : null
  }

  const key = (e: React.KeyboardEvent) => {
    const cur = p.selected && p.selected.layer === p.layer ? p.selected.neuron : 0
    const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS, Home: -cur, End: p.meta.neurons - 1 - cur }
    if (e.key in d) {
      e.preventDefault()
      p.onPick(p.layer, Math.min(p.meta.neurons - 1, Math.max(0, cur + d[e.key])))
    }
  }

  const h = hover != null && p.lens ? hover : null
  return (
    <div className="nl-grid" ref={scroller} data-zoom={zoom}>
      <div className="nl-grid-inner" style={cssScale ? { width: W * cssScale } : undefined}>
        <div className="nl-grid-bar">
          <span className="nl-note">
            Layer {p.layer}: neurons in index order, {COLS} per row (N0 top left). Brighter = larger peak activation.
          </span>
          <span className="nl-note nl-mono nl-grid-hover">
            {h != null && p.lens ? `${fmtNeuron(p.layer, h)} · row ${Math.floor(h / COLS)} col ${h % COLS} · + ${p.lens.up[h].slice(0, 3).map(showToken).join(" ")}` : " "}
          </span>
          <div className="nl-seg" role="group" aria-label="Cell size">
            {(["fit", "m", "l"] as const).map((z) => (
              <button key={z} aria-pressed={zoom === z} onClick={() => setZoom(z)} title={z === "fit" ? "Fit the layer to the screen" : z === "m" ? "Bigger cells" : "Biggest cells"}>
                {z === "fit" ? "fit" : z === "m" ? "1.5×" : "2.2×"}
              </button>
            ))}
          </div>
        </div>
        <canvas
          ref={ref}
          tabIndex={0}
          role="application"
          aria-label={`Neuron grid for layer ${p.layer}. Use the arrow keys to move between neurons.`}
          style={{ width: "100%", height: "auto", aspectRatio: `${W} / ${H}` }}
          onPointerMove={(e) => setHover(at(e))}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => {
            const n = at(e)
            if (n != null) p.onPick(p.layer, n)
          }}
          onKeyDown={key}
        />
      </div>
    </div>
  )
}
