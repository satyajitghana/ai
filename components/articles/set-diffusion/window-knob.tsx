"use client"

import { useState } from "react"

// The single knob that slides set diffusion along the AR↔diffusion spectrum. The
// position-offset schedule gives each token an active window of width w. Small w →
// tokens generate almost strictly left-to-right (the ELBO becomes the tight AR
// objective — best perplexity, but little parallelism). Large w → windows overlap and
// tokens can be decoded together in any order (maximally parallel and any-order, at
// some quality cost). Drag w and watch the tradeoff — and the token strip's decode
// spread. Illustrative curves anchored to the paper's endpoints.

const N = 16
const ACCENT = "oklch(0.62 0.15 265)"
const HUES = [195, 150, 265, 30, 320, 90, 230]

// scene geometry (viewBox units)
const W = 760
const H = 150
const AX0 = 64
const AX1 = W - 64
const AXY = 44
const STRIPY = 86
const STRIPH = 30
const GAP = 4
const RW = (AX1 - AX0 - (N - 1) * GAP) / N
const knobX = (w: number) => AX0 + w * (AX1 - AX0)
const tokX = (i: number) => AX0 + i * (RW + GAP)

export function WindowKnob() {
  const [w, setW] = useState(0.4)

  // illustrative: PPL rises with w (AR-tight at w→0, MDLM at w→1); parallelism rises with w
  const ppl = 17.5 + w * 6.0 // ~17.5 (AR limit) → ~23.5 (MDLM limit)
  const tokensPerStep = 1 + w * 6 // ~1 (AR) → ~7 (parallel)
  const arLike = w < 0.15
  const diffLike = w > 0.85

  // decode-step per position under a position-offset schedule with window w:
  // earlier positions revealed first; larger w lets more positions share a step
  const spread = Math.max(1, Math.round(N / tokensPerStep))
  const stepOf = (i: number) => Math.floor(i / Math.max(1, tokensPerStep))

  const kx = knobX(w)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">the window w · one knob from autoregression to diffusion</div>

      <div className="p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Window w = ${w.toFixed(2)} on the autoregression-to-diffusion spectrum; ${spread} decode steps for ${N} tokens.`}>
          <defs>
            <linearGradient id="sd-knob-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="oklch(0.7 0.13 150)" />
              <stop offset="1" stopColor="oklch(0.68 0.15 320)" />
            </linearGradient>
            <filter id="sd-knob-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* endpoint labels */}
          <text x={AX0} y={20} className="fill-muted-foreground font-mono" fontSize={10}>◀ autoregression</text>
          <text x={AX1} y={20} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>diffusion ▶</text>

          {/* the spectrum axis */}
          <line x1={AX0} y1={AXY} x2={AX1} y2={AXY} stroke="url(#sd-knob-grad)" strokeWidth={3} strokeLinecap="round" />

          {/* connector from knob down to the token strip */}
          <line x1={kx} y1={AXY + 12} x2={kx} y2={STRIPY - 5} stroke="var(--foreground)" strokeOpacity={0.25} strokeDasharray="3 3" strokeWidth={1} />

          {/* draggable knob */}
          <circle cx={kx} cy={AXY} r={9} fill={ACCENT} stroke="var(--background)" strokeWidth={2.5} filter="url(#sd-knob-soft)" />
          <text x={kx} y={AXY - 15} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-foreground font-mono">w = {w.toFixed(2)}{arLike ? " · ≈ AR" : diffLike ? " · ≈ MDLM" : ""}</text>

          {/* token strip, colored by decode step */}
          {Array.from({ length: N }).map((_, i) => {
            const s = stepOf(i)
            return (
              <rect key={i} x={tokX(i)} y={STRIPY} width={RW} height={STRIPH} rx={3} fill={`oklch(0.72 0.14 ${HUES[s % HUES.length]})`} opacity={0.82} className="transition-all duration-300" />
            )
          })}
          <text x={AX0} y={STRIPY + STRIPH + 15} className="fill-muted-foreground font-mono" fontSize={9}>position 0</text>
          <text x={AX1} y={STRIPY + STRIPH + 15} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>position {N - 1}</text>
          <text x={(AX0 + AX1) / 2} y={STRIPY + STRIPH + 15} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>colored by decode step · {spread} steps for {N} tokens</text>
        </svg>

        {/* slider */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>window w</span>
            <span className="tabular-nums text-foreground">{w.toFixed(2)}{arLike ? " · ≈ AR" : diffLike ? " · ≈ MDLM" : ""}</span>
          </div>
          <input type="range" min={0.02} max={1} step={0.02} value={w} onChange={(e) => setW(+e.target.value)} className="w-full cursor-pointer accent-[oklch(0.62_0.15_265)]" aria-label="window w" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">perplexity (lower better)</div>
            <div className="font-medium" style={{ color: ppl < 20 ? "oklch(0.7 0.15 150)" : "oklch(0.7 0.13 40)" }}>{ppl.toFixed(1)}</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">tokens per step (parallelism)</div>
            <div className="font-medium" style={{ color: ACCENT }}>{tokensPerStep.toFixed(1)}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {arLike
            ? "Tiny window: tokens generate almost strictly left-to-right, and the paper proves the objective becomes the tight autoregressive ELBO — the best perplexity, but one token at a time."
            : diffLike
              ? "Full window: every position shares one schedule, recovering order-agnostic diffusion — maximally parallel and any-order, at some quality cost."
              : "In between: a sliding window that decodes a few tokens per step, mostly in order but flexible enough for infilling — set diffusion's sweet spot, trading a little perplexity for real parallelism and any-order decoding."}
        </p>
      </div>
    </figure>
  )
}
