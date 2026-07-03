"use client"

import { useState } from "react"

// Why the hybrid design is a long-context win. In a full-attention model every layer's
// KV cache grows with the context length. In MiMo-V2-Flash, 5 of every 6 layers are
// sliding-window: their KV cache is CAPPED at the 128-token window and stops growing.
// Only the 1-in-6 global layers keep scaling. So at long context the cache is dominated
// by that 1/6, and the whole thing grows ~6× slower — which is what lets a 256K context
// stay cheap. Drag the context length and read the cache sizes and the ratio.

const WINDOW = 128 // tokens
const RATIO_SWA = 5 // 5 SWA per 1 GA
const RATIO_GA = 1
const FRAC_SWA = RATIO_SWA / (RATIO_SWA + RATIO_GA) // 5/6
const FRAC_GA = RATIO_GA / (RATIO_SWA + RATIO_GA) // 1/6

export function SwaKvCache() {
  const [ctxK, setCtxK] = useState(128)

  const MAXK = 256
  const ctx = ctxK * 1000
  // relative KV cache per layer-token unit
  const full = ctx
  const hybrid = FRAC_SWA * Math.min(ctx, WINDOW) + FRAC_GA * ctx
  const ratio = full / hybrid

  const W = 600
  const H = 220
  const padL = 30
  const padR = 16
  const padT = 14
  const padB = 34
  const maxCtx = MAXK * 1000
  const sx = (k: number) => padL + (k / MAXK) * (W - padL - padR)
  const sy = (v: number) => padT + (1 - v / maxCtx) * (H - padT - padB)

  const hybridAt = (k: number) => FRAC_SWA * Math.min(k * 1000, WINDOW) + FRAC_GA * (k * 1000)
  const fullLine = `${sx(0)},${sy(0)} ${sx(MAXK)},${sy(maxCtx)}`
  const hybridLine = Array.from({ length: 41 }, (_, i) => {
    const k = (i / 40) * MAXK
    return `${sx(k)},${sy(hybridAt(k))}`
  }).join(" ")

  const FULL = "oklch(0.7 0.04 40)"
  const HY = "oklch(0.72 0.15 195)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">KV cache growth · full attention vs 5:1 hybrid</div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="KV cache vs context: full attention grows linearly; the hybrid grows about six times slower because five of six layers are capped at the sliding window.">
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          {[0, 64, 128, 192, 256].map((k) => (
            <text key={k} x={sx(k)} y={H - padB + 14} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.5">{k}K</text>
          ))}
          <text x={(W) / 2} y={H - 3} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.45">context length</text>

          <polyline points={fullLine} fill="none" stroke={FULL} strokeWidth="2" />
          <polyline points={hybridLine} fill="none" stroke={HY} strokeWidth="2.5" />
          <text x={sx(232)} y={sy(maxCtx * 232 / MAXK) - 6} textAnchor="end" fontFamily="monospace" fontSize="9.5" fill={FULL}>full attention</text>
          <text x={sx(250)} y={sy(hybridAt(250)) - 6} textAnchor="end" fontFamily="monospace" fontSize="9.5" fill={HY}>MiMo hybrid</text>

          <line x1={sx(ctxK)} y1={padT} x2={sx(ctxK)} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" />
          <circle cx={sx(ctxK)} cy={sy(full)} r="4" fill={FULL} />
          <circle cx={sx(ctxK)} cy={sy(hybrid)} r="4" fill={HY} />
        </svg>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length</span>
            <span className="tabular-nums text-foreground">{ctxK}K tokens</span>
          </div>
          <input type="range" min={4} max={MAXK} step={4} value={ctxK} onChange={(e) => setCtxK(+e.target.value)} className="w-full accent-foreground" aria-label="context length" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">full-attention cache</div>
            <div className="font-medium" style={{ color: FULL }}>1.00×</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">hybrid cache</div>
            <div className="font-medium" style={{ color: HY }}>{(hybrid / full).toFixed(2)}×</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">savings</div>
            <div className="font-medium text-foreground">{ratio.toFixed(1)}× smaller</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The five sliding-window layers per block stop growing once the context passes the
          128-token window, so at {ctxK}K tokens only the 1-in-6 global layers still scale — the
          cache is <span className="text-foreground">{ratio.toFixed(1)}× smaller</span> than a
          full-attention model of the same depth. That's most of why a 309B model serves 256K
          context at 150 tokens/second.
        </p>
      </div>
    </figure>
  )
}
