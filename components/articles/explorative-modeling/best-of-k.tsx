"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Forward XM as a diagram: L(θ) = min_{i in 1..K} J(ŷ_i, x). The model emits K
// candidate generations for the same data target x; every candidate's distance
// to x is scored, and only the closest one gets a gradient. Drag K and watch the
// best-of-K error ratchet down (never up — revealing more candidates can only
// help) while the "no grad" pile grows. Candidate offsets are a fixed, ordered
// list (not randomness at runtime) so the demo is deterministic and SSR-safe.

const ACCENT = "oklch(0.66 0.15 165)" // winner / kept gradient
const MUTED = "oklch(0.60 0.02 260)" // scored but discarded

// ŷ_i − x, a fixed generation order (not sorted by quality — exploration doesn't
// know which candidate will land closest ahead of time).
const OFFSETS = [62, -45, 30, -78, 15, 54, -22, 8, -63, 41, -12, 70, -35, 5, -50, 27]
const N = OFFSETS.length

const W = 640
const H = 300
const TOP = 30
const ROWH = 15.5
const TX = 470 // data-target line
const MODEL_X = 26
const MODEL_W = 82
const rowY = (i: number) => TOP + i * ROWH + ROWH / 2

export function BestOfK() {
  const [k, setK] = useState(4)

  const revealed = OFFSETS.slice(0, k)
  const winnerIdx = revealed.reduce(
    (best, v, i) => (Math.abs(v) < Math.abs(revealed[best]) ? i : best),
    0
  )
  const bestErr = Math.abs(revealed[winnerIdx])
  const modelCY = TOP + (k * ROWH) / 2

  const curve = (x2: number, y2: number) => {
    const x1 = MODEL_X + MODEL_W
    const y1 = modelCY
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        forward xm · one training step, K candidates, one gradient
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Model generates ${k} candidates for the same data target. The closest, at distance ${bestErr}, receives the gradient; the other ${k - 1} do not.`}
        >
          <defs>
            <filter id="bok-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* target line */}
          <line x1={TX} x2={TX} y1={10} y2={H - 8} stroke="currentColor" className="text-border" strokeDasharray="3 3" strokeWidth={1.2} />
          <text x={TX} y={20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10.5}>
            data target x
          </text>

          {/* faint locked slots not yet explored */}
          {OFFSETS.map((off, i) =>
            i >= k ? (
              <circle key={i} cx={TX + off} cy={rowY(i)} r={3} fill="var(--muted-foreground)" opacity={0.14} />
            ) : null
          )}

          {/* connectors + revealed candidates, drawn back to front so the winner sits on top */}
          {revealed.map((off, i) => {
            const win = i === winnerIdx
            const y = rowY(i)
            const x = TX + off
            return (
              <g key={i} opacity={win ? 1 : 0.55}>
                <path d={curve(x, y)} fill="none" stroke={win ? ACCENT : MUTED} strokeWidth={win ? 2 : 1} strokeDasharray={win ? undefined : "3 3"} />
                <line x1={x} x2={TX} y1={y} y2={y} stroke={win ? ACCENT : "var(--border)"} strokeWidth={win ? 1.5 : 1} />
                <circle cx={x} cy={y} r={win ? 5 : 3.5} fill={win ? ACCENT : "var(--background)"} stroke={win ? ACCENT : MUTED} strokeWidth={1.3} filter={win ? "url(#bok-soft)" : undefined} />
              </g>
            )
          })}

          {/* winner label */}
          <text x={TX + OFFSETS[winnerIdx] + (OFFSETS[winnerIdx] >= 0 ? 10 : -10)} y={rowY(winnerIdx) + 4} textAnchor={OFFSETS[winnerIdx] >= 0 ? "start" : "end"} className="font-mono font-semibold" fontSize={10.5} fill={ACCENT}>
            ŷ{winnerIdx + 1} · err {bestErr}
          </text>

          {/* model node */}
          <rect x={MODEL_X} y={modelCY - 20} width={MODEL_W} height={40} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#bok-soft)" className="transition-all duration-200" />
          <text x={MODEL_X + MODEL_W / 2} y={modelCY - 3} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            model
          </text>
          <text x={MODEL_X + MODEL_W / 2} y={modelCY + 11} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            Gθ
          </text>
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground">
            K = <span className="font-semibold text-foreground">{k}</span>
          </span>
          <span className="text-muted-foreground">
            best-of-K error: <span className="font-semibold" style={{ color: ACCENT }}>{bestErr}</span>
          </span>
          <span className="text-muted-foreground">
            gradient flows to <span className="text-foreground">1</span>{" "}of <span className="text-foreground">{k}</span>
          </span>
          <span className="ml-auto text-muted-foreground">
            compute this step: <span className="text-foreground">{k}×</span>{" "}a generation pass
          </span>
        </div>

        <label className="mt-3 block">
          <span className="sr-only">candidates explored, K</span>
          <Range min={1} max={N} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every candidate is scored against the same target; only the nearest one back-propagates, the rest are dead
          ends for this step. Pulling K up can only tighten the best-of-K error, never loosen it — but each extra
          candidate is a full generation, so the win is bought with training-time compute,{" "}
          <span className="text-foreground">once</span>, not with a longer inference pipeline you pay for on every
          sample.
        </p>
      </div>
    </figure>
  )
}
