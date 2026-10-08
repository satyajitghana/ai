"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MaxSim on Perplexity's own worked example: the query "quick pasta recipe"
// against a five-token document, with the cosine similarities exactly as the
// launch blog's late-interaction figure prints them. Each query token keeps its
// best document token; the score is the sum of those maxima (2.36 here).
//
// Clicking a document token removes it from the index, which is what a
// skiplist, token pruning or pooling does to a real document: the row maxima
// are recomputed from what is left. Clicking a query token drops it from the
// sum. Arithmetic is +, -, /, max and toFixed only, so SSR and the client agree.

const QUERY = ["quick", "pasta", "recipe"]
const DOC = ["easy", "homemade", "noodle", "dish", "minutes"]
const SIM = [
  [0.78, 0.31, 0.12, 0.18, 0.52],
  [0.15, 0.34, 0.88, 0.61, 0.09],
  [0.29, 0.57, 0.43, 0.7, 0.22],
]

const ACCENT = "oklch(0.55 0.11 200)"

export function MaxSimExplorer() {
  const [docOn, setDocOn] = useState<boolean[]>(DOC.map(() => true))
  const [qOn, setQOn] = useState<boolean[]>(QUERY.map(() => true))

  const keptDocs = docOn.filter(Boolean).length
  const keptQ = qOn.filter(Boolean).length

  const best = SIM.map((row) => {
    let j = -1
    let v = 0
    row.forEach((s, k) => {
      if (docOn[k] && (j < 0 || s > v)) {
        j = k
        v = s
      }
    })
    return { j, v }
  })

  const total = best.reduce((acc, b, i) => (qOn[i] && b.j >= 0 ? acc + b.v : acc), 0)
  const mean = keptQ > 0 ? total / keptQ : 0
  const full = 2.36

  const toggle = (arr: boolean[], i: number) => arr.map((x, k) => (k === i ? !x : x))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">MaxSim, one query against one document</span>
        <span className="font-mono text-[10px] text-muted-foreground">similarities from Perplexity&apos;s figure; click tokens to drop them</span>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <table className="mx-auto border-separate border-spacing-1 font-mono text-[11px]">
          <thead>
            <tr>
              <th className="px-1 text-left text-[10px] font-normal text-muted-foreground">query \ doc</th>
              {DOC.map((d, j) => (
                <th key={d} className="font-normal">
                  <button
                    type="button"
                    onClick={() => setDocOn(toggle(docOn, j))}
                    aria-pressed={docOn[j]}
                    className={cn(
                      "w-[4.6rem] cursor-pointer rounded-md border px-1 py-1 transition-colors",
                      docOn[j] ? "border-foreground/25 text-foreground" : "border-dashed text-muted-foreground line-through opacity-60",
                    )}
                  >
                    {d}
                  </button>
                </th>
              ))}
              <th className="px-1 text-[10px] font-normal text-muted-foreground">best</th>
            </tr>
          </thead>
          <tbody>
            {QUERY.map((q, i) => (
              <tr key={q}>
                <td>
                  <button
                    type="button"
                    onClick={() => setQOn(toggle(qOn, i))}
                    aria-pressed={qOn[i]}
                    className={cn(
                      "w-[4.6rem] cursor-pointer rounded-md border px-1 py-1 transition-colors",
                      qOn[i] ? "border-foreground/25 text-foreground" : "border-dashed text-muted-foreground line-through opacity-60",
                    )}
                  >
                    {q}
                  </button>
                </td>
                {SIM[i].map((s, j) => {
                  const on = docOn[j] && qOn[i]
                  const isBest = on && best[i].j === j
                  return (
                    <td
                      key={j}
                      className={cn(
                        "h-9 rounded-md text-center tabular-nums transition-all",
                        isBest ? "font-semibold text-white" : "text-foreground/80",
                        !on && "opacity-25",
                      )}
                      style={{
                        background: isBest ? ACCENT : `color-mix(in oklch, ${ACCENT} ${(s * 55).toFixed(0)}%, transparent)`,
                        outline: isBest ? "2px solid var(--foreground)" : undefined,
                        outlineOffset: isBest ? "-2px" : undefined,
                      }}
                    >
                      {s.toFixed(2)}
                    </td>
                  )
                })}
                <td className={cn("px-2 text-center tabular-nums", !qOn[i] && "opacity-30")}>
                  {best[i].j >= 0 ? best[i].v.toFixed(2) : "none"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 grid gap-2 font-mono text-[10px] sm:grid-cols-3">
          <Cell label="MaxSim score (sum)" value={total.toFixed(2)} sub={keptDocs === DOC.length && keptQ === QUERY.length ? "the figure's 2.36" : `${(total - full).toFixed(2)} against the full 2.36`} />
          <Cell label="divided by query tokens" value={mean.toFixed(3)} sub="MeanMaxSim, a length-free scale" />
          <Cell
            label="dot products for this pair"
            value={String(keptQ * keptDocs)}
            sub={`${keptQ} x ${keptDocs}, each over 128 numbers; a single vector needs 1`}
          />
        </div>
      </div>

      <p className="px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        Drop &quot;noodle&quot; and &quot;pasta&quot; falls back to &quot;dish&quot; at 0.61, so the score loses 0.27, not
        0.88. Each query token only ever needs one good partner, which is why removing redundant document vectors
        costs less than the vector count suggests, and why removing the one vector that carries a rare fact costs a
        lot.
      </p>
    </figure>
  )
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-foreground">{value}</div>
      <div className="text-[9.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}
