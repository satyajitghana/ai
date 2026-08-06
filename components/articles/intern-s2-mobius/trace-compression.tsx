"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Fig. 2 of the model card plots average output length, Mobius vs. the
// Transformer baseline (both continual-pretrained the same way), across six
// reasoning benchmarks. The bar heights are read off a chart and not repeated
// here — but every "Nx shorter" label IS printed directly on the chart, so
// those six multipliers are exact, not estimated. This redraws them as a
// single shrinking bar per benchmark: Transformer is the fixed 100% reference,
// Mobius is 100/N %. Pick a benchmark; the gap in traces is the source of most
// of the throughput advantage in Fig. 1 (fewer tokens to generate and cache).

const ACCENT = "oklch(0.62 0.16 300)"

type Bench = { key: string; label: string; mult: number }

const BENCHES: Bench[] = [
  { key: "avg", label: "Average", mult: 1.5 },
  { key: "mmlu", label: "MMLU Pro", mult: 4.6 },
  { key: "gpqa", label: "GPQA Diamond", mult: 5.0 },
  { key: "imo", label: "IMO Bench", mult: 1.4 },
  { key: "aime", label: "AIME 2026", mult: 1.5 },
  { key: "hmmt", label: "HMMT 2026", mult: 1.2 },
]

const W = 640
const BAR_X = 108
const BAR_W = 480
const BAR_H = 26
const ROW_GAP = 44
const TOP = 18

export function TraceCompression() {
  const [key, setKey] = useState("gpqa")
  const b = BENCHES.find((x) => x.key === key) ?? BENCHES[0]
  const mobiusW = BAR_W / b.mult

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-y-1 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">avg. reasoning-trace length · Mobius vs. Transformer baseline</span>
        <div className="flex flex-wrap gap-1">
          {BENCHES.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setKey(o.key)}
              aria-pressed={key === o.key}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                key === o.key ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={key === o.key ? { background: ACCENT } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} 118`}
          className="w-full"
          role="img"
          aria-label={`On ${b.label}, Intern-S2-Mobius's average reasoning trace is ${b.mult} times shorter than the Transformer baseline's, as labelled in Figure 2 of the model card`}
        >
          {/* Transformer reference bar */}
          <text x={BAR_X - 10} y={TOP + BAR_H / 2 + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10.5}>
            Transformer
          </text>
          <rect x={BAR_X} y={TOP} width={BAR_W} height={BAR_H} rx={5} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <rect x={BAR_X} y={TOP} width={BAR_W} height={BAR_H} rx={5} fill="var(--muted-foreground)" fillOpacity={0.35} />
          <text x={BAR_X + BAR_W - 8} y={TOP + BAR_H / 2 + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            baseline
          </text>

          {/* Mobius bar */}
          <text x={BAR_X - 10} y={TOP + ROW_GAP + BAR_H / 2 + 4} textAnchor="end" className="font-mono" fontSize={10.5} fontWeight={600} fill={ACCENT}>
            Mobius
          </text>
          <rect x={BAR_X} y={TOP + ROW_GAP} width={BAR_W} height={BAR_H} rx={5} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <rect x={BAR_X} y={TOP + ROW_GAP} width={mobiusW} height={BAR_H} rx={5} fill={ACCENT} fillOpacity={0.9} />
          <line x1={BAR_X + BAR_W} y1={TOP + ROW_GAP - 4} x2={BAR_X + BAR_W} y2={TOP + ROW_GAP + BAR_H + 4} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 2" />

          {/* multiplier readout */}
          <text x={BAR_X + BAR_W + 14} y={TOP + ROW_GAP + BAR_H / 2 + 4} className="font-mono" fontSize={13} fontWeight={700} fill={ACCENT}>
            {b.mult}&times; shorter
          </text>
        </svg>

        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          On <span className="text-foreground">{b.label}</span>, Mobius reaches a comparable or better score
          (see the benchmark table below) while emitting a trace{" "}
          <span style={{ color: ACCENT }}>{b.mult}&times; shorter</span>{" "}than the same-size Transformer it&apos;s
          compared against. GPQA Diamond and MMLU Pro compress the most (
          <span className="text-foreground">5.0&times;</span> and{" "}
          <span className="text-foreground">4.6&times;</span>); the three math-competition benchmarks — IMO
          Bench, AIME 2026, HMMT 2026 — compress far less (1.2&ndash;1.5&times;), which is also where Fig. 1&apos;s
          throughput lines stop being one-sided.
        </p>
      </div>
    </figure>
  )
}
