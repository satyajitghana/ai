"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

import { MIP_SHAPES } from "./data"

// Proposition 3 of the GOFish paper, evaluated live. A Gaussian with axis scales (a, b, c) is viewed along a ray in
// the plane of the first two axes, at angle alpha from the first. Work in pixels at the Gaussian's depth, so the
// pixel Jacobian is an orthographic projection and J+ J+^T = (I - d d^T) / 1. With gamma = 0.3 px^2:
//   m = sqrt(det(J S J^T) / det(J S J^T + gamma I))        the paper's opacity factor (Eq. 4)
//   V = sqrt(det S / det C),  C = S + gamma (I - d d^T)     Mip-Splatting's 3D volume ratio
// V / m <= 1, with equality only when the ray is a principal axis of S. All of it is +, -, *, / and sqrt.

const GAMMA = 0.3

type Shape = { id: string; label: string; ratio: [number, number, number]; median: number }
const SHAPES: Shape[] = [
  { id: "round", label: "round (1, 1, 1)", ratio: [1, 1, 1], median: MIP_SHAPES[0].median },
  { id: "rod", label: "rod (1, 0.1, 0.1)", ratio: [1, 0.1, 0.1], median: MIP_SHAPES[1].median },
  { id: "surfel", label: "surfel (1, 1, 0.03)", ratio: [1, 1, 0.03], median: MIP_SHAPES[2].median },
]

export function MipFactor() {
  const [shapeId, setShapeId] = useState("surfel")
  const [alpha, setAlpha] = useState(30)
  const [px, setPx] = useState(1.5)
  const shape = SHAPES.find((s) => s.id === shapeId) ?? SHAPES[0]
  const al = (alpha * 3.141592653589793) / 180
  const sa = msin(al)
  const ca = mcos(al)
  const [a2, b2, c2] = shape.ratio.map((r) => (r * px) * (r * px))
  const p1 = a2 * sa * sa + b2 * ca * ca
  const p2 = c2
  const m = Math.sqrt((p1 * p2) / ((p1 + GAMMA) * (p2 + GAMMA)))
  const detS = a2 * b2 * c2
  const detC = (a2 * b2 + GAMMA * (a2 * ca * ca + b2 * sa * sa)) * (c2 + GAMMA)
  const v = Math.sqrt(detS / detC)
  const ratio = v / m

  const bar = (x: number, label: string, color: string) => (
    <div className="mt-2">
      <div className="flex justify-between font-mono text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span>{x.toFixed(3)}</span>
      </div>
      <div className="mt-1 h-2 rounded bg-muted">
        <div className="h-2 rounded" style={{ width: `${Math.max(1, Math.min(100, x * 100))}%`, background: color }} />
      </div>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">opacity factor under a 0.3 px² footprint · computed from the paper&apos;s formulas</span>
        <select aria-label="Gaussian shape" value={shapeId} onChange={(e) => setShapeId(e.target.value)} className="rounded-md border bg-background px-2 py-1 font-mono text-xs">
          {SHAPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="p-3 sm:p-4">
        <label className="flex items-center gap-3 font-mono text-xs">
          <span className="w-44 shrink-0 text-muted-foreground">ray vs. long axis</span>
          <Range min={0} max={90} step={1} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} aria-label="Angle between the viewing ray and the Gaussian's first axis, in degrees" />
          <span className="w-10 text-right">{alpha}°</span>
        </label>
        <label className="mt-2 flex items-center gap-3 font-mono text-xs">
          <span className="w-44 shrink-0 text-muted-foreground">largest σ in the image</span>
          <Range min={0.5} max={3} step={0.1} value={px} onChange={(e) => setPx(Number(e.target.value))} aria-label="Largest axis standard deviation in pixels" accent="oklch(0.6 0.15 255)" />
          <span className="w-10 text-right">{px.toFixed(1)}px</span>
        </label>
        {bar(m, "m, the paper's factor (image integral preserved)", "oklch(0.62 0.16 35)")}
        {bar(v, "V, Mip-Splatting's 3D volume ratio", "oklch(0.60 0.15 255)")}
        <p className="mt-3 text-sm">
          V / m = <span className="font-mono">{ratio.toFixed(3)}</span>.{" "}
          {ratio > 0.995
            ? "Here the two rules agree."
            : `Using V would draw this Gaussian at ${(ratio * 100).toFixed(0)}% of the opacity the footprint calls for.`}
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          over 3,000 random views of each shape (projected σ 0.5 to 3 px), the median V / m was {MIP_SHAPES[0].median.toFixed(2)} for round,{" "}
          {MIP_SHAPES[1].median.toFixed(2)} for rods and {MIP_SHAPES[2].median.toFixed(2)} for surfels
        </p>
      </div>
    </figure>
  )
}
