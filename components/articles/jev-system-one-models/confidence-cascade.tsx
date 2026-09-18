"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"

// The confidence-gated cascade pattern from the applications section, made draggable.
// Jev scores every item; anything below the confidence threshold tau gets a second
// opinion from a bigger/cheaper-than-frontier model (Kimi K3 in the reported example).
// The ONE real, reported operating point is tau=0.95: of 100 emails, 31 fell below it,
// the blend got 96/100 right, and the bill was ~$0.07 ($0.068 Kimi + $0.003 Jev). Jev's
// own per-item confidence is modeled as drawn from a single distribution (illustrative --
// nobody publishes the histogram); its mean/spread are chosen so the escalation rate at
// tau=0.95 lands on 31%, which also pins the $/call math to the real total. The accuracy
// curve is a separate, hand-set assumption (a monotonic, diminishing-returns rise from a
// no-escalation baseline to a ceiling) calibrated so it passes through 96% at that same
// point -- the shape AWAY from tau=0.95 is illustrative, not measured. Only the anchor
// point, and the two per-call dollar figures it's built from, are real.

const BLUE = "oklch(0.60 0.15 255)" // Jev / auto-resolved
const AMBER = "oklch(0.68 0.13 85)" // escalated

// Real: $0.003 / 100 emails (Jev) and $0.068 / 31 escalated emails (Kimi K3).
const JEV_PER_CALL = 0.003 / 100
const KIMI_PER_CALL = 0.068 / 31
const N_EMAILS = 100

// Illustrative: Jev's own confidence score across the 100 emails, modeled as one
// distribution. mu/sigma are chosen so escalateFrac(0.95) lands on 0.31 (31 of 100).
const MU = 0.97
const SIGMA = 0.04

// Illustrative accuracy model: rises from BASE (no escalation -- Jev decides everything)
// toward CEIL (heavy escalation) with diminishing returns, calibrated so accuracy(0.95)
// lands on the reported 96/100.
const BASE_ACCURACY = 0.9
const CEIL_ACCURACY = 0.97
// K solved once from accuracy(escalateFrac(0.95)) = 0.96, escalateFrac(0.95) = 0.30854.
const K = 6.307

function erf(x: number): number {
  const s = x < 0 ? -1 : 1
  const z = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * z)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return s * (1 - poly * mexp(-z * z))
}

function normalCdf(x: number, mu: number, sigma: number): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)))
}

function pdf(x: number, mu: number, sigma: number): number {
  return mexp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
}

function escalateFrac(tau: number): number {
  return normalCdf(tau, MU, SIGMA)
}

function accuracyAt(tau: number): number {
  const e = escalateFrac(tau)
  return CEIL_ACCURACY - (CEIL_ACCURACY - BASE_ACCURACY) * mexp(-K * e)
}

function costAt(tau: number): number {
  const e = escalateFrac(tau)
  return N_EMAILS * JEV_PER_CALL + e * N_EMAILS * KIMI_PER_CALL
}

