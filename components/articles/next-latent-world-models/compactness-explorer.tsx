"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number here is Table 1 of arXiv 2511.05963v1 (Manhattan Taxi Rides,
// Section 4.1), verbatim -- "Comparison of GPT, MTP, JTP, and NextLat trained
// on Manhattan taxi rides against the true world model across several
// metrics." Metric definitions are Section 4.1's own itemized list, not this
// site's paraphrase:
//   - Sequence Compression: "Percentage of cases where the model produces
//     identical continuations when prompted with two different traversals
//     arriving at the same state and sharing the same destination."
//   - Effective Latent Rank: "effective rank/dimension of hidden states
//     measured as the exponentiated Shannon entropy of the normalized
//     singular values (Roy and Vetterli, 2007); lower values indicate better
//     compression."
//   - Detour Robustness: "Percentage of valid traversals for OOD
//     pickup-dropoff pairs when we substitute the model's top-1 prediction
//     with random detours (legal turns) 75% of the time."
//   - Valid Trajectories: percentage of generated 100-step traversals that
//     stay on legal, connected road segments (Section 4.1, main text).
//
// Appendix D.1 is explicit that Effective Latent Rank is NOT read from the
// same point in every model: GPT and NextLat use final-layer hidden states;
// JTP uses the hidden state immediately before self-attention in its "Fetch"
// head (Ahn et al. 2025, their Eq. 4-5); MTP uses the output of its
// next-token prediction head. The three numbers below are what the paper
// reports, but they are not reading identical objects, which is why this
// component surfaces that caveat rather than only the numbers.
//
// The true world model has 4,580 intersections and 9,846 edges (Section
// 4.1) and is not a learned model, so it has no hidden state to rank --
// shown as a dashed reference line on the other three metrics only.

type MetricKey = "rank" | "compression" | "valid" | "detour"

type Metric = {
  key: MetricKey
  label: string
  unit: string
  lowerBetter: boolean
  values: { GPT: number; MTP: number; JTP: number; NextLat: number }
  trueModel: number | null
  note: string
}

const METRICS: Metric[] = [
  {
    key: "rank",
    label: "Effective Latent Rank",
    unit: "",
    lowerBetter: true,
    values: { GPT: 160.1, MTP: 57.7, JTP: 215.8, NextLat: 52.7 },
    trueModel: null,
    note: "lower = more compact. Read from different points in each model (Appendix D.1) — GPT/NextLat: final hidden state; JTP: pre-attention Fetch-head state; MTP: prediction-head output.",
  },
  {
    key: "compression",
    label: "Sequence Compression",
    unit: "%",
    lowerBetter: false,
    values: { GPT: 65, MTP: 64, JTP: 32, NextLat: 71 },
    trueModel: 100,
    note: "how often two different routes to the same state produce identical continuations — a direct test of whether equivalent histories collapse to one internal state.",
  },
  {
    key: "valid",
    label: "Valid Trajectories",
    unit: "%",
    lowerBetter: false,
    values: { GPT: 97.0, MTP: 98.1, JTP: 97.1, NextLat: 98.7 },
    trueModel: 100,
    note: "percentage of generated 100-step traversals that stay on legal, connected road segments.",
  },
  {
    key: "detour",
    label: "Detour Robustness",
    unit: "%",
    lowerBetter: false,
    values: { GPT: 85.0, MTP: 95.0, JTP: 87.0, NextLat: 95.0 },
    trueModel: 100,
    note: "OOD pickup-dropoff pairs, with 75% of the model's own top-1 predictions overridden by a random legal detour — tests whether the model can recover a valid path after being forced off its own plan.",
  },
]

const METHODS = ["GPT", "MTP", "JTP", "NextLat"] as const
type Method = (typeof METHODS)[number]

const COLOR: Record<Method, string> = {
  GPT: "oklch(0.58 0.02 250)",
  MTP: "oklch(0.72 0.14 85)",
  JTP: "oklch(0.62 0.14 300)",
  NextLat: "oklch(0.63 0.19 25)",
}

export function CompactnessExplorer() {
  const [metricKey, setMetricKey] = useState<MetricKey>("rank")
  const metric = METRICS.find((m) => m.key === metricKey)!

  const allValues = [...Object.values(metric.values), ...(metric.trueModel != null ? [metric.trueModel] : [])]
  const max = Math.max(...allValues)

  const ranked = METHODS.slice().sort((a, b) =>
    metric.lowerBetter ? metric.values[a] - metric.values[b] : metric.values[b] - metric.values[a]
  )
  const winner = ranked[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Table 1, Manhattan Taxi Rides — pick a metric</span>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetricKey(m.key)}
              aria-pressed={metricKey === m.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metricKey === m.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
          <span className="font-mono text-[13px] font-medium text-foreground">
            {metric.label}
            {metric.unit ? ` (${metric.unit})` : ""}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {metric.lowerBetter ? "lower is better" : "higher is better"}
          </span>
        </div>

        <div className="space-y-2.5">
          {METHODS.map((m) => {
            const v = metric.values[m]
            const w = (v / max) * 100
            const isWinner = m === winner
            return (
              <div key={m}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
                  <span className={isWinner ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {m}
                    {isWinner ? " ←" : ""}
                  </span>
                  <span className="tabular-nums" style={{ color: isWinner ? COLOR[m] : "currentColor" }}>
                    {v.toFixed(1)}
                    {metric.unit}
                  </span>
                </div>
                <div className="relative h-4 rounded bg-muted/20">
                  <div
                    className="h-4 rounded"
                    style={{ width: `${w}%`, background: COLOR[m], opacity: isWinner ? 0.95 : 0.45 }}
                  />
                  {metric.trueModel != null ? (
                    <div
                      className="absolute top-0 h-4 w-px bg-foreground/50"
                      style={{ left: `${(metric.trueModel / max) * 100}%` }}
                      title={`true world model: ${metric.trueModel}${metric.unit}`}
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        {metric.trueModel != null ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            vertical line — true world model: {metric.trueModel}
            {metric.unit}
          </p>
        ) : null}

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <p className="text-[12.5px] leading-5 text-muted-foreground">{metric.note}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          NextLat leads on all four, but the margin is not the same story every time. On effective
          rank it beats GPT by more than 3x, and MTP is close behind at 57.7 — a real but much
          narrower gap than the headline comparison to GPT suggests. On sequence compression, the
          metric closest to actually testing state abstraction rather than accuracy, the gap to every
          baseline is wider: JTP&rsquo;s 32% is worse than GPT&rsquo;s 65%, meaning JTP&rsquo;s extra
          token-level supervision made its internal map <em>less</em> consistent, not more.
        </p>
      </div>
    </figure>
  )
}
