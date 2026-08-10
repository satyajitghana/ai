"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 1 of the paper, restructured so the headline comparison is visible:
// Skaling fitted on the sparse L-shape grid, using ~10x less compute, beats
// Chinchilla fitted on the FULL grid on every extrapolation column.
//
// MAPE %, lower is better. Numbers transcribed from Table 1.

const GOOD = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.58 0.19 25)"

type Row = { law: string; grid: "full" | "lshape"; flops: string; r2: number; interp: number; extN: number; extD: number; far: number }

const FARSEER: Row[] = [
  { law: "Chinchilla", grid: "full", flops: "5.0×10²²", r2: 0.995, interp: 0.77, extN: 1.48, extD: 1.98, far: 2.46 },
  { law: "Farseer", grid: "full", flops: "5.0×10²²", r2: 0.982, interp: 1.73, extN: 2.37, extD: 4.13, far: 2.43 },
  { law: "Skaling", grid: "full", flops: "5.0×10²²", r2: 0.998, interp: 0.41, extN: 0.47, extD: 0.88, far: 2.31 },
  { law: "Chinchilla", grid: "lshape", flops: "5.1×10²¹", r2: 0.954, interp: 2.51, extN: 4.32, extD: 3.29, far: 9.82 },
  { law: "Farseer", grid: "lshape", flops: "5.1×10²¹", r2: 0.974, interp: 1.81, extN: 2.07, extD: 2.52, far: 2.37 },
  { law: "Skaling", grid: "lshape", flops: "5.1×10²¹", r2: 0.995, interp: 0.85, extN: 0.89, extD: 1.35, far: 1.51 },
]

const SKGRID: Row[] = [
  { law: "Chinchilla", grid: "full", flops: "3.1×10²¹", r2: 0.992, interp: 0.81, extN: 0.83, extD: 1.44, far: 5.17 },
  { law: "Farseer", grid: "full", flops: "3.1×10²¹", r2: 0.967, interp: 1.66, extN: 0.90, extD: 4.45, far: 3.98 },
  { law: "Skaling", grid: "full", flops: "3.1×10²¹", r2: 0.998, interp: 0.33, extN: 0.39, extD: 0.58, far: 0.70 },
  { law: "Chinchilla", grid: "lshape", flops: "6.5×10²⁰", r2: 0.955, interp: 2.19, extN: 6.09, extD: 3.63, far: 14.63 },
  { law: "Farseer", grid: "lshape", flops: "6.5×10²⁰", r2: 0.987, interp: 0.82, extN: 1.19, extD: 2.66, far: 4.64 },
  { law: "Skaling", grid: "lshape", flops: "6.5×10²⁰", r2: 0.998, interp: 0.33, extN: 0.77, extD: 0.55, far: 1.15 },
]

export function GridStrategy() {
  const [ds, setDs] = useState<"farseer" | "skgrid">("farseer")
  const rows = ds === "farseer" ? FARSEER : SKGRID

  const chinFull = rows.find((r) => r.law === "Chinchilla" && r.grid === "full")!
  const skalL = rows.find((r) => r.law === "Skaling" && r.grid === "lshape")!

  const chip = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  const cell = (v: number, best: boolean) => (
    <span className={cn("font-mono text-[11px] tabular-nums", best ? "font-medium" : "text-muted-foreground")} style={best ? { color: GOOD } : undefined}>
      {v.toFixed(2)}
    </span>
  )

  const bestIn = (grid: "full" | "lshape", key: keyof Row) =>
    Math.min(...rows.filter((r) => r.grid === grid).map((r) => r[key] as number))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">MAPE % · lower is better · Table 1</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setDs("farseer")} className={chip(ds === "farseer")}>Farseer</button>
          <button type="button" onClick={() => setDs("skgrid")} className={chip(ds === "skgrid")}>SK-Grid</button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {(["full", "lshape"] as const).map((g) => (
          <div key={g} className="mb-3">
            <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>{g === "full" ? "full grid" : "sparse L-shape grid — low-compute edges only"}</span>
              <span className="tabular-nums">{rows.find((r) => r.grid === g)!.flops} FLOPs</span>
            </div>
            <div className="grid grid-cols-[minmax(0,6rem)_repeat(5,1fr)] gap-x-2 px-2 pb-1 font-mono text-[9px] uppercase text-muted-foreground/70">
              <span>law</span><span>R²</span><span>interp</span><span>ext N</span><span>ext D</span><span>far</span>
            </div>
            <div className="space-y-0.5">
              {rows.filter((r) => r.grid === g).map((r) => (
                <div key={r.law} className="grid grid-cols-[minmax(0,6rem)_repeat(5,1fr)] items-center gap-x-2 rounded-lg border bg-muted/15 px-2 py-1.5">
                  <span className="truncate font-mono text-[11px] text-foreground">{r.law}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{r.r2.toFixed(3)}</span>
                  {cell(r.interp, r.interp === bestIn(g, "interp"))}
                  {cell(r.extN, r.extN === bestIn(g, "extN"))}
                  {cell(r.extD, r.extD === bestIn(g, "extD"))}
                  {cell(r.far, r.far === bestIn(g, "far"))}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: GOOD }}>
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">the headline comparison</div>
          <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono text-[11px]">
            <span className="text-muted-foreground">Chinchilla, full grid<br />{chinFull.flops} FLOPs</span>
            <span className="text-muted-foreground/50">vs</span>
            <span className="text-right" style={{ color: GOOD }}>Skaling, L-shape<br />{skalL.flops} FLOPs</span>
          </div>
          <div className="mt-2 space-y-1">
            {([["ext N", "extN"], ["ext D", "extD"], ["far", "far"]] as const).map(([lab, key]) => {
              const a = chinFull[key] as number
              const b = skalL[key] as number
              return (
                <div key={lab} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono text-[11px] tabular-nums">
                  <span style={{ color: BAD }}>{a.toFixed(2)}%</span>
                  <span className="text-[9px] text-muted-foreground">{lab}</span>
                  <span className="text-right" style={{ color: GOOD }}>{b.toFixed(2)}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two things to read off this. First, the paper&rsquo;s own warning:{" "}
          <span className="text-foreground">interpolation quality is not evidence.</span>{" "}Chinchilla scores R² =
          0.995 on the full Farseer grid and still extrapolates three to four times worse than Skaling. A law can
          fit the interior beautifully and still be wrong about how the surface bends outside it, which is the only
          thing you ever actually use a scaling law for. Second, the compute argument: Skaling fitted on the sparse
          L-shape grid — <span className="text-foreground">roughly a tenth of the FLOPs</span>{" "}— extrapolates
          better than Chinchilla fitted on the whole thing, on every held-out regime.
        </p>
      </div>
    </figure>
  )
}
