"use client"

// What "2.03M code pairs" counts. Rows and distinct sample ids per source in the
// dataset's default config (`load_dataset("ilabai/3dcodeverse", split="text")`),
// MEASURED by reading the `id` and `source` columns of all 30 parquet shards
// under data/text/ with HTTP range requests (17 October 2026, revision
// 5bae4cb). The rows-per-id ratio is REASONED (division). The flag on
// 3dcodebench is from the paper's Appendix B.2/C.1, which holds every 3DCodeBench
// factory and seeded instance out of training.
//
// SSR-safe: plain state, no effects. Widths use + - * / only.

import { useState } from "react"

type Src = { key: string; dialect: string; rows: number; ids: number; heldOut?: boolean }

const SOURCES: Src[] = [
  { key: "shadertoy", dialect: "GLSL", rows: 972014, ids: 142279 },
  { key: "deepcad", dialect: "CadQuery", rows: 765676, ids: 128201 },
  { key: "3dcodebench", dialect: "Blender Python", rows: 170188, ids: 29818, heldOut: true },
  { key: "articraft", dialect: "CadQuery, URDF", rows: 71850, ids: 13028 },
  { key: "bioinspired3d", dialect: "Blender Python", rows: 33287, ids: 6343 },
  { key: "thingiverse", dialect: "OpenSCAD", rows: 6989, ids: 1193 },
  { key: "threejs_coding_agent", dialect: "three.js", rows: 3050, ids: 1525 },
  { key: "animation2code", dialect: "HTML/JS", rows: 2834, ids: 1051 },
  { key: "blender_coding_agent", dialect: "Blender Python", rows: 2398, ids: 1271 },
]

const TOTAL_ROWS = SOURCES.reduce((n, s) => n + s.rows, 0)
const TOTAL_IDS = SOURCES.reduce((n, s) => n + s.ids, 0)
const MAX_ROWS = SOURCES[0].rows
const ACCENT = "oklch(0.58 0.13 250)"
const WARN = "oklch(0.62 0.17 35)"

// Thousands separators without Intl, so server and client print the same string.
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

export function RowLedger() {
  const [unit, setUnit] = useState<"rows" | "ids">("rows")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>split=&quot;text&quot;, by source</span>
        <span className="text-muted-foreground/70">measured from the parquet shards</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex gap-1.5" role="tablist" aria-label="Counting unit">
          {(
            [
              ["rows", `rows (${fmt(TOTAL_ROWS)})`],
              ["ids", `distinct ids (${fmt(TOTAL_IDS)})`],
            ] as const
          ).map(([k, label]) => {
            const on = unit === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setUnit(k)}
                className={
                  "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                  (on ? "text-background" : "bg-background/50 text-muted-foreground hover:text-foreground")
                }
                style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 space-y-2">
          {SOURCES.map((s) => {
            const v = unit === "rows" ? s.rows : s.ids
            const w = (v / MAX_ROWS) * 100
            return (
              <div key={s.key} className="grid grid-cols-[9.5rem_1fr] items-center gap-2 sm:grid-cols-[12rem_1fr]">
                <div className="truncate font-mono text-[11px]">
                  {s.key}
                  <span className="block text-[10px] text-muted-foreground">{s.dialect}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3.5 flex-1 rounded bg-muted/50">
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.max(w, 0.4).toFixed(2)}%`, background: s.heldOut ? WARN : ACCENT }}
                    />
                  </div>
                  <span className="w-[8.5rem] shrink-0 text-right font-mono text-[11px] tabular-nums">
                    {fmt(v)}
                    <span className="text-muted-foreground"> · {(s.rows / s.ids).toFixed(1)}×</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        The right-hand ratio is rows per distinct id. One program appears once per caption type and
        once per export format, and multi-pass shaders add a row per pass. In orange: 170,188 rows
        built from the 3DCodeBench generators, which the paper holds out of every training mixture
        but which the default split includes.
      </figcaption>
    </figure>
  )
}
