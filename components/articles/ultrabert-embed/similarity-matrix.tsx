"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { SIM } from "./measured"

// A 6 x 6 cosine matrix I measured on CPU: six questions against six passages,
// each passage written to answer exactly one question. Toggle the query-side
// instruction to see what it does to the off-diagonal cells.

type Mode = "instructed" | "raw"

function cellColor(v: number) {
  // 0 → transparent, 0.8 → strong; negatives stay transparent
  const a = Math.max(0, Math.min(1, v / 0.8))
  return `oklch(0.62 0.15 255 / ${(a * 0.9).toFixed(3)})`
}

function stats(S: readonly (readonly number[])[]) {
  let diag = 0
  let off = 0
  let top1 = 0
  let minMargin = Infinity
  for (let i = 0; i < S.length; i++) {
    let best = -Infinity
    for (let j = 0; j < S.length; j++) {
      if (i === j) diag += S[i][j]
      else {
        off += S[i][j]
        best = Math.max(best, S[i][j])
      }
    }
    if (S[i][i] > best) top1 += 1
    minMargin = Math.min(minMargin, S[i][i] - best)
  }
  const n = S.length
  return { diag: diag / n, off: off / (n * (n - 1)), top1, minMargin }
}

export function SimilarityMatrix() {
  const [mode, setMode] = useState<Mode>("instructed")
  const [hover, setHover] = useState<[number, number] | null>(null)
  const S = mode === "instructed" ? SIM.sim_instructed : SIM.sim_raw
  const st = stats(S)
  const [hi, hj] = hover ?? [-1, -1]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">cosine(query, passage), 768-d, CLS pooled</span>
        <span className="font-mono text-[10px] text-muted-foreground">measured on CPU, float32</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Query encoding">
          {(["instructed", "raw"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                mode === m ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "instructed" ? "queries with Instruct: … Query:" : "queries bare"}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-separate border-spacing-[2px] font-mono text-[10px]">
            <thead>
              <tr>
                <th className="w-24 text-left font-normal text-muted-foreground">query ↓ passage →</th>
                {SIM.labels.map((l, j) => (
                  <th key={l} className={cn("px-1 text-center font-normal", j === hj ? "text-foreground" : "text-muted-foreground")}>
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {S.map((row, i) => (
                <tr key={SIM.labels[i]}>
                  <th className={cn("pr-1 text-left font-normal", i === hi ? "text-foreground" : "text-muted-foreground")}>{SIM.labels[i]}</th>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      onMouseEnter={() => setHover([i, j])}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover([i, j])}
                      tabIndex={0}
                      className={cn("h-8 min-w-10 rounded-[3px] text-center tabular-nums", i === j && "ring-1 ring-foreground/40")}
                      style={{ background: cellColor(v) }}
                    >
                      {v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 min-h-10 font-mono text-[10px] leading-4 text-muted-foreground">
          {hover ? (
            <>
              <div>Q: {SIM.queries[hi]}</div>
              <div>P: {SIM.docs[hj]}</div>
            </>
          ) : (
            <div>hover or focus a cell to read the pair</div>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] sm:grid-cols-4">
          <Cell label="top-1 correct" value={`${st.top1} / 6`} />
          <Cell label="mean, diagonal" value={st.diag.toFixed(3)} />
          <Cell label="mean, off-diagonal" value={st.off.toFixed(3)} />
          <Cell label="smallest margin" value={st.minMargin.toFixed(3)} />
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        Both ways, every query ranks its own passage first. What the instruction changes is the
        floor: bare queries sit at about 0.13 against passages they have nothing to do with, and
        instructed ones at about 0.05. The right passages drop a little too, from 0.59 to 0.52 on
        average, so the instruction is not making matches stronger. It is pushing everything else
        toward zero. Six pairs is a sanity check, not a benchmark.
      </p>
    </figure>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-foreground">{value}</div>
    </div>
  )
}
