"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// AIRA_2 (arXiv 2603.26499, Table 1) names three bottlenecks and ships a
// controlled ablation for each -- the same benchmark (MLE-bench-30), the same
// three wall-clock budgets, one mechanism switched off at a time. AIRA_1
// (arXiv 2507.02554, section 7.1 "Limitations and Future Work") already
// named all three, almost word for word, as its own future-work list a year
// earlier. The quotes on the left are AIRA_1's; the fixes and deltas on the
// right are AIRA_2's Table 1 (v1 and v2 report the same ablation rows).
// Every {with, without} pair below is read directly off that table:
//   compute:        8 GPU 71.8+-3.5  vs  1 GPU 56.8+-3.8        (24h PR)
//   generalization:  HCE 71.8+-3.5   vs  No HCE 56.8+-4.2       (24h PR)
//   operators:  Subagents 59.9+-3.6  vs  No Subagents 54.4+-3.7 (3h PR)
// "PR" = mean Percentile Rank across the 30 tasks, 3 seeds each.

type Row = {
  id: string
  tab: string
  title: string
  aira1Quote: string
  aira1Source: string
  aira2Fix: string
  aira2Source: string
  budget: string
  withLabel: string
  withVal: number
  withErr: number
  withoutLabel: string
  withoutVal: number
  withoutErr: number
  note: string
}

const DIAG = "oklch(0.62 0.03 250)"
const FIX = "oklch(0.55 0.16 155)"
const GAP = "oklch(0.58 0.19 27)"

const ROWS: Row[] = [
  {
    id: "compute",
    tab: "Compute",
    title: "Synchronous single-GPU execution",
    aira1Quote:
      "“…we adopt the benchmark’s…compute constraints (1 GPU)…solving challenging problems likely requires substantially greater resources…developing agents capable of effectively leveraging more computational resources over longer time horizons is an important direction for future research.”",
    aira1Source: "AIRA₁ §7.1, Limitations and Future Work",
    aira2Fix:
      "Async multi-GPU worker pool — up to 8× H200s, no synchronization barriers. The orchestrator dispatches a mutate/crossover job to any worker the moment it frees up, sampling parents by temperature-scaled rank.",
    aira2Source: "AIRA₂ §3, Fig. 2",
    budget: "at 24h",
    withLabel: "8 GPU",
    withVal: 71.8,
    withErr: 3.5,
    withoutLabel: "1 GPU (ablation)",
    withoutVal: 56.8,
    withoutErr: 3.8,
    note: "Not just “more GPUs”: a Best-of-K, 8-GPU baseline with no evolutionary selection saturates at the same ceiling as the 1-GPU agent (AIRA₂ Fig. 3b, “parallelism without evolution is suboptimal”). The gain needs fitness-proportional routing of the extra samples, not just more of them.",
  },
  {
    id: "generalization",
    tab: "Generalization",
    title: "Validation-based selection overfits",
    aira1Quote:
      "“Selecting the final solution…by test rather than validation score…would increase the medal rate by 9 to 13 percentage points.” Extended to 90 hours, the gap persists and widens — AIRAᴍᴄᴛˢ begins overfitting after 50 hours despite continued validation improvement.",
    aira1Source: "AIRA₁ §5.3 and Appendix C",
    aira2Fix:
      "Hidden Consistent Evaluation — the training data is split once into Dₜᵣₐᵢₙ (visible), Dₛₑₐᵣᴄʰ (hidden, guides the hill-climb), and Dᵥₐₗ (hidden, touched only for the final pick). The agent never sees a number it could learn to chase.",
    aira2Source: "AIRA₂ §3, §4.3.2",
    budget: "at 24h",
    withLabel: "with HCE",
    withVal: 71.8,
    withErr: 3.5,
    withoutLabel: "no HCE (ablation)",
    withoutVal: 56.8,
    withoutErr: 4.2,
    note: "AIRA₂’s own diagnosis complicates AIRA₁’s: reproducing the identical degradation, it attributes the cause to evaluation noise — “lucky” validation splits producing false-positive signal — rather than the agent learning to exploit the validation set. Different mechanism, same fix works either way: without HCE the score stagnates 56.8→56.3 from 24h→72h; with it, 71.8→76.0.",
  },
  {
    id: "operators",
    tab: "Operators",
    title: "Fixed, single-turn LLM operators",
    aira1Quote:
      "“[Future work:] one could readily use full-fledged agents as operators…a natural extension would be to include an ideation agent…and to replace the implementation and debugging operators with a SWE-Agent.”",
    aira1Source: "AIRA₁ §7.1, Limitations and Future Work",
    aira2Fix:
      "ReAct operators — each Draft/Debug/Improve call becomes a full reason→act→observe trajectory in a sandboxed container, so the operator reads its own traceback and retries before handing back a candidate.",
    aira2Source: "AIRA₂ §3, Fig. 2",
    budget: "at 3h",
    withLabel: "ReAct",
    withVal: 59.9,
    withErr: 3.6,
    withoutLabel: "single-turn (ablation)",
    withoutVal: 54.4,
    withoutErr: 3.7,
    note: "The smallest of the three deltas, and it keeps shrinking: +5.5pp at 3h, +3.2pp at 24h, +2.3pp at 72h. Multi-turn reasoning matters most when the clock is tight — given enough wall-clock time, the outer search loop itself recovers from a single-shot operator’s mistake.",
  },
]

