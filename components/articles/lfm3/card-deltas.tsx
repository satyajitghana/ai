"use client"

import { useState } from "react"

import { CARD_COLS, CARD_ROWS } from "./data"

// The model card's own benchmark table, LFM3-1.7B minus a chosen comparison model, one bar per benchmark (reported:
// every score is Liquid's; the subtraction and the counts are ours). Scores are on different scales, so a bar is a
// difference in points, not a percentage.

const WIN = "oklch(0.66 0.14 150)"
const LOSE = "oklch(0.62 0.17 30)"

const COMPARE = [5, 4, 3] as const // Qwen3.5-9B, Qwen3.5-4B, Gemma 4 E4B

export function CardDeltas() {
  const [c, setC] = useState<number>(5)
  const rows = CARD_ROWS.map((r) => ({ name: r.name, a: r.v[0], b: r.v[c], d: r.v[0] - r.v[c] })).sort((x, y) => y.d - x.d)
  const wins = rows.filter((r) => r.d > 0).length
  const losses = rows.filter((r) => r.d < 0).length
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.d)))
  const meanA = CARD_ROWS.reduce((s, r) => s + r.v[0], 0) / CARD_ROWS.length
  const meanB = CARD_ROWS.reduce((s, r) => s + r.v[c], 0) / CARD_ROWS.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">LFM3-1.7B minus … · the model card table, reported</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Comparison model">
          {COMPARE.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setC(k)}
              aria-pressed={c === k}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${c === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {CARD_COLS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="font-mono text-xs">
          {wins} wins, {losses} losses of {rows.length} · mean {meanA.toFixed(2)} against {meanB.toFixed(2)}
        </p>
        <ul className="space-y-1">
          {rows.map((r) => {
            const pct = (Math.abs(r.d) / maxAbs) * 50
            return (
              <li key={r.name} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,15rem)_1fr_4rem]" title={`${r.name}: ${r.a} against ${r.b}`}>
                <span className="truncate">{r.name}</span>
                <span className="relative h-3 rounded-sm bg-muted/40" aria-hidden>
                  <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
                  <span
                    className="absolute inset-y-0 rounded-sm"
                    style={{ background: r.d >= 0 ? WIN : LOSE, left: r.d >= 0 ? "50%" : `${50 - pct}%`, width: `${pct}%` }}
                  />
                </span>
                <span className="text-right font-mono">{r.d > 0 ? "+" : r.d < 0 ? "−" : ""}{Math.abs(r.d).toFixed(1)}</span>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Hover a row for the two scores. The card Average row is the unweighted mean of every score in its table, which is what the first number above recomputes.
        </p>
      </div>
    </figure>
  )
}
