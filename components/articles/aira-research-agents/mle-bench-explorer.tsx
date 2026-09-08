"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two papers, two different scoreboards -- deliberately kept apart rather than
// forced onto one axis.
//
// AIRA_1 view: medal rate on MLE-bench Lite (22 Kaggle tasks), read directly
// off the labelled bars in arXiv 2507.02554 Figure 5 ("all_medals.svg").
// AIRA_2 view: mean Percentile Rank on MLE-bench-30 (a different, 30-task
// subset), read from arXiv 2603.26499 Table 1 (v1/v2 agree on these rows).
// Baselines in the AIRA_2 view are single numbers "reported at 24h" (Table 1's
// own caption) from each baseline's own paper -- they don't move when the
// budget toggle changes, which the UI marks rather than hides.

type Tier = "any" | "silver" | "gold"
type Model = "r1" | "o3"
type Budget = "3h" | "24h" | "72h"

const MEDALS: Record<Tier, Record<Model, { method: string; val: number }[]>> = {
  any: {
    r1: [
      { method: "AIDEgreedy", val: 39.77 },
      { method: "AIRAevo", val: 42.73 },
      { method: "AIRAgreedy", val: 45.45 },
      { method: "AIRAmcts", val: 47.05 },
    ],
    o3: [
      { method: "AIDEgreedy", val: 39.55 },
      { method: "AIRAevo", val: 43.64 },
      { method: "AIRAgreedy", val: 47.73 },
      { method: "AIRAmcts", val: 47.27 },
    ],
  },
  silver: {
    r1: [
      { method: "AIDEgreedy", val: 32.05 },
      { method: "AIRAevo", val: 34.77 },
      { method: "AIRAgreedy", val: 36.82 },
      { method: "AIRAmcts", val: 36.36 },
    ],
    o3: [
      { method: "AIDEgreedy", val: 34.09 },
      { method: "AIRAevo", val: 35.0 },
      { method: "AIRAgreedy", val: 42.73 },
      { method: "AIRAmcts", val: 42.27 },
    ],
  },
  gold: {
    r1: [
      { method: "AIDEgreedy", val: 23.41 },
      { method: "AIRAevo", val: 24.55 },
      { method: "AIRAgreedy", val: 27.05 },
      { method: "AIRAmcts", val: 25.68 },
    ],
    o3: [
      { method: "AIDEgreedy", val: 26.82 },
      { method: "AIRAevo", val: 26.36 },
      { method: "AIRAgreedy", val: 28.64 },
      { method: "AIRAmcts", val: 30.91 },
    ],
  },
}

const PR_BY_BUDGET: Record<Budget, number> = { "3h": 59.9, "24h": 71.8, "72h": 76.0 }
const PR_ERR: Record<Budget, number> = { "3h": 3.6, "24h": 3.5, "72h": 3.4 }

const BASELINES = [
  { method: "AIRA-dojo (AIRA₁'s own config)", val: 39.5 },
  { method: "FM-Agent 2.0", val: 69.6 },
  { method: "MARS+", val: 69.9 },
  { method: "CobraAgent", val: 72.7 },
]

const AIRA = "oklch(0.55 0.16 155)"
const OTHER = "oklch(0.58 0.19 27)"
const GHOST = "oklch(0.55 0.02 250)"

function Bar({
  label,
  val,
  err,
  max,
  color,
  ghost,
}: {
  label: string
  val: number
  err?: number
  max: number
  color: string
  ghost?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-44 shrink-0 truncate text-right font-mono text-[9.5px] text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="h-4 flex-1 rounded bg-muted/20">
        <div
          className="h-4 rounded"
          style={{ width: `${(val / max) * 100}%`, background: color, opacity: ghost ? 0.4 : 0.9 }}
        />
      </div>
      <span className="w-20 shrink-0 font-mono text-[10px] tabular-nums" style={{ color: ghost ? "var(--muted-foreground)" : color }}>
        {val.toFixed(1)}
        {err ? `±${err}` : ""}
      </span>
    </div>
  )
}

