"use client"

import { useState } from "react"

// The benchmark appendix's own footnote, not a finding this site dug up:
// "Among the eight reasoning benchmarks, five Claude Opus 5 results use
// high-setting runs... The high-setting runs have truncation rates of 2.32%
// on HLE, 15.17% on ArXivMath, 28.76% on HorizonMath, 5.86% on MathArena
// Apex 2025, and 17.17% on BrokenArXiv." Truncation means a run hit its
// token/turn budget before finishing -- on a hard reasoning benchmark, an
// unfinished answer usually just scores as wrong, so a high truncation rate
// plausibly understates a model's real ceiling on that specific benchmark.
//
// Tencent discloses this about their own comparison, unprompted, in a
// footnote most readers never reach. It's worth taking seriously rather than
// treating as a gotcha: on 4 of these 5 benchmarks, Claude Opus 5 still beats
// Hy4 preview despite the disclosed truncation. The one exception --
// HorizonMath, where Hy4 (8.8) beats Claude Opus 5's truncated 5.3 -- is also
// the single highest truncation rate of the five (28.76%), which is exactly
// the benchmark where that comparison should be trusted least.

type Row = { name: string; hy4: number; claude: number; trunc: number }

const ROWS: Row[] = [
  { name: "HLE (no tools)", hy4: 43.4, claude: 53.2, trunc: 2.32 },
  { name: "MathArena Apex 2025", hy4: 74.2, claude: 91.4, trunc: 5.86 },
  { name: "ArXivMath", hy4: 66.6, claude: 71.5, trunc: 15.17 },
  { name: "BrokenArXiv", hy4: 54.6, claude: 77.7, trunc: 17.17 },
  { name: "HorizonMath (pass@4)", hy4: 8.8, claude: 5.3, trunc: 28.76 },
]

const HY4 = "oklch(0.55 0.16 155)"
const CLAUDE = "oklch(0.58 0.19 27)"
const TRUNC = "oklch(0.68 0.13 85)"

export function TruncationCheck() {
  const [sortByTrunc, setSortByTrunc] = useState(true)

  const rows = sortByTrunc ? [...ROWS].sort((a, b) => a.trunc - b.trunc) : ROWS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the card&rsquo;s own truncation-rate footnote</span>
        <button
          type="button"
          onClick={() => setSortByTrunc((v) => !v)}
          className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {sortByTrunc ? "sorted by truncation rate" : "benchmark order"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {rows.map((r) => {
            const max = Math.max(r.hy4, r.claude)
            const hy4W = (r.hy4 / max) * 100
            const claudeW = (r.claude / max) * 100
            const hy4Wins = r.hy4 > r.claude
            return (
              <div key={r.name}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
                  <span className="text-foreground">{r.name}</span>
                  <span style={{ color: TRUNC }}>{r.trunc.toFixed(2)}% of Claude Opus 5 runs truncated</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">Hy4</span>
                    <div className="h-4 flex-1 rounded bg-muted/20">
                      <div
                        className="h-4 rounded"
                        style={{ width: `${hy4W}%`, background: HY4, opacity: hy4Wins ? 0.9 : 0.45 }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: hy4Wins ? HY4 : "currentColor" }}>
                      {r.hy4.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">Claude Opus 5</span>
                    <div className="h-4 flex-1 rounded bg-muted/20">
                      <div
                        className="h-4 rounded"
                        style={{ width: `${claudeW}%`, background: CLAUDE, opacity: hy4Wins ? 0.45 : 0.9 }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: hy4Wins ? "currentColor" : CLAUDE }}>
                      {r.claude.toFixed(1)}*
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sorted by truncation rate, the pattern is visible at a glance: on the four benchmarks with the
          lowest truncation (2.32% to 17.17%), <span style={{ color: CLAUDE }}>Claude Opus 5</span>{" "}
          beats <span style={{ color: HY4 }}>Hy4 preview</span> anyway, truncation and all. The single
          benchmark where Hy4 comes out ahead — HorizonMath — is also the one with the highest
          truncation rate of the five, 28.76%. That is not proof Claude Opus 5 would have won it given
          more budget. It is a reason to hold that one win more loosely than the other four losses,
          using exactly the caveat the card disclosed about its own comparison.
        </p>
      </div>
    </figure>
  )
}
