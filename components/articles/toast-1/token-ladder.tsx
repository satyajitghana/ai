"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Harvey LAB firm-knowledge result, which is the cleanest experiment in the
// launch post: one model, one task set, one evaluation, and only the retrieval
// stack changes between rows.
//
//   vanilla agent         80.6M tokens   21.7 turns/task   score 55
//   + Mixedbread Search   47.0M          14.6              score 55
//   + Toast 1 subagent    23.0M          11.2              score 55
//
// Deltas recomputed here rather than copied: 47.0/80.6 = -41.7% (post says
// -42%), 23.0/47.0 = -51.1% (post says -51%), 80.6/23.0 = 3.50x (post says
// 3.5x). All three reproduce.
//
// The caveat that belongs next to the numbers: this is a randomly selected
// 33-task subset of the benchmark, chosen by Mixedbread "to make repeated
// comparative runs tractable."

type Row = { name: string; tokens: number; turns: number; score: number; note: string }

const ROWS: Row[] = [
  {
    name: "vanilla agent",
    tokens: 80.6,
    turns: 21.7,
    score: 55,
    note: "Filesystem search. The agent finds its own way through the corpus, and pays for every wrong turn in context.",
  },
  {
    name: "+ Mixedbread Search",
    tokens: 47.0,
    turns: 14.6,
    score: 55,
    note: "Same agent, better retrieval primitive. Token use falls 42% and the task score does not move — the extra 33.6M tokens were never buying answer quality, they were buying navigation.",
  },
  {
    name: "+ Toast 1 subagent",
    tokens: 23.0,
    turns: 11.2,
    score: 55,
    note: "Now the search loop itself is delegated. Another 51% off, roughly half the turns of the vanilla agent, and still the same score. Mixedbread puts the cost reduction at over 60%.",
  },
]

const COL = ["oklch(0.62 0.03 250)", "oklch(0.68 0.13 85)", "oklch(0.60 0.15 255)"]

export function TokenLadder() {
  const [sel, setSel] = useState(2)
  const r = ROWS[sel]
  const max = 80.6

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Harvey LAB firm knowledge · 33 tasks</span>
        <span className="font-mono text-[10px] text-muted-foreground">only the retrieval stack changes</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {ROWS.map((x, i) => (
            <button
              key={x.name}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "w-full cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
              )}
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-foreground">{x.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {x.tokens}M tokens · {x.turns} turns/task ·{" "}
                  <span className="text-foreground">score {x.score}</span>
                </span>
              </div>
              <div className="h-3.5 rounded-sm bg-muted/40">
                <div className="h-3.5 rounded-sm" style={{ width: `${(x.tokens / max) * 100}%`, background: COL[i] }} />
              </div>
              {i > 0 ? (
                <div className="mt-1 font-mono text-[9px]" style={{ color: COL[i] }}>
                  −{(((ROWS[i - 1].tokens - x.tokens) / ROWS[i - 1].tokens) * 100).toFixed(0)}% vs row above ·{" "}
                  {(ROWS[0].tokens / x.tokens).toFixed(2)}× fewer than vanilla
                </div>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: COL[sel] }}>
            {r.name} — {r.tokens}M tokens, {r.turns} turns, score {r.score}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{r.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The identical score across all three rows is the result, not a footnote. If quality had gone up you would
          be looking at a better agent; because it did not move at all, what is being demonstrated is that{" "}
          <span className="text-foreground">57.6M of the vanilla agent&rsquo;s 80.6M tokens were not contributing to
          the answer</span>. They were the cost of looking. Two caveats belong here: this is a randomly selected
          33-task subset rather than the full benchmark, and a score that lands on exactly 55 three times is a
          coarse enough measurement that small quality changes would not show up in it.
        </p>
      </div>
    </figure>
  )
}
