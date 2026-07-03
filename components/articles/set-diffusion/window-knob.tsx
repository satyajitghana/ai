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

  const ACCENT = "oklch(0.72 0.15 265)"
  const HUES = [195, 150, 265, 30, 320, 90, 230]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">the window w · one knob from autoregression to diffusion</div>
      <div className="p-4">
        {/* AR — diffusion axis */}
        <div className="relative mb-4 h-8">
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded" style={{ background: "linear-gradient(90deg, oklch(0.7 0.13 150), oklch(0.7 0.13 320))" }} />
          <div className="absolute left-0 top-0 font-mono text-[10px] text-muted-foreground">autoregression</div>
          <div className="absolute right-0 top-0 font-mono text-[10px] text-muted-foreground">diffusion</div>
          <div
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-all"
            style={{ left: `${w * 100}%`, background: ACCENT }}
          />
        </div>

        {/* token strip: decode spread under this w */}
        <div className="flex gap-[3px]">
          {Array.from({ length: N }).map((_, i) => {
            const s = stepOf(i)
            return <div key={i} className="h-5 flex-1 rounded-[2px]" style={{ background: `oklch(0.72 0.14 ${HUES[s % HUES.length]})`, opacity: 0.8 }} />
          })}
        </div>
        <div className="mt-1 text-center font-mono text-[9px] text-muted-foreground">colored by decode step · {spread} steps for {N} tokens</div>

        {/* slider */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>window w</span>
            <span className="tabular-nums text-foreground">{w.toFixed(2)}{arLike ? " · ≈ AR" : diffLike ? " · ≈ MDLM" : ""}</span>
          </div>
          <input type="range" min={0.02} max={1} step={0.02} value={w} onChange={(e) => setW(+e.target.value)} className="w-full accent-foreground" aria-label="window w" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">perplexity (lower better)</div>
            <div className="font-medium" style={{ color: ppl < 20 ? "oklch(0.72 0.15 150)" : "oklch(0.72 0.13 40)" }}>{ppl.toFixed(1)}</div>
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
