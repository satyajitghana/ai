"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"
import { mexp } from "@/lib/dmath"

// Multi-label classification needs a HEAD that can say "yes" to more than one
// label at once, or to none at all. Sigmoid gives each label its own
// independent probability, thresholded on its own. Softmax forces every
// label's score to compete for a fixed budget of 1.0 — exactly one "winner",
// even when two labels are both clearly true. Drag the raw logits (the
// classifier's un-normalized output for each label) and watch the two heads
// disagree on the same numbers. Same 4-way ticket taxonomy as the other figure.

const ACCENT = "oklch(0.72 0.15 195)"
const THRESHOLD = 0.5

const LABELS = ["billing", "technical", "shipping", "account"] as const
type Label = (typeof LABELS)[number]

const DEFAULT_LOGITS: Record<Label, number> = {
  billing: 2.0,
  technical: 1.6,
  shipping: -1.5,
  account: -2.0,
}

function sigmoid(z: number) {
  return 1 / (1 + mexp(-z))
}

export function SigmoidVsSoftmax() {
  const [logits, setLogits] = useState<Record<Label, number>>(DEFAULT_LOGITS)

  const sigmoids = LABELS.map((l) => sigmoid(logits[l]))
  const exps = LABELS.map((l) => mexp(logits[l]))
  const expSum = exps.reduce((a, b) => a + b, 0)
  const softmaxes = exps.map((e) => e / expSum)
  const winnerIdx = softmaxes.indexOf(Math.max(...softmaxes))
  const sigmoidHits = sigmoids.filter((p) => p >= THRESHOLD).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        one head per label, or one head for all of them
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* controls */}
          <div className="space-y-3">
            <div className="font-mono text-[10px] text-muted-foreground">
              raw logits — the classifier&apos;s un-normalized output per label
            </div>
            {LABELS.map((l) => (
              <div key={l}>
                <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{l}</span>
                  <span className="tabular-nums text-foreground">{logits[l].toFixed(1)}</span>
                </div>
                <Range
                  min={-3}
                  max={3}
                  step={0.1}
                  value={logits[l]}
                  onChange={(e) =>
                    setLogits((prev) => ({ ...prev, [l]: +e.target.value }))
                  }
                  className="w-full"
                  aria-label={`${l} logit`}
                  accent={ACCENT}
                />
              </div>
            ))}
          </div>

          {/* two heads, same logits */}
          <div className="space-y-4">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">
                sigmoid per label — independent, thresholded at {THRESHOLD.toFixed(1)}
              </div>
              <div className="mt-1.5 space-y-1">
                {LABELS.map((l, i) => {
                  const p = sigmoids[i]
                  const hit = p >= THRESHOLD
                  return (
                    <div key={l} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-16 shrink-0 font-mono text-[10px]",
                          hit ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {l}
                      </span>
                      <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                        <div
                          className="absolute top-0 bottom-0 w-px bg-foreground/40"
                          style={{ left: `${THRESHOLD * 100}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-sm"
                          style={{ width: `${p * 100}%`, background: hit ? ACCENT : "oklch(0.62 0.02 260)" }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                        {p.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                predicted labels: {sigmoidHits}{" "}
                {sigmoidHits === 1 ? "label" : "labels"} above threshold
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] text-muted-foreground">
                softmax over the same logits — forced to sum to 1
              </div>
              <div className="mt-1.5 space-y-1">
                {LABELS.map((l, i) => {
                  const p = softmaxes[i]
                  const win = i === winnerIdx
                  return (
                    <div key={l} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-16 shrink-0 font-mono text-[10px]",
                          win ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {l}
                      </span>
                      <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                        <div
                          className="absolute inset-y-0 left-0 rounded-sm"
                          style={{ width: `${p * 100}%`, background: win ? ACCENT : "oklch(0.62 0.02 260)" }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                        {p.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                predicted label: only <span className="text-foreground">{LABELS[winnerIdx]}</span>{" "}— the runner-up is discarded no matter how close
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        The default logits describe a real case: a double charge reads as both a billing problem
        and a technical one. Sigmoid keeps both — billing and technical both clear the {THRESHOLD.toFixed(1)}{" "}
        threshold on their own. Softmax cannot: it renormalizes every label against every other, so
        the close second gets squeezed toward zero and exactly one label wins. That is the whole
        reason multi-label classification uses a sigmoid head with{" "}
        <code>binary_cross_entropy_with_logits</code>, not a softmax with cross-entropy — a
        document can need zero, one, or several labels, and only one of these heads can say so.
      </p>
    </figure>
  )
}
