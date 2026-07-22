"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The architectural hook: a Looped Transformer reuses the same physical layers
// several times instead of stacking more of them. Effective compute depth is
// (physical layers × loops), but the parameter count is just the physical
// layers — you buy depth with FLOPs, not weights. This is illustrative of the
// idea (Nanbeige doesn't publish its exact loop count); L is fixed at 8 here.

const ACCENT = "oklch(0.64 0.1 188)"
const L = 8 // illustrative physical layer count

export function LoopedDepth() {
  const [k, setK] = useState(3)
  const effective = L * k

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        looped transformer · depth without parameters
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* looped: L physical layers, reused k times */}
          <div className="text-center">
            <div className="mb-2 font-mono text-[11px] text-muted-foreground">looped · {L} layers, ×{k}</div>
            <div className="relative mx-auto flex w-24 flex-col gap-1">
              {Array.from({ length: L }, (_, i) => (
                <div
                  key={i}
                  className="h-3.5 rounded-sm"
                  style={{ background: ACCENT, opacity: 0.45 + 0.55 * ((i + 1) / L) }}
                />
              ))}
              {/* loop-back arrow */}
              <svg viewBox="0 0 40 100" className="pointer-events-none absolute -right-9 top-0 h-full" aria-hidden="true">
                <path d="M 4 6 C 34 6 34 94 4 94" fill="none" stroke={ACCENT} strokeWidth="2" strokeDasharray="3 2" />
                <text x="20" y="52" className="fill-current font-mono" fontSize="11" style={{ color: ACCENT, fill: ACCENT }} textAnchor="middle">×{k}</text>
              </svg>
            </div>
            <div className="mt-2 font-mono text-[11px]">
              <span className="text-muted-foreground">params ≈ </span>
              <span className="tabular-nums text-foreground">{L} layers</span>
            </div>
          </div>

          {/* standard: needs L×k distinct layers for the same depth */}
          <div className="text-center">
            <div className="mb-2 font-mono text-[11px] text-muted-foreground">standard · {effective} layers</div>
            <div className="mx-auto flex max-h-[152px] w-24 flex-col gap-[3px] overflow-hidden">
              {Array.from({ length: Math.min(effective, 40) }, (_, i) => (
                <div key={i} className="h-2 shrink-0 rounded-sm bg-muted-foreground/30" />
              ))}
            </div>
            <div className="mt-2 font-mono text-[11px]">
              <span className="text-muted-foreground">params ≈ </span>
              <span className="tabular-nums text-foreground">{effective} layers</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">loops</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>×{k}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">effective depth</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{effective}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">params vs standard</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{k}× fewer</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>loop count</span>
            <span className="tabular-nums text-foreground">×{k}</span>
          </div>
          <Range min={1} max={6} step={1} value={k} onChange={(e) => setK(+e.target.value)} className="w-full" aria-label="loop count" accent={ACCENT} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both columns do <span style={{ color: ACCENT }}>{effective} layers</span> of computation. The looped
          one stores only {L} layers&rsquo; worth of weights and runs them {k} times; the standard one pays for
          all {effective} in parameters. That&rsquo;s how a 3B model reaches for the reasoning depth of a much
          bigger one — the same recurrent-depth idea as <em>LOTUS</em>, traded FLOPs-for-weights.
        </p>
      </div>
    </figure>
  )
}
