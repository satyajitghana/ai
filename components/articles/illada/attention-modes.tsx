"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why diffusion gets bidirectional attention for free. An autoregressive model must
// mask out the future (causal: query i sees only keys j ≤ i) or it would cheat by
// reading the answer. A masked diffusion model never predicts "the next" token — it
// predicts masked positions anywhere — so there's nothing to hide: every position
// attends to every other. The matrix is the mask; the strip below is the same thing
// as a graph — pick a query and watch which keys it draws to.

const ACCENT = "oklch(0.68 0.14 205)"
const TOKENS = ["a", "masked", "LM", "reads", "both", "sides"]

// matrix geometry
const N = TOKENS.length
const C = 42
const L = 64 // left/top label gutter
const T = 42
const MB = T + N * C // matrix bottom
const W = L + N * C + 10
// graph strip
const SL = 16
const SC = (W - 2 * SL) / N
const PY = 366 // pill top
const PH = 24
const H = PY + PH + 8
const sx = (k: number) => SL + k * SC + SC / 2

export function AttentionModes() {
  const [causal, setCausal] = useState(false)
  const [focus, setFocus] = useState(N - 1)
  const allowed = (q: number, k: number) => (causal ? k <= q : true)
  const seenByFocus = TOKENS.filter((_, k) => allowed(focus, k)).length

  const arc = (xq: number, xk: number, k: number) => {
    const y = PY
    const peak = y - 26 - Math.abs(k - focus) * 4
    return `M ${xq} ${y} C ${xq} ${peak}, ${xk} ${peak}, ${xk} ${y}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">attention mask · matrix + graph</span>
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
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                causal === o.v ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
              style={causal === o.v ? { background: ACCENT } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Attention matrix and graph. Query “${TOKENS[focus]}” attends to ${seenByFocus} of ${N} keys under the ${causal ? "causal" : "bidirectional"} mask.`} className="mx-auto w-full max-w-[440px]">
          <defs>
            <marker id="am-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="am-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* axis captions */}
          <text x={L} y={16} fill="var(--muted-foreground)" className="font-mono" fontSize={10}>
            key →
          </text>
          <text x={L - 8} y={16} textAnchor="end" fill="var(--muted-foreground)" className="font-mono" fontSize={10}>
            query ↓
          </text>

          {/* column (key) labels */}
          {TOKENS.map((t, k) => (
            <text key={k} x={L + k * C + C / 2} y={T - 10} textAnchor="middle" fill="var(--muted-foreground)" className="font-mono" fontSize={10}>
              {t}
            </text>
          ))}
          {/* row (query) labels */}
          {TOKENS.map((t, q) => (
            <text key={q} x={L - 10} y={T + q * C + C / 2 + 3} textAnchor="end" fill={q === focus ? ACCENT : "var(--muted-foreground)"} className="font-mono" fontSize={10} fontWeight={q === focus ? 600 : 400}>
              {t}
            </text>
          ))}

          {/* cells */}
          {TOKENS.map((_, q) =>
            TOKENS.map((_, k) => {
              const on = allowed(q, k)
              const inFocus = q === focus
              return (
                <rect
                  key={`${q}-${k}`}
                  x={L + k * C + 2.5}
                  y={T + q * C + 2.5}
                  width={C - 5}
                  height={C - 5}
                  rx={7}
                  fill={on ? ACCENT : "var(--muted)"}
                  fillOpacity={on ? (inFocus ? 0.95 : 0.7) : 0.35}
                  stroke={inFocus ? ACCENT : "var(--border)"}
                  strokeWidth={inFocus ? 1.5 : 1}
                  filter={on && inFocus ? "url(#am-soft)" : undefined}
                  className="transition-all duration-300"
                />
              )
            })
          )}

          {/* clickable row overlays to pick focus query */}
          {TOKENS.map((t, q) => (
            <rect key={q} x={L} y={T + q * C} width={N * C} height={C} fill="transparent" className="cursor-pointer" onClick={() => setFocus(q)}>
              <title>focus query &ldquo;{t}&rdquo;</title>
            </rect>
          ))}

          {/* strip divider caption */}
          <text x={SL} y={MB + 30} fill="var(--muted-foreground)" className="font-mono" fontSize={10}>
            query <tspan fill={ACCENT} fontWeight={600}>&ldquo;{TOKENS[focus]}&rdquo;</tspan> attends to →
          </text>

          {/* graph arcs from focus query to attended keys */}
          {TOKENS.map((_, k) =>
            allowed(focus, k) && k !== focus ? (
              <path key={k} d={arc(sx(focus), sx(k), k)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#am-arrow)" opacity={0.8} className="transition-all duration-300" />
            ) : null
          )}

          {/* token pills */}
          {TOKENS.map((t, k) => {
            const on = allowed(focus, k)
            const isFocus = k === focus
            return (
              <g key={k}>
                <rect
                  x={sx(k) - (SC - 8) / 2}
                  y={PY}
                  width={SC - 8}
                  height={PH}
                  rx={6}
                  fill={isFocus ? ACCENT : on ? ACCENT : "var(--background)"}
                  fillOpacity={isFocus ? 0.95 : on ? 0.14 : 1}
                  stroke={isFocus ? ACCENT : on ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  filter={isFocus ? "url(#am-soft)" : undefined}
                />
                <text x={sx(k)} y={PY + PH / 2 + 3} textAnchor="middle" fill={isFocus ? "var(--background)" : on ? ACCENT : "var(--muted-foreground)"} className="font-mono" fontSize={9} fontWeight={isFocus ? 600 : 400}>
                  {t}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {causal ? (
            <>
              Causal: query <span className="text-foreground">&ldquo;{TOKENS[focus]}&rdquo;</span> sees only{" "}
              {seenByFocus} of {N} positions — the future is masked out, because an
              autoregressive model would otherwise read the token it&rsquo;s supposed to
              predict. That lower-triangle is the price of left-to-right factorization.
            </>
          ) : (
            <>
              Bidirectional: query <span className="text-foreground">&ldquo;{TOKENS[focus]}&rdquo;</span> attends
              to all {N} positions, future included. A masked diffusion LM predicts{" "}
              <em>masked</em> positions, not &ldquo;the next&rdquo; one, so there&rsquo;s
              nothing to hide — it gets full left-and-right context at every layer, which
              is exactly what helps on infilling and global-structure tasks. Click any row
              to change the query.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
