"use client"

import { useState } from "react"

// Why the hybrid design is a long-context win. In a full-attention model every layer's KV cache
// grows with the context length. In MiMo-V2-Flash, 5 of every 6 layers are sliding-window: their
// KV cache is CAPPED at the 128-token window and stops growing. Only the 1-in-6 global layers keep
// scaling. So at long context the cache is dominated by that 1/6, and the whole thing grows ~6×
// slower — which is what lets a 256K context stay cheap. Drag the context length and read the cache
// sizes and the ratio. Relative units; the shape, not the exact bytes, is the point.

const WINDOW = 128 // tokens
const RATIO_SWA = 5 // 5 SWA per 1 GA
const RATIO_GA = 1
const FRAC_SWA = RATIO_SWA / (RATIO_SWA + RATIO_GA) // 5/6
const FRAC_GA = RATIO_GA / (RATIO_SWA + RATIO_GA) // 1/6

const FULL = "oklch(0.68 0.03 60)"
const HY = "oklch(0.72 0.15 195)"

export function SwaKvCache() {
  const [ctxK, setCtxK] = useState(128)

  const MAXK = 256
  const ctx = ctxK * 1000
  const full = ctx
  const hybrid = FRAC_SWA * Math.min(ctx, WINDOW) + FRAC_GA * ctx
  const ratio = full / hybrid

  const W = 640
  const H = 240
  const padL = 34
  const padR = 16
  const padT = 18
  const padB = 40
  const maxCtx = MAXK * 1000
  const sx = (k: number) => padL + (k / MAXK) * (W - padL - padR)
  const sy = (v: number) => padT + (1 - v / maxCtx) * (H - padT - padB)

  const hybridAt = (k: number) => FRAC_SWA * Math.min(k * 1000, WINDOW) + FRAC_GA * (k * 1000)
  const fullPts = Array.from({ length: 41 }, (_, i) => {
    const k = (i / 40) * MAXK
    return [sx(k), sy(k * 1000)] as const
  })
  const hybridPts = Array.from({ length: 41 }, (_, i) => {
    const k = (i / 40) * MAXK
    return [sx(k), sy(hybridAt(k))] as const
  })
  const line = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  // savings band = area between the two curves
  const band = `${line(fullPts)} ${hybridPts.slice().reverse().map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} Z`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>KV cache growth · full attention vs 5:1 hybrid</span>
        <span className="text-muted-foreground/60">relative units · illustrative</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="KV cache vs context: full attention grows linearly; the hybrid grows about six times slower because five of six layers are capped at the sliding window.">
          <defs>
            <filter id="kv-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={padL} x2={W - padR} y1={sy(g * maxCtx)} y2={sy(g * maxCtx)} stroke="currentColor" className="text-border" strokeWidth={1} opacity={g === 0 ? 0.6 : 0.35} />
          ))}

          {/* x ticks */}
          {[0, 64, 128, 192, 256].map((k) => (
            <text key={k} x={sx(k)} y={H - padB + 15} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">{k}K</text>
          ))}
          <text x={(padL + W - padR) / 2} y={H - 5} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">context length →</text>
          <text x={12} y={padT + 2} className="font-mono" fontSize={9} fill="var(--muted-foreground)" transform={`rotate(-90 12 ${padT + 2})`}>KV cache</text>

          {/* savings band between the curves */}
          <path d={band} fill={HY} opacity={0.08} />

          {/* curves */}
          <path d={line(fullPts)} fill="none" stroke={FULL} strokeWidth={2.25} strokeLinecap="round" />
          <path d={line(hybridPts)} fill="none" stroke={HY} strokeWidth={2.75} strokeLinecap="round" />

          <text x={sx(232)} y={sy((232 / MAXK) * maxCtx) - 7} textAnchor="end" className="font-mono" fontSize={9.5} fill={FULL}>full attention</text>
          <text x={sx(250)} y={sy(hybridAt(250)) - 8} textAnchor="end" className="font-mono" fontSize={9.5} fill={HY}>MiMo hybrid</text>

          {/* current-context guide + markers */}
          <line x1={sx(ctxK)} y1={padT} x2={sx(ctxK)} y2={H - padB} stroke="currentColor" className="text-foreground/25" strokeDasharray="3 3" strokeWidth={1} />
          <circle cx={sx(ctxK)} cy={sy(full)} r={4.5} fill={FULL} stroke="var(--background)" strokeWidth={1.5} filter="url(#kv-soft)" />
          <circle cx={sx(ctxK)} cy={sy(hybrid)} r={4.5} fill={HY} stroke="var(--background)" strokeWidth={1.5} filter="url(#kv-soft)" />
        </svg>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length</span>
            <span className="tabular-nums text-foreground">{ctxK}K tokens</span>
          </div>
          <input type="range" min={4} max={MAXK} step={4} value={ctxK} onChange={(e) => setCtxK(+e.target.value)} className="w-full cursor-pointer accent-[oklch(0.72_0.15_195)]" aria-label="context length" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>full-attention cache <span className="tabular-nums" style={{ color: FULL }}>1.00×</span></span>
          <span>hybrid cache <span className="tabular-nums" style={{ color: HY }}>{(hybrid / full).toFixed(2)}×</span></span>
          <span className="ml-auto text-foreground">{ratio.toFixed(1)}× smaller</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The five sliding-window layers per block stop growing once the context passes the
          128-token window, so at {ctxK}K tokens only the 1-in-6 global layers still scale — the
          cache is <span className="text-foreground">{ratio.toFixed(1)}× smaller</span> than a
          full-attention model of the same depth. That&apos;s most of why a 309B model serves 256K
          context at 150 tokens/second.
        </p>
      </div>
    </figure>
  )
}
