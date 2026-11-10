"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// What one LIBERO episode of CaPtain-4B costs in policy compute, against the
// per-episode prices other code-as-policy agents report.
//
// Reported, not measured here (paper Section 4.2, "Cost"): a CaPtain-4B episode
// averages 32.6 requests, 16.6 physical actions and 7.3k output tokens, and
// takes 417 s of wall time on a GPU shared by eight episodes, "about 52
// GPU-seconds of policy compute", 0.03-0.06 dollars per episode at 2-4 dollars
// per GPU-hour, excluding perception services. Published agents: 0.18-0.24
// dollars (SPARK, WAA, RACaP) and 8-22 dollars (OpenRUA).
//
//   gpu_s = 417 / episodes_per_gpu
//   cost  = gpu_s * price / 3600
//
// Only the slider arithmetic is mine. The log axis goes through lib/dmath.

const WALL = 417
const BARS = [
  { label: "SPARK / WAA / RACaP", lo: 0.18, hi: 0.24 },
  { label: "OpenRUA (Claude Opus 5)", lo: 8, hi: 22 },
]
const LO = -3
const HI = 1.5
const TICKS = [
  { v: 0.001, t: "$0.001" },
  { v: 0.01, t: "$0.01" },
  { v: 0.1, t: "$0.10" },
  { v: 1, t: "$1" },
  { v: 10, t: "$10" },
]

export function EpisodeCost() {
  const [share, setShare] = useState(8)
  const [price, setPrice] = useState(3)
  const gpuS = WALL / share
  const cost = (gpuS * price) / 3600
  const W = 600
  const PL = 160
  const x = (v: number) => PL + ((mlog10(v) - LO) / (HI - LO)) * (W - PL - 10)
  const accent = "var(--hg-accent, oklch(0.72 0.15 195))"
  const rows = [
    { label: "CaPtain-4B, policy only", lo: cost, hi: cost },
    ...BARS,
  ]

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Per-episode cost of CaPtain-4B against frontier-model agents"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        one LIBERO episode: 417 s wall time · prices are the paper&rsquo;s, the slider arithmetic is
        mine
      </div>
      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <label className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-muted-foreground">episodes per GPU</span>
          <Range
            min={1}
            max={16}
            step={1}
            value={share}
            onChange={(e) => setShare(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="episodes sharing one GPU"
          />
          <span className="w-28 shrink-0 text-right tabular-nums">
            {share} · {gpuS.toFixed(0)} GPU-s
          </span>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-muted-foreground">GPU price, $/hour</span>
          <Range
            min={1}
            max={8}
            step={0.5}
            value={price}
            onChange={(e) => setPrice(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="GPU price per hour"
          />
          <span className="w-28 shrink-0 text-right tabular-nums">{price.toFixed(2)}</span>
        </label>
      </div>
      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} 120`}
          width="100%"
          className="min-w-[440px]"
          role="img"
          aria-label={`CaPtain-4B policy compute costs ${cost.toFixed(3)} dollars per episode at these settings.`}
        >
          {TICKS.map((t) => (
            <g key={t.v}>
              <line x1={x(t.v)} x2={x(t.v)} y1={6} y2={96} stroke="currentColor" opacity={0.12} />
              <text
                x={x(t.v)}
                y={110}
                textAnchor="middle"
                className="fill-current font-mono text-[9px] opacity-60"
              >
                {t.t}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = 14 + i * 30
            return (
              <g key={r.label}>
                <text x={PL - 8} y={y + 4} textAnchor="end" className="fill-current font-mono text-[10px]">
                  {r.label}
                </text>
                {r.lo === r.hi ? (
                  <circle cx={x(r.lo)} cy={y} r={6} fill={accent} />
                ) : (
                  <rect
                    x={x(r.lo)}
                    y={y - 5}
                    width={Math.max(4, x(r.hi) - x(r.lo))}
                    height={10}
                    rx={3}
                    fill="currentColor"
                    opacity={0.55}
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="grid gap-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-2">
        <div>
          <span className="tabular-nums">${cost.toFixed(3)}</span>{" "}
          <span className="text-muted-foreground">policy compute per episode</span>
        </div>
        <div>
          <span className="tabular-nums">{(0.18 / cost).toFixed(0)}x</span>{" "}
          <span className="text-muted-foreground">below the cheapest frontier agent quoted</span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Not in the dot: SAM 3 and Molmo2-8B, the perception services every <code>segment</code> and{" "}
        <code>point</code> call goes to. Molmo2-8B alone is about twice the size of the policy.
      </figcaption>
    </figure>
  )
}
