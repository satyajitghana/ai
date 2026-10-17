"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How many point tokens SpatialLM hands its LLM. Sonata pools the grid four
// times by 2 (stride (2,2,2,2) in the 1.1 config), so one token is one occupied
// cell 16 voxels wide. The rows are the paper's Table 3: average K and F1 at
// each finest-grid resolution, "1x" = 5 cm. The room estimate below is my own
// arithmetic, not the paper's: a room is mostly surfaces, so occupied coarse
// cells is roughly surface area over cell area.

type Row = { mult: string; cm: number; k: number; lay25: number; lay50: number; obj25: number; obj50: number }

// SpatialLM paper (arXiv 2506.07491v2), Table 3.
const ROWS: Row[] = [
  { mult: "1×", cm: 5, k: 123, lay25: 84.6, lay50: 82.6, obj25: 65.1, obj50: 49.4 },
  { mult: "1.25×", cm: 4, k: 197, lay25: 84.8, lay50: 82.6, obj25: 65.3, obj50: 52.2 },
  { mult: "1.5×", cm: 5 / 1.5, k: 286, lay25: 86.9, lay50: 85.1, obj25: 68.7, obj50: 58.6 },
  { mult: "2×", cm: 2.5, k: 510, lay25: 87.4, lay50: 85.3, obj25: 71.6, obj50: 61.1 },
  { mult: "2.5×", cm: 2, k: 788, lay25: 86.1, lay50: 83.9, obj25: 72.2, obj50: 61.7 },
  { mult: "4×", cm: 1.25, k: 2000, lay25: 85.8, lay50: 83.7, obj25: 69.9, obj50: 58.9 },
]

const POOL = 16
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

export function TokenBudget() {
  const [i, setI] = useState(3)
  const [w, setW] = useState(3.2)
  const [d, setD] = useState(4.2)
  const [h, setH] = useState(2.8)
  const r = ROWS[i]
  const coarse = (r.cm * POOL) / 100 // metres
  const surface = 2 * w * d + 2 * (w + d) * h
  const est = surface / (coarse * coarse)
  const kMax = 2000
  const best = ROWS.reduce((a, b) => (b.lay25 > a.lay25 ? b : a))

  const bar = (v: number, max: number, hue: number) => (
    <div className="h-2 w-full rounded-full bg-muted/60">
      <div className="h-2 rounded-full" style={{ width: `${((v / max) * 100).toFixed(1)}%`, background: `oklch(0.66 0.14 ${hue})` }} />
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>finest voxel → point tokens → accuracy</span>
        <span className="text-muted-foreground/60">rows: paper Table 3 · room estimate: mine</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Finest grid resolution">
          {ROWS.map((row, k) => (
            <button
              key={row.mult}
              type="button"
              aria-pressed={k === i}
              onClick={() => setI(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                k === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {row.mult} · {row.cm.toFixed(2)} cm
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>finest voxel</span>
              <span className="text-foreground">{r.cm.toFixed(2)} cm</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>after 4 grid pools (÷16 per axis)</span>
              <span className="text-foreground">{(coarse * 100).toFixed(0)} cm cells</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>average tokens K (reported)</span>
              <span className="text-foreground">{fmt(r.k)}</span>
            </div>
            {bar(r.k, kMax, 250)}
            <div className="flex justify-between text-muted-foreground">
              <span>layout F1 @0.25 / @0.5 (reported)</span>
              <span className="text-foreground">
                {r.lay25.toFixed(1)} / {r.lay50.toFixed(1)}
              </span>
            </div>
            {bar(r.lay25, 100, 145)}
            <div className="flex justify-between text-muted-foreground">
              <span>object F1 @0.25 / @0.5 (reported)</span>
              <span className="text-foreground">
                {r.obj25.toFixed(1)} / {r.obj50.toFixed(1)}
              </span>
            </div>
            {bar(r.obj25, 100, 30)}
            <p className="pt-1 text-[10.5px] text-muted-foreground">
              Layout peaks at {best.mult} ({best.cm.toFixed(1)} cm). The shipped 1.1 models use 2.5 cm: 1,280 bins over 32 m.
            </p>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            <p className="text-muted-foreground">One room, as a shell of surfaces (reasoned)</p>
            {(
              [
                ["width", w, setW, 2, 10],
                ["depth", d, setD, 2, 10],
                ["height", h, setH, 2.2, 4],
              ] as const
            ).map(([lab, v, set, lo, hi]) => (
              <label key={lab} className="flex items-center gap-2 text-muted-foreground">
                <span className="w-12">{lab}</span>
                <Range min={lo} max={hi} step={0.1} value={v} onChange={(e) => set(Number(e.target.value))} className="flex-1" aria-label={`room ${lab} in metres`} />
                <span className="w-12 text-right text-foreground">{v.toFixed(1)} m</span>
              </label>
            ))}
            <div className="flex justify-between text-muted-foreground">
              <span>floor + ceiling + walls</span>
              <span className="text-foreground">{surface.toFixed(1)} m²</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>÷ cell area {(coarse * coarse).toFixed(3)} m²</span>
              <span className="text-foreground">≈ {fmt(est)} tokens</span>
            </div>
            {bar(Math.min(est, kMax), kMax, 250)}
            <p className="pt-1 text-[10.5px] text-muted-foreground">
              A floor-to-ceiling shell only; furniture adds cells, a missing ceiling in a video scan removes them. It lands near the
              paper&apos;s averages, which is the point: the token count is set by surface area and voxel size, not by point count.
            </p>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Left: the SpatialLM paper&apos;s Table 3 (Qwen2.5-0.5B with Sonata, trained and tested on the SpatialLM dataset). Right: my
        estimate of occupied coarse cells for a box-shaped room, from Sonata&apos;s four stride-2 grid pools in the released config.
      </figcaption>
    </figure>
  )
}
