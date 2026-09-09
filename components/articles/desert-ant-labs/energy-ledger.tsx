"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The "470x less energy" claim, recomputed from its own published inputs.
//
// desertant.com/about states the methodology in one sentence: "Sonnet:
// measured tokens on 38,308 jobs, energy estimated from published MLPerf
// runs. Clips: 2.4s on an iPhone 17 Pro at an assumed 3W." -- and the two
// headline totals: 0.3kWh (Clips) vs 140kWh (Sonnet) for 100,000 jobs.
//
// Multiplying their own inputs does not reproduce their own total:
// 2.4s x 3W x 100,000 jobs = 720,000 J = 0.2kWh, a 700x gap to 140kWh, not
// 470x. The published 0.3kWh matches 140/470 almost exactly, so the 470x
// headline and the 0.3kWh total agree with EACH OTHER -- neither agrees with
// the 2.4s-at-3W methodology note published right next to them.
//
// The second toggle uses 9.19s instead of 2.4s -- desert-ant-labs/clips's own
// model card, the only other per-job latency number Desert Ant has published,
// for a 25-minute / 12-clip video (the energy claim's job is a 30-minute
// video, so if anything this should run slightly longer, not 3.8x longer).

const JOBS = 100_000
const SONNET_KWH = 140

type Scenario = "published" | "card"

const SCENARIOS: Record<Scenario, { seconds: number; label: string; sub: string }> = {
  published: { seconds: 2.4, label: "as published", sub: "the /about page's own energy footnote" },
  card: { seconds: 9.19, label: "using the model card's own latency", sub: "25-min / 12-clip video, iPhone 17 Pro, desert-ant-labs/clips README" },
}

const WATTS = 3

function computeKwh(seconds: number) {
  const joulesPerJob = seconds * WATTS
  const totalJoules = joulesPerJob * JOBS
  return totalJoules / 3_600_000
}

const GOOD = "oklch(0.55 0.16 155)"

export function EnergyLedger() {
  const [scenario, setScenario] = useState<Scenario>("published")
  const cfg = SCENARIOS[scenario]
  const clipsKwh = computeKwh(cfg.seconds)
  const ratio = SONNET_KWH / clipsKwh
  const claimedKwh = 0.3
  const claimedRatio = 470

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">recomputing “470x less energy”, 100,000 thirty-minute-video jobs</span>
        <span className="font-mono text-[10px] text-muted-foreground">desertant.com/about, own footnote</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SCENARIOS) as Scenario[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setScenario(k)}
              aria-pressed={scenario === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                scenario === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {SCENARIOS[k].label}
            </button>
          ))}
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">{cfg.sub}</div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 px-2.5 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">per job</div>
            <div className="font-mono text-xs tabular-nums text-foreground">{cfg.seconds}s &times; {WATTS}W</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-2.5 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">&times; 100,000 jobs</div>
            <div className="font-mono text-xs tabular-nums text-foreground">{clipsKwh.toFixed(2)} kWh</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-2.5 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Sonnet, same jobs</div>
            <div className="font-mono text-xs tabular-nums text-foreground">{SONNET_KWH} kWh</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-2.5 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">ratio</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
              {ratio.toFixed(0)}x
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Published headline: <span className="text-foreground">{claimedKwh}kWh</span> for Clips,{" "}
          <span className="text-foreground">{claimedRatio}x</span> less energy than Sonnet&rsquo;s{" "}
          {SONNET_KWH}kWh. Multiplying the methodology note&rsquo;s own inputs (2.4s &times; 3W &times;
          100,000) gives {computeKwh(2.4).toFixed(2)}kWh, which is a {(SONNET_KWH / computeKwh(2.4)).toFixed(0)}x
          ratio &mdash; not {claimedRatio}x. The published {claimedKwh}kWh total actually matches{" "}
          {SONNET_KWH}/{claimedRatio} almost exactly, so the headline ratio and the headline total agree
          with each other; neither agrees with the seconds-and-watts arithmetic printed next to them.
          Swap in the 9.19s Desert Ant itself measures elsewhere for a similar video and the ratio drops
          further, to a still-real but much smaller {(SONNET_KWH / computeKwh(9.19)).toFixed(0)}x. Both the
          numerator (Sonnet&rsquo;s 140kWh, from published MLPerf estimates rather than a metered run) and
          the denominator here are estimates, not measurements &mdash; a real advantage, on a number that
          does not survive its own arithmetic.
        </p>
      </div>
    </figure>
  )
}
