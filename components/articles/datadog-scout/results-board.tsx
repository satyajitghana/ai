"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Scout's two result sets, side by side, with what each one can and cannot say.
//
// AlertEval (internal): average DeepJudge score (0-100, partial credit) against
// estimated inference cost per investigation, relative to Scout 1.0 medium. The
// values are read from the vector coordinates of the report's Figure 1 (the
// report prints no table). Drag the budget: each model family shows its best
// effort level that fits under it. The report gives no task count and no error
// bars for AlertEval, so no interval is drawn; a one-point gap may be noise.
//
// SREGym (public, 90 faults): faults resolved end to end, one attempt per fault
// for the rows Datadog ran itself. Toggle the 95% Wilson interval for a
// binomial count out of 90: it is what one attempt per fault leaves unresolved.

const ACCENT = "oklch(0.55 0.2 295)"
const BASE = "oklch(0.62 0.13 160)"
const OTHER = "oklch(0.62 0.03 250)"

type Pt = { effort: string; score: number; cost: number }
type Fam = { name: string; color: string; pts: Pt[] }

const ALERTEVAL: Fam[] = [
  { name: "Scout 1.0", color: ACCENT, pts: [{ effort: "medium", score: 58.3, cost: 1.0 }, { effort: "high", score: 63.1, cost: 3.9 }, { effort: "xhigh", score: 65.4, cost: 5.9 }] },
  { name: "GLM-5.3 Flash (base)", color: BASE, pts: [{ effort: "high", score: 52.8, cost: 0.48 }, { effort: "max", score: 53.9, cost: 0.61 }] },
  { name: "GLM-5.3", color: OTHER, pts: [{ effort: "high", score: 50.6, cost: 2.18 }, { effort: "max", score: 56.7, cost: 3.54 }] },
  { name: "GPT-6.1 Sol", color: OTHER, pts: [{ effort: "medium", score: 56.1, cost: 2.31 }, { effort: "high", score: 57.9, cost: 3.4 }, { effort: "xhigh", score: 59.3, cost: 7.01 }] },
  { name: "Claude Opus 5.5", color: OTHER, pts: [{ effort: "medium", score: 53.7, cost: 4.63 }, { effort: "high", score: 58.5, cost: 6.33 }, { effort: "xhigh", score: 59.2, cost: 8.1 }] },
  { name: "Claude Fable 5.1", color: OTHER, pts: [{ effort: "medium", score: 58.2, cost: 12.52 }, { effort: "high", score: 62.6, cost: 16.39 }, { effort: "xhigh", score: 65.4, cost: 24.63 }] },
  { name: "GPT-6 Astra", color: OTHER, pts: [{ effort: "medium", score: 58.8, cost: 19.86 }, { effort: "high", score: 60.2, cost: 24.35 }, { effort: "xhigh", score: 61.5, cost: 26.19 }] },
]

type Bar = { label: string; k: number; ours: boolean; scout?: boolean; base?: boolean; note?: string }

const SREGYM: Bar[] = [
  { label: "GPT-6.1 Sol xhigh", k: 82, ours: true },
  { label: "Scout 1.0 xhigh", k: 80, ours: true, scout: true },
  { label: "GPT-6 Astra xhigh", k: 80, ours: true },
  { label: "Scout 1.0 high", k: 79, ours: true, scout: true },
  { label: "Claude Opus 5.5 xhigh", k: 79, ours: true },
  { label: "Claude Fable 5.1 high", k: 76, ours: true, note: "some tasks fell back to Opus 5.5" },
  { label: "Scout 1.0 medium", k: 71, ours: true, scout: true },
  { label: "GLM-5.3", k: 68, ours: true },
  { label: "GLM-5.3-Flash (base)", k: 66, ours: true, base: true },
  { label: "GPT-5.6 Sol max", k: 65, ours: false },
  { label: "Claude Sonnet 5 medium", k: 64, ours: false },
  { label: "GPT-5.5 max", k: 63, ours: false },
  { label: "GPT-5.6 Terra max", k: 63, ours: false },
  { label: "Claude Opus 4.8 medium", k: 62, ours: false },
  { label: "Claude Sonnet 4.6", k: 55, ours: false },
  { label: "GPT-5.4", k: 48, ours: false },
  { label: "Kimi K2.5", k: 25, ours: false },
]

const N = 90
const Z = 1.96

