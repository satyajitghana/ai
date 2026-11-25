"use client"

import { useState } from "react"

// Both sides of the matrix multiplication exponent ω, 1969 to 25 Nov 2026.
//
// Upper bounds: the values each paper states, as in this site's openai-math
// OmegaTimeline (Strassen 1969 log2 7 ... Dupont et al. 2026, arXiv:2608.16884).
// The 9/4 upper bound: openai/math, 2 Oct 2026 (over C), then the human papers
// that reproved or extended it, dated by their arXiv submission:
//   Uznański 2610.10494 (7 Oct, rectangular), Lü 2610.18914 (12 Oct, every
//   characteristic), Pass 2610.28627 (20 Oct, constructive), Amanov–van den
//   Berg–Zuiddam 2610.30054 (21 Oct, every field), Li 2611.04175 (3 Nov),
//   Doğan–Lysikov–Sakabe–Walter 2611.09716 (6 Nov).
// Lower bound: ω ≥ 2 (the output has n² entries) until the openai/math
// preprint of 24 Nov 2026 claims ω ≥ 9/4. No independent proof of that exists.

type Pt = { y: number; w: number; who: string; note: string; claim?: boolean }

const UPPER: Pt[] = [
  { y: 1969, w: 2.807355, who: "Strassen", note: "7 products for a 2×2 block product: log₂ 7" },
  { y: 1978, w: 2.795, who: "Pan", note: "trilinear aggregation" },
  { y: 1979, w: 2.7799, who: "Bini, Capovani, Lotti, Romani", note: "approximate (border rank) algorithms" },
  { y: 1981, w: 2.522, who: "Schönhage", note: "asymptotic sum inequality" },
  { y: 1982, w: 2.517, who: "Romani", note: "" },
  { y: 1982.5, w: 2.496, who: "Coppersmith, Winograd", note: "" },
  { y: 1986, w: 2.479, who: "Strassen", note: "the laser method" },
  { y: 1990, w: 2.375477, who: "Coppersmith, Winograd", note: "the CW tensor" },
  { y: 2010, w: 2.3737, who: "Stothers", note: "4th power of CW" },
  { y: 2012, w: 2.3729, who: "Vassilevska Williams", note: "8th power" },
  { y: 2014, w: 2.3728639, who: "Le Gall", note: "32nd power" },
  { y: 2020.8, w: 2.3728596, who: "Alman, Vassilevska Williams", note: "refined laser method" },
  { y: 2022.8, w: 2.371866, who: "Duan, Wu, Zhou", note: "asymmetric hashing" },
  { y: 2023.5, w: 2.371552, who: "Vassilevska Williams, Xu, Xu, Zhou", note: "" },
  { y: 2024.3, w: 2.371339, who: "Alman, Duan, Vassilevska Williams, Xu, Xu, Zhou", note: "" },
  { y: 2026.6, w: 2.371177, who: "Dupont et al.", note: "laser method, AlphaEvolve-tuned parameters" },
  { y: 2026.75, w: 2.25, who: "openai/math, 2 Oct", note: "ω ≤ 9/4 over ℂ, via tensor characters", claim: true },
]

const REPROOFS = [
  { d: "7 Oct", who: "Uznański", what: "rectangular version; α ≥ 1/2" },
  { d: "12 Oct", who: "Lü", what: "the separation step in every characteristic" },
  { d: "20 Oct", who: "Pass", what: "a constructive, elementary proof" },
  { d: "21 Oct", who: "Amanov, van den Berg, Zuiddam", what: "ω ≤ 9/4 over every field, plus a barrier" },
  { d: "3 Nov", who: "Li", what: "the 'untwisting lemma' for semidirect sums" },
  { d: "6 Nov", who: "Doğan, Lysikov, Sakabe, Walter", what: "a proof via fractional tensor value" },
]

const W = 680
const H = 300
const L = 48
const R = 18
const T = 14
const B = 30
const Y0 = 1966
const Y1 = 2027.4
const W0 = 1.95
const W1 = 2.85

const sx = (y: number) => L + ((y - Y0) / (Y1 - Y0)) * (W - L - R)
const sy = (w: number) => T + ((W1 - w) / (W1 - W0)) * (H - T - B)

const UP = "oklch(0.55 0.15 250)"
const LOW = "oklch(0.62 0.16 30)"

