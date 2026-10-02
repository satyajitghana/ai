"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Query-aware vs query-agnostic KV eviction, on one toy context.
//
// The point the paper makes (KVzip, Figure 2 and Figure 9; SnapKV/H2O as the
// query-aware baselines): a cache compressed for the FIRST query keeps the KV
// pairs that query attends to, and then under-serves every later query. A cache
// compressed query-agnostically keeps a backbone broad enough for any query, so
// it can be compressed ONCE and reused.
//
// Everything here is synthetic and the numbers it prints are not the paper's.
//   - 48 context tokens, three queries. Each query q "needs" a cluster of
//     tokens around a centre plus a few scattered retrieval needles; rel[q][i]
//     in [0,1] is how much query q attends to token i.
//   - Query-AGNOSTIC score (KVzip's reconstruction score, modelled): a small
//     structural term plus the max over queries of rel[q][i] — i.e. it tracks
//     what ANY plausible query attends to, which is what reconstructing the
//     whole context demands. Plus noise, so it is not a perfect oracle.
//   - Query-AWARE score (SnapKV-style, reused): rel of the first query only.
//     The cache is calibrated on Q1 and then reused for whichever query is live.
//   - Keep the top floor(N/factor) tokens by the chosen score. "Mass kept" for
//     the live query is the share of that query's attention that lands on kept
//     tokens: sum over kept of rel[q][i] divided by the total. Exact arithmetic.
//
// Deterministic: mulberry32 is integer math and there are no transcendental
// calls, so SSR and hydration serialize identically.

const N = 48
const COLS = 8
const ROWS = N / COLS
const QN = 3
const CENTERS = [9, 24, 39]
const WIDTH = 7
const QLABEL = ["Q1 · the signing date", "Q2 · the warranty clause", "Q3 · the payment terms"]
const QSHORT = ["Q1", "Q2", "Q3"]