const fmtPct = (p: number) => `${(p * 100).toFixed(p < 0.02 ? 2 : 1)}%`
const fmtUsd = (v: number) => (v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`)

const DOMAIN_LO = 0.8
const DOMAIN_HI = 1.0
const N_PTS = 121

const W = 680
const H = 210
const PL = 10
const PR = 10
const PT = 26
const PB = 10

const PEAK = Math.max(
  ...Array.from({ length: N_PTS }, (_, i) => pdf(DOMAIN_LO + ((DOMAIN_HI - DOMAIN_LO) * i) / (N_PTS - 1), MU, SIGMA))
)

const sx = (conf: number) => PL + ((conf - DOMAIN_LO) / (DOMAIN_HI - DOMAIN_LO)) * (W - PL - PR)
const sy = (density: number) => PT + (1 - Math.min(1, density / PEAK)) * (H - PT - PB)

function curvePath(from: number, to: number) {
  const pts: string[] = []
  for (let i = 0; i < N_PTS; i++) {
    const x = DOMAIN_LO + ((DOMAIN_HI - DOMAIN_LO) * i) / (N_PTS - 1)
    if (x < from - 1e-9 || x > to + 1e-9) continue
    pts.push(`${pts.length === 0 ? "M" : "L"} ${sx(x).toFixed(1)} ${sy(pdf(x, MU, SIGMA)).toFixed(1)}`)
  }
  return pts.join(" ")
}

function fillPath(from: number, to: number) {
  const top = curvePath(from, to)
  if (!top) return ""
  return `${top} L ${sx(to).toFixed(1)} ${sy(0).toFixed(1)} L ${sx(from).toFixed(1)} ${sy(0).toFixed(1)} Z`
}

export function ConfidenceCascade() {
  const [tau, setTau] = useState(0.95)

  const e = escalateFrac(tau)
  const escalatedCount = e * N_EMAILS
  const acc = accuracyAt(tau)
  const cost = costAt(tau)
  const kimiOnlyCost = N_EMAILS * KIMI_PER_CALL
  const jevOnlyCost = N_EMAILS * JEV_PER_CALL

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>confidence threshold → escalation → blended cost &amp; accuracy</span>
        <span className="text-muted-foreground/50">anchored on one reported run of 100 emails</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At confidence threshold ${tau.toFixed(2)}, ${fmtPct(e)} of emails escalate to Kimi K3, blended accuracy is ${fmtPct(acc)}, and cost for 100 emails is ${fmtUsd(cost)}`}
        >
          <defs>
            <filter id="cc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.12" />
            </filter>
          </defs>

          <line x1={PL} x2={W - PR} y1={sy(0)} y2={sy(0)} stroke="var(--border)" strokeWidth={1} />

          <path d={curvePath(DOMAIN_LO, DOMAIN_HI)} fill="none" stroke={BLUE} strokeWidth={1.5} opacity={0.55} />
          <path d={fillPath(DOMAIN_LO, tau)} fill={AMBER} opacity={0.32} />
          <path d={fillPath(tau, DOMAIN_HI)} fill={BLUE} opacity={0.18} />

          <line x1={sx(tau)} x2={sx(tau)} y1={PT - 2} y2={sy(0)} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="4 3" filter="url(#cc-soft)" />
          <text x={sx(tau)} y={PT - 8} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            {"τ"} = {tau.toFixed(2)}
          </text>

          <text x={sx(DOMAIN_LO) + 6} y={sy(0) - 6} className="font-mono" fontSize={9} fill={AMBER}>
            {"←"} escalate to Kimi K3
          </text>
          <text x={W - PR - 6} y={sy(0) - 6} textAnchor="end" className="font-mono" fontSize={9} fill={BLUE}>
            Jev decides alone {"→"}
          </text>
          <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            Jev&apos;s own confidence on each email {"→"}
          </text>
        </svg>

        <label className="mt-1 block">
          <span className="sr-only">confidence threshold</span>
          <Range min={0.85} max={0.99} step={0.005} value={tau} onChange={(e) => setTau(Number(e.target.value))} className="w-full cursor-pointer" accent={BLUE} />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">escalated to Kimi K3</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: AMBER }}>
              {escalatedCount.toFixed(0)}<span className="text-xs text-muted-foreground"> / 100</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">blended accuracy</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{fmtPct(acc)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">cost / 100 emails</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: BLUE }}>{fmtUsd(cost)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">vs. Kimi on everything</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {(kimiOnlyCost / cost).toFixed(1)}{"×"} <span className="text-xs text-muted-foreground">cheaper</span>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          at {"τ"}=0.95 (the reported run): <span className="text-foreground">31/100</span> escalated,{" "}
          <span className="text-foreground">96%</span> blended accuracy, <span className="text-foreground">{fmtUsd(costAt(0.95))}</span>{" "}
          total — versus <span className="text-foreground">{fmtUsd(jevOnlyCost)}</span> for Jev alone (no safety net) or{" "}
          <span className="text-foreground">{fmtUsd(kimiOnlyCost)}</span> for sending every email to Kimi K3.
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Only {"τ"}=0.95 is a reported number; drag it and the curve shows the mechanism, not a second
          measurement. Raise the bar and more emails get a second opinion — cost climbs fast, because it&apos;s
          paying full price for Kimi on every escalated item, while accuracy gains taper off quickly once the
          genuinely ambiguous cases are already covered. That flattening is the same lesson a fully-documented,
          independent cascade (Jev {"→"} DeepSeek V4-Pro on Banking77) reaches with real swept thresholds: the
          optimal cutoff is task-specific, and past it you are paying more for a second opinion the first model
          didn&apos;t need.
        </p>
      </div>
    </figure>
  )
}
