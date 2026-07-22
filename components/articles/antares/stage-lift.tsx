"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The thesis in three bars. The IBM Granite 4.0 1B backbone, untrained for this
// task, scores 0.000 File F1 — it can't do the job at all. Supervised fine-
// tuning on security + terminal-search data gets it most of the way; GRPO (RL
// on verifiable localization rewards over full agent trajectories) closes the
// gap. Pick a size and watch the build-up — every Antares GRPO model clears
// GLM-5.2 (753B). Numbers: Antares model card / technical report (VLoc Bench).

const ACCENT = "oklch(0.62 0.13 195)"

const SIZES = [
  { key: "350M", sft: 0.108, grpo: 0.135 },
  { key: "1B", sft: 0.188, grpo: 0.209 },
  { key: "3B", sft: 0.198, grpo: 0.223 },
]

const GLM = 0.186 // GLM-5.2, 753B — best open-weight baseline
const GPT = 0.221 // GPT-5.5, frontier
const MAX = 0.24

export function StageLift() {
  const [size, setSize] = useState("1B")
  const row = SIZES.find((s) => s.key === size) ?? SIZES[1]

  const bars = [
    { label: "Granite 4.0 backbone", sub: "untrained", value: 0.0 },
    { label: "+ SFT", sub: "security + search data", value: row.sft },
    { label: "+ GRPO", sub: "RL on localization rewards", value: row.grpo },
  ]

  const pct = (v: number) => `${(v / MAX) * 100}%`

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">File F1 · backbone → SFT → GRPO</span>
        <div className="flex gap-1">
          {SIZES.map((s) => (
            <button key={s.key} type="button" onClick={() => setSize(s.key)} className={chip(size === s.key)}>Antares-{s.key}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="relative">
          {/* reference lines */}
          {[
            { v: GLM, label: "GLM-5.2 · 753B", color: "oklch(0.6 0.03 260)" },
            { v: GPT, label: "GPT-5.5 · frontier", color: "oklch(0.6 0.03 260)" },
          ].map((r) => (
            <div key={r.label} className="pointer-events-none absolute top-0 z-10 h-full" style={{ left: pct(r.v) }}>
              <div className="h-full border-l border-dashed" style={{ borderColor: r.color }} />
              <span className="absolute -top-0 left-1 whitespace-nowrap font-mono text-[8.5px] text-muted-foreground">{r.label}</span>
            </div>
          ))}

          <div className="space-y-3 pt-4">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">{b.label} <span className="text-foreground/40">· {b.sub}</span></span>
                  <span className="tabular-nums text-foreground">{b.value.toFixed(3)}</span>
                </div>
                <div className="h-5 overflow-hidden rounded bg-muted/40">
                  <div
                    className="h-full rounded transition-all duration-500 ease-out"
                    style={{ width: pct(b.value), background: b.value === 0 ? "transparent" : ACCENT }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The backbone starts at <span style={{ color: ACCENT }}>0.000</span> — same weights, no idea how to
          do the job. Training is the entire difference, and even the 350M GRPO model beats a
          753B open model. GRPO adds a real slice on top of SFT
          (<span className="tabular-nums">+{((row.grpo - row.sft)).toFixed(3)}</span> at {size}): learning to
          verify and stop, not just imitate.
        </p>
      </div>
    </figure>
  )
}
