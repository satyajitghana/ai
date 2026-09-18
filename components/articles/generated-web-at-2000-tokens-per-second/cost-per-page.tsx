"use client"

import { useId, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// "Zero gigabytes stored on disk" trades a storage cost for an inference cost —
// this is that trade, priced. Cerebras's own Shared Tier rate for Qwen3.8-27B
// ($0.99 / $1.49 per million input/output tokens, inference-docs.cerebras.ai)
// against what it costs to move the equivalent bytes out of a CDN instead.
// bytes-per-token (4) is the standard rough conversion, slightly generous to
// markup (real HTML tokenizes a bit denser than English prose). Everything is
// normalized to "cost per 100,000 page loads" so both numbers land in a
// readable range — the per-page figures are in the tens-of-thousandths of a
// cent and don't format legibly on their own.

const IN_RATE = 0.99 // $ per 1M input tokens, Cerebras Shared Tier
const OUT_RATE = 1.49 // $ per 1M output tokens
const INPUT_TOKENS = 300 // system + instruction prompt, fixed assumption
const BYTES_PER_TOKEN = 4 // tokens → bytes, HTML markup

const CDN_TIERS = [
  { label: "cheap CDN", rate: 0.005 },
  { label: "mainstream CDN", rate: 0.085 },
] as const

const SCALE = 100_000 // normalize to $ per 100k page loads

const TMIN = 0.001
const TMAX = 100000
const LOGMIN = mlog10(TMIN)
const LOGSPAN = mlog10(TMAX) - LOGMIN

function pos(dollars: number): number {
  const c = Math.min(Math.max(dollars, TMIN), TMAX)
  return ((mlog10(c) - LOGMIN) / LOGSPAN) * 100
}

function fmtUsd(v: number): string {
  if (v >= 100) return `$${v.toFixed(0)}`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.01) return `$${v.toFixed(3)}`
  return `$${v.toFixed(5)}`
}

export function CostPerPage() {
  const [tokens, setTokens] = useState(4000)
  const [cdnIdx, setCdnIdx] = useState<0 | 1>(1)
  const sliderId = useId()
  const cdn = CDN_TIERS[cdnIdx]

  const genCostPerPage = (INPUT_TOKENS * IN_RATE + tokens * OUT_RATE) / 1_000_000
  const bytes = tokens * BYTES_PER_TOKEN
  const gigabytes = bytes / 1_000_000_000
  const cdnCostPerPage = gigabytes * cdn.rate

  const genScaled = genCostPerPage * SCALE
  const cdnScaled = cdnCostPerPage * SCALE
  const ratio = cdnCostPerPage > 0 ? genCostPerPage / cdnCostPerPage : 0

  const rows = [
    { label: "generated (Cerebras)", value: genScaled, highlight: true },
    { label: `served (${cdn.label})`, value: cdnScaled, highlight: false },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cost per page, generated vs. served</span>
        <span className="tabular-nums text-foreground">{tokens.toLocaleString()} output tok</span>
      </div>

      <div className="p-3 sm:p-4">
        <label htmlFor={sliderId} className="sr-only">
          page size in output tokens
        </label>
        <Range
          id={sliderId}
          min={300}
          max={20000}
          step={100}
          value={tokens}
          onChange={(e) => setTokens(Number(e.target.value))}
          className="w-full"
        />

        <div className="mt-3 flex gap-1.5">
          {CDN_TIERS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setCdnIdx(i as 0 | 1)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors",
                cdnIdx === i
                  ? "border-foreground/40 bg-foreground/[0.06] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} · ${t.rate.toFixed(3)}/GB
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            const pct = pos(r.value)
            const inside = pct >= 78
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-32 shrink-0 truncate text-right font-mono text-[11px] sm:w-40",
                    r.highlight ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.label}
                </span>
                <div className="relative h-5 flex-1">
                  <div
                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm"
                    style={{
                      width: `${Math.max(pct, 0.6)}%`,
                      background: r.highlight ? "oklch(0.6 0.14 210)" : "oklch(0.62 0.02 260)",
                      opacity: r.highlight ? 0.95 : 0.55,
                    }}
                  />
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 font-mono text-[10.5px] tabular-nums",
                      inside ? "pr-1.5 text-background" : "pl-1.5 text-muted-foreground"
                    )}
                    style={inside ? { right: `${100 - pct}%` } : { left: `${pct}%` }}
                  >
                    {fmtUsd(r.value)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 font-mono text-[10.5px] text-muted-foreground">
          <span>
            per page <span className="text-foreground tabular-nums">{fmtUsd(genCostPerPage)}</span> vs{" "}
            <span className="text-foreground tabular-nums">{fmtUsd(cdnCostPerPage)}</span>
          </span>
          <span>
            <span className="text-foreground tabular-nums">{ratio >= 100 ? ratio.toFixed(0) : ratio.toFixed(1)}×</span> more per page
          </span>
          <span>bars scaled to $/100,000 loads</span>
        </div>
      </div>
    </figure>
  )
}
