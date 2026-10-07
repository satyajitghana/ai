"use client"

import { useState } from "react"

import { mexp, mlog } from "@/lib/dmath"

// The last page of "An Upper Bound of 9/4 for the Matrix Multiplication
// Exponent" (openai/math, 2 Oct 2026), made interactive.
//
// For any tensor character λ, write λ(⟨n,n,n⟩) = n^(3t). The paper builds a
// profile P(a,a) from λ's values on polynomial multiplication and squeezes it:
//   upper (interpolation, eq. 4.5):  P(a,a) ≤ (2a − 1)^(1/t)
//   lower (Lemma 5.1):               P(a,a) ≥ D_a, where H_1 = 1,
//                                    H_a ≥ (1 + 1/(3(a−1))) H_(a−1), D_a = (3a−1) H_a / 2,
//                                    and D_a ≥ a^(4/3).
// If t > 3/4 the lower bound eventually overtakes the upper one, a contradiction,
// so every character has t ≤ 3/4 and ω ≤ 3t ≤ 9/4. The chart plots the room
// ln(upper / lower) against log10 a; it is computed from the recurrence exactly
// up to a = 4096 and from its Gamma-function asymptotics beyond
// (∏(1 + 1/(3m)) = Γ(a + 1/3) / (Γ(4/3) Γ(a)) ~ a^(1/3) / Γ(4/3)).

const ACCENT = "oklch(0.55 0.15 250)"
const BAD = "oklch(0.60 0.18 25)"
const LN_GAMMA_4_3 = -0.11319832730123 // ln Γ(4/3)
const EXACT_MAX = 4096

// ln H_a for a = 1..EXACT_MAX
const LN_H: number[] = (() => {
  const out = [0, 0]
  let h = 0
  for (let a = 2; a <= EXACT_MAX; a++) {
    h += mlog(1 + 1 / (3 * (a - 1)))
    out.push(h)
  }
  return out
})()

function lnLower(lnA: number): number {
  if (lnA <= mlog(EXACT_MAX)) {
    const a = Math.max(1, Math.round(mexp(lnA)))
    return mlog((3 * a - 1) / 2) + LN_H[a]
  }
  // ln((3a−1)/2) + (1/3) ln a − ln Γ(4/3), with a large so 3a − 1 ≈ 3a
  return mlog(1.5) + lnA + lnA / 3 - LN_GAMMA_4_3
}

function lnUpper(lnA: number, t: number): number {
  // ln (2a − 1)^(1/t) at the same integer a as lnLower; 2a − 1 ≈ 2a once a is large
  const a = lnA < 30 ? Math.max(1, Math.round(mexp(lnA))) : 0
  return (lnA < 30 ? mlog(2 * a - 1) : mlog(2) + lnA) / t
}

const W = 640
const H = 230
const L = 46
const R = 14
const T = 12
const B = 30

export function NineFourthsSqueeze() {
  const [t100, setT100] = useState(80) // t in hundredths
  const t = t100 / 100
  const omega = 3 * t

  // crossing: smallest ln a with lower > upper, by scanning then bisection
  const LN_MAX = 2000
  let cross: number | null = null
  if (t > 0.75) {
    let lo = 0
    let hi = 0
    let found = false
    for (let x = 0; x <= LN_MAX; x += x < 20 ? 0.05 : 1) {
      if (lnLower(x) > lnUpper(x, t)) {
        hi = x
        found = true
        break
      }
      lo = x
    }
    if (found) {
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2
        if (lnLower(mid) > lnUpper(mid, t)) hi = mid
        else lo = mid
      }
      cross = hi
    }
  }

  const xMaxLn = cross !== null ? Math.max(8, cross * 1.6) : 60
  const xMax10 = xMaxLn / mlog(10)
  const N = 160
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const x = (i / N) * xMaxLn
    return { x10: x / mlog(10), gap: lnUpper(x, t) - lnLower(x) }
  })
  const gMin = Math.min(0, ...pts.map((p) => p.gap))
  const gMax = Math.max(1, ...pts.map((p) => p.gap))
  const sx = (x10: number) => L + (x10 / xMax10) * (W - L - R)
  const sy = (g: number) => T + ((gMax - g) / (gMax - gMin)) * (H - T - B)
  const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x10).toFixed(1)},${sy(p.gap).toFixed(1)}`).join(" ")
  const xticks: number[] = []
  const step = xMax10 > 400 ? 200 : xMax10 > 100 ? 50 : xMax10 > 40 ? 10 : xMax10 > 10 ? 5 : 1
  for (let v = 0; v <= xMax10; v += step) xticks.push(v)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm">
      <label className="flex flex-wrap items-center gap-3 text-xs">
        <span>
          suppose a character has t = <b>{t.toFixed(2)}</b>, i.e. it would allow ω = 3t = <b>{omega.toFixed(2)}</b>
        </span>
        <input type="range" min={67} max={100} value={t100} onChange={(e) => setT100(Number(e.target.value))} className="min-w-[10rem] flex-1" />
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Room between the upper and lower bounds on P(a,a) as a grows">
        <line x1={L} x2={W - R} y1={sy(0)} y2={sy(0)} stroke="currentColor" strokeOpacity={0.5} />
        <text x={W - R} y={sy(0) - 4} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.7}>
          below this line the two bounds contradict each other
        </text>
        {xticks.map((v) => (
          <text key={v} x={sx(v)} y={H - B + 16} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
            10^{v}
          </text>
        ))}
        <text x={L} y={T + 2} fontSize={10} fill="currentColor" fillOpacity={0.6}>
          ln(upper / lower) for P(a,a)
        </text>
        <path d={d} fill="none" stroke={cross !== null ? BAD : ACCENT} strokeWidth={2} />
        {cross !== null && <circle cx={sx(cross / mlog(10))} cy={sy(0)} r={4} fill={BAD} />}
      </svg>
      <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs">
        <div>
          upper bound grows like a^(1/t) = a^{(1 / t).toFixed(4)}; lower bound like a^(4/3) = a^1.3333
        </div>
        <div className="mt-1 font-medium" style={{ color: cross !== null ? BAD : ACCENT }}>
          {t <= 0.75
            ? "No contradiction at any a: a character with this t is not ruled out by the argument."
            : cross !== null
              ? `Contradiction once a ≈ 10^${(cross / mlog(10)).toFixed(1)}: no character can have this t.`
              : "The bounds cross beyond the plotted range, but they do cross: t > 3/4 is impossible."}
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        The paper’s final step. Interpolation caps P(a,a) by (2a−1)^(1/t); concavity plus the shifted-tripling inequality force it above a^(4/3). For t just above 3/4 the crossing sits at an astronomically large a, which is fine: it only has to exist. Since every known character has t = 2/3, this does not contradict anything already known.
      </figcaption>
    </figure>
  )
}
