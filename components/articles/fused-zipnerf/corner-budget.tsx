"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CORNERS, COUNTS, GRIDS } from "./data"

// Table rows touched per interval, by level. featurize_common.cuh level_corners() merges the multisamples that fall in the
// same grid cell, so an interval reads 8 rows per DISTINCT cell instead of 8 per multisample (48 at most). The bars are our
// numpy port of the repo's multisample geometry run on 3,000 synthetic rays x 64 uniform intervals (pinhole camera, 70 degree
// field of view, 1,297 px wide, cameras 1 to 2 units from the origin). The shape of the curve is the result; the exact rows
// depend on where the samples fall in a trained scene, which this toy does not know.

const C_ROWS = "oklch(0.62 0.16 285)"
const C_CAP = "oklch(0.60 0.02 260)"
const C_OFF = "oklch(0.75 0.02 260)"

const fmt = (v: number) => v.toLocaleString("en-US")

export function CornerBudget() {
  const [g, setG] = useState(2)
  const grid = GRIDS[g]
  const used = CORNERS.slice(0, grid.levels)
  const rows = used.reduce((a, r) => a + r.rows, 0)
  const naive = grid.levels * 48
  const samples = COUNTS.samplesPerLevel[g]
  const bytes = rows * grid.features * 4
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        toy: how many table rows one interval reads · our port of the geometry on synthetic rays · hashed from 256³ up
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">grid</span>
        {GRIDS.map((x, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setG(i)}
            aria-pressed={g === i}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              g === i ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {i === 0 ? "proposal 0" : i === 1 ? "proposal 1" : "NeRF"} · {x.levels} levels × {x.features}
          </button>
        ))}
      </div>
      <div className="px-4 py-3">
        <ul className="space-y-1" aria-label="Table rows per interval by level">
          {CORNERS.map((r, i) => {
            const on = i < grid.levels
            const hashed = GRIDS[2].hashed[i]
            return (
              <li key={r.level} className="grid grid-cols-[4.5rem_1fr_9rem] items-center gap-2 font-mono text-[11px]">
                <span className={on ? "text-foreground" : "text-muted-foreground"}>
                  {fmt(r.size)}³ <span className="text-[9px] opacity-70">{hashed ? "hash" : "dense"}</span>
                </span>
                <div className="relative h-3 rounded bg-muted" role="img" aria-label={`Level ${r.level}: ${r.rows} of 48 rows, ${r.oneCellPct} percent of intervals in a single cell`}>
                  <div className="h-full rounded" style={{ width: `${(r.rows / 48) * 100}%`, background: on ? C_ROWS : C_OFF }} />
                  <div className="absolute inset-y-0 right-0 w-px" style={{ background: C_CAP }} aria-hidden />
                </div>
                <span className="text-right tabular-nums text-muted-foreground">
                  {r.rows.toFixed(1)}/48 · {r.oneCellPct.toFixed(0)}% one cell
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>0 rows</span>
          <span>naive: 6 multisamples × 8 corners = 48</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] md:grid-cols-4">
          {[
            ["rows per interval", `${rows.toFixed(1)} of ${naive}`],
            ["fewer than naive", `${((1 - rows / naive) * 100).toFixed(0)}%`],
            ["row reads per iteration", `${((rows * samples) / 1e6).toFixed(0)} M`],
            ["bytes per interval", `${bytes.toFixed(0)} B`],
          ].map(([k, v]) => (
            <div key={k} className="rounded border px-2 py-1">
              <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {fmt(samples)} intervals per iteration at {fmt(COUNTS.rays)} rays. Row reads are the forward pass only; the backward scatters the
          same rows with atomic adds. Bytes are the rows × {grid.features} fp32 feature{grid.features > 1 ? "s" : ""} the intervals read from the table; the
          caches decide how many of those reach DRAM.
        </p>
      </div>
    </figure>
  )
}
