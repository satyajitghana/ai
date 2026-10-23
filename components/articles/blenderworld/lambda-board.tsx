"use client"

// BlenderWorld's leaderboard as a function of the fusion weight. Rubric and
// Dimension means per model are REPORTED (paper Table 2, all 223 tasks, failed
// evaluations counted as zero). Because every task score is
// lambda * rubric + (1 - lambda) * dimension and the mean is linear, the
// leaderboard at any lambda is exactly lambda * mean rubric + (1 - lambda) *
// mean dimension: REASONED, and it reproduces the paper's Figure 12b swaps.
//
// SSR-safe: plain state, no effects. Numbers use + - * / only.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

type Row = { name: string; rubric: number; dim: number; perfect: number }

const ROWS: Row[] = [
  { name: "GPT-6-Astra", rubric: 87.3, dim: 72.6, perfect: 42.2 },
  { name: "Opus-5", rubric: 80.9, dim: 65.1, perfect: 25.6 },
  { name: "GPT-5.6-Sol", rubric: 74.7, dim: 60.7, perfect: 15.7 },
  { name: "DeepSeek-V4.1-Flash", rubric: 72.0, dim: 59.4, perfect: 11.7 },
  { name: "Qwen3.8-Max", rubric: 65.9, dim: 55.3, perfect: 10.3 },
  { name: "GLM-5.3-Flash", rubric: 64.8, dim: 54.4, perfect: 6.28 },
  { name: "Grok-4.6", rubric: 61.4, dim: 52.7, perfect: 6.73 },
  { name: "Opus-4.8", rubric: 60.2, dim: 53.7, perfect: 5.38 },
  { name: "Seed2.1pro-0915", rubric: 54.9, dim: 47.7, perfect: 3.59 },
  { name: "Qwen3.8-27B", rubric: 50.0, dim: 45.5, perfect: 1.35 },
  { name: "Kimi-K3", rubric: 47.9, dim: 45.2, perfect: 1.79 },
  { name: "Gemini-3.8-Flash", rubric: 29.8, dim: 38.5, perfect: 0.45 },
  { name: "MiniMax-M3", rubric: 28.9, dim: 34.7, perfect: 0.45 },
]

const ACCENT = "oklch(0.58 0.13 250)"
const RUB = "oklch(0.62 0.14 150)"
const DIM = "oklch(0.66 0.13 70)"

export function LambdaBoard() {
  const [step, setStep] = useState(10)
  const lam = step / 20
  const scored = ROWS.map((r) => ({ ...r, s: lam * r.rubric + (1 - lam) * r.dim }))
  const ranked = [...scored].sort((a, b) => b.s - a.s)
  const paperRank = new Map(ROWS.map((r, i) => [r.name, i + 1]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>13 agents · 223 tasks · score = λ·rubric + (1 − λ)·dimension</span>
        <span className="text-muted-foreground/70">means reported (Table 2); re-weighting reasoned</span>
      </div>

      <div className="p-4 sm:p-5">
        <label className="grid grid-cols-[auto_1fr_auto] items-center gap-3 font-mono text-xs">
          <span>λ (rubric weight)</span>
          <Range min={0} max={20} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Rubric weight lambda" />
          <span className="w-10 text-right tabular-nums">{lam.toFixed(2)}</span>
        </label>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          The paper uses λ = 0.50. At 0 the score is visual quality alone; at 1 it is requirement satisfaction alone.
        </p>

        <ol className="mt-4 space-y-1.5">
          {ranked.map((r, i) => {
            const moved = paperRank.get(r.name) !== i + 1
            return (
              <li key={r.name} className="grid grid-cols-[1.5rem_9.5rem_1fr_3rem] items-center gap-2 font-mono text-[11px] sm:grid-cols-[1.5rem_11rem_1fr_3.5rem]">
                <span className="tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="truncate" style={moved ? { color: ACCENT, fontWeight: 600 } : undefined}>
                  {r.name}
                </span>
                <span className="flex h-3.5 overflow-hidden rounded bg-muted/50" aria-hidden="true">
                  <span style={{ width: `${(lam * r.rubric).toFixed(2)}%`, background: RUB }} />
                  <span style={{ width: `${((1 - lam) * r.dim).toFixed(2)}%`, background: DIM }} />
                </span>
                <span className="text-right tabular-nums">{r.s.toFixed(2)}</span>
              </li>
            )
          })}
        </ol>
        <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: RUB }} />λ × rubric
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: DIM }} />(1 − λ) × dimension
          </span>
          <span style={{ color: ACCENT }}>blue name = rank differs from the paper&apos;s λ = 0.5 table</span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Across the whole range from λ = 0 to λ = 1 exactly one pair of lines crosses: Grok-4.6 and Opus-4.8, at
        λ ≈ 0.455, just below the paper&apos;s 0.5. Every other rank holds at every weight. Gemini-3.8-Flash and
        MiniMax-M3 are the only agents whose dimension mean beats their rubric mean, so they gain as λ falls, but
        never enough to move.
      </figcaption>
    </figure>
  )
}
