"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Five published 5-shot MMLU results, all at the same ~2-3GB artifact size, split by
// whether the ternary format was present *during* training or applied after. Drag the
// threshold and watch the two routes separate: the rounded checkpoints sit at (and
// slightly below) the 25.0 chance line no matter where you set the bar, while the three
// natively trained models clear it — though "two-bit, training-aware" is the fragile
// one: push the threshold past +22.2 points and it flips from clearing to failing.
// Numbers are self-reported by Fermion Research, compiled from public releases; there is
// no independent replication of any of the five.

const ACCENT = "oklch(0.62 0.17 250)" // trained-in-format, clears
const FAIL = "oklch(0.6 0.19 25)" // rounded-after-training, at chance
const CHANCE = 25.0

type Row = {
  label: string
  sub: string
  value: number
  trainedInFormat: boolean
  highlight?: boolean
}

const ROWS: Row[] = [
  { label: "rounded after training", sub: "8B checkpoint · ~3GB class", value: 24.2, trainedInFormat: false },
  { label: "rounded after training", sub: "8B checkpoint · ~3GB class", value: 24.7, trainedInFormat: false },
  { label: "two-bit, training-aware", sub: "~2GB class", value: 47.24, trainedInFormat: true },
  { label: "Ternary-Bonsai-8B", sub: "2.18 GB", value: 65.75, trainedInFormat: true },
  { label: "Neutrino-1 8B", sub: "2.56 GB", value: 72.1, trainedInFormat: true, highlight: true },
]

const AXIS_MAX = 80

export function RoundingCliff() {
  const [threshold, setThreshold] = useState(22)

  const clears = ROWS.filter((r) => r.value - CHANCE >= threshold).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the rounding cliff · MMLU, 5-shot</span>
        <span className="text-muted-foreground/50">self-reported, no third-party replication</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2.5">
          {ROWS.map((r, i) => {
            const gap = Number((r.value - CHANCE).toFixed(2))
            const pass = gap >= threshold
            const pct = (r.value / AXIS_MAX) * 100
            const chancePct = (CHANCE / AXIS_MAX) * 100
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-right font-mono text-[11px] leading-tight text-muted-foreground sm:w-52">
                  {r.label}
                  <span className="block text-muted-foreground/60">{r.sub}</span>
                </span>
                <div className="relative h-7 flex-1">
                  <div
                    className="absolute top-0 bottom-0 w-px border-l border-dashed"
                    style={{ left: `${chancePct}%`, borderColor: "var(--muted-foreground)" }}
                  />
                  <div
                    className="absolute top-1/2 h-5 -translate-y-1/2 rounded-sm transition-[width,background-color] duration-200"
                    style={{
                      width: `${Math.max(pct, 0.5)}%`,
                      background: r.trainedInFormat ? (pass ? ACCENT : "var(--muted-foreground)") : FAIL,
                      opacity: r.trainedInFormat && !pass ? 0.45 : 1,
                    }}
                  />
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] tabular-nums",
                      r.highlight ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}
                    style={{ left: `${pct}%` }}
                  >
                    {r.value.toFixed(2)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-1 flex items-center gap-3 pl-[10.5rem] sm:pl-[13.5rem]">
          <span className="w-px shrink-0" aria-hidden />
          <span className="font-mono text-[10px] text-muted-foreground">
            chance ({CHANCE.toFixed(1)})
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>clears-chance threshold (points above {CHANCE.toFixed(1)})</span>
            <span>
              +{threshold} pts ·{" "}
              <span style={{ color: ACCENT }}>{clears} of 5</span>{" "}clear
            </span>
          </div>
          <Range
            min={0}
            max={45}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Slide the threshold up and the two <span style={{ color: FAIL }}>rounded-after-training</span>{" "}checkpoints
          never move off the chance line — they score{" "}
          <em>below</em>{" "}25.0, so no positive threshold ever counts them. The three{" "}
          <span style={{ color: ACCENT }}>trained-in-format</span>{" "}models start out clearing every threshold up to{" "}
          22 points, which is the line Fermion draws in the post. Push past{" "}
          <span className="text-foreground">+22.2</span>{" "}and the weakest of the three — the 2-bit,
          training-aware model at 47.24 — flips to failing first; Neutrino-1 8B (72.1) and Ternary-Bonsai-8B (65.75)
          hold until roughly +40 and +47 points respectively.
        </p>
      </div>
    </figure>
  )
}
