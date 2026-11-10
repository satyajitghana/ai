"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { LAMARIA_CATS, LAMARIA_MONO_IMU, type LamariaCat, type LamariaRow } from "./data"

// LaMAria's mono + IMU board, re-sortable by category. Scores are the public
// leaderboard's (0-100, control-point accuracy after one Sim(3) alignment).
// The "mean" view is the plain average of the five categories, which is how
// FPV Labs' "4.5x ORB-SLAM3" is computed.

type View = LamariaCat | "mean"

const meanOf = (r: LamariaRow) => (r.short + r.medium + r.long + r.lowLight + r.moving) / 5
const valueOf = (r: LamariaRow, v: View) => (v === "mean" ? meanOf(r) : r[v])

const W = 640
const ROW = 22
const NAME_W = 150
const BAR_X = NAME_W + 8
const BAR_W = W - BAR_X - 48

export function LamariaBoard() {
  const [view, setView] = useState<View>("long")
  const rows = useMemo(
    () => [...LAMARIA_MONO_IMU].sort((a, b) => valueOf(b, view) - valueOf(a, view)),
    [view],
  )
  const top = rows[0]
  const second = rows[1]
  const lead = valueOf(top, view) - valueOf(second, view)
  const label = view === "mean" ? "Mean of five" : (LAMARIA_CATS.find((c) => c.id === view)?.label ?? view)
  const H = rows.length * ROW + 12
  const desc = `LaMAria mono plus IMU, ${label}: ${top.name} leads with ${valueOf(top, view).toFixed(1)}, ${
    second.name
  } is next with ${valueOf(second, view).toFixed(1)}, a lead of ${lead.toFixed(1)} points.`

  const views: { id: View; label: string }[] = [...LAMARIA_CATS, { id: "mean", label: "Mean of five" }]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>lamaria, monocular + imu</span>
        <span className="text-muted-foreground/60">public leaderboard, read 2026-11-10</span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              view === v.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
          {rows.map((r, i) => {
            const v = valueOf(r, view)
            const y = 6 + i * ROW
            const w = Math.max(1, (v / 70) * BAR_W)
            const fpv = r.name === "FPV-SLAM"
            return (
              <g key={r.name}>
                <text
                  x={NAME_W}
                  y={y + 13}
                  textAnchor="end"
                  className={cn("font-mono", fpv ? "fill-foreground font-semibold" : "fill-muted-foreground")}
                  fontSize={11}
                >
                  {r.name}
                  {r.reproduced ? " (r)" : ""}
                </text>
                <rect
                  x={BAR_X}
                  y={y + 3}
                  width={w}
                  height={13}
                  rx={2}
                  fill={fpv ? "oklch(0.58 0.15 255)" : r.reproduced ? "oklch(0.72 0.02 250)" : "oklch(0.7 0.08 200)"}
                />
                <text x={BAR_X + w + 4} y={y + 13} className="fill-muted-foreground font-mono" fontSize={10}>
                  {v.toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="px-4 pb-1 font-mono text-[11px] text-muted-foreground">
        {label}: {top.name} leads {second.name} by {lead.toFixed(1)} points. (r) = baseline reproduced by the LaMAria team.
      </div>
      <figcaption className="px-4 pb-4 pt-2 text-sm text-muted-foreground">
        Every submission with a score in all five categories. The scores are the benchmark&apos;s, not ours; the mean is
        our arithmetic on them. FPV-SLAM&apos;s code, binaries and paper are not public, so none of this can be rerun.
      </figcaption>
    </figure>
  )
}
