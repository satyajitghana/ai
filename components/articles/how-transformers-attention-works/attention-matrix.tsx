"use client"

import { useState } from "react"

// Interactive attention-weights matrix for transformer explainers, drawn as one SVG
// scene: rows = query tokens, cols = key tokens, cell shade = weight (0..1). Hover or
// focus a query row and the arrows of attention light up — the row it uses stays lit
// while the rest dim, and each attended cell shows its weight. SSR renders the full
// matrix (meaningful without JS). If `weights` is omitted, a deterministic toy pattern
// (diagonal + previous-token, causally masked) is used.
export function AttentionMatrix({
  tokens,
  weights,
  caption,
}: {
  tokens: string[]
  weights?: number[][]
  caption?: string
}) {
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const n = tokens.length

  const w =
    weights ??
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (j > i) return 0 // causal mask
        const score = j === i ? 0.55 : j === i - 1 ? 0.3 : 0.15 / Math.max(i, 1)
        return score
      })
    )

  // scene geometry (viewBox units)
  const P = 40 // cell pitch
  const C = 34 // cell size (leaves a gutter)
  const LM = 52 // left margin for row labels
  const TM = 30 // top margin for col labels
  const W = LM + n * P + 10
  const H = TM + n * P + 10
  const cellX = (j: number) => LM + j * P + (P - C) / 2
  const cellY = (i: number) => TM + i * P + (P - C) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        attention weights · query → keys
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto block w-full max-w-[420px]"
          role="img"
          aria-label="Attention weight matrix; hover a query token row to highlight the key tokens it attends to."
          onMouseLeave={() => setActiveRow(null)}
        >
          <defs>
            <filter id="am-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* key axis label */}
          <text x={LM + (n * P) / 2} y={12} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>
            keys (attended to) →
          </text>

          {/* column headers */}
          {tokens.map((t, j) => (
            <text key={`c${j}`} x={LM + j * P + P / 2} y={TM - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
              {t}
            </text>
          ))}

          {/* rows */}
          {tokens.map((t, i) => {
            const dim = activeRow !== null && activeRow !== i
            const on = activeRow === i
            return (
              <g key={`r${i}`} opacity={dim ? 0.28 : 1} className="transition-opacity duration-200">
                {/* row label */}
                <text
                  x={LM - 10}
                  y={TM + i * P + P / 2 + 4}
                  textAnchor="end"
                  tabIndex={0}
                  onFocus={() => setActiveRow(i)}
                  onBlur={() => setActiveRow(null)}
                  className={on ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={11}
                  style={{ cursor: "default", outline: "none" }}
                >
                  {t}
                </text>
                {/* cells */}
                {w[i].map((v, j) => {
                  const val = Math.min(1, Math.max(0, v))
                  return (
                    <g key={j}>
                      <rect
                        x={cellX(j)}
                        y={cellY(i)}
                        width={C}
                        height={C}
                        rx={6}
                        fill={`color-mix(in oklch, var(--foreground) ${Math.round(val * 85)}%, var(--background))`}
                        stroke="var(--border)"
                        strokeWidth={0.75}
                        filter={on && val > 0.05 ? "url(#am-soft)" : undefined}
                        className="transition-all duration-200"
                      />
                      {on && val > 0.02 && (
                        <text
                          x={cellX(j) + C / 2}
                          y={cellY(i) + C / 2 + 3.5}
                          textAnchor="middle"
                          className="font-mono tabular-nums"
                          fontSize={10}
                          fill={val > 0.4 ? "var(--background)" : "var(--muted-foreground)"}
                        >
                          {val.toFixed(2).replace(/^0/, "")}
                        </text>
                      )}
                    </g>
                  )
                })}
                {/* full-row hover target */}
                <rect
                  x={LM}
                  y={TM + i * P}
                  width={n * P}
                  height={P}
                  fill="transparent"
                  onMouseEnter={() => setActiveRow(i)}
                  style={{ cursor: "default" }}
                />
              </g>
            )
          })}

          {/* query axis label */}
          <text x={12} y={TM + (n * P) / 2} textAnchor="middle" transform={`rotate(-90 12 ${TM + (n * P) / 2})`} className="fill-muted-foreground/70 font-mono" fontSize={9}>
            queries ↓
          </text>
        </svg>

        <figcaption className="mt-3 font-mono text-xs text-muted-foreground">
          {caption ?? "hover a query token (row) to see where it attends"}
        </figcaption>
      </div>
    </figure>
  )
}
