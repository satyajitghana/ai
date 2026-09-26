"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Each published end-to-end timing, against the only ceiling a step-count cut
// can reach: 40 / N forward passes, because the base pipeline runs no CFG.
//
// Sources, all reported, none re-run here:
// - Pruna: the four latency charts on the PrunaAI/Pruna-Qwen-Image-2.1 card.
//   One H100 80GB, BF16, batch 1, median of 3 after one warm-up, prompt
//   encoding + denoising + decoding. Base: 40 steps, KV cache on. Adapters:
//   5 or 8 steps, KV cache off, LoRA unmerged, no CFG, no compile.
// - Viggle: compare/cases.json in the Viggle/Qwen-Image-2.1-viggle-turbo Space.
//   One B200, one pipeline call each after warm-up, seed 42, prompt enhancement
//   off; base 40 steps with true_cfg_scale 1.0, turbo v0.2.1 at 6 steps.
//   Times are stored to 0.1 s, so no per-step fit is attempted on them.
//
// The Pruna "fit" is reasoned arithmetic: with the fixed cost F (encode +
// decode) and the per-step cost s shared by the 5- and 8-step runs,
//   s = (t8 - t5) / 3,  F = t5 - 5 s,  base step = (t40 - F) / 40.
// It assumes the base's fixed cost equals the adapters'. Only + - * / here.

type Row = {
  task: string
  base: number
  student: number
  steps: number
  fit?: { t5: number; t8: number }
}

const PRUNA: Row[] = [
  { task: "text-to-image, 1024", base: 6.1, student: 1.61, steps: 8, fit: { t5: 1.06, t8: 1.61 } },
  { task: "text-to-image, 1024", base: 6.1, student: 1.06, steps: 5 },
  { task: "text-to-image, 2048", base: 31.44, student: 7.6, steps: 8, fit: { t5: 4.98, t8: 7.6 } },
  { task: "text-to-image, 2048", base: 31.44, student: 4.98, steps: 5 },
  { task: "edit, 1024", base: 7.05, student: 2.01, steps: 8, fit: { t5: 1.43, t8: 2.01 } },
  { task: "edit, 1024", base: 7.05, student: 1.43, steps: 5 },
  { task: "edit, 2048", base: 34.4, student: 8.54, steps: 8, fit: { t5: 5.73, t8: 8.54 } },
  { task: "edit, 2048", base: 34.4, student: 5.73, steps: 5 },
]

const VIGGLE: Row[] = [
  { task: "text-to-image, ~4 MP, median of 11", base: 26.1, student: 4.7, steps: 6 },
  { task: "edit, 1536² area, median of 21", base: 14.2, student: 3.0, steps: 6 },
  { task: "edit with 10 references", base: 36.6, student: 9.9, steps: 6 },
  { task: "all 32 examples, summed", base: 633.7, student: 126.3, steps: 6 },
]

const SOURCES = {
  pruna: {
    label: "Pruna, one H100",
    rows: PRUNA,
    note: "Base with its KV cache on, adapters with it off and unmerged. The 6.3x headline is the 5-step adapter at 2048, a resolution the card says is outside its training.",
  },
  viggle: {
    label: "Viggle, one B200",
    rows: VIGGLE,
    note: "Both arms through the same diffusers pipeline, KV cache at its default (on). Editing gains less because the reference encoding and the first, uncached step do not shrink with the step count.",
  },
} as const

const fmt = (v: number) => (v >= 100 ? v.toFixed(1) : v.toFixed(2))

export function SpeedLedger() {
  const [src, setSrc] = useState<keyof typeof SOURCES>("pruna")
  const [showFit, setShowFit] = useState(false)
  const s = SOURCES[src]

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-speed-ledger={`${src}-${showFit ? 1 : 0}`}
      aria-label="Published end-to-end speedups of the two few-step Qwen-Image-2.1 releases against the forward-pass ceiling"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {(Object.keys(SOURCES) as (keyof typeof SOURCES)[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSrc(k)}
            aria-pressed={src === k}
            className={cn(
              "rounded-sm border px-2.5 py-0.5 font-mono text-xs",
              src === k
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {SOURCES[k].label}
          </button>
        ))}
        {src === "pruna" && (
          <label className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showFit}
              onChange={(e) => setShowFit(e.target.checked)}
              className="accent-foreground"
            />
            per-step fit
          </label>
        )}
      </div>

      <ul className="my-0 list-none space-y-3 px-4 py-4 pl-4">
        {s.rows.map((r, i) => {
          const measured = r.base / r.student
          const ceiling = 40 / r.steps
          const share = measured / ceiling
          const f = r.fit
          const step = f ? (f.t8 - f.t5) / 3 : 0
          const fixed = f ? f.t5 - 5 * step : 0
          const baseStep = f ? (r.base - fixed) / 40 : 0
          return (
            <li key={`${r.task}-${r.steps}-${i}`} className="my-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
                <span className="text-muted-foreground">
                  {r.task} · {r.steps} steps
                </span>
                <span className="tabular-nums">
                  {fmt(r.base)} s → {fmt(r.student)} s ={" "}
                  <span className="font-medium text-foreground">{measured.toFixed(2)}x</span>
                  <span className="text-muted-foreground">
                    {" "}
                    of {ceiling.toFixed(2)}x ({Math.round(share * 100)}%)
                  </span>
                </span>
              </div>
              <div className="relative mt-1 h-3 overflow-hidden rounded-sm bg-foreground/10">
                <div
                  className="h-full bg-foreground/70"
                  style={{ width: `${(share * 100).toFixed(1)}%` }}
                />
              </div>
              {showFit && src === "pruna" && f && (
                <p className="mt-1 mb-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  fit: adapter step {step.toFixed(3)} s, base step {baseStep.toFixed(3)} s (
                  {Math.round((step / baseStep - 1) * 100)}% dearer), fixed {fixed.toFixed(2)} s
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Bars are the measured speedup as a share of 40 / N, the forward-pass ratio. Timings
        are the publishers&apos;, not mine. {s.note}
      </figcaption>
    </figure>
  )
}