export function BottleneckLedger() {
  const [idx, setIdx] = useState(0)
  const row = ROWS[idx]
  const max = Math.max(row.withVal, row.withoutVal) * 1.18
  const delta = row.withVal - row.withoutVal

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          AIRA₁ §7.1 vs AIRA₂ Table 1 ablations, per bottleneck
        </span>
        <div className="flex gap-1.5">
          {ROWS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setIdx(i)}
              aria-pressed={idx === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                idx === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {r.tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <p className="mb-3 font-mono text-[11px] font-medium tracking-wide text-foreground uppercase">
          {row.title}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="mb-1.5 font-mono text-[9.5px] tracking-wide uppercase" style={{ color: DIAG }}>
              AIRA₁ diagnosed
            </div>
            <p className="text-[13px] leading-5 text-foreground/90">{row.aira1Quote}</p>
            <p className="mt-1.5 font-mono text-[9.5px] text-muted-foreground">{row.aira1Source}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="mb-1.5 font-mono text-[9.5px] tracking-wide text-muted-foreground uppercase" style={{ color: FIX }}>
              AIRA₂ fixed with
            </div>
            <p className="text-[13px] leading-5 text-foreground/90">{row.aira2Fix}</p>
            <p className="mt-1.5 font-mono text-[9.5px] text-muted-foreground">{row.aira2Source}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-baseline justify-between font-mono text-[10.5px]">
            <span className="text-muted-foreground">
              re-measured, controlled ablation, {row.budget}
            </span>
            <span style={{ color: FIX }}>+{delta.toFixed(1)}pp</span>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="w-32 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">
                {row.withLabel}
              </span>
              <div className="h-4 flex-1 rounded bg-muted/20">
                <div
                  className="h-4 rounded"
                  style={{ width: `${(row.withVal / max) * 100}%`, background: FIX, opacity: 0.9 }}
                />
              </div>
              <span className="w-20 shrink-0 font-mono text-[10px] tabular-nums" style={{ color: FIX }}>
                {row.withVal.toFixed(1)}±{row.withErr}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">
                {row.withoutLabel}
              </span>
              <div className="h-4 flex-1 rounded bg-muted/20">
                <div
                  className="h-4 rounded"
                  style={{ width: `${(row.withoutVal / max) * 100}%`, background: GAP, opacity: 0.75 }}
                />
              </div>
              <span className="w-20 shrink-0 font-mono text-[10px] tabular-nums" style={{ color: GAP }}>
                {row.withoutVal.toFixed(1)}±{row.withoutErr}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">{row.note}</p>
      </div>
    </figure>
  )
}
