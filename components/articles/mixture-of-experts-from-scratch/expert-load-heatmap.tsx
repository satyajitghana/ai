"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { mlog2 } from "@/lib/dmath"

import { layerCounts, loadRouting, tokensFor, type RoutingData } from "./routing-data"

// Measured expert load in Qwen3-30B-A3B: 48 MoE layers (rows) by 128 experts (columns).
// Each cell is how many of a domain's 8,192 tokens the router sent to that expert, divided
// by what a perfectly even router would send (tokens x 8 / 128). Blue is under-used,
// orange over-used, a red cell is an expert no token in that domain chose. "vs all" colours
// each cell by the domain's share of the expert over the pooled share instead, which is
// where domain specialists show up. Drawn on a canvas after the data loads; nothing here is
// simulated.

const DOMAINS = ["all", "code", "prose", "math", "latex"] as const
const LABEL: Record<string, string> = {
  all: "all four",
  code: "Python code",
  prose: "Wikipedia prose",
  math: "GSM8K word problems",
  latex: "MATH, LaTeX",
}
const UNDER = [59, 130, 246]
const OVER = [234, 88, 12]
const DEAD = "rgb(220, 38, 38)"
const ROW_H = 6

type Hover = { layer: number; expert: number; n: number; ratio: number } | null

function colour(ratio: number): string {
  if (ratio <= 0) return DEAD
  const l = Math.max(-3, Math.min(3, mlog2(ratio)))
  const a = Math.min(1, 0.06 + Math.abs(l) / 3)
  const c = l < 0 ? UNDER : OVER
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`
}

export function ExpertLoadHeatmap() {
  const [data, setData] = useState<RoutingData | null>(null)
  const [err, setErr] = useState(false)
  const [domain, setDomain] = useState<(typeof DOMAINS)[number]>("code")
  const [vsAll, setVsAll] = useState(false)
  const [sorted, setSorted] = useState(false)
  const [hover, setHover] = useState<Hover>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    let live = true
    loadRouting()
      .then((d) => live && setData(d))
      .catch(() => live && setErr(true))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // ratio[layer][column] and the expert id shown in each column
  const grid = useMemo(() => {
    if (!data) return null
    const E = data.experts
    const uni = (tokensFor(data, domain) * data.k) / E
    const rows: { ratio: number[]; ids: number[]; n: number[] }[] = []
    let dead = 0
    let rare = 0
    let worst = 0
    for (let l = 0; l < data.layers; l++) {
      const c = layerCounts(data, domain, l)
      const pooled = layerCounts(data, "all", l)
      const pooledTotal = pooled.reduce((a, b) => a + b, 0)
      const total = c.reduce((a, b) => a + b, 0)
      let ratio = c.map((n) => n / uni)
      if (vsAll && domain !== "all")
        ratio = c.map((n, e) => (pooled[e] === 0 ? 1 : n / total / (pooled[e] / pooledTotal)))
      let ids = Array.from({ length: E }, (_, e) => e)
      if (sorted) ids = ids.sort((a, b) => pooled[b] - pooled[a])
      rows.push({ ratio: ids.map((e) => ratio[e]), ids, n: ids.map((e) => c[e]) })
      for (const n of c) {
        if (n === 0) dead++
        else if (n < 0.25 * uni) rare++
      }
      worst = Math.max(worst, Math.max(...c) / uni)
    }
    return { rows, dead, rare, worst, uni }
  }, [data, domain, vsAll, sorted])

  useEffect(() => {
    const cv = canvas.current
    if (!cv || !grid || !data || width === 0) return
    const dpr = window.devicePixelRatio || 1
    const W = width
    const H = data.layers * ROW_H
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    cv.style.width = `${W}px`
    cv.style.height = `${H}px`
    const ctx = cv.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const cw = W / data.experts
    grid.rows.forEach((row, l) => {
      row.ratio.forEach((r, j) => {
        ctx.fillStyle = colour(r)
        ctx.fillRect(j * cw, l * ROW_H, Math.max(cw - 0.5, 0.5), ROW_H - 0.5)
      })
    })
    if (hover) {
      const j = grid.rows[hover.layer].ids.indexOf(hover.expert)
      ctx.strokeStyle = "rgba(127,127,127,0.9)"
      ctx.lineWidth = 1
      ctx.strokeRect(j * cw - 0.5, hover.layer * ROW_H - 0.5, cw + 1, ROW_H + 1)
    }
  }, [grid, data, width, hover])

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!grid || !data) return
    const r = e.currentTarget.getBoundingClientRect()
    const j = Math.floor(((e.clientX - r.left) / r.width) * data.experts)
    const l = Math.floor((e.clientY - r.top) / ROW_H)
    if (j < 0 || j >= data.experts || l < 0 || l >= data.layers) return setHover(null)
    const row = grid.rows[l]
    setHover({ layer: l, expert: row.ids[j], n: row.n[j], ratio: row.ratio[j] })
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">Qwen3-30B-A3B · measured expert load</span>
        <div className="flex flex-wrap gap-1">
          {DOMAINS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDomain(d)}
              aria-pressed={domain === d}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                domain === d ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={vsAll} disabled={domain === "all"} onChange={(e) => setVsAll(e.target.checked)} />
          colour by share vs all domains
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} />
          sort experts by pooled load, per layer
        </label>
      </div>

      <div className="px-4 py-3">
        <div className="flex gap-2">
          <div className="flex w-6 shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[9px] text-muted-foreground">
            <span>L0</span>
            <span>L47</span>
          </div>
          <div ref={box} className="relative min-w-0 flex-1" style={{ minHeight: 48 * ROW_H }}>
            {data ? (
              <canvas
                ref={canvas}
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
                className="block cursor-crosshair touch-none"
                role="img"
                aria-label={`Heatmap of how often each of 128 experts was chosen at each of 48 layers of Qwen3-30B-A3B, for ${LABEL[domain]}.`}
              />
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground" style={{ height: 48 * ROW_H }}>
                {err ? "routing data failed to load" : "loading measured routing counts"}
              </div>
            )}
          </div>
        </div>
        <div className="mt-1 flex justify-between pl-8 font-mono text-[9px] text-muted-foreground">
          <span>{sorted ? "busiest expert" : "expert 0"}</span>
          <span>{sorted ? "quietest" : "expert 127"}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DEAD }} /> never chosen
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colour(0.125) }} /> ⅛×
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: colour(1) }} /> even share
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colour(8) }} /> 8×
          </span>
        </div>

        <div className="mt-2 min-h-[1.25rem] font-mono text-[11px]">
          {hover ? (
            <span>
              layer <b>{hover.layer}</b> · expert <b>{hover.expert}</b> · {hover.n.toLocaleString("en-US")} tokens ·{" "}
              <b>{hover.ratio.toFixed(2)}×</b> {vsAll && domain !== "all" ? "its pooled share" : "an even share"}
            </span>
          ) : grid ? (
            <span className="text-muted-foreground">
              {LABEL[domain]}: {grid.dead.toLocaleString("en-US")} of {(48 * 128).toLocaleString("en-US")} layer-expert cells never chosen,{" "}
              {grid.rare.toLocaleString("en-US")} under a quarter of an even share; busiest cell {grid.worst.toFixed(1)}× even
            </span>
          ) : null}
        </div>
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        Each domain is 8,192 tokens in eight 1,024-token windows, read through llama.cpp&apos;s eval callback on an RTX 3090.
        Pick a single domain and the red cells appear: experts that text never reaches. Pool all four and most of them
        fill in, which is what a load-balancing loss computed over a large, mixed batch asks for.
      </p>
    </figure>
  )
}
