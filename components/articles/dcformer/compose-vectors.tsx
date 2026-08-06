"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Compose function's whole point, simplified to something you can click through.
// In real DCMHA, each head's pre-softmax score (or post-softmax weight) for a query/key
// pair is recombined with every other head's, through a small input-dependent FFN —
// five branches (static base, query-wise/key-wise dynamic low-rank projection, and
// query-wise/key-wise dynamic gating) that together decide, per token, how much of
// head h's *new* value comes from some other head h'. Here: fix one borrow pattern
// (head h reads from head h+1) and let the dynamic *strength* of that borrowing swing
// with the token — that strength swinging is the "dynamic" in Dynamically Composable.
// A hand-picked illustration of the mechanism, not measured activations.

const ACCENT = "oklch(0.66 0.16 200)"
const PRE = "oklch(0.62 0.02 260)"

const H = 5
const TOKENS = ["The", "cat", "sat", "on", "mat"]

// pre-Compose attention weight of each head, for a fixed (query, key) pair, per token
const BASE: number[][] = [
  [0.88, 0.22, 0.12, 0.3, 0.58],
  [0.3, 0.86, 0.2, 0.12, 0.26],
  [0.16, 0.3, 0.82, 0.6, 0.1],
  [0.2, 0.1, 0.34, 0.9, 0.28],
  [0.4, 0.24, 0.16, 0.3, 0.84],
]

// head h borrows from head (h+1) mod H — a fixed circuit, dynamic strength
const BORROW_FROM = [1, 2, 3, 4, 0]

// how strongly each token drives that borrowing (the dynamic weight w_k1/w_k2 in the paper)
const ALPHA_BY_TOKEN = [0.08, 0.52, 0.3, 0.46, 0.2]

const pct = (v: number) => `${Math.round(v * 100)}%`

export function ComposeVectors() {
  const [tok, setTok] = useState(1)
  const alpha = ALPHA_BY_TOKEN[tok]
  const base = BASE[tok]
  const after = base.map((v, h) => Math.min(1, (1 - alpha) * v + alpha * base[BORROW_FROM[h]]))
  const maxH = after.reduce((m, v, h) => (v > after[m] ? h : m), 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        compose: one head reading another head&rsquo;s circuit, per token
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap gap-1 font-mono text-xs">
          {TOKENS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTok(i)}
              aria-pressed={tok === i}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 transition-colors",
                tok === i ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={tok === i ? { background: ACCENT } : undefined}
            >
              {t}
            </button>
          ))}
          <span className="ml-auto self-center text-muted-foreground">
            borrow strength α = <span className="text-foreground">{alpha.toFixed(2)}</span>
          </span>
        </div>

        <div className="space-y-3">
          {Array.from({ length: H }).map((_, h) => (
            <div key={h} className="flex items-center gap-2">
              <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">h{h}</span>

              <div className="flex-1 space-y-1">
                <div className="relative h-3 rounded-sm bg-muted/40">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                    style={{ width: pct(base[h]), background: PRE }}
                  />
                </div>
                <div className="relative h-3 rounded-sm bg-muted/40">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                    style={{
                      width: pct(after[h]),
                      background: ACCENT,
                      boxShadow: h === maxH ? `0 0 0 1px ${ACCENT}` : undefined,
                    }}
                  />
                </div>
              </div>

              <span className="w-32 shrink-0 font-mono text-[10px] text-muted-foreground sm:w-40">
                ← h{BORROW_FROM[h]}, α={alpha.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: PRE }} /> pre-Compose
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: ACCENT }} /> post-Compose
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Fix one physical circuit — head <strong>h</strong>{" "}reads head{" "}
          <strong>h+1</strong>&rsquo;s score for this query/key pair — and only change the
          token. At <strong>&ldquo;{TOKENS[tok]}&rdquo;</strong>{" "}the borrowing strength is{" "}
          <span className="text-foreground">α = {alpha.toFixed(2)}</span>, generated from
          the query/key vectors by a small FFN inside Compose, not looked up from a fixed
          table. Click through the tokens: the pre-Compose bars (top, gray) never move —
          they are what the ordinary Q/K/V projections already computed — but the
          post-Compose bars (bottom, teal) redistribute differently at every token,
          because α does. That per-token swing is the entire difference between DCMHA and
          <em> Talking-Heads Attention</em>, which mixes heads with the same fixed matrix
          for every token, every input, forever.
        </p>
      </div>
    </figure>
  )
}
