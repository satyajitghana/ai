"use client"

import { useState } from "react"

// The forward process and the objective in one control. Drag the masking ratio t:
// each token is independently replaced by [MASK] with probability t, and the model
// is trained to predict the originals — but the loss counts only the masked
// positions, reweighted by 1/t so every noise level contributes correctly:
//   L = − E_t (1/t) Σ_i 1[x_t^i = MASK] · log p_θ(x_0^i | x_t)
// Deterministic per-token thresholds so masking grows monotonically with t.

const TOKENS = ["masked", "diffusion", "predicts", "the", "original", "tokens", "at", "every", "masked", "position", "in", "one", "shot"]
const frac = (x: number) => x - Math.floor(x)
// each token gets a fixed threshold in (0,1); it is masked once t exceeds it
const THRESH = TOKENS.map((_, i) => frac((i + 1) * 0.61803398875))

export function MaskingProcess() {
  const [t, setT] = useState(0.4)
  const maskedIdx = TOKENS.map((_, i) => THRESH[i] < t)
  const nMasked = maskedIdx.filter(Boolean).length
  const weight = t > 0 ? 1 / t : Infinity

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        forward masking process · loss on masked positions, weighted 1/t
      </div>

      <div className="space-y-4 p-4">
        <div className="flex min-h-[60px] flex-wrap items-center gap-1.5 rounded-md border bg-muted/20 p-3">
          {TOKENS.map((tok, i) => (
            <span
              key={i}
              className={
                maskedIdx[i]
                  ? "rounded border border-dashed border-foreground/40 bg-muted px-2 py-1 font-mono text-sm text-muted-foreground"
                  : "rounded px-2 py-1 font-mono text-sm text-foreground"
              }
              title={maskedIdx[i] ? "masked — contributes to the loss" : "kept — no loss here"}
            >
              {maskedIdx[i] ? "[MASK]" : tok}
            </span>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>masking ratio t</span>
            <span className="text-foreground tabular-nums">{t.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={t}
            onChange={(e) => setT(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-foreground"
            aria-label="masking ratio t"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>t→0 · nearly clean</span>
            <span>t→1 · fully masked</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="masked tokens" value={`${nMasked}/${TOKENS.length}`} />
          <Stat label="scored positions" value={`${nMasked}`} />
          <Stat label="loss weight 1/t" value={`${weight.toFixed(2)}×`} highlight />
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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-medium text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
