"use client"

// Cut and fill between two epochs of a synthetic 40 m x 30 m site, computed the
// way KOLC+ says it computes earthwork: the point-height (one-point) method of
// MLIT's quantity rules, one elevation difference per grid node times the node's
// cell area. Epoch 2 is epoch 1 with a pit dug and a stockpile dumped. The
// sliders add what a real two-epoch splat comparison adds: a vertical datum
// offset (registration dz), a tilt about the site centre, and floaters (isolated
// spikes from semi-transparent Gaussians that a depth probe hits). Everything is
// SYNTHETIC and deterministic: no number here is a measurement of KOLC+ or of
// any capture. SSR-safe: plain state, no effects, transcendental maths through
// lib/dmath so server and client serialise identical SVG. The ground itself
// cancels in the difference, so only the change (pit, mound) and the errors
// are modelled.

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mtan } from "@/lib/dmath"

const W = 40 // metres, x
const H = 30 // metres, y

function pit(x: number, y: number): number {
  const d = (x - 12) * (x - 12) + (y - 15) * (y - 15)
  return -2.0 * mexp(-d / (2 * 16))
}

function mound(x: number, y: number): number {
  const d = (x - 30) * (x - 30) + (y - 12) * (y - 12)
  return 1.5 * mexp(-d / (2 * 12.25))
}

// Integer hash -> [0, 1): deterministic "random" floater placement.
function hash(i: number, j: number): number {
  let h = (i * 73856093) ^ (j * 19349663)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

type Result = {
  cut: number
  fill: number
  nodes: number
  area: number
  grid: number[][] // displayed dh at 1 m, epoch2 measured - epoch1
}

function compute(step: number, dz: number, tiltDeg: number, floaters: boolean, median: boolean): Result {
  const nx = Math.round(W / step) + 1
  const ny = Math.round(H / step) + 1
  const slope = mtan((tiltDeg * Math.PI) / 180)
  // dh at every node, as measured
  const dh: number[][] = []
  for (let j = 0; j < ny; j++) {
    const row: number[] = []
    for (let i = 0; i < nx; i++) {
      const x = i * step
      const y = j * step
      let d = pit(x, y) + mound(x, y) // true change
      d += dz + (x - W / 2) * slope // registration error on epoch 2
      if (floaters && hash(i, j) < 0.03) d += 0.4 + 0.8 * hash(j + 7, i + 3)
      row.push(d)
    }
    dh.push(row)
  }
  let use = dh
  if (median) {
    use = dh.map((row, j) =>
      row.map((_, i) => {
        const v: number[] = []
        for (let b = -1; b <= 1; b++)
          for (let a = -1; a <= 1; a++) {
            const jj = j + b
            const ii = i + a
            if (jj >= 0 && jj < ny && ii >= 0 && ii < nx) v.push(dh[jj][ii])
          }
        v.sort((p, q) => p - q)
        return v[Math.floor(v.length / 2)]
      }),
    )
  }
  const cellA = step * step
  let cut = 0
  let fill = 0
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      // edge nodes carry half a cell, corners a quarter: the grid covers W x H exactly
      const wx = i === 0 || i === nx - 1 ? 0.5 : 1
      const wy = j === 0 || j === ny - 1 ? 0.5 : 1
      const v = use[j][i] * cellA * wx * wy
      if (v > 0) fill += v
      else cut -= v
    }
  // display grid at 1 m from the used field
  const grid: number[][] = []
  for (let j = 0; j < H; j++) {
    const row: number[] = []
    for (let i = 0; i < W; i++) {
      const jj = Math.min(ny - 1, Math.round((j + 0.5) / step))
      const ii = Math.min(nx - 1, Math.round((i + 0.5) / step))
      row.push(use[jj][ii])
    }
    grid.push(row)
  }
  return { cut, fill, nodes: nx * ny, area: W * H, grid }
}

const STEPS = [0.5, 1, 2]

