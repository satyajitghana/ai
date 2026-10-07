"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How small a change in mention rate a tracker can see, against what it costs.
//
// OpenSEO collects one fresh answer per prompt and engine per check
// (aiVisibilityCost.ts warns "One fresh answer per prompt and engine"). The
// trend (aiVisibilityTrend.ts) compares the last `days` with the `days`
// before, over cells = prompt x engine x market x brand that have answers in
// both periods; each period's rate is the mean of the cells' own rates.
//
// If every answer is an independent yes/no draw with probability p, a period
// with n answers spread evenly over its cells has a rate with standard error
// sqrt(p(1-p)/n), and the difference of two periods has sqrt(2) times that.
// The smallest change a two-sided 95% test separates from noise is then about
// 1.96 x sqrt(2) x sqrt(p(1-p)/n). Prompts that differ in their own rates only
// lower p(1-p) on average, so equal rates are the worst case for a given mean.
// Independence between runs is the best case: answers that repeat from run to
// run (a provider-side cache, a model that always says the same thing) carry
// less information than n draws. The two assumptions lean opposite ways, so
// the band is an order of magnitude, not a test.
//
// Cost uses OpenSEO's hosted estimate of $0.002 per answer
// (AI_RECORD_COST_USD = 0.0012 raw, x 1.28 markup, ceiled to 2 credits of
// $0.001) and planning checks per month of 30 / 4 / 1 (scheduledChecksPerMonth
// in src/shared/rank-tracking.ts).
//
// Pure function of the controls: no randomness, no timers.

type Cadence = "daily" | "weekly" | "monthly"
const INTERVAL_DAYS: Record<Cadence, number> = { daily: 1, weekly: 7, monthly: 30 }
const CHECKS_PER_MONTH: Record<Cadence, number> = { daily: 30, weekly: 4, monthly: 1 }
const WINDOWS = [7, 28, 90] as const

const USD_PER_ANSWER = 0.002

const fmtUsd = (x: number) => `$${x < 10 ? x.toFixed(2) : x.toFixed(0)}`

export function NoiseBudget() {
  const [prompts, setPrompts] = useState(20)
  const [engines, setEngines] = useState(2)
  const [cadence, setCadence] = useState<Cadence>("weekly")
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(7)
  const [rate, setRate] = useState(50)

  const checks = Math.floor(days / INTERVAL_DAYS[cadence])
  const perCheck = prompts * engines
  const n = checks * perCheck
  const p = rate / 100
  const se = n > 0 ? Math.sqrt((p * (1 - p)) / n) : null
  const mdc = se === null ? null : 1.96 * Math.SQRT2 * se * 100
  const monthly = perCheck * CHECKS_PER_MONTH[cadence] * USD_PER_ANSWER

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="text-muted-foreground">Tracked non-branded prompts: </span>
          <span className="font-mono">{prompts}</span>
          <Range className="mt-1 w-full" min={5} max={100} step={5} value={prompts} onChange={(e) => setPrompts(Number(e.target.value))} />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Typical mention rate: </span>
          <span className="font-mono">{rate}%</span>
          <Range className="mt-1 w-full" min={5} max={95} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Engines</span>
        {[1, 2, 3].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setEngines(k)}
            className={cn("border-border hover:bg-muted rounded-md border px-2 py-0.5 font-mono", engines === k && "bg-muted font-semibold")}
          >
            {k}
          </button>
        ))}
        <span className="text-muted-foreground ml-2">Cadence</span>
        {(["daily", "weekly", "monthly"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCadence(c)}
            className={cn("border-border hover:bg-muted rounded-md border px-2 py-0.5", cadence === c && "bg-muted font-semibold")}
          >
            {c}
          </button>
        ))}
        <span className="text-muted-foreground ml-2">Trend window</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setDays(w)}
            className={cn("border-border hover:bg-muted rounded-md border px-2 py-0.5 font-mono", days === w && "bg-muted font-semibold")}
          >
            {w}d
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Answers per period</div>
          <div className="mt-1 font-mono text-lg">{n}</div>
          <div className="text-muted-foreground text-xs">
            {checks} {checks === 1 ? "check" : "checks"} x {perCheck} answers
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Smallest change you can trust</div>
          <div className="mt-1 font-mono text-lg">{mdc === null ? "none" : `±${mdc.toFixed(1)} pts`}</div>
          <div className="text-muted-foreground text-xs">
            {mdc === null ? "no check lands in a window this short" : `rate ±${((se ?? 0) * 100).toFixed(1)} pts (1 s.e.) per period`}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Hosted cost per month</div>
          <div className="mt-1 font-mono text-lg">{fmtUsd(monthly)}</div>
          <div className="text-muted-foreground text-xs">
            {perCheck * CHECKS_PER_MONTH[cadence]} answers at $0.002 (estimate)
          </div>
        </div>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-amber-500/70"
          style={{ width: `${mdc === null ? 100 : Math.min(100, mdc).toFixed(1)}%` }}
        />
      </div>
      <div className="text-muted-foreground mt-1 text-xs">Bar: the noise band as a share of the 0-100 scale.</div>

      <figcaption className="text-muted-foreground mt-3 text-xs leading-relaxed">
        Assumes every prompt shares the typical rate (the worst case for a given average) and
        that runs are independent draws (the best case, since answers that repeat from run to run
        carry less information). Read the band as an order of magnitude. A change smaller than it
        can be a real shift or a coin landing differently, and the tracker cannot tell you which.
      </figcaption>
    </figure>
  )
}
