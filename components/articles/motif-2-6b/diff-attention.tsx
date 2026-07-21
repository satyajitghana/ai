"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Differential Attention (Ye et al.), the mechanism at the heart of Motif 2.6B.
// A head computes TWO softmax attention maps and returns their difference:
//   attn = [ softmax(Q1 K1ᵀ) − λ · softmax(Q2 K2ᵀ) ] V
// The second map is trained to capture the common-mode "noise" — the diffuse
// attention that leaks onto irrelevant filler tokens — so subtracting a λ-scaled
// copy of it cancels that leak and leaves a sparse, precise map on the tokens
// that matter. Drag λ and watch the attention on the filler words drain away.

const ACCENT = "oklch(0.58 0.16 262)" // indigo
const SIGNAL = "oklch(0.7 0.15 145)" // green — relevant tokens

const TOKENS = ["book", "a", "flight", "to", "Denver", "on", "Friday", "for", "two", "people"]
const SIGNAL_IX = new Set([4, 6]) // "Denver", "Friday"

const scores1 = TOKENS.map((_, i) => (SIGNAL_IX.has(i) ? 3.0 : 1.2))
const scores2 = TOKENS.map((_, i) => (SIGNAL_IX.has(i) ? 0.2 : 1.6))

function softmax(s: number[]): number[] {
  const m = Math.max(...s)
  const e = s.map((v) => Math.exp(v - m))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / z)
}
const SM1 = softmax(scores1)
const SM2 = softmax(scores2)

export function DiffAttention() {
  const [lambda, setLambda] = useState(0.8)

  const rawDiff = SM1.map((v, i) => Math.max(0, v - lambda * SM2[i]))
  const z = rawDiff.reduce((a, b) => a + b, 0) || 1
  const diff = rawDiff.map((v) => v / z)
  const maxBar = Math.max(...SM1, ...diff)

  const noiseShare = diff.reduce((a, v, i) => (SIGNAL_IX.has(i) ? a : a + v), 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        differential attention · subtract the noise map, keep the signal
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 rounded-md border border-dashed px-3 py-1.5 text-center font-mono text-[11px] text-muted-foreground">
          attn = [ softmax(Q₁K₁ᵀ) − λ·softmax(Q₂K₂ᵀ) ] V
        </div>

        {/* per-token attention */}
        <div className="space-y-1">
          {TOKENS.map((tok, i) => {
            const sig = SIGNAL_IX.has(i)
            return (
              <div key={i} className="grid grid-cols-[76px_1fr] items-center gap-2">
                <span
                  className={cn("truncate text-right font-mono text-[11px]")}
                  style={{ color: sig ? SIGNAL : "var(--muted-foreground)" }}
                >
                  {tok}
                </span>
                <span className="relative block h-4 overflow-hidden rounded bg-muted/40">
                  {/* ghost: the single-softmax map (before subtraction) */}
                  <span
                    className="absolute inset-y-0 left-0 rounded bg-foreground/15"
                    style={{ width: `${(SM1[i] / maxBar) * 100}%` }}
                  />
                  {/* solid: the differential map */}
                  <span
                    className="absolute inset-y-0 left-0 rounded transition-all duration-150"
                    style={{
                      width: `${(diff[i] / maxBar) * 100}%`,
                      background: sig ? SIGNAL : ACCENT,
                    }}
                  />
                </span>
              </div>
            )
          })}
        </div>

        {/* legend */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-foreground/15" /> single softmax (with leak)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} /> differential map
          </span>
        </div>

        {/* control */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>λ — subtraction strength</span>
              <span className="tabular-nums text-foreground">{lambda.toFixed(2)}</span>
            </div>
            <Range min={0} max={1.2} step={0.05} value={lambda} onChange={(e) => setLambda(+e.target.value)} className="w-full" aria-label="lambda" accent={ACCENT} />
          </div>
          <div className="flex flex-col justify-center rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              attention on irrelevant tokens
            </div>
            <div className="mt-0.5 font-mono text-lg tabular-nums" style={{ color: noiseShare > 0.4 ? "oklch(0.64 0.17 25)" : SIGNAL }}>
              {(noiseShare * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          At <span className="text-foreground">λ = 0</span> it's just ordinary attention — a lot of
          mass bleeds onto the eight filler words. Raise λ and the second map's noise gets
          subtracted out, collapsing attention onto{" "}
          <span style={{ color: SIGNAL }}>Denver</span> and{" "}
          <span style={{ color: SIGNAL }}>Friday</span>. Sparser, more precise attention is what the
          Differential Transformer buys — better retrieval, less hallucination, cleaner in-context
          learning — and Motif is one of the first to train it at scale.
        </p>
      </div>
    </figure>
  )
}
