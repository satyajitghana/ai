"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// Natura-1's eight scaling checkpoints, read from the data attributes of the
// blog's own chart (scaling-embed.html, the iframe "Natura-1 Scaling
// Validation" on naturewill.com/blog/natura-1, fetched 2026-10-13). Each
// point carries data-hours and data-value; those are copied verbatim below.
// They are reported numbers, not re-run. Teacher-forced action error; lower is
// better. The robot set was never trained on.
//
// The reductions (first checkpoint to the one selected) and the "x first"
// multiple are my arithmetic on those values.

const HOURS = [
  43660.349701601925, 87320.699403203849, 130981.049104805788, 174641.398806407698,
  314679.091194639332, 578264.056119778077, 736415.035074861255, 1000000,
]

const SERIES = [
  {
    key: "rMSE",
    label: "robot MSE",
    color: "oklch(0.62 0.18 30)",
    v: [0.027169, 0.022843, 0.018693, 0.013287, 0.010955, 0.009592, 0.009183, 0.008764],
  },
  {
    key: "rMAE",
    label: "robot MAE",
    color: "oklch(0.72 0.13 60)",
    v: [0.103448, 0.092113, 0.081973, 0.069124, 0.060576, 0.055201, 0.053789, 0.05247],
  },
  {
    key: "hMSE",
    label: "human MSE",
    color: "oklch(0.55 0.16 255)",
    v: [0.032041, 0.029948, 0.025283, 0.024039, 0.020089, 0.018114, 0.017469, 0.016766],
  },
  {
    key: "hMAE",
    label: "human MAE",
    color: "oklch(0.68 0.1 220)",
    v: [0.091569, 0.087385, 0.078233, 0.07436, 0.065466, 0.060749, 0.059107, 0.057439],
  },
] as const

const kh = (h: number) => (h >= 999999 ? "1,000K" : `${Math.round(h / 1000)}K`)

export function ScalingCheckpoints() {
  const [i, setI] = useState(7)

  const W = 620
  const H = 220
  const L = 46
  const R = 12
  const T = 12
  const B = 30
  const x0 = mlog10(40000)
  const x1 = mlog10(1100000)
  const px = (h: number) => L + ((mlog10(h) - x0) / (x1 - x0)) * (W - L - R)
  // y: error relative to the first checkpoint, linear 0.3 .. 1.0
  const y0 = 0.3
  const y1 = 1.02
  const py = (r: number) => T + ((y1 - r) / (y1 - y0)) * (H - T - B)

  const mult = HOURS[i] / HOURS[0]

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Natura-1's eight scaling checkpoints: action error relative to the first checkpoint on human and robot validation data, against hours of training data"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        eight checkpoints from Nature Will&rsquo;s chart · values reported, ratios mine
      </div>

      <div className="border-b px-4 py-3 font-mono text-xs">
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">checkpoint</span>
          <Range
            min={0}
            max={7}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="scaling checkpoint"
          />
          <span className="w-44 shrink-0 text-right tabular-nums">
            {i + 1} of 8 · ≈ {kh(HOURS[i])} h · {mult.toFixed(2)}× first
          </span>
        </label>
      </div>

      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="min-w-[440px]"
          role="img"
          aria-label={`Relative action error against training hours on a log axis. At checkpoint ${i + 1}, about ${kh(HOURS[i])} hours, robot MSE is ${((SERIES[0].v[i] / SERIES[0].v[0]) * 100).toFixed(1)} percent of its first value and human MSE ${((SERIES[2].v[i] / SERIES[2].v[0]) * 100).toFixed(1)} percent.`}
        >
          {[0.4, 0.6, 0.8, 1.0].map((r) => (
            <g key={r}>
              <line x1={L} x2={W - R} y1={py(r)} y2={py(r)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={L - 6} y={py(r) + 3} textAnchor="end" className="fill-current font-mono text-[9px] opacity-60">
                {(r * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          {[50000, 100000, 200000, 500000, 1000000].map((h) => (
            <text key={h} x={px(h)} y={H - 12} textAnchor="middle" className="fill-current font-mono text-[9px] opacity-60">
              {h >= 1000000 ? "1M" : `${h / 1000}k`}
            </text>
          ))}
          <text x={W - R} y={H - 1} textAnchor="end" className="fill-current font-mono text-[9px] opacity-50">
            training data, hours (log)
          </text>
          <line x1={px(HOURS[i])} x2={px(HOURS[i])} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
          {SERIES.map((s) => (
            <g key={s.key}>
              <polyline
                points={s.v.map((v, j) => `${px(HOURS[j]).toFixed(2)},${py(v / s.v[0]).toFixed(2)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={1.8}
              />
              {s.v.map((v, j) => (
                <circle
                  key={j}
                  cx={px(HOURS[j])}
                  cy={py(v / s.v[0])}
                  r={j === i ? 4 : 2.2}
                  fill={s.color}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <div className="grid min-w-[24rem] grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1.5 font-mono text-xs tabular-nums">
          <span className="text-muted-foreground">teacher-forced error</span>
          <span className="text-right text-muted-foreground">first</span>
          <span className="text-right text-muted-foreground">this one</span>
          <span className="text-right text-muted-foreground">change</span>
          {SERIES.map((s) => (
            <div key={s.key} className="contents">
              <span>
                <span aria-hidden className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="text-right text-muted-foreground">{s.v[0].toFixed(4)}</span>
              <span className="text-right">{s.v[i].toFixed(4)}</span>
              <span className="text-right text-foreground">
                {i === 0 ? "·" : `−${((1 - s.v[i] / s.v[0]) * 100).toFixed(1)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        At checkpoint 8 the changes are the blog&rsquo;s headline figures (−67.7% robot MSE). The
        first four checkpoints sit at exactly 1×, 2×, 3× and 4× of 43,660 hours, which fits
        the blog&rsquo;s own wording (&ldquo;as training advances&rdquo;): points along one run,
        most likely, not separate models trained on separate datasets. None of this is a task
        success rate.
      </figcaption>
    </figure>
  )
}
