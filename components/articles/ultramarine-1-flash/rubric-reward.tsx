"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 31-criterion rubric from the blog's worked example (Appendix A, "Board
// forecast and disclosure update"), with its real weights, scored the way the
// open-source `rubric` package's PerCriterionOneShotGrader aggregates:
//
//   raw   = sum of weights of criteria judged MET (negative ones subtract)
//   score = clip(raw / sum of positive weights, 0, 1)
//
// then the group step the blog's CISPO objective uses: advantage = this
// rollout's reward minus the mean reward of its group, no std normalisation.
// The seven sibling rewards are illustrative, not from the blog.

type C = { n: number; w: number; t: string; cat: string }

const RUBRIC: C[] = [
  { n: 1, w: 10, cat: "Factual accuracy", t: "v7 2025E revenue $1,438mm" },
  { n: 2, w: 10, cat: "Factual accuracy", t: "v7 2026E revenue $1,575mm" },
  { n: 3, w: 10, cat: "Factual accuracy", t: "v7 2025E Adj. EBITDA $151mm" },
  { n: 4, w: 10, cat: "Factual accuracy", t: "v7 2026E Adj. EBITDA $174mm" },
  { n: 5, w: 10, cat: "Factual accuracy", t: "v5-to-v7 revenue delta" },
  { n: 6, w: 10, cat: "Factual accuracy", t: "v5-to-v7 EBITDA delta" },
  { n: 7, w: 18, cat: "Factual accuracy", t: "EV / 2025E EBITDA = 12.3x" },
  { n: 8, w: 18, cat: "Factual accuracy", t: "EV / 2026E EBITDA = 10.6x" },
  { n: 9, w: 10, cat: "Factual accuracy", t: "v7 approved April 16" },
  { n: 10, w: -25, cat: "Factual accuracy", t: "quotes stale 11.7x / 9.9x multiples" },
  { n: 11, w: -25, cat: "Factual accuracy", t: "presents v5 as the current basis" },
  { n: 12, w: 18, cat: "Analytical soundness", t: "carries v7 through the EV read-across" },
  { n: 13, w: 18, cat: "Analytical soundness", t: "separates approve-now from counsel-gated" },
  { n: 14, w: 10, cat: "Analytical soundness", t: "v7 is the sole board/valuation basis" },
  { n: 15, w: -50, cat: "Analytical soundness", t: "authorises roadshow use without counsel" },
  { n: 16, w: -25, cat: "Analytical soundness", t: "approves the stale v5 forecast" },
  { n: 17, w: -25, cat: "Analytical soundness", t: "treats board approval as counsel clearance" },
  { n: 18, w: 8, cat: "Completeness", t: "forecast section with v7 figures" },
  { n: 19, w: 8, cat: "Completeness", t: "v5-to-v7 bridge" },
  { n: 20, w: 8, cat: "Completeness", t: "notes proxy still on v5" },
  { n: 21, w: 8, cat: "Completeness", t: "updates the Decision 2 callout" },
  { n: 22, w: 8, cat: "Completeness", t: "roadshow position on census ramp" },
  { n: 23, w: 8, cat: "Completeness", t: "service mix and thesis unchanged" },
  { n: 24, w: 18, cat: "Source and context fidelity", t: "uses v7 as the basis, not v5" },
  { n: 25, w: 8, cat: "Source and context fidelity", t: "identifies proxy table as v5" },
  { n: 26, w: 8, cat: "Source and context fidelity", t: "cites named source files" },
  { n: 27, w: -25, cat: "Source and context fidelity", t: "silently adopts one version" },
  { n: 28, w: 8, cat: "Communication", t: "marks roadshow pending counsel" },
  { n: 29, w: -10, cat: "Communication", t: "leaves TODOs or meta-commentary" },
  { n: 30, w: 5, cat: "Instruction following", t: "saved at the original path" },
  { n: 31, w: -25, cat: "Instruction following", t: "rewrites sections outside scope" },
]

