"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// The memory dial. Twelve cgroup-capped runs of the SAME binary, SAME prompt, on a
// ladder from 8 GB to 224 GB (docs/data/memory-ladder.tsv in kimi-k3-in-c). Every rung
// produced the identical token ids: 17374, 20829, 10, 427, 414, 1008, 606, 142957.
// Dragging the slider changes how much of the 108.81 GB trunk is pinned resident and
// how large the routed-expert LRU cache is -- which changes peak RSS and seconds/token --
// and changes NOTHING else. The output string below the gauges never moves.

const ACCENT = "oklch(0.64 0.17 45)" // trunk pinned
const ACCENT2 = "oklch(0.62 0.14 200)" // expert cache
const SPEED = "oklch(0.62 0.19 25)" // seconds/token

type Rung = {
  total: number
  pinGB: number
  cacheGB: number
  sPerTok: number
  rss: number
}

// docs/data/memory-ladder.tsv, transcribed exactly.
const RUNGS: Rung[] = [
  { total: 8, pinGB: 0, cacheGB: 0.49, sPerTok: 32.69, rss: 8.24 },
  { total: 12, pinGB: 0, cacheGB: 2.79, sPerTok: 31.41, rss: 10.53 },
  { total: 16, pinGB: 4.95, cacheGB: 4.39, sPerTok: 32.21, rss: 16.0 },
  { total: 24, pinGB: 9.71, cacheGB: 7.58, sPerTok: 31.85, rss: 23.95 },
  { total: 32, pinGB: 14.46, cacheGB: 10.8, sPerTok: 31.44, rss: 31.9 },
  { total: 48, pinGB: 23.96, cacheGB: 17.19, sPerTok: 29.76, rss: 47.8 },
  { total: 64, pinGB: 33.46, cacheGB: 23.59, sPerTok: 28.6, rss: 63.71 },
  { total: 96, pinGB: 52.47, cacheGB: 36.39, sPerTok: 24.4, rss: 95.51 },
  { total: 128, pinGB: 72.34, cacheGB: 49.19, sPerTok: 29.4, rss: 128.18 },
  { total: 160, pinGB: 91.34, cacheGB: 61.99, sPerTok: 26.31, rss: 159.98 },
  { total: 192, pinGB: 108.19, cacheGB: 77.0, sPerTok: 21.32, rss: 191.83 },
  { total: 224, pinGB: 108.19, cacheGB: 108.98, sPerTok: 19.21, rss: 223.82 },
]

const MAX_RSS = 224
const MAX_SPT = 33
const FASTEST = 19.21

const W = 640
const H = 210
const GX = 132
const GW = 460

const fmt1 = (n: number) => n.toFixed(1)
const fmt2 = (n: number) => n.toFixed(2)

export function MemoryDial() {
  const [i, setI] = useState(0)
  const r = RUNGS[i]
  const other = Math.max(r.rss - r.pinGB - r.cacheGB, 0)

  const scaleMem = GW / MAX_RSS
  const pinW = r.pinGB * scaleMem
  const cacheW = r.cacheGB * scaleMem
  const otherW = other * scaleMem

  const scaleSpd = GW / MAX_SPT
  const spdW = r.sPerTok * scaleSpd
  const fastestX = GX + FASTEST * scaleSpd

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the memory dial · 8 GB &rarr; 224 GB</span>
        <span>rung {i + 1} / {RUNGS.length}</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At a ${r.total} GB budget the engine pins ${fmt2(r.pinGB)} GB of the trunk and gives ${fmt2(r.cacheGB)} GB to the expert cache, for a peak resident set of ${fmt2(r.rss)} GB and ${fmt1(r.sPerTok)} seconds per token. Every rung of this ladder produces the same output tokens.`}
        >
          {/* memory row */}
          <text x={GX} y={22} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            peak RSS
          </text>
          <text x={GX + GW} y={22} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={700}>
            {fmt2(r.rss)} GB
          </text>
          <rect x={GX} y={30} width={GW} height={22} rx={6} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <rect x={GX} y={30} width={otherW} height={22} rx={6} fill="var(--muted-foreground)" fillOpacity={0.25} />
          <rect x={GX + otherW} y={30} width={pinW} height={22} fill={ACCENT} fillOpacity={0.85} />
          <rect x={GX + otherW + pinW} y={30} width={cacheW} height={22} fill={ACCENT2} fillOpacity={0.85} />
          <rect x={GX} y={30} width={GW} height={22} rx={6} fill="none" stroke="var(--border)" strokeWidth={1} />
          {/* 224 GB ceiling tick */}
          <line x1={GX + GW} y1={26} x2={GX + GW} y2={56} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 2" />

          <g fontSize={9.5} className="font-mono">
            <rect x={GX} y={62} width={9} height={9} rx={2} fill="var(--muted-foreground)" fillOpacity={0.25} />
            <text x={GX + 13} y={70} className="fill-muted-foreground">embed + LM head + KDA state + buffers ({fmt1(other)} GB)</text>
          </g>
          <g fontSize={9.5} className="font-mono">
            <rect x={GX} y={78} width={9} height={9} rx={2} fill={ACCENT} fillOpacity={0.85} />
            <text x={GX + 13} y={86} className="fill-muted-foreground">trunk pinned ({fmt2(r.pinGB)} GB of 108.81 GB)</text>
          </g>
          <g fontSize={9.5} className="font-mono">
            <rect x={GX} y={94} width={9} height={9} rx={2} fill={ACCENT2} fillOpacity={0.85} />
            <text x={GX + 13} y={102} className="fill-muted-foreground">expert cache ({fmt2(r.cacheGB)} GB of 1,447 GB pool)</text>
          </g>

          {/* speed row */}
          <text x={GX} y={132} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            seconds / token
          </text>
          <text x={GX + GW} y={132} textAnchor="end" className="font-mono" fontSize={12} fontWeight={700} style={{ fill: SPEED }}>
            {fmt1(r.sPerTok)} s
          </text>
          <rect x={GX} y={140} width={GW} height={16} rx={6} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <rect x={GX} y={140} width={spdW} height={16} rx={6} fill={SPEED} fillOpacity={0.8} />
          <line x1={fastestX} y1={136} x2={fastestX} y2={160} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 2" />
          <text x={fastestX} y={172} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
            fastest measured, 19.21s
          </text>

          {/* output readout */}
          <rect x={GX} y={184} width={GW} height={20} rx={6} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
          <text x={GX + 8} y={198} className="fill-muted-foreground font-mono" fontSize={9.5}>
            output: <tspan className="fill-foreground">17374, 20829, 10, 427, 414, 1008, 606, 142957</tspan>
            <tspan className="fill-muted-foreground"> — identical at every rung</tspan>
          </text>
        </svg>

        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">budget</span>
          <Range
            min={0}
            max={RUNGS.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted"
            aria-label="Select a memory budget from 8 GB to 224 GB"
            accent={ACCENT}
          />
          <span className="w-14 shrink-0 text-right font-mono text-xs" style={{ color: ACCENT }}>
            {r.total} GB
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Twelve cgroup-capped runs of the same binary on the same prompt, from a laptop&apos;s{" "}
          <span className="text-foreground">8 GB</span>{" "}to a small server&apos;s{" "}
          <span className="text-foreground">224 GB</span>. More memory pins more of the 108.81 GB dense trunk and
          grows the routed-expert cache, which is why the bars move — 28&times; the memory buys{" "}
          <span style={{ color: SPEED }}>1.70&times;</span>{" "}the speed, not more. The token ids at the bottom do not
          move at all, at any position of the slider.
        </p>
      </div>
    </figure>
  )
}
