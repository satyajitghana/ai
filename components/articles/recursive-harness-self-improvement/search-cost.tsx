"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The paper's own cost argument (Table 1). One optimization step costs
// C = N_trace + N_pair: agent executions plus pairwise judgments. Finite-
// population search over m candidate harnesses needs m executions and C(m,2)
// pairwise comparisons — Theta(m^2). RHI compares only the current harness
// against its immediately-previous version: 1 execution + 1 comparison,
// Theta(1), independent of how many candidates a population method would
// have needed. Drag m and watch the quadratic pull away from a flat line at 2.

const ACCENT = "oklch(0.62 0.14 250)"
const r2 = (n: number) => Math.round(n * 100) / 100

const M_MAX = 30
const costPop = (m: number) => m + (m * (m - 1)) / 2 // N_trace + N_pair
const COST_RHI = 2 // 1 execution + 1 comparison, every iteration

const W = 720
const H = 340
const PL = 56, PR = 690, PT = 30, PB = 260

const xPix = (m: number) => r2(PL + ((m - 2) / (M_MAX - 2)) * (PR - PL))
const Y_MAX = costPop(M_MAX)
const yPix = (c: number) => r2(PB - (c / Y_MAX) * (PB - PT))

function pathOf() {
  let d = ""
  for (let m = 2; m <= M_MAX; m++) {
    d += (m === 2 ? "M " : "L ") + xPix(m) + " " + yPix(costPop(m)) + " "
  }
  return d.trim()
}
const POP_PATH = pathOf()

const X_TICKS = [2, 8, 14, 20, 26, 30]
const Y_TICKS = [0, 100, 200, 300, 400]

export function SearchCost() {
  const [m, setM] = useState(10)
  const cPop = costPop(m)
  const ratio = r2(cPop / COST_RHI)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>search cost · population vs. trajectory-local</span>
        <span className="text-muted-foreground/50">C = N_trace + N_pair</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Comparing a population of ${m} candidate harnesses per iteration costs ${cPop} agent executions and comparisons, versus a constant 2 for RHI's trajectory-local update — a ${ratio}x gap.`}>
          <defs>
            <filter id="sc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {Y_TICKS.map((t) => (
            <line key={`g${t}`} x1={PL} y1={yPix(t)} x2={PR} y2={yPix(t)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.35} />
          ))}
          {Y_TICKS.map((t) => (
            <text key={`yl${t}`} x={PL - 8} y={yPix(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{t}</text>
          ))}
          {X_TICKS.map((t) => (
            <text key={`x${t}`} x={xPix(t)} y={PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{t}</text>
          ))}
          <text x={(PL + PR) / 2} y={PB + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>candidate harnesses compared per iteration (m) →</text>
          <text x={PL - 8} y={PT - 12} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>executions + comparisons</text>

          <path d={POP_PATH} fill="none" stroke={ACCENT} strokeWidth={2.4} filter="url(#sc-soft)" />
          <line x1={PL} y1={yPix(COST_RHI)} x2={PR} y2={yPix(COST_RHI)} stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 4" opacity={0.8} />
          <text x={PR} y={yPix(COST_RHI) - 8} textAnchor="end" className="font-mono" fontSize={10} fill="var(--muted-foreground)">RHI · Θ(1) = 2</text>

          <line x1={xPix(m)} y1={PT} x2={xPix(m)} y2={PB} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <circle cx={xPix(m)} cy={yPix(cPop)} r={4.5} fill={ACCENT} stroke="var(--background)" strokeWidth={1.5} />
          <text x={xPix(m) + 8} y={yPix(cPop) - 8} className="font-mono" fontSize={10} fontWeight={600} fill={ACCENT}>{cPop} ops</text>
        </svg>

        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>m — population size a finite-population search would compare</span>
            <span className="tabular-nums text-foreground">m = {m}</span>
          </div>
          <Range min={2} max={M_MAX} step={1} value={m} onChange={(e) => setM(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
          <span>population (m={m}) <span className="text-foreground">{cPop}</span>{" "}ops/iteration</span>
          <span>RHI <span className="text-foreground">2</span>{" "}ops/iteration</span>
          <span>gap <span style={{ color: ACCENT }} className="font-semibold">{ratio}×</span></span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every population-based harness search — ADAS, AFlow, GEPA, and the roughly a dozen others
          RHI cites — pays for a sampled population of size m: m fresh agent executions plus{" "}
          <code>C(m,2)</code>{" "}pairwise judgments per iteration, Θ(m²). RHI replaces the population
          with a point mass on the harness&apos;s own immediately-previous version: exactly one new
          execution and one comparison, Θ(1), independent of m. Drag m up and the flat RHI line stops
          looking like a simplification and starts looking like the whole point.
        </p>
      </div>
    </figure>
  )
}
