"use client"

// Equal-count lattices of squares, hexagons and equilateral triangles over three 128 x 128 test images, each
// cell fitted by least squares with a constant colour or an affine colour field, no optimiser involved
// (public/articles/hexels/code/tilings.py). Lattice scale is bisected so every shape has the same number of
// non-empty cells; "best rotation" lets each shape pick the best of ten lattice angles per image and count.
// MEASURED, on synthetic images, with geometry implicit in the lattice (not stored).

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

import { TILINGS, type Pt } from "./data"

const IMAGES = ["poster", "shaded", "texture"] as const
const VARIANTS = ["axis-aligned", "best-rotation"] as const
const SHAPES = [
  { id: "square", label: "Square", color: "#5b8def" },
  { id: "hexagon", label: "Hexagon", color: "#e0a02f" },
  { id: "triangle", label: "Triangle", color: "#43b97f" },
] as const
const W = 380
const H = 210
const PAD = { l: 34, r: 8, t: 10, b: 28 }

const label = (s: string) => s.replace("-", " ")

export function TilingLab() {
  const [image, setImage] = useState<(typeof IMAGES)[number]>("poster")
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]>("axis-aligned")
  const [xAxis, setXAxis] = useState<"cells" | "params">("cells")
  const [pick, setPick] = useState(3)

  const series = SHAPES.flatMap((s) =>
    (["const", "affine"] as const).map((m) => ({ shape: s, model: m, pts: TILINGS[image][variant][s.id][m] as Pt[] })),
  )
  const xi = xAxis === "cells" ? 0 : 1
  const all = series.flatMap((s) => s.pts)
  const xs = all.map((p) => mlog10(p[xi]))
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const ys = all.map((p) => p[2])
  const y0 = Math.floor(Math.min(...ys) - 0.5)
  const y1 = Math.ceil(Math.max(...ys) + 0.5)
  const X = (v: number) => PAD.l + ((mlog10(v) - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
  const Y = (v: number) => PAD.t + ((y1 - v) / (y1 - y0)) * (H - PAD.t - PAD.b)
  const ticks = xAxis === "cells" ? [8, 16, 32, 64, 128, 256, 512] : [24, 96, 384, 1536, 4608]
  const yTicks = Array.from({ length: Math.floor((y1 - y0) / 2) + 1 }, (_, i) => y0 + i * 2)
  const at = (shape: string, model: "const" | "affine") => TILINGS[image][variant][shape][model][pick]
  const targets = [8, 16, 32, 64, 128, 256, 512]

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4" role="group" aria-label="Measured: PSNR of equal-count square, hexagon and triangle tilings with constant or affine colour">
      <div className="flex flex-wrap gap-2 text-sm">
        {IMAGES.map((i) => (
          <button key={i} type="button" onClick={() => setImage(i)} aria-pressed={image === i} className={`rounded-md border px-2.5 py-1 ${image === i ? "border-primary bg-primary/10" : "border-border"}`}>
            {i}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {VARIANTS.map((v) => (
          <button key={v} type="button" onClick={() => setVariant(v)} aria-pressed={variant === v} className={`rounded-md border px-2.5 py-1 ${variant === v ? "border-primary bg-primary/10" : "border-border"}`}>
            {label(v)}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {(["cells", "params"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setXAxis(v)} aria-pressed={xAxis === v} className={`rounded-md border px-2.5 py-1 ${xAxis === v ? "border-primary bg-primary/10" : "border-border"}`}>
            x: {v}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`PSNR against ${xAxis} for six tilings of the ${image} image`}>
        {yTicks.map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
            <text x={PAD.l - 4} y={Y(g) + 3} textAnchor="end" className="fill-current text-[8px]">
              {g}
            </text>
          </g>
        ))}
        {ticks.map((g) => (
          <text key={g} x={X(g)} y={H - 12} textAnchor="middle" className="fill-current text-[8px]">
            {g}
          </text>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 1} textAnchor="middle" className="fill-current text-[8px]">
          {xAxis === "cells" ? "cells (log scale)" : "stored colour scalars (log scale)"}
        </text>
        {series.map((s) => (
          <polyline
            key={`${s.shape.id}-${s.model}`}
            fill="none"
            stroke={s.shape.color}
            strokeWidth={s.model === "affine" ? 1.8 : 1.4}
            strokeDasharray={s.model === "const" ? "4 3" : undefined}
            points={s.pts.map((p) => `${X(p[xi]).toFixed(1)},${Y(p[2]).toFixed(1)}`).join(" ")}
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SHAPES.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-5" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span>solid: affine colour, dashed: constant colour</span>
      </div>
      <div className="mt-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span>Read the table at</span>
          {targets.map((t, i) => (
            <button key={t} type="button" onClick={() => setPick(i)} aria-pressed={pick === i} className={`rounded-md border px-2 py-0.5 font-mono text-xs ${pick === i ? "border-primary bg-primary/10" : "border-border"}`}>
              {t} cells
            </button>
          ))}
        </div>
        <table className="mt-2 w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">shape</th>
              <th className="py-1 text-right font-normal">constant (dB)</th>
              <th className="py-1 text-right font-normal">affine (dB)</th>
              <th className="py-1 text-right font-normal">gain</th>
            </tr>
          </thead>
          <tbody>
            {SHAPES.map((s) => {
              const c = at(s.id, "const")
              const a = at(s.id, "affine")
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1">
                    {s.label} <span className="text-xs text-muted-foreground">({c[0]} cells)</span>
                  </td>
                  <td className="py-1 text-right font-mono">{c[2].toFixed(2)}</td>
                  <td className="py-1 text-right font-mono">{a[2].toFixed(2)}</td>
                  <td className="py-1 text-right font-mono">+{(a[2] - c[2]).toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Measured on synthetic 128 × 128 images (flat poster, smooth-shaded poster, high-frequency texture). No optimiser: each cell is a least-squares fit on a fixed lattice, so cell geometry is free here, unlike a
        primitive that stores its own position and scales. Constant colour is 3 numbers per cell and affine is 9.
      </figcaption>
    </figure>
  )
}
