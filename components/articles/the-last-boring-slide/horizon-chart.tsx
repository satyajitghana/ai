"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"

// The deck's "real chart", redrawn so the axis can be switched. Points and dates are the ones the
// deck plots (its Uo array), which match METR's Time Horizon 1.1 results file
// (metr.org/assets/benchmark_results_1_1.yaml) to the digit; the 95% intervals are from that file.
// GPT-6 Astra and Opus 5.5 are not TH1.1 numbers: they are the pooled TH1.1 + TH2 estimates in the
// appendix table of METR's 20 November 2026 update. The deck plots Astra and leaves Opus 5.5 out.
// The dashed segment ends at METR's naive extrapolation: 200 hours in July 2027.

type Pt = { n: string; t: number; h: number; lo?: number; hi?: number; suite: "th11" | "pooled"; deck: boolean; label?: string }

const ym = (y: number, m: number) => y + (m - 0.5) / 12

const POINTS: Pt[] = [
  { n: "GPT-2", t: ym(2019, 2), h: 0.0009, suite: "th11", deck: true },
  { n: "GPT-3", t: ym(2020, 5), h: 0.0024, suite: "th11", deck: true },
  { n: "GPT-3.5", t: ym(2022, 3), h: 0.01, suite: "th11", deck: true },
  { n: "GPT-4", t: ym(2023, 3), h: 0.0665, lo: 0.032, hi: 0.133, suite: "th11", deck: true, label: "GPT-4, 4 min" },
  { n: "GPT-4o", t: ym(2024, 5), h: 0.1165, lo: 0.067, hi: 0.215, suite: "th11", deck: true },
  { n: "Claude 3.5 Sonnet", t: ym(2024, 10), h: 0.342, lo: 0.169, hi: 0.68, suite: "th11", deck: true },
  { n: "o1", t: ym(2024, 12), h: 0.647, lo: 0.353, hi: 1.08, suite: "th11", deck: true },
  { n: "Claude 3.7 Sonnet", t: ym(2025, 2), h: 1.0, lo: 0.55, hi: 1.74, suite: "th11", deck: true },
  { n: "o3", t: ym(2025, 4), h: 2.0, lo: 1.24, hi: 3.18, suite: "th11", deck: true, label: "o3, 2 h" },
  { n: "GPT-5", t: ym(2025, 8), h: 3.38, lo: 1.88, hi: 6.76, suite: "th11", deck: true },
  { n: "Opus 4.5", t: ym(2025, 11), h: 4.88, lo: 2.7, hi: 10.4, suite: "th11", deck: true, label: "Opus 4.5, 4.9 h" },
  { n: "GPT-5.2", t: ym(2025, 12), h: 5.87, lo: 3.3, hi: 13.6, suite: "th11", deck: true },
  { n: "Opus 4.6", t: ym(2026, 2), h: 11.98, lo: 5.28, hi: 60.6, suite: "th11", deck: true, label: "Opus 4.6, 12 h" },
  { n: "Mythos Preview", t: ym(2026, 4), h: 17.4, lo: 8.48, hi: 55.1, suite: "th11", deck: true, label: "Mythos Preview, 17 h" },
  { n: "GPT-6 Astra", t: ym(2026, 9), h: 40, lo: 13, hi: 2645, suite: "pooled", deck: true, label: "GPT-6 Astra, 40 h" },
  { n: "Opus 5.5", t: ym(2026, 9) + 0.05, h: 39, lo: 12, hi: 1253, suite: "pooled", deck: false, label: "Opus 5.5, 39 h" },
]
const PROJ = { t: ym(2027, 7), h: 200 }

const W = 640, H = 340, L = 56, R = 16, T = 16, B = 34
const X0 = 2019, X1 = 2027.8
const LIN_MAX = 220
const LOG_MIN = 0.0005, LOG_MAX = 3000

