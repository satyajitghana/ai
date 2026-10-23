"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The four modded-nanogpt settings that have no tuned recipe, from the data embedded in the blog's
// Figure 1 (xingjianbai.com/reactive-optimizers, read 2026-10-23). Validation loss, lower is better.
// OPAL starts from record #36. Every number here is also in the article's prose.

type Key = "r46" | "r30" | "r36" | "r21" | "r02" | "opal"
const NAMES: Record<Key, string> = {
  opal: "OPAL from #36",
  r46: "#46 (Muon-based)",
  r30: "#30 (Muon-based)",
  r36: "#36 (tuned Muon)",
  r21: "#21 (Shampoo)",
  r02: "#2 (AdamW)",
}

const SETTINGS: { key: string; label: string; values: Record<Key, number> }[] = [
  { key: "quarter", label: "¼ batch", values: { r46: 3.2712, r30: 3.2763, r21: 3.3822, r36: 3.3006, r02: 3.4085, opal: 3.2683 } },
  { key: "chinese", label: "Chinese", values: { r46: 4.0992, r30: 4.165, r21: 4.2977, r36: 4.1845, r02: 4.257, opal: 4.0957 } },
  { key: "thai", label: "Thai", values: { r46: 4.6328, r30: 4.7049, r21: 4.8203, r36: 4.7199, r02: 4.7744, opal: 4.6293 } },
  { key: "kyrgyz", label: "Kyrgyz", values: { r46: 3.8455, r30: 3.9016, r21: 4.0234, r36: 3.9123, r02: 4.0045, opal: 3.8289 } },
]

const SIGMA = 0.0013 // the track's assumed run-to-run standard deviation (OPAL examples README)
const r4 = (x: number) => Math.round(x * 10000) / 10000
const r2 = (x: number) => Math.round(x * 100) / 100

export function RecipeMargins() {
  const [set, setSet] = useState("chinese")
  const s = SETTINGS.find((x) => x.key === set)!
  const keys = (Object.keys(s.values) as Key[]).sort((a, b) => s.values[a] - s.values[b])
  const lo = Math.min(...keys.map((k) => s.values[k]))
  const hi = Math.max(...keys.map((k) => s.values[k]))
  const base = lo - 0.02
  const span = hi - base
  const vsBest = r4(s.values.r46 - s.values.opal)
  const vsStart = r4(s.values.r36 - s.values.opal)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">modded-nanogpt 162M · settings with no tuned recipe · val loss ↓</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="setting">
          {SETTINGS.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={set === x.key}
              onClick={() => setSet(x.key)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                set === x.key ? "border-foreground/30 bg-muted/40 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 px-4 py-4">
        {keys.map((k) => {
          const v = s.values[k]
          const pct = r2(((v - base) / span) * 100)
          return (
            <div key={k} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2 font-mono text-[11px]">
              <span className={cn("truncate", k === "opal" ? "text-sky-700 dark:text-sky-400" : "text-muted-foreground")}>{NAMES[k]}</span>
              <div className="h-3 rounded-sm bg-muted/30">
                <div
                  className={cn("h-3 rounded-sm", k === "opal" ? "bg-sky-600 dark:bg-sky-400" : k === "r36" ? "bg-amber-500/70" : "bg-muted-foreground/40")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-right tabular-nums">{v.toFixed(4)}</span>
            </div>
          )
        })}
        <div className="grid gap-2 pt-3 font-mono text-xs sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">ahead of its own start, #36</div>
            <div className="text-base">{vsStart.toFixed(4)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">ahead of the best off-the-shelf, #46</div>
            <div className="text-base">{vsBest.toFixed(4)}</div>
            <div className="text-muted-foreground">
              {r2(vsBest / SIGMA).toFixed(1)}× the track&apos;s assumed σ of {SIGMA}
            </div>
          </div>
        </div>
        <p className="pt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
          Bars start {"0.02"} below the lowest value. Chinese and Thai OPAL values are means of three runs; the rest are single runs.
        </p>
      </div>
    </figure>
  )
}