function colour(d: number): string {
  const t = Math.max(-1, Math.min(1, d / 1.5))
  if (Math.abs(t) < 0.02) return "var(--cf-zero)"
  const a = Math.round(Math.abs(t) * 100) / 100
  return t > 0 ? `rgba(220, 70, 50, ${a})` : `rgba(40, 110, 220, ${a})`
}

const f1 = (v: number) => v.toFixed(1)

export function CutFill() {
  const [stepI, setStepI] = useState(0)
  const [dzCm, setDzCm] = useState(0)
  const [tiltC, setTiltC] = useState(0) // hundredths of a degree
  const [floaters, setFloaters] = useState(false)
  const [median, setMedian] = useState(false)

  const step = STEPS[stepI]
  const truth = useMemo(() => compute(step, 0, 0, false, false), [step])
  const meas = useMemo(
    () => compute(step, dzCm / 100, tiltC / 100, floaters, median),
    [step, dzCm, tiltC, floaters, median],
  )
  const net = meas.fill - meas.cut
  const netTrue = truth.fill - truth.cut
  const cell = 10

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      style={{ ["--cf-zero" as string]: "color-mix(in oklch, currentColor 6%, transparent)" }}
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>two-epoch cut and fill, point-height method</span>
        <span className="text-muted-foreground/60">synthetic site</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_15rem] sm:p-5">
        <div>
          <svg viewBox={`0 0 ${W * cell} ${H * cell}`} className="w-full rounded-md border" role="img"
            aria-label="Height change per grid cell between the two epochs: blue is cut, red is fill.">
            {meas.grid.map((row, j) =>
              row.map((d, i) => (
                <rect key={`${i}-${j}`} x={i * cell} y={j * cell} width={cell} height={cell} fill={colour(d)} />
              )),
            )}
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span><span style={{ color: "rgb(40,110,220)" }}>■</span> cut (lower in epoch 2)</span>
            <span>40 m x 30 m</span>
            <span><span style={{ color: "rgb(220,70,50)" }}>■</span> fill (higher)</span>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">grid width: {step} m ({meas.nodes} nodes)</span>
            <Range min={0} max={2} step={1} value={stepI} onChange={(e) => setStepI(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">vertical offset dz: {dzCm} cm</span>
            <Range min={-10} max={10} step={1} value={dzCm} onChange={(e) => setDzCm(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">tilt about centre: {(tiltC / 100).toFixed(2)}°</span>
            <Range min={-20} max={20} step={1} value={tiltC} onChange={(e) => setTiltC(Number(e.target.value))} className="w-full" />
          </label>
          <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <input type="checkbox" checked={floaters} onChange={(e) => setFloaters(e.target.checked)} /> floaters on 3% of nodes
          </label>
          <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <input type="checkbox" checked={median} onChange={(e) => setMedian(e.target.checked)} /> 3x3 median
          </label>
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-normal">m³</th>
                <th className="text-right font-normal">truth</th>
                <th className="text-right font-normal">measured</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>cut</td><td className="text-right">{f1(truth.cut)}</td><td className="text-right">{f1(meas.cut)}</td></tr>
              <tr><td>fill</td><td className="text-right">{f1(truth.fill)}</td><td className="text-right">{f1(meas.fill)}</td></tr>
              <tr><td>net</td><td className="text-right">{f1(netTrue)}</td><td className="text-right">{f1(net)}</td></tr>
              <tr className="text-muted-foreground"><td>net error</td><td /><td className="text-right">{f1(net - netTrue)}</td></tr>
            </tbody>
          </table>
          <p className="text-xs leading-snug text-muted-foreground">
            A dz of {dzCm} cm over {meas.area} m² is {f1((dzCm / 100) * meas.area)} m³ of net error by itself. Tilt about the centre nets to
            zero but still inflates cut and fill separately.
          </p>
        </div>
      </div>
    </figure>
  )
}
