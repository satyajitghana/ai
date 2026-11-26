"use client"

import { useMemo, useState } from "react"

import { mexp, mlog, mlog10 } from "@/lib/dmath"

// The deck's "2027" calendar. Each day is sized by "how much AI progress happens in it, next to a
// day in 2025". The deck draws this from a cubic Hermite spline in log space, knots
// (day of 2027, size, slope per day): (0, 1.7, .0265), (45, 6, .0305), (101, 40, .037),
// (181, 1000, .0415), (460, ..., .0425), lifted from its source (the Js array). This widget runs the
// same spline. The reference band is the AI Futures Project's median across model runs that match
// METR's estimates: pace climbing to "roughly 4 to 5x around mid-2027".

const KNOTS: [number, number, number][] = [
  [-40, -0.45, 0.02],
  [0, mlog(1.7), 0.0265],
  [45, mlog(6), 0.0305],
  [101, mlog(40), 0.037],
  [181, mlog(1000), 0.0415],
  [460, mlog(1000) + 279 * 0.0425, 0.0425],
]
function logSize(d: number) {
  for (let e = 0; e < KNOTS.length - 1; e++) {
    const [d0, y0, m0] = KNOTS[e], [d1, y1, m1] = KNOTS[e + 1]
    if (d <= d1) {
      const s = d1 - d0, a = (d - d0) / s, r = a * a, l = r * a
      return y0 * (2 * l - 3 * r + 1) + m0 * s * (l - 2 * r + a) + y1 * (-2 * l + 3 * r) + m1 * s * (l - r)
    }
  }
  return 0
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
const dateOf = (d: number) => {
  let m = 11
  while (MONTH_START[m] > d) m--
  return `${d - MONTH_START[m] + 1} ${MONTHS[m]}`
}

function human(days: number) {
  if (days < 365) return `${Math.round(days)} days`
  return `${Math.round(days / 365).toLocaleString("en-US")} years`
}

export function SizedDays() {
  const sizes = useMemo(() => Array.from({ length: 365 }, (_, d) => mexp(logSize(d))), [])
  const cum = useMemo(() => {
    const c: number[] = []
    sizes.reduce((s, v, i) => ((c[i] = s + v), s + v), 0)
    return c
  }, [sizes])
  const [day, setDay] = useState(101)
  const W = 640, H = 220, L = 46, R = 10, T = 10, B = 26
  const maxL = mlog10(sizes[364]), minL = 0
  const y = (v: number) => T + (1 - (mlog10(v) - minL) / (maxL - minL)) * (H - T - B)
  const bw = (W - L - R) / 365

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3">
        <span className="font-medium">The deck&apos;s 2027, one bar per day</span>
        <span className="block text-muted-foreground">
          Height is the deck&apos;s own curve for how much progress a day holds next to a day of 2025, on a log axis. The shaded band is the AI Futures Project&apos;s median run.
        </span>
      </figcaption>
      <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        Day
        <input type="range" min={0} max={364} value={day} onChange={(e) => setDay(+e.target.value)} aria-label="Day of 2027" className="flex-1" />
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${dateOf(day)} 2027 holds ${sizes[day].toFixed(1)} days of 2025 progress on the deck's curve`}>
        {[1, 10, 100, 1000, 10000, 100000, 1000000].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-border" />
            <text x={L - 5} y={y(v) + 4} textAnchor="end" fontSize={10} className="fill-muted-foreground">
              {v >= 1000 ? `${v / 1000}k` : v}×
            </text>
          </g>
        ))}
        <rect x={L + 151 * bw} width={61 * bw} y={y(5)} height={y(4) - y(5)} className="fill-sky-500/40" />
        {sizes.map((v, d) => (
          <rect key={d} x={L + d * bw} y={y(v)} width={Math.max(bw, 0.6)} height={H - B - y(v)} className={d === day ? "fill-amber-500" : d <= day ? "fill-foreground/60" : "fill-foreground/20"} />
        ))}
        {MONTHS.map((m, i) => (
          <text key={m} x={L + (MONTH_START[i] + 15) * bw} y={H - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {m}
          </text>
        ))}
      </svg>
      <p className="mt-2">
        <span className="font-mono">{dateOf(day)}</span>: <span className="font-mono">{sizes[day] < 100 ? sizes[day].toFixed(1) : Math.round(sizes[day]).toLocaleString("en-US")}×</span> a 2025 day. From 1 January to here: <span className="font-mono">{human(cum[day])}</span> of 2025-pace progress.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        The deck labels 12 April (AI that beats the best human researchers) and 1 July (superintelligence), the dates of one example run. Its curve keeps doubling about every 17 days after July, which no source gives. The AI Futures Project&apos;s median run peaks around 4 to 5× and its median for all of 2027 is 4.2 to 4.9 years of progress, depending on whose parameters.
      </p>
    </figure>
  )
}
