"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MiniCPM-V 4.7 35B-A3B minus Qwen3.6-35B-A3B, benchmark by benchmark, from
// OpenBMB's own vision-language table (MiniCPM-o repo,
// assets/minicpmv4.7/overall_performance_35ba3b_instruct.png; transcribed by
// hand from the image and re-read twice). All rows are instruct mode, and all
// numbers are OpenBMB's ("public reports and our local evaluation using
// official checkpoints"). MMHal-Hallrate is lower-is-better, so its sign is
// flipped: positive always means MiniCPM is ahead. MMHal-Score is on a 0-6
// scale, so its differences are small by construction.
// Only + - * / and Math.round reach the DOM.

type R = [name: string, x4: number, x16: number, qwen: number, lowerBetter?: boolean]

const ROWS: R[] = [
  ["MMBench", 91.72, 90.87, 86.76],
  ["MMStar", 80.67, 80.13, 76.0],
  ["MMT-Bench", 75.47, 75.12, 72.53],
  ["SimpleVQA", 54.14, 51.41, 54.4],
  ["MMMU", 80.22, 80.0, 77.44],
  ["MathVista", 88.0, 87.3, 84.4],
  ["MMMU-Pro", 69.71, 67.66, 69.88],
  ["MathVerse_MINI", 86.45, 84.8, 82.74],
  ["MathVision", 74.24, 72.93, 74.24],
  ["OCRBench", 91.2, 90.4, 86.0],
  ["OCRBench_v2", 68.47, 65.67, 66.5],
  ["OmniDocBench_v1.6", 94.24, 93.25, 80.17],
  ["CharXiv_Reasoning", 75.6, 69.2, 67.5],
  ["CCOCR", 81.14, 78.29, 82.33],
  ["TextVQA_VAL", 84.99, 81.72, 83.98],
  ["BLINK", 70.33, 68.12, 66.91],
  ["MMSI-Bench", 16.0, 15.2, 10.7],
  ["Hallusion-Bench", 63.83, 64.42, 62.06],
  ["MMHal-Score", 4.72, 4.67, 4.96],
  ["MMHal-Hallrate", 21.88, 22.92, 25.0, true],
  ["RefCOCO", 90.93, 89.61, 90.97],
  ["ScreenSpot", 86.99, 85.01, 92.94],
  ["MM-IFEval", 65.41, 64.62, 62.85],
  ["Video-MME", 76.4, 74.7, 75.7],
  ["LongVideoBench", 68.9, 67.6, 63.1],
  ["MotionBench", 68.12, 68.02, 67.87],
]

const r2 = (n: number) => Math.round(n * 100) / 100
const SCALE = 15 // points for a full half-bar

export function BenchDelta() {
  const [mode, setMode] = useState<"4x" | "16x">("4x")
  const deltas = ROWS.map(([name, a, b, q, lower]) => {
    const m = mode === "4x" ? a : b
    const d = lower ? q - m : m - q
    return { name, d: r2(d), m, q }
  })
  const wins = deltas.filter((x) => x.d > 0).length
  const losses = deltas.filter((x) => x.d < 0).length
  const ties = deltas.length - wins - losses

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          MiniCPM-V 4.7 35B-A3B minus Qwen3.6-35B-A3B, instruct mode
        </span>
        <div className="flex rounded-md border p-0.5" role="group" aria-label="MiniCPM compression mode">
          {(["4x", "16x"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={m === mode}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                m === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <p className="mb-3 font-mono text-xs text-foreground">
          {wins} ahead &middot; {losses} behind &middot; {ties} tied, of 26
        </p>
        <div className="space-y-1">
          {deltas.map((x) => {
            const w = Math.min(50, (Math.abs(x.d) / SCALE) * 50)
            return (
              <div key={x.name} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3.5rem] items-center gap-2">
                <span className="truncate font-mono text-[10px] text-muted-foreground" title={x.name}>
                  {x.name}
                </span>
                <div className="relative h-3.5 rounded-sm bg-muted/30">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <div
                    className="absolute inset-y-0"
                    style={{
                      left: x.d >= 0 ? "50%" : `${50 - w}%`,
                      width: `${w}%`,
                      background: x.d >= 0 ? "#7c3aed" : "#f59e0b",
                      opacity: 0.75,
                    }}
                    title={`${x.m} vs ${x.q}`}
                  />
                </div>
                <span
                  className={cn(
                    "text-right font-mono text-[10px]",
                    x.d > 0 ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {x.d > 0 ? "+" : ""}
                  {x.d}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 font-mono text-[9px] leading-4 text-muted-foreground">
          Bars clip at &plusmn;15 points. MMHal-Hallrate is lower-is-better, so its sign is flipped.
          Qwen3.6-35B-A3B is shown at its own fixed 4x compression. Every number is from
          OpenBMB&rsquo;s chart, not an independent run.
        </p>
      </div>
    </figure>
  )
}
