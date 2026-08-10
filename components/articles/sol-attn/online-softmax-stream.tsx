"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

// The part that makes Sol-Attn a single kernel instead of a routing stage plus an
// attention stage: block-proxy scores are consumed AS THEY STREAM, not gathered
// into a map first. Drag the scan position and watch the outer loop decide each
// key-value block on the spot — above threshold, dispatch to the exact inner loop;
// below threshold, don't drop it, fold its pooled-key score into the SAME running
// softmax accumulator as a cheap zeroth-order stand-in. Nothing to the right of the
// cursor has been looked at yet, which is the point: no full row, no proxy map.
// Coverage numbers below are an illustrative reading of the paper's ablation
// (Figure 9: exact-or-approx keeps far more of the dense softmax mass than
// exact-only / keep-or-drop at the same sparsity), not a re-measurement.

const N = 18
const EXACT = "oklch(0.62 0.15 155)"
const APPROX = "oklch(0.72 0.14 70)"
const UNSEEN = "oklch(0.55 0.02 260)"
const APPROX_RECOVERY = 0.82 // illustrative: fraction of a dropped block's mass the zeroth-order term recovers

function rawScore(i: number) {
  const t = i / (N - 1)
  return 0.55 + 0.9 * msin(t * 9.5 + 0.5) * mcos(t * 2.6) + 0.3 * msin(t * 15 + 1.2)
}

const SCORES = Array.from({ length: N }, (_, i) => rawScore(i))
const MEAN = SCORES.reduce((a, b) => a + b, 0) / N
const STD = Math.sqrt(SCORES.reduce((a, b) => a + (b - MEAN) ** 2, 0) / N)

// ── geometry ──
const W = 700
const H = 190
const MX = 30
const BW = 28
const GAP = (W - 2 * MX - N * BW) / (N - 1)
const BASE = 108
const MAXH = 62
const bx = (i: number) => MX + i * (BW + GAP)
const cx = (i: number) => bx(i) + BW / 2
const lo = Math.min(...SCORES)
const hi = Math.max(...SCORES)
const barH = (s: number) => Math.max(((s - lo) / (hi - lo)) * MAXH, 4)

export function OnlineSoftmaxStream() {
  const [cursor, setCursor] = useState(7)
  const [betaLevel, setBetaLevel] = useState<0 | 1>(0)
  const beta = betaLevel === 0 ? 0.6 : 1.3
  const tau = MEAN + beta * STD

  const streamed = Array.from({ length: cursor }, (_, i) => i)
  const exactIdx = streamed.filter((i) => SCORES[i] > tau)
  const approxIdx = streamed.filter((i) => SCORES[i] <= tau)

  const nExact = exactIdx.length
  const nApprox = approxIdx.length
  const seen = nExact + nApprox
  const solCoverage = seen === 0 ? 100 : ((nExact * 1 + nApprox * APPROX_RECOVERY) / seen) * 100
  const dropCoverage = seen === 0 ? 100 : ((nExact * 1) / seen) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>online-softmax stream · decide on the fly, don&apos;t drop</span>
        <span className="text-muted-foreground/50">synthetic, illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Streamed ${seen} of ${N} pooled-key blocks: ${nExact} dispatched to exact attention, ${nApprox} approximated from their proxy score.`}>
          <defs>
            <filter id="os-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodOpacity="0.14" />
            </filter>
          </defs>

          <line x1={MX - 6} y1={BASE} x2={W - MX + 6} y2={BASE} stroke="var(--border)" strokeWidth={1} />
          <line x1={MX - 6} y1={BASE - ((tau - lo) / (hi - lo)) * MAXH} x2={W - MX + 6} y2={BASE - ((tau - lo) / (hi - lo)) * MAXH} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />

          {SCORES.map((s, i) => {
            const isStreamed = i < cursor
            const isCurrent = i === cursor
            const isExact = isStreamed && s > tau
            const fill = !isStreamed ? UNSEEN : isExact ? EXACT : APPROX
            const opacity = !isStreamed ? 0.16 : 0.9
            return (
              <g key={i}>
                <rect
                  x={bx(i)}
                  y={BASE - barH(s)}
                  width={BW}
                  height={barH(s)}
                  rx={4}
                  fill={fill}
                  opacity={opacity}
                  filter={isStreamed ? "url(#os-soft)" : undefined}
                  stroke={isCurrent ? "var(--foreground)" : "none"}
                  strokeWidth={1.5}
                  className="transition-all duration-300"
                />
                {isStreamed && (
                  <text x={cx(i)} y={BASE + 14} textAnchor="middle" className="font-mono" fontSize={8} fill={isExact ? EXACT : APPROX}>
                    {isExact ? "exact" : "≈"}
                  </text>
                )}
              </g>
            )
          })}

          {/* scan cursor marker */}
          <line x1={bx(Math.min(cursor, N - 1)) - GAP / 2} y1={20} x2={bx(Math.min(cursor, N - 1)) - GAP / 2} y2={BASE + 24} stroke="var(--foreground)" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
          <text x={bx(Math.min(cursor, N - 1)) - GAP / 2} y={14} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--foreground)">scan →</text>
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">sparsity target</span>
            {(["low β", "high β"] as const).map((label, i) => (
              <button key={label} type="button" onClick={() => setBetaLevel(i as 0 | 1)} aria-pressed={betaLevel === i}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", betaLevel === i ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            <span style={{ color: EXACT }}>{nExact} exact</span> · <span style={{ color: APPROX }}>{nApprox} approx</span>{" "}of {seen} streamed
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>scan position</span>
            <span className="text-foreground">{cursor} / {N}</span>
          </div>
          <Range min={0} max={N} value={cursor} onChange={(e) => setCursor(Number(e.target.value))} className="w-full cursor-pointer" accent={EXACT} />
        </div>

        <div className="mt-4 space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>Sol-Attn · exact-or-approx (nothing dropped)</span>
              <span className="text-foreground">{solCoverage.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${solCoverage}%`, background: EXACT }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>keep-or-drop · exact-only (below-threshold blocks vanish)</span>
              <span className="text-foreground">{dropCoverage.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${dropCoverage}%`, background: "var(--muted-foreground)" }} />
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every block left of the scan cursor has already been decided — dispatched to the exact inner loop
          (<span style={{ color: EXACT }}>green</span>) or, if its pooled-key score fell below the threshold,{" "}
          <span style={{ color: APPROX }}>approximated</span>{" "}from that same score via a zeroth-order Taylor term
          and folded into the identical online-softmax accumulator. Nothing right of the cursor has been read
          yet — that is what &ldquo;on-the-fly&rdquo; means. The two bars below are the payoff: keep-or-drop
          sparse attention only ever covers the exact fraction of the softmax mass, while reusing the proxy
          scores keeps coverage close to complete even as the exact budget shrinks (coverage numbers here are
          illustrative; the paper measures the same effect as relative ℓ2 error and cosine similarity in its
          Figure 9 ablation).
        </p>
      </div>
    </figure>
  )
}
