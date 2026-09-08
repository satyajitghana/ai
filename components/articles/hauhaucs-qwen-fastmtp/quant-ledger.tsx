"use client"

import { useState } from "react"

// The model card's own claim, checked against its own table, not against a
// download: "A K_P quant effectively bumps quality up by one or two quant
// levels at only around 5-15% more size than the base quant." The card's
// Downloads table lists both the real K_P file's bpw (from this repo) and a
// reference bpw for the corresponding standard llama.cpp quant type (no file,
// just a bpw figure) directly underneath each K_P row -- e.g. "Q8_K_P 9.21"
// then "-- Q8_0 8.50". Five such pairs exist; the other six files (three IQ
// quants, the FastMTP sidecar, mmproj, and IQ4_XS which has no reference row)
// aren't claim-checkable this way, so they're left out here rather than forced
// into a comparison the card itself doesn't make.
// Fetched 2026-08-29 from README.md's "Downloads" table. Percentages computed
// here: (kp_bpw - base_bpw) / base_bpw * 100.

type Row = { kp: string; kpBpw: number; base: string; baseBpw: number; sizeGB: number }

const ROWS: Row[] = [
  { kp: "Q8_K_P", kpBpw: 9.21, base: "Q8_0", baseBpw: 8.5, sizeGB: 31.46 },
  { kp: "Q6_K_P", kpBpw: 7.59, base: "Q6_K", baseBpw: 6.6, sizeGB: 25.92 },
  { kp: "Q5_K_P", kpBpw: 5.92, base: "Q5_K_M", baseBpw: 5.7, sizeGB: 20.22 },
  { kp: "Q4_K_P", kpBpw: 5.25, base: "Q4_K_M", baseBpw: 4.88, sizeGB: 17.92 },
  { kp: "Q3_K_P", kpBpw: 3.93, base: "Q3_K_M", baseBpw: 3.9, sizeGB: 13.44 },
]

const CLAIM_LOW = 5
const CLAIM_HIGH = 15

const IN_BAND = "oklch(0.55 0.16 155)"
const BELOW = "oklch(0.68 0.13 85)"
const BASE_COLOR = "oklch(0.62 0.03 250)"

export function QuantLedger() {
  const [sortByDelta, setSortByDelta] = useState(true)

  const withDelta = ROWS.map((r) => ({ ...r, delta: ((r.kpBpw - r.baseBpw) / r.baseBpw) * 100 }))
  const rows = sortByDelta ? [...withDelta].sort((a, b) => a.delta - b.delta) : withDelta
  const maxBpw = Math.max(...ROWS.map((r) => r.kpBpw))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the card&rsquo;s own &ldquo;5–15% more size&rdquo; claim vs its own bpw table</span>
        <button
          type="button"
          onClick={() => setSortByDelta((v) => !v)}
          className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {sortByDelta ? "sorted by size delta" : "quant order"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {rows.map((r) => {
            const inBand = r.delta >= CLAIM_LOW && r.delta <= CLAIM_HIGH
            const color = inBand ? IN_BAND : BELOW
            const kpW = (r.kpBpw / maxBpw) * 100
            const baseW = (r.baseBpw / maxBpw) * 100
            return (
              <div key={r.kp}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
                  <span className="text-foreground">
                    {r.kp} <span className="text-muted-foreground">vs {r.base}</span>
                  </span>
                  <span style={{ color }}>
                    +{r.delta.toFixed(2)}% size {inBand ? "· within claimed band" : "· below the claimed 5–15%"}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">{r.kp}</span>
                    <div className="h-4 flex-1 rounded bg-muted/20">
                      <div className="h-4 rounded" style={{ width: `${kpW}%`, background: color, opacity: 0.9 }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color }}>
                      {r.kpBpw.toFixed(2)} bpw
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">{r.base}</span>
                    <div className="h-4 flex-1 rounded bg-muted/20">
                      <div className="h-4 rounded" style={{ width: `${baseW}%`, background: BASE_COLOR, opacity: 0.55 }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {r.baseBpw.toFixed(2)} bpw
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sorted by delta, the claim holds for three of the five checkable pairs — Q8_K_P at +8.35%, Q4_K_P at
          +7.58%, Q6_K_P right at the ceiling at +15.00% — and misses low for two.{" "}
          <span style={{ color: BELOW }}>Q5_K_P</span> comes in at +3.86%, under the stated floor, and{" "}
          <span style={{ color: BELOW }}>Q3_K_P</span> is the outlier: +0.77% more size than plain Q3_K_M, close
          enough to call it the same footprint. None of this contradicts the size math elsewhere in this
          article — every file&rsquo;s own bpw and byte count check out against the repo&rsquo;s published sizes — it&rsquo;s the
          separate marketing claim about how K_P quants compare to standard ones that is directionally true but
          not uniform: two of the five pairs the card&rsquo;s own table invites you to compare don&rsquo;t land in
          the range it states.
        </p>
      </div>
    </figure>
  )
}
