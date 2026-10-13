"use client"

import { useState } from "react"

import { matan2, mcos, mhypot, msin } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// G(c) exactly as src/visual_rl/algorithms/covariance.py computes it in
// art_scalar_covariance (lines 66-107 at commit 016610f), shrunk to two
// dimensions so it can be drawn:
//
//   centered   = r - mean(r)                        per prompt group
//   numerator  = sum_i centered_i * x0_i
//   covariance = numerator / (K - 1)                reduction="unbiased"
//   G          = covariance / RMS(covariance)       unit RMS over coordinates
//
// The "historical" direction mode in the repo divides by the reward MAD
// before the RMS normalisation; a per-group scalar does not change the
// direction, so the arrow is the same. Pairwise mode is art_pairwise_covariance:
// endpoints are paired (the repo shuffles with a seeded randperm; here the
// pairs are fixed as 1-2, 3-4, ...), the higher score gets label 1 and the
// lower 0, a tie gets 0.5 each, and those labels replace the rewards.
//
// In the real model x0 is a latent with hundreds of thousands of coordinates;
// the arithmetic is identical.

const ACCENT = "oklch(0.62 0.16 45)"
const ALT = "oklch(0.55 0.14 240)"

// eight endpoints, fixed so the widget is deterministic
const PTS: [number, number][] = [
  [0.22, 0.3],
  [0.72, 0.68],
  [0.35, 0.78],
  [0.62, 0.22],
  [0.15, 0.6],
  [0.85, 0.42],
  [0.48, 0.5],
  [0.55, 0.88],
]
const START = [7, 2, 4, 5, 6, 3, 5, 1]

function guidance(xs: [number, number][], r: number[]): { g: [number, number]; active: boolean } {
  const K = xs.length
  const mean = r.reduce((a, b) => a + b, 0) / K
  let nx = 0
  let ny = 0
  for (let i = 0; i < K; i++) {
    const c = r[i] - mean
    nx += c * xs[i][0]
    ny += c * xs[i][1]
  }
  const cx = nx / Math.max(K - 1, 1)
  const cy = ny / Math.max(K - 1, 1)
  const rms = Math.sqrt((cx * cx + cy * cy) / 2)
  if (rms === 0) return { g: [0, 0], active: false }
  return { g: [cx / rms, cy / rms], active: true }
}

function pairLabels(r: number[]): number[] {
  const out = r.map(() => 0.5)
  for (let i = 0; i + 1 < r.length; i += 2) {
    if (r[i] > r[i + 1]) {
      out[i] = 1
      out[i + 1] = 0
    } else if (r[i] < r[i + 1]) {
      out[i] = 0
      out[i + 1] = 1
    }
  }
  return out
}

