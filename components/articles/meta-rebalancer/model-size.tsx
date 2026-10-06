"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How big each representation of the same problem gets.
//   MIP, one binary per (object, bin):          |O| x |B|
//   MIP, one integer per (equivalence set, bin): |K| x |B|   (LPStore.cpp)
//   expression graph, shared object vectors:     ~ |O| + |B| (OSDI'24, section 4.2)
// The problem sizes are the ones Meta published; the equivalence-set slider is
// a dial, because no published number says how many sets a production problem
// collapses to. Only + and * are used, so the text is SSR-stable.

type Preset = { name: string; o: number; b: number; src: string }

const PRESETS: Preset[] = [
  { name: "blog P99 problem", o: 265_000, b: 3_200, src: "engineering blog" },
  { name: "service placement", o: 700_000, b: 5_700, src: "paper, Table 3" },
  { name: "largest sharding", o: 1_800_000, b: 27_000, src: "paper, §3.3" },
  { name: "Kubernetes 100k nodes", o: 5_000, b: 100_000, src: "paper, §6.1" },
]

const fmt = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)} billion`
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)} thousand`
  return String(n)
}

// slider 0..100 -> share of objects that stay distinct after dedup (0.1% .. 100%)
const SHARES = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]

export function ModelSize() {
  const [p, setP] = useState(0)
  const [sh, setSh] = useState(6)
  const { o, b } = PRESETS[p]
  const k = Math.max(1, Math.round(o * SHARES[sh]))
  const rows = [
    { label: "MIP, binary per object × bin", v: o * b },
    { label: "MIP, integer per equivalence set × bin", v: k * b },
    { label: "expression graph leaves, objects + bins", v: o + b },
  ]
  const max = rows[0].v
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one problem, three representations</span>
        <span className="text-muted-foreground/50">sizes: {PRESETS[p].src}</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((q, qi) => (
            <button
              key={q.name}
              type="button"
              aria-pressed={qi === p}
              onClick={() => setP(qi)}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                qi === p ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {q.name}
            </button>
          ))}
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {fmt(o)} objects × {fmt(b)} bins
        </div>
        <div className="mt-3 space-y-2.5">
          {rows.map((r) => {
            // log-ish bar: digits of the count, so a 10^9 bar is visibly longer than 10^6
            const digits = String(Math.round(r.v)).length
            const maxDigits = String(Math.round(max)).length
            const w = Math.max(4, (digits / maxDigits) * 100)
            return (
              <div key={r.label}>
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{r.label}</span>
                  <span className="text-foreground">{fmt(r.v)}</span>
                </div>
                <div className="mt-1 h-2.5 rounded bg-muted">
                  <div className="h-2.5 rounded" style={{ width: `${w}%`, background: "oklch(0.62 0.15 250)" }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">distinct objects</span>
          <Range min={0} max={SHARES.length - 1} value={sh} onChange={(e) => setSh(Number(e.target.value))} aria-label="share of objects left distinct after equivalence dedup" />
          <span className="w-14 shrink-0 text-right font-mono text-[10px]">{SHARES[sh] * 100}%</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Bars are drawn on a digit scale. Aggregating identical objects into one integer variable
          per bin shrinks the MIP by exactly the dedup ratio, but it is still a product with the bin
          count; the graph grows with the sum. The dedup share is a dial: nobody has published what a
          production problem collapses to.
        </p>
      </div>
    </figure>
  )
}
