"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Reproducing the model card's own worked cost example, not a new formula.
// Its prose, in order:
//
//   "the base cost of a B200 is $6.2496 per hour" (confirmed against Modal's
//   published B200 rate independently)
//   "Region pinning adds a 1.5x multiplier, bringing the cost to $9.3744/hour"
//   "We target 70% utilization (divide by 0.70), so we have an effective cost
//   of $13.392/hour, or $0.2232/minute"
//   "Dividing $0.2232/minute by 88 concurrent agents equals a per-minute
//   agent cost of $0.00025."
//
// Every step up to and including $0.2232/minute is arithmetically exact.
// The last step is not: 0.2232 / 88 = 0.002536..., about 10x the stated
// $0.00025. The card's own linked cost spreadsheet -- and its own leaderboard
// chart (images/01) -- both independently list "PhoneLLM 30B Alpha 1" at
// $0.0025/min, matching the correct division, not the printed one.

const BASE_RATE = 6.2496 // $/hr per B200, confirmed against Modal's published rate
const SHIPPED_REGION_MULT = 1.5
const SHIPPED_UTIL = 0.7
const SHIPPED_N = 88

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

const fmt4 = (n: number) => `$${n.toFixed(4)}`
const fmt5 = (n: number) => `$${n.toFixed(5)}`

export function CostPerMinuteCalculator() {
  const [regionMult, setRegionMult] = useState(SHIPPED_REGION_MULT)
  const [util, setUtil] = useState(SHIPPED_UTIL)
  const [n, setN] = useState(SHIPPED_N)

  const { hourly, perMinInfra, perAgentPerMin } = useMemo(() => {
    const hourly = (BASE_RATE * regionMult) / util
    const perMinInfra = hourly / 60
    const perAgentPerMin = perMinInfra / n
    return { hourly, perMinInfra, perAgentPerMin }
  }, [regionMult, util, n])

  const atShippedDefaults = regionMult === SHIPPED_REGION_MULT && util === SHIPPED_UTIL && n === SHIPPED_N
  const matchesSpreadsheet = Math.abs(perAgentPerMin - 0.0025) < 0.0002

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the card&rsquo;s own worked example, live</span>
        <span className="font-mono text-[10px] text-muted-foreground">1x B200 · Modal dedicated endpoint</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>region multiplier</span>
              <span className="text-foreground">{regionMult.toFixed(2)}x</span>
            </div>
            <Range min={1} max={2} step={0.1} value={regionMult} onChange={(e) => setRegionMult(Number(e.target.value))} aria-label="region multiplier" accent={GOOD} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>utilization</span>
              <span className="text-foreground">{Math.round(util * 100)}%</span>
            </div>
            <Range min={0.3} max={1} step={0.05} value={util} onChange={(e) => setUtil(Number(e.target.value))} aria-label="utilization" accent={GOOD} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>concurrent agents (N)</span>
              <span className="text-foreground">{n}</span>
            </div>
            <Range min={1} max={176} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="concurrent agents" accent={GOOD} />
          </div>
        </div>

        <div className="mt-4 space-y-1 rounded-lg border bg-muted/20 p-3 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">$6.2496/hr × {regionMult.toFixed(2)} ÷ {util.toFixed(2)}</span>
            <span className="text-foreground tabular-nums">{fmt4(hourly)}/hr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">÷ 60</span>
            <span className="text-foreground tabular-nums">{fmt4(perMinInfra)}/min</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span className="text-muted-foreground">÷ {n} concurrent agents</span>
            <span className="font-bold tabular-nums" style={{ color: matchesSpreadsheet ? GOOD : "currentColor" }}>
              {fmt5(perAgentPerMin)}/min
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px]">
          <span className="text-muted-foreground">
            card&rsquo;s printed result: <span style={{ color: BAD }}>$0.00025/min</span>
          </span>
          <span className="text-muted-foreground">
            spreadsheet + leaderboard both list: <span style={{ color: GOOD }}>$0.0025/min</span>
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Leave every slider at the card&rsquo;s own shipped defaults —{" "}
          {atShippedDefaults ? (
            <>this is that exact setting —</>
          ) : (
            <>1.5x region, 70% utilization, 88 agents —</>
          )}{" "}
          and dividing <span className="font-mono">$0.2232/min</span> by <span className="font-mono">88</span> comes
          out to <span style={{ color: GOOD }} className="font-mono">$0.00254/min</span>, not the printed{" "}
          <span style={{ color: BAD }} className="font-mono">$0.00025</span>. That correct number is not a
          reconstruction — it&rsquo;s what the model card&rsquo;s own linked cost-estimator spreadsheet and
          its own leaderboard chart already say for this exact row, independently of this arithmetic. The
          error is isolated to one printed sentence; every number that generates it, and every number that
          cross-checks it elsewhere on the same page, is correct.
        </p>
      </div>
    </figure>
  )
}
