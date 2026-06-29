"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why diffusion gets bidirectional attention for free. An autoregressive model must
// mask out the future (causal: query i sees only keys j ≤ i) or it would cheat by
// reading the answer. A masked diffusion model never predicts "the next" token — it
// predicts masked positions anywhere — so there's nothing to hide: every position
// attends to every other. Toggle the mask and read off which keys each query sees.

const TOKENS = ["a", "masked", "LM", "reads", "both", "sides"]

export function AttentionModes() {
  const [causal, setCausal] = useState(false)
  const n = TOKENS.length
  const allowed = (q: number, k: number) => (causal ? k <= q : true)
  const seenByLast = TOKENS.filter((_, k) => allowed(n - 1, k)).length

  const C = 40 // cell size
  const L = 64 // left/top label gutter
  const W = L + n * C + 8
  const H = L + n * C + 8

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">attention mask</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "bidirectional (diffusion)" },
            { v: true, label: "causal (autoregressive)" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setCausal(o.v)}
              aria-pressed={causal === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                causal === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Attention matrix: filled cells mark which keys (columns) each query (row) attends to." className="mx-auto w-full max-w-[420px]">
          {/* column (key) labels */}
          {TOKENS.map((t, k) => (
            <text key={k} x={L + k * C + C / 2} y={L - 8} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
              {t}
            </text>
          ))}
          {/* row (query) labels */}
          {TOKENS.map((t, q) => (
            <text key={q} x={L - 8} y={L + q * C + C / 2 + 3} textAnchor="end" fontFamily="monospace" fontSize="10" fill="var(--muted-foreground)">
              {t}
            </text>
          ))}
          {/* cells */}
          {TOKENS.map((_, q) =>
            TOKENS.map((_, k) => {
              const on = allowed(q, k)
              return (
                <rect
                  key={`${q}-${k}`}
                  x={L + k * C + 2}
                  y={L + q * C + 2}
                  width={C - 4}
                  height={C - 4}
                  rx="4"
                  fill={on ? "oklch(0.72 0.15 195)" : "var(--muted)"}
                  fillOpacity={on ? 0.85 : 0.4}
                  stroke="var(--border)"
                />
              )
            })
          )}
          <text x={L} y={H - 2} fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
            row = query · column = key it attends to
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {causal ? (
            <>
              Causal: the last token sees only {seenByLast} of {n} positions — the future
              is masked out, because an autoregressive model would otherwise read the
              token it&rsquo;s supposed to predict. That triangle is the price of
              left-to-right factorization.
            </>
          ) : (
            <>
              Bidirectional: every query attends to all {n} positions, future included.
              A masked diffusion LM predicts <em>masked</em> positions, not &ldquo;the
              next&rdquo; one, so there&rsquo;s nothing to hide — it gets full
              left-and-right context at every layer, which is exactly what helps on
              infilling and global-structure tasks.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
