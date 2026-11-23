"use client"

// Accuracy against time per scan, both on log axes, one point per system on the chosen sequence.
// Diverged and failed rows have no honest ATE, so they sit in a strip under the plot by name.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { ROWS, SEQS } from "./data"
import { label } from "./labels"

const W = 640
const H = 380
const L = 56
const R = 16
const T = 14
const B = 40

export function SpeedAccuracy() {
  const [si, setSi] = useState(0)
  const seq = SEQS[si]
  const rows = ROWS.filter((r) => r.seq === seq.key && r.primary && r.sys !== "gtreplay")
  const pts = rows.filter((r) => r.status === "ok" && r.ate !== null && r.ms !== null && r.ate > 0 && r.ms > 0)
  const out = rows.filter((r) => !pts.includes(r))
  const lx = pts.map((r) => mlog10(r.ms as number))
  const ly = pts.map((r) => mlog10(r.ate as number))
  const xa = Math.floor(Math.min(0, ...lx)), xb = Math.ceil(Math.max(1, ...lx))
  const ya = Math.floor(Math.min(-2, ...ly)), yb = Math.ceil(Math.max(0, ...ly))
  const X = (v: number) => L + ((v - xa) / (xb - xa)) * (W - L - R)
  const Y = (v: number) => T + (1 - (v - ya) / (yb - ya)) * (H - T - B)
  const xt: number[] = []
  for (let e = xa; e <= xb; e++) xt.push(e)
  const yt: number[] = []
  for (let e = ya; e <= yb; e++) yt.push(e)
  const tick = (e: number) => (e >= 0 ? String(10 ** e) : (10 ** e).toFixed(-e))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap gap-1 border-b px-3 py-2 font-mono text-xs">
        {SEQS.map((s, i) => (
          <button key={s.key} type="button" onClick={() => setSi(i)} aria-pressed={si === i}
            className={cn("cursor-pointer rounded px-2 py-1 transition-colors", si === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {s.label}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
        aria-label={`ATE against milliseconds per scan on ${seq.label}, log scales; lower left is better.`}>
        <g stroke="currentColor" strokeOpacity="0.12">
          {xt.map((e) => <line key={`x${e}`} x1={X(e)} x2={X(e)} y1={T} y2={H - B} />)}
          {yt.map((e) => <line key={`y${e}`} x1={L} x2={W - R} y1={Y(e)} y2={Y(e)} />)}
        </g>
        <g fontFamily="ui-monospace, monospace" fontSize="11" fill="currentColor" fillOpacity="0.65">
          {xt.map((e) => <text key={`tx${e}`} x={X(e)} y={H - B + 16} textAnchor="middle">{tick(e)}</text>)}
          {yt.map((e) => <text key={`ty${e}`} x={L - 6} y={Y(e) + 4} textAnchor="end">{tick(e)}</text>)}
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">ms per scan (log)</text>
          <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>ATE m (log)</text>
        </g>
        {pts.map((r, i) => (
          <g key={r.key}>
            <circle cx={X(lx[i])} cy={Y(ly[i])} r="4.5" className="fill-blue-600 dark:fill-blue-400" fillOpacity="0.85" />
            <text x={X(lx[i]) + 7} y={Y(ly[i]) + 4} fontFamily="ui-monospace, monospace" fontSize="10.5" fill="currentColor">
              {label(r.key)}
            </text>
          </g>
        ))}
      </svg>
      {out.length > 0 && (
        <div className="border-t px-4 py-2 font-mono text-xs text-muted-foreground">
          not plotted: {out.map((r) => `${label(r.key)} (${r.status})`).join(", ")}
        </div>
      )}
      <figcaption className="px-4 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
        One point per system on {seq.label}. ATE after SE(3) alignment without scale; time is the mean per scan from the
        serial pass on 4 pinned threads where it ran, the parallel pass otherwise (see the table).
      </figcaption>
    </figure>
  )
}
