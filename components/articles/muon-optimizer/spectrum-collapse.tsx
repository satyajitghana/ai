"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What "orthogonalize the update" actually does to a matrix's SPECTRUM.
// Muon replaces the momentum matrix M = U diag(sigma) V^T with its orthogonal
// factor U V^T -- i.e. it sets every singular value to 1 and keeps the singular
// *directions*. The Newton-Schulz iteration approximates that without an SVD by
// applying a fixed quintic phi(x) = a x + b x^3 + c x^5 to the matrix; on the
// singular values it acts elementwise. Here we run the REAL tuned coefficients
// on a spread of singular values and watch the spectrum flatten toward ~1.
//
// Honest nuance we visualize: the tuned quintic does NOT drive each value to
// exactly 1. It trades exactness for a steep slope at 0 (phi'(0)=a=3.44), so
// tiny singular values shoot up fast and everything lands in a band near 1.
// The *condition number* kappa = sigma_max/sigma_min collapses from ~33 to ~1.5
// in five cheap steps -- that is the whole point: no direction dominates.
//
// SSR-safe: STATES is precomputed at module load with a bounded loop; the render
// body is pure and deterministic (default step 0); no timers, no Math.random.

const A = 3.4445
const B = -4.775
const C = 2.0315
const phi = (x: number) => A * x + B * x ** 3 + C * x ** 5

// A momentum matrix's singular values, normalized so the largest is 1
// (Muon divides G by its norm first, guaranteeing every sigma lies in [0,1]).
const INIT = [1.0, 0.62, 0.34, 0.13, 0.03]
const STEPS = 5

// Precompute the spectrum after each Newton-Schulz step. Bounded loop.
const STATES: number[][] = [INIT]
for (let s = 0; s < STEPS; s++) {
  STATES.push(STATES[s].map(phi))
}
const KAPPA = STATES.map((s) => Math.max(...s) / Math.min(...s))

const MUON = "oklch(0.60 0.18 275)" // indigo
const Y_MAX = 1.35

// SVG geometry
const W = 720
const H = 300
const PL = 44 // left pad (axis labels)
const PR = 20
const PT = 22
const PB = 40
const PLOT_W = W - PL - PR
const PLOT_H = H - PT - PB
const BAND_LO = 0.68 // where the tuned quintic settles small values
const BAND_HI = 1.2

export function SpectrumCollapse() {
  const [step, setStep] = useState(0)
  const sig = STATES[step]
  const n = sig.length

  const y = (v: number) => PT + PLOT_H * (1 - v / Y_MAX)
  const slot = PLOT_W / n
  const bw = slot * 0.5
  const bx = (i: number) => PL + slot * i + (slot - bw) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Newton-Schulz on the singular values · phi(x) = 3.4445x − 4.775x³ + 2.0315x⁵</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart of a matrix's singular values as the Newton-Schulz iteration flattens them toward one.">
          {/* target band near 1 */}
          <rect x={PL} y={y(BAND_HI)} width={PLOT_W} height={y(BAND_LO) - y(BAND_HI)} fill={MUON} opacity={0.07} />
          {/* sigma = 1 line: the orthogonal target */}
          <line x1={PL} y1={y(1)} x2={PL + PLOT_W} y2={y(1)} stroke={MUON} strokeDasharray="4 4" strokeWidth={1} opacity={0.7} />
          <text x={PL + PLOT_W} y={y(1) - 5} textAnchor="end" className="font-mono" fontSize={10} fill={MUON} opacity={0.9}>
            σ = 1 · orthogonal
          </text>

          {/* y axis ticks */}
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PL} y1={y(t)} x2={PL - 4} y2={y(t)} stroke="var(--border)" />
              <text x={PL - 8} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
                {t.toFixed(1)}
              </text>
            </g>
          ))}
          {/* baseline */}
          <line x1={PL} y1={y(0)} x2={PL + PLOT_W} y2={y(0)} stroke="var(--border)" />

          {/* singular-value bars */}
          {sig.map((v, i) => (
            <g key={i}>
              <rect
                x={bx(i)}
                y={y(Math.max(v, 0))}
                width={bw}
                height={y(0) - y(Math.max(v, 0))}
                rx={3}
                fill={MUON}
                opacity={0.9}
                className="transition-all duration-500"
              />
              <text
                x={bx(i) + bw / 2}
                y={y(Math.max(v, 0)) - 6}
                textAnchor="middle"
                className="fill-foreground font-mono tabular-nums"
                fontSize={11}
              >
                {v.toFixed(2)}
              </text>
              <text x={bx(i) + bw / 2} y={y(0) + 16} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>
                σ{i + 1}
              </text>
            </g>
          ))}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">NS step</span>
            {STATES.map((_, t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStep(t)}
                aria-pressed={step === t}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  step === t ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={step === t ? { background: MUON } : undefined}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
            condition number κ = σ<sub>max</sub>/σ<sub>min</sub> ={" "}
            <span className="font-medium text-foreground">{KAPPA[step].toFixed(1)}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Step 0 is the raw momentum matrix: five singular values spanning{" "}
          <span className="text-foreground">33×</span> (κ = 33.3). Each Newton-Schulz step applies the quintic{" "}
          <span className="text-foreground">φ</span> to every value at once — no SVD, just matrix multiplies. Five steps later
          they are bunched in a band around <span style={{ color: MUON }}>1</span> (κ ≈ 1.5). That flat spectrum <em>is</em> the
          orthogonalized update U Vᵀ: every direction carries the same weight, so the dominant singular direction no longer
          swallows the step. The tuned coefficients trade exact convergence to 1 for a steep slope at 0 — small values shoot up
          fast, which is why five cheap steps suffice.
        </p>
      </div>
    </figure>
  )
}
