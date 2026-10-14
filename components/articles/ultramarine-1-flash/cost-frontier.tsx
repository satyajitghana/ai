"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Every run in the blog's "PI Knowledge Work: score against cost per task"
// chart: 40 points, eighteen models plus Ultramarine, each at its reasoning
// settings. Transcribed from the chart's own data labels. Click a run to read
// its cost as a multiple of Ultramarine's $0.13 and its score gap.
//
// The x axis is log10(cost), routed through lib/dmath so the server and client
// serialise the same coordinates.

type Run = { m: string; s: string; score: number; cost: number }

const RUNS: Run[] = [
  { m: "Ultramarine 1 Flash", s: "max", score: 59.3, cost: 0.13 },
  { m: "GLM-5.3 Flash", s: "max", score: 52.0, cost: 0.1 },
  { m: "GPT-6 Astra", s: "low", score: 60.3, cost: 1.22 },
  { m: "GPT-6 Astra", s: "medium", score: 62.4, cost: 1.9 },
  { m: "GPT-6 Astra", s: "max", score: 64.2, cost: 5.64 },
  { m: "Claude Opus 5.5", s: "low", score: 53.9, cost: 0.49 },
  { m: "Claude Opus 5.5", s: "medium", score: 57.0, cost: 1.1 },
  { m: "Claude Opus 5.5", s: "high", score: 61.4, cost: 1.53 },
  { m: "Claude Opus 5.5", s: "max", score: 61.9, cost: 6.96 },
  { m: "GPT-6 Sol", s: "low", score: 55.3, cost: 0.15 },
  { m: "GPT-6 Sol", s: "medium", score: 55.5, cost: 0.26 },
  { m: "GPT-6 Sol", s: "high", score: 56.5, cost: 0.42 },
  { m: "GPT-6 Sol", s: "max", score: 61.4, cost: 1.26 },
  { m: "Claude Fable 5", s: "low", score: 50.8, cost: 1.82 },
  { m: "Claude Fable 5", s: "medium", score: 48.6, cost: 2.85 },
  { m: "Claude Fable 5", s: "max", score: 57.8, cost: 8.19 },
  { m: "Claude Fable 5.1", s: "max", score: 65.5, cost: 8.64 },
  { m: "GPT-5.6 Sol", s: "low", score: 48.8, cost: 0.42 },
  { m: "GPT-5.6 Sol", s: "medium", score: 53.4, cost: 0.88 },
  { m: "GPT-5.6 Sol", s: "high", score: 50.5, cost: 1.28 },
  { m: "GPT-5.6 Sol", s: "max", score: 55.1, cost: 2.09 },
  { m: "Muse Spark 1.3", s: "low", score: 51.2, cost: 0.48 },
  { m: "Muse Spark 1.3", s: "medium", score: 50.7, cost: 0.98 },
  { m: "Muse Spark 1.3", s: "high", score: 55.3, cost: 1.09 },
  { m: "Muse Spark 1.3", s: "max", score: 54.7, cost: 1.58 },
  { m: "GPT-6 Luna", s: "low", score: 43.2, cost: 0.008 },
  { m: "GPT-6 Luna", s: "medium", score: 54.1, cost: 0.035 },
  { m: "GPT-6 Luna", s: "high", score: 53.1, cost: 0.054 },
  { m: "GPT-6 Luna", s: "max", score: 58.3, cost: 0.11 },
  { m: "Gemini 3.8 Flash", s: "low", score: 45.6, cost: 0.35 },
  { m: "Gemini 3.8 Flash", s: "medium", score: 51.0, cost: 0.96 },
  { m: "Gemini 3.8 Flash", s: "high", score: 49.4, cost: 1.18 },
  { m: "DeepSeek V4.1 Flash", s: "max", score: 47.9, cost: 0.35 },
  { m: "Kimi K3", s: "max", score: 51.2, cost: 1.33 },
  { m: "GLM-5.3", s: "max", score: 54.1, cost: 1.27 },
  { m: "DeepSeek V4 Pro", s: "max", score: 54.1, cost: 0.43 },
  { m: "Ling 3.1 Flash", s: "reasoning", score: 51.6, cost: 0.21 },
  { m: "Qwen3.8 2.4T", s: "xhigh", score: 50.6, cost: 0.94 },
  { m: "Qwen3.8 27B", s: "xhigh", score: 50.1, cost: 0.42 },
  { m: "MiniMax M3", s: "reasoning", score: 44.2, cost: 0.24 },
]

const UM = RUNS[0]
const UM_C = "oklch(0.45 0.2 268)"
const FABLE_C = "oklch(0.62 0.15 45)"
const BASE_C = "oklch(0.55 0.12 160)"

const W = 680
const H = 340
const PAD = { l: 40, r: 14, t: 14, b: 34 }
const XMIN = mlog10(0.006)
const XMAX = mlog10(12)
const YMIN = 42
const YMAX = 67

const px = (cost: number) => PAD.l + ((mlog10(cost) - XMIN) / (XMAX - XMIN)) * (W - PAD.l - PAD.r)
const py = (score: number) => PAD.t + (1 - (score - YMIN) / (YMAX - YMIN)) * (H - PAD.t - PAD.b)

const colourOf = (r: Run) =>
  r === UM ? UM_C : r.m.startsWith("Claude Fable") ? FABLE_C : r.m === "GLM-5.3 Flash" ? BASE_C : "currentColor"

