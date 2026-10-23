"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { LEVELS, SERIES } from "./data"

// One real Timestral-209M forecast per series: 21 quantiles per step, the held-out
// actuals, and a seasonal-naive point forecast. Everything shown is computed here from
// those arrays with + - * / and comparisons only, so server and client agree.

const BAND = "oklch(0.58 0.13 250)"
const MED = "oklch(0.36 0.12 255)"
const NAIVE = "oklch(0.62 0 0)"

const PAIRS: [number, number][] = [
  [0.01, 0.99],
  [0.05, 0.95],
  [0.1, 0.9],
  [0.25, 0.75],
]

const idx = (q: number) => LEVELS.indexOf(q)

function pinball(tau: number, y: number, f: number) {
  const e = y - f
  return e >= 0 ? tau * e : (tau - 1) * e
}

function fmt(v: number) {
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)
}

export function QuantileFan() {
  const [sid, setSid] = useState(0)
  const [on, setOn] = useState<boolean[]>([true, false, true, true])
  const [hRaw, setH] = useState(96)
  const [tauI, setTauI] = useState(idx(0.9))

  const s = SERIES[sid]
  const H = s.actual.length
  const h = Math.min(hRaw, H)
  const tau = LEVELS[tauI]

  const W = 640
  const HH = 240
  const nh = s.history.length
  const vals = [...s.history, ...s.actual, ...s.snaive, ...s.quantiles.map((r) => r[0]), ...s.quantiles.map((r) => r[20])]
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const x = (i: number) => 12 + (i / (nh + H - 1)) * (W - 24)
  const y = (v: number) => 10 + ((hi - v) / (hi - lo || 1)) * (HH - 20)
  const line = (a: number[], off: number) => a.map((v, i) => `${i ? "L" : "M"}${x(i + off).toFixed(1)},${y(v).toFixed(1)}`).join("")
  const band = (a: number, b: number) => {
    const up = s.quantiles.map((r, i) => `${i ? "L" : "M"}${x(nh + i).toFixed(1)},${y(r[idx(b)]).toFixed(1)}`).join("")
    const dn = s.quantiles
      .map((r, i) => ({ r, i }))
      .reverse()
      .map(({ r, i }) => `L${x(nh + i).toFixed(1)},${y(r[idx(a)]).toFixed(1)}`)
      .join("")
    return up + dn + "Z"
  }

  // pinball loss at tau over steps 1..h, model quantile vs the naive point forecast
  let pbM = 0
  let pbN = 0
  for (let i = 0; i < h; i++) {
    pbM += pinball(tau, s.actual[i], s.quantiles[i][tauI])
    pbN += pinball(tau, s.actual[i], s.snaive[i])
  }
  pbM /= h
  pbN /= h
  const below = s.actual.slice(0, h).filter((v, i) => v <= s.quantiles[i][tauI]).length

  const cover = PAIRS.map(([a, b]) => {
    let n = 0
    for (let i = 0; i < h; i++) if (s.actual[i] >= s.quantiles[i][idx(a)] && s.actual[i] <= s.quantiles[i][idx(b)]) n++
    return n
  })

  const row = s.quantiles[h - 1]
  const cx = x(nh + h - 1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">quantile fan · one real Timestral-209M run per series</span>
        <div className="flex gap-1 font-mono text-[11px]">
          {SERIES.map((ser, i) => (
            <button
              key={ser.id}
              type="button"
              aria-pressed={sid === i}
              onClick={() => {
                setSid(i)
                setH(ser.actual.length)
              }}
              className={`rounded border px-2 py-0.5 ${sid === i ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {ser.id === "ett" ? "ETTh1 OT" : "air passengers"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2 font-mono text-[11px]">
          <span className="text-muted-foreground">bands:</span>
          {PAIRS.map(([a, b], i) => (
            <button
              key={a}
              type="button"
              aria-pressed={on[i]}
              onClick={() => setOn(on.map((v, j) => (j === i ? !v : v)))}
              className={`rounded border px-2 py-0.5 ${on[i] ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {Math.round(a * 100)}-{Math.round(b * 100)}%
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${HH}`}
          className="w-full rounded border bg-background"
          role="img"
          aria-label={`${s.label}: history, the held-out actuals, the seasonal-naive forecast, the median and the selected quantile bands over ${H} steps`}
        >
          {PAIRS.map(([a, b], i) =>
            on[i] ? <path key={a} d={band(a, b)} fill={BAND} opacity={0.14 + 0.08 * i} /> : null,
          )}
          <line x1={x(nh - 0.5)} x2={x(nh - 0.5)} y1={6} y2={HH - 6} stroke="currentColor" opacity={0.2} />
          <path d={line(s.history, 0)} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.75} />
          <path d={line(s.snaive, nh)} fill="none" stroke={NAIVE} strokeWidth={1.4} strokeDasharray="5 3" />
          <path d={line(s.quantiles.map((r) => r[idx(0.5)]), nh)} fill="none" stroke={MED} strokeWidth={2} />
          <path d={line(s.actual, nh)} fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="1.5 2.5" />
          <line x1={cx} x2={cx} y1={6} y2={HH - 6} stroke={MED} strokeWidth={1} opacity={0.6} />
          <circle cx={cx} cy={y(row[tauI])} r={4} fill={MED} />
          <circle cx={cx} cy={y(s.actual[h - 1])} r={3.5} fill="none" stroke="currentColor" strokeWidth={1.5} />
        </svg>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>solid: history and median</span>
          <span>dotted: what happened (held out)</span>
          <span>grey dashed: seasonal naive (repeat the last period)</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>horizon step h</span>
              <span className="text-base font-semibold" style={{ color: MED }}>
                {h} / {H}
              </span>
            </span>
            <Range min={1} max={H} step={1} value={h} accent={MED} onChange={(e) => setH(Number(e.target.value))}
              aria-label="Horizon step" className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>quantile level τ</span>
              <span className="text-base font-semibold" style={{ color: MED }}>
                {tau}
              </span>
            </span>
            <Range min={0} max={LEVELS.length - 1} step={1} value={tauI} accent={MED} onChange={(e) => setTauI(Number(e.target.value))}
              aria-label="Quantile level" className="mt-1 w-full" />
          </label>
        </div>

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          <div className="rounded border px-3 py-2">
            <div className="text-muted-foreground">at step {h}</div>
            <div>
              actual {fmt(s.actual[h - 1])} · q{tau} {fmt(row[tauI])}
            </div>
            <div className="text-muted-foreground">
              median {fmt(row[idx(0.5)])} · 10-90% {fmt(row[idx(0.1)])} to {fmt(row[idx(0.9)])}
            </div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-muted-foreground">mean pinball loss at τ = {tau}, steps 1-{h}</div>
            <div>
              model {fmt(pbM)} · naive {fmt(pbN)} {s.unit}
            </div>
            <div className="text-muted-foreground">
              actual at or below q{tau}: {below} of {h} (target about {Math.round(tau * h)})
            </div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-muted-foreground">coverage, steps 1-{h}</div>
            {PAIRS.map(([a, b], i) => (
              <div key={a}>
                {Math.round((b - a) * 100)}% band: {cover[i]} of {h}
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[11px] text-muted-foreground">
          {s.label}, {s.context.toLocaleString("en-US")} steps of context, {H} steps held out. One forecast window per series: an
          illustration of what the outputs are, not an evaluation.
        </p>
      </div>
    </figure>
  )
}
