"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { SKY, type SkyRow, VOXEL_IN_SPACINGS } from "./data"

// What sky does to the GSNorm statistic when --sky_seg is off (the release
// default). Every number is from my numpy run (sky.py, see data.ts): tilt the
// camera up, more of each frame is sky, and the median spacing of the whole
// frame drifts toward the sky's. The chart plots the factor error (sky masked
// over sky included) against the sky share; the readouts translate it into
// what the Gaussian head and the voxel merge see on the non-sky pixels.

const W = 560
const H = 230
const L = 50
const R = 18
const T = 16
const B = 40
const XMAX = 0.5
const YMAX = 3.6

const px = (s: number) => L + (s / XMAX) * (W - L - R)
const py = (r: number) => T + (1 - (r - 1) / (YMAX - 1)) * (H - T - B)

type Scene = "street" | "aerial"
const LABEL: Record<Scene, string> = { street: "Street canyon, 1.6 m", aerial: "Aerial, 120 m" }

const path = (rows: SkyRow[]) => {
  const pts = [...rows].sort((a, b) => a.sky - b.sky)
  return pts.map((p, i) => `${i ? "L" : "M"}${px(p.sky).toFixed(1)},${py(p.ratio).toFixed(1)}`).join(" ")
}

export function SkyShift() {
  const [scene, setScene] = useState<Scene>("aerial")
  const rows = SKY[scene]
  const [idx, setIdx] = useState(4)
  const i = Math.min(idx, rows.length - 1)
  const row = rows[i]
  const voxel = VOXEL_IN_SPACINGS / row.nonsky
  const desc = `${LABEL[scene]} at pitch ${row.pitch} degrees: ${(row.sky * 100).toFixed(1)}% sky; the default normalization is off by ${row.ratio.toFixed(2)}x and the merge voxel spans ${voxel.toFixed(2)} non-sky spacings instead of ${VOXEL_IN_SPACINGS}.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>sky inside the median: --sky_seg off</span>
        <span className="text-muted-foreground/60">numpy toy · measured</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LABEL) as Scene[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScene(s)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                scene === s ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {LABEL[s]}
            </button>
          ))}
        </div>
        <label className="flex min-w-[220px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="whitespace-nowrap">pitch {row.pitch}°</span>
          <Range min={0} max={rows.length - 1} step={1} value={i} onChange={(e) => setIdx(Number(e.target.value))} className="flex-1" aria-label="camera pitch" />
        </label>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_200px] sm:p-5">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label={desc}>
            {[1, 1.5, 2, 2.5, 3, 3.5].map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={py(g)} y2={py(g)} stroke="currentColor" strokeOpacity={g === 1 ? 0.35 : 0.1} className="text-muted-foreground" />
                <text x={L - 8} y={py(g) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                  {g}x
                </text>
              </g>
            ))}
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((g) => (
              <text key={g} x={px(g)} y={H - B + 16} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
                {Math.round(g * 100)}%
              </text>
            ))}
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              share of pixels that are sky
            </text>
            {(Object.keys(SKY) as Scene[]).map((s) => (
              <path
                key={s}
                d={path(SKY[s])}
                fill="none"
                stroke="currentColor"
                strokeWidth={s === scene ? 2 : 1}
                strokeOpacity={s === scene ? 1 : 0.3}
                className={s === "aerial" ? "text-orange-500" : "text-sky-500"}
              />
            ))}
            {rows.map((p) => (
              <circle key={p.pitch} cx={px(p.sky)} cy={py(p.ratio)} r={2.5} fill="currentColor" className="text-muted-foreground" />
            ))}
            <circle cx={px(row.sky)} cy={py(row.ratio)} r={6} fill="currentColor" className={scene === "aerial" ? "text-orange-500" : "text-sky-500"} />
          </svg>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 self-center font-mono text-xs sm:grid-cols-1">
          <div>
            <dt className="text-muted-foreground">sky share</dt>
            <dd className="text-lg text-foreground">{(row.sky * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">factor off by</dt>
            <dd className={cn("text-lg", row.ratio > 1.5 ? "text-orange-500" : "text-foreground")}>{row.ratio.toFixed(2)}x</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">non-sky median spacing</dt>
            <dd className="text-lg text-foreground">{row.nonsky.toFixed(2)} × target</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">voxel, in those spacings</dt>
            <dd className="text-lg text-foreground">{voxel.toFixed(2)}</dd>
          </div>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        The vertical axis is the GSNorm factor computed with sky masked out over the factor with sky left in, which is
        what the release does unless you pass <span className="font-mono text-foreground">--sky_seg</span>. With sky
        masked, the non-sky median spacing is exactly the target and the voxel is {VOXEL_IN_SPACINGS} spacings wide.
        Past half the frame the median is itself a sky pixel and the factor is set by whatever depth the geometry model
        gives the sky, so the sweep stops before that. Synthetic scenes; not a run of the model.
      </figcaption>
    </figure>
  )
}
