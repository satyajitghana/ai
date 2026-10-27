"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The paper's Table 6, stage by stage on identical VGGT-Omega predictions. REPORTED, not re-run.
// Bars are drawn as a share of each dataset's own baseline so a 77 m and a 0.09 m error can sit in one chart.

type Row = { id: string; label: string; frames: string; ate: number[]; rot: number[]; trans: number[] }

const STAGES = ["Baseline (chunks as predicted)", "Layout only (stage I)", "Full (stage I + II)"]

const ROWS: Row[] = [
  { id: "kitti", label: "KITTI", frames: "4,541 frames", ate: [77.42, 9.75, 9.73], rot: [0.895, 0.202, 0.154], trans: [2.358, 0.131, 0.093] },
  { id: "vbr", label: "VBR", frames: "about 12,383 frames", ate: [41.91, 22.44, 22.44], rot: [2.117, 0.617, 0.587], trans: [0.256, 0.075, 0.059] },
  { id: "oxford", label: "Oxford", frames: "about 320 frames", ate: [9.861, 1.599, 1.579], rot: [5.757, 0.579, 0.408], trans: [4.044, 0.173, 0.104] },
]

const METRICS = [
  { id: "ate", label: "ATE (m)", note: "where the whole trajectory ends up" },
  { id: "rot", label: "RPE rotation (deg)", note: "frame-to-frame rotation error" },
  { id: "trans", label: "RPE translation (m)", note: "frame-to-frame translation error" },
] as const

const FILL = ["var(--muted-foreground)", "oklch(0.62 0.13 250)", "oklch(0.62 0.15 150)"]

const fmt = (v: number) => (v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v.toFixed(3))

export function StageLedger() {
  const [m, setM] = useState<(typeof METRICS)[number]["id"]>("ate")
  const meta = METRICS.find((x) => x.id === m)!
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        reported · HiP3R paper, Table 6, VGGT-Omega predictions · bar = share of that dataset&apos;s own baseline
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3" role="tablist" aria-label="Metric">
        {METRICS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={m === x.id}
            onClick={() => setM(x.id)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              m === x.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-xs text-muted-foreground">{meta.note}. Lower is better.</p>
      <div className="space-y-5 p-3">
        {ROWS.map((r) => {
          const v = r[m]
          return (
            <div key={r.id}>
              <div className="mb-1.5 flex items-baseline justify-between font-mono text-xs">
                <span className="font-medium">{r.label}</span>
                <span className="text-muted-foreground">{r.frames}</span>
              </div>
              <div className="space-y-1">
                {v.map((x, i) => (
                  <div key={i} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2 text-xs sm:grid-cols-[13rem_1fr_4.5rem]">
                    <span className="truncate text-muted-foreground">{STAGES[i]}</span>
                    <div className="h-3 rounded-sm bg-muted">
                      <div className="h-3 rounded-sm" style={{ width: `${Math.max(1.5, (x / v[0]) * 100)}%`, background: FILL[i] }} />
                    </div>
                    <span className="text-right font-mono tabular-nums">{fmt(x)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        Stage I buys almost all the ATE. Stage II moves ATE by 0.2% on KITTI and 0.0% on VBR, and the relative errors by 5 to 40%.
      </figcaption>
    </figure>
  )
}
