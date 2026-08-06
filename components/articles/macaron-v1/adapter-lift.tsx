"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The comparison that actually isolates MoL: each Macaron variant against the
// frozen base it was built on, rather than against the frontier. Venti vs
// GLM-5.2, Tall vs Qwen3.6-35B-A3B. Everything else in the release table is a
// cross-lab comparison; this one is the controlled experiment, because the only
// difference between the two bars is the adapters. Numbers from Mind Lab's own
// benchmark table ("--" entries were not run and are omitted).

const ACCENT = "oklch(0.58 0.15 265)"
const BASE = "oklch(0.62 0.03 250)"

type Row = { bench: string; base: number; tuned: number }

const VARIANTS = {
  venti: {
    label: "Venti",
    baseLabel: "GLM-5.2",
    tunedLabel: "Macaron V1 Venti",
    note: "744B frozen base + 4 x 1B adapters",
    rows: [
      { bench: "UI4ABench", base: 67.1, tuned: 87.8 },
      { bench: "PinchBench", base: 88.1, tuned: 94.0 },
      { bench: "SWE Verified", base: 80.4, tuned: 85.6 },
      { bench: "TerminalBench 2.1", base: 82.7, tuned: 87.6 },
      { bench: "VitaBench", base: 55.8, tuned: 60.0 },
      { bench: "ChatBench", base: 54.5, tuned: 58.3 },
      { bench: "LivingBench", base: 60.5, tuned: 64.0 },
      { bench: "DeepSWE", base: 54.9, tuned: 58.4 },
      { bench: "ClawGym", base: 74.6, tuned: 77.7 },
      { bench: "VitaBench2", base: 43.1, tuned: 46.0 },
      { bench: "SWE Atlas QnA", base: 48.9, tuned: 49.5 },
      { bench: "T3-Bench", base: 69.1, tuned: 69.3 },
    ] as Row[],
  },
  tall: {
    label: "Tall",
    baseLabel: "Qwen3.6-35B-A3B",
    tunedLabel: "Macaron V1 Tall",
    note: "35B-class base + adapters",
    rows: [
      { bench: "UI4ABench", base: 33.9, tuned: 59.3 },
      { bench: "ChatBench", base: 48.0, tuned: 54.9 },
      { bench: "ClawGym", base: 58.6, tuned: 64.0 },
      { bench: "PinchBench", base: 82.5, tuned: 86.2 },
      { bench: "TerminalBench 2.1", base: 52.5, tuned: 56.2 },
      { bench: "SWE Verified", base: 73.4, tuned: 75.4 },
      { bench: "LivingBench", base: 47.1, tuned: 48.4 },
    ] as Row[],
  },
} as const

type Key = keyof typeof VARIANTS

export function AdapterLift() {
  const [k, setK] = useState<Key>("venti")
  const v = VARIANTS[k]
  const max = 100

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what the adapters buy over the frozen base</span>
        <div className="flex gap-1">
          {(Object.keys(VARIANTS) as Key[]).map((key) => (
            <button key={key} type="button" onClick={() => setK(key)} className={chip(k === key)}>
              {VARIANTS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BASE }} /> {v.baseLabel} (frozen base)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} /> {v.tunedLabel}
          </span>
          <span className="ml-auto">{v.note}</span>
        </div>

        <div className="space-y-2">
          {v.rows.map((r) => {
            const delta = Math.round((r.tuned - r.base) * 10) / 10
            return (
              <div key={r.bench} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto_auto] items-center gap-x-3">
                <div className="truncate font-mono text-[11px] text-muted-foreground">{r.bench}</div>
                <div className="relative h-5 rounded-sm bg-muted/30">
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(r.base / max) * 100}%`, background: BASE }} />
                  <div
                    className="absolute inset-y-0 rounded-r-sm"
                    style={{ left: `${(r.base / max) * 100}%`, width: `${((r.tuned - r.base) / max) * 100}%`, background: ACCENT, minWidth: 2 }}
                  />
                </div>
                <div className="w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {r.base} &rarr; {r.tuned}
                </div>
                <div className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums" style={{ color: ACCENT }}>
                  +{delta}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read the coloured segment as the adapter contribution. Most of it is a real but modest{" "}
          <span className="text-foreground">3 to 6 points</span>, and on{" "}
          <span className="text-foreground">T3-Bench</span>{" "}and{" "}
          <span className="text-foreground">SWE Atlas QnA</span>{" "}it is inside noise at +0.2 and +0.6. Then there
          is UI4ABench: <span style={{ color: ACCENT }}>+20.7</span>{" "}on Venti and{" "}
          <span style={{ color: ACCENT }}>+25.4</span>{" "}on Tall. That is the clearest evidence the method does
          something — and also the place to be most careful, because UI4ABench is Mind Lab&rsquo;s own benchmark
          measuring the capability they built a dedicated adapter for.
        </p>
      </div>
    </figure>
  )
}
