"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { MERGE, type MergeRow } from "./data"

// How many Gaussians survive the voxel merge, from my numpy port of the
// release's merge_voxels (sweep.py, see data.ts), at the Space's voxel 0.0018
// in GSNorm space. Two axes: input resolution (4 views) and number of views
// inside a fixed camera span (756 px). For resolution, a second bar shows the
// count when the voxel is instead fixed in metres at its 756 px size, which is
// what a constant voxel in a radial-normalized space amounts to for one scene.

type Scene = keyof typeof MERGE
type Axis = "res" | "views"

const SCENES: { id: Scene; label: string }[] = [
  { id: "object", label: "Object" },
  { id: "room", label: "Indoor room" },
  { id: "street", label: "Street canyon" },
]

const W = 600
const ROW = 46
const L = 92
const R = 150
const T = 8

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}k`)

export function MergeBudget() {
  const [scene, setScene] = useState<Scene>("room")
  const [axis, setAxis] = useState<Axis>("res")
  const rows: MergeRow[] = MERGE[scene][axis]
  const max = Math.max(...rows.map((r) => r.raw))
  const bx = (n: number) => (n / max) * (W - L - R)
  const H = T + rows.length * ROW + 6
  const first = rows[0]
  const last = rows[rows.length - 1]
  const growth = last.gs / first.gs
  const rawGrowth = last.raw / first.raw
  const desc = `${scene} scene, ${axis === "res" ? "resolution 504 to 1022 px" : "1 to 16 views"}: Gaussians after the merge grow ${growth.toFixed(2)}x while the raw count grows ${rawGrowth.toFixed(2)}x.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what the voxel merge keeps</span>
        <span className="text-muted-foreground/60">numpy port of merge_voxels · measured</span>
      </div>
      <div className="flex flex-wrap gap-3 px-4 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScene(s.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                scene === s.id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["res", "vary resolution"],
              ["views", "vary views"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAxis(id)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                axis === id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label={desc}>
          {rows.map((r, i) => {
            const y = T + i * ROW
            return (
              <g key={r.x}>
                <text x={L - 10} y={y + 15} textAnchor="end" fontSize={11} className="fill-foreground font-mono">
                  {axis === "res" ? `${r.x} px` : `${r.x} view${r.x > 1 ? "s" : ""}`}
                </text>
                <rect x={L} y={y} width={bx(r.raw)} height={14} rx={2} fill="currentColor" fillOpacity={0.15} className="text-muted-foreground" />
                <rect x={L} y={y} width={bx(r.gs)} height={14} rx={2} fill="currentColor" className="text-emerald-500" />
                <text x={L + bx(r.raw) + 6} y={y + 11} fontSize={10} className="fill-muted-foreground font-mono">
                  {fmt(r.gs)} of {fmt(r.raw)} ({Math.round((r.gs / r.raw) * 100)}%)
                </text>
                {r.fixed != null ? (
                  <>
                    <rect x={L} y={y + 18} width={bx(r.fixed)} height={8} rx={2} fill="currentColor" className="text-orange-500" />
                    <text x={L + bx(r.fixed) + 6} y={y + 26} fontSize={9} className="fill-muted-foreground font-mono">
                      {fmt(r.fixed)} fixed-metre voxel
                    </text>
                  </>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        Grey: Gaussians before the merge, one per pixel. Green: after the merge at voxel 0.0018 in GSNorm space. From
        first to last row the merged count grows{" "}
        <span className="font-mono text-foreground">{growth.toFixed(2)}x</span> while the raw count grows{" "}
        <span className="font-mono text-foreground">{rawGrowth.toFixed(2)}x</span>.
        {axis === "res"
          ? " Because the voxel is a fixed number of pixel spacings, the merge keeps the same share at every resolution and the output grows with pixel count; a voxel fixed in metres (orange) would cap it."
          : " Extra views inside the same span mostly land in voxels that are already occupied, so the output grows far slower than the input."}{" "}
        Synthetic ray-cast scenes, no model involved.
      </figcaption>
    </figure>
  )
}
