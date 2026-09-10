"use client"

import { useState } from "react"

// Every number here is Table 1 of the paper (per-pair transfer retention at
// the selected k, ridge, content-space mapping, six matched-KV pairs across
// three families) plus its five per-benchmark columns (ARC-Challenge,
// HellaSwag, WinoGrande, MMLU, GSM8K). "Avg" is the plain mean of retention
// (transfer accuracy / target standalone accuracy) across the five
// benchmarks; "Avg (floor-normalized)" is (acc - chance) / (target - chance)
// per benchmark, then averaged -- it places each benchmark's chance floor at
// 0% and the target's own standalone accuracy at 100%, which is why the two
// failure pairs move so much more under it than the four successes do: a
// pair that's merely "worse than standalone" looks very different from a
// pair that's "barely better than guessing," and raw retention conflates
// the two while floor-normalization does not.
//
// The five small diamonds on each bar are that pair's own five per-benchmark
// retention values (same metric as the bar), so a reader can see how much a
// single weak benchmark (GSM8K, almost everywhere) drags the average down --
// without that, "72.8% avg" reads as uniform when it is actually 87-94% on
// four benchmarks and 18.2% on one.
//
// avgFn (floor-normalized) per benchmark is not published per-cell in the
// paper's main table -- it is derived here from Table 13's standalone and
// transfer accuracies via the paper's own formula, (acc - chance) / (target -
// chance), chance = {ARC-C 25, HellaSwag 25, WinoGrande 50, MMLU 25, GSM8K 0}.
// Averaging these five per-pair reproduces Table 1's published Avg_fn to one
// decimal place for all six pairs (e.g. 96.3, 80.7, 65.9, 62.9, 14.7, 11.1),
// which is the check that the derivation is right.

type Metric = "avg" | "avgFn"

type Pair = {
  family: string
  pair: string
  k: string
  tier: 1 | 2
  avg: number
  avgFn: number
  bench: { name: string; avg: number; avgFn: number }[]
}

const PAIRS: Pair[] = [
  {
    family: "Qwen3",
    pair: "14B → 32B",
    k: "8",
    tier: 1 as const,
    avg: 97.6,
    avgFn: 96.3,
    bench: [
      { name: "ARC-C", avg: 101.0, avgFn: 101.6 },
      { name: "HellaSwag", avg: 97.6, avgFn: 96.6 },
      { name: "WinoGrande", avg: 98.5, avgFn: 94.9 },
      { name: "MMLU", avg: 95.0, avgFn: 92.9 },
      { name: "GSM8K", avg: 95.6, avgFn: 95.6 },
    ],
  },
  {
    family: "Qwen3",
    pair: "8B → 32B",
    k: "12",
    tier: 1 as const,
    avg: 87.5,
    avgFn: 80.7,
    bench: [
      { name: "ARC-C", avg: 94.0, avgFn: 89.8 },
      { name: "HellaSwag", avg: 95.2, avgFn: 93.1 },
      { name: "WinoGrande", avg: 91.0, avgFn: 68.4 },
      { name: "MMLU", avg: 88.5, avgFn: 83.5 },
      { name: "GSM8K", avg: 68.8, avgFn: 68.8 },
    ],
  },
  {
    family: "Ministral 3",
    pair: "3B → 8B",
    k: "all",
    tier: 1 as const,
    avg: 76.2,
    avgFn: 65.9,
    bench: [
      { name: "ARC-C", avg: 90.6, avgFn: 83.8 },
      { name: "HellaSwag", avg: 93.3, avgFn: 90.1 },
      { name: "WinoGrande", avg: 91.3, avgFn: 65.7 },
      { name: "MMLU", avg: 69.4, avgFn: 53.4 },
      { name: "GSM8K", avg: 36.6, avgFn: 36.6 },
    ],
  },
  {
    family: "Llama 3.1",
    pair: "8B → 70B",
    k: "20",
    tier: 1 as const,
    avg: 72.8,
    avgFn: 62.9,
    bench: [
      { name: "ARC-C", avg: 90.9, avgFn: 84.7 },
      { name: "HellaSwag", avg: 94.4, avgFn: 92.1 },
      { name: "WinoGrande", avg: 87.1, avgFn: 58.5 },
      { name: "MMLU", avg: 73.3, avgFn: 60.9 },
      { name: "GSM8K", avg: 18.2, avgFn: 18.2 },
    ],
  },
  {
    family: "Ministral 3",
    pair: "3B → 14B",
    k: "20",
    tier: 2 as const,
    avg: 44.2,
    avgFn: 14.7,
    bench: [
      { name: "ARC-C", avg: 43.6, avgFn: 9.5 },
      { name: "HellaSwag", avg: 68.0, avgFn: 53.2 },
      { name: "WinoGrande", avg: 74.0, avgFn: 8.2 },
      { name: "MMLU", avg: 32.0, avgFn: -0.5 },
      { name: "GSM8K", avg: 3.2, avgFn: 3.2 },
    ],
  },
  {
    family: "Ministral 3",
    pair: "8B → 14B",
    k: "12",
    tier: 2 as const,
    avg: 41.6,
    avgFn: 11.1,
    bench: [
      { name: "ARC-C", avg: 40.7, avgFn: 4.8 },
      { name: "HellaSwag", avg: 58.7, avgFn: 39.6 },
      { name: "WinoGrande", avg: 74.2, avgFn: 9.0 },
      { name: "MMLU", avg: 32.7, avgFn: 0.5 },
      { name: "GSM8K", avg: 1.6, avgFn: 1.6 },
    ],
  },
].sort((a, b) => b.avg - a.avg)

const TIER1 = "oklch(0.55 0.16 155)"
const TIER2 = "oklch(0.62 0.19 25)"

