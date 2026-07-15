"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Third-stage RL trains one model in three tiers, each with its own system prompt
// and token budget, so a single checkpoint can reason at three depths on demand.
// Pick a tier: the frame is the allowed budget, the fill is the tokens the model
// actually spends on average, and the gauge is AIME-2024 accuracy. The catch is at
// the bottom: joint training pulls the High tier's peak below the dedicated
// second-stage model. Numbers from the paper's Table 1. Illustrative.

const ACCENT = "oklch(0.58 0.19 300)"

type Tier = {
  key: string
  name: string
  prompt: string
  budget: number
  avg: number
  acc: number
}

const TIERS: Tier[] = [
  { key: "low", name: "Low", prompt: "p_low", budget: 4000, avg: 2353, acc: 82.3 },
  { key: "med", name: "Medium", prompt: "p_med", budget: 16000, avg: 8085, acc: 90.9 },
  { key: "high", name: "High", prompt: "p_high", budget: 128000, avg: 20817, acc: 93.2 },
]

// scene geometry
const W = 760
const H = 150
const ML = 24
const MR = 24
const BAR_Y = 58
const BAR_H = 34
const LO = 1000
const HI = 131072
const plotW = W - ML - MR
const l10 = (t: number) => Math.log10(t)
const xOf = (t: number) => ML + ((l10(Math.max(t, LO)) - l10(LO)) / (l10(HI) - l10(LO))) * plotW
const TICKS = [
  { t: 4000, label: "4k" },
  { t: 16000, label: "16k" },
  { t: 64000, label: "64k" },
  { t: 128000, label: "128k" },
]

export function AdaptiveDepth() {
  const [ti, setTi] = useState(1)
  const tier = TIERS[ti]
  const gaugeMin = 78
  const gaugeMax = 96
  const gaugeFrac = (tier.acc - gaugeMin) / (gaugeMax - gaugeMin)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>tier-conditioned reasoning depth · one model</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${tier.name} tier: budget ${tier.budget} tokens, average ${tier.avg} tokens used, ${tier.acc} percent on AIME 2024`}>
          <defs>
            <filter id="rz-depth-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.15" />
            </filter>
          </defs>

          <text x={ML} y={30} className="fill-muted-foreground font-mono" fontSize={11}>
            {tier.prompt} → token budget (log scale) · fill = avg tokens actually spent
          </text>

          {/* tick grid */}
          {TICKS.map((tk) => (
            <g key={tk.t}>
              <line x1={xOf(tk.t)} y1={BAR_Y - 6} x2={xOf(tk.t)} y2={BAR_Y + BAR_H + 6} stroke="var(--border)" strokeWidth={1} opacity={0.4} />
              <text x={xOf(tk.t)} y={BAR_Y + BAR_H + 20} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{tk.label}</text>
            </g>
          ))}

          {/* budget frame */}
          <rect x={ML} y={BAR_Y} width={xOf(tier.budget) - ML} height={BAR_H} rx={7} fill="var(--muted)" opacity={0.35} stroke="var(--border)" strokeWidth={1.2} className="transition-all duration-300" />
          {/* used fill */}
          <rect x={ML} y={BAR_Y} width={xOf(tier.avg) - ML} height={BAR_H} rx={7} fill={ACCENT} opacity={0.85} filter="url(#rz-depth-soft)" className="transition-all duration-300" />
          {/* avg marker label */}
          <text x={xOf(tier.avg)} y={BAR_Y - 8} textAnchor="middle" className="font-mono" fontSize={10} fill={ACCENT} fontWeight={600}>
            {tier.avg.toLocaleString()} tok
          </text>
          {/* budget cap label */}
          <text x={xOf(tier.budget) - 4} y={BAR_Y + BAR_H + 20} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            budget {(tier.budget / 1000)}k
          </text>
        </svg>

        {/* controls + accuracy gauge */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">tier</span>
            {TIERS.map((t, i) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTi(i)}
                aria-pressed={i === ti}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  i === ti ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={i === ti ? { background: ACCENT } : undefined}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">AIME 2024</span>
            <div className="relative h-2 w-28 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(1, gaugeFrac)) * 100}%`, background: ACCENT }} />
            </div>
            <span className="font-mono text-xs" style={{ color: ACCENT }}>{tier.acc}%</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          One checkpoint, three regimes: the Low tier answers in ~2.4k tokens at{" "}
          <span className="text-foreground">82.3%</span>, the High tier spends ~20.8k tokens for{" "}
          <span className="text-foreground">93.2%</span>. The prompt alone routes the depth. The honest cost: training all
          three jointly is <span className="text-foreground">negative transfer</span> — the High tier here (93.2%) sits
          below the dedicated second-stage model&rsquo;s 94.1%. You buy flexibility with a little peak accuracy.
        </p>
      </div>
    </figure>
  )
}
