"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Interactive attention-weights heatmap for transformer explainers.
// Hover/focus a query token (row) to highlight where it attends.
// SSR renders the full matrix (weights as cell opacity) — meaningful without JS.
// Weights: rows = query tokens, cols = key tokens, values 0..1. If omitted, a
// deterministic toy pattern (diagonal + previous-token) is used.
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

  return (
    <figure className="my-8 overflow-x-auto">
      <table className="border-separate border-spacing-1 font-mono text-xs">
        <thead>
          <tr>
            <th aria-hidden className="p-1" />
            {tokens.map((t, j) => (
              <th key={j} scope="col" className="p-1 font-normal text-muted-foreground">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody onMouseLeave={() => setActiveRow(null)}>
          {tokens.map((t, i) => (
            <tr key={i}>
              <th
                scope="row"
                tabIndex={0}
                onMouseEnter={() => setActiveRow(i)}
                onFocus={() => setActiveRow(i)}
                className={cn(
                  "cursor-default p-1 pr-2 text-right font-normal transition-colors",
                  activeRow === i ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {t}
              </th>
              {w[i].map((v, j) => (
                <td
                  key={j}
                  className={cn(
                    "size-9 rounded-[3px] text-center align-middle transition-opacity",
                    activeRow !== null && activeRow !== i && "opacity-25"
                  )}
                  style={{
                    backgroundColor: `color-mix(in oklch, var(--foreground) ${Math.round(
                      Math.min(1, Math.max(0, v)) * 85
                    )}%, var(--background))`,
                    color:
                      v > 0.4 ? "var(--background)" : "var(--muted-foreground)",
                  }}
                >
                  {activeRow === i ? v.toFixed(2).replace(/^0/, "") : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="mt-2 font-mono text-xs text-muted-foreground">
        {caption ??
          "attention weights — hover a query token (row) to see where it attends"}
      </figcaption>
    </figure>
  )
}
