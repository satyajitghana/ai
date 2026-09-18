"use client"

import { useMemo, useState } from "react"

import { mlog } from "@/lib/dmath"

// Why a calibrated model has to be trained on a PROPER scoring rule, in one
// picture: fix what you actually believe, then read off what each rule pays you
// for reporting something else.
//
//   log loss   L(q) = -(p ln q + (1-p) ln(1-q))     proper — argmin at q = p
//   Brier      L(q) =  p(1-q)^2 + (1-p)q^2          proper — argmin at q = p
//   linear     L(q) =  p(1-q)   + (1-p)q            IMPROPER — argmin at 0 or 1
//
// The linear rule is the one people reach for by accident, because "average
// distance from the truth" sounds fair. It is the rule under which a forecaster
// who believes 0.55 is paid strictly more for saying 1.00, which is exactly the
// overconfidence every uncalibrated classifier already has.
//
// Nothing here is measured — it is arithmetic, drawn. The three curves are the
// closed forms above evaluated on a fixed grid, not fitted to anything.

const ACCENT = "oklch(0.72 0.15 195)"
const WARN = "oklch(0.68 0.16 40)"
const ALT = "oklch(0.64 0.13 280)"
const MUTED = "oklch(0.62 0.02 260)"

const W = 620
const H = 300
const PL = 46
const PR = 130
const PT = 16
const PB = 40

const QLO = 0.02
const QHI = 0.98
const STEPS = 96
const LOG_MAX = mlog(1 / QLO) // the worst log loss inside the drawn range

const sx = (q: number) => PL + ((q - QLO) / (QHI - QLO)) * (W - PL - PR)
const sy = (v: number) => H - PB - v * (H - PT - PB)

type RuleId = "log" | "brier" | "linear"

const RULES: { id: RuleId; name: string; color: string; proper: boolean; form: string }[] = [
  { id: "log", name: "log loss", color: ACCENT, proper: true, form: "−[p ln q + (1−p) ln(1−q)]" },
  { id: "brier", name: "Brier", color: ALT, proper: true, form: "p(1−q)² + (1−p)q²" },
  { id: "linear", name: "linear", color: WARN, proper: false, form: "p(1−q) + (1−p)q" },
]

function loss(id: RuleId, p: number, q: number): number {
  if (id === "log") return -(p * mlog(q) + (1 - p) * mlog(1 - q))
  if (id === "brier") return p * (1 - q) * (1 - q) + (1 - p) * q * q
  return p * (1 - q) + (1 - p) * q
}

// One shared 0..1 axis. Dividing a loss by a positive constant cannot move its
// argmin, so this is a scale change and nothing else.
const scale = (id: RuleId, v: number) => (id === "log" ? v / LOG_MAX : v)

const GRID = Array.from({ length: STEPS + 1 }, (_, i) => QLO + ((QHI - QLO) * i) / STEPS)