export function CovarianceGuide() {
  const [K, setK] = useState<2 | 4 | 8>(8)
  const [rewards, setRewards] = useState<number[]>(START)
  const [mode, setMode] = useState<"scalar" | "pairwise">("scalar")

  const xs = PTS.slice(0, K)
  const rs = rewards.slice(0, K)
  const scalar = guidance(xs, rs)
  const pair = guidance(xs, pairLabels(rs))
  const shown = mode === "scalar" ? scalar : pair
  const other = mode === "scalar" ? pair : scalar

  const angS = matan2(scalar.g[1], scalar.g[0])
  const angP = matan2(pair.g[1], pair.g[0])
  let diff = Math.abs(angS - angP) * (180 / Math.PI)
  if (diff > 180) diff = 360 - diff

  const W = 620
  const H = 360
  const PAD = 30
  const px = (v: number) => PAD + v * (W - 2 * PAD)
  const py = (v: number) => H - PAD - v * (H - 2 * PAD)

  const mx = xs.reduce((a, p) => a + p[0], 0) / K
  const my = xs.reduce((a, p) => a + p[1], 0) / K
  const ARROW = 0.16
  const tip = (g: [number, number]): [number, number] => {
    const n = mhypot(g[0], g[1]) || 1
    return [mx + (g[0] / n) * ARROW * 1.4, my + (g[1] / n) * ARROW * 1.4]
  }
  const head = (g: [number, number]) => {
    const [tx, ty] = tip(g)
    const X = px(tx)
    const Y = py(ty)
    const a = matan2(Y - py(my), X - px(mx))
    const h = 10
    return `${X.toFixed(1)},${Y.toFixed(1)} ${(X - h * mcos(a - 0.4)).toFixed(1)},${(Y - h * msin(a - 0.4)).toFixed(1)} ${(X - h * mcos(a + 0.4)).toFixed(1)},${(Y - h * msin(a + 0.4)).toFixed(1)}`
  }

  const maxR = 10
  const colourFor = (r: number) => `oklch(${(0.75 - (r / maxR) * 0.25).toFixed(3)} ${(0.04 + (r / maxR) * 0.12).toFixed(3)} 160)`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          G(c) for one prompt · covariance.py, in two dimensions
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          scalar vs pairwise direction differ by {scalar.active && pair.active ? `${diff.toFixed(1)}°` : "n/a"}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {([2, 4, 8] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setK(k)}
              aria-pressed={K === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                K === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              K = {k}
            </button>
          ))}
          {(["scalar", "pairwise"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m} rewards
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" className="mt-3 max-w-full">
          <title>
            {`${K} endpoints of one prompt, shaded by reward. The arrow from their mean is the normalised reward-endpoint covariance G under ${mode} rewards.`}
          </title>
          {K >= 4
            ? Array.from({ length: K / 2 }, (_, i) => (
                <line
                  key={i}
                  x1={px(xs[2 * i][0])}
                  y1={py(xs[2 * i][1])}
                  x2={px(xs[2 * i + 1][0])}
                  y2={py(xs[2 * i + 1][1])}
                  stroke="currentColor"
                  strokeOpacity={mode === "pairwise" ? 0.25 : 0.08}
                  strokeDasharray="3 3"
                />
              ))
            : null}
          {xs.map((p, i) => (
            <g key={i}>
              <circle cx={px(p[0])} cy={py(p[1])} r={13} fill={colourFor(rs[i])} stroke="currentColor" strokeOpacity={0.3} />
              <text x={px(p[0])} y={py(p[1]) + 4} fontSize={11} textAnchor="middle" fill="currentColor" fontFamily="ui-monospace, monospace">
                {i + 1}
              </text>
            </g>
          ))}
          <circle cx={px(mx)} cy={py(my)} r={4} fill="currentColor" />
          {other.active ? (
            <g opacity={0.45}>
              <line x1={px(mx)} y1={py(my)} x2={px(tip(other.g)[0])} y2={py(tip(other.g)[1])} stroke={ALT} strokeWidth={2} strokeDasharray="5 4" />
              <polygon points={head(other.g)} fill={ALT} />
            </g>
          ) : null}
          {shown.active ? (
            <g>
              <line x1={px(mx)} y1={py(my)} x2={px(tip(shown.g)[0])} y2={py(tip(shown.g)[1])} stroke={ACCENT} strokeWidth={3.2} />
              <polygon points={head(shown.g)} fill={ACCENT} />
            </g>
          ) : (
            <text x={px(mx) + 10} y={py(my) - 10} fontSize={11} fill={ACCENT} fontFamily="ui-monospace, monospace">
              all rewards equal: no guidance
            </text>
          )}
        </svg>

        <div className="mt-2 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
          {xs.map((_, i) => (
            <label key={i} className="flex items-center gap-2">
              <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">reward {i + 1}</span>
              <Range
                min={0}
                max={maxR}
                step={1}
                value={rewards[i]}
                onChange={(ev) => {
                  const next = rewards.slice()
                  next[i] = Number(ev.target.value)
                  setRewards(next)
                }}
                className="flex-1"
                aria-label={`reward of endpoint ${i + 1}`}
                accent={ACCENT}
              />
              <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums">{rewards[i]}</span>
            </label>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The solid arrow is G for the selected reward type; the faint dashed one is the other type, for
          comparison. G is a weighted sum of the endpoints, each weighted by how far its reward sits
          above or below the group mean, then rescaled to unit RMS so a reward model&rsquo;s scale never
          matters. At K = 2 the sum collapses to the winner minus the loser, so scalar and pairwise
          rewards give the same arrow whatever the scores are. At K = 8, pairwise labels throw away
          everything but who won each of four fixed pairs, and the arrow drifts.
        </p>
      </div>
    </figure>
  )
}