export function HorizonChart() {
  const [log, setLog] = useState(false)
  const [ci, setCi] = useState(false)
  const [opus55, setOpus55] = useState(false)

  const x = (t: number) => L + ((t - X0) / (X1 - X0)) * (W - L - R)
  const y = (h: number) => {
    if (log) {
      const a = mlog10(LOG_MIN), b = mlog10(LOG_MAX)
      return T + (1 - (mlog10(Math.max(h, LOG_MIN)) - a) / (b - a)) * (H - T - B)
    }
    return T + (1 - Math.min(h, LIN_MAX * 1.2) / LIN_MAX) * (H - T - B)
  }
  const pts = POINTS.filter((p) => p.deck || opus55)
  const astra = POINTS.find((p) => p.n === "GPT-6 Astra")!
  const yTicks = log ? [0.001, 0.01, 0.1, 1, 10, 100, 1000] : [0, 50, 100, 150, 200]
  const fmt = (h: number) => (h < 1 ? `${+(h * 60).toPrecision(2)} min` : `${h} h`)
  const floorCount = pts.filter((p) => !log && y(p.h) > H - B - 6).length

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3">
        <span className="font-medium">The deck&apos;s time-horizon chart, with the axis you choose</span>
        <span className="block text-muted-foreground">
          METR&apos;s 50% time horizon: the length of task, in human working time, that a model finishes half the time. Points are the ones the deck plots. Switch to log and the &quot;wall&quot; becomes a straight line.
        </span>
      </figcaption>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <div role="tablist" aria-label="Vertical axis" className="inline-flex rounded-md border border-border p-0.5">
          {(["linear", "log"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={log === (m === "log")}
              className={cn("rounded px-2.5 py-1", log === (m === "log") ? "bg-foreground text-background" : "text-muted-foreground")}
              onClick={() => setLog(m === "log")}
            >
              {m === "linear" ? "Linear axis (the deck)" : "Log axis"}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
          <input type="checkbox" checked={ci} onChange={(e) => setCi(e.target.checked)} /> 95% intervals
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
          <input type="checkbox" checked={opus55} onChange={(e) => setOpus55(e.target.checked)} /> Add Opus 5.5 (not in the deck)
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`METR time horizons from GPT-2 to GPT-6 Astra on a ${log ? "log" : "linear"} axis`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={11}>
              {v < 1 ? `${+(v * 60).toPrecision(2)}m` : `${v}h`}
            </text>
          </g>
        ))}
        {[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map((yr) => (
          <text key={yr} x={x(yr + 0.5)} y={H - 12} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
            {yr}
          </text>
        ))}
        {/* the trend continued: Astra to METR's 200 h in July 2027 */}
        <line x1={x(astra.t)} y1={y(astra.h)} x2={x(PROJ.t)} y2={y(PROJ.h)} className="stroke-foreground/50" strokeWidth={1.5} strokeDasharray="5 4" />
        <circle cx={x(PROJ.t)} cy={y(PROJ.h)} r={3.5} className="fill-card stroke-foreground/60" strokeWidth={1.5} />
        <text x={x(PROJ.t) - 6} y={y(PROJ.h) - 8} textAnchor="end" className="fill-muted-foreground" fontSize={11}>
          200 h, July 2027 (extrapolation)
        </text>
        {pts.map((p) => (
          <g key={p.n}>
            {ci && p.lo !== undefined && p.hi !== undefined && (
              <line x1={x(p.t)} x2={x(p.t)} y1={y(p.lo)} y2={y(Math.min(p.hi, log ? LOG_MAX : LIN_MAX * 1.2))} className={p.suite === "pooled" ? "stroke-amber-500" : "stroke-foreground/40"} strokeWidth={1.5} />
            )}
            <circle cx={x(p.t)} cy={y(p.h)} r={p.label ? 4 : 3} className={p.suite === "pooled" ? "fill-amber-500" : p.deck ? "fill-foreground" : "fill-sky-500"} />
            {p.label && (log || p.h > 1) && (
              <text x={x(p.t) - 7} y={y(p.h) + (p.n === "Opus 5.5" ? 14 : -7)} textAnchor="end" className="fill-foreground" fontSize={11}>
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        {log
          ? "On a log axis the points sit near a line that steepens a little: about 8 months per doubling from GPT-2 to GPT-4, about 4.5 from GPT-4 to GPT-6 Astra. METR's current fit is 3.61 months (95% CI 2.08 to 4.94). The bend is real but gentle; the linear axis is what turns it into a wall."
          : `On a linear axis ${floorCount} of these ${pts.length} points sit on the floor, everything before 2025 included. That is the deck's point, and also all a linear axis can show.`}{" "}
        Amber: pooled TH1.1 + TH2 estimates from METR&apos;s appendix, a different task suite from the black TH1.1 points.
        {ci && " With intervals on, Astra's upper bound (2,645 h) is off the chart on the linear axis."}
        {opus55 && " Opus 5.5 (39 h, 12 to 1,253) sits on top of Astra; the deck, written by a Claude model, plots only OpenAI's point."}
      </p>
      <p className="sr-only">Point values: {pts.map((p) => `${p.n} ${fmt(p.h)}`).join("; ")}.</p>
    </figure>
  )
}
