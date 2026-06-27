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

function expectedG(alpha: number, n: number) {
  let g = 1
  let term = 1
  for (let i = 1; i <= n; i++) {
    term *= alpha
    g += term
  }
  return g
}

export function MTPSpeedup() {
  const [alpha, setAlpha] = useState(0.7)
  const [n, setN] = useState(4)

  const g = expectedG(alpha, n)
  // curve of g vs block size 1..8 at the current alpha
  const NS = Array.from({ length: 8 }, (_, i) => i + 1)
  const curve = NS.map((k) => expectedG(alpha, k))
  const gmax = expectedG(alpha, 64) // asymptote = 1 + α/(1-α)
  const W = 360
  const H = 120
  const pad = 24
  const sx = (k: number) => pad + ((k - 1) / 7) * (W - 2 * pad)
  const sy = (v: number) => H - pad - ((v - 1) / (gmax - 1 || 1)) * (H - 2 * pad)
  const path = curve
    .map((v, i) => `${i === 0 ? "M" : "L"}${sx(NS[i]).toFixed(1)},${sy(v).toFixed(1)}`)
    .join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        self-speculative decoding · expected tokens per target forward
      </div>

      <div className="space-y-4 p-4">
        {/* curve */}
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Expected accepted tokens per forward as a function of block size, flattening toward an asymptote." className="w-full">
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" strokeWidth="1" />
          <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--border)" strokeWidth="1" />
          {/* asymptote */}
          <line x1={pad} y1={sy(gmax)} x2={W - pad} y2={sy(gmax)} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <text x={W - pad} y={sy(gmax) - 4} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
            ceiling {gmax.toFixed(1)}
          </text>
          <path d={path} fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
          {/* current-n marker */}
          <circle cx={sx(n)} cy={sy(g)} r="4" fill="oklch(0.72 0.15 195)" />
          <text x={pad - 6} y={H - pad + 3} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">1</text>
          <text x={sx(1)} y={H - pad + 12} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">n=1</text>
          <text x={sx(8)} y={H - pad + 12} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">n=8</text>
        </svg>

        {/* alpha slider */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>per-position acceptance α</span>
            <span className="text-foreground tabular-nums">{alpha.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.01}
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-foreground"
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
                n === k
                  ? "border-transparent bg-foreground text-background"
                  : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="tokens / forward" value={`${g.toFixed(2)}×`} />
          <Stat label="marginal (n→n+1)" value={`+${(expectedG(alpha, n + 1) - g).toFixed(2)}`} />
          <Stat label="ceiling (n→∞)" value={`${gmax.toFixed(1)}×`} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  )
}
