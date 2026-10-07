"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mhypot, mlog2 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A drawn cursor's move from A to a target, sampled once per video frame (30
// fps, the demos' rate). The spacing between dots is the speed the viewer sees.
//
//   linear:    Playwright's page.mouse.move(x, y, { steps }) interpolates
//              (x - fromX) * (i / steps), evenly spaced
//              (playwright-core/src/server/input.ts:227-230, v1.63.0)
//   min-jerk:  s(u) = 10u^3 - 15u^4 + 6u^5, the standard model of a human
//              reach: zero speed and acceleration at both ends
//   arc:       the same ease along a quadratic curve bowed off the straight line
//
// Duration for the eased moves follows Fitts' law as cua-driver uses it:
// 150 + 120 * log2(D / W + 1) ms, clamped to 300-1000 ms (see /articles/arc-cua).
// The linear move gets the same duration so only the shape of the motion differs.

const FPS = 30
const ACCENT = "oklch(0.62 0.15 150)"
const MUTED = "oklch(0.62 0.02 260)"

type Mode = "linear" | "minjerk" | "arc"
const MODES: [Mode, string][] = [
  ["linear", "linear steps"],
  ["minjerk", "min-jerk"],
  ["arc", "min-jerk on an arc"],
]

const A = { x: 70, y: 220 }
const TARGETS = [
  { x: 210, y: 170, w: 70, label: "near" },
  { x: 560, y: 70, w: 90, label: "far" },
  { x: 590, y: 220, w: 28, label: "far, small" },
]

const minJerk = (u: number) => u * u * u * (10 - 15 * u + 6 * u * u)

export function CursorEasing() {
  const [mode, setMode] = useState<Mode>("arc")
  const [ti, setTi] = useState(1)
  const [k, setK] = useState(1)

  const T = TARGETS[ti]
  const D = mhypot(T.x - A.x, T.y - A.y)
  const ms = Math.min(1000, Math.max(300, 150 + 120 * mlog2(D / T.w + 1)))
  const n = Math.round((ms / 1000) * FPS)

  const at = (u: number) => {
    const s = mode === "linear" ? u : minJerk(u)
    if (mode !== "arc") return { x: A.x + (T.x - A.x) * s, y: A.y + (T.y - A.y) * s }
    // control point off the midpoint, perpendicular, 18% of the distance
    const mx = (A.x + T.x) / 2
    const my = (A.y + T.y) / 2
    const cx = mx + (-(T.y - A.y) / D) * 0.18 * D
    const cy = my + ((T.x - A.x) / D) * 0.18 * D
    const p = 1 - s
    return { x: p * p * A.x + 2 * p * s * cx + s * s * T.x, y: p * p * A.y + 2 * p * s * cy + s * s * T.y }
  }

  const dots = Array.from({ length: n + 1 }, (_, i) => at(i / n))
  const shown = Math.round(k * n)
  const c = dots[shown]
  const gaps = dots.slice(1).map((d, i) => mhypot(d.x - dots[i].x, d.y - dots[i].y))
  const peak = Math.max(...gaps)
  const first = gaps[0]

  const btn = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">A drawn cursor, one dot per 30 fps frame</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {Math.round(D)} px to a {T.w} px target: {Math.round(ms)} ms, {n} frames
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODES.map(([m, label]) => (
            <button key={m} type="button" className={btn(m === mode)} aria-pressed={m === mode} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-border sm:block" />
          {TARGETS.map((t, i) => (
            <button key={t.label} type="button" className={btn(i === ti)} aria-pressed={i === ti} onClick={() => setTi(i)}>
              {t.label}
            </button>
          ))}
        </div>
        <svg viewBox="0 0 680 280" className="mt-3 w-full" role="img">
          <title>{`${mode} move of ${Math.round(D)} pixels in ${n} frames; the first frame moves ${first.toFixed(1)} pixels and the fastest ${peak.toFixed(1)}.`}</title>
          <rect x={T.x - T.w / 2} y={T.y - 14} width={T.w} height={28} rx={7} fill={ACCENT} fillOpacity={0.2} stroke={ACCENT} />
          <circle cx={A.x} cy={A.y} r={4} fill={MUTED} />
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={i <= shown ? 3 : 2} fill={i <= shown ? ACCENT : MUTED} fillOpacity={i <= shown ? 0.9 : 0.35} />
          ))}
          <path
            d={`M${c.x} ${c.y} l0 18 l5 -5 l4 9 l3 -1.5 l-4 -9 l7 0 Z`}
            fill="white"
            stroke="black"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </svg>
        <Range min={0} max={1} step={1 / n} value={k} accent={ACCENT} onChange={(e) => setK(Number(e.target.value))} aria-label="Progress of the move" className="w-full" />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {mode === "linear"
            ? `Every frame moves the same ${first.toFixed(1)} px: the cursor starts and stops at full speed, which reads as a machine.`
            : `The first frame moves ${first.toFixed(1)} px and the fastest ${peak.toFixed(1)} px: it leaves slowly, rushes the middle and settles on the target.`}
        </p>
      </div>
    </figure>
  )
}
