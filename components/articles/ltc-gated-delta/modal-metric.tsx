"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What LTCAttention actually does to an attention score. Each KV head carries
// M orthonormal directions u_m (QR of a learned matrix) and one time constant
// per direction, set by the first token of the block:
//
//   tau_m(x0) = tau_min / sigmoid(r_m + delta_m)   > tau_min
//   lambda_m(D) = exp(-D / tau_m)
//   M_D = I + sum_m (lambda_m(D) - 1) u_m u_m^T
//   s_ij = q_i^T M_(i-j) k_j / sqrt(d)
//
// So the score keeps its full value in the orthogonal complement and decays,
// per mode, by key age. Defaults follow the reference config: block 512, so
// tau_min = 512/12 = 42.67 and the initial tau = 512/4 = 128.

const MODES = [
  { name: "fast", base: 0.9 },
  { name: "medium", base: 0.45 },
  { name: "slow", base: 0.12 },
]

const COLORS = ["oklch(0.58 0.19 25)", "oklch(0.68 0.13 85)", "oklch(0.60 0.15 255)"]
const MUT = "oklch(0.62 0.03 250)"

const TAU_MIN = 512 / 12
const MAX_D = 512

export function ModalMetric() {
  const [drive, setDrive] = useState(0)

  // tau_m = tau_min / sigmoid(r_m + delta), delta is the x0-conditioned shift
  const taus = MODES.map((m) => {
    const s = 1 / (1 + Math.exp(-(logit(m.base) + drive)))
    return TAU_MIN / s
  })

  const N = 80
  const curve = (tau: number) =>
    Array.from({ length: N + 1 }, (_, i) => {
      const d = (i / N) * MAX_D
      return `${(i / N) * 100},${(1 - Math.exp(-d / tau)) * 100}`
    }).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          LTCAttention · λ<sub>m</sub>(Δ) = e^(−Δ/τ<sub>m</sub>) applied to the score
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">τ_min = 512/12 = {TAU_MIN.toFixed(1)}</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            score weight retained, by key age Δ = i − j
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full" role="img" aria-label="Three exponential decay curves showing how much of the attention score survives as the key gets older, one curve per temporal mode, with the slowest mode retaining the most">
            <line x1="0" y1="50" x2="100" y2="50" stroke={MUT} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.5" />
            {taus.map((t, i) => (
              <polyline key={MODES[i].name} points={curve(t)} fill="none" stroke={COLORS[i]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>Δ = 0 · same token</span>
            <span>half retained</span>
            <span>Δ = {MAX_D}</span>
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {MODES.map((m, i) => (
            <div key={m.name} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: COLORS[i] }}>
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />
                {m.name} mode
              </div>
              <div className="mt-1 font-mono text-sm tabular-nums text-foreground">τ = {taus[i].toFixed(0)}</div>
              <div className="font-mono text-[9px] text-muted-foreground">
                half-life {(Math.log(2) * taus[i]).toFixed(0)} tokens
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">δ from x₀</span>
          <Range
            min={-2.5}
            max={2.5}
            step={0.05}
            value={drive}
            onChange={(e) => setDrive(Number(e.target.value))}
            className="min-w-[11rem] flex-1"
            aria-label="input-conditioned shift to the time constants, read from the first token of the block"
            accent={COLORS[2]}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">{drive >= 0 ? "+" : ""}{drive.toFixed(2)}</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag δ and every mode&rsquo;s horizon moves together — that is the LTC principle, transplanted from a
          recurrent state onto an attention score. One linear projection of the block&rsquo;s first token sets all
          the time constants, and because that token is visible to every query, the controller stays causal. The
          division by a sigmoid is what keeps it honest: τ = τ_min/σ(·) is{" "}
          <span className="text-foreground">always greater than τ_min</span>, so no mode can decay arbitrarily fast
          and no exponent can blow up. The modes are orthonormal, so each one owns a direction in head space and
          decays independently — a spectrum of memory horizons inside a single head, exactly as in a per-channel
          gated linear attention, but expressed as a metric on the query-key inner product instead of a recurrent
          state.
        </p>
      </div>
    </figure>
  )
}

function logit(p: number): number {
  return Math.log(p / (1 - p))
}
