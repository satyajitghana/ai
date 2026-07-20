"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Why linear attention at all. Full attention (FA) compares every token to every
// other — cost grows with the square of the context length; the KV cache grows
// linearly but the attention compute is the killer at long context. Linear
// attention (LA) keeps a fixed-size recurrent state, so cost grows linearly and
// flat in memory. HydraHead runs mostly LA with a few FA heads, so it tracks the
// linear curve while keeping FA's retrieval where it's needed. Drag the context
// length and read the relative cost. Illustrative n² vs n scaling.

const MAXK = 512 // K tokens
const FA = "oklch(0.7 0.15 25)"
const LA = "oklch(0.62 0.13 195)"
const HY = "oklch(0.68 0.15 150)"

const W = 620
const H = 300
const padL = 48
const padR = 92
const padT = 20
const padB = 40

const sx = (k: number) => padL + (k / MAXK) * (W - padL - padR)
const faCost = (k: number) => (k / MAXK) ** 2
const laCost = (k: number) => (k / MAXK) * 0.14 // linear, cheap slope
const hydraCost = (k: number) => (k / MAXK) * 0.24 // linear, a bit above LA (the FA heads)
const sy = (c: number) => padT + (1 - c) * (H - padT - padB)

const path = (f: (k: number) => number) =>
  Array.from({ length: 65 }, (_, i) => {
    const k = (i / 64) * MAXK
    return `${i === 0 ? "M" : "L"} ${sx(k).toFixed(2)} ${sy(f(k)).toFixed(2)}`
  }).join(" ")

const area = (f: (k: number) => number) =>
  `${path(f)} L ${sx(MAXK).toFixed(2)} ${sy(0).toFixed(2)} L ${sx(0).toFixed(2)} ${sy(0).toFixed(2)} Z`

export function Complexity() {
  const [ctxK, setCtxK] = useState(128)

  const fa = faCost(ctxK)
  const la = laCost(ctxK)
  const hy = hydraCost(ctxK)
  const faX = (fa / la).toFixed(fa / la >= 10 ? 0 : 1)
  const hyX = (hy / la).toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        attention cost vs context length · full (n²) vs linear (n) vs HydraHead
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attention compute cost versus context length: full attention grows quadratically and blows up, linear attention and HydraHead grow linearly and stay flat.">
          <defs>
            <filter id="hh-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
            <linearGradient id="hh-fa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FA} stopOpacity={0.16} />
              <stop offset="100%" stopColor={FA} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((c) => (
            <line key={c} x1={padL} y1={sy(c)} x2={W - padR} y2={sy(c)} stroke="var(--border)" strokeWidth={1} strokeOpacity={c === 0 ? 0.9 : 0.45} strokeDasharray={c === 0 ? undefined : "3 4"} />
          ))}
          {/* x ticks */}
          {[0, 128, 256, 384, 512].map((k) => (
            <text key={k} x={sx(k)} y={H - padB + 15} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{k}K</text>
          ))}
          <text x={padL + (W - padL - padR) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={9}>context length</text>
          <text x={13} y={padT + (H - padT - padB) / 2} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={9} transform={`rotate(-90 13 ${padT + (H - padT - padB) / 2})`}>relative cost</text>

          {/* area under FA */}
          <path d={area(faCost)} fill="url(#hh-fa)" />

          {/* curves */}
          <path d={path(laCost)} fill="none" stroke={LA} strokeWidth={2} />
          <path d={path(hydraCost)} fill="none" stroke={HY} strokeWidth={2} />
          <path d={path(faCost)} fill="none" stroke={FA} strokeWidth={2} />

          {/* cursor */}
          <line x1={sx(ctxK)} y1={padT} x2={sx(ctxK)} y2={H - padB} stroke="var(--muted-foreground)" strokeOpacity={0.3} strokeDasharray="3 3" />
          {[{ v: fa, c: FA }, { v: hy, c: HY }, { v: la, c: LA }].map((m, i) => (
            <circle key={i} cx={sx(ctxK)} cy={sy(m.v)} r={4} fill={m.c} stroke="var(--background)" strokeWidth={1.5} filter="url(#hh-soft)" />
          ))}

          {/* end labels (in right gutter) */}
          <text x={W - padR + 8} y={sy(faCost(MAXK)) + 4} className="font-mono" fontSize={10} fill={FA}>full · n²</text>
          <text x={W - padR + 8} y={sy(hydraCost(MAXK)) - 5} className="font-mono" fontSize={10} fill={HY}>HydraHead</text>
          <text x={W - padR + 8} y={sy(laCost(MAXK)) + 12} className="font-mono" fontSize={10} fill={LA}>linear · n</text>
        </svg>

        {/* slider */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length</span>
            <span className="tabular-nums text-foreground">{ctxK}K tokens</span>
          </div>
          <Range
            min={8}
            max={MAXK}
            step={8}
            value={ctxK}
            onChange={(e) => setCtxK(Number(e.target.value))}
            className="w-full cursor-pointer "
            aria-label="context length in thousands of tokens" accent="var(--foreground)" />
        </div>

        {/* readout */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground">full attention <span style={{ color: FA }}>{faX}× linear</span></span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">HydraHead <span style={{ color: HY }}>{hyX}× linear</span></span>
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