export function ScoringRules() {
  const [p, setP] = useState(0.7)

  const curves = useMemo(
    () =>
      RULES.map((r) => {
        const pts = GRID.map((q) => [sx(q), sy(scale(r.id, loss(r.id, p, q)))] as const)
        const d = pts
          .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
          .join(" ")
        // the reported value this rule actually pays best for
        let best = GRID[0]
        let bv = Infinity
        for (const q of GRID) {
          const v = loss(r.id, p, q)
          if (v < bv) {
            bv = v
            best = q
          }
        }
        return { ...r, d, best, atTruth: loss(r.id, p, p), atBest: bv }
      }),
    [p]
  )

  const lin = curves[2]
  const gain = lin.atTruth - lin.atBest

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        you privately believe p — what does each rule pay you for reporting q?
      </div>

      <div className="overflow-x-auto px-3 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={`Three expected-penalty curves as a function of the reported probability q, for a forecaster whose true belief is ${p.toFixed(2)}. Log loss and Brier both bottom out exactly at q equals p, so the cheapest report is the honest one. The linear rule slopes monotonically, so its cheapest report is ${lin.best.toFixed(2)} — certainty — no matter what the forecaster actually believes.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line
              key={g}
              x1={PL}
              y1={sy(g)}
              x2={W - PR}
              y2={sy(g)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeOpacity={0.55}
            />
          ))}
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((g) => (
            <text
              key={g}
              x={sx(g)}
              y={H - PB + 14}
              textAnchor="middle"
              className="font-mono"
              fill={MUTED}
              fontSize={9}
            >
              {g.toFixed(1)}
            </text>
          ))}
          <text
            x={sx((QLO + QHI) / 2)}
            y={H - 5}
            textAnchor="middle"
            className="font-mono"
            fill={MUTED}
            fontSize={9}
          >
            q — the probability you report
          </text>
          <text
            x={PL - 32}
            y={sy(0.5)}
            transform={`rotate(-90 ${PL - 32} ${sy(0.5)})`}
            textAnchor="middle"
            className="font-mono"
            fill={MUTED}
            fontSize={9}
          >
            expected penalty
          </text>

          {/* the honest report */}
          <line
            x1={sx(p)}
            y1={sy(0)}
            x2={sx(p)}
            y2={sy(1)}
            stroke={MUTED}
            strokeWidth={1.3}
            strokeDasharray="4 4"
          />
          <text
            x={sx(p)}
            y={PT + 9}
            textAnchor="middle"
            className="font-mono"
            fill={MUTED}
            fontSize={9}
          >
            q = p
          </text>

          {curves.map((c) => (
            <g key={c.id}>
              <path d={c.d} fill="none" stroke={c.color} strokeWidth={2} />
              <circle
                cx={sx(c.best)}
                cy={sy(scale(c.id, c.atBest))}
                r={4}
                fill="var(--background)"
                stroke={c.color}
                strokeWidth={2}
              />
            </g>
          ))}

          {/* legend */}
          <g transform={`translate(${W - PR + 8} ${PT + 4})`}>
            {curves.map((c, i) => (
              <g key={c.id} transform={`translate(0 ${i * 56})`}>
                <line x1={0} y1={0} x2={16} y2={0} stroke={c.color} strokeWidth={2.4} />
                <text
                  x={22}
                  y={3.5}
                  className="font-mono"
                  fill="var(--foreground)"
                  fontSize={10}
                  fontWeight={600}
                >
                  {c.name}
                </text>
                <text x={0} y={17} className="font-mono" fill={MUTED} fontSize={8}>
                  {c.proper ? "proper" : "IMPROPER"}
                </text>
                <text x={0} y={30} className="font-mono" fill={c.color} fontSize={9}>
                  best q = {c.best.toFixed(2)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="whitespace-nowrap">your true belief p</span>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={p}
            onChange={(e) => setP(Number(e.target.value))}
            className="h-1 min-w-[180px] flex-1 accent-foreground"
            aria-label="true belief"
          />
          <span className="w-12 text-right text-foreground">{p.toFixed(2)}</span>
        </label>
        <p className="mt-2.5 text-xs leading-5 text-muted-foreground">
          Drag it anywhere. The two proper rules put their minimum on the dashed
          line every single time — the cheapest thing you can say is the thing you
          believe. The linear rule never does: at p = {p.toFixed(2)} it pays you{" "}
          {gain.toFixed(3)} to report {lin.best.toFixed(2)} instead of the truth,
          and the further you are from 0.5 the more it pays.
        </p>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Log loss is divided by ln 50 so that all three fit one axis; multiplying a
        loss by a positive constant cannot move its argmin, so the crossing points
        are unaffected. This is arithmetic, not a measurement — but it is the
        reason every open reproduction in this article that reports a calibration
        number trained on cross-entropy, Brier, or both, and none of them trained
        on accuracy.
      </figcaption>
    </figure>
  )
}
