"use client"

// What the Blender path of Steve can report about a solid, against what a
// B-rep kernel reports. A UV sphere of radius 10 mm is meshed with N
// longitudes and N/2 rings, then measured with the three formulas of
// vendor/blender/blender_measure.py (re-implemented here, not imported):
//   area    = sum of |(b - a) x (c - a)| / 2
//   volume  = sum of a . (b x c) / 6        (tetrahedra from the origin)
//   closed  = every edge is shared by exactly two triangles
// The exact sphere (4/3 pi r^3 and 4 pi r^2) is what an analytic surface gives
// a kernel for free. The numbers in the article's table were produced by a
// numpy version of the same code; this component recomputes them live.
//
// MEASURED (numpy, float64) and recomputed here with lib/dmath.

import { useMemo, useState } from "react"

import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

const R = 10
const V_EXACT = (4 / 3) * Math.PI * R * R * R
const A_EXACT = 4 * Math.PI * R * R

type Mesh = { v: number[][]; t: number[][] }

function uvSphere(nu: number): Mesh {
  const nv = Math.max(4, nu / 2)
  const v: number[][] = [[0, 0, R]]
  for (let i = 1; i < nv; i++) {
    const th = (Math.PI * i) / nv
    for (let j = 0; j < nu; j++) {
      const p = (2 * Math.PI * j) / nu
      v.push([R * msin(th) * mcos(p), R * msin(th) * msin(p), R * mcos(th)])
    }
  }
  v.push([0, 0, -R])
  const t: number[][] = []
  for (let j = 0; j < nu; j++) t.push([0, 1 + j, 1 + ((j + 1) % nu)])
  for (let i = 0; i < nv - 2; i++) {
    const a = 1 + i * nu
    const b = 1 + (i + 1) * nu
    for (let j = 0; j < nu; j++) {
      const j2 = (j + 1) % nu
      t.push([a + j, b + j, b + j2], [a + j, b + j2, a + j2])
    }
  }
  const last = v.length - 1
  const a = 1 + (nv - 2) * nu
  for (let j = 0; j < nu; j++) t.push([last, a + ((j + 1) % nu), a + j])
  return { v, t }
}

function measure(m: Mesh, skip: boolean) {
  let area = 0
  let vol = 0
  const edges = new Map<string, number>()
  const tris = skip ? m.t.slice(1) : m.t
  for (const [i, j, k] of tris) {
    const a = m.v[i]
    const b = m.v[j]
    const c = m.v[k]
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2]
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx
    area += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz)
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
    for (const [p, q] of [[i, j], [j, k], [k, i]]) {
      const key = p < q ? `${p}:${q}` : `${q}:${p}`
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  let closed = true
  for (const n of edges.values()) if (n !== 2) closed = false
  return { area, vol: Math.abs(vol), closed, tris: tris.length }
}

const SIZES = [8, 16, 32, 64, 128]
const fmt = (x: number, d = 3) => x.toFixed(d)
const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`

export function MeshVsExact() {
  const [idx, setIdx] = useState(2)
  const [hole, setHole] = useState(false)
  const [twice, setTwice] = useState(false)
  const nu = SIZES[idx]
  const mesh = useMemo(() => uvSphere(nu), [nu])
  const m = useMemo(() => measure(mesh, hole), [mesh, hole])

  const copies = twice ? 2 : 1
  // Mirrors blender_measure.summarize: only closed meshes add to the volume,
  // and with none closed there is no volume at all.
  const volume = m.closed ? m.vol * copies : null
  const area = m.area * copies
  const dV = volume === null ? null : volume / (V_EXACT * copies) - 1
  const dA = area / (A_EXACT * copies) - 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>same sphere, two ways to measure it</span>
        <span className="text-muted-foreground/60">r = 10 mm, formulas of blender_measure.py</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">longitudes</span>
          {SIZES.map((s, i) => (
            <button
              key={s}
              type="button"
              aria-pressed={idx === i}
              onClick={() => setIdx(i)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                idx === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={hole}
            onClick={() => setHole((v) => !v)}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              hole ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            delete one triangle
          </button>
          <button
            type="button"
            aria-pressed={twice}
            onClick={() => setTwice((v) => !v)}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              twice ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            add a coincident copy
          </button>
        </div>

        <div className="mt-4 grid gap-3 font-mono text-[11px] sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-foreground">B-rep kernel (analytic sphere)</div>
            <div className="mt-1.5 text-muted-foreground">volume {fmt(V_EXACT * copies)} mm3</div>
            <div className="text-muted-foreground">area {fmt(A_EXACT * copies)} mm2</div>
            <div className="mt-1.5 text-muted-foreground/70">no triangles; one face, one surface equation</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-foreground">{`Blender path (${(m.tris * copies).toLocaleString("en-US")} triangles)`}</div>
            <div className="mt-1.5 text-muted-foreground">
              {volume === null ? "volume none: the mesh is open" : `volume ${fmt(volume)} mm3 (${pct(dV!)})`}
            </div>
            <div className="text-muted-foreground">{`area ${fmt(area)} mm2 (${pct(dA)})`}</div>
            <div className="mt-1.5 text-muted-foreground/70">{m.closed ? "closed: every edge shared by two triangles" : "open: some edge has one triangle"}</div>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {twice
            ? "Two coincident spheres: the volume is summed per closed object, so it doubles. blender_measure.py warns when extents overlap but does not subtract."
            : hole
              ? "Delete one triangle and the closed test fails; the object's area still counts, its volume does not. The scene warns about open meshes."
              : "An inscribed UV mesh always under-measures a sphere. The error falls about 4x per doubling of longitudes."}
        </p>
      </div>
    </figure>
  )
}
