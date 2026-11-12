"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { pointsDensity, ripple, segmentDensity, splitError } from "./segment-math"

// A line of length L drawn two ways in the image plane: one Spaghetti-style
// segment convolved with a Gaussian (density from two error functions), and
// the same mass as K Gaussian points, the way 3DGS has to draw it. The heatmap
// and the centre-line profile are computed live from segment-math.ts.

const L = 10
const COLS = 72
const ROWS = 18
const W = 640
const MAP_H = 170
const PROF_H = 130
const PAD = 16
const X0 = -2.5
const X1 = L + 2.5
const Y_HALF = 2.6

type Mode = "segment" | "points"

export function SegmentKernel() {
  const [mode, setMode] = useState<Mode>("points")
  const [sigma, setSigma] = useState(1)
  const [K, setK] = useState(5)

  const cells = useMemo(() => {
    const out: { x: number; y: number; v: number }[] = []
    let peak = 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = X0 + ((c + 0.5) / COLS) * (X1 - X0)
        const y = -Y_HALF + ((r + 0.5) / ROWS) * (2 * Y_HALF)
        const v = mode === "segment" ? segmentDensity(x, y, 0, L, sigma) : pointsDensity(x, y, L, K, sigma)
        peak = Math.max(peak, v)
        out.push({ x: c, y: r, v })
      }
    }
    return out.map((o) => ({ ...o, v: o.v / peak }))
  }, [mode, sigma, K])

  const profile = useMemo(() => {
    const n = 220
    const seg: [number, number][] = []
    const pts: [number, number][] = []
    let peak = 0
    for (let i = 0; i < n; i++) {
      const x = X0 + (i / (n - 1)) * (X1 - X0)
      const s = segmentDensity(x, 0, 0, L, sigma)
      const p = pointsDensity(x, 0, L, K, sigma)
      peak = Math.max(peak, s, p)
      seg.push([x, s])
      pts.push([x, p])
    }
    return { seg, pts, peak }
  }, [sigma, K])

  const rip = ripple(L, K, sigma)
  const split = splitError(L, sigma)
  const spacing = L / (K - 1) / sigma
  const needed = Math.ceil(L / (2 * sigma)) + 1

  const px = (x: number) => PAD + ((x - X0) / (X1 - X0)) * (W - 2 * PAD)
  const py = (v: number) => MAP_H + 20 + PROF_H - (v / profile.peak) * (PROF_H - 12)
  const path = (pts: [number, number][]) =>
    pts.map(([x, v], i) => `${i ? "L" : "M"}${px(x).toFixed(2)},${py(v).toFixed(2)}`).join(" ")

  const cw = (W - 2 * PAD) / COLS
  const ch = MAP_H / ROWS
  const desc = `A line ${L} kernel-widths long. ${
    mode === "segment" ? "Drawn as one segment convolved with a Gaussian: no ripple." : `Drawn as ${K} Gaussian points: ripple ${rip.toFixed(1)} percent.`
  } Points spaced ${spacing.toFixed(2)} sigma apart.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>a line, as points or as one segment</span>
        <span className="text-muted-foreground/60">density computed live, closed form</span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {(["points", "segment"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              mode === m ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "points" ? `${K} Gaussian points (3DGS)` : "1 segment (Spaghetti)"}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${MAP_H + PROF_H + 34}`} className="h-auto w-full" role="img" aria-label={desc}>
          {cells.map((c) => (
            <rect
              key={`${c.x}-${c.y}`}
              x={PAD + c.x * cw}
              y={c.y * ch}
              width={cw + 0.5}
              height={ch + 0.5}
              fill="oklch(0.6 0.16 255)"
              fillOpacity={Number(c.v.toFixed(3))}
            />
          ))}
          <line x1={px(0)} x2={px(L)} y1={MAP_H / 2} y2={MAP_H / 2} className="stroke-foreground" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          {mode === "points" &&
            Array.from({ length: K }, (_, k) => (
              <circle key={k} cx={px((k * L) / (K - 1))} cy={MAP_H / 2} r={2.2} className="fill-foreground" />
            ))}
          {mode === "segment" && (
            <>
              <circle cx={px(0)} cy={MAP_H / 2} r={2.6} className="fill-foreground" />
              <circle cx={px(L)} cy={MAP_H / 2} r={2.6} className="fill-foreground" />
            </>
          )}
          <text x={PAD} y={MAP_H + 14} className="fill-muted-foreground font-mono" fontSize={10}>
            density along the centre line
          </text>
          <path d={path(profile.seg)} fill="none" stroke="oklch(0.55 0.15 255)" strokeWidth={2} />
          <path d={path(profile.pts)} fill="none" stroke="oklch(0.64 0.17 30)" strokeWidth={1.6} strokeDasharray="5 3" />
          <line x1={PAD} x2={W - PAD} y1={py(0)} y2={py(0)} className="stroke-muted-foreground" strokeWidth={0.5} />
          <g className="font-mono" fontSize={10}>
            <line x1={W - 190} x2={W - 170} y1={MAP_H + 30} y2={MAP_H + 30} stroke="oklch(0.55 0.15 255)" strokeWidth={2} />
            <text x={W - 165} y={MAP_H + 33} className="fill-muted-foreground">
              segment
            </text>
            <line x1={W - 190} x2={W - 170} y1={MAP_H + 44} y2={MAP_H + 44} stroke="oklch(0.64 0.17 30)" strokeWidth={1.6} strokeDasharray="5 3" />
            <text x={W - 165} y={MAP_H + 47} className="fill-muted-foreground">
              {K} points
            </text>
          </g>
        </svg>
      </div>
      <div className="grid gap-3 px-4 pb-2 pt-1 sm:grid-cols-2">
        <label className="block font-mono text-[11px] text-muted-foreground">
          kernel width σ: {sigma.toFixed(2)} (line is {L} units long)
          <Range min={0.4} max={2} step={0.05} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} />
        </label>
        <label className="block font-mono text-[11px] text-muted-foreground">
          Gaussian points K: {K} (spacing {spacing.toFixed(2)}σ)
          <Range min={2} max={16} step={1} value={K} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>
      <figcaption className="grid gap-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
        <span>
          ripple, {K} points: <span className="text-foreground">{rip.toFixed(1)}%</span>
        </span>
        <span>
          points for a smooth line: <span className="text-foreground">≈{needed}</span>
        </span>
        <span>
          split into halves, max change: <span className="text-foreground">{split.toExponential(0)}</span>
        </span>
      </figcaption>
    </figure>
  )
}
