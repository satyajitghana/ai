"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What FTPO actually moves — the trailing token, in logit space.
//
// A training row is [prompt prefix, one rejected token, one-or-more chosen tokens].
// FTPO trains ONLY the trailing position (the one that would emit the loop token),
// and it works in logit space with a two-part rule:
//   - the rejected token and the chosen tokens are allowed to move freely w.r.t. the
//     reference model — rejected pushed down, several chosen pushed up;
//   - every other token in the vocab is held tightly near the reference (a KL-like
//     term computed on logits, without softmax), so unrelated tokens don't drift.
//
// Toggle reference -> after-FTPO to watch the logits move. Logit values are
// illustrative. Pure first render (phase="ref"); no timers, no random. Prerender-safe.

const REJ = "oklch(0.63 0.2 25)" // red — rejected loop token
const CHO = "oklch(0.7 0.14 165)" // teal — chosen alternatives

type Bar = { tok: string; ref: number; ftpo: number; kind: "rej" | "cho" }
const BARS: Bar[] = [
  { tok: "Wait", ref: 6.2, ftpo: 1.2, kind: "rej" },
  { tok: "Let's", ref: 2.1, ftpo: 3.8, kind: "cho" },
  { tok: "Yes", ref: 1.7, ftpo: 3.4, kind: "cho" },
  { tok: "Ok", ref: 1.4, ftpo: 3.1, kind: "cho" },
]

const PREFIX = ["<think>", "Bill", "Nighy", "is", "the", "voice", "."]
const PLOT_H = 190 // px for the logit plot area
const UNIT = 24 // px per logit unit
const REST_CENTER = 0.4 // "rest of vocab" sits near reference in both phases

export function FinalToken() {
  const [phase, setPhase] = useState<"ref" | "ftpo">("ref")
  const val = (b: Bar) => (phase === "ref" ? b.ref : b.ftpo)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>FTPO — the trailing token, in logit space</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* prompt prefix tape → trained position */}
        <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">
          prompt prefix · only the trailing position is trained
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {PREFIX.map((t, i) => (
            <span
              key={i}
              className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
          <span className="font-mono text-muted-foreground/50">→</span>
          <span
            className="rounded-md border-2 px-2.5 py-1 font-mono text-[11px] font-medium"
            style={{ borderColor: "var(--foreground)", color: "var(--foreground)" }}
          >
            ▮ trailing token
          </span>
        </div>

        {/* logit plot */}
        <div className="relative" style={{ height: PLOT_H + 34 }}>
          {/* baseline (logit 0) */}
          <div
            className="absolute right-0 left-0 border-t border-dashed border-border"
            style={{ bottom: 34 }}
          />
          <span
            className="absolute left-0 font-mono text-[10px] text-muted-foreground"
            style={{ bottom: 34 + 2 }}
          >
            logit 0
          </span>

          <div className="absolute inset-x-0 flex items-end gap-2" style={{ bottom: 34, height: PLOT_H }}>
            {BARS.map((b) => {
              const h = Math.max(val(b) * UNIT, 2)
              return (
                <div key={b.tok} className="flex flex-1 flex-col items-center justify-end">
                  <span
                    className="mb-1 font-mono text-[10px] tabular-nums transition-all duration-500"
                    style={{ color: b.kind === "rej" ? REJ : CHO }}
                  >
                    {val(b).toFixed(1)}
                  </span>
                  <div
                    className="w-full max-w-[64px] rounded-t-sm transition-all duration-500"
                    style={{
                      height: h,
                      background: b.kind === "rej" ? REJ : CHO,
                      opacity: 0.9,
                    }}
                  />
                </div>
              )
            })}

            {/* rest of vocab — a tight band that barely moves */}
            <div className="flex flex-[1.4] flex-col items-center justify-end">
              <div
                className="w-full rounded-sm border border-dashed"
                style={{
                  height: 1.6 * UNIT,
                  marginBottom: (REST_CENTER - 0.8) * UNIT + 0.8 * UNIT,
                  background: "var(--muted-foreground)",
                  opacity: 0.12,
                  borderColor: "var(--muted-foreground)",
                }}
              />
            </div>
          </div>

          {/* x labels */}
          <div className="absolute inset-x-0 bottom-0 flex items-start gap-2">
            {BARS.map((b) => (
              <span
                key={b.tok}
                className="flex-1 text-center font-mono text-[10px]"
                style={{ color: b.kind === "rej" ? REJ : "var(--foreground)" }}
              >
                {b.tok}
              </span>
            ))}
            <span className="flex-[1.4] text-center font-mono text-[10px] text-muted-foreground">
              ~all other tokens
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1">
            {(["ref", "ftpo"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                aria-pressed={phase === p}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                  phase === p
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "ref" ? "reference" : "after FTPO"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REJ }} /> rejected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHO }} /> chosen
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          FTPO touches one position. It drives the{" "}
          <span style={{ color: REJ }}>rejected</span> loop token down and lifts several{" "}
          <span style={{ color: CHO }}>chosen</span> alternatives up — so it spreads the
          escape probability instead of swapping one overtrained token for another. The{" "}
          <span className="text-foreground">rest of the vocabulary</span> is pinned near the
          reference by a logit-space, softmax-free penalty, which is what keeps the model&rsquo;s
          math and coding ability from drifting while the loop is removed.
        </p>
      </div>
    </figure>
  )
}
