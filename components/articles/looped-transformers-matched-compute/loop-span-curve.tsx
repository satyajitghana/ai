"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// SMELT's first design rule -- "loop the middle half, not the full stack" --
// is reported as a bare table (Table 3.3, arXiv 2609.01343 Sec. 3.3), with no
// chart of its own. These are every value in that table, exact: a 12-layer,
// 200M-active MoE backbone, sweeping which contiguous span loops twice from
// 0% (Baseline) to 100% (full-stack loop, Ouro's regime) at two sparsity
// levels. Validation loss bottoms out near 50% span at BOTH levels -- that's
// the rule SMELT locks in for every later experiment in the paper.

type Sparsity = "85" | "95"

const SPANS = [0, 17, 33, 50, 67, 83, 100]
const EFF_DEPTH = [12, 14, 16, 18, 20, 22, 24]

const DATA: Record<Sparsity, { valLoss: number[]; dclmCore: number[] }> = {
  "85": {
    valLoss: [1.9445, 1.9384, 1.9275, 1.9257, 1.9374, 1.9413, 1.9322],
    dclmCore: [24.92, 26.20, 25.13, 27.57, 25.84, 24.45, 25.31],
  },
  "95": {
    valLoss: [1.8735, 1.8562, 1.8524, 1.8517, 1.8544, 1.8572, 1.8601],
    dclmCore: [29.34, 30.84, 31.22, 29.68, 31.78, 31.49, 30.82],
  },
}

const ACCENT = "oklch(0.6 0.15 255)"
const W = 640
const H = 220
const MX = 44
const MY_TOP = 18
const MY_BOT = 34
const AREA_W = W - 2 * MX
const AREA_H = H - MY_TOP - MY_BOT

export function LoopSpanCurve() {
  const [s, setS] = useState<Sparsity>("95")
  const [hover, setHover] = useState<number | null>(null)
  const { valLoss } = DATA[s]

  const minIdx = valLoss.indexOf(Math.min(...valLoss))
  const activeIdx = hover ?? minIdx

  const { lo, hi } = useMemo(() => {
    const lo = Math.min(...valLoss)
    const hi = Math.max(...valLoss)
    const pad = (hi - lo) * 0.25 || 0.001
    return { lo: lo - pad, hi: hi + pad }
  }, [valLoss])

  const xAt = (i: number) => MX + (AREA_W * i) / (SPANS.length - 1)
  const yAt = (v: number) => MY_TOP + AREA_H * (1 - (v - lo) / (hi - lo))

  const path = SPANS.map((_, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(valLoss[i]).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">loop-span sweep · 200M, physical depth 12, loop ×2</span>
        <div className="flex gap-1">
          {(["85", "95"] as Sparsity[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setS(k)}
              aria-pressed={s === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                s === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              S≈{k}%
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Validation loss against loop span from 0% (Baseline, no looping) to 100% (full-stack loop) at compute-equivalent sparsity S≈${s}%. Loss is minimized near 50% span.`}
        >
          <line x1={MX} y1={H - MY_BOT} x2={W - MX} y2={H - MY_BOT} stroke="currentColor" strokeOpacity="0.15" />
          <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} />
          {SPANS.map((sp, i) => {
            const isActive = i === activeIdx
            const isMin = i === minIdx
            return (
              <g key={sp}>
                <circle
                  cx={xAt(i)}
                  cy={yAt(valLoss[i])}
                  r={isActive ? 6 : 4}
                  fill={isMin ? ACCENT : "var(--background)"}
                  stroke={ACCENT}
                  strokeWidth={1.6}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                <rect
                  x={xAt(i) - (AREA_W / (SPANS.length - 1)) / 2}
                  y={MY_TOP}
                  width={AREA_W / (SPANS.length - 1)}
                  height={AREA_H}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                <text x={xAt(i)} y={H - MY_BOT + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
                  {sp}%
                </text>
              </g>
            )
          })}
          <text x={MX} y={12} className="fill-muted-foreground font-mono" fontSize={9}>
            val. loss (lower is better) — auto-scaled to this sweep&rsquo;s range
          </text>
          {minIdx === activeIdx ? (
            <text x={xAt(minIdx)} y={yAt(valLoss[minIdx]) - 12} textAnchor="middle" className="font-mono font-semibold" fontSize={10} style={{ fill: ACCENT }}>
              adopted
            </text>
          ) : null}
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 font-mono text-[10px]">
          <div>
            <div className="text-muted-foreground">span</div>
            <div className="text-foreground">{SPANS[activeIdx]}% of 12 layers</div>
          </div>
          <div>
            <div className="text-muted-foreground">effective depth</div>
            <div className="text-foreground">{EFF_DEPTH[activeIdx]} layers</div>
          </div>
          <div>
            <div className="text-muted-foreground">val. loss</div>
            <div className="text-foreground">
              {valLoss[activeIdx].toFixed(4)} {activeIdx === minIdx ? "(minimum)" : ""}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Hover a point. At both sparsity levels the curve dips near <strong className="text-foreground">50% span</strong> —
          loop the middle 6 of 12 layers twice, not all 12 (100%, Ouro&rsquo;s regime) or none (0%, Baseline). That minimum
          is why SMELT loops a middle span rather than the full stack: the first and last layers do specialized work that
          repetition doesn&rsquo;t improve.
        </p>
      </div>
    </figure>
  )
}
