"use client"

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { cn } from "@/lib/utils"

import { C000, C000_ENV, type SceneObject } from "./scene-c000"

// One real DistScene output (scene C000 from the authors' preview assets), seen
// from above. Left: the shared scene frame, every object rasterised on the one
// sparse-voxel grid they all share. Right: the selected object, either as the
// scene frame resolved it or after Object-Centric Refinement re-voxelises it
// in its own cube. Drag an object to edit the layout: that changes two numbers
// in its node matrix and nothing else.
//
// Footprints are the objects' real bounding boxes from the GLB (scene-c000.ts).
// The shapes inside them are rounded rectangles, not the meshes: the point is
// how many grid cells an object gets, which only depends on its size.
// Grid sizes assume TRELLIS.2's 16x VAE downsampling (configs in its repo):
// 512 output resolution -> 32 latent voxels across, 1024 -> 64.

const W = 640
const H = 372
const MAP = { x0: 14, y0: 44, s: 300 }
const LOC = { x0: 376, y0: 44, s: 210 }

const HUES = [25, 60, 145, 200, 250, 290, 330, 100]
const col = (k: number, l = 0.66, c = 0.13) => `oklch(${l} ${c} ${HUES[k % HUES.length]})`

type Res = 512 | 1024

function fmt(n: number): string {
  const s = String(Math.round(n))
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

// Scene units [-0.5, 0.5] -> map pixels.
const mx = (x: number) => MAP.x0 + (x + 0.5) * MAP.s
const mz = (z: number) => MAP.y0 + (z + 0.5) * MAP.s

// Is point (px, pz) inside a rounded rectangle centred at (cx, cz)?
function insideRounded(px: number, pz: number, cx: number, cz: number, w: number, d: number): boolean {
  const r = 0.35 * Math.min(w, d)
  const dx = Math.abs(px - cx) - (w / 2 - r)
  const dz = Math.abs(pz - cz) - (d / 2 - r)
  if (dx <= 0 || dz <= 0) return Math.abs(px - cx) <= w / 2 && Math.abs(pz - cz) <= d / 2
  return dx * dx + dz * dz <= r * r
}

type Box = { x0: number; x1: number; z0: number; z1: number }

function moved(o: SceneObject, off: [number, number] | undefined): Box {
  const [dx, dz] = off ?? [0, 0]
  return { x0: o.x0 + dx, x1: o.x1 + dx, z0: o.z0 + dz, z1: o.z1 + dz }
}

// Cells of a world-aligned grid (cell size c, origin -0.5) whose centres fall
// inside the object's footprint.
function sceneCells(b: Box, c: number): [number, number][] {
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  const out: [number, number][] = []
  const i0 = Math.floor((b.x0 + 0.5) / c)
  const i1 = Math.floor((b.x1 + 0.5) / c)
  const j0 = Math.floor((b.z0 + 0.5) / c)
  const j1 = Math.floor((b.z1 + 0.5) / c)
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const px = -0.5 + (i + 0.5) * c
      const pz = -0.5 + (j + 0.5) * c
      if (insideRounded(px, pz, cx, cz, w, d)) out.push([i, j])
    }
  }
  return out
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1
}

