"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why bigger n stops helping. In self-speculative decoding the model drafts n
// tokens and the target accepts the longest correct prefix. If each drafted
// position is accepted with probability ~α (and acceptance compounds along the
// block), the expected tokens produced per target forward is
//   g = 1 + Σ_{i=1..n} α^i        (the +1 is the always-correct bonus token)
// so the marginal gain of the i-th draft decays like α^i. Drag α and n and watch
// the curve flatten. Illustrative model of the real accept dynamics.

const ACCENT = "oklch(0.68 0.14 205)"

function expectedG(alpha: number, n: number) {
  let g = 1
  let term = 1
  for (let i = 1; i <= n; i++) {
    term *= alpha
    g += term
  }
  return g
}

// chart geometry (viewBox units)
const W = 520
const H = 200
const padL = 44
const padR = 20
const padT = 18
const padB = 34
const NS = Array.from({ length: 8 }, (_, i) => i + 1)

export function MTPSpeedup() {
  const [alpha, setAlpha] = useState(0.7)
  const [n, setN] = useState(4)

  const g = expectedG(alpha, n)
  const curve = NS.map((k) => expectedG(alpha, k))
  const gmax = expectedG(alpha, 64) // asymptote = 1 + α/(1-α)
  const top = Math.max(gmax, curve[curve.length - 1] * 1.05)

  const sx = (k: number) => padL + ((k - 1) / 7) * (W - padL - padR)
  const sy = (v: number) => H - padB - ((v - 1) / (top - 1 || 1)) * (H - padT - padB)

  const line = curve.map((v, i) => `${i === 0 ? "M" : "L"}${sx(NS[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")
  const area = `${line} L${sx(8).toFixed(1)},${(H - padB).toFixed(1)} L${sx(1).toFixed(1)},${(H - padB).toFixed(1)} Z`

  // a few horizontal gridlines across the value domain
  const gridVals = [1, 1 + (top - 1) * 0.33, 1 + (top - 1) * 0.66, top]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        self-speculative decoding · expected tokens per target forward
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Expected accepted tokens per forward versus draft block size, at acceptance ${alpha.toFixed(2)}, flattening toward a ceiling of ${gmax.toFixed(1)}.`}>
          <defs>
            <linearGradient id="ms-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
            <filter id="ms-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* gridlines + y labels */}
          {gridVals.map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text x={padL - 6} y={sy(v) + 3} textAnchor="end" fill="var(--muted-foreground)" className="font-mono" fontSize={9}>
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* asymptote */}
          {gmax <= top + 0.01 && (
            <>
              <line x1={padL} y1={sy(gmax)} x2={W - padR} y2={sy(gmax)} stroke={ACCENT} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
              <text x={W - padR} y={sy(gmax) - 5} textAnchor="end" fill={ACCENT} className="font-mono" fontSize={9}>
                ceiling {gmax.toFixed(1)}×
              </text>
            </>
          )}

          {/* area + curve */}
          <path d={area} fill="url(#ms-fill)" />
          <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} />

          {/* points at each n */}
          {NS.map((k, i) => (
            <circle key={k} cx={sx(k)} cy={sy(curve[i])} r={k === n ? 5 : 2.6} fill={k === n ? ACCENT : "var(--background)"} stroke={ACCENT} strokeWidth={1.5} filter={k === n ? "url(#ms-soft)" : undefined} />
          ))}
          {/* current-n readout label */}
          <text x={sx(n)} y={sy(g) - 10} textAnchor="middle" fill="var(--foreground)" className="font-mono" fontSize={10} fontWeight={600}>
            {g.toFixed(2)}×
          </text>

          {/* x axis */}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--border)" strokeWidth={1} />
          {NS.map((k) => (
            <text key={k} x={sx(k)} y={H - padB + 13} textAnchor="middle" fill={k === n ? ACCENT : "var(--muted-foreground)"} className="font-mono" fontSize={9} fontWeight={k === n ? 600 : 400}>
              {k}
            </text>
          ))}
          <text x={(padL + W - padR) / 2} y={H - 3} textAnchor="middle" fill="var(--muted-foreground)" className="font-mono" fontSize={9}>
            draft block size n →
          </text>
        </svg>

        {/* alpha slider */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>per-position acceptance α</span>
            <span className="tabular-nums text-foreground">{alpha.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.01}
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-[oklch(0.68_0.14_205)]"
            aria-label="per-position acceptance probability"
          />
        </div>

        {/* n selector */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">block size n =</span>
          {[1, 2, 3, 4, 6, 8].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setN(k)}
              aria-pressed={n === k}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                n === k ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>tokens / forward <span style={{ color: ACCENT }}>{g.toFixed(2)}×</span></span>
          <span>marginal (n→n+1) <span className="text-foreground">+{(expectedG(alpha, n + 1) - g).toFixed(2)}</span></span>
          <span>ceiling (n→∞) <span className="text-foreground">{gmax.toFixed(1)}×</span></span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The gain from the i-th drafted token decays like α<sup>i</sup>, so the curve
          saturates at 1 + α/(1−α) no matter how long you draft. High acceptance pushes
          the ceiling up; low acceptance means even n=8 barely beats n=2. That decay is
          exactly why n≈4 is the practical sweet spot — and why a more coherent drafter
          (higher α) buys more than a longer one.
        </p>
      </div>
    </figure>
  )
}