export function BoundsSqueeze() {
  const [claims, setClaims] = useState(true)
  const [hover, setHover] = useState<number | null>(null)

  const ups = claims ? UPPER : UPPER.filter((p) => !p.claim)
  const last = ups[ups.length - 1]
  // stepped path for the upper bound
  let d = `M${sx(Y0).toFixed(1)},${sy(3).toFixed(1)}`
  for (const p of ups) d += ` H${sx(p.y).toFixed(1)} V${sy(p.w).toFixed(1)}`
  d += ` H${sx(Y1).toFixed(1)}`
  const lowJump = 2026.9
  const gap = last.w - (claims ? 2.25 : 2)

  const shown = hover !== null ? ups[hover] : null

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setClaims(true)}
          className={`rounded-md border px-2 py-1 ${claims ? "border-foreground/40 bg-muted font-medium" : "border-border"}`}
        >
          with openai/math claims
        </button>
        <button
          type="button"
          onClick={() => setClaims(false)}
          className={`rounded-md border px-2 py-1 ${!claims ? "border-foreground/40 bg-muted font-medium" : "border-border"}`}
        >
          without them
        </button>
        <span className="text-muted-foreground">
          gap between the bounds: <b className="font-mono text-foreground">{gap < 1e-9 ? "0" : gap.toFixed(6)}</b>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Upper and lower bounds on the matrix multiplication exponent over time">
        {[2, 2.25, 2.5, 2.75].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={L - 6} y={sy(v) + 3} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.6}>
              {v}
            </text>
          </g>
        ))}
        {[1970, 1980, 1990, 2000, 2010, 2020].map((y) => (
          <text key={y} x={sx(y)} y={H - B + 16} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
            {y}
          </text>
        ))}
        {/* shaded gap */}
        <path
          d={`${d} V${sy(claims ? 2.25 : 2).toFixed(1)} H${sx(Y0).toFixed(1)} Z`}
          fill={UP}
          fillOpacity={0.06}
        />
        <path d={d} fill="none" stroke={UP} strokeWidth={2} />
        {/* lower bound */}
        <line x1={sx(Y0)} x2={claims ? sx(lowJump) : sx(Y1)} y1={sy(2)} y2={sy(2)} stroke={LOW} strokeWidth={2} />
        {claims && (
          <path
            d={`M${sx(lowJump).toFixed(1)},${sy(2).toFixed(1)} V${sy(2.25).toFixed(1)} H${sx(Y1).toFixed(1)}`}
            fill="none"
            stroke={LOW}
            strokeWidth={2}
            strokeDasharray="5 3"
          />
        )}
        <text x={sx(1975)} y={sy(2) - 6} fontSize={10} fill={LOW}>
          lower bound: ω ≥ 2, because the answer has n² entries
        </text>
        {claims && (
          <text x={sx(Y1) - 4} y={sy(2.25) + 14} fontSize={10} fill={LOW} textAnchor="end">
            claimed 24 Nov: ω ≥ 9/4
          </text>
        )}
        {ups.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.y)}
            cy={sy(p.w)}
            r={hover === i ? 6 : 4}
            fill={p.claim ? "var(--background, white)" : UP}
            stroke={UP}
            strokeWidth={p.claim ? 2 : 0}
            strokeDasharray={p.claim ? "2 2" : undefined}
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </svg>
      <div className="mt-2 min-h-[2.5rem] rounded-lg bg-muted/50 p-3 text-xs">
        {shown ? (
          <span>
            <b>{Math.floor(shown.y)}</b> · {shown.who}: ω {shown.claim ? "≤" : "<"} <span className="font-mono">{shown.w}</span>
            {shown.note ? ` (${shown.note})` : ""}
            {shown.claim ? " · a claim, since reproved by humans (below)" : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Hover or tab to a point. Fifty-seven years of upper bounds sit above a lower bound that never moved off 2 until 24 Nov 2026.
          </span>
        )}
      </div>
      {claims && (
        <ol className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
          {REPROOFS.map((r) => (
            <li key={r.who} className="rounded-md border border-border px-2 py-1">
              <span className="font-mono">{r.d}</span> · <b>{r.who}</b>: {r.what}
            </li>
          ))}
        </ol>
      )}
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Solid points are published upper bounds; the hollow one is OpenAI’s 2 Oct claim. The list under the chart is the human work that has reproved the 9/4 upper bound since (arXiv submission dates). The dashed lower line is the 24 Nov claim, which nobody outside OpenAI has reproved yet; with it, the gap closes to zero.
      </figcaption>
    </figure>
  )
}
