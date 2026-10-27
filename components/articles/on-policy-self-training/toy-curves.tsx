"use client"

import { useState } from "react"

import { BASE, SERIES } from "./data"

// Round-by-round accuracy of the toy loop, mean of 30 seeds (measured). Each
// series is one configuration; round 0 is the pretrained model, which has seen
// 20 labelled points. "In-domain" is the half-plane the topic seeds; "out" is
// the other half, which no generated question ever touches.

const COLORS = ["oklch(0.62 0.16 35)", "oklch(0.60 0.15 255)", "oklch(0.55 0.14 150)", "oklch(0.55 0.16 320)", "oklch(0.50 0.05 250)"]
const W = 640
const H = 250
const PX = 46
const PY = 14
const PW = W - PX - 16
const PH = H - PY - 34
const YMIN = 0.66
const YMAX = 0.88
const mono = { fontFamily: "ui-monospace, monospace" } as const

const NAMES = Object.keys(SERIES)
const sx = (r: number) => PX + (r / 7) * PW
const sy = (v: number) => PY + PH - ((v - YMIN) / (YMAX - YMIN)) * PH

export function ToyCurves() {
  const [metric, setMetric] = useState<0 | 1>(0)
  const [on, setOn] = useState<boolean[]>(NAMES.map((_, i) => i === 0 || i === 3 || i === 4))
  const base = metric === 0 ? BASE.in : BASE.out

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">toy loop · accuracy by round · 30 seeds · measured</span>
        <div role="tablist" className="flex gap-1 font-mono text-xs">
          {(["in-domain (seeded half)", "out-of-domain (unseen half)"] as const).map((label, k) => (
            <button
              key={label}
              role="tab"
              aria-selected={metric === k}
              onClick={() => setMetric(k as 0 | 1)}
              className={`rounded-md border px-2.5 py-1 ${metric === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Accuracy of the toy model by self-training round for the selected configurations. Training on the
            model&apos;s own labels leaves in-domain accuracy at about 80 percent and lowers out-of-domain accuracy
            from 78.8 to 74.2 percent for OPST and 68.2 percent for SFT. With 90 percent correct labels SFT climbs
            faster in-domain, to 85.2 percent against 82.7 for OPST.
          </title>
          {[0.7, 0.75, 0.8, 0.85].map((t) => (
            <g key={t}>
              <line x1={PX} x2={PX + PW} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PX - 6} y={sy(t) + 3} textAnchor="end" fontSize={9} style={mono} fill="currentColor" fillOpacity={0.55}>{(t * 100).toFixed(0)}%</text>
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
            <text key={r} x={sx(r)} y={H - 18} textAnchor="middle" fontSize={9} style={mono} fill="currentColor" fillOpacity={0.55}>{r}</text>
          ))}
          <text x={PX + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} style={mono} fill="currentColor" fillOpacity={0.55}>self-training round (0 = base)</text>
          <line x1={PX} x2={PX + PW} y1={sy(base)} y2={sy(base)} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="4 3" />
          {NAMES.map((n, i) =>
            on[i] ? (
              <g key={n}>
                <path
                  d={SERIES[n].map((p, r) => `${r ? "L" : "M"}${sx(r).toFixed(1)} ${sy(p[metric]).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={COLORS[i]}
                  strokeWidth={2}
                />
                <circle cx={sx(7)} cy={sy(SERIES[n][7][metric])} r={3.5} fill={COLORS[i]} />
              </g>
            ) : null,
          )}
        </svg>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {NAMES.map((n, i) => (
            <li key={n}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[11px]">
                <input
                  type="checkbox"
                  checked={on[i]}
                  onChange={() => setOn(on.map((v, k) => (k === i ? !v : v)))}
                />
                <span style={{ color: COLORS[i] }}>&#9632;</span>
                <span className="flex-1">{n}</span>
                <span className="text-muted-foreground">{(SERIES[n][7][metric] * 100).toFixed(1)}%</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Dashed line: the pretrained model ({(base * 100).toFixed(1)}%). Series end at round 7, the paper&apos;s best
          round count, chosen before I ran anything.
        </p>
      </div>
    </figure>
  )
}
