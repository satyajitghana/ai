"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The card's blind side-by-side: "163 internal experts rated model outputs
// on 203 engineering tasks." Two comparisons, quoted verbatim:
//   vs. GLM 5.3:  2.99 vs. 2.92 average, 46.8% wins / 12.8% ties / 40.4% losses
//   vs. Kimi K3:  2.99 vs. 2.94 average, 51.2% wins /  7.9% ties / 40.9% losses
// Both triples sum to exactly 100.0% -- checked, not assumed. This is an
// internal, non-reproducible eval (no released transcripts, no named judges
// beyond "163 internal experts"), so the discipline here is different from a
// public benchmark: there's nothing external to re-run. What's checkable is
// the arithmetic of what's disclosed, and it holds.

type Comparison = {
  opponent: string
  hy4Avg: number
  oppAvg: number
  win: number
  tie: number
  loss: number
}

const COMPARISONS: Comparison[] = [
  { opponent: "GLM 5.3", hy4Avg: 2.99, oppAvg: 2.92, win: 46.8, tie: 12.8, loss: 40.4 },
  { opponent: "Kimi K3", hy4Avg: 2.99, oppAvg: 2.94, win: 51.2, tie: 7.9, loss: 40.9 },
]

const WIN = "oklch(0.55 0.16 155)"
const TIE = "oklch(0.62 0.03 250)"
const LOSS = "oklch(0.58 0.19 27)"

export function BlindEvalScorecard() {
  const [idx, setIdx] = useState(0)
  const c = COMPARISONS[idx]
  const sum = c.win + c.tie + c.loss

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">163 experts, 203 engineering tasks, blind pairwise</span>
        <div className="flex gap-1.5">
          {COMPARISONS.map((comp, i) => (
            <button
              key={comp.opponent}
              type="button"
              onClick={() => setIdx(i)}
              aria-pressed={idx === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                idx === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              vs. {comp.opponent}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-baseline justify-center gap-8 font-mono">
          <div className="text-center">
            <div className="text-2xl" style={{ color: WIN }}>
              {c.hy4Avg.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground">Hy4 preview, avg. rating</div>
          </div>
          <div className="text-xs text-muted-foreground">vs.</div>
          <div className="text-center">
            <div className="text-2xl text-foreground">{c.oppAvg.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">{c.opponent}, avg. rating</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex h-6 overflow-hidden rounded-full">
            <div style={{ width: `${c.win}%`, background: WIN }} title={`win ${c.win}%`} />
            <div style={{ width: `${c.tie}%`, background: TIE }} title={`tie ${c.tie}%`} />
            <div style={{ width: `${c.loss}%`, background: LOSS }} title={`loss ${c.loss}%`} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px]">
            <span style={{ color: WIN }}>{c.win.toFixed(1)}% win</span>
            <span style={{ color: TIE }}>{c.tie.toFixed(1)}% tie</span>
            <span style={{ color: LOSS }}>{c.loss.toFixed(1)}% loss</span>
          </div>
          <div className="mt-1 text-center font-mono text-[9px] text-muted-foreground">
            {c.win.toFixed(1)} + {c.tie.toFixed(1)} + {c.loss.toFixed(1)} = {sum.toFixed(1)}%
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This isn&rsquo;t a public benchmark — there&rsquo;s no released task set or transcripts to
          re-run, so &ldquo;163 internal experts&rdquo; has to be taken on trust in a way the
          leaderboard numbers elsewhere on this page don&rsquo;t. What is checkable is the arithmetic of
          what Tencent disclosed: both win/tie/loss splits sum to exactly 100.0%, and the margin against{" "}
          {c.opponent} — a {(c.win - c.loss).toFixed(1)}-point win-minus-loss gap on a {c.hy4Avg.toFixed(2)}{" "}
          vs. {c.oppAvg.toFixed(2)} average — is a real edge, not the 46.8/51.2% headline win-rate
          numbers alone suggesting a rout. Read against the closed 40%+ loss rate in both comparisons,
          it&rsquo;s a genuine but narrow lead, on Tencent&rsquo;s own internal tasks and Tencent&rsquo;s
          own judges.
        </p>
      </div>
    </figure>
  )
}
