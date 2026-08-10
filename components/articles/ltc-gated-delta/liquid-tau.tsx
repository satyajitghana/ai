"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The one equation that defines a Liquid Time-constant Network. Hasani et al.
// (arXiv 2006.04439) Eq. 1 is a linear first-order ODE whose decay rate is
// itself a neural network output:
//
//   dx/dt = -[1/tau + f(x, I, t, th)] x + f(x, I, t, th) A
//
// so the SYSTEM time constant is tau_sys = tau / (1 + tau f), and Theorem 1
// bounds it to tau/(1 + tau W) <= tau_sys <= tau because f is a bounded
// sigmoid in [0, W]. Drag the input drive f and watch the memory horizon move
// between those two walls.

const ACC = "oklch(0.60 0.15 255)"
const WALL = "oklch(0.62 0.03 250)"

const TAU = 100 // nominal time constant, in steps
const W = 0.2 // upper bound on f

export function LiquidTau() {
  const [f, setF] = useState(0.02)

  const tauSys = TAU / (1 + TAU * f)
  const tauMin = TAU / (1 + TAU * W)
  const alpha = Math.exp(-1 / tauSys) // one-step retention, dt = 1
  const half = Math.log(0.5) / Math.log(alpha)

  // log-scale position of a tau within [tauMin, TAU]
  const pos = (t: number) =>
    ((Math.log(t) - Math.log(tauMin)) / (Math.log(TAU) - Math.log(tauMin))) * 100

  // decay curve x(t) = exp(-t / tauSys) sampled for the sparkline
  const N = 60
  const span = TAU * 2
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * span
    return `${(i / N) * 100},${(1 - Math.exp(-t / tauSys)) * 100}`
  }).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          liquid time constant · τ<sub>sys</sub> = τ / (1 + τ·f)
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">arXiv 2006.04439, Eq. 1 &amp; Thm. 1</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* the bounded interval */}
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
            <span>τ/(1 + τW) = {tauMin.toFixed(1)}</span>
            <span className="text-foreground">τ_sys = {tauSys.toFixed(1)} steps</span>
            <span>τ = {TAU}</span>
          </div>
          <div className="relative h-8">
            <div className="absolute inset-x-0 top-3 h-2 rounded-sm" style={{ background: WALL, opacity: 0.35 }} />
            <div
              className="absolute top-1 h-6 w-1 rounded-sm"
              style={{ left: `calc(${pos(tauSys)}% - 2px)`, background: ACC }}
            />
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            the whole interval — Theorem 1 says the time constant can never leave it, however large the input grows
          </div>
        </div>

        {/* decay curve */}
        <div className="mt-3 rounded-lg border bg-background/60 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            state decay with no new input · x(t) = e^(−t/τ_sys)
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label={`Exponential decay of the hidden state with a system time constant of ${tauSys.toFixed(0)} steps`}>
            <line x1="0" y1="50" x2="100" y2="50" stroke={WALL} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.5" />
            <polyline points={pts} fill="none" stroke={ACC} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>t = 0</span>
            <span>dashed line = half the signal gone</span>
            <span>t = {span}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">input drive f</span>
          <Range
            min={0}
            max={W}
            step={0.002}
            value={f}
            onChange={(e) => setF(Number(e.target.value))}
            className="min-w-[11rem] flex-1"
            aria-label="input-dependent gate output f, between 0 and its upper bound W"
            accent={ACC}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{f.toFixed(3)}</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { k: "τ_sys", v: `${tauSys.toFixed(1)} steps`, d: "effective time constant" },
            { k: "α = e^(−1/τ_sys)", v: alpha.toFixed(5), d: "one-step retention" },
            { k: "half-life", v: `${half.toFixed(1)} steps`, d: "when half the signal is gone" },
          ].map((c) => (
            <div key={c.k} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">{c.k}</div>
              <div className="font-mono text-sm tabular-nums text-foreground">{c.v}</div>
              <div className="font-mono text-[9px] text-muted-foreground">{c.d}</div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A conventional RNN fixes its decay rate at training time. An LTC makes it an{" "}
          <span className="text-foreground">output of the network</span>: a gate <em>f</em>{" "}reads the current state
          and the current input, and the answer sets how fast this neuron forgets on this timestep. Turn the drive
          up and the memory horizon collapses from {TAU} steps toward {tauMin.toFixed(0)}; turn it down and the
          neuron holds. The bounds matter as much as the mechanism — because <em>f</em>{" "}is a bounded sigmoid, the
          time constant is trapped in a finite interval no matter how extreme the input, which is what makes the
          system provably stable rather than merely usually stable.
        </p>
      </div>
    </figure>
  )
}
