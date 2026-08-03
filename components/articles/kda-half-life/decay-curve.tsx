"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The whole point in one widget: a KDA channel's retention factor alpha sets a
// half-life in tokens, by exactly the same algebra that gives a radioactive
// isotope a half-life in seconds. Drag alpha, read the half-life. The curve is
// the discrete S_n = alpha^n S_0; the dashed line is the continuous
// N(t) = N_0 e^{-lambda t} with lambda = -ln(alpha), which passes through every
// integer step — the two are the same law, sampled differently.

const ACCENT = "oklch(0.58 0.15 265)"
const DECAY = "oklch(0.55 0.17 25)"

const W = 700
const H = 300
const padL = 44
const padR = 16
const padT = 16
const padB = 34

const r2 = (n: number) => Math.round(n * 100) / 100

// Preset alphas worth landing on, with the half-life each implies.
const PRESETS = [0.9, 0.95, 0.99, 0.999]

export function DecayCurve() {
  const [alphaIdx, setAlphaIdx] = useState(280) // maps to alpha via the log scale below

  // Slider walks log(1 - alpha) so the interesting region near 1 is reachable.
  // idx 0 -> alpha 0.5, idx 400 -> alpha 0.99999
  const alpha = r2Alpha(alphaIdx)
  const halfLife = Math.log(0.5) / Math.log(alpha)
  const lambda = -Math.log(alpha)

  // x axis spans ~3 half-lives so the shape is always readable
  const nMax = Math.max(8, Math.ceil(halfLife * 3))
  const sx = (n: number) => r2(padL + (n / nMax) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - v) * (H - padT - padB))

  // discrete samples
  const pts: string[] = []
  const STEPS = 120
  for (let i = 0; i <= STEPS; i++) {
    const n = (i / STEPS) * nMax
    pts.push(`${sx(n)},${sy(Math.pow(alpha, n))}`)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">kda channel decay · half-life in tokens</span>
        <div className="flex gap-1">
          {PRESETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAlphaIdx(idxForAlpha(a))}
              className="cursor-pointer rounded-full border border-transparent px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Decay curve for retention factor alpha equals ${alpha}. Memory falls to half after about ${Math.round(halfLife)} tokens.`}>
          {/* gridlines at 1, 0.5, 0.25 */}
          {[1, 0.5, 0.25].map((v) => (
            <g key={v}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="currentColor" strokeOpacity={v === 0.5 ? 0.25 : 0.08} strokeDasharray={v === 0.5 ? "4 3" : undefined} />
              <text x={padL - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>
                {v === 1 ? "S₀" : v === 0.5 ? "½" : "¼"}
              </text>
            </g>
          ))}

          {/* the decay curve */}
          <polyline points={pts.join(" ")} fill="none" stroke={ACCENT} strokeWidth={2} />

          {/* half-life marker */}
          <line x1={sx(halfLife)} y1={sy(0.5)} x2={sx(halfLife)} y2={sy(0)} stroke={DECAY} strokeWidth={1.4} strokeDasharray="4 3" />
          <circle cx={sx(halfLife)} cy={sy(0.5)} r={4} fill={DECAY} />
          <text x={sx(halfLife) + 8} y={sy(0.5) - 8} className="font-mono" fontSize={11} fontWeight={600} fill={DECAY}>
            n½ ≈ {halfLife < 10 ? halfLife.toFixed(1) : Math.round(halfLife).toLocaleString()} tokens
          </text>

          {/* x ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const n = f * nMax
            return (
              <text key={f} x={sx(n)} y={H - 12} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>
                {n >= 1000 ? `${Math.round(n / 1000)}k` : Math.round(n)}
              </text>
            )
          })}
          <text x={(W + padL) / 2} y={H - 1} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize={9}>
            token steps n
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">retention α</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>{fmtAlpha(alpha)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">decay rate λ = −ln α</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{lambda < 0.001 ? lambda.toExponential(1) : lambda.toFixed(4)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">half-life n½</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: DECAY }}>
              {halfLife < 10 ? halfLife.toFixed(1) : Math.round(halfLife).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>retention factor α</span>
            <span className="tabular-nums text-foreground">{fmtAlpha(alpha)}</span>
          </div>
          <Range min={0} max={400} step={1} value={alphaIdx} onChange={(e) => setAlphaIdx(+e.target.value)} className="w-full" aria-label="retention factor alpha" accent={ACCENT} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The curve is <span className="font-mono">Sₙ = αⁿS₀</span> — a channel&rsquo;s memory after n tokens. It
          crosses the dashed half-line at <span className="font-mono">n½ = ln(0.5)/ln(α)</span>, the same formula
          a physicist uses for an isotope, because <span className="font-mono">αⁿ</span> and{" "}
          <span className="font-mono">e^(−λn)</span> are the same function with{" "}
          <span className="text-foreground">λ = −ln α</span>. At α = 0.99 a channel has forgotten half of what it
          knew after about <span style={{ color: DECAY }}>69 tokens</span>. Nudge α to 0.999 and that becomes
          roughly 693.
        </p>
      </div>
    </figure>
  )
}

// --- slider <-> alpha mapping (log in (1 - alpha)) --------------------------
// idx 0 => 1-alpha = 0.5 ; idx 400 => 1-alpha = 1e-5
function r2Alpha(idx: number): number {
  const logHi = Math.log10(0.5)
  const logLo = Math.log10(1e-5)
  const t = idx / 400
  const gap = Math.pow(10, logHi + (logLo - logHi) * t)
  return 1 - gap
}

function idxForAlpha(a: number): number {
  const logHi = Math.log10(0.5)
  const logLo = Math.log10(1e-5)
  const t = (Math.log10(1 - a) - logHi) / (logLo - logHi)
  return Math.round(t * 400)
}

function fmtAlpha(a: number): string {
  const gap = 1 - a
  if (gap >= 0.01) return a.toFixed(3)
  if (gap >= 0.0001) return a.toFixed(5)
  return a.toFixed(7)
}
