"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Bytes per token, on one scale. A token touches 1,472 routed experts (top-16 across
// 92 MoE layers). Dequantised to fp32 first, that is 194 GB of pure format conversion.
// Read straight out of packed MXFP4, it is 25.83 GB -- a 7.5x cut before a single
// expert is cached. The slider then asks the second question: how much of that 25.83 GB
// does the routed-expert LRU cache actually avoid reading twice? docs/data/memory-ladder.tsv,
// steady-state incremental decode.

const ACCENT = "oklch(0.64 0.17 45)"
const MUTED_BAR = "oklch(0.55 0.02 260)"

type Rung = { cacheGB: number; gbRead: number; hitTrue: number }

const RUNGS: Rung[] = [
  { cacheGB: 0.49, gbRead: 25.83, hitTrue: 0.0 },
  { cacheGB: 2.79, gbRead: 25.83, hitTrue: 0.0 },
  { cacheGB: 4.39, gbRead: 25.83, hitTrue: 0.0 },
  { cacheGB: 7.58, gbRead: 25.83, hitTrue: 0.0 },
  { cacheGB: 10.8, gbRead: 25.83, hitTrue: 0.0 },
  { cacheGB: 17.19, gbRead: 25.83, hitTrue: 0.0 },
  { cacheGB: 23.59, gbRead: 25.83, hitTrue: 0.0 },
  { cacheGB: 36.39, gbRead: 18.11, hitTrue: 29.89 },
  { cacheGB: 49.19, gbRead: 17.51, hitTrue: 32.2 },
  { cacheGB: 61.99, gbRead: 17.28, hitTrue: 33.08 },
  { cacheGB: 77.0, gbRead: 16.65, hitTrue: 35.53 },
  { cacheGB: 108.98, gbRead: 14.53, hitTrue: 43.75 },
]

const MATERIALIZED = 194
const PACKED_CEILING = 25.83
const SCALE_MAX = 200

const W = 640
const H = 208
const GX = 8
const GW = 624
const scale = GW / SCALE_MAX

const fmt2 = (n: number) => n.toFixed(2)

export function BytesPerToken() {
  const [i, setI] = useState(0)
  const r = RUNGS[i]
  const materializedW = MATERIALIZED * scale
  const ceilingW = PACKED_CEILING * scale
  const servedW = r.gbRead * scale

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>bytes per token · one decode step, 1,472 experts</span>
        <span>0 &rarr; {SCALE_MAX} GB</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`If every touched expert were dequantised to fp32 first, one decode step would move 194 gigabytes. Read directly out of packed MXFP4 it is 25.83 gigabytes. At a ${fmt2(r.cacheGB)} gigabyte expert cache, the engine actually reads ${fmt2(r.gbRead)} gigabytes from disk this token, a ${r.hitTrue}% true resident hit rate.`}
        >
          {/* row 1: materialized */}
          <text x={GX} y={16} className="fill-muted-foreground font-mono" fontSize={10}>
            if dequantised to fp32 first
          </text>
          <rect x={GX} y={22} width={GW} height={20} rx={5} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <rect x={GX} y={22} width={materializedW} height={20} rx={5} fill={MUTED_BAR} fillOpacity={0.55} />
          <text x={GX + materializedW - 8} y={36} textAnchor="end" className="fill-background font-mono" fontSize={10} fontWeight={700}>
            194 GB
          </text>

          {/* row 2: packed ceiling (nothing cached) */}
          <text x={GX} y={68} className="fill-muted-foreground font-mono" fontSize={10}>
            packed MXFP4, nothing cached (7.5&times; less)
          </text>
          <rect x={GX} y={74} width={GW} height={20} rx={5} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <rect x={GX} y={74} width={ceilingW} height={20} rx={5} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 3" />
          <text x={GX + ceilingW + 6} y={88} className="fill-muted-foreground font-mono" fontSize={10}>
            25.83 GB
          </text>

          {/* row 3: what the cache actually serves */}
          <text x={GX} y={120} className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            packed MXFP4, this cache size
          </text>
          <text x={GX + GW} y={120} textAnchor="end" className="font-mono" fontSize={11} fontWeight={700} style={{ fill: ACCENT }}>
            {fmt2(r.gbRead)} GB
          </text>
          <rect x={GX} y={126} width={GW} height={22} rx={6} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <rect x={GX} y={126} width={servedW} height={22} rx={6} fill={ACCENT} fillOpacity={0.85} />
          <line x1={GX + ceilingW} y1={122} x2={GX + ceilingW} y2={152} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 2" />

          {/* readout */}
          <rect x={GX} y={162} width={GW} height={38} rx={6} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
          <text x={GX + 10} y={178} className="fill-muted-foreground font-mono" fontSize={9.5}>
            expert cache <tspan className="fill-foreground">{fmt2(r.cacheGB)} GB</tspan> &middot; TRUE resident hit rate{" "}
            <tspan style={{ fill: ACCENT }}>{r.hitTrue}%</tspan>
          </text>
          <text x={GX + 10} y={194} className="fill-muted-foreground font-mono" fontSize={9.5}>
            bytes avoided vs. the packed ceiling: <tspan className="fill-foreground">{fmt2(PACKED_CEILING - r.gbRead)} GB</tspan>
          </text>
        </svg>

        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">cache</span>
          <Range
            min={0}
            max={RUNGS.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted"
            aria-label="Select an expert-cache arena size"
            accent={ACCENT}
          />
          <span className="w-16 shrink-0 text-right font-mono text-xs" style={{ color: ACCENT }}>
            {fmt2(r.cacheGB)} GB
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The first cut is reduction one and it never moves: reading packed nibbles instead of dequantising first
          drops 194 GB to 25.83 GB before the cache does anything. The second cut is the cache, and it is honest
          about its limits — drag below <span className="text-foreground">~36 GB</span> of arena and the bar does
          not move at all, because Kimi K3&apos;s router is trained to flatten expert usage, which leaves the cache
          nothing hot to hold.
        </p>
      </div>
    </figure>
  )
}
