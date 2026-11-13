"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { EVAL, EXAMPLE } from "./measured-data"

// What the Figure 5 gap costs, measured. One prefill per SQuAD context with the
// official KVzip code on Qwen3-4B-Instruct-2507, then every question about that
// context answered from the SAME cache after evicting pairs by one of three
// scores: KVzip's reconstruction score, the prefill-attention score (max
// attention each pair got while the context was read), and a seeded random
// score. Eviction uses KVzip's own global threshold (RetainCache.prune); greedy
// decoding, 32 new tokens, correct when a gold answer string appears in the
// output. The token strip is one of those contexts: each token is shaded by the
// share of its (layer, KV head) slots that survive at the chosen ratio.

const COLORS = {
  recon: "oklch(0.7 0.17 150)",
  prefill: "oklch(0.66 0.16 265)",
  random: "oklch(0.7 0.02 260)",
} as const
type Scorer = keyof typeof COLORS
const LABEL: Record<Scorer, string> = {
  recon: "reconstruction (KVzip)",
  prefill: "prefill attention",
  random: "random",
}

function acc(x: readonly [number, number]) {
  return x[1] ? x[0] / x[1] : 0
}

export function KVEvictToy() {
  const [ri, setRi] = useState(1)
  const [scorer, setScorer] = useState<"recon" | "prefill">("recon")
  const ratios = EVAL.ratios
  const ratio = ratios[ri]
  const full = acc(EVAL.full)

  const W = 680
  const H = 240
  const PL = 44
  const PR = 16
  const PT = 12
  const PB = 36
  const x = (r: number) => PL + ((r - 0.1) / 0.9) * (W - PL - PR)
  const y = (v: number) => PT + (H - PT - PB) * (1 - v)
  const xs = [...ratios, 1]

  const kept = EXAMPLE.kept[scorer][String(ratio)] ?? []
  const shade = COLORS[scorer]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one cache, every question · {EVAL.questions} questions over {EVAL.contexts} SQuAD contexts · Qwen3-4B
        </span>
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          keep
          <Range
            min={0}
            max={ratios.length - 1}
            step={1}
            value={ri}
            onChange={(e) => setRi(Number(e.target.value))}
            aria-label="Share of the cache kept"
            className="w-32"
          />
          <span className="text-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
        </label>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Answer accuracy against the share of the cache kept. At ${Math.round(ratio * 100)}% kept: reconstruction ${Math.round(acc(EVAL.recon[ri]) * 100)}%, prefill ${Math.round(acc(EVAL.prefill[ri]) * 100)}%, random ${Math.round(acc(EVAL.random[ri]) * 100)}%; full cache ${Math.round(full * 100)}%.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PL - 6} y={y(t) + 3} fontSize="10" textAnchor="end" className="fill-muted-foreground font-mono">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {xs.map((r) => (
            <text key={r} x={x(r)} y={H - PB + 14} fontSize="10" textAnchor="middle" className="fill-muted-foreground font-mono">
              {Math.round(r * 100)}%
            </text>
          ))}
          <text x={(W + PL) / 2} y={H - 4} fontSize="10" textAnchor="middle" className="fill-muted-foreground font-mono">
            share of the context KV cache kept
          </text>
          <line x1={x(ratio)} x2={x(ratio)} y1={PT} y2={y(0)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
          <line x1={PL} x2={W - PR} y1={y(full)} y2={y(full)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="5 4" />
          <text x={W - PR} y={y(full) - 4} fontSize="10" textAnchor="end" className="fill-muted-foreground font-mono">
            full cache {Math.round(full * 100)}%
          </text>
          {(Object.keys(COLORS) as Scorer[]).map((k) => {
            const pts = ratios.map((r, i) => [x(r), y(acc(EVAL[k][i]))] as const)
            pts.push([x(1), y(full)])
            return (
              <g key={k}>
                <polyline
                  points={pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
                  fill="none"
                  stroke={COLORS[k]}
                  strokeWidth={2.25}
                />
                {pts.slice(0, -1).map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={i === ri ? 4.5 : 3} fill={COLORS[k]} />
                ))}
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          {(Object.keys(COLORS) as Scorer[]).map((k) => (
            <span key={k}>
              <span className="inline-block size-2.5 rounded-sm align-middle" style={{ background: COLORS[k] }} />{" "}
              {LABEL[k]}: <span className="text-foreground tabular-nums">{Math.round(acc(EVAL[k][ri]) * 100)}%</span>
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">
          <span className="mr-1">one context, scored by</span>
          {(["recon", "prefill"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setScorer(k)}
              aria-pressed={scorer === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
                scorer === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {LABEL[k]}
            </button>
          ))}
        </div>
        <p className="mt-2 rounded-lg border bg-background/60 p-3 text-sm leading-7">
          {EXAMPLE.tokens.map((t, i) => (
            <span
              key={i}
              style={{
                background: `color-mix(in oklch, ${shade} ${Math.round((kept[i] ?? 0) * 85)}%, transparent)`,
              }}
              className="rounded-[2px]"
            >
              {t}
            </span>
          ))}
        </p>
        <ul className="mt-2 space-y-0.5 text-xs leading-5 text-muted-foreground">
          {EXAMPLE.questions.map((q, i) => (
            <li key={i}>
              {q} <span className="text-foreground">{EXAMPLE.answers[i]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-muted-foreground/80">
          Darker = more of that token&apos;s cached (layer, head) slots kept at {Math.round(ratio * 100)}%. Measured
          with the official KVzip code on one RTX 3090; the paper&apos;s own accuracy curves are in its Figure 9 below.
        </p>
      </div>
    </figure>
  )
}
