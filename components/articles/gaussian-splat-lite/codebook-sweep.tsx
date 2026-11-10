"use client"

// Size against colour error for the SH of the Tanks and Temples "train" scene
// (1,074,761 splats, SH degree 3), MEASURED with my numpy re-implementation of
// gsl-build-lod's codebook path (weighted k-means, area x opacity weights,
// 10 refinement passes, 512 groups probed 4 at a time while training and 16 in
// the final pass, s8 storage with a 1/128 step, deflate level 6 per 65,536
// splats). Not Gaussian-Splat-Lite's own binary: the permission layer refused
// to run it.
//
// Error = the largest per-channel change in the view-dependent colour (SH
// degrees 1-3 evaluated at 4 random view directions for 200,000 random
// splats), in 8-bit levels. "Weighted" weighs each splat by area x opacity,
// as the k-means does. It is per-splat colour, not a rendered image.

import { useState } from "react"

type Row = { key: string; label: string; bytes: number; err: number; errW: number; over: number; overW: number }

const ROWS: Row[] = [
  { key: "none", label: "no SH (--max-sh 0)", bytes: 0, err: 16.57, errW: 23.61, over: 37.0, overW: 42.5 },
  { key: "4k", label: "codebook 4,096", bytes: 1.44, err: 10.45, errW: 7.27, over: 19.5, overW: 9.4 },
  { key: "16k", label: "codebook 16,384", bytes: 2.01, err: 9.24, errW: 5.49, over: 15.0, overW: 5.5 },
  { key: "64k", label: "codebook 65,536", bytes: 3.55, err: 7.75, errW: 4.12, over: 9.8, overW: 3.3 },
  { key: "256k", label: "codebook 262,144", bytes: 9.48, err: 5.45, errW: 2.43, over: 4.3, overW: 1.2 },
  { key: "s8", label: "s8 per splat", bytes: 29.63, err: 0.77, errW: 0.81, over: 0, overW: 0 },
]

const W = 700
const ROW_H = 30
const TOP = 30
const LX = 10
const B1 = 150
const BW = 250
const B2 = 430
const EW = 250

export function CodebookSweep() {
  const [weighted, setWeighted] = useState(true)
  const [sel, setSel] = useState("256k")
  const H = TOP + ROWS.length * ROW_H + 8
  const r = ROWS.find((x) => x.key === sel) ?? ROWS[4]
  const e = (x: Row) => (weighted ? x.errW : x.err)
  const o = (x: Row) => (weighted ? x.overW : x.over)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>train scene, 1,074,761 splats · SH bytes vs colour error</span>
        <span className="text-muted-foreground/60">measured (my re-implementation)</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2 font-mono text-xs">
          <button type="button" onClick={() => setWeighted(true)}
            className={`rounded border px-2 py-1 ${weighted ? "bg-foreground text-background" : ""}`}>weighted by area x opacity</button>
          <button type="button" onClick={() => setWeighted(false)}
            className={`rounded border px-2 py-1 ${!weighted ? "bg-foreground text-background" : ""}`}>every splat equal</button>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label="For the train scene: dropping SH costs 0 bytes and 23.6 levels of weighted colour error; codebooks of 4,096, 16,384, 65,536 and 262,144 entries cost 1.44, 2.01, 3.55 and 9.48 bytes per splat with weighted errors of 7.27, 5.49, 4.12 and 2.43 levels; per-splat s8 costs 29.63 bytes with 0.81 levels.">
          <text x={B1} y={16} fontSize={9} className="fill-muted-foreground font-mono">SH bytes/splat after deflate (0 to 30)</text>
          <text x={B2} y={16} fontSize={9} className="fill-muted-foreground font-mono">mean colour error, 8-bit levels (0 to 24)</text>
          {ROWS.map((x, i) => {
            const y = TOP + i * ROW_H
            const lit = x.key === sel
            return (
              <g key={x.key} onClick={() => setSel(x.key)} style={{ cursor: "pointer" }}>
                <text x={LX} y={y + 14} fontSize={10} className="fill-foreground font-mono" fillOpacity={lit ? 1 : 0.7}>{x.label}</text>
                <rect x={B1} y={y + 3} width={Math.max(1, (x.bytes / 30) * BW)} height={16} rx={2} className="fill-sky-500" fillOpacity={lit ? 0.9 : 0.45} />
                <text x={B1 + (x.bytes / 30) * BW + 5} y={y + 15} fontSize={9} className="fill-muted-foreground font-mono">{x.bytes.toFixed(2)}</text>
                <rect x={B2} y={y + 3} width={Math.max(1, (e(x) / 24) * EW)} height={16} rx={2} className="fill-amber-500" fillOpacity={lit ? 0.9 : 0.45} />
                <text x={B2 + (e(x) / 24) * EW + 5} y={y + 15} fontSize={9} className="fill-muted-foreground font-mono">{e(x).toFixed(2)}</text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">{r.label}</span> · {r.bytes.toFixed(2)} B/splat of SH ·
          mean error <span className="text-foreground">{e(r).toFixed(2)}</span> levels ·{" "}
          <span className="text-foreground">{o(r).toFixed(1)}%</span> of samples off by more than 16 levels
          {weighted ? " (weighted)" : ""}. The s8 row is what --no-cluster-sh writes; the 262,144 row is the converter&apos;s cap, here at about 4 splats per entry.
        </div>
      </div>
    </figure>
  )
}
