"use client"

import { useState } from "react"

// The forward process and the objective in one control. Drag the masking ratio t:
// each token is independently replaced by [MASK] with probability t, and the model
// is trained to predict the originals — but the loss counts only the masked
// positions, reweighted by 1/t so every noise level contributes correctly:
//   L = − E_t (1/t) Σ_i 1[x_t^i = MASK] · log p_θ(x_0^i | x_t)
// Deterministic per-token thresholds so masking grows monotonically with t.
// Drawn as an SVG token sequence: masked positions are the ones the loss scores.

const ACCENT = "oklch(0.60 0.15 255)"
const TOKENS = ["masked", "diffusion", "predicts", "the", "original", "tokens", "at", "every", "masked", "position", "in", "one", "shot"]
const frac = (x: number) => x - Math.floor(x)
// each token gets a fixed threshold in (0,1); it is masked once t exceeds it
const THRESH = TOKENS.map((_, i) => frac((i + 1) * 0.61803398875))

// scene geometry (viewBox units)
const N = TOKENS.length
const W = 840
const MX = 12
const GAP = 6
const NW = (W - 2 * MX - (N - 1) * GAP) / N
const NY = 42
const NH = 38
const H = 104
const nx = (i: number) => MX + i * (NW + GAP)

export function MaskingProcess() {
  const [t, setT] = useState(0.4)
  const maskedIdx = TOKENS.map((_, i) => THRESH[i] < t)
  const nMasked = maskedIdx.filter(Boolean).length
  const weight = t > 0 ? 1 / t : Infinity

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        forward masking process · loss on masked positions, weighted 1/t
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Token sequence with ${nMasked} of ${N} positions masked at ratio t = ${t.toFixed(2)}; masked positions are the ones the loss scores.`}>
          <defs>
            <filter id="mask-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={24} fill="var(--muted-foreground)" className="font-mono" fontSize={11}>
            x_t · masked = scored, weighted 1/t →
          </text>

          {TOKENS.map((tok, i) => {
            const masked = maskedIdx[i]
            return (
              <g key={i}>
                <rect
                  x={nx(i)}
                  y={NY}
                  width={NW}
                  height={NH}
                  rx={7}
                  fill={masked ? ACCENT : "var(--background)"}
                  fillOpacity={masked ? 0.12 : 1}
                  stroke={masked ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  strokeDasharray={masked ? "3 3" : undefined}
                  filter={masked ? undefined : "url(#mask-soft)"}
                  className="transition-all duration-300"
                />
                <text
                  x={nx(i) + NW / 2}
                  y={NY + NH / 2 + 3}
                  textAnchor="middle"
                  fill={masked ? ACCENT : "var(--foreground)"}
                  className="font-mono"
                  fontSize={9}
                  fontWeight={masked ? 600 : 400}
                >
                  {masked ? "MASK" : tok}
                </text>
                <text x={nx(i) + NW / 2} y={NY + NH + 13} textAnchor="middle" fill="var(--muted-foreground)" fillOpacity={0.7} className="font-mono" fontSize={8}>
                  {i}
                </text>
              </g>
            )
          })}
        </svg>

        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>masking ratio t</span>
            <span className="tabular-nums text-foreground">{t.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={t}
            onChange={(e) => setT(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-[oklch(0.60_0.15_255)]"
            aria-label="masking ratio t"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>t→0 · nearly clean</span>
            <span>t→1 · fully masked</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>masked <span className="text-foreground">{nMasked}</span>/{N}</span>
          <span>scored positions <span className="text-foreground">{nMasked}</span></span>
          <span>loss weight <span style={{ color: ACCENT }}>1/t = {weight.toFixed(2)}×</span></span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The &ldquo;noise&rdquo; here is masking, not Gaussian — an absorbing-state
          diffusion over discrete tokens. The model sees the corrupted sequence and
          predicts the originals, but the loss only counts the{" "}
          <span className="text-foreground">{nMasked}</span> masked positions, scaled by{" "}
          <span className="text-foreground">1/t = {weight.toFixed(2)}</span> so heavily-
          and lightly-masked samples both pull their weight. Averaged over all t, this is
          an upper bound on the negative log-likelihood — the same objective iLLaDA keeps
          through pre-training <em>and</em> fine-tuning.
        </p>
      </div>
    </figure>
  )
}
