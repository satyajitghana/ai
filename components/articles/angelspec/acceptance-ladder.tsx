"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// MTP + Training-Time Test (TTT), position by position. AngelSpec's MTP drafter
// predicts D positions ahead; a token at position k only counts if positions
// 1..k-1 also survived, so mean accepted length (MAL) is 1 (bonus token) plus
// the cumulative acceptance probabilities p_1..p_D summed. Numbers are the
// paper's own reported aggregate (Table 2, T=0, mean over 7 benchmarks):
// Base p1/p2/p3 = 0.799/0.518/0.266 (MAL 2.58); TTT+Rollout = 0.814/0.653/0.524
// (MAL 2.99). Position 1 barely moves; positions 2 and 3 — the ones that decay
// fastest without TTT — do almost all the work. Drag k to build up the ladder
// one position at a time and watch where the gap actually opens.

const BASE_ACC = "oklch(0.60 0.02 260)"
const TTT_ACC = "oklch(0.64 0.16 200)"

const BASE_P = [0.799, 0.518, 0.266]
const TTT_P = [0.814, 0.653, 0.524]
const LABELS = ["d1", "d2", "d3"]

const r2 = (n: number) => Math.round(n * 100) / 100

// scene geometry
const W = 720
const H = 210
const ROW_BASE_Y = 46
const ROW_TTT_Y = 130
const CHIP_W = 76
const CHIP_H = 40
const GAP = 14
const START_X = 150
const chipX = (i: number) => START_X + i * (CHIP_W + GAP)
const chipCX = (i: number) => chipX(i) + CHIP_W / 2

export function AcceptanceLadder() {
  const [k, setK] = useState(2)

  const malBase = r2(1 + BASE_P.slice(0, k).reduce((a, b) => a + b, 0))
  const malTtt = r2(1 + TTT_P.slice(0, k).reduce((a, b) => a + b, 0))
  const delta = r2(TTT_P[k - 1] - BASE_P[k - 1])

  const row = (y: number, accent: string, label: string, probs: number[], mal: number) => (
    <g>
      <text x={START_X - 14} y={y + CHIP_H / 2 + 4} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
        {label}
      </text>
      {/* bonus token, always kept */}
      <rect x={chipX(0) - CHIP_W - GAP} y={y} width={CHIP_W} height={CHIP_H} rx={8} fill="none" stroke={accent} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
      <text x={chipCX(0) - CHIP_W - GAP} y={y + CHIP_H / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fill={accent}>
        +1
      </text>
      {LABELS.map((lb, i) => {
        const revealed = i < k
        const p = probs[i]
        const active = i === k - 1
        return (
          <g key={i} className="transition-all duration-300">
            <rect
              x={chipX(i)}
              y={y}
              width={CHIP_W}
              height={CHIP_H}
              rx={8}
              fill={accent}
              opacity={revealed ? 0.18 + 0.72 * p : 0.08}
              stroke={active ? accent : "transparent"}
              strokeWidth={2}
            />
            <text x={chipCX(i)} y={y + 16} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} fill={revealed ? "var(--foreground)" : "var(--muted-foreground)"}>
              {lb}
            </text>
            <text x={chipCX(i)} y={y + 30} textAnchor="middle" className="font-mono" fontSize={9} fill={revealed ? "var(--foreground)" : "var(--muted-foreground)"} opacity={revealed ? 0.85 : 0.5}>
              {revealed ? p.toFixed(3) : "—"}
            </text>
          </g>
        )
      })}
      {/* MAL readout */}
      <text x={chipX(3) + CHIP_W + 22} y={y + CHIP_H / 2 + 4} className="font-mono" fontSize={12} fontWeight={600} fill={accent}>
        MAL {mal.toFixed(2)}
      </text>
    </g>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>MTP + TTT · position-wise acceptance</span>
        <span className="text-muted-foreground/50">Hy3, T=0, mean over 7 benchmarks</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Through position ${k}, base MTP reaches mean accepted length ${malBase.toFixed(2)} and TTT plus rollout reaches ${malTtt.toFixed(2)}. At position ${k} alone, TTT improves acceptance by ${delta.toFixed(3)}.`}>
          {row(ROW_BASE_Y, BASE_ACC, "Base", BASE_P, malBase)}
          {row(ROW_TTT_Y, TTT_ACC, "TTT+Rollout", TTT_P, malTtt)}

          {/* active-position bracket + delta callout */}
          <line x1={chipCX(k - 1)} y1={ROW_BASE_Y + CHIP_H + 4} x2={chipCX(k - 1)} y2={ROW_TTT_Y - 4} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <text x={chipCX(k - 1)} y={(ROW_BASE_Y + CHIP_H + ROW_TTT_Y) / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={TTT_ACC}>
            Δ {delta >= 0 ? "+" : ""}{delta.toFixed(3)}
          </text>

          <text x={START_X - 14} y={H - 10} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            position →
          </text>
          {LABELS.map((lb, i) => (
            <text key={i} x={chipCX(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9} opacity={i < k ? 1 : 0.4}>
              k={i + 1}
            </text>
          ))}
        </svg>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>build up through position k</span>
              <span className="tabular-nums text-foreground">k = {k}</span>
            </div>
            <Range min={1} max={3} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full cursor-pointer" accent={TTT_ACC} />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag to <span className="text-foreground">k = 1</span>: base and TTT+Rollout are almost the
          same — the first drafted token was never the problem. Push to{" "}
          <span className="text-foreground">k = 2</span>{" "}and{" "}
          <span className="text-foreground">k = 3</span>{" "}and the gap opens: those are the positions
          where the draft used to be conditioning on its <em>own</em>{" "}
          unconstrained rollout, and TTT is exactly the fix — train on that rollout instead of a
          one-step target. Cumulative acceptance across all three positions turns into{" "}
          <span style={{ color: TTT_ACC }}>mean accepted length</span>, so a gap concentrated at k=2,3
          moves MAL from 2.58 to 2.99 — most of the win, from the positions that used to decay fastest.
        </p>
      </div>
    </figure>
  )
}
