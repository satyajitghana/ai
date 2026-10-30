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
  const [hover, setHover] = useState<number | null>(null)
  const rows = Math.ceil(p.meta.neurons / COLS)
  const CELL = 14

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const pal = COLORS[p.theme]
    c.width = COLS * CELL
    c.height = rows * CELL
    ctx.fillStyle = pal.bg
    ctx.fillRect(0, 0, c.width, c.height)
    const lensNow = p.lens
    const peaks = lensNow ? lensNow.actMax.map((_, i) => peakOf(lensNow, i)) : []
    const amax = peaks.length ? Math.max(1, ...peaks) : 1
    const byN = new Map<number, string>()
    for (const s of p.styles) if (s.layer === p.layer) byN.set(s.neuron, s.kind)
    for (let n = 0; n < p.meta.neurons; n++) {
      const x = (n % COLS) * CELL, y = Math.floor(n / COLS) * CELL
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
      ctx.strokeRect((n % COLS) * CELL, Math.floor(n / COLS) * CELL, CELL, CELL)
    }
  }, [p.lens, p.layer, p.selected, p.styles, p.theme, p.meta.neurons, rows])

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * COLS)
    const y = Math.floor(((e.clientY - r.top) / r.height) * rows)
    const n = y * COLS + x
    return x >= 0 && x < COLS && y >= 0 && y < rows && n < p.meta.neurons ? n : null
  }

  const key = (e: React.KeyboardEvent) => {
    const cur = p.selected && p.selected.layer === p.layer ? p.selected.neuron : 0
    const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }
    if (e.key in d) {
      e.preventDefault()
      p.onPick(p.layer, Math.min(p.meta.neurons - 1, Math.max(0, cur + d[e.key])))
    }
  }

  const h = hover != null && p.lens ? hover : null
  return (
    <div className="nl-grid">
      <div style={{ width: "min(100%, 1000px)" }}>
        <div className="nl-note" style={{ marginBottom: 6 }}>
          Layer {p.layer}: every neuron in index order, row by row (N0 at the top left). Brighter = larger peak activation on the reference text.
          {h != null && p.lens ? (
            <span className="nl-mono" style={{ marginLeft: 8, color: "var(--nl-fg)" }}>
              {fmtNeuron(p.layer, h)} · + {p.lens.up[h].slice(0, 3).map(showToken).join(" ")}
            </span>
          ) : null}
        </div>
        <canvas
          ref={ref}
          tabIndex={0}
          role="application"
          aria-label={`Neuron grid for layer ${p.layer}. Use the arrow keys to move between neurons.`}
          style={{ width: "100%", height: "auto" }}
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
