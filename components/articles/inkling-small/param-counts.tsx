"use client"

import { useState } from "react"

// Claimed vs measured parameter counts. Both numbers are real:
//  - "stated" is what Thinking Machines' blog prose and the HF model-index table
//    both say (276B / 975B total).
//  - "measured" is the HF API's own `safetensors.total` field for each repo — the
//    literal count of parameters in the released weight files — fetched directly
//    from https://huggingface.co/api/models/thinkingmachines/{Inkling-Small,Inkling}
//    on 2026-08-03: 265,956,439,090 and 952,377,623,626.
// No accusation implied — the numbers are simply shown side by side. All values
// below are fixed constants from that verification, not computed at request time.

const STATED_ACCENT = "oklch(0.66 0.03 275)" // muted outline — the quoted figure
const MEASURED_ACCENT = "oklch(0.58 0.16 285)" // solid — the safetensors figure

type Model = "inkling-small" | "inkling"

const DATA = {
  "inkling-small": {
    label: "Inkling-Small",
    stated: 276,
    measured: 265.956439090,
  },
  inkling: {
    label: "Inkling",
    stated: 975,
    measured: 952.377623626,
  },
} as const

const MAX_B = 1000

function Bar({
  value,
  max,
  color,
  filled,
  label,
}: {
  value: number
  max: number
  color: string
  filled: boolean
  label: string
}) {
  const pct = Math.max((value / max) * 100, 1)
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">{label}</span>
      <div className="relative h-5 flex-1 rounded-sm bg-muted/30">
        <div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{
            width: `${pct}%`,
            background: filled ? color : "transparent",
            border: filled ? undefined : `2px solid ${color}`,
            boxSizing: "border-box",
          }}
        />
      </div>
      <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
        {value.toFixed(2)}B
      </span>
    </div>
  )
}

export function ParamCounts() {
  const [model, setModel] = useState<Model>("inkling-small")
  const [view, setView] = useState<"totals" | "ratio">("totals")

  const d = DATA[model]
  const delta = d.stated - d.measured
  const deltaPctOfMeasured = (delta / d.measured) * 100

  const statedRatio = (DATA["inkling-small"].stated / DATA["inkling"].stated) * 100
  const measuredRatio = (DATA["inkling-small"].measured / DATA["inkling"].measured) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stated vs measured total parameters</span>
        <span className="text-muted-foreground/60">HF safetensors API, 2026-08-03</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setView("totals")}
              className={
                "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                (view === "totals"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
              aria-pressed={view === "totals"}
            >
              totals (B)
            </button>
            <button
              type="button"
              onClick={() => setView("ratio")}
              className={
                "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                (view === "ratio"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
              aria-pressed={view === "ratio"}
            >
              ratio (Small ÷ Inkling)
            </button>
          </div>

          {view === "totals" && (
            <div className="inline-flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setModel("inkling-small")}
                className={
                  "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                  (model === "inkling-small"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground")
                }
                aria-pressed={model === "inkling-small"}
              >
                Inkling-Small
              </button>
              <button
                type="button"
                onClick={() => setModel("inkling")}
                className={
                  "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                  (model === "inkling"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground")
                }
                aria-pressed={model === "inkling"}
              >
                Inkling
              </button>
            </div>
          )}
        </div>

        {view === "totals" ? (
          <>
            <div className="space-y-2.5">
              <Bar value={d.stated} max={MAX_B} color={STATED_ACCENT} filled={false} label="stated" />
              <Bar value={d.measured} max={MAX_B} color={MEASURED_ACCENT} filled label="measured" />
            </div>
            <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
              {d.label}: stated <span className="text-foreground">{d.stated.toFixed(0)}B</span>{" "}vs measured{" "}
              <span className="text-foreground">{d.measured.toFixed(2)}B</span>{" "}— a difference of{" "}
              <span className="text-foreground">{delta.toFixed(2)}B</span>, about{" "}
              <span className="text-foreground">{deltaPctOfMeasured.toFixed(1)}%</span>{" "}above the measured
              total.
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2.5">
              <Bar value={statedRatio} max={40} color={STATED_ACCENT} filled={false} label="stated" />
              <Bar value={measuredRatio} max={40} color={MEASURED_ACCENT} filled label="measured" />
            </div>
            <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
              Small ÷ Inkling: stated ratio <span className="text-foreground">{statedRatio.toFixed(1)}%</span>{" "}
              (Inkling is {(100 / statedRatio).toFixed(2)}× larger) vs measured ratio{" "}
              <span className="text-foreground">{measuredRatio.toFixed(1)}%</span>{" "}(
              {(100 / measuredRatio).toFixed(2)}× larger). Both put Small at roughly a{" "}
              <span className="text-foreground">3.5×</span>{" "}reduction, not a literal quarter (4×).
            </div>
          </>
        )}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          &ldquo;Stated&rdquo; is the number in Thinking Machines&apos; own blog prose and the HF model-index
          table for both models. &ldquo;Measured&rdquo; is the Hugging Face API&apos;s{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">safetensors.total</code> field — the actual
          parameter count in the released weight files, fetched directly rather than taken from either
          card. Both models&apos; stated totals sit a few percent above what their own weights measure.
        </p>
      </div>
    </figure>
  )
}
