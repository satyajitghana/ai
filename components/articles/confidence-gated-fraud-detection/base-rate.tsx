"use client"

import { useState } from "react"

import { mlog10, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The demo run's operating point, read off the app's own tiles at t = 11.0s:
// 45 of 49 fraud caught (TPR), 0 false alarms out of 50 legitimate emails.
//
// TPR is measured. FPR is not: 0 out of 50 is not a measurement of a small
// rate, it is the absence of one. The exact one-sided 95% Clopper-Pearson
// upper bound for 0 successes in 50 trials is 1 - 0.05^(1/50) = 5.815%, so
// everything from 0% to 5.8% is consistent with what the run observed. That
// interval is the whole point of this widget: at a 50/50 base rate the width
// of it barely matters, and at any prevalence an inbox actually has, it is
// the only thing that matters.
//
// Precision here is Bayes, nothing more:
//   PPV = pi*TPR / (pi*TPR + (1-pi)*FPR)

const TPR = 45 / 49 // 0.918367..., measured
const FPR_MAX = 0.05815 // exact one-sided 95% upper bound from 0/50

const LO = mlog10(0.0005) // 0.05% prevalence
const HI = mlog10(0.5) // 50% — the demo's own balanced sample

const piAt = (t: number) => mpow(10, LO + (HI - LO) * t)

function ppv(pi: number, fpr: number): number {
  const tp = pi * TPR
  const fp = (1 - pi) * fpr
  return tp + fp === 0 ? 1 : tp / (tp + fp)
}

const W = 620
const H = 276
const PL = 46
const PR = 16
const PT = 16
const PB = 36

const sx = (t: number) => PL + t * (W - PL - PR)
const sy = (v: number) => H - PB - v * (H - PT - PB)

const TICKS: { t: number; label: string }[] = [
  { t: 0, label: "0.05%" },
  { t: 1 / 3, label: "0.5%" },
  { t: 2 / 3, label: "5%" },
  { t: 1, label: "50%" },
]

const N = 90
const CURVE_T = Array.from({ length: N + 1 }, (_, i) => i / N)

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`

export function BaseRateDial() {
  // Default: the demo's own prevalence, with the false-positive rate at the top
  // of the interval its 50 negatives leave open. Slide it to 0 for the reading
  // the run literally observed; slide prevalence left for any real inbox.
  const [tIdx, setTIdx] = useState(100)
  const [fprIdx, setFprIdx] = useState(100)

  const t = tIdx / 100
  const pi = piAt(t)
  const fpr = (fprIdx / 100) * FPR_MAX
  const p = ppv(pi, fpr)

  // Per 10,000 inbound emails at this prevalence.
  const frauds = 10000 * pi
  const tp = frauds * TPR
  const fp = (10000 - frauds) * fpr
  const alerts = tp + fp

  const d = CURVE_T.map(
    (tt, i) => `${i === 0 ? "M" : "L"}${sx(tt).toFixed(2)},${sy(ppv(piAt(tt), fpr)).toFixed(2)}`
  ).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>precision at the run&rsquo;s operating point, moved off 50/50</span>
        <span className="tabular-nums">TPR 91.8% (45/49), fixed</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[1fr_15rem]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Precision against fraud prevalence. At ${pct1(pi)} prevalence and a ${pct1(fpr)} false-positive rate, precision is ${pct1(p)}.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1={PL}
                y1={sy(v)}
                x2={W - PR}
                y2={sy(v)}
                stroke="var(--border)"
                strokeWidth={v === 0 ? 1.2 : 0.7}
              />
              <text
                x={PL - 6}
                y={sy(v) + 3}
                textAnchor="end"
                fontSize={9}
                className="fill-muted-foreground font-mono"
              >
                {v * 100}
              </text>
            </g>
          ))}

          {TICKS.map((tk) => (
            <text
              key={tk.label}
              x={sx(tk.t)}
              y={H - PB + 14}
              textAnchor={tk.t === 0 ? "start" : tk.t === 1 ? "end" : "middle"}
              fontSize={9}
              className="fill-muted-foreground font-mono"
            >
              {tk.label}
            </text>
          ))}

          <text
            x={(PL + W - PR) / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            className="fill-muted-foreground font-mono"
          >
            fraud prevalence, log scale {"→"}
          </text>
          <text
            x={12}
            y={(PT + sy(0)) / 2}
            textAnchor="middle"
            fontSize={9}
            className="fill-muted-foreground font-mono"
            transform={`rotate(-90 12 ${(PT + sy(0)) / 2})`}
          >
            precision %
          </text>

          <path d={d} fill="none" stroke="oklch(0.72 0.15 195)" strokeWidth={2} />

          {/* where the demo ran */}
          <line
            x1={sx(1)}
            y1={PT}
            x2={sx(1)}
            y2={sy(0)}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <text
            x={sx(1) - 5}
            y={PT + 10}
            textAnchor="end"
            fontSize={9}
            className="fill-muted-foreground font-mono"
          >
            the demo
          </text>

          <circle cx={sx(t)} cy={sy(p)} r={4.5} fill="oklch(0.68 0.16 40)" />
        </svg>

        <div className="space-y-3">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>prevalence</span>
              <span className="text-foreground tabular-nums">{pct1(pi)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={tIdx}
              onChange={(e) => setTIdx(Number(e.target.value))}
              className="mt-1 w-full accent-foreground"
              aria-label="fraud prevalence"
            />
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>false-positive rate</span>
              <span className="text-foreground tabular-nums">{pct1(fpr)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={fprIdx}
              onChange={(e) => setFprIdx(Number(e.target.value))}
              className="mt-1 w-full accent-foreground"
              aria-label="false-positive rate, within the 95% bound from 0 of 50"
            />
            <span className="mt-1 block font-mono text-[10px] leading-4 text-muted-foreground">
              0 of 50 observed. Anything up to 5.8% is consistent with that.
            </span>
          </label>

          <div className="rounded-md border bg-background/60 p-3">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              precision
            </div>
            <div
              className={cn(
                "font-heading text-3xl font-semibold tabular-nums",
                p < 0.5 && "text-destructive"
              )}
            >
              {pct1(p)}
            </div>
            <dl className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>alerts / 10k</dt>
                <dd className="tabular-nums text-foreground">{Math.round(alerts)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>real fraud</dt>
                <dd className="tabular-nums text-foreground">{Math.round(tp)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>false alarms</dt>
                <dd className="tabular-nums text-foreground">{Math.round(fp)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        TPR is the run&rsquo;s measured 45/49. Everything else is Bayes. The curve is
        not a criticism of the model — it is what any classifier&rsquo;s precision does
        when you take it off a balanced sample, and it is why 96/100 on a 50/50 set
        does not tell you what the thing would do in an inbox.
      </figcaption>
    </figure>
  )
}
