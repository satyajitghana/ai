"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import { BENCH, type SeqKey } from "@/components/articles/fastlio2/bench-data"

// How much deskewing matters on real data. Each bar is one LiDAR sweep (every fifth
// one) from the two benchmark sequences: its duration from the first to the last point
// timestamp, and the mean gyro rate the IMU measured during it. A return at range r is
// carried sideways by about r * omega * T while the sweep is painted, plus the walking
// speed times T for every point. Drag the range and compare with the two scales the
// filter cares about: the 0.1 m plane-fit tolerance and the 0.5 m map voxel.

const W = 640
const H = 190
const PLANE = 0.1
const VOXEL = 0.5

export function DeskewBudget() {
  const [seq, setSeq] = useState<SeqKey>(Object.keys(BENCH)[0] as SeqKey)
  const [range, setRange] = useState(10)
  const d = BENCH[seq]
  const v = d.speed
  const sm = d.sweeps.map(([t, ms, w]) => ({ t, s: range * w * (ms / 1000) + v * (ms / 1000) }))
  const sorted = sm.map((x) => x.s).sort((a, b) => a - b)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] ?? 0
  const over = sm.filter((x) => x.s > PLANE).length
  const yMax = Math.max(0.6, q(1) * 1.1)
  const tMax = d.duration
  const X = (t: number) => 44 + (t / tMax) * (W - 60)
  const Y = (s: number) => H - 22 - (Math.min(s, yMax) / yMax) * (H - 36)
  const bw = Math.max(1, (W - 60) / Math.max(sm.length, 1) - 0.4)
  const abl = d.ablation

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">deskew · measured sweep by sweep</span>
        <div className="flex gap-1">
          {(Object.keys(BENCH) as SeqKey[]).map((k) => (
            <button key={k} type="button" onClick={() => setSeq(k)} aria-pressed={seq === k}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", seq === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {BENCH[k].short}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Estimated within-sweep smear of a return at ${range} m for every fifth sweep of ${d.label}, against the 0.1 m plane-fit tolerance and the 0.5 m map voxel.`} className="w-full rounded-md border bg-muted/20">
          {sm.map((x, i) => (
            <rect key={i} x={X(x.t)} y={Y(x.s)} width={bw} height={Y(0) - Y(x.s)}
              fill={x.s > VOXEL ? "oklch(0.66 0.18 25)" : x.s > PLANE ? "oklch(0.78 0.15 75)" : "oklch(0.72 0.14 195)"} opacity="0.85" />
          ))}
          {[PLANE, VOXEL].map((y) => (
            <g key={y}>
              <line x1={44} y1={Y(y)} x2={W - 16} y2={Y(y)} stroke="var(--foreground)" strokeDasharray="3 3" strokeWidth="0.8" />
              <text x={40} y={Y(y) + 3} textAnchor="end" className="font-mono" fontSize="8" fill="var(--foreground)">{y} m</text>
            </g>
          ))}
          <text x={W - 16} y={Y(PLANE) - 4} textAnchor="end" className="font-mono" fontSize="8" fill="var(--muted-foreground)">plane-fit tolerance</text>
          <text x={W - 16} y={Y(VOXEL) - 4} textAnchor="end" className="font-mono" fontSize="8" fill="var(--muted-foreground)">map voxel</text>
          <text x={44} y={H - 8} className="font-mono" fontSize="8" fill="var(--muted-foreground)">0 s</text>
          <text x={W - 16} y={H - 8} textAnchor="end" className="font-mono" fontSize="8" fill="var(--muted-foreground)">{tMax.toFixed(0)} s</text>
        </svg>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>range of the return</span>
            <span className="tabular-nums text-foreground">{range} m</span>
          </div>
          <Range min={1} max={40} step={1} value={range} onChange={(e) => setRange(parseInt(e.target.value))} className="w-full cursor-pointer" aria-label="range of the return in metres" accent="var(--foreground)" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="median sweep smear" value={`${(q(0.5) * 100).toFixed(1)} cm`} />
          <Stat label="95th percentile" value={`${(q(0.95) * 100).toFixed(1)} cm`} />
          <Stat label="sweeps over 0.1 m" value={`${((over / Math.max(sm.length, 1)) * 100).toFixed(0)}%`} highlight />
          <Stat label="worst sweep" value={`${(q(1) * 100).toFixed(1)} cm`} />
        </div>

        {abl && (
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
            <Stat label="FAST-LIO2, deskew on: ATE" value={abl.on} />
            <Stat label="same build, deskew off: ATE" value={abl.off} highlight />
          </div>
        )}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {d.sweepNote} The smear is a first-order estimate, range times rate times sweep
          time plus walking speed times sweep time, from the IMU rate measured during each
          sweep and the {v.toFixed(2)} m/s average speed of the reference trajectory. The two
          ATE values underneath are not estimates: they are the same FAST-LIO2 build run on
          this sequence with and without its backward propagation.
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