// 95% Wilson score interval for k successes out of N, as counts.
function wilson(k: number): [number, number] {
  const p = k / N
  const d = 1 + (Z * Z) / N
  const c = (p + (Z * Z) / (2 * N)) / d
  const h = (Z * Math.sqrt((p * (1 - p)) / N + (Z * Z) / (4 * N * N))) / d
  return [(c - h) * N, (c + h) * N]
}

function bestUnder(f: Fam, budget: number): Pt | null {
  let best: Pt | null = null
  for (const p of f.pts) if (p.cost <= budget && (!best || p.score > best.score)) best = p
  return best
}

export function ResultsBoard() {
  const [tab, setTab] = useState<"alerteval" | "sregym">("alerteval")
  const [budget, setBudget] = useState(6)
  const [ci, setCi] = useState(true)

  const S_MIN = 48
  const S_MAX = 68
  const sPct = (v: number) => ((v - S_MIN) / (S_MAX - S_MIN)) * 100
  const kPct = (v: number) => (v / N) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <div className="flex gap-1">
          {(
            [
              ["alerteval", "AlertEval · internal"],
              ["sregym", "SREGym · public, 90 faults"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={cn("rounded-md border px-2 py-0.5", tab === id ? "bg-background text-foreground" : "opacity-70")}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground/60">reported · read from report Figures 1 and 2</span>
      </div>

      {tab === "alerteval" ? (
        <div className="p-4 sm:p-5">
          <label className="mb-4 block">
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>budget per investigation (Scout 1.0 medium = 1x)</span>
              <span style={{ color: ACCENT }}>{budget.toFixed(1)}x</span>
            </div>
            <Range
              min={0.5}
              max={27}
              step={0.5}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full cursor-pointer"
              accent={ACCENT}
              aria-label="Cost budget relative to Scout 1.0 medium"
            />
          </label>
          <ul className="m-0 list-none space-y-2 p-0">
            {ALERTEVAL.map((f) => {
              const b = bestUnder(f, budget)
              return (
                <li key={f.name} className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-2 text-xs sm:grid-cols-[11rem_1fr_7rem]">
                  <span className="truncate">{f.name}</span>
                  <div className="relative h-4 rounded bg-muted/40">
                    {b ? (
                      <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${sPct(b.score)}%`, background: f.color, opacity: 0.85 }} />
                    ) : null}
                    {f.pts.map((p) => (
                      <span
                        key={p.effort}
                        className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-foreground/40"
                        style={{ left: `${sPct(p.score)}%` }}
                        title={`${p.effort}: ${p.score} at ${p.cost}x`}
                      />
                    ))}
                  </div>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {b ? `${b.score.toFixed(1)} · ${b.effort}` : "over budget"}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex justify-between pl-[9rem] pr-[7rem] font-mono text-[10px] text-muted-foreground sm:pl-[11.5rem] sm:pr-[7.5rem]">
            <span>{S_MIN}</span>
            <span>average DeepJudge score</span>
            <span>{S_MAX}</span>
          </div>
          <p className="mt-3 mb-0 text-xs text-muted-foreground">
            Ticks mark every effort level; the bar is the best one that fits the budget. No task count or error bars are published for AlertEval, so treat a
            gap of a point or two as unresolved.
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <label className="mb-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <input type="checkbox" checked={ci} onChange={(e) => setCi(e.target.checked)} />
            show 95% Wilson interval for one attempt per fault
          </label>
          <ul className="m-0 list-none space-y-1 p-0">
            {SREGYM.map((b) => {
              const [lo, hi] = wilson(b.k)
              const color = b.scout ? ACCENT : b.base ? BASE : OTHER
              return (
                <li key={b.label} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2 text-xs sm:grid-cols-[11rem_1fr_2.5rem]">
                  <span className={cn("truncate", b.scout && "font-semibold")} title={b.note}>
                    {b.label}
                    {b.ours ? "" : " †"}
                  </span>
                  <div className="relative h-3.5 rounded bg-muted/40">
                    <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${kPct(b.k)}%`, background: color, opacity: b.ours ? 0.85 : 0.45 }} />
                    {ci ? (
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-foreground/50"
                        style={{ left: `${kPct(lo)}%`, width: `${kPct(hi - lo)}%` }}
                      />
                    ) : null}
                  </div>
                  <span className="font-mono tabular-nums">{b.k}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 mb-0 text-xs text-muted-foreground">
            Faults resolved end to end, out of {N}. † reproduced from the sregym.com leaderboard, not re-run by Datadog. At 80 of 90 the interval runs from
            about 73 to 85, so the top five rows are not separable on this data.
          </p>
        </div>
      )}
    </figure>
  )
}