const PRESETS: { label: string; i: number }[] = [
  { label: "Fable 5 (max)", i: 15 },
  { label: "Fable 5.1 (max)", i: 16 },
  { label: "GPT-6 Luna (max)", i: 28 },
  { label: "Opus 5.5 (max)", i: 8 },
  { label: "GLM-5.3 Flash (base)", i: 1 },
]

export function CostFrontier() {
  const [sel, setSel] = useState(15)
  const r = RUNS[sel]
  const ratio = r.cost / UM.cost
  const gap = Math.round((UM.score - r.score) * 10) / 10
  const dominated = RUNS.filter((x) => x !== UM && x.cost > UM.cost && x.score < UM.score).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">PI Knowledge Work · score vs cost per task (log)</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {dominated} of {RUNS.length - 1} other runs cost more and score lower
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.i}
              type="button"
              onClick={() => setSel(p.i)}
              aria-pressed={sel === p.i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === p.i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">selected</div>
            <div className="font-mono text-sm">
              {r.m} ({r.s})
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">cost vs Ultramarine</div>
            <div className="font-mono text-sm tabular-nums">
              ${r.cost} / $0.13 = {ratio >= 1 ? `${ratio.toFixed(1)}×` : `${ratio.toFixed(2)}×`}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Ultramarine score gap</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: gap > 0 ? "oklch(0.55 0.16 155)" : "oklch(0.58 0.19 27)" }}>
              {gap > 0 ? "+" : "−"}
              {Math.abs(gap).toFixed(1)} points
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              {`Scatter of 40 runs on PI Knowledge Work, score against cost per task on a log axis. Ultramarine 1 Flash scores 59.3 at $0.13. The selected run, ${r.m} at ${r.s} reasoning, scores ${r.score} at $${r.cost}.`}
            </title>
            {[0.01, 0.03, 0.1, 0.3, 1, 3, 10].map((c) => (
              <g key={c}>
                <line x1={px(c)} y1={PAD.t} x2={px(c)} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.08} />
                <text x={px(c)} y={H - PAD.b + 14} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  ${c}
                </text>
              </g>
            ))}
            {[45, 50, 55, 60, 65].map((s) => (
              <g key={s}>
                <line x1={PAD.l} y1={py(s)} x2={W - PAD.r} y2={py(s)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={PAD.l - 6} y={py(s) + 3} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  {s}
                </text>
              </g>
            ))}
            <text x={(W + PAD.l) / 2} y={H - 4} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              cost per task, USD (log scale)
            </text>
            {/* the box Ultramarine dominates: more expensive and lower scoring */}
            <rect
              x={px(UM.cost)}
              y={py(UM.score)}
              width={W - PAD.r - px(UM.cost)}
              height={H - PAD.b - py(UM.score)}
              fill={UM_C}
              fillOpacity={0.05}
            />
            <line x1={px(UM.cost)} y1={py(UM.score)} x2={px(r.cost)} y2={py(r.score)} stroke={UM_C} strokeOpacity={0.5} strokeDasharray="3 3" />
            {RUNS.map((x, i) => {
              const c = colourOf(x)
              const isSel = i === sel
              return (
                <circle
                  key={`${x.m}-${x.s}`}
                  cx={px(x.cost)}
                  cy={py(x.score)}
                  r={x === UM ? 6 : isSel ? 5.5 : 3.5}
                  fill={c}
                  fillOpacity={x === UM || isSel ? 0.95 : c === "currentColor" ? 0.3 : 0.75}
                  stroke={isSel ? "currentColor" : "none"}
                  strokeWidth={1.2}
                  className="cursor-pointer"
                  onClick={() => setSel(i)}
                >
                  <title>{`${x.m} (${x.s}): ${x.score} at $${x.cost}`}</title>
                </circle>
              )
            })}
            <text x={px(UM.cost) - 8} y={py(UM.score) - 9} fontSize={9.5} textAnchor="end" fill={UM_C} fontFamily="ui-monospace, monospace">
              Ultramarine 59.3 · $0.13
            </text>
            {sel !== 0 ? (
              <text
                x={px(r.cost) > W - 160 ? px(r.cost) - 8 : px(r.cost) + 8}
                y={py(r.score) + (r.score > 64 ? 12 : -8)}
                fontSize={9}
                textAnchor={px(r.cost) > W - 160 ? "end" : "start"}
                fill="currentColor"
                fontFamily="ui-monospace, monospace"
              >
                {r.m} ({r.s}) {r.score}
              </text>
            ) : null}
          </svg>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          <span style={{ color: UM_C }}>●</span> Ultramarine · <span style={{ color: FABLE_C }}>●</span> Claude Fable 5 / 5.1 ·{" "}
          <span style={{ color: BASE_C }}>●</span> GLM-5.3 Flash, the base · tap any dot · data: the blog&rsquo;s chart labels
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The &ldquo;60x cheaper&rdquo; is Fable 5 at max reasoning, $8.19 a task, over Ultramarine&rsquo;s $0.13: 63×. It is
          a price ratio, and Ultramarine is priced like its base. The base itself is cheaper still per task, and the
          closest rival in the cheap corner is a closed model:{" "}
          <span className="text-foreground">GPT-6 Luna at max reasoning, 58.3 for $0.11</span>. Select Fable 5.1 to see
          the run the tweet did not compare against.
        </p>
      </div>
    </figure>
  )
}
