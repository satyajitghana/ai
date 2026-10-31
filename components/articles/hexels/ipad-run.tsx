"use client"

// The only on-device number set in the release: Hexel Edge training DTU scan24 on a 12.9-inch iPad Pro (M2) for
// 20 minutes, offline and unplugged (hexel_edge/results/dtu_scan24_ipad.json, _quality.csv, _telemetry.csv).
// The quality curve is the CSV's 34 rows. The per-window step times are OUR reconstruction from the telemetry's
// running mean: cumulative update-loop time T(n) = mean(n) * (n - 40); summed to 1164.112 s, which equals the
// JSON's update_loop_seconds, so the reconstruction is consistent with the authors' own total. Memory rows
// are arithmetic on the stated Hexel count (6,598), 20 FP32 scalars per V1 Hexel and the telemetry's gpu_bytes.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { IPAD_CURVE, IPAD_WINDOWS } from "./data"

const MIB = 1048576
const HEXELS = 6598
const MODEL_B = HEXELS * 20 * 4
const TRAIN_STATE_B = MODEL_B * 4 // parameters + gradients + two Adam moments, FP32
const GPU_B = 2555904 // telemetry gpu_bytes, constant over the run
const PEAK_FOOTPRINT_MIB = 64.8757553100586

const W = 360
const H = 190
const PAD = { l: 34, r: 10, t: 10, b: 24 }
const xOf = (t: number) => PAD.l + (t / 1200.7) * (W - PAD.l - PAD.r)
const yOf = (p: number) => PAD.t + ((26 - p) / (26 - 10)) * (H - PAD.t - PAD.b)

function psnrAt(t: number): number {
  const pts = IPAD_CURVE
  if (t <= pts[0][0]) return pts[0][2]
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, , p0] = pts[i - 1]
      const [t1, , p1] = pts[i]
      return p0 + ((p1 - p0) * (t - t0)) / (t1 - t0)
    }
  }
  return pts[pts.length - 1][2]
}

export function IPadRun() {
  const [t, setT] = useState(600)
  const path = IPAD_CURVE.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p[0]).toFixed(1)},${yOf(p[2]).toFixed(1)}`).join(" ")
  const maxMs = Math.max(...IPAD_WINDOWS.map((w) => w[2]))

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4" role="group" aria-label="Hexel Edge training DTU scan24 on an iPad Pro for twenty minutes">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium">Reserved-view PSNR against time</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="PSNR rises from about 10 dB at the first step to 25.2 dB after 1200 seconds">
            {[10, 15, 20, 25].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={W - PAD.r} y1={yOf(g)} y2={yOf(g)} stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
                <text x={PAD.l - 4} y={yOf(g) + 3} textAnchor="end" className="fill-current text-[8px]">
                  {g}
                </text>
              </g>
            ))}
            {[0, 300, 600, 900, 1200].map((g) => (
              <text key={g} x={xOf(g)} y={H - 8} textAnchor="middle" className="fill-current text-[8px]">
                {g}s
              </text>
            ))}
            <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" />
            <circle cx={xOf(t)} cy={yOf(psnrAt(t))} r="3.2" className="fill-primary" />
          </svg>
          <label className="mt-1 flex flex-col gap-1 text-sm">
            <span>
              At <span className="font-mono">{t} s</span>: <span className="font-mono">{psnrAt(t).toFixed(2)} dB</span>
            </span>
            <Range min={0} max={1200} step={10} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="Elapsed seconds" />
          </label>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Milliseconds per update, by stretch of the run</p>
          <div className="flex flex-col gap-1.5">
            {IPAD_WINDOWS.map((w) => (
              <div key={w[0]} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.2rem] items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">
                  {w[0].toLocaleString("en-US")}-{w[1].toLocaleString("en-US")}
                </span>
                <div className="h-3 rounded bg-primary/70" style={{ width: `${(w[2] / maxMs) * 100}%` }} />
                <span className="text-right font-mono">{w[2].toFixed(1)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Our reconstruction from the telemetry&apos;s running mean. The OS thermal state read &ldquo;nominal&rdquo; in all 233 samples.</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Hexel parameters</dt>
          <dd className="font-mono">{(MODEL_B / MIB).toFixed(2)} MiB</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">+ gradients + Adam (×4)</dt>
          <dd className="font-mono">{(TRAIN_STATE_B / MIB).toFixed(2)} MiB</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">GPU bytes in telemetry</dt>
          <dd className="font-mono">{(GPU_B / MIB).toFixed(2)} MiB</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peak process footprint</dt>
          <dd className="font-mono">{PEAK_FOOTPRINT_MIB.toFixed(1)} MiB</dd>
        </div>
      </dl>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Read from the release: 6,598 fixed V1 Hexels, 42 training and 6 reserved views at 640 × 480, 32,920 updates in 20 min 0.71 s, 25.21 dB. The authors note the reserved views were reused when choosing the recipe, so this is
        a development number, not a blind benchmark. The rows under the charts are arithmetic on those figures: the parameters are under 1% of the process footprint and the whole training state about a thirtieth.
      </figcaption>
    </figure>
  )
}
