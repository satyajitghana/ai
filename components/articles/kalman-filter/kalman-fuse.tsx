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
const C_PRED = "var(--muted-foreground)"
const C_MEAS = "oklch(0.72 0.15 40)"
const C_POST = "oklch(0.62 0.15 205)"
const C_POST_FILL = "oklch(0.62 0.15 205 / 0.14)"

// ── scene geometry ──
const W = 600
const H = 216
const pad = 12
const axisY = 150 // baseline for the density curves
const gainY = 178 // the Kalman-gain track
const labelY = 200

export function KalmanFuse() {
  const [sp, setSp] = useState(10) // prediction std
  const [sz, setSz] = useState(7) // measurement std

  const vp = sp * sp
  const vz = sz * sz
  const K = vp / (vp + vz) // Kalman gain
  const muPost = MU_PRED + K * (Z - MU_PRED)
  const vPost = (1 - K) * vp
  const sPost = Math.sqrt(vPost)

  const xs = (x: number) => pad + (x / 100) * (W - 2 * pad)
  const dens = (x: number, mu: number, s: number) =>
    Math.exp((-(x - mu) * (x - mu)) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI))
  const peak = Math.max(dens(muPost, muPost, sPost), dens(MU_PRED, MU_PRED, sp), dens(Z, Z, sz))
  const ys = (d: number) => axisY - (d / peak) * (axisY - pad)
  const curve = (mu: number, s: number) => {
    let p = ""
    for (let x = 0; x <= 100; x += 1) p += `${x === 0 ? "M" : "L"}${xs(x).toFixed(1)},${ys(dens(x, mu, s)).toFixed(1)} `
    return p
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>prediction × measurement = posterior</span>
        <span className="text-muted-foreground/60">exact · Gaussian product</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label="Three Gaussian curves — prediction, measurement, and their sharper product the posterior — with a gain track showing where the posterior mean lands between the two inputs.">
          <defs>
            <filter id="kf-soft" x="-30%" y="-40%" width="160%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* axis */}
          <line x1={pad} y1={axisY} x2={W - pad} y2={axisY} stroke="var(--border)" strokeWidth={1} />

          {/* mean guide ticks */}
          {[{ x: MU_PRED, c: C_PRED }, { x: Z, c: C_MEAS }, { x: muPost, c: C_POST }].map((m, k) => (
            <line key={k} x1={xs(m.x)} y1={pad} x2={xs(m.x)} y2={axisY} stroke={m.c} strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
          ))}

          {/* curves */}
          <path d={curve(MU_PRED, sp)} fill="none" stroke={C_PRED} strokeWidth={1.5} opacity={0.7} />
          <path d={curve(Z, sz)} fill="none" stroke={C_MEAS} strokeWidth={1.5} opacity={0.85} />
          <path d={curve(muPost, sPost)} fill={C_POST_FILL} stroke={C_POST} strokeWidth={2.5} filter="url(#kf-soft)" />

          {/* ── Kalman-gain track: μ_post slides between μ_pred and z ── */}
          <line x1={xs(MU_PRED)} y1={gainY} x2={xs(Z)} y2={gainY} stroke="var(--border)" strokeWidth={3} strokeLinecap="round" />
          <line x1={xs(MU_PRED)} y1={gainY} x2={xs(muPost)} y2={gainY} stroke={C_POST} strokeWidth={3} strokeLinecap="round" className="transition-all" />
          <circle cx={xs(MU_PRED)} cy={gainY} r={3} fill={C_PRED} />
          <circle cx={xs(Z)} cy={gainY} r={3} fill={C_MEAS} />
          <circle cx={xs(muPost)} cy={gainY} r={4.5} fill={C_POST} stroke="var(--background)" strokeWidth={1.5} className="transition-all" />

          {/* base labels (short — fit under their ticks) */}
          <text x={xs(MU_PRED)} y={labelY} textAnchor="middle" className="font-mono" fontSize={10} fill={C_PRED}>μ_pred</text>
          <text x={xs(Z)} y={labelY} textAnchor="middle" className="font-mono" fontSize={10} fill={C_MEAS}>z</text>
          <text x={xs(muPost)} y={gainY - 10} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={700} fill={C_POST}>K = {K.toFixed(2)}</text>
        </svg>

        <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: "var(--muted-foreground)" }} />prediction</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: C_MEAS }} />measurement</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: C_POST }} />posterior</span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Slider label="prediction spread σ_pred" value={sp} onChange={setSp} />
          <Slider label="measurement spread σ_z" value={sz} onChange={setSz} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="Kalman gain K" value={K.toFixed(2)} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  )
}
