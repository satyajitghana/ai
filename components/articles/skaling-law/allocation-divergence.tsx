"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"

// The practical consequence, and the reason this paper matters beyond curve
// fitting. The compute-optimal token-to-parameter ratio D*/N* is what tells you
// whether to spend the next dollar on a bigger model or more data. Fitting the
// SAME Farseer runs, the additive law and the coupled law disagree about which
// DIRECTION it moves with scale.
//
// Exponents are read directly off the paper's Figure 6 legend:
//   empirical (GP)  m = -0.14
//   empirical (MLS) m = -0.15
//   Skaling         m = -0.11
//   Chinchilla      m = +0.03
// Anchored so all four agree near the middle of the observed data range, which
// is where they are all fitted; the divergence is the extrapolation.

const C_ANCHOR = 3e20 // inside the Farseer data range
const R_ANCHOR = 130 // tokens per parameter there, read off the left panel

const LAWS = [
  { name: "empirical (MLS)", m: -0.15, color: "oklch(0.60 0.15 255)", dash: "3 2" },
  { name: "empirical (GP)", m: -0.14, color: "oklch(0.58 0.19 25)", dash: "3 2" },
  { name: "Skaling", m: -0.11, color: "oklch(0.55 0.16 300)", dash: "" },
  { name: "Chinchilla", m: 0.03, color: "oklch(0.62 0.15 160)", dash: "" },
]

const C_LO = 1e18
const C_HI = 2e25
const DATA_HI = 3e21 // right edge of the observed range

const ratio = (m: number, C: number) => R_ANCHOR * mpow(C / C_ANCHOR, m)

export function AllocationDivergence() {
  const [logC, setLogC] = useState(24)

  const C = mpow(10, logC)
  const lx = (c: number) => ((mlog10(c) - mlog10(C_LO)) / (mlog10(C_HI) - mlog10(C_LO))) * 100

  const vals = LAWS.map((l) => ratio(l.m, C))
  const rMin = Math.min(...LAWS.flatMap((l) => [ratio(l.m, C_LO), ratio(l.m, C_HI)]))
  const rMax = Math.max(...LAWS.flatMap((l) => [ratio(l.m, C_LO), ratio(l.m, C_HI)]))
  const ly = (r: number) => 96 - ((mlog10(r) - mlog10(rMin)) / (mlog10(rMax) - mlog10(rMin))) * 92

  const N = 60
  const curve = (m: number) =>
    Array.from({ length: N + 1 }, (_, i) => {
      const c = mpow(10, mlog10(C_LO) + (i / N) * (mlog10(C_HI) - mlog10(C_LO)))
      return `${lx(c)},${ly(ratio(m, c))}`
    }).join(" ")

  const spread = Math.max(...vals) / Math.min(...vals)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          compute-optimal tokens per parameter · D*/N*
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">exponents from Fig. 6</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-background/60 p-3">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Log-log plot of optimal tokens per parameter against training compute. Three lines slope downward — the two empirical fits and Skaling — while the Chinchilla line slopes gently upward, so the predictions diverge by orders of magnitude at high compute.">
            <rect x="0" y="0" width={lx(DATA_HI)} height="100" fill="currentColor" opacity="0.06" />
            {LAWS.map((l) => (
              <polyline key={l.name} points={curve(l.m)} fill="none" stroke={l.color} strokeWidth="1.6" strokeDasharray={l.dash} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={lx(C)} y1="0" x2={lx(C)} y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>10¹⁸ FLOPs</span>
            <span style={{ marginLeft: `${lx(DATA_HI) - 12}%` }}>← observed data ends</span>
            <span>10²⁵</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LAWS.map((l, i) => (
            <div key={l.name} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: l.color }}>
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                {l.name}
              </div>
              <div className="mt-1 font-mono text-sm tabular-nums text-foreground">
                {vals[i] >= 10 ? vals[i].toFixed(0) : vals[i].toFixed(1)}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground">m = {l.m > 0 ? "+" : ""}{l.m}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">compute</span>
          <Range
            min={18}
            max={25}
            step={0.1}
            value={logC}
            onChange={(e) => setLogC(Number(e.target.value))}
            className="min-w-[11rem] flex-1"
            aria-label="training compute in FLOPs, log base ten"
            accent={LAWS[2].color}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">10^{logC.toFixed(1)}</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">spread {spread.toFixed(0)}×</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Inside the shaded region — where the runs actually are — all four agree, which is exactly why interpolation
          quality cannot tell you which law is right. Outside it they do not merely differ in magnitude, they{" "}
          <span className="text-foreground">differ in sign</span>. The two model-free empirical estimates of the
          optimum slope downward at m ≈ &minus;0.14; Skaling recovers &minus;0.11; the additive law returns +0.03
          and predicts you should train ever more overtrained models as compute grows. Extrapolate a few orders of
          magnitude and this is not an academic disagreement — it is the difference between spending a frontier
          budget on parameters or on tokens.
        </p>
      </div>
    </figure>
  )
}