const POS_TOTAL = RUBRIC.filter((c) => c.w > 0).reduce((s, c) => s + c.w, 0) // 247
const CATS = Array.from(new Set(RUBRIC.map((c) => c.cat)))

const PRESETS: { label: string; met: number[] }[] = [
  {
    label: "Model answer",
    met: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30],
  },
  {
    label: "Right numbers, one track",
    // every figure correct, but board approval and counsel clearance merged
    met: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 14, 18, 19, 20, 21, 24, 30, 17],
  },
  {
    label: "Plausible and vague",
    met: [21, 22, 23, 30],
  },
  {
    label: "Stale v5 basis",
    met: [21, 22, 23, 30, 10, 11, 16, 27],
  },
]

// illustrative rewards for the seven other rollouts in a group of eight
const SIBLINGS = [0.82, 0.64, 0.51, 0.37, 0.2, 0.05, 0]

const WIN = "oklch(0.55 0.16 155)"
const LOSS = "oklch(0.58 0.19 27)"

export function RubricReward() {
  const [met, setMet] = useState<Set<number>>(() => new Set(PRESETS[1].met))

  const toggle = (n: number) =>
    setMet((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const raw = RUBRIC.filter((c) => met.has(c.n)).reduce((s, c) => s + c.w, 0)
  const score = Math.min(1, Math.max(0, raw / POS_TOTAL))
  const group = [score, ...SIBLINGS]
  const mean = group.reduce((s, x) => s + x, 0) / group.length
  const adv = score - mean
  const clipped = raw < 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">One task, 31 criteria, one reward</span>
        <span className="font-mono text-[10px] text-muted-foreground">weights from the blog&rsquo;s worked example</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setMet(new Set(p.met))}
              className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">raw (sum of MET)</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: raw < 0 ? LOSS : undefined }}>
              {raw} / {POS_TOTAL}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">reward, clipped 0-1</div>
            <div className="font-mono text-sm tabular-nums">
              {score.toFixed(3)}
              {clipped ? <span className="text-[10px] text-muted-foreground"> floored</span> : null}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">group mean (8)</div>
            <div className="font-mono text-sm tabular-nums">{mean.toFixed(3)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">advantage</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: adv >= 0 ? WIN : LOSS }}>
              {adv >= 0 ? "+" : "−"}
              {Math.abs(adv).toFixed(3)}
            </div>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/40">
          <div className="h-full rounded-full" style={{ width: `${(score * 100).toFixed(1)}%`, background: WIN }} />
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {CATS.map((cat) => (
            <div key={cat}>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{cat}</div>
              <ul className="space-y-0.5">
                {RUBRIC.filter((c) => c.cat === cat).map((c) => {
                  const on = met.has(c.n)
                  return (
                    <li key={c.n}>
                      <button
                        type="button"
                        onClick={() => toggle(c.n)}
                        aria-pressed={on}
                        className={cn(
                          "flex w-full cursor-pointer items-baseline gap-2 rounded px-1 py-0.5 text-left font-mono text-[10.5px] transition-colors hover:bg-muted/40",
                          on ? "text-foreground" : "text-muted-foreground/70",
                        )}
                      >
                        <span className="w-3 shrink-0">{on ? "■" : "□"}</span>
                        <span className="w-8 shrink-0 tabular-nums" style={{ color: c.w < 0 ? LOSS : WIN }}>
                          {c.w > 0 ? `+${c.w}` : `−${Math.abs(c.w)}`}
                        </span>
                        <span>
                          {c.n}. {c.t}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Load &ldquo;Right numbers, one track&rdquo;: every figure is correct, and the memo still loses 25 points by
          treating the board&rsquo;s approval as counsel&rsquo;s clearance, and 18 more for not separating them. The
          judge grades propositions, not prose. Then load &ldquo;Stale v5 basis&rdquo;: the raw sum goes negative and
          the reward floors at zero, the same as an empty file.{" "}
          <span className="text-foreground">
            Below the floor, a bad answer and a worse one are indistinguishable to the optimiser.
          </span>
        </p>
      </div>
    </figure>
  )
}