export function MleBenchExplorer() {
  const [paper, setPaper] = useState<"aira1" | "aira2">("aira1")
  const [tier, setTier] = useState<Tier>("any")
  const [model, setModel] = useState<Model>("r1")
  const [budget, setBudget] = useState<Budget>("24h")

  const medalRows = MEDALS[tier][model]
  const medalMax = Math.max(...medalRows.map((r) => r.val)) * 1.2

  const prVal = PR_BY_BUDGET[budget]
  const prErr = PR_ERR[budget]
  const prMax = Math.max(prVal, ...BASELINES.map((b) => b.val)) * 1.15

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">two scoreboards, not one axis</span>
        <div className="flex gap-1.5">
          {(
            [
              { id: "aira1", label: "AIRA₁ · medal rate" },
              { id: "aira2", label: "AIRA₂ · percentile rank" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaper(p.id)}
              aria-pressed={paper === p.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                paper === p.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {paper === "aira1" ? (
          <>
            <div className="mb-3 flex flex-wrap gap-3">
              <div className="flex gap-1.5">
                {(["any", "silver", "gold"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    aria-pressed={tier === t}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] capitalize transition-colors",
                      tier === t
                        ? "border-foreground/30 bg-muted/50 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t === "any" ? "any medal" : t === "silver" ? "≥ silver" : "gold"}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {(["r1", "o3"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    aria-pressed={model === m}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase transition-colors",
                      model === m
                        ? "border-foreground/30 bg-muted/50 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "r1" ? "DeepSeek R1" : "o3"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {medalRows.map((r) => (
                <Bar key={r.method} label={r.method} val={r.val} max={medalMax} color={AIRA} />
              ))}
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              MLE-bench Lite, 22 Kaggle tasks, 20 seeds each. Medal rate is the share of tasks where a
              submission would have placed at or above that Kaggle percentile. Operator quality does
              most of the work here — <span style={{ color: AIRA }}>AIRAgreedy</span> (better operators,
              no smarter search) already closes most of the gap to{" "}
              <span style={{ color: AIRA }}>AIRAmcts</span> (better operators <em>and</em> tree search).
              Swap the model: o3&rsquo;s ordering flips gold to AIRAmcts, R1&rsquo;s puts it on AIRAgreedy
              — a reminder that these curves move under the backbone, not only the search policy.
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex gap-1.5">
              {(["3h", "24h", "72h"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudget(b)}
                  aria-pressed={budget === b}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                    budget === b
                      ? "border-foreground/30 bg-muted/50 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b} budget
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Bar label="AIRA₂ (8 GPU, HCE, ReAct)" val={prVal} err={prErr} max={prMax} color={AIRA} />
              {BASELINES.map((b) => (
                <Bar key={b.method} label={b.method} val={b.val} max={prMax} color={b.method.startsWith("AIRA-dojo") ? OTHER : GHOST} ghost />
              ))}
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              MLE-bench-30, 3 seeds each. Baselines are single numbers each paper reports{" "}
              <span className="text-foreground">at 24h only</span> — they don&rsquo;t move when you
              change the budget above, which is exactly the point: the toggle only ever changes{" "}
              <span style={{ color: AIRA }}>AIRA₂</span>&rsquo;s own bar. Watch{" "}
              <span style={{ color: OTHER }}>AIRA-dojo</span> — literally AIRA₁&rsquo;s own best
              configuration, cited here as a 24h baseline at 39.5 Percentile Rank (medal rate 25.8/20.5/8.8
              at Bronze+/Silver+/Gold). That sits well below the ~45–47% medal rate AIRA₁ reported for
              itself on MLE-bench Lite — not a regression, since Percentile Rank and medal rate are
              different units on a different, harder 30-task set, but a reminder that two numbers which
              both look like percentages can still not be the same measurement.
            </p>
          </>
        )}
      </div>
    </figure>
  )
}