const W = 720
const PL = 152
const PR = 44
const ROW_H = 40
const H_PAD = 14

function fmt(n: number) {
  return `${n.toFixed(1)}%`
}

export function RetentionChart() {
  const [metric, setMetric] = useState<Metric>("avg")

  const H = PAIRS.length * ROW_H + H_PAD * 2 + 22
  const plotW = W - PL - PR
  const x = (v: number) => PL + (Math.max(0, Math.min(120, v)) / 120) * plotW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          per-pair transfer retention &middot; ridge, content-space (paper, Table 1)
        </span>
        <div className="flex gap-1.5">
          {(
            [
              ["avg", "retention"],
              ["avgFn", "floor-normalized"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors " +
                (metric === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="min-w-[600px] max-w-full"
            role="img"
            aria-label={`Per-pair ${metric === "avg" ? "retention" : "floor-normalized retention"}: four pairs (Qwen3 14B to 32B 97.6%, Qwen3 8B to 32B 87.5%, Ministral 3 3B to 8B 76.2%, Llama 3.1 8B to 70B 72.8%) retain most of standalone accuracy; two pairs (Ministral 3 3B to 14B 44.2%, Ministral 3 8B to 14B 41.6%) collapse, and fall to 11-15% once floor-normalized.`}
          >
            {[0, 25, 50, 75, 100].map((g) => (
              <g key={g}>
                <line
                  x1={x(g)}
                  x2={x(g)}
                  y1={H_PAD - 4}
                  y2={H - 24}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth={1}
                  strokeDasharray={g === 0 ? undefined : "2 3"}
                />
                <text x={x(g)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                  {g}%
                </text>
              </g>
            ))}
            <text x={x(120)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              &nbsp;
            </text>

            {PAIRS.map((p, i) => {
              const y0 = H_PAD + i * ROW_H
              const cy = y0 + ROW_H / 2 - 6
              const val = metric === "avg" ? p.avg : p.avgFn
              const color = p.tier === 1 ? TIER1 : TIER2
              const barX0 = x(0)
              const barX1 = x(val)
              // Benchmark diamonds can sit past the bar's own end (a single
              // benchmark can score above the pair's average) -- place the
              // value label past whichever is rightmost so it never collides
              // with a diamond.
              const rightmostX = Math.max(barX1, ...p.bench.map((b) => x(metric === "avg" ? b.avg : b.avgFn)))
              return (
                <g key={p.pair}>
                  <text x={PL - 10} y={cy - 3} textAnchor="end" className="fill-foreground font-mono" fontSize={10.5}>
                    {p.pair}
                  </text>
                  <text x={PL - 10} y={cy + 9} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
                    {p.family} &middot; k={p.k}
                  </text>

                  <rect x={barX0} y={y0 + 2} width={Math.max(0, barX1 - barX0)} height={16} rx={3} fill={color} fillOpacity={0.85} />
                  <text x={rightmostX + 8} y={y0 + 14} className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
                    {fmt(val)}
                  </text>

                  {p.bench.map((b) => {
                    const bv = metric === "avg" ? b.avg : b.avgFn
                    const bx = x(bv)
                    // No <title> here on purpose: React 19 treats <title> as
                    // hoistable document metadata and lifts it out of the SVG
                    // regardless of namespace, which SSRs as empty and then
                    // fails to hydrate against the client's non-empty render.
                    // The per-benchmark values are already in the aria-label
                    // above and the full table below, so nothing is lost.
                    return (
                      <g
                        key={b.name}
                        transform={`translate(${bx} ${y0 + 10})`}
                        aria-label={`${p.pair} ${b.name}: ${fmt(bv)}`}
                      >
                        <rect
                          x={-3}
                          y={-3}
                          width={6}
                          height={6}
                          rx={1}
                          transform="rotate(45)"
                          fill="var(--background)"
                          stroke={color}
                          strokeWidth={1.3}
                        />
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TIER1 }} /> 4 pairs retain most of standalone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TIER2 }} /> 2 pairs collapse
          </span>
          <span className="flex items-center gap-1.5">
            <svg width={8} height={8} viewBox="-4 -4 8 8" aria-hidden="true">
              <rect x={-3} y={-3} width={6} height={6} rx={1} transform="rotate(45)" fill="var(--background)" stroke="currentColor" strokeWidth={1.3} />
            </svg>
            one diamond per benchmark (ARC-C, HellaSwag, WinoGrande, MMLU, GSM8K)
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {metric === "avg" ? (
            <>
              Four of six matched-KV pairs land in the 73–98% band the abstract leads with;{" "}
              <span style={{ color: TIER1 }}>Qwen3 14B → 32B</span> is close enough to standalone that its ARC-C
              column even edges past 100% (noise, not the mapper beating the target&rsquo;s own cache). The two{" "}
              <span style={{ color: TIER2 }}>Ministral pairs targeting 14B</span> sit apart, near 42–44% — and every
              pair&rsquo;s diamonds show GSM8K pulling hardest below the bar, worst on Llama 3.1 8B → 70B (18.2%) and
              near-total collapse on both Ministral 14B targets (1.6–3.2%).
            </>
          ) : (
            <>
              Floor-normalizing (chance at 0%, target&rsquo;s own accuracy at 100%) barely moves the four successes —{" "}
              <span style={{ color: TIER1 }}>Qwen3 14B → 32B</span> stays at 96.3% — but it is much less forgiving of
              the two failures: <span style={{ color: TIER2 }}>44.2% and 41.6% raw retention</span> become{" "}
              <span style={{ color: TIER2 }}>14.7% and 11.1%</span>. That gap between the two metrics is the paper&rsquo;s
              own point about them: raw retention can flatter a pair that is only barely above the chance floor it
              claims to beat.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
