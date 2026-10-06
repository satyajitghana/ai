"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// PixelDense's teacher-composition table (paper, Table 3), as a picker.
//
// Every number is the paper's GenEval Overall on PixelGen-XXL at 512x512 after
// the same 10,000-step fine-tune. The baseline already aligns to DINOv2, so
// "+ SAM2" means DINOv2 and SAM2. The noise band is my arithmetic, not the
// paper's: a binomial standard error for one run of 553 prompts at four images
// each (GenEval's usual setting; this paper does not state it), about 0.0085 at
// a score near 0.8. The paper reports one seed per row.

const SEM = "oklch(0.58 0.13 250)"
const GEO = "oklch(0.60 0.14 150)"
const BOTH = "oklch(0.62 0.17 30)"
const MUTED = "oklch(0.62 0.03 250)"

type Entry = { label: string; v: number; c: string; note?: string }

const GROUPS: { key: string; label: string; entries: Entry[]; note: string }[] = [
  {
    key: "single",
    label: "one extra teacher",
    entries: [
      { label: "DINOv2 only (baseline)", v: 0.7927, c: MUTED },
      { label: "+ SAM2", v: 0.802, c: SEM },
      { label: "+ Depth Anything v2", v: 0.8069, c: GEO },
      { label: "+ Metric3D v2", v: 0.806, c: GEO },
    ],
    note: "Each dense teacher beats DINOv2 alone, and the two geometric ones beat the segmentation one. That ordering is the paper's evidence that spatial structure, not semantics, carries the alignment signal.",
  },
  {
    key: "sum",
    label: "flat sum of four",
    entries: [
      { label: "best single: + Depth Anything v2", v: 0.8069, c: GEO },
      { label: "sum, equal weight", v: 0.8036, c: MUTED },
      { label: "sum, L2-normalized", v: 0.797, c: MUTED },
      { label: "sum, reduced weights", v: 0.8009, c: MUTED },
    ],
    note: "Four teachers through one shared feature land below the best single teacher, under every weighting tried. More targets did not mean more signal.",
  },
  {
    key: "factored",
    label: "factored streams",
    entries: [
      { label: "semantic stream only (DINOv2 + SAM2)", v: 0.8022, c: SEM },
      { label: "geometric stream only (DA2 + M3D)", v: 0.796, c: GEO },
      { label: "both streams + orthogonality", v: 0.8093, c: BOTH },
    ],
    note: "The full model is the top score in the table. Either stream alone is lower, and the geometric stream on its own, with no DINOv2 target, falls below both geometric single-teacher runs.",
  },
  {
    key: "loo",
    label: "leave one out",
    entries: [
      { label: "full PixelDense", v: 0.8093, c: BOTH },
      { label: "without DINOv2", v: 0.794, c: MUTED },
      { label: "without SAM2", v: 0.8027, c: MUTED },
      { label: "without Depth Anything v2", v: 0.8025, c: MUTED },
      { label: "without Metric3D v2", v: 0.8037, c: MUTED },
    ],
    note: "Removing any teacher costs something; removing DINOv2 costs the most. The semantic anchor is still doing the heavy lifting.",
  },
]

const LO = 0.78
const HI = 0.82
const BAND = 0.0085
const pct = (v: number) => (((v - LO) / (HI - LO)) * 100).toFixed(2)

export function TeacherBank() {
  const [sel, setSel] = useState("single")
  const [band, setBand] = useState(true)
  const g = GROUPS.find((x) => x.key === sel) ?? GROUPS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">PixelDense · GenEval Overall by teacher set</span>
        <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <input type="checkbox" checked={band} onChange={(e) => setBand(e.target.checked)} />
          one-run noise band
        </label>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {g.entries.map((e) => (
            <div key={e.label}>
              <div className="flex items-baseline justify-between gap-2 font-mono text-[10px]">
                <span className="truncate text-foreground">{e.label}</span>
                <span className="tabular-nums" style={{ color: e.c }}>
                  {e.v.toFixed(4)}
                </span>
              </div>
              <div className="relative mt-0.5 h-3.5 rounded-sm bg-muted/40">
                <div className="h-3.5 rounded-sm" style={{ width: `${pct(e.v)}%`, background: e.c, opacity: 0.85 }} />
                {band ? (
                  <div
                    className="absolute top-0 h-3.5 border-x border-foreground/40 bg-foreground/10"
                    style={{ left: `${pct(e.v - BAND)}%`, width: `${pct(LO + 2 * BAND)}%` }}
                  />
                ) : null}
                <div
                  className="absolute top-[-2px] h-[18px] border-l border-dashed border-foreground/60"
                  style={{ left: `${pct(0.7927)}%` }}
                  aria-hidden
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span>{LO.toFixed(3)}</span>
          <span>dashed line: DINOv2-only baseline 0.7927</span>
          <span>{HI.toFixed(3)}</span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">{g.note}</div>
      </div>
    </figure>
  )
}
