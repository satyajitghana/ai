"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The bank-statement example from Interfaze's launch blog. Row confidences and
// the withdrawal line's word scores are the blog's printed output (reported,
// from the hosted API). The "open code" view applies what contracts.split_words
// does in the released repository: every word of a line gets the line's score.

const ROWS: { date: string; category: string; amount: string; conf: number }[] = [
  { date: "04/01/24", category: "balance", amount: "1125780.31", conf: 0.99 },
  { date: "04/15/24", category: "contribution", amount: "10000", conf: 0.98 },
  { date: "04/22/24", category: "dividend", amount: "185.67", conf: 0.95 },
  { date: "05/03/24", category: "withdrawal", amount: "-5000", conf: 0.86 },
  { date: "05/15/24", category: "contribution", amount: "5000", conf: 0.99 },
  { date: "05/24/24", category: "interest", amount: "23.14", conf: 0.92 },
  { date: "06/03/24", category: "dividend", amount: "132.98", conf: 0.95 },
  { date: "06/17/24", category: "contribution", amount: "10000", conf: 0.98 },
  { date: "06/28/24", category: "capital_gain", amount: "286.35", conf: 0.98 },
  { date: "06/30/24", category: "balance", amount: "1209509.65", conf: 0.99 },
]

const WORDS: { text: string; conf: number }[] = [
  { text: "05/03/24", conf: 0.99 },
  { text: "WITHDRAWAL", conf: 0.99 },
  { text: "-", conf: 0.92 },
  { text: "ACH", conf: 0.99 },
  { text: "-", conf: 0.42 },
]
const LINE_CONF = 0.86

const AUTO = "oklch(0.62 0.13 160)"
const REVIEW = "oklch(0.64 0.17 45)"

export function ConfidenceGate() {
  const [threshold, setThreshold] = useState(90)
  const [view, setView] = useState<"blog" | "code">("blog")
  const th = threshold / 100
  const auto = ROWS.filter((r) => r.conf >= th).length
  const mean = WORDS.reduce((s, w) => s + w.conf, 0) / WORDS.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        The launch blog&rsquo;s bank statement &middot; gate each row on its OCR line&rsquo;s confidence
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="ifz-th" className="font-mono text-xs text-muted-foreground">
              post automatically at &ge; <span className="text-foreground tabular-nums">{th.toFixed(2)}</span>
            </label>
            <Range
              id="ifz-th"
              min={80}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-48"
              accent={REVIEW}
            />
            <span className="font-mono text-xs tabular-nums">
              <span style={{ color: AUTO }}>{auto} auto</span> &middot;{" "}
              <span style={{ color: REVIEW }}>{ROWS.length - auto} to a person</span>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {ROWS.map((r) => {
              const ok = r.conf >= th
              return (
                <div
                  key={r.date}
                  className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1 font-mono text-[11px]"
                  style={{ borderColor: ok ? "var(--border)" : REVIEW }}
                >
                  <span className="text-muted-foreground">{r.date}</span>
                  <span className="flex-1 truncate">{r.category}</span>
                  <span className="tabular-nums text-muted-foreground">{r.amount}</span>
                  <span className="w-9 text-right tabular-nums" style={{ color: ok ? AUTO : REVIEW }}>
                    {r.conf.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Word scores">
            {(
              [
                ["blog", "words as the blog prints them"],
                ["code", "words as the released code writes them"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                aria-pressed={view === k}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  view === k
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            {WORDS.map((w, i) => {
              const c = view === "blog" ? w.conf : LINE_CONF
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="rounded border px-2 py-1 font-mono text-sm">{w.text}</span>
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: c < th ? REVIEW : "var(--muted-foreground)" }}
                  >
                    {c.toFixed(2)}
                  </span>
                </div>
              )
            })}
            <span className="ml-2 pb-6 font-mono text-[11px] text-muted-foreground">
              line: <span className="text-foreground">{LINE_CONF.toFixed(2)}</span>
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {view === "blog" ? (
              <>
                The blog&rsquo;s five word scores average {mean.toFixed(3)}, which rounds to the line&rsquo;s{" "}
                {LINE_CONF.toFixed(2)}. The trailing dash at 0.42 is the word that sends this row to a person.
              </>
            ) : (
              <>
                In the released code a stitched line&rsquo;s words are cut from the line&rsquo;s box by character count,
                and every one of them is given the line&rsquo;s score. The line still gates the same way; there is no
                0.42 to point a reviewer at.
              </>
            )}
          </p>
        </div>
      </div>
    </figure>
  )
}
