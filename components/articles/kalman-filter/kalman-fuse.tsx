"use client"

import { useState } from "react"

// The update step is just multiplying two Gaussians. The prediction is a Gaussian
// over the state; the measurement is a Gaussian over what you observed; their
// (normalized) product is the posterior — and it is always SHARPER than either
// input. Drag the two spreads and watch the Kalman gain K slide the mean toward
// whichever source is more certain. μ_pred and z are fixed so the fusion is the
// only thing moving.

const MU_PRED = 38
const Z = 64

export function KalmanFuse() {
  const [sp, setSp] = useState(10) // prediction std
  const [sz, setSz] = useState(7) // measurement std

  const vp = sp * sp
  const vz = sz * sz
  const K = vp / (vp + vz) // Kalman gain
  const muPost = MU_PRED + K * (Z - MU_PRED)
  const vPost = (1 - K) * vp
  const sPost = Math.sqrt(vPost)

  const W = 600
  const H = 180
  const pad = 10
  const xs = (x: number) => pad + (x / 100) * (W - 2 * pad)
  // normalized densities; scale so the tallest fits
  const dens = (x: number, mu: number, s: number) =>
    Math.exp((-(x - mu) * (x - mu)) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI))
  const peak = Math.max(dens(muPost, muPost, sPost), dens(MU_PRED, MU_PRED, sp), dens(Z, Z, sz))
  const ys = (d: number) => H - pad - (d / peak) * (H - 2 * pad)
  const curve = (mu: number, s: number) => {
    let p = ""
    for (let x = 0; x <= 100; x += 1) p += `${x === 0 ? "M" : "L"}${xs(x).toFixed(1)},${ys(dens(x, mu, s)).toFixed(1)} `
    return p
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        prediction × measurement = posterior
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Three Gaussian curves: prediction, measurement, and their sharper product the posterior." className="w-full">
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" strokeWidth="1" />
          <path d={curve(MU_PRED, sp)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" opacity="0.7" />
          <path d={curve(Z, sz)} fill="none" stroke="oklch(0.72 0.15 40)" strokeWidth="1.5" opacity="0.85" />
          <path d={curve(muPost, sPost)} fill="oklch(0.72 0.15 195 / 0.14)" stroke="oklch(0.72 0.15 195)" strokeWidth="2.5" />
          {/* mean ticks */}
          <line x1={xs(muPost)} y1={pad} x2={xs(muPost)} y2={H - pad} stroke="oklch(0.72 0.15 195)" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        </svg>

        <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-muted-foreground/70" />prediction</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: "oklch(0.72 0.15 40)" }} />measurement</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: "oklch(0.72 0.15 195)" }} />posterior</span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Slider label="prediction spread σ_pred" value={sp} onChange={setSp} />
          <Slider label="measurement spread σ_z" value={sz} onChange={setSz} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="Kalman gain K" value={K.toFixed(2)} highlight />
          <Stat label="posterior mean" value={muPost.toFixed(1)} />
          <Stat label="posterior σ" value={`${sPost.toFixed(1)} (< both)`} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The posterior mean is μ<sub>pred</sub> + K(z − μ<sub>pred</sub>): the gain K =
          σ²<sub>pred</sub> / (σ²<sub>pred</sub> + σ²<sub>z</sub>) is the fraction of the way
          you move from the prediction toward the measurement. Shrink the sensor noise and K
          → 1 (snap to the measurement); shrink the prediction noise and K → 0 (keep the
          prediction). Either way the posterior is narrower than both inputs — combining two
          noisy estimates always tells you more than either alone. That&rsquo;s the whole
          filter.
        </p>
      </div>
    </figure>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">{value.toFixed(0)}</span>
      </div>
      <input type="range" min={3} max={22} step={1} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full cursor-pointer accent-foreground" aria-label={label} />
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-medium text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
