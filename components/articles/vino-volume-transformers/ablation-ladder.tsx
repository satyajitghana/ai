"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// VINO's ablation path, linear-probing mIoU, as reported in the paper's
// Tables 1-4 (ScanNet200) and Table 14 (both datasets). Each row is one change
// applied on top of the row above it, except the two marked "branch", which
// are the alternatives the paper rejected. The dashed line is the fully
// supervised Volt-B with its decoder (Table 5).

type Row = { name: string; group: string; s200: number; spp: number; branch?: boolean; note: string }

const ROWS: Row[] = [
  { name: "Sonata, PTv3 (reproduced)", group: "baseline", s200: 28.3, spp: 38.0, note: "Sonata's recipe on its own hierarchical backbone." },
  { name: "Sonata, Volt", group: "baseline", s200: 29.6, spp: 39.1, note: "Same recipe, plain volume transformer. Features come straight off the output tokens." },
  { name: "Simpler scheduling", group: "baseline", s200: 29.5, spp: 39.1, note: "Constant LR after warm-up, fixed weight decay. Matches, and no longer needs a fixed run length." },
  { name: "No masked loss", group: "local", s200: 28.9, spp: 38.4, note: "Drop masked prediction to study local prediction alone: only 0.6 lower." },
  { name: "Asymmetric augm.", group: "local", s200: 31.3, spp: 39.3, note: "Teacher sees clean global views; only the student's local views are distorted." },
  { name: "Decoupled head", group: "local", s200: 32.8, spp: 40.9, note: "Teacher targets come from its own prototypes plus Sinkhorn-Knopp, learned by swapped clustering." },
  { name: "+ Masked pred.", group: "masked", s200: 35.6, spp: 42.2, note: "Masked tokens leave the encoder; a cross-attention-only predictor fills them in." },
  { name: "+ Fix artifacts", group: "masked", s200: 35.9, spp: 42.4, note: "Average, not sum, the voxels in a patch. End of stage 1: 3D only." },
  { name: "Align from start", group: "2d", s200: 37.2, spp: 44.8, branch: true, note: "Rejected: 2D distillation from step 0 instead of as a second stage." },
  { name: "Raw embeddings", group: "2d", s200: 38.6, spp: 46.1, branch: true, note: "Rejected: regress DINOv2 features directly, as Concerto does." },
  { name: "Prototypes", group: "2d", s200: 40.4, spp: 48.2, note: "Stage 2: predict view-consistent prototype assignments of DINOv2 patches." },
]

const SUP = { s200: 36.2, spp: 51.7 }

const COLORS: Record<string, string> = {
  baseline: "oklch(0.6 0.03 260)",
  local: "oklch(0.6 0.13 250)",
  masked: "oklch(0.62 0.15 300)",
  "2d": "oklch(0.64 0.15 40)",
}

export function AblationLadder() {
  const [ds, setDs] = useState<"s200" | "spp">("s200")
  const [sel, setSel] = useState(10)
  const lo = ds === "s200" ? 25 : 35
  const hi = ds === "s200" ? 42 : 53
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100
  const r = ROWS[sel]
  const first = ROWS[0][ds]
  const sup = SUP[ds]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>linear-probe mIoU, one change at a time · reported</span>
        <div className="flex gap-1.5">
          {(
            [
              ["s200", "ScanNet200"],
              ["spp", "ScanNet++"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDs(k)}
              aria-pressed={ds === k}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                ds === k ? "border-foreground/40 bg-foreground/5 text-foreground" : "hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <ul className="space-y-1">
          {ROWS.map((row, i) => {
            const prev = i === 0 ? null : ROWS.slice(0, i).filter((x) => !x.branch).at(-1)
            const delta = prev ? row[ds] - prev[ds] : null
            return (
              <li key={row.name}>
                <button
                  type="button"
                  onClick={() => setSel(i)}
                  aria-pressed={sel === i}
                  className={cn(
                    "grid w-full cursor-pointer grid-cols-[9.5rem_1fr_3.2rem] items-center gap-2 rounded-md px-1.5 py-0.5 text-left font-mono text-[11px] transition-colors sm:grid-cols-[12rem_1fr_3.5rem]",
                    sel === i ? "bg-foreground/5" : "hover:bg-foreground/[0.03]",
                    row.branch && "opacity-60",
                  )}
                >
                  <span className={cn("truncate", sel === i ? "text-foreground" : "text-muted-foreground")}>
                    {row.branch ? "↳ " : ""}
                    {row.name}
                  </span>
                  <span className="relative h-3.5">
                    <span
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{
                        width: `${pct(row[ds])}%`,
                        background: COLORS[row.group],
                        opacity: row.branch ? 0.45 : 0.85,
                      }}
                    />
                    <span
                      className="absolute inset-y-[-3px] w-px border-l border-dashed border-foreground/50"
                      style={{ left: `${pct(sup)}%` }}
                    />
                  </span>
                  <span className="text-right text-foreground">
                    {row[ds].toFixed(1)}
                    {delta !== null && !row.branch && (
                      <span className={cn("ml-1 text-[9.5px]", delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                        {delta >= 0 ? "+" : ""}
                        {delta.toFixed(1)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 rounded-md border px-2.5 py-1.5 font-mono text-[11px]">
          <div className="text-muted-foreground">{r.name}</div>
          <div className="text-foreground">{r.note}</div>
          <div className="mt-1 text-muted-foreground">
            {r[ds].toFixed(1)} mIoU · {r[ds] - first >= 0 ? "+" : ""}
            {(r[ds] - first).toFixed(1)} over the reproduced Sonata · supervised Volt-B with decoder: {sup.toFixed(1)}
          </div>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          Dashed line: supervised Volt-B, trained end to end with a decoder. Faded rows are branches the paper tried
          and dropped; deltas compare each kept row with the kept row above it. Axis starts at {lo}.
        </p>
      </div>
    </figure>
  )
}
