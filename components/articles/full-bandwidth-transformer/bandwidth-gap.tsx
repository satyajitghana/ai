"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"

// The paper's central argument, made numeric.
//
// Between two decoding steps, a standard transformer passes exactly one
// sampled token. The paper counts that as log2|V| bits per step. Their model
// has a tied 100,352-token vocabulary and a 1,536-dimensional hidden state
// (Appendix A), so the two channels are not remotely the same size.
//
// The caveat matters and is stated in the component: a hidden state's float
// width is an upper bound on what it can carry, not a measure of what it does
// carry. The honest claim is about the SHAPE of the channel — one discrete
// symbol from a fixed alphabet, against a continuous vector — not that the
// model transmits 24 kilobits of useful information per step.

const VOCAB = 100352
const DIM = 1536

export function BandwidthGap() {
  const [vocab, setVocab] = useState(VOCAB)
  const [dim, setDim] = useState(DIM)
  const [bits, setBits] = useState(16) // bf16

  const tokenBits = mlog2(vocab)
  const latentBits = dim * bits
  const ratio = latentBits / tokenBits

  const ACCENT = "oklch(0.60 0.15 255)"
  const WARM = "oklch(0.68 0.13 85)"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what crosses between decoding steps</span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          {Math.round(ratio).toLocaleString()}× wider
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-foreground">standard decoding — one sampled token</span>
              <span className="font-mono text-[10px] tabular-nums" style={{ color: WARM }}>
                {tokenBits.toFixed(1)} bits
              </span>
            </div>
            <div className="mt-1 h-4 rounded-sm bg-muted/40">
              <div
                className="h-4 rounded-sm"
                style={{ width: `${Math.max(0.3, (tokenBits / latentBits) * 100)}%`, background: WARM }}
              />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-foreground">latent feedback — the top-layer state</span>
              <span className="font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
                {latentBits.toLocaleString()} bits
              </span>
            </div>
            <div className="mt-1 h-4 rounded-sm bg-muted/40">
              <div className="h-4 w-full rounded-sm" style={{ background: ACCENT }} />
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "vocabulary", v: vocab, set: setVocab, min: 1024, max: 262144, step: 1024, c: WARM },
            { l: "hidden dim", v: dim, set: setDim, min: 256, max: 8192, step: 128, c: ACCENT },
            { l: "bits / element", v: bits, set: setBits, min: 4, max: 32, step: 4, c: ACCENT },
          ].map((s) => (
            <div key={s.l} className="flex items-center gap-2">
              <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">{s.l}</span>
              <Range
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.v}
                onChange={(e) => s.set(Number(e.target.value))}
                className="flex-1"
                aria-label={s.l}
                accent={s.c}
              />
              <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {s.v.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
          paper&rsquo;s model: vocab 100,352 → log₂ = 16.6 bits/step · hidden 1,536 dims
          <br />
          the sampled token is the <span className="text-foreground">only</span> thing a standard transformer
          carries forward; the top-layer state is discarded at every step
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Be careful with the ratio: a hidden state&rsquo;s float width is an upper bound on what it{" "}
          <em>could</em>{" "}carry, not a measurement of what it does. Nobody is claiming 24 kilobits of useful
          signal per step. The claim that holds is about the channel&rsquo;s <em>shape</em> — one discrete symbol
          drawn from a fixed alphabet, versus a continuous vector — and about what that shape costs. A model whose
          only way to pass intermediate state forward is to name it in the vocabulary has to verbalize its own
          scratch work, which is a fair description of what chain-of-thought is.
        </p>
      </div>
    </figure>
  )
}
