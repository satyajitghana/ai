"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { DARK, LIGHT, NeuronScene, type EdgeLine, type Style } from "./scene"
import type { LayerLens, ModelMeta } from "./types"
import { showToken } from "./data"
import { fmtNeuron, peakOf } from "./types"

export interface MapProps {
  meta: ModelMeta
  layers: Map<number, LayerLens>
  version: number
  selected: { layer: number; neuron: number } | null
  layer: number
  styles: Style[]
  edges: EdgeLine[]
  theme: "dark" | "light"
  reducedMotion: boolean
  onPick: (layer: number, neuron: number) => void
  onUnsupported: (why: string) => void
  resetKey: number
}

const COLS = 64
const ROWS = 48

export function NeuronMap(p: MapProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const labelHost = useRef<HTMLDivElement>(null)
  const scene = useRef<NeuronScene | null>(null)
  const labels = useRef<HTMLDivElement[]>([])
  const ring = useRef<HTMLDivElement>(null)
  const selRef = useRef(p.selected)
  const layerRef = useRef(p.layer)
  const topSeen = useRef(new Set<number>())
  const [tip, setTip] = useState<{ layer: number; neuron: number; x: number; y: number } | null>(null)
  const [width, setWidth] = useState(600)
  const pickRef = useRef(p.onPick)
  useEffect(() => {
    pickRef.current = p.onPick
    layerRef.current = p.layer
    selRef.current = p.selected
  })

  const updateLabels = useCallback(() => {
    const s = scene.current
    if (!s) return
    labels.current.forEach((el, l) => {
      const pos = s.layerLabelAt(l)
      const show = pos.visible && (l === layerRef.current || l % 4 === 0 || l === p.meta.layers - 1)
      el.style.display = show ? "block" : "none"
      el.dataset.sel = String(l === layerRef.current)
      if (show) el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-100%, -100%)`
    })
    const r = ring.current
    const sel = selRef.current
    if (r) {
      const pos = sel ? s.project(sel.layer, sel.neuron) : null
      r.style.display = pos?.visible ? "block" : "none"
      if (pos?.visible) r.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`
    }
  }, [p.meta.layers])

  // create the scene once
  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    let s: NeuronScene
    try {
      s = new NeuronScene(c, {
        layers: p.meta.layers,
        neurons: p.meta.neurons,
        cols: COLS,
        rows: ROWS,
        reducedMotion: p.reducedMotion,
        onPick: (l, n) => pickRef.current(l, n),
        onHover: (h) => setTip(h),
        onCamera: updateLabels,
      })
    } catch (e) {
      console.warn("neuron map: scene setup failed", e)
      p.onUnsupported(e instanceof Error ? e.message : "WebGL unavailable")
      return
    }
    scene.current = s
    s.setPalette(p.theme === "light" ? LIGHT : DARK)
    s.setLayer(p.layer, false)
    const fit = () => {
      const r = w.getBoundingClientRect()
      setWidth(r.width)
      s.resize(r.width, r.height, Math.min(2, window.devicePixelRatio || 1))
      updateLabels()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(w)
    fit()
    const host = labelHost.current
    if (host) {
      host.innerHTML = ""
      labels.current = Array.from({ length: p.meta.layers }, (_, l) => {
        const el = document.createElement("div")
        el.className = "nl-layerlabel nl-mono"
        el.textContent = `L${l}`
        host.appendChild(el)
        return el
      })
    }
    updateLabels()
    return () => {
      ro.disconnect()
      s.destroy()
      scene.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.meta.layers, p.meta.neurons])

  useEffect(() => {
    scene.current?.setPalette(p.theme === "light" ? LIGHT : DARK)
  }, [p.theme])

  // newly arrived layers brighten their strongest neurons
  useEffect(() => {
    const s = scene.current
    if (!s) return
    for (const [l, lens] of p.layers) {
      if (!topSeen.current.has(l)) {
        topSeen.current.add(l)
        s.setLayerTop(l, lens.actMax.map((_, i) => peakOf(lens, i)))
      }
    }
  }, [p.version, p.layers])

  useEffect(() => {
    const s = scene.current
    if (!s) return
    s.setLayer(p.layer, true)
    updateLabels()
  }, [p.layer, updateLabels])

  useEffect(() => {
    scene.current?.setSelected(p.selected, true)
    updateLabels()
  }, [p.selected, updateLabels])

  useEffect(() => {
    scene.current?.setStyles(p.styles)
  }, [p.styles])

  useEffect(() => {
    scene.current?.setEdges(p.edges)
  }, [p.edges, p.theme])

  useEffect(() => {
    if (p.resetKey) scene.current?.resetView()
  }, [p.resetKey])

  const t = tip && p.layers.get(tip.layer)
  return (
    <div ref={wrap} className="nl-centre-inner" style={{ position: "absolute", inset: 0 }}>
      <canvas
        ref={canvas}
        tabIndex={0}
        role="application"
        aria-label="Map of every neuron in the model: drag to orbit, scroll to zoom, click a neuron to select it. The grid view and the list on the left do the same job with the keyboard."
      />
      <div ref={labelHost} className="nl-labels" aria-hidden />
      <div ref={ring} className="nl-ring" aria-hidden />
      {tip && t ? (
        <div
          className="nl-tip"
          style={{ left: Math.max(8, Math.min(tip.x + 14, width - 290)), top: Math.max(8, tip.y - 8) }}
        >
          <div className="nl-mono">{fmtNeuron(tip.layer, tip.neuron)}</div>
          <div style={{ color: "var(--nl-amber)" }}>+ {t.up[tip.neuron].slice(0, 4).map(showToken).join("  ")}</div>
          <div style={{ color: "var(--nl-violet)" }}>{"−"} {t.down[tip.neuron].slice(0, 4).map(showToken).join("  ")}</div>
        </div>
      ) : null}
    </div>
  )
}
