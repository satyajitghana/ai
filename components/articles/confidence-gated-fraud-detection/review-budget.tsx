"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What $0.0679 buys from Kimi K3 at Together's published price.
//
// Measured, from the app's own spend tile at t = 11.0s:
//   Jev      $0.00296 over 100 emails
//   Kimi K3  $0.0679  over 31 completed reviews
// Published, from together.ai/models/kimi-k3:
//   $3.00 / 1M input, $15.00 / 1M output (cached input $0.30 / 1M)
//
// Jev's own line pins the state size: $0.00296 at $0.042/Mtok input is
// 70,476 input tokens over 100 emails, i.e. ~705 billed tokens per email.
// Both models are reading the same email, so that is the natural guess for
// what Kimi K3 was billed on the input side too — and it leaves almost
// nothing for output. The slider exists because I cannot measure the input
// length directly: escalated emails are a biased subsample and may be
// shorter. Every value on it is an upper bound on the reasoning.

const REVIEWS = 31
const SPEND = 0.0679
const IN_PER_TOK = 3.0 / 1e6
const OUT_PER_TOK = 15.0 / 1e6

const JEV_IMPLIED = 0.00296 / (0.042 / 1e6) / 100 // 704.76 tokens/email
const L_MAX = SPEND / (REVIEWS * IN_PER_TOK) // 730.1 — input alone exhausts it

const REFS = [
  { label: "a bare verdict token", tokens: 3 },
  { label: 'a JSON label — {"verdict":"fraud"}', tokens: 8 },
  { label: "one sentence of justification", tokens: 30 },
  { label: "a short chain of thought", tokens: 300 },
]

const SCALE_MAX = 320

export function ReviewBudget() {
  const [len, setLen] = useState(705)

  const inputCost = REVIEWS * len * IN_PER_TOK
  const left = Math.max(0, SPEND - inputCost)
  const outTotal = left / OUT_PER_TOK
  const outPer = outTotal / REVIEWS

  const barW = (n: number) => `${Math.min(100, (n / SCALE_MAX) * 100)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what $0.0679 over 31 reviews leaves for output</span>
        <span className="tabular-nums">Kimi K3 $3.00 / $15.00 per Mtok</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[15rem_1fr]">
        <div className="space-y-3">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>billed input / review</span>
              <span className="text-foreground tabular-nums">{len} tok</span>
            </span>
            <input
              type="range"
              min={0}
              max={730}
              step={5}
              value={len}
              onChange={(e) => setLen(Number(e.target.value))}
              className="mt-1 w-full accent-foreground"
              aria-label="average billed input tokens per escalated review"
            />
            <span className="mt-1 block font-mono text-[10px] leading-4 text-muted-foreground">
              Jev&rsquo;s own spend implies {JEV_IMPLIED.toFixed(0)} tokens per email.
              Above {L_MAX.toFixed(0)}, the input alone costs more than was spent.
            </span>
          </label>

          <div className="rounded-md border bg-background/60 p-3">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              output tokens / review
            </div>
            <div
              className={cn(
                "font-heading text-3xl font-semibold tabular-nums",
                outPer < 50 && "text-destructive"
              )}
            >
              {outPer < 10 ? outPer.toFixed(1) : Math.round(outPer)}
            </div>
            <dl className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>input spend</dt>
                <dd className="tabular-nums text-foreground">${inputCost.toFixed(4)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>left for output</dt>
                <dd className="tabular-nums text-foreground">${left.toFixed(4)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between font-mono text-[11px]">
              <span className="text-foreground">headroom at this input length</span>
              <span className="tabular-nums text-muted-foreground">
                {outPer < 10 ? outPer.toFixed(1) : Math.round(outPer)} tok
              </span>
            </div>
            <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: barW(outPer),
                  background: "oklch(0.72 0.15 195)",
                }}
              />
            </div>
          </div>

          <ul className="space-y-2.5">
            {REFS.map((r) => {
              const fits = outPer >= r.tokens
              return (
                <li key={r.label}>
                  <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        fits ? "text-foreground" : "text-destructive"
                      )}
                    >
                      {r.tokens} tok {fits ? "✓" : "✗"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        fits ? "bg-foreground/50" : "bg-destructive/50"
                      )}
                      style={{ width: barW(r.tokens) }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Even in the absurd limit where the input is free, $0.0679 buys{" "}
        {Math.round(SPEND / OUT_PER_TOK / REVIEWS)} output tokens per review. Prompt
        caching would move this — a cached prefix bills at $0.30/Mtok — but the email
        body is unique per call and cannot be cached.
      </figcaption>
    </figure>
  )
}
