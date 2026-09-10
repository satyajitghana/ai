"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"

// The operating-point widget. A probe outputs one score per request; you pick a single
// threshold τ that decides which requests get escalated to the expensive judge. Move τ
// and two things move together: recall (how much of the bad traffic you still catch) and
// the escalation rate (how much of ALL traffic — overwhelmingly benign — gets sent to the
// judge). The benign/malicious score distributions are illustrative Gaussians, calibrated
// so τ=0.50 reproduces Goodfire's own reported operating point (97% recall @ 1% FPR on
// their GLM-4.5-Air example). Moving τ left trades a small recall gain for a large jump in
// judge traffic, because false positives scale with the (huge) benign population, not the
// (rare) malicious one. That's the mechanism the post skips.

const GREEN = "oklch(0.55 0.16 155)" // benign
const RED = "oklch(0.58 0.19 25)" // malicious
const AMBER = "oklch(0.68 0.13 85)" // escalation zone
const BLUE = "oklch(0.60 0.15 255)" // probe / neutral accent

// Calibrated so tailProb(0.50, MU_B, SIG_B) ≈ 1% and tailProb(0.50, MU_M, SIG_M) ≈ 97%.
const MU_B = 0.2
const SIG_B = 0.129
const MU_M = 0.8
const SIG_M = 0.16

// Base rate of genuinely malicious/prohibited requests in the traffic mix. No paper
// publishes this for the worked example — it's a modeling assumption, held fixed so the
// only thing you're moving is the threshold. 1-in-1000 is a deliberately unremarkable guess.
const RHO = 0.001

// Relative cost of one judge call vs. one probe call. Kramár et al. 2601.11516 report
// their selected probe running at "over 10,000× lower cost" than an LLM classifier on the
// same model — used here as the illustrative multiplier, cited, not re-measured.
const JUDGE_MULTIPLE = 10_000
const WINDOW = 1_000_000 // requests, for readable absolute counts

// erf via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7) — deterministic, uses mexp so
// server and client render the same bytes.
function erf(x: number): number {
  const s = x < 0 ? -1 : 1
  const z = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * z)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return s * (1 - poly * mexp(-z * z))
}

function tailProb(x: number, mu: number, sigma: number): number {
  return 0.5 * (1 - erf((x - mu) / (sigma * Math.SQRT2)))
}

function pdf(x: number, mu: number, sigma: number): number {
  return mexp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
}

const fmtPct = (p: number) => (p < 0.001 ? "<0.1%" : `${(p * 100).toFixed(p < 0.1 ? 2 : 1)}%`)
const fmtCount = (n: number) => Math.round(n).toLocaleString("en-US")
const fmtUnits = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return fmtCount(n)
}

const W = 680
const H = 220
const PL = 8
const PR = 8
const PT = 28 // headroom above the tallest curve for its label
const PB = 6
const N_PTS = 121

const PEAK = Math.max(...Array.from({ length: N_PTS }, (_, i) => pdf(i / (N_PTS - 1), MU_B, SIG_B)))

const sx = (score: number) => PL + score * (W - PL - PR)
const sy = (density: number) => PT + (1 - Math.min(1, density / PEAK)) * (H - PT - PB)

function curvePath(mu: number, sigma: number, from = 0, to = 1) {
  const pts: string[] = []
  for (let i = 0; i < N_PTS; i++) {
    const x = i / (N_PTS - 1)
    if (x < from - 1e-9 || x > to + 1e-9) continue
    pts.push(`${pts.length === 0 ? "M" : "L"} ${sx(x).toFixed(1)} ${sy(pdf(x, mu, sigma)).toFixed(1)}`)
  }
  return pts.join(" ")
}

function fillPath(mu: number, sigma: number, from: number, to: number) {
  const top = curvePath(mu, sigma, from, to)
  if (!top) return ""
  return `${top} L ${sx(to).toFixed(1)} ${sy(0).toFixed(1)} L ${sx(from).toFixed(1)} ${sy(0).toFixed(1)} Z`
}

