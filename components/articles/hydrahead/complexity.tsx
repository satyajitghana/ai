"use client"

import { useState } from "react"

// Why linear attention at all. Full attention (FA) compares every token to every
// other — cost grows with the square of the context length; the KV cache grows
// linearly but the attention compute is the killer at long context. Linear
// attention (LA) keeps a fixed-size recurrent state, so cost grows linearly and
// flat in memory. HydraHead runs mostly LA with a few FA heads, so it tracks the
// linear curve while keeping FA's retrieval where it's needed. Drag the context
// length and read the relative cost. Illustrative n² vs n scaling.

const MAXK = 512 // K tokens

export function Complexity() {
  const [ctxK, setCtxK] = useState(128)

  const W = 620
  const H = 300
  const padL = 46
  const padR = 16
  const padT = 16
  const padB = 40
  const sx = (k: number) => padL + (k / MAXK) * (W - padL - padR)
  // normalize cost so FA at max = 1
  const faCost = (k: number) => (k / MAXK) ** 2
  const laCost = (k: number) => (k / MAXK) * 0.14 // linear, cheap slope
  const hydraCost = (k: number) => (k / MAXK) * 0.24 // linear, a bit above LA (the FA heads)
  const sy = (c: number) => padT + (1 - c) * (H - padT - padB)

  const line = (f: (k: number) => number) =>
    Array.from({ length: 65 }, (_, i) => {
      const k = (i / 64) * MAXK
      return `${sx(k)},${sy(f(k))}`
    }).join(" ")

  const fa = faCost(ctxK)
  const la = laCost(ctxK)
  const hy = hydraCost(ctxK)
  // cost relative to LA
  const faX = (fa / la).toFixed(fa / la >= 10 ? 0 : 1)
  const hyX = (hy / la).toFixed(1)

  const FA = "oklch(0.72 0.15 25)"
  const LA = "oklch(0.62 0.13 195)"
  const HY = "oklch(0.72 0.15 150)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        attention cost vs context length · full (n²) vs linear (n) vs HydraHead
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attention compute cost versus context length: full attention grows quadratically and blows up, linear attention and HydraHead grow linearly and stay flat.">
          {/* axes */}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          {[0, 128, 256, 384, 512].map((k) => (
            <text key={k} x={sx(k)} y={H - padB + 15} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.5">{k}K</text>
          ))}
          <text x={(W) / 2} y={H - 4} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.45">context length</text>
          <text x={12} y={H / 2} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.45" transform={`rotate(-90 12 ${H / 2})`}>relative cost</text>

          {/* curves */}
          <polyline points={line(laCost)} fill="none" stroke={LA} strokeWidth="2" />
          <polyline points={line(hydraCost)} fill="none" stroke={HY} strokeWidth="2" />
          <polyline points={line(faCost)} fill="none" stroke={FA} strokeWidth="2" />

          {/* cursor */}
          <line x1={sx(ctxK)} y1={padT} x2={sx(ctxK)} y2={H - padB} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
          <circle cx={sx(ctxK)} cy={sy(fa)} r="4" fill={FA} />
          <circle cx={sx(ctxK)} cy={sy(hy)} r="4" fill={HY} />
          <circle cx={sx(ctxK)} cy={sy(la)} r="4" fill={LA} />

          {/* labels */}
          <text x={W - padR} y={sy(faCost(MAXK)) + 4} textAnchor="end" fontFamily="monospace" fontSize="10" fill={FA}>full attention · n²</text>
          <text x={W - padR} y={sy(hydraCost(MAXK)) - 6} textAnchor="end" fontFamily="monospace" fontSize="10" fill={HY}>HydraHead · ~n</text>
          <text x={W - padR} y={sy(laCost(MAXK)) + 14} textAnchor="end" fontFamily="monospace" fontSize="10" fill={LA}>linear · n</text>
        </svg>

        {/* slider */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length</span>
            <span className="tabular-nums text-foreground">{ctxK}K tokens</span>
          </div>
          <input
            type="range"
            min={8}
            max={MAXK}
            step={8}
            value={ctxK}
            onChange={(e) => setCtxK(Number(e.target.value))}
            className="w-full accent-foreground"
            aria-label="context length in thousands of tokens"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-2">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">full attention cost</div>
            <div className="font-medium" style={{ color: FA }}>{faX}× linear</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">HydraHead cost</div>
            <div className="font-medium" style={{ color: HY }}>{hyX}× linear</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          At {ctxK}K tokens, full attention costs <span className="text-foreground">{faX}×</span> what
          linear does — the quadratic term runs away exactly when you need long context most.
          HydraHead stays close to the linear curve because only a few heads pay the FA price.
        </p>
      </div>
    </figure>
  )
}
