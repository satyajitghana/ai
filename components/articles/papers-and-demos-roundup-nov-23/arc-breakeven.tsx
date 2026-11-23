"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// CPU-ARC's cost columns, from Table 2 of arXiv 2611.09891 (dollars per sample at
// March 2026 retail rates; source and builder are Claude Opus 4.5, the cache is the
// fine-tuned Llama 3.2 1B priced at $0.023/M in and $0.194/M out). "comb" is the
// combined-perturbation pass rate, measured only on items the cache already got right.
// The break-even is the paper's own formula, B / (S - C), rounded up. With misses on,
// a miss pays for the cache attempt and then for the source model: B / (S - C - m*S).

type Row = { id: string; name: string; S: number; B: number; C: number; comb: number }

const ROWS: Row[] = [
  { id: "aime25", name: "AIME '25", S: 0.1203, B: 1.4517, C: 0.0004, comb: 93.4 },
  { id: "aime24", name: "AIME '24", S: 0.1101, B: 1.4198, C: 0.0004, comb: 95.1 },
  { id: "gpqa", name: "GPQA Diamond", S: 0.0708, B: 1.7781, C: 0.0019, comb: 94.0 },
  { id: "math", name: "MATH-500", S: 0.0388, B: 1.1818, C: 0.0004, comb: 91.6 },
  { id: "mmlu", name: "MMLU-Pro", S: 0.0345, B: 1.4084, C: 0.0015, comb: 91.9 },
  { id: "gsm", name: "GSM8K", S: 0.0101, B: 0.8481, C: 0.0006, comb: 92.5 },
]

const W = 560
const H = 220
const PAD = { l: 44, r: 12, t: 12, b: 28 }

export function ArcBreakeven() {
  const [id, setId] = useState("aime25")
  const [n, setN] = useState(60)
  const [misses, setMisses] = useState(false)
  const r = ROWS.find((x) => x.id === id) ?? ROWS[0]

  const m = misses ? (100 - r.comb) / 100 : 0
  const perQuery = r.C + m * r.S
  const saving = r.S - perQuery
  const breakeven = saving > 0 ? Math.ceil(r.B / saving) : Infinity

  const maxN = 200
  const src = (k: number) => k * r.S
  const arc = (k: number) => r.B + k * perQuery
  const yMax = Math.max(src(maxN), arc(maxN)) * 1.05
  const x = (k: number) => PAD.l + (k / maxN) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
  const yTicks = [0, yMax / 3, (2 * yMax) / 3].map((v) => Math.round(v * 10) / 10)

  const srcN = src(n)
  const arcN = arc(n)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        {ROWS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setId(row.id)}
            className={`rounded-md px-2 py-1 ${row.id === id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            {row.name}
          </button>
        ))}
      </div>
      <div className="px-4 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Cumulative cost of ${r.name} queries with and without a reasoning cache`}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>
                ${v.toFixed(1)}
              </text>
            </g>
          ))}
          {[0, 50, 100, 150, 200].map((k) => (
            <text key={k} x={x(k)} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>
              {k}
            </text>
          ))}
          <line x1={x(0)} y1={y(src(0))} x2={x(maxN)} y2={y(src(maxN))} stroke="oklch(0.62 0.03 250)" strokeWidth={2} />
          <line x1={x(0)} y1={y(arc(0))} x2={x(maxN)} y2={y(arc(maxN))} stroke="oklch(0.64 0.15 35)" strokeWidth={2.5} />
          {breakeven <= maxN && (
            <g>
              <line x1={x(breakeven)} x2={x(breakeven)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeDasharray="3 3" strokeOpacity={0.4} />
              <text x={x(breakeven) + 4} y={PAD.t + 10} fontSize={10} fill="currentColor" opacity={0.75}>
                break-even: {breakeven}
              </text>
            </g>
          )}
          <line x1={x(n)} x2={x(n)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.25} />
          <circle cx={x(n)} cy={y(srcN)} r={3.5} fill="oklch(0.62 0.03 250)" />
          <circle cx={x(n)} cy={y(arcN)} r={3.5} fill="oklch(0.64 0.15 35)" />
        </svg>
      </div>
      <div className="grid gap-3 px-4 pb-4 pt-1 text-[13px] sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="flex items-center gap-3">
          <span className="w-36 shrink-0 font-mono text-[11px] text-muted-foreground">{n} similar queries</span>
          <Range min={1} max={maxN} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of queries" />
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input type="checkbox" checked={misses} onChange={(e) => setMisses(e.target.checked)} />
          count misses ({(100 - r.comb).toFixed(1)}% fall through)
        </label>
      </div>
      <figcaption className="border-t px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        <span style={{ color: "oklch(0.62 0.03 250)" }}>Grey</span>: Opus 4.5 answers every query, ${r.S.toFixed(4)} each.{" "}
        <span style={{ color: "oklch(0.64 0.15 35)" }}>Orange</span>: build the cache once for ${r.B.toFixed(4)}, then ${perQuery.toFixed(4)} a query. At {n} queries
        that is ${srcN.toFixed(2)} against ${arcN.toFixed(2)}; the cache pays for itself after{" "}
        {Number.isFinite(breakeven) ? breakeven : "never"} queries of the same kind. Costs from the paper's Table 2. The miss rate is the combined-rewrite failure rate, measured only on
        problems the cache already solved, so the real one is higher.
      </figcaption>
    </figure>
  )
}
