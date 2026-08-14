"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two of the paper's tables, which are better together than apart.
//
// Table 6 is the prediction test: the theory says the empirical rank of the
// log-probability matrix is capped at the embedding size. Softmax with d=400
// measures 400. MoC with d=280 measures 280. Not "close to" — the bound, exactly.
// MoS with the same d=280 measures 9,981 out of a possible 10,000.
//
// Table 7 is the dose-response: sweep the number of mixture components on PTB and
// watch rank and perplexity move together, until rank saturates and perplexity
// turns back up. That non-monotonicity is what makes it evidence rather than a
// trend — a pure "more parameters is better" story would not have a turn in it.

type Row = { k: number; rank: number; ppl: number }

const SWEEP: Row[] = [
  { k: 3, rank: 6467, ppl: 58.62 },
  { k: 5, rank: 8930, ppl: 57.36 },
  { k: 10, rank: 9973, ppl: 56.33 },
  { k: 15, rank: 9981, ppl: 55.97 },
  { k: 20, rank: 9981, ppl: 56.17 },
]

const BOUND: { id: string; label: string; d: number; rank: number; capped: boolean }[] = [
  { id: "softmax", label: "Softmax", d: 400, rank: 400, capped: true },
  { id: "moc", label: "MoC", d: 280, rank: 280, capped: true },
  { id: "mos", label: "MoS", d: 280, rank: 9981, capped: false },
]

const M = 10000
const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const NOTE: Record<number, string> = {
  3: "Three components already lift the rank past 6,000 — twenty-three times the 280-dim bound a single softmax would have imposed.",
  5: "Still climbing. Rank and perplexity are moving together, which is the correlation the theory predicts.",
  10: "Effectively saturated at 9,973 of 10,000. Almost every direction the vocabulary allows is now reachable.",
  15: "Best perplexity in the sweep, and the configuration used for the headline numbers. Rank 9,981.",
  20: "Rank does not move — there are no directions left to buy — and perplexity gets worse. The extra parameters now only overfit. This is the turn that makes the sweep evidence and not a trend.",
}

export function MixtureLadder() {
  const [sel, setSel] = useState(3)
  const best = Math.min(...SWEEP.map((r) => r.ppl))
  const worst = Math.max(...SWEEP.map((r) => r.ppl))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured rank of the log-probability matrix</span>
        <span className="font-mono text-[10px] text-muted-foreground">Penn Treebank · |V| = 10,000</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
          does the bound bind?
        </div>
        <div className="mt-1.5 space-y-1.5">
          {BOUND.map((b) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-right font-mono text-[10px] text-foreground">{b.label}</span>
              <span className="w-16 shrink-0 text-right font-mono text-[9px] text-muted-foreground">d = {b.d}</span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div
                  className="h-4 rounded-sm"
                  style={{ width: `${Math.max(0.4, (b.rank / M) * 100)}%`, background: b.capped ? WARM : GOOD }}
                />
              </div>
              <span
                className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums"
                style={{ color: b.capped ? WARM : GOOD }}
              >
                {b.rank.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6 text-muted-foreground">
          Softmax and MoC do not measure <em>near</em>{" "}their embedding size. They measure it exactly — 400 and 280 —
          which is the theory&rsquo;s ceiling arriving as a number. MoS, at the same 280 dimensions as MoC, reaches
          9,981 of a possible 10,000.
        </div>

        <div className="mt-4 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
          sweeping the number of softmaxes
        </div>
        <div className="mt-1.5 space-y-1.5">
          {SWEEP.map((r) => {
            const on = r.k === sel
            const isBest = r.ppl === best
            return (
              <button
                key={r.k}
                type="button"
                onClick={() => setSel(r.k)}
                aria-pressed={on}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                  on ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                )}
              >
                <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                  K = {r.k}
                </span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div className="h-4 rounded-sm" style={{ width: `${(r.rank / M) * 100}%`, background: ACCENT }} />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {r.rank.toLocaleString()}
                </span>
                <span
                  className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums"
                  style={{ color: isBest ? GOOD : r.ppl > best + 0.15 ? WARM : "inherit" }}
                >
                  {r.ppl.toFixed(2)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex justify-end gap-3 pr-1 font-mono text-[9px] text-muted-foreground">
          <span>rank →</span>
          <span>← test perplexity</span>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="font-mono text-[11px]" style={{ color: ACCENT }}>
            K = {sel} · rank {SWEEP.find((r) => r.k === sel)?.rank.toLocaleString()} · ppl{" "}
            {SWEEP.find((r) => r.k === sel)?.ppl.toFixed(2)}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{NOTE[sel]}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The span from best to worst here is {(worst - best).toFixed(2)} perplexity, which is small — but the{" "}
          <span className="text-foreground">shape</span>{" "}is the point, not the size. Rank rises, perplexity falls;
          rank saturates, perplexity bottoms out and then reverses. A story where mixtures simply add capacity
          predicts a monotone curve. A story where mixtures buy rank until rank runs out predicts exactly this.
        </p>
      </div>
    </figure>
  )
}
