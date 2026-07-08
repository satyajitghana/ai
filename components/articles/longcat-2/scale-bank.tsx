"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where LongCat-2.0's parameters live, and how few run per token.
// Two orthogonal parameter stores:
//   1. The MoE expert pool — 1.6T total params, but only ~48B activate for any token
//      (a sparse router lights a handful of experts). ~3% of the model runs per token.
//   2. N-gram Embedding — 135B params in *sparse dimensions orthogonal to MoE*. Not
//      experts; a lookup keyed by token n-grams. Drawn as a separate bank, not inside
//      the expert grid, because that is the whole point of the design.
// Step the token to watch a different sparse subset of each store light up. Illustrative.

const ACC = "oklch(0.62 0.16 150)" // LongCat green
const NGRAM = "oklch(0.66 0.13 300)" // violet — a different store

const COLS = 16
const ROWS = 6
const N = COLS * ROWS // 96 expert cells (each ~ a slice of the 1.6T pool)
const ACTIVE = 3 // ~3% of cells lit per token → the 48B/1.6T sparsity

const W = 760
const H = 300
const MX = 34
const GRID_Y = 58
const CELL = 15
const CGAP = 5
const GRID_W = COLS * CELL + (COLS - 1) * CGAP

// Guard: these sampling loops run during SSR/prerender, so a degenerate PRNG
// must never spin forever (see the ngramHit bug that hung the build). Cap the
// iterations — the RNG converges in a few steps, so this only trips on a bug.
const MAX_SPIN = 1000

// deterministic "routing" — which expert cells a given token lights
function routed(token: number): Set<number> {
  const set = new Set<number>()
  let x = (token + 1) * 2654435761
  for (let i = 0; set.size < ACTIVE && i < MAX_SPIN; i++) {
    x = (x ^ (x << 13)) >>> 0
    x = (x ^ (x >> 7)) >>> 0
    set.add(x % N)
  }
  return set
}
// n-gram lookup — a couple of sparse rows in the orthogonal bank
function ngramHit(token: number): Set<number> {
  const set = new Set<number>()
  let x = (token + 7) * 40503
  for (let i = 0; set.size < 2 && i < MAX_SPIN; i++) {
    x = (x ^ (x << 13)) >>> 0
    x = (x ^ (x >> 7)) >>> 0
    set.add(x % COLS)
  }
  return set
}

export function ScaleBank() {
  const [token, setToken] = useState(0)
  const lit = routed(token)
  const ng = ngramHit(token)

  const gx = (i: number) => MX + (i % COLS) * (CELL + CGAP)
  const gy = (i: number) => GRID_Y + Math.floor(i / COLS) * (CELL + CGAP)

  const bankY = GRID_Y + ROWS * (CELL + CGAP) + 42
  const bankCell = CELL
  const bankX = (c: number) => MX + c * (bankCell + CGAP)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>parameter budget · 1.6T total, ~48B active</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="A grid of MoE expert cells with a few lit per token, and a separate orthogonal N-gram embedding bank.">
          <defs>
            <filter id="sb-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* MoE pool label + total */}
          <text x={MX} y={38} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>MoE expert pool</text>
          <text x={MX + GRID_W} y={38} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>1.6T total params</text>

          {/* expert grid */}
          {Array.from({ length: N }, (_, i) => {
            const on = lit.has(i)
            return (
              <rect
                key={i}
                x={gx(i)}
                y={gy(i)}
                width={CELL}
                height={CELL}
                rx={3}
                fill={on ? ACC : "var(--muted-foreground)"}
                opacity={on ? 0.95 : 0.16}
                filter={on ? "url(#sb-soft)" : undefined}
                className="transition-all duration-300"
              />
            )
          })}
          {/* active callout */}
          <text x={MX + GRID_W} y={GRID_Y + ROWS * (CELL + CGAP) + 14} textAnchor="end" className="font-mono" fontSize={10} fill={ACC}>
            ~48B activated / token · ≈3%
          </text>

          {/* divider — orthogonality */}
          <line x1={MX} y1={bankY - 18} x2={W - MX} y2={bankY - 18} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={W - MX} y={bankY - 24} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>orthogonal — not an expert</text>

          {/* N-gram bank label */}
          <text x={MX} y={bankY - 24} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>N-gram Embedding</text>

          {/* N-gram single-row bank */}
          {Array.from({ length: COLS }, (_, c) => {
            const on = ng.has(c)
            return (
              <rect
                key={c}
                x={bankX(c)}
                y={bankY}
                width={bankCell}
                height={bankCell}
                rx={3}
                fill={on ? NGRAM : "var(--muted-foreground)"}
                opacity={on ? 0.95 : 0.16}
                filter={on ? "url(#sb-soft)" : undefined}
                className="transition-all duration-300"
              />
            )
          })}
          <text x={MX + GRID_W} y={bankY + 12} textAnchor="end" className="font-mono" fontSize={10} fill={NGRAM}>
            135B params · sparse-dim lookup
          </text>
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">token</span>
            {[0, 1, 2, 3].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToken(t)}
                aria-pressed={token === t}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  token === t ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={token === t ? { background: ACC } : undefined}
              >
                {t + 1}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACC }} /> routed expert
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: NGRAM }} /> n-gram hit
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Of a <span className="text-foreground">1.6T-parameter</span> model, only about{" "}
          <span style={{ color: ACC }}>48B</span> run for any given token — the router lights a sparse handful of experts (~3% of the pool),
          which is what makes a model this large cheap enough to serve. The{" "}
          <span style={{ color: NGRAM }}>135B N-gram Embedding</span> sits <em>outside</em> that pool: it expands parameters along
          sparse dimensions orthogonal to the MoE, adding capacity through a token-n-gram lookup rather than more experts. Step the token and
          both stores light a different sparse subset.
        </p>
      </div>
    </figure>
  )
}
