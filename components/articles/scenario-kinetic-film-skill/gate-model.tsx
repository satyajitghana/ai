"use client"

import { useState } from "react"
import { mlog } from "@/lib/dmath"

// The "never park" gate, modelled. finish.py/holds.py decode the film at
// 320x180, call a frame "still" when under 1.5 % of its pixels changed by more
// than 24 grey levels, and fail a film whose still share passes 40 % or that
// holds still for over 0.6 s. For a solid box moving sideways at v px per frame
// (1920 x 1080 units) the changed area is the leading and trailing edge,
// 2 * min(v, boxWidth) * boxHeight. The dots are my synthetic test: a box one
// third of the frame in each direction, encoded with x264 CRF 18, measured with
// my own numpy re-implementation of the gate (not the skill's scripts).

const FW = 1920
const FH = 1080
const THRESH = 0.015
const MEASURED: { v: number; still: boolean }[] = [
  { v: 6, still: true },
  { v: 12, still: true },
  { v: 24, still: true },
  { v: 48, still: false },
  { v: 96, still: false },
  { v: 192, still: false },
]
const W = 720
const H = 230
const PAD = 44
const VMIN = 2
const VMAX = 400

const sx = (v: number) => PAD + ((mlog(v) - mlog(VMIN)) / (mlog(VMAX) - mlog(VMIN))) * (W - PAD - 16)
const sy = (share: number) => H - 30 - Math.min(share, 0.12) / 0.12 * (H - 60)

export function GateModel() {
  const [hPct, setHPct] = useState(33)
  const [wPct, setWPct] = useState(33)
  const [v, setV] = useState(24)

  const bh = (hPct / 100) * FH
  const bw = (wPct / 100) * FW
  const share = (vv: number) => (2 * Math.min(vv, bw) * bh) / (FW * FH)
  const vStar = (THRESH * FW * FH) / (2 * bh)
  const s = share(v)
  const moving = s >= THRESH

  const pts: string[] = []
  for (let i = 0; i <= 80; i++) {
    const vv = VMIN * (VMAX / VMIN) ** (i / 80)
    pts.push(`${sx(vv).toFixed(1)},${sy(share(vv)).toFixed(1)}`)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what counts as moving · the still-frame gate</span>
        <span className="text-muted-foreground/50">model + 6 measured clips</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          <Slider label="box height" unit="% of frame" min={5} max={100} value={hPct} set={setHPct} />
          <Slider label="box width" unit="% of frame" min={5} max={100} value={wPct} set={setWPct} />
          <Slider label="speed" unit="px/frame @1080p" min={2} max={400} value={v} set={setV} />
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Changed share of the frame against box speed on a log axis. The curve rises with speed; a dashed line marks the 1.5 percent threshold below which a frame counts as still. Measured clips from the synthetic test are drawn as dots.">
          <line x1={PAD} x2={W - 16} y1={sy(THRESH)} y2={sy(THRESH)} stroke="oklch(0.62 0.2 25)" strokeDasharray="4 3" />
          <text x={W - 18} y={sy(THRESH) - 4} textAnchor="end" fontSize={10} className="font-mono" fill="oklch(0.62 0.2 25)">
            1.5 % changed = still below
          </text>
          <line x1={PAD} x2={W - 16} y1={H - 30} y2={H - 30} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          <line x1={PAD} x2={PAD} y1={30} y2={H - 30} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          {[2, 5, 10, 20, 50, 100, 200, 400].map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={H - 30} y2={H - 26} stroke="var(--muted-foreground)" />
              <text x={sx(t)} y={H - 14} textAnchor="middle" fontSize={10} className="font-mono" fill="var(--muted-foreground)">
                {t}
              </text>
            </g>
          ))}
          {[0, 0.03, 0.06, 0.09, 0.12].map((t) => (
            <text key={t} x={PAD - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} className="font-mono" fill="var(--muted-foreground)">
              {(t * 100).toFixed(0)}%
            </text>
          ))}
          <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} />
          <circle cx={sx(v)} cy={sy(s)} r={5} fill={moving ? "oklch(0.65 0.15 150)" : "oklch(0.62 0.2 25)"} />
          {wPct === 33 && hPct === 33
            ? MEASURED.map((m) => (
                <circle key={m.v} cx={sx(m.v)} cy={H - 30} r={4} fill={m.still ? "oklch(0.62 0.2 25)" : "oklch(0.65 0.15 150)"} opacity={0.7} />
              ))
            : null}
          <text x={PAD} y={16} fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            changed share of frame (y) vs speed, px per frame (x, log)
          </text>
        </svg>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <Cell k="changed share" v={`${(Math.min(s, 1) * 100).toFixed(2)} %`} />
          <Cell k="frame counts as" v={moving ? "moving" : "still"} />
          <Cell k="speed needed to count" v={`${vStar.toFixed(0)} px/frame`} />
          <Cell k="that is" v={`${((vStar * 60) / FW).toFixed(2)} frame-widths/s`} />
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          Dots on the axis are the six clips I encoded and measured with a box one third of the frame each way (set both sliders to 33): at 6, 12 and 24 px/frame the clip was still 94-95 % of the time, at 48, 96 and 192 it was never still. The model puts the cliff at 43 px/frame. A thin line of type, which has little height, needs to move far faster than a big box to count.
        </p>
      </div>
    </figure>
  )
}

function Slider({ label, unit, min, max, value, set }: { label: string; unit: string; min: number; max: number; value: number; set: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1 rounded-md border px-3 py-2">
      <span className="text-muted-foreground">
        {label}: <span className="text-foreground">{value}</span> {unit}
      </span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
    </label>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-base">{v}</div>
    </div>
  )
}
