"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { LEANN, N_CHUNKS } from "./data"

// One cell per chunk in the 20,000-chunk corpus (200 x 100). The lit cells are the chunks whose embedding a single
// query had to produce: the measured mean number of texts LEANN sent to the embedding server per query at that
// search-queue length (efSearch / "complexity"). Which cells light is a seeded shuffle, because a real query's
// visited set depends on the query; only the COUNT is measured.

const COLS = 200
const ROWS = N_CHUNKS / COLS

function order(n: number): number[] {
  // deterministic Fisher-Yates with an integer LCG: no Math.* calls that could differ between server and client
  const a = Array.from({ length: n }, (_, i) => i)
  let s = 12345
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    const j = s % (i + 1)
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}
const ORDER = order(N_CHUNKS)

export function TouchMap() {
  const [k, setK] = useState(1)
  const row = LEANN[k]
  const lit = Math.round(row.texts)
  const cells: React.ReactNode[] = []
  const on = new Set(ORDER.slice(0, lit))
  for (let i = 0; i < N_CHUNKS; i++) {
    const x = i % COLS
    const y = Math.floor(i / COLS)
    cells.push(<rect key={i} x={x} y={y} width={1} height={1} fill={on.has(i) ? "var(--leann-hot)" : "var(--leann-cold)"} />)
  }
  return (
    <figure className="not-prose my-8 rounded-lg border bg-card p-4 text-card-foreground" style={{ ["--leann-hot" as string]: "oklch(0.62 0.17 35)", ["--leann-cold" as string]: "oklch(0.5 0.01 250 / 0.22)" }}>
      <div className="mb-3 flex items-center gap-3 text-xs">
        <span className="w-44 shrink-0 font-mono text-muted-foreground">search queue (efSearch)</span>
        <Range min={0} max={LEANN.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Search queue length index" className="w-full" />
        <span className="w-12 text-right font-mono tabular-nums">{row.ef}</span>
      </div>
      <svg viewBox={`0 0 ${COLS} ${ROWS}`} className="w-full rounded border" role="img" aria-label={`A grid of ${N_CHUNKS} chunks, ${lit} lit: the chunks LEANN embedded for one query at efSearch ${row.ef}`} shapeRendering="crispEdges">
        {cells}
      </svg>
      <figcaption className="mt-3 grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
        <span>
          <b className="text-foreground">{lit.toLocaleString("en-US")}</b> chunks embedded ({((lit / N_CHUNKS) * 100).toFixed(1)}% of the corpus)
        </span>
        <span>
          recall@10 <b className="text-foreground">{row.recall.toFixed(2)}</b> ({row.n} queries)
        </span>
        <span>
          <b className="text-foreground">{row.sec.toFixed(1)} s</b> per query on 2 CPU threads
        </span>
        <span>
          {row.rounds.toFixed(0)} round trips to the embedder
        </span>
      </figcaption>
    </figure>
  )
}
