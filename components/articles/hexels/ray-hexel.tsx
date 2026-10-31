"use client"

// Side view of one hexel (a segment) seen by a pinhole camera at the origin looking along +z.
// The hexel's plane passes through p = (0, z0) with tangent t = (cos phi, sin phi); a point on it is
// p + u s t. A pixel at image coordinate x defines the ray lambda * (x, 1). Solving the intersection
// exactly (this is the perspective-correct ray-plane intersection both 2DGS and the Hexel rasteriser use,
// paper Appendix B, Eq. 16-17) gives
//     u_exact(x)  = x z0 / (s (cos phi - x sin phi)).
// A primitive that is projected with a first-order (affine) approximation at its centre, as 3DGS does for
// a Gaussian, replaces the denominator by its value at the centre ray (x = 0):
//     u_affine(x) = x z0 / (s cos phi).
// The two agree at the centre and drift apart as the plane tilts (phi grows) or the primitive is large
// relative to its distance (s / z0 grows). Illustrative geometry; the formulas are exact.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

const DEG = Math.PI / 180

export function RayHexel() {
  const [tilt, setTilt] = useState(55)
  const [size, setSize] = useState(0.35)
  const z0 = 1
  const phi = tilt * DEG
  const c = mcos(phi)
  const sn = msin(phi)
  const s = size

  // plane end points in the (x, z) side view
  const ends = [-1, 1].map((e) => ({ x: e * s * c, z: z0 + e * s * sn }))
  // image x of the two ends (x_img = X / Z), these bound the pixels that see the hexel
  const xs = ends.map((e) => e.x / e.z)
  const xLo = Math.min(xs[0], xs[1])
  const xHi = Math.max(xs[0], xs[1])
  const samples = Array.from({ length: 9 }, (_, i) => xLo + ((i + 0.5) / 9) * (xHi - xLo))
  const uExact = (x: number) => (x * z0) / (s * (c - x * sn))
  const uAff = (x: number) => (x * z0) / (s * c)
  const rows = samples.map((x) => ({ x, ue: uExact(x), ua: uAff(x) }))
  const maxErr = Math.max(...rows.map((r) => Math.abs(r.ue - r.ua)))
  const edgeErr = Math.abs(uExact(xHi) - uAff(xHi)) // exact at the end is +-1 by construction

  // drawing: side view, camera at bottom, z up
  const W = 300
  const H = 230
  const sx = 120
  const sz = 130
  const X = (x: number) => W / 2 + x * sx
  const Z = (z: number) => H - 24 - z * sz

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4" role="group" aria-label="Interactive: exact ray-plane intersection versus an affine approximation">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[26rem]" role="img" aria-label="Side view: a pinhole camera, one tilted hexel, rays through nine pixels and where the exact and the affine solutions land">
          <rect width={W} height={H} rx="10" className="fill-muted/30" />
          <circle cx={X(0)} cy={Z(0)} r="3.5" fill="currentColor" />
          <text x={X(0) + 8} y={Z(0) + 4} className="fill-current text-[9px]">
            camera
          </text>
          {rows.map((r, i) => (
            <line key={i} x1={X(0)} y1={Z(0)} x2={X(r.x * 1.5)} y2={Z(1.5)} stroke="currentColor" strokeWidth="0.5" opacity="0.18" />
          ))}
          <line x1={X(ends[0].x)} y1={Z(ends[0].z)} x2={X(ends[1].x)} y2={Z(ends[1].z)} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          {rows.map((r, i) => {
            const pe = { x: s * c * r.ue, z: z0 + s * sn * r.ue }
            const pa = { x: s * c * r.ua, z: z0 + s * sn * r.ua }
            return (
              <g key={i}>
                <circle cx={X(pe.x)} cy={Z(pe.z)} r="2.6" className="fill-primary" />
                <circle cx={X(pa.x)} cy={Z(pa.z)} r="2.6" fill="none" stroke="currentColor" strokeWidth="1" />
              </g>
            )
          })}
        </svg>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span>Plane tilt away from face-on = {tilt}°</span>
            <Range min={0} max={80} step={1} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} aria-label="Plane tilt in degrees" />
          </label>
          <label className="flex flex-col gap-1">
            <span>
              Hexel size / distance <code>s / z₀</code> = {size.toFixed(2)}
            </span>
            <Range min={0.05} max={0.6} step={0.01} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Hexel half-size over distance" />
          </label>
          <p className="text-muted-foreground">
            Filled dots: exact ray-plane hit. Rings: where a first-order projection at the centre would place the same pixel. Largest local-coordinate error across the nine pixels:{" "}
            <span className="font-mono text-foreground">{maxErr.toFixed(3)}</span> hexel half-widths (the edge itself is at ±1; the exact edge pixel is{" "}
            <span className="font-mono text-foreground">{edgeErr.toFixed(3)}</span> off).
          </p>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Reasoned geometry, exact formulas: u_exact = x·z₀ / (s (cos φ − x sin φ)) and u_affine = x·z₀ / (s cos φ). The paper states the exact version for Hexels and 2DGS and the affine one for 3DGS (Appendix B).
      </figcaption>
    </figure>
  )
}
