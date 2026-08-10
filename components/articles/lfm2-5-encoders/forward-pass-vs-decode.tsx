"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { msin } from "@/lib/dmath"

// The core argument, made visible: two ways to answer "which labels apply to
// this document?" for the same input. The decoder path has to GENERATE its
// answer as text — a prompt, a token-by-token decode loop, and a parser that
// can fail on what comes out. The encoder path never generates anything: one
// forward pass produces a fixed-size vector, and a sigmoid per label is
// arithmetic, not text. Toggle "malformed" to see the one failure mode the
// encoder path structurally cannot have. Ticket text and label set match the
// cookbook's own sample data (account / billing / shipping / technical);
// probabilities and token counts are illustrative, not measured.

const DOC = "Card was charged twice, asking for a refund."
const LABELS = ["billing", "technical", "shipping", "account"] as const
const PROBS: Record<(typeof LABELS)[number], number> = {
  billing: 0.91,
  technical: 0.34,
  shipping: 0.06,
  account: 0.12,
}
const THRESHOLD = 0.5

const CLEAN_TOKENS = ["{\"", "labels", "\":", " [\"", "billing", "\"]", "}"]
const BROKEN_TOKENS = ["This", " looks", " like", " a", " billing", " issue", " to", " me", "."]

export function ForwardPassVsDecode() {
  const [broken, setBroken] = useState(false)
  const tokens = broken ? BROKEN_TOKENS : CLEAN_TOKENS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>same document, two ways to get &ldquo;which labels apply&rdquo;</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setBroken(false)}
            className={cn(
              "cursor-pointer rounded px-2 py-1 transition-colors",
              !broken ? "bg-foreground text-background" : "hover:text-foreground"
            )}
          >
            clean output
          </button>
          <button
            type="button"
            onClick={() => setBroken(true)}
            className={cn(
              "cursor-pointer rounded px-2 py-1 transition-colors",
              broken ? "bg-foreground text-background" : "hover:text-foreground"
            )}
          >
            malformed output
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground">
          input: &ldquo;{DOC}&rdquo;
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {/* decoder path */}
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[11px] font-medium text-foreground">
              prompt a decoder
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              1. prompt: document + &ldquo;return the matching labels as JSON&rdquo;
            </div>

            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              2. decode loop — one forward pass per output token
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {tokens.map((t, i) => (
                <span
                  key={i}
                  className="rounded-sm border border-dashed px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              3. parse the text back into labels
            </div>
            <div
              className={cn(
                "mt-1 rounded-md border px-2 py-1.5 font-mono text-[11px]",
                broken
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-foreground/20 bg-muted/20 text-foreground"
              )}
            >
              {broken
                ? "JSONDecodeError — no labels array found. Retry the whole call."
                : "parsed: [\"billing\"]"}
            </div>
          </div>

          {/* encoder path */}
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[11px] font-medium text-foreground">
              encoder + classification head
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              1. one forward pass, bidirectional
            </div>
            <div className="mt-1 rounded-sm border px-2 py-1 font-mono text-[10px] text-muted-foreground">
              document → backbone(input_ids, attention_mask)
            </div>

            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              2. mean-pool the last hidden state → one 1024-d vector
            </div>
            <div className="mt-1 flex gap-0.5">
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  className="h-4 w-1.5 rounded-[1px]"
                  style={{
                    background: "oklch(0.72 0.15 195)",
                    opacity: 0.3 + 0.6 * Math.abs(msin(i * 0.9 + 0.4)),
                  }}
                />
              ))}
            </div>

            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              3. one Linear → sigmoid per label, always this shape
            </div>
            <div className="mt-1 space-y-1">
              {LABELS.map((label) => {
                const p = PROBS[label]
                const hit = p >= THRESHOLD
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-16 shrink-0 font-mono text-[10px]",
                        hit ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                    <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{
                          width: `${p * 100}%`,
                          background: hit ? "oklch(0.72 0.15 195)" : "oklch(0.62 0.02 260)",
                        }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {p.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* readout */}
        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]">
          <div className="rounded-md border bg-muted/20 px-2 py-1.5">
            <div className="text-muted-foreground">output tokens</div>
            <div className="mt-0.5 tabular-nums text-foreground">
              {tokens.length} <span className="text-muted-foreground">vs</span>{" "}0
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 px-2 py-1.5">
            <div className="text-muted-foreground">forward passes</div>
            <div className="mt-0.5 tabular-nums text-foreground">
              1 + {tokens.length} <span className="text-muted-foreground">vs</span>{" "}1
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 px-2 py-1.5">
            <div className="text-muted-foreground">can parsing fail</div>
            <div className="mt-0.5 text-foreground">
              {broken ? "yes — it just did" : "yes, possible"} <span className="text-muted-foreground">vs</span>{" "}no
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        The decoder path pays for every output token and needs a parser standing between the
        model and your labels — flip to &ldquo;malformed output&rdquo; and that parser has
        nothing to recover. The encoder path has no parser to fail: the classification head is a
        fixed-size array of probabilities, one per label, every single time. Probabilities and
        token counts here are illustrative, not measured.
      </p>
    </figure>
  )
}