export function ThresholdCascade() {
  const [tau, setTau] = useState(0.5)

  const fpr = tailProb(tau, MU_B, SIG_B)
  const recall = tailProb(tau, MU_M, SIG_M)
  const escalateRate = fpr * (1 - RHO) + recall * RHO

  const escalated = escalateRate * WINDOW
  const trueCatches = recall * RHO * WINDOW
  const missedAttacks = (1 - recall) * RHO * WINDOW

  const cascadeCost = WINDOW * 1 + escalated * JUDGE_MULTIPLE
  const judgeEverythingCost = WINDOW * JUDGE_MULTIPLE
  const savings = judgeEverythingCost / cascadeCost

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>probe threshold → escalation volume → cascade cost</span>
        <span className="text-muted-foreground/50">illustrative distributions, real cost ratio</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At threshold ${tau.toFixed(2)}, false positive rate ${fmtPct(fpr)}, recall ${fmtPct(recall)}, escalating ${fmtPct(escalateRate)} of all traffic to the judge`}
        >
          <defs>
            <filter id="apm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* baseline */}
          <line x1={PL} x2={W - PR} y1={sy(0)} y2={sy(0)} stroke="var(--border)" strokeWidth={1} />

          {/* full curves, faint */}
          <path d={curvePath(MU_B, SIG_B)} fill="none" stroke={GREEN} strokeWidth={1.5} opacity={0.5} />
          <path d={curvePath(MU_M, SIG_M)} fill="none" stroke={RED} strokeWidth={1.5} opacity={0.5} />

          {/* escalated tail of the benign curve = false positives, shaded amber */}
          <path d={fillPath(MU_B, SIG_B, tau, 1)} fill={AMBER} opacity={0.35} />
          {/* escalated tail of the malicious curve = true positives (caught) */}
          <path d={fillPath(MU_M, SIG_M, tau, 1)} fill={RED} opacity={0.28} />
          {/* missed malicious mass, left of τ */}
          <path d={fillPath(MU_M, SIG_M, 0, tau)} fill={RED} opacity={0.08} />

          {/* threshold line */}
          <line x1={sx(tau)} x2={sx(tau)} y1={PT - 2} y2={sy(0)} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="4 3" filter="url(#apm-soft)" />
          <text x={sx(tau)} y={PT - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            τ = {tau.toFixed(2)}
          </text>

          {/* legend labels on the curves */}
          <text x={sx(MU_B)} y={sy(pdf(MU_B, MU_B, SIG_B)) - 8} textAnchor="middle" fill={GREEN} className="font-mono" fontSize={10}>
            benign traffic
          </text>
          <text x={sx(MU_M)} y={sy(pdf(MU_M, MU_M, SIG_M)) - 8} textAnchor="middle" fill={RED} className="font-mono" fontSize={10}>
            malicious / prohibited
          </text>
          <text x={(sx(tau) + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            escalate to judge →
          </text>

          <text x={PL} y={H - 2} className="fill-muted-foreground font-mono" fontSize={9}>
            probe score →
          </text>
        </svg>

        <label className="mt-1 block">
          <span className="sr-only">threshold τ</span>
          <Range min={0.15} max={0.85} step={0.01} value={tau} onChange={(e) => setTau(Number(e.target.value))} className="w-full cursor-pointer" accent={BLUE} />
        </label>

        {/* readouts */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">recall (catch rate)</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: RED }}>{fmtPct(recall)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">false positive rate</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: AMBER }}>{fmtPct(fpr)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">sent to judge</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{fmtPct(escalateRate)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">cascade vs. judge-everything</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: BLUE }}>{savings.toFixed(0)}×{" "}<span className="text-xs text-muted-foreground">cheaper</span></div>
          </div>
        </div>

        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          per {fmtUnits(WINDOW)} requests ({fmtPct(RHO)} actually malicious): <span className="text-foreground">{fmtCount(escalated)}</span>{" "}
          escalated to the judge · <span style={{ color: RED }}>{fmtCount(trueCatches)}</span> true catches ·{" "}
          <span style={{ color: RED }}>{fmtCount(missedAttacks)}</span> missed · cascade cost ≈{" "}
          <span className="text-foreground">{fmtUnits(cascadeCost)}</span> units vs.{" "}
          <span className="text-foreground">{fmtUnits(judgeEverythingCost)}</span> for judging everything
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag τ down and recall climbs toward 100% — but false positives come from the{" "}
          <span className="text-foreground">benign</span>{" "}population, which outnumbers malicious traffic roughly{" "}
          {Math.round(1 / RHO)}:1 here. A few points of extra recall costs an order of magnitude more judge calls,
          because the escalation rate is dominated by <code>FPR × (1 − ρ)</code>, not by recall. The first stage's
          threshold is the cascade's real cost knob.
        </p>
      </div>
    </figure>
  )
}
