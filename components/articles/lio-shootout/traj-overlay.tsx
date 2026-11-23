"use client"

// Aligned trajectories over the reference, top-down, one sequence at a time. Each estimate is drawn
// in the reference frame after the eval's own SE(3) alignment (traj_aligned.csv, decimated to about
// 400 points); toggling a system shows where it leaves the reference, not just how far on average.

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ROWS, SEQS, TRAJ } from "./data"
import { label } from "./labels"

const PALETTE = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c", "#4f46e5"]
const W = 640
const H = 440
const PAD = 16

export function TrajOverlay() {
  const seqs = SEQS.filter((s) => TRAJ[s.key])
  const [si, setSi] = useState(0)
  const seq = seqs[si]
  const T = TRAJ[seq.key]
  const keys = Object.keys(T.runs).filter((k) => !k.startsWith("gtreplay"))
  const okFirst = keys.sort((a, b) => {
    const ra = ROWS.find((r) => r.key === a && r.seq === seq.key)
    const rb = ROWS.find((r) => r.key === b && r.seq === seq.key)
    return (ra?.ate ?? 1e9) - (rb?.ate ?? 1e9)
  })
  const [on, setOn] = useState<Record<string, boolean>>({})
  const shown = okFirst.filter((k, i) => on[`${seq.key}/${k}`] ?? i < 3)

  // frame on the reference (a diverged run may leave the plot; it is clipped, and the table says so)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of T.ref) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  const span = Math.max(x1 - x0, y1 - y0, 1) * 1.1
  const s = Math.min((W - 2 * PAD) / span, (H - 2 * PAD) / span)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const px = (x: number) => (W / 2 + (x - cx) * s).toFixed(1)
  const py = (y: number) => (H / 2 - (y - cy) * s).toFixed(1)
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${px(p[0])} ${py(p[1])}`).join("")
  const bar = [1, 2, 5, 10, 20, 50, 100, 200].find((m) => m * s > 60) ?? 500

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap gap-1 border-b px-3 py-2 font-mono text-xs">
        {seqs.map((q, i) => (
          <button key={q.key} type="button" onClick={() => setSi(i)} aria-pressed={si === i}
            className={cn("cursor-pointer rounded px-2 py-1 transition-colors", si === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {q.label}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full bg-muted/20" role="img"
        aria-label={`Top-down trajectories on ${seq.label}: the reference in grey and the selected systems in colour, aligned to it.`}>
        <defs>
          <clipPath id="traj-clip"><rect x="0" y="0" width={W} height={H} /></clipPath>
        </defs>
        <g clipPath="url(#traj-clip)" fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path d={path(T.ref)} stroke="currentColor" strokeOpacity="0.35" strokeWidth="5" />
          {shown.map((k) => (
            <path key={k} d={path(T.runs[k])} stroke={PALETTE[okFirst.indexOf(k) % PALETTE.length]} strokeWidth="1.6" />
          ))}
        </g>
        <g fontFamily="ui-monospace, monospace" fontSize="11" fill="currentColor" fillOpacity="0.7">
          <line x1={PAD} x2={PAD + bar * s} y1={H - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.7" />
          <text x={PAD} y={H - PAD - 5}>{bar} m</text>
        </g>
      </svg>
      <div className="flex flex-wrap gap-1.5 border-t px-3 py-2 font-mono text-xs">
        {okFirst.map((k, i) => {
          const id = `${seq.key}/${k}`
          const active = on[id] ?? i < 3
          const row = ROWS.find((r) => r.key === k && r.seq === seq.key)
          return (
            <button key={k} type="button" onClick={() => setOn((o) => ({ ...o, [id]: !active }))} aria-pressed={active}
              className={cn("flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1", active ? "text-foreground" : "text-muted-foreground opacity-60")}>
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              {label(k)}
              {row?.ate != null ? <span className="text-muted-foreground"> {row.ate.toFixed(2)} m</span> : null}
            </button>
          )
        })}
      </div>
      <figcaption className="px-4 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
        Grey: the reference trajectory. Colour: each system after the evaluation&apos;s own alignment, decimated. Tap a
        system to show or hide it; the number is its ATE on this sequence.
      </figcaption>
    </figure>
  )
}
