"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 1 of the technical report, which is the cleanest thing in it.
//
// Three checkpoints, identical apart from what the token-mixing layers do: a
// full-attention Transformer, a sliding-window hybrid, and a Gated DeltaNet
// hybrid. Both hybrids put one full-attention layer in every four; the SWA one
// uses a window of 128 in the other three. Each is a 28-layer 25B-A3B MoE
// pretrained on 400B tokens at 4K context, then 80B at 32K, and all three run
// through the same evaluation pipeline.
//
// That is a real ablation — one variable, everything else pinned — and it is
// rarer in model releases than it should be. It also does not say what the
// summary says: "the GDN hybrid wins" is true on average and false on two of
// the nine benchmarks, and the one it loses worst is code.

const FULL = "oklch(0.62 0.03 250)"
const SWA = "oklch(0.68 0.13 85)"
const GDN = "oklch(0.55 0.16 155)"

const BENCHES = [
  { k: "MMLU", cat: "knowledge" },
  { k: "MMLU-Pro", cat: "knowledge" },
  { k: "SuperGPQA", cat: "knowledge" },
  { k: "MATH", cat: "STEM" },
  { k: "GSM8K", cat: "STEM" },
  { k: "BBH", cat: "reasoning" },
  { k: "MMMLU", cat: "multilingual" },
  { k: "EvalPlus", cat: "code" },
  { k: "MultiPL-E", cat: "code" },
] as const

const ARCH = [
  { k: "full", label: "full attention", colour: FULL, s: [62.65, 37.59, 21.76, 49.4, 75.13, 63.78, 47.74, 51.01, 39.73] },
  { k: "swa", label: "SWA hybrid (window 128)", colour: SWA, s: [66.3, 40.67, 22.45, 45.48, 74.22, 65.88, 51.33, 52.12, 41.93] },
  { k: "gdn", label: "GDN hybrid", colour: GDN, s: [66.26, 42.82, 23.45, 53.98, 77.07, 68.72, 54.83, 49.71, 47.48] },
] as const

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function HybridAblation() {
  const [base, setBase] = useState<"full" | "swa">("full")
  const b = ARCH.find((a) => a.k === base)!
  const g = ARCH[2]

  const wins = BENCHES.filter((_, i) => g.s[i] > b.s[i]).length

  const W = 700
  const ROW_H = 20
  const H = BENCHES.length * ROW_H + 30
  const MID = 400
  const SCALE = 20

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          GDN hybrid minus {b.label} · 25B-A3B, 28 layers, 400B + 80B tokens
        </span>
        <span className="font-mono text-[10px]" style={{ color: GDN }}>
          ahead on {wins} of 9 · avg {mean(g.s).toFixed(2)} vs {mean(b.s).toFixed(2)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["full", "vs full attention"],
              ["swa", "vs sliding-window hybrid"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setBase(k)}
              aria-pressed={base === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                base === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A diverging bar chart of the Gated DeltaNet hybrid minus the ${b.label} baseline across nine benchmarks. The GDN hybrid is ahead on ${wins} of them; the average moves from ${mean(b.s).toFixed(2)} to ${mean(g.s).toFixed(2)}.`}
            </title>
            <line x1={MID} y1={2} x2={MID} y2={H - 22} stroke="currentColor" strokeOpacity={0.3} />
            {[-4, 4, 8].map((t) => (
              <g key={t}>
                <line x1={MID + t * SCALE / 4} y1={2} x2={MID + t * SCALE / 4} y2={H - 22} stroke="currentColor" strokeOpacity={0.07} />
              </g>
            ))}
            {BENCHES.map((bench, i) => {
              const d = g.s[i] - b.s[i]
              const y = 4 + i * ROW_H
              const colour = d > 0 ? GDN : SWA
              const w = Math.abs(d) * SCALE / 4
              return (
                <g key={bench.k}>
                  <text x={4} y={y + 12} fontSize={9} fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    {bench.k}
                  </text>
                  <text x={128} y={y + 12} fontSize={7.5} fill="currentColor" fillOpacity={0.38} fontFamily="ui-monospace, monospace">
                    {bench.cat}
                  </text>
                  <text x={MID - 10} y={y + 12} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {b.s[i].toFixed(2)} → {g.s[i].toFixed(2)}
                  </text>
                  <rect
                    x={d > 0 ? MID : MID - w}
                    y={y + 3}
                    width={Math.max(2, w)}
                    height={11}
                    rx={2}
                    fill={colour}
                    fillOpacity={0.8}
                  />
                  <text x={W - 2} y={y + 12} fontSize={8.5} textAnchor="end" fill={colour} fontFamily="ui-monospace, monospace">
                    {d > 0 ? "+" : ""}
                    {d.toFixed(2)}
                  </text>
                </g>
              )
            })}
            <text x={4} y={H - 6} fontSize={8} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              Table 1, Qwen3.8-Flash-Next technical report · one full-attention layer in every four for both hybrids
            </text>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This is the ablation that justifies the whole architecture, and it is set up properly: one
          variable changed, everything else pinned, same evaluation pipeline. Against the
          full-attention Transformer the GDN hybrid wins eight of nine and moves the average from
          49.87 to 53.81 — a genuinely large gap for a token-mixer swap, and the multilingual and
          code columns carry most of it.
          <br />
          <br />
          The comparison that matters more is the second one, because a sliding window is the cheap
          way to get the same asymptotics. Switch to it and the picture sharpens: GDN wins seven of
          nine, but the two it loses include{" "}
          <span style={{ color: SWA }}>EvalPlus, where it is 2.41 behind</span>, and MMLU is a tie to
          within four hundredths. What separates them is <em>content-dependent</em>{" "}memory —{" "}
          <span className="text-foreground">
            MATH +8.50, MultiPL-E +5.55, MMMLU +3.50
          </span>{" "}
          — the tasks where you need something from far back that a fixed 128-token window has
          already dropped. A window forgets by position; a gated delta rule forgets by relevance,
          and the gap between those two is what this table prices.
        </p>
      </div>
    </figure>
  )
}