export function VoxelBudget() {
  const [res, setRes] = useState<Res>(1024)
  const [refined, setRefined] = useState(false)
  const [sel, setSel] = useState(6)
  const [offs, setOffs] = useState<Record<string, [number, number]>>({})
  const drag = useRef<{ id: string; sx: number; sz: number; ox: number; oz: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const N = res / 16
  const cell = 1 / N
  const o = C000[sel]
  const ob = moved(o, offs[o.id])
  const across = N * o.s
  const gain = 1 / o.s
  const edited = Object.keys(offs).length > 0

  // Layout checks for the selected object, the way the paper's data engine
  // starts: bounding boxes against each other and against the room.
  const hits = C000.filter((p, k) => k !== sel && overlaps(ob, moved(p, offs[p.id]))).map((p) => p.id)
  const outside = ob.x0 < C000_ENV.x0 || ob.x1 > C000_ENV.x1 || ob.z0 < C000_ENV.z0 || ob.z1 > C000_ENV.z1
  const off = offs[o.id] ?? [0, 0]

  function toScene(e: ReactPointerEvent): [number, number] | null {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(m.inverse())
    return [(p.x - MAP.x0) / MAP.s - 0.5, (p.y - MAP.y0) / MAP.s - 0.5]
  }

  function onDown(k: number, e: ReactPointerEvent) {
    setSel(k)
    const p = toScene(e)
    if (!p) return
    const id = C000[k].id
    const cur = offs[id] ?? [0, 0]
    drag.current = { id, sx: p[0], sz: p[1], ox: cur[0], oz: cur[1] }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function onMove(e: ReactPointerEvent) {
    const d = drag.current
    if (!d) return
    const p = toScene(e)
    if (!p) return
    const nx = d.ox + p[0] - d.sx
    const nz = d.oz + p[1] - d.sz
    setOffs((prev) => ({ ...prev, [d.id]: [Math.round(nx * 1000) / 1000, Math.round(nz * 1000) / 1000] }))
  }
  function onUp() {
    drag.current = null
  }

  // Right panel: the selected object's footprint in its own frame, scaled so
  // its longest side (s, which may be its height) spans the panel.
  const cx = (ob.x0 + ob.x1) / 2
  const cz = (ob.z0 + ob.z1) / 2
  const pxPerUnit = LOC.s / o.s
  const lx = (x: number) => LOC.x0 + LOC.s / 2 + (x - cx) * pxPerUnit
  const lz = (z: number) => LOC.y0 + LOC.s / 2 + (z - cz) * pxPerUnit
  const w = ob.x1 - ob.x0
  const d = ob.z1 - ob.z0
  const localCells: { x: number; z: number; c: number }[] = []
  if (refined) {
    // Refinement grid: N cells across the object's own cube.
    const c = o.s / N
    const n = N
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const px = cx - o.s / 2 + (i + 0.5) * c
        const pz = cz - o.s / 2 + (j + 0.5) * c
        if (insideRounded(px, pz, cx, cz, w, d)) localCells.push({ x: px - c / 2, z: pz - c / 2, c })
      }
    }
  } else {
    for (const [i, j] of sceneCells(ob, cell)) localCells.push({ x: -0.5 + i * cell, z: -0.5 + j * cell, c: cell })
  }
  const localCount = localCells.length

  const desc = `Top view of DistScene scene C000: ${C000.length} objects in a shared ${N}-voxel latent grid at resolution ${res}. Selected ${o.id} (${o.label}), longest side ${o.s.toFixed(
    3,
  )} of the scene, gets about ${across.toFixed(1)} latent voxels across in the scene frame and ${N} after refinement, ${gain.toFixed(1)} times finer per axis.`

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one scene, one voxel budget</span>
        <span className="text-muted-foreground/60">boxes from C000.glb · grid from TRELLIS.2&apos;s 16x VAE</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
        <div className="flex gap-1.5" role="group" aria-label="Output resolution">
          {([512, 1024] as const).map((r) => (
            <button key={r} type="button" aria-pressed={res === r} onClick={() => setRes(r)} className={btn(res === r)}>
              {r} → {r / 16} latent
            </button>
          ))}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Right panel">
          <button type="button" aria-pressed={!refined} onClick={() => setRefined(false)} className={btn(!refined)}>
            as the scene frame made it
          </button>
          <button type="button" aria-pressed={refined} onClick={() => setRefined(true)} className={btn(refined)}>
            after object-centric refinement
          </button>
        </div>
        {edited ? (
          <button type="button" onClick={() => setOffs({})} className={btn(false)}>
            reset layout
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[600px] touch-none select-none"
          role="img"
          aria-label={desc}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <text x={MAP.x0} y={22} className="fill-foreground font-mono" fontSize={10.5}>
            scene frame, top view · {N}×{N} latent voxels
          </text>
          <text x={MAP.x0} y={35} className="fill-muted-foreground font-mono" fontSize={8.5}>
            click an object; drag it to edit the layout
          </text>

          {/* room footprint and grid */}
          <rect x={mx(C000_ENV.x0)} y={mz(C000_ENV.z0)} width={(C000_ENV.x1 - C000_ENV.x0) * MAP.s} height={(C000_ENV.z1 - C000_ENV.z0) * MAP.s} fill="none" stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.5} />
          {Array.from({ length: N + 1 }, (_, i) => (
            <g key={i} stroke="currentColor" className="text-muted-foreground" strokeOpacity={i % 8 === 0 ? 0.22 : 0.07} strokeWidth={0.5}>
              <line x1={MAP.x0 + i * cell * MAP.s} x2={MAP.x0 + i * cell * MAP.s} y1={MAP.y0} y2={MAP.y0 + MAP.s} />
              <line y1={MAP.y0 + i * cell * MAP.s} y2={MAP.y0 + i * cell * MAP.s} x1={MAP.x0} x2={MAP.x0 + MAP.s} />
            </g>
          ))}

          {C000.map((p, k) => {
            const b = moved(p, offs[p.id])
            const cells = sceneCells(b, cell)
            const on = k === sel
            return (
              <g key={p.id} onPointerDown={(e) => onDown(k, e)} className="cursor-grab">
                {cells.map(([i, j]) => (
                  <rect key={`${i}-${j}`} x={MAP.x0 + i * cell * MAP.s} y={MAP.y0 + j * cell * MAP.s} width={cell * MAP.s} height={cell * MAP.s} fill={col(k)} fillOpacity={on ? 0.85 : 0.45} />
                ))}
                <rect x={mx(b.x0)} y={mz(b.z0)} width={(b.x1 - b.x0) * MAP.s} height={(b.z1 - b.z0) * MAP.s} fill="transparent" stroke={col(k, 0.5, 0.15)} strokeWidth={on ? 1.6 : 0.6} strokeDasharray={on ? undefined : "2 2"} />
                <text x={mx(b.x0) + 2} y={mz(b.z0) - 2} fontSize={7.5} className="font-mono" fill={col(k, 0.5, 0.15)}>
                  {p.id.slice(3)}
                </text>
              </g>
            )
          })}

          {/* ---- local panel ---- */}
          <text x={LOC.x0} y={22} className="fill-foreground font-mono" fontSize={10.5}>
            {o.id} · {o.label}
          </text>
          <text x={LOC.x0} y={35} className="fill-muted-foreground font-mono" fontSize={8.5}>
            {refined ? `its own cube: ${N} voxels across` : `its share of the scene grid: ${across.toFixed(1)} across`}
          </text>
          <rect x={LOC.x0} y={LOC.y0} width={LOC.s} height={LOC.s} fill="none" stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.35} />
          <defs>
            <clipPath id="vb-loc">
              <rect x={LOC.x0} y={LOC.y0} width={LOC.s} height={LOC.s} />
            </clipPath>
          </defs>
          <g clipPath="url(#vb-loc)">
            {localCells.map((q, k) => (
              <rect key={k} x={lx(q.x)} y={lz(q.z)} width={q.c * pxPerUnit} height={q.c * pxPerUnit} fill={col(sel)} fillOpacity={0.85} stroke={refined ? "none" : "white"} strokeOpacity={0.5} strokeWidth={refined ? 0 : 0.5} />
            ))}
            <rect x={lx(ob.x0)} y={lz(ob.z0)} width={w * pxPerUnit} height={d * pxPerUnit} fill="none" stroke="currentColor" className="text-foreground" strokeOpacity={0.5} strokeDasharray="3 3" />
          </g>

          {/* readout */}
          <g className="font-mono" fontSize={8.5}>
            <text x={LOC.x0} y={LOC.y0 + LOC.s + 16} className="fill-muted-foreground">
              longest side s = {o.s.toFixed(3)} of the scene cube
            </text>
            <text x={LOC.x0} y={LOC.y0 + LOC.s + 29} className="fill-muted-foreground">
              scene frame: {across.toFixed(1)} latent ({Math.round(res * o.s)} output) voxels across
            </text>
            <text x={LOC.x0} y={LOC.y0 + LOC.s + 42} fill={col(sel, 0.5, 0.15)}>
              refined: {N} latent ({res} output), {gain.toFixed(1)}x per axis, {fmt(gain * gain * gain)}x by volume
            </text>
            <text x={LOC.x0} y={LOC.y0 + LOC.s + 55} className="fill-muted-foreground">
              cells drawn here: {localCount} · shipped mesh: {fmt(o.tris)} triangles
            </text>
            <text x={MAP.x0} y={MAP.y0 + MAP.s + 16} className="fill-muted-foreground">
              node matrix m[12], m[14] = {(o.tx + off[0]).toFixed(3)}, {(o.tz + off[1]).toFixed(3)}
              {off[0] !== 0 || off[1] !== 0 ? `  (was ${o.tx.toFixed(3)}, ${o.tz.toFixed(3)})` : ""}
            </text>
            <text x={MAP.x0} y={MAP.y0 + MAP.s + 29} fill={hits.length || outside ? "oklch(0.6 0.2 28)" : undefined} className={hits.length || outside ? undefined : "fill-muted-foreground"}>
              {hits.length || outside
                ? `box ${outside ? "leaves the room" : `overlaps ${hits.join(", ")}`}: nothing in the output re-checks this`
                : "no box overlaps · the room is untouched by any edit"}
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Boxes, scales, translations and triangle counts are read from the JSON chunk of the authors&apos; full-resolution
        C000.glb; the rounded shapes inside the boxes stand in for the meshes. Latent grid sizes assume DistScene keeps
        TRELLIS.2&apos;s 16x downsampling. Labels with a question mark are my reading of the input photo.
      </figcaption>
    </figure>
  )
}
