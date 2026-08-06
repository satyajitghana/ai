"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// BTL-4's card reports LiveCodeBench v6 per difficulty — easy 99.1, medium 86.7,
// hard 60.5 — plus an aggregate of 66.1% and "the set is 45% hard problems".
// Those four numbers cannot all be true. An aggregate is a weighted mean of the
// three bucket rates, so once you fix the hard share, the aggregate is pinned to
// an interval: lowest when every non-hard problem is medium, highest when every
// non-hard problem is easy. Drag the hard share and watch where 66.1% sits.

const EASY = 99.1
const MED = 86.7
const HARD = 60.5
const CLAIMED_AGG = 66.1
const CLAIMED_HARD = 45

const OK = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.58 0.19 25)"

// aggregate range for a given hard share h (as a fraction)
function band(h: number): [number, number] {
  return [h * HARD + (1 - h) * MED, h * HARD + (1 - h) * EASY]
}

// hard share at which the claimed aggregate first becomes achievable
// (the boundary case: zero easy problems)
const RECONCILE = (MED - CLAIMED_AGG) / (MED - HARD) // 0.786…

const LO = 40
const HI = 100

export function LcbCheck() {
  const [hard, setHard] = useState(CLAIMED_HARD)

  const h = hard / 100
  const [lo, hi] = band(h)
  const reachable = CLAIMED_AGG >= lo - 1e-9
  const gap = lo - CLAIMED_AGG

  const pct = (v: number) => ((v - LO) / (HI - LO)) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          livecodebench v6 · does the table close?
        </span>
        <span className="font-mono text-[10px]" style={{ color: reachable ? OK : BAD }}>
          {reachable ? "consistent" : `impossible by ${gap.toFixed(1)} points`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { k: "easy", v: EASY },
            { k: "medium", v: MED },
            { k: "hard", v: HARD },
          ].map((b) => (
            <div key={b.k} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">{b.k} pass@1</div>
              <div className="font-mono text-sm tabular-nums text-foreground">{b.v}%</div>
            </div>
          ))}
        </div>

        {/* the achievable band */}
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
            <span>aggregate pass@1 achievable at {hard}% hard</span>
            <span className="tabular-nums">
              {lo.toFixed(1)}% &ndash; {hi.toFixed(1)}%
            </span>
          </div>

          <div className="relative h-11">
            {/* track */}
            <div className="absolute inset-x-0 top-3 h-3 rounded-sm bg-muted/50" />
            {/* achievable band */}
            <div
              className="absolute top-3 h-3 rounded-sm"
              style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, background: OK, opacity: 0.85 }}
            />
            {/* claimed aggregate marker */}
            <div
              className="absolute top-0 h-9 w-0.5"
              style={{ left: `${pct(CLAIMED_AGG)}%`, background: reachable ? OK : BAD }}
            />
            <div
              className="absolute top-9 -translate-x-1/2 font-mono text-[10px] tabular-nums"
              style={{ left: `${pct(CLAIMED_AGG)}%`, color: reachable ? OK : BAD }}
            >
              66.1% claimed
            </div>
            {/* axis ticks */}
            {[40, 60, 80, 100].map((t) => (
              <div
                key={t}
                className="absolute top-7 -translate-x-1/2 font-mono text-[9px] text-muted-foreground/70"
                style={{ left: `${pct(t)}%` }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">hard share</span>
          <Range
            min={LO}
            max={HI}
            step={1}
            value={hard}
            onChange={(e) => setHard(Number(e.target.value))}
            className="min-w-[12rem] flex-1"
            aria-label="share of the benchmark that is hard problems, in percent"
            accent={reachable ? OK : BAD}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{hard}%</span>
          <button
            type="button"
            onClick={() => setHard(CLAIMED_HARD)}
            className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            card says 45%
          </button>
          <button
            type="button"
            onClick={() => setHard(Math.round(RECONCILE * 100))}
            className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            what it would take
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          An aggregate is a weighted mean of the buckets, so it can never fall below the worst bucket&rsquo;s
          contribution. At the card&rsquo;s stated{" "}
          <span className="text-foreground">45% hard</span>, the aggregate has to land somewhere between{" "}
          <span className="text-foreground">74.9%</span>{" "}(if every remaining problem is medium) and{" "}
          <span className="text-foreground">81.7%</span>{" "}(if every remaining problem is easy). The card reports{" "}
          <span style={{ color: BAD }}>66.1%</span>{" "}— about nine points below the floor. Reaching 66.1% needs{" "}
          <span className="text-foreground">78.6% hard problems and no easy ones at all</span>, which would leave the
          99.1% easy row measuring an empty set. One of these four numbers is wrong; the card gives no way to tell
          which.
        </p>
      </div>
    </figure>
  )
}
