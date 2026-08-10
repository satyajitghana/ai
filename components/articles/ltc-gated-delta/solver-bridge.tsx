"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The bridge between the two literatures, derived from LTC's own Algorithm 1.
// The fused solver step is
//
//   x(t+dt) = [x(t) + dt*f*A] / [1 + dt*(1/tau + f)]
//
// and since 1 + dt*(1/tau + f) = 1 + dt/tau_sys, that is exactly
//
//   x(t+dt) = a_pade * x(t) + (write term),   a_pade = 1 / (1 + dt/tau_sys)
//
// i.e. a gated linear recurrence whose retention factor is input-dependent.
// The exact ODE solution decays by exp(-dt/tau_sys) instead. Those two agree
// to first order: 1/(1+z) is the [0/1] Pade approximant of e^-z. Modern gated
// linear attention writes the exponential form directly and calls it alpha.

const PADE = "oklch(0.68 0.13 85)"
const EXPO = "oklch(0.60 0.15 255)"

const halfLife = (a: number) => Math.log(0.5) / Math.log(a)

export function SolverBridge() {
  const [z, setZ] = useState(0.05) // z = dt / tau_sys

  const aPade = 1 / (1 + z)
  const aExp = Math.exp(-z)
  const relErr = ((aPade - aExp) / aExp) * 100

  const N = 70
  const zmax = 1.2
  const curve = (fn: (x: number) => number) =>
    Array.from({ length: N + 1 }, (_, i) => {
      const x = (i / N) * zmax
      return `${(x / zmax) * 100},${(1 - fn(x)) * 100}`
    }).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          LTC fused solver vs. the gated-linear-attention convention
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">z = Δt / τ_sys</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: PADE }}>
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              LTC · Algorithm 1
            </div>
            <div className="mt-1 font-mono text-[11px]" style={{ color: PADE }}>
              ᾱ = 1 / (1 + z)
            </div>
            <div className="mt-1 font-mono text-lg tabular-nums text-foreground">{aPade.toFixed(6)}</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              half-life {halfLife(aPade).toFixed(1)} steps
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: EXPO }}>
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              exact ODE · GDN, Mamba2, KDA
            </div>
            <div className="mt-1 font-mono text-[11px]" style={{ color: EXPO }}>
              α = e^(−z)
            </div>
            <div className="mt-1 font-mono text-lg tabular-nums text-foreground">{aExp.toFixed(6)}</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              half-life {halfLife(aExp).toFixed(1)} steps
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-background/60 p-3">
          <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
            <span>retention per step, as a function of z</span>
            <span className="tabular-nums">Padé overshoots by {relErr.toFixed(2)}%</span>
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="Two nearly identical decay curves: the Pade approximant one over one plus z, and the exponential e to the minus z, diverging only as z grows past about 0.3">
            <polyline points={curve((x) => 1 / (1 + x))} fill="none" stroke={PADE} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            <polyline points={curve((x) => Math.exp(-x))} fill="none" stroke={EXPO} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
            <line x1={(z / zmax) * 100} y1="0" x2={(z / zmax) * 100} y2="100" stroke="currentColor" strokeWidth="0.4" opacity="0.35" />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>z = 0 · never forgets</span>
            <span>z = {zmax} · forgets fast</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">z = Δt/τ_sys</span>
          <Range
            min={0.005}
            max={zmax}
            step={0.005}
            value={z}
            onChange={(e) => setZ(Number(e.target.value))}
            className="min-w-[11rem] flex-1"
            aria-label="step size divided by the system time constant"
            accent={EXPO}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{z.toFixed(3)}</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Take LTC&rsquo;s fused solver step, group the terms, and the denominator collapses to{" "}
          <span className="font-mono text-foreground">1 + Δt/τ_sys</span>. What is left is a{" "}
          <span className="text-foreground">gated linear recurrence</span>: last state times a scalar in (0,1), plus
          a write. That scalar is the thing Gated DeltaNet calls α and Mamba2 calls the decay gate — LTC just spells
          it as a Padé approximant of the exponential rather than the exponential itself. In the regime these models
          actually run in (small z, long memory) the two agree to a fraction of a percent. The literatures are not
          analogous. They are the same recurrence, discretized two different ways.
        </p>
      </div>
    </figure>
  )
}
