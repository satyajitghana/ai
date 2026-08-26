"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Two 8B models with the same deployment profile and opposite strengths.
//
// Pipette, M5 Max, Q4_K_M, 2,048 input tokens: Granite-4.1-8B and
// Ministral-3-8B-Instruct-2512 differ by 2.4% in decode throughput and 1.2% in
// peak RAM. On the dashboard they are the same row twice. On quality
// evaluations of the very same Q4_K_M artifacts, Granite leads IFBench by 7.3
// points and Ministral leads GPQA Diamond by 14.0.
//
// So there is no answer to "which one" without a workload. Move the weights and
// the winner moves — which is the argument for a dashboard with a constraints
// panel instead of a leaderboard with a rank.
//
// All six numbers per model are Pipette's, as displayed on the dashboard. The
// weighted score is computed here.

const GRANITE = "oklch(0.60 0.15 255)"
const MINISTRAL = "oklch(0.62 0.16 35)"
const GOOD = "oklch(0.55 0.16 155)"

type M = {
  name: string
  colour: string
  ifbench: number
  gpqa: number
  math: number
  decode: number
  e2e: number
  ram: number
}

const MODELS: M[] = [
  { name: "granite-4.1-8b", colour: GRANITE, ifbench: 36.3, gpqa: 39.5, math: 79.8, decode: 84, e2e: 4.0, ram: 5.8 },
  { name: "Ministral-3-8B-Instruct-2512", colour: MINISTRAL, ifbench: 29.1, gpqa: 53.5, math: 84.4, decode: 86, e2e: 3.8, ram: 5.7 },
]

const PRESETS = [
  { k: "assistant", label: "on-device assistant", w: [80, 5, 15] },
  { k: "tutor", label: "homework tutor", w: [15, 25, 60] },
  { k: "research", label: "science Q&A", w: [10, 75, 15] },
] as const

export function TaskReversal() {
  const [wIf, setWIf] = useState(80)
  const [wGpqa, setWGpqa] = useState(5)
  const [wMath, setWMath] = useState(15)
  const [preset, setPreset] = useState<string | null>("assistant")

  const sum = Math.max(1, wIf + wGpqa + wMath)
  const score = (m: M) => (m.ifbench * wIf + m.gpqa * wGpqa + m.math * wMath) / sum

  const scored = MODELS.map((m) => ({ m, s: score(m) })).sort((a, b) => b.s - a.s)
  const winner = scored[0]
  const margin = scored[0].s - scored[1].s

  const apply = (k: string, w: readonly number[]) => {
    setWIf(w[0])
    setWGpqa(w[1])
    setWMath(w[2])
    setPreset(k)
  }

  const W = 700
  const X0 = 200
  const px = (v: number) => X0 + (v / 100) * (W - X0 - 74)

  const METRICS = [
    { l: "IFBench", k: "ifbench" as const, hi: 100 },
    { l: "GPQA Diamond", k: "gpqa" as const, hi: 100 },
    { l: "MATH-500", k: "math" as const, hi: 100 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          two 8B models, 2.4% apart on decode and 1.2% apart on RAM
        </span>
        <span className="font-mono text-[10px]" style={{ color: winner.m.colour }}>
          {winner.m.name.split("-")[0]} wins by {margin.toFixed(1)} at this weighting
        </span>
      </div>

      <div className="p-3 sm:p-4">
        {/* the deployment profile — effectively identical */}
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["decode", "decode", "tok/s"],
              ["e2e", "end-to-end", "s"],
              ["ram", "peak RAM", "GB"],
            ] as const
          ).map(([k, label, unit]) => (
            <div key={k} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="font-mono text-xs tabular-nums">
                {MODELS.map((m, i) => (
                  <span key={m.name}>
                    <span style={{ color: m.colour }}>{k === "decode" ? m[k] : m[k].toFixed(1)}</span>
                    {i === 0 ? <span className="text-muted-foreground"> vs </span> : ` ${unit}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 132`} width={W} height={132} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Three paired bars comparing granite-4.1-8b and Ministral-3-8B-Instruct-2512 on IFBench, GPQA Diamond and MATH-500. Granite leads instruction following by 7.2 displayed points; Ministral leads science reasoning by 14.0 and competition maths by 4.6.`}
            </title>
            {METRICS.map((met, i) => {
              const y = 6 + i * 42
              const a = MODELS[0][met.k]
              const b = MODELS[1][met.k]
              return (
                <g key={met.l}>
                  <text x={X0 - 10} y={y + 22} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.8} fontFamily="ui-monospace, monospace">
                    {met.l}
                  </text>
                  {[a, b].map((v, j) => (
                    <g key={j}>
                      <rect
                        x={px(0)}
                        y={y + j * 15}
                        width={Math.max(2, px(v) - px(0))}
                        height={12}
                        rx={2.5}
                        fill={MODELS[j].colour}
                        fillOpacity={0.78}
                      />
                      <text x={px(v) + 6} y={y + j * 15 + 9.5} fontSize={8.5} fill={MODELS[j].colour} fontFamily="ui-monospace, monospace">
                        {v.toFixed(1)}%
                      </text>
                    </g>
                  ))}
                  <text
                    x={X0 - 10}
                    y={y + 32}
                    fontSize={7}
                    textAnchor="end"
                    fill={a > b ? MODELS[0].colour : MODELS[1].colour}
                    fontFamily="ui-monospace, monospace"
                  >
                    Δ {Math.abs(a - b).toFixed(1)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {MODELS.map((m) => (
            <span key={m.name} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: m.colour }} />
              {m.name}
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.k}
              type="button"
              onClick={() => apply(p.k, p.w)}
              aria-pressed={preset === p.k}
              className={
                preset === p.k
                  ? "cursor-pointer rounded-full border border-foreground/30 bg-muted/50 px-2.5 py-1 font-mono text-[10px] text-foreground"
                  : "cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["following", wIf, setWIf, GRANITE, "how much your workload is instruction following"],
              ["science", wGpqa, setWGpqa, MINISTRAL, "how much your workload is science reasoning"],
              ["maths", wMath, setWMath, GOOD, "how much your workload is competition mathematics"],
            ] as const
          ).map(([label, v, set, colour, aria]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-16 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={0}
                max={100}
                step={5}
                value={v}
                onChange={(e) => {
                  set(Number(e.target.value))
                  setPreset(null)
                }}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {Math.round((v / sum) * 100)}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {scored.map((x, i) => (
            <div
              key={x.m.name}
              className="rounded-lg border px-3 py-2"
              style={i === 0 ? { borderColor: `color-mix(in oklch, ${x.m.colour} 50%, transparent)` } : undefined}
            >
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                {i === 0 ? "picked" : "runner-up"}
              </div>
              <div className="font-mono text-[11px]" style={{ color: x.m.colour }}>
                {x.m.name}
              </div>
              <div className="font-mono text-sm tabular-nums text-foreground">{x.s.toFixed(1)}</div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          If you filter a leaderboard by size, quantization, memory and speed, these two survive as
          the same row twice — 84 against 86 tokens per second, 5.8 against 5.7 gigabytes. Every
          axis a deployment engineer would sort on says they are interchangeable.
          <br />
          <br />
          They are not remotely interchangeable. Weight your workload toward following instructions
          and Granite wins; weight it toward science and Ministral wins by more. There is no
          ordering of these two that is correct independent of what you are building, which means{" "}
          <span className="text-foreground">a single ranked list is not a compressed version of
          the truth — it is a different claim, and a false one</span>. That is the argument for the
          constraints panel: you supply the constraints, because only you know them.
        </p>
      </div>
    </figure>
  )
}