function mulberry32(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Data = { rel: number[][]; recon: number[]; total: number[] }
let DATA: Data | null = null

function build(): Data {
  if (DATA) return DATA
  const rnd = mulberry32(42)
  const rel: number[][] = Array.from({ length: QN }, () => new Array<number>(N).fill(0))
  for (let q = 0; q < QN; q++) {
    const c = CENTERS[q]
    for (let i = 0; i < N; i++) {
      const bump = Math.max(0, 1 - Math.abs(i - c) / WIDTH)
      rel[q][i] = bump
    }
    // scattered retrieval needles far from the centre
    for (let k = 0; k < 3; k++) {
      const j = Math.floor(rnd() * N)
      if (Math.abs(j - c) > WIDTH) rel[q][j] = Math.max(rel[q][j], 0.72 + 0.28 * rnd())
    }
    for (let i = 0; i < N; i++) rel[q][i] = Math.min(1, rel[q][i] + 0.04 * rnd())
  }
  // query-agnostic reconstruction score: structural floor + max over queries + noise
  const recon = new Array<number>(N)
  for (let i = 0; i < N; i++) {
    let mx = 0
    for (let q = 0; q < QN; q++) mx = Math.max(mx, rel[q][i])
    recon[i] = 0.1 + mx + 0.06 * rnd()
  }
  const total = rel.map((r) => r.reduce((a, b) => a + b, 0))
  DATA = { rel, recon, total }
  return DATA
}

function keptSet(scores: number[], keep: number): boolean[] {
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  const kept = new Array<boolean>(N).fill(false)
  for (let k = 0; k < keep; k++) kept[order[k][1]] = true
  return kept
}

const KEPT = "oklch(0.72 0.19 150)" // neon green
const MISS = "oklch(0.68 0.21 25)" // hot red
const FACTORS = [1, 1.5, 2, 2.5, 3, 3.5, 4]

export function KVEvictToy() {
  const [fi, setFi] = useState(4) // index into FACTORS -> 3x
  const [agnostic, setAgnostic] = useState(true)
  const [q, setQ] = useState(1)

  const { rel, recon, total } = build()
  const factor = FACTORS[fi]
  const keep = Math.max(1, Math.round(N / factor))

  const { kept, massKept, missCount } = useMemo(() => {
    const scores = agnostic ? recon : rel[0]
    const kept = keptSet(scores, keep)
    let m = 0
    let miss = 0
    for (let i = 0; i < N; i++) {
      if (kept[i]) m += rel[q][i]
      else if (rel[q][i] > 0.5) miss++
    }
    return { kept, massKept: m / total[q], missCount: miss }
  }, [agnostic, keep, q, rel, recon, total])

  const pct = (v: number) => `${Math.round(v * 100)}%`
  const cellW = 40
  const gap = 5
  const gw = COLS * cellW + (COLS - 1) * gap
  const gh = ROWS * cellW + (ROWS - 1) * gap

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one compressed cache, three queries · keep the top-scoring KV pairs
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAgnostic(false)}
            aria-pressed={!agnostic}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
              !agnostic
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            query-aware
          </button>
          <button
            type="button"
            onClick={() => setAgnostic(true)}
            aria-pressed={agnostic}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
              agnostic
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            query-agnostic
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
            <span>compression</span>
            <Range
              min={0}
              max={FACTORS.length - 1}
              step={1}
              value={fi}
              onChange={(e) => setFi(Number(e.target.value))}
              aria-label="Compression factor"
              accent={KEPT}
              className="w-40"
            />
            <span className="text-foreground tabular-nums">{factor.toFixed(1)}x smaller</span>
          </label>
          <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <span>asking</span>
            {QSHORT.map((n, qi) => (
              <button
                key={n}
                type="button"
                onClick={() => setQ(qi)}
                aria-pressed={q === qi}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
                  q === qi
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-transparent hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <svg
            viewBox={`0 0 ${gw} ${gh}`}
            className="w-full max-w-[360px]"
            role="img"
            aria-label={`A 48-token context cache. Compressed ${factor.toFixed(1)} times, ${agnostic ? "query-agnostically" : "query-aware, calibrated on Q1"}, keeping ${keep} of 48 pairs. Asking ${QSHORT[q]}: ${pct(massKept)} of its attention mass lands on kept pairs, with ${missCount} needed pairs evicted.`}
          >
            {Array.from({ length: N }, (_, i) => {
              const r = Math.floor(i / COLS)
              const col = i % COLS
              const x = col * (cellW + gap)
              const y = r * (cellW + gap)
              const want = rel[q][i]
              const isKept = kept[i]
              const needed = want > 0.5
              const base = isKept ? 0.18 + 0.72 * want : 0.05 + 0.12 * want
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={cellW}
                    height={cellW}
                    rx={5}
                    fill={KEPT}
                    fillOpacity={isKept ? base : 0.04}
                    stroke={needed && !isKept ? MISS : isKept ? KEPT : "currentColor"}
                    strokeOpacity={needed && !isKept ? 0.95 : isKept ? 0.5 : 0.14}
                    strokeWidth={needed && !isKept ? 2 : 1}
                  />
                  {isKept ? (
                    <rect x={x} y={y} width={cellW} height={cellW} rx={5} fill={KEPT} fillOpacity={base} />
                  ) : null}
                </g>
              )
            })}
          </svg>

          <div className="font-mono text-xs">
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground">cache kept</span>
              <span className="text-foreground tabular-nums">
                {keep}/{N} ({pct(keep / N)})
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-muted-foreground">attention mass kept for {QSHORT[q]}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: pct(massKept), background: massKept > 0.8 ? KEPT : MISS }}
                />
              </div>
              <span
                className="w-10 text-right tabular-nums"
                style={{ color: massKept > 0.8 ? KEPT : MISS }}
              >
                {pct(massKept)}
              </span>
            </div>
            <p className="mt-3 leading-5 text-muted-foreground">
              {missCount === 0 ? (
                <>Every pair {QSHORT[q]} needs survived the eviction.</>
              ) : (
                <>
                  <span style={{ color: MISS }}>{missCount}</span> pair{missCount === 1 ? "" : "s"}{" "}
                  {QSHORT[q]} needs {missCount === 1 ? "was" : "were"} evicted (red outline).
                </>
              )}
            </p>
            <p className="mt-2 leading-5 text-muted-foreground/80">{QLABEL[q]}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          In <span className="text-foreground">query-aware</span> mode the cache is compressed once using
          Q1&apos;s attention, then reused. Q1 stays sharp; switch to Q2 or Q3 and watch its tokens turn
          red — they were evicted because the first query never looked at them. In{" "}
          <span className="text-foreground">query-agnostic</span> mode the same budget keeps the backbone
          every query draws on, so all three hold up until the compression gets aggressive. That gap is the
          whole argument for compressing once and reusing.
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
          Illustrative: synthetic 48-token context, three queries. The query-agnostic score models KVzip&apos;s
          reconstruction score as &ldquo;what any query attends to&rdquo;; the percentages are the toy&apos;s,
          not the paper&apos;s.
        </p>
      </div>
    </figure>
  )
}
