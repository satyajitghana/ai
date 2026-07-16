"use client"

import { useState } from "react"

// The RL story, drawn twice over. Left/top: aggregate held-out eval reward rose
// LOG-LINEARLY across 30M+ rollouts, from 0.264 (SFT init) to 0.356 (released) —
// so on a log-x axis it's a straight climb. Bottom: as reward rose, the model's
// chain-of-thought grew *more concise* on its own — no brevity objective — dropping
// grammatical overhead while staying readable. Drag the rollout marker: reward reads
// up, thought-length reads down. Endpoints (0.264, 0.356, 30M) are real; the CoT
// length curve is illustrative of the reported emergent compression.

const INK = "oklch(0.58 0.16 285)"
const WARM = "oklch(0.70 0.13 55)"

const R_MIN = 1e4
const R_MAX = 3e7
const RW0 = 0.264
const RW1 = 0.356

const W = 760
const H = 372
const PL = 52
const PR = 22
const PT = 22
const CHART_B = 236 // chart bottom
const COT_Y = 300 // chain-of-thought strip top

const lg = (v: number) => Math.log10(v)
const frac = (r: number) => (lg(r) - lg(R_MIN)) / (lg(R_MAX) - lg(R_MIN))
const xAt = (r: number) => PL + frac(r) * (W - PL - PR)
const rewardAt = (r: number) => RW0 + (RW1 - RW0) * frac(r)

const Y_LO = 0.24
const Y_HI = 0.37
const yAt = (v: number) => PT + (1 - (v - Y_LO) / (Y_HI - Y_LO)) * (CHART_B - PT)

const X_TICKS = [1e4, 1e5, 1e6, 1e7, 3e7]
const Y_TICKS = [0.26, 0.3, 0.34]
const xlabel = (r: number) => (r >= 1e6 ? `${(r / 1e6).toFixed(0)}M` : r >= 1e3 ? `${(r / 1e3).toFixed(0)}K` : `${r}`)

// illustrative chain-of-thought length (tokens) shrinking as training progresses
const COT_HI = 4200
const COT_LO = 1500
const cotAt = (f: number) => COT_HI - (COT_HI - COT_LO) * f
const COT_MAXW = W - PR - 150

export function RlScaling() {
  const [t, setT] = useState(0.6) // slider fraction along log-x
  const r = R_MIN * Math.pow(R_MAX / R_MIN, t)
  const reward = rewardAt(r)
  const cot = cotAt(t)
  const cotW = (cot / COT_HI) * COT_MAXW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>async RL · reward &amp; reasoning compression</span>
        <span className="text-muted-foreground/60">endpoints real · shape illustrative</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">rollouts so far</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{xlabel(r)}</div>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: INK }}>held-out reward</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: INK }}>{reward.toFixed(3)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: WARM }}>chain-of-thought</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: WARM }}>{cot.toFixed(0)}<span className="text-xs text-muted-foreground"> tok</span></div>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${xlabel(r)} rollouts the held-out reward is ${reward.toFixed(3)} and the chain-of-thought is about ${cot.toFixed(0)} tokens`}>
          {/* y grid + labels */}
          {Y_TICKS.map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={yAt(v)} y2={yAt(v)} stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.5} />
              <text x={PL - 8} y={yAt(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>{v.toFixed(2)}</text>
            </g>
          ))}
          {/* x grid + labels (log decades) */}
          {X_TICKS.map((r0) => (
            <g key={r0}>
              <line x1={xAt(r0)} x2={xAt(r0)} y1={PT} y2={CHART_B} stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.35} />
              <text x={xAt(r0)} y={CHART_B + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>{xlabel(r0)}</text>
            </g>
          ))}

          {/* log-linear reward line */}
          <line x1={xAt(R_MIN)} y1={yAt(RW0)} x2={xAt(R_MAX)} y2={yAt(RW1)} stroke={INK} strokeWidth={2.75} strokeLinecap="round" />
          {/* endpoint labels */}
          <circle cx={xAt(R_MIN)} cy={yAt(RW0)} r={3.5} fill="var(--background)" stroke={INK} strokeWidth={1.5} />
          <text x={xAt(R_MIN)} y={yAt(RW0) - 8} className="fill-muted-foreground font-mono" fontSize={9}>SFT init 0.264</text>
          <circle cx={xAt(R_MAX)} cy={yAt(RW1)} r={3.5} fill="var(--background)" stroke={INK} strokeWidth={1.5} />
          <text x={xAt(R_MAX)} y={yAt(RW1) - 8} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>released 0.356</text>

          {/* draggable marker */}
          <line x1={xAt(r)} x2={xAt(r)} y1={PT} y2={CHART_B} stroke="currentColor" className="text-foreground/25" strokeWidth={1} />
          <circle cx={xAt(r)} cy={yAt(reward)} r={5} fill={INK} stroke="var(--background)" strokeWidth={1.5} />

          <text x={PL} y={PT - 8} className="fill-muted-foreground font-mono" fontSize={10}>aggregate held-out eval reward (log-linear in rollouts)</text>
          <text x={W - PR} y={CHART_B + 16} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>rollouts (log) →</text>

          {/* ---- chain-of-thought length strip ---- */}
          <text x={PL} y={COT_Y - 6} className="fill-muted-foreground font-mono" fontSize={10}>chain-of-thought length — shrinks as reward climbs (emergent)</text>
          {/* ghost max */}
          <rect x={PL} y={COT_Y} width={COT_MAXW} height={26} rx={6} fill="var(--muted)" opacity={0.35} />
          {/* current length */}
          <rect x={PL} y={COT_Y} width={Math.max(cotW, 8)} height={26} rx={6} fill={WARM} opacity={0.85} className="transition-all duration-200" />
          <text x={PL + Math.max(cotW, 8) + 8} y={COT_Y + 18} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{cot.toFixed(0)} tokens</text>
        </svg>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>rollouts (drag) — 10K → 30M+</span>
            <span>reward {reward.toFixed(3)}</span>
          </div>
          <input type="range" min={0} max={1} step={0.001} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.16_285)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two things happened at once over 30M+ rollouts of{" "}
          <a className="underline decoration-foreground/30 underline-offset-4" href="/articles/ring-zero-trillion-scale-rl">large-scale RL</a>.
          Reward rose <span style={{ color: INK }}>log-linearly</span> — a straight line on this log-x axis, from an
          SFT-initialised <span style={{ color: INK }}>0.264</span> to the released{" "}
          <span style={{ color: INK }}>0.356</span> — so more compute kept paying off predictably. And with no brevity
          reward in the objective, the model&apos;s <span style={{ color: WARM }}>chain-of-thought got shorter</span>,
          dropping grammatical overhead while staying comprehensible. Both are Thinking Machines&apos; own reported
          measurements.
        </p>
      </div>
    </figure>
  )
}
