"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { TABLE5 } from "./scene-c000"

// What a scene costs, from the paper's Table 5: scene-frame seconds, plus
// seconds per refined object times the number of objects. The paper reports
// the per-object figure, so total time grows linearly with object count; it
// does not name the GPU. Scene F-scores are copied from the same table.

const W = 640
const H = 250
const BAR = { x0: 150, x1: 520, y0: 40, h: 26, gap: 14 }
const C_TIME = "oklch(0.62 0.14 250)"
const C_REF = "oklch(0.68 0.15 40)"

export function RefineCost() {
  const [n, setN] = useState(5)

  const rows = TABLE5.map((r) => ({ ...r, total: r.scene + r.perObj * n }))
  const max = Math.max(...rows.map((r) => r.total))
  const sx = (t: number) => ((BAR.x1 - BAR.x0) * t) / max
  const fast = rows[2]
  const full = rows[3]

  const desc = `For ${n} objects: ${rows
    .map((r) => `${r.id} takes ${r.total.toFixed(1)} seconds`)
    .join("; ")}. Full refinement at 1024 is ${(full.total / fast.total).toFixed(1)} times slower than the 512 pipeline with refinement.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what refinement costs per scene</span>
        <span className="text-muted-foreground/60">paper, Table 5 · GPU not stated</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <label className="flex min-w-[240px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-[96px] shrink-0">{n} object{n === 1 ? "" : "s"}</span>
          <Range min={1} max={19} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} accent={C_REF} aria-label="Objects in the scene" className="flex-1" />
        </label>
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label={desc}>
          <g className="font-mono" fontSize={9}>
            <text x={BAR.x1 + 8} y={26} className="fill-muted-foreground" fontSize={8.5}>
              scene F (MIDI / Gen3DSR)
            </text>
            {rows.map((r, k) => {
              const y = BAR.y0 + k * (BAR.h + BAR.gap)
              const a = sx(r.scene)
              const b = sx(r.perObj * n)
              return (
                <g key={r.id}>
                  <text x={BAR.x0 - 8} y={y + BAR.h / 2 + 3} textAnchor="end" className="fill-foreground">
                    {r.id}
                  </text>
                  <rect x={BAR.x0} y={y} width={a} height={BAR.h} fill={C_TIME} rx={2} />
                  {b > 0 ? <rect x={BAR.x0 + a} y={y} width={b} height={BAR.h} fill={C_REF} rx={2} /> : null}
                  <text x={BAR.x0 + a + b + 5} y={y + BAR.h / 2 + 3} className="fill-foreground">
                    {r.total.toFixed(1)} s
                  </text>
                  <text x={BAR.x1 + 8} y={y + BAR.h / 2 + 3} className="fill-muted-foreground">
                    {r.fMidi.toFixed(2)} / {r.fGen.toFixed(2)}
                  </text>
                </g>
              )
            })}
            <g transform={`translate(${BAR.x0}, ${H - 28})`}>
              <rect width={10} height={10} fill={C_TIME} rx={2} />
              <text x={14} y={9} className="fill-muted-foreground">
                scene frame, once
              </text>
              <rect x={120} width={10} height={10} fill={C_REF} rx={2} />
              <text x={134} y={9} className="fill-muted-foreground">
                refinement, per object
              </text>
            </g>
          </g>
        </svg>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Totals are scene seconds plus per-object seconds times the slider, which assumes objects are refined one after
        another, as the paper&apos;s Algorithm 2 loops over them. Peak memory is 17.9 to 21.8 GB across the four rows.
      </figcaption>
    </figure>
  )
}
