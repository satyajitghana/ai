"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The README's own three quality tables, transposed into one dataset. Every
// number below is transcribed directly from orcarouter/GLM-5.3-Flash-MLX's
// "Quality vs FP8" section -- perplexity, KL divergence / top-1 agreement, and
// weight-space cosine similarity -- each measured against the dequantized FP8
// reference run through the identical glm5_next forward pass.
//
// The three metrics disagree on units but agree on shape: the degradation from
// 6-bit through 3-bit is gentle, then 2-bit costs a lot, and 2bit-lite costs a
// lot more. That ordering is the README's own words, not this site's framing.

const BUILDS = [
  { key: "6-bit", label: "6-bit", sizeGB: 296, minRamGB: 320, ppl: 2.7864, dPpl: 0.24, klMean: 0.0063, top1: 97.76, cosine: 0.9998 },
  { key: "4-bit", label: "4-bit — recommended default", sizeGB: 204, minRamGB: 224, ppl: 2.862, dPpl: 2.96, klMean: 0.0131, top1: 96.13, cosine: 0.9969 },
  { key: "3-bit", label: "3-bit", sizeGB: 184, minRamGB: 200, ppl: 3.0566, dPpl: 9.96, klMean: 0.0421, top1: 92.06, cosine: 0.9892 },
  { key: "2-bit", label: "2-bit", sizeGB: 145, minRamGB: 160, ppl: 4.3622, dPpl: 56.9, klMean: 0.1647, top1: 86.56, cosine: 0.9518 },
  { key: "2bit-lite", label: "2bit-lite — smallest", sizeGB: 102, minRamGB: 112, ppl: 6.7018, dPpl: 141, klMean: 0.3456, top1: 77.19, cosine: 0.9135 },
] as const

const FP8_PPL = 2.7797

type Build = (typeof BUILDS)[number]
type MetricKey = "ppl" | "kld" | "cos"

const GOOD = "oklch(0.55 0.16 155)"
const AMBER = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"

const METRICS: Record<
  MetricKey,
  { label: string; tab: string; unit: string; get: (b: Build) => number; fmt: (v: number) => string }
> = {
  ppl: {
    label: "perplexity",
    tab: "PPL vs FP8",
    unit: `% higher perplexity than the FP8 reference (${FP8_PPL.toFixed(4)})`,
    get: (b) => b.dPpl,
    fmt: (v) => `+${v.toFixed(2)}%`,
  },
  kld: {
    label: "KL divergence",
    tab: "KL divergence",
    unit: "mean KL divergence from the FP8 reference's next-token distribution",
    get: (b) => b.klMean,
    fmt: (v) => v.toFixed(4),
  },
  cos: {
    label: "weight cosine",
    tab: "cosine similarity",
    unit: "% deviation from FP8 weights (1 − cosine similarity)",
    get: (b) => (1 - b.cosine) * 100,
    fmt: (v) => `${v.toFixed(2)}%`,
  },
}

const colourFor = (key: string) => (key === "2bit-lite" ? BAD : key === "2-bit" ? AMBER : GOOD)

export function QuantLadder() {
  const [metric, setMetric] = useState<MetricKey>("ppl")
  const m = METRICS[metric]

  const rows = useMemo(() => BUILDS.map((b) => ({ b, v: m.get(b) })), [m])
  const maxV = Math.max(...rows.map((r) => r.v))

  // The generic "cliff" check: is the single 3-bit -> 2-bit step bigger than
  // every step before it, combined? True for all three metrics, computed live
  // rather than hardcoded, so it can't drift from the numbers above.
  const byKey = (k: string) => rows.find((r) => r.b.key === k)!.v
  const gentleSum = byKey("4-bit") - byKey("6-bit") + (byKey("3-bit") - byKey("4-bit"))
  const cliffStep = byKey("2-bit") - byKey("3-bit")
  const cliffBigger = cliffStep > gentleSum

  const W = 700
  const ROW_H = 38
  const LABEL_W = 190
  const BAR_W = W - LABEL_W - 90
  const H = BUILDS.length * ROW_H + 14

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">five OrcaSAQ builds, quality vs the FP8 reference</span>
        <span className="font-mono text-[10px]" style={{ color: colourFor("2bit-lite") }}>
          {m.tab}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(METRICS) as MetricKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {METRICS[k].tab}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A horizontal bar per build, ${m.unit}, from 6-bit (least degraded) to 2bit-lite (most degraded). The bars grow gently from 6-bit to 3-bit, then jump sharply at 2-bit and again at 2bit-lite.`}
            </title>
            {rows.map((r, i) => {
              const y = 6 + i * ROW_H
              const w = Math.max(2, (r.v / maxV) * BAR_W)
              const c = colourFor(r.b.key)
              return (
                <g key={r.b.key}>
                  <text x={0} y={y + 12} fontSize={9.5} fill="currentColor" fillOpacity={0.9} fontFamily="ui-monospace, monospace">
                    {r.b.key}
                  </text>
                  <text x={0} y={y + 24} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                    {r.b.sizeGB} GB · min {r.b.minRamGB} GB RAM
                  </text>
                  <rect x={LABEL_W} y={y + 3} width={BAR_W} height={16} rx={3} fill="currentColor" fillOpacity={0.06} />
                  <rect x={LABEL_W} y={y + 3} width={w} height={16} rx={3} fill={c} fillOpacity={0.82} />
                  <text x={LABEL_W + w + 8} y={y + 15} fontSize={9} fill={c} fontFamily="ui-monospace, monospace">
                    {m.fmt(r.v)}
                  </text>
                  {i === 3 ? (
                    <line
                      x1={LABEL_W - 6}
                      y1={y - 5}
                      x2={W}
                      y2={y - 5}
                      stroke={AMBER}
                      strokeDasharray="3 3"
                      strokeOpacity={0.5}
                    />
                  ) : null}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          dashed line marks the README&rsquo;s own boundary — &ldquo;everything down to 3-bit degrades gently, 2-bit costs a lot, and 2bit-lite costs a lot more&rdquo;
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "FP8 reference PPL", v: FP8_PPL.toFixed(4), c: "currentColor" },
            { l: "4-bit default, this metric", v: m.fmt(byKey("4-bit")), c: GOOD },
            { l: "2bit-lite, this metric", v: m.fmt(byKey("2bit-lite")), c: BAD },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch metrics and the shape doesn&rsquo;t change, only the units do — perplexity, KL
          divergence and cosine similarity are three different ways of asking the same question, and
          all three answer it the same way.{" "}
          {cliffBigger ? (
            <span className="text-foreground">
              On {m.label}, the single step from 3-bit to 2-bit is larger than the entire gentle
              slide from 6-bit down through 3-bit, combined
            </span>
          ) : (
            <span className="text-foreground">3-bit to 2-bit is where the slope changes</span>
          )}
          . <span style={{ color: BAD }}>2bit-lite</span> then pushes every one of the three measures
          higher still. The README&rsquo;s own conclusion is blunt about what that means: pick this
          ladder for fit, not for quality.
        </p>
      </div>
    </figure>
  )
}
