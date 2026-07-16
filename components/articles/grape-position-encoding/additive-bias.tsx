"use client"

import { useState } from "react"

// The additive family, drawn as its signature: a monotonic distance penalty on the
// attention logit. Every Additive-GRAPE scheme adds a term (j − i)·ω·slope to the
// score. In ALiBi the slope is a *fixed per-head constant* (a geometric fan across
// heads); in GRAPE-A-QK the slope is *content-dependent* — softplus gates on the
// query and key make each edge choose its own decay. Drag the content gate and the
// distance readout; the fixed head-fan stays put behind it. Deterministic; illustrative.

const ADD = "oklch(0.62 0.17 18)" // rose accent
const GATE = "oklch(0.70 0.15 145)" // content-gated line — green

const W = 760
const H = 316
const PX = 60 // plot left
const PY = 30 // plot top
const PW = 636
const PH = 214
const DMAX = 32 // max causal distance shown
const BMIN = -2.3 // most-negative bias on axis

// four fixed ALiBi head slopes (geometric), bias per unit distance
const HEAD_SLOPES = [0.062, 0.031, 0.0155, 0.0078]

const dx = (d: number) => PX + (d / DMAX) * PW
const by = (b: number) => PY + (b / BMIN) * PH // b in [BMIN,0] → [PY+PH, PY]

export function AdditiveBias() {
  const [gate, setGate] = useState(60) // 0..100 content-gate strength
  const [dist, setDist] = useState(20) // readout distance

  // content-gated slope from a softplus-like gate (deterministic, bounded)
  const g = gate / 100
  const slopeGated = 0.006 + 0.085 * Math.log(1 + Math.exp(3 * (g - 0.5))) / Math.log(1 + Math.exp(1.5))

  const linePts = (slope: number) =>
    Array.from({ length: DMAX + 1 }, (_, d) => `${dx(d)},${by(Math.max(-slope * d, BMIN))}`).join(" ")

  const biasGated = -slopeGated * dist
  const biasAlibi = -HEAD_SLOPES[0] * dist

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>additive family · logit bias vs distance</span>
        <span className="text-muted-foreground/50">causal</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attention logit bias decreasing with causal distance: four fixed ALiBi head slopes as a fan, and one adjustable content-gated GRAPE-A-QK slope">
          <defs>
            <filter id="grape-ab-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* axes */}
          <line x1={PX} y1={PY} x2={PX} y2={PY + PH} stroke="var(--border)" strokeWidth={1} />
          <line x1={PX} y1={by(0)} x2={PX + PW} y2={by(0)} stroke="var(--border)" strokeWidth={1} />

          {/* y gridlines */}
          {[0, -0.5, -1, -1.5, -2].map((b) => (
            <g key={b}>
              <line x1={PX} y1={by(b)} x2={PX + PW} y2={by(b)} stroke="var(--border)" strokeWidth={1} opacity={b === 0 ? 0 : 0.25} strokeDasharray="2 4" />
              <text x={PX - 8} y={by(b) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>{b === 0 ? "0" : b}</text>
            </g>
          ))}
          {/* x ticks */}
          {[0, 8, 16, 24, 32].map((d) => (
            <text key={d} x={dx(d)} y={PY + PH + 16} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{d}</text>
          ))}
          <text x={PX + PW} y={PY + PH + 30} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>relative distance  i − j  (tokens back)</text>
          <text x={PX - 8} y={PY - 12} className="fill-muted-foreground font-mono" fontSize={10}>logit bias</text>

          {/* fixed ALiBi head fan */}
          {HEAD_SLOPES.map((s, i) => (
            <polyline key={i} points={linePts(s)} fill="none" stroke={ADD} strokeWidth={1.5} opacity={0.28 + 0.12 * (HEAD_SLOPES.length - 1 - i)} />
          ))}
          <text x={dx(DMAX) - 4} y={by(-HEAD_SLOPES[0] * DMAX) - 6} textAnchor="end" className="font-mono" fontSize={9} style={{ fill: ADD }}>ALiBi head fan (fixed slopes)</text>

          {/* content-gated line */}
          <polyline points={linePts(slopeGated)} fill="none" stroke={GATE} strokeWidth={2.5} />
          <text x={dx(DMAX) - 4} y={by(Math.max(-slopeGated * DMAX, BMIN)) - 6} textAnchor="end" className="font-mono" fontSize={9} style={{ fill: GATE }}>GRAPE-A-QK (content-gated)</text>

          {/* distance marker */}
          <line x1={dx(dist)} y1={PY} x2={dx(dist)} y2={PY + PH} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 3" opacity={0.45} />
          <circle cx={dx(dist)} cy={by(Math.max(biasGated, BMIN))} r={4.5} fill={GATE} filter="url(#grape-ab-soft)" />
          <circle cx={dx(dist)} cy={by(Math.max(biasAlibi, BMIN))} r={3.5} fill={ADD} filter="url(#grape-ab-soft)" />
        </svg>

        {/* controls */}
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">content gate  softplus(vᵀq + uᵀk)</span>
              <span className="font-mono text-[10px]" style={{ color: GATE }}>slope {slopeGated.toFixed(3)}</span>
            </div>
            <input type="range" min={0} max={100} value={gate} onChange={(e) => setGate(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: GATE }} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">distance  i − j</span>
              <span className="font-mono text-[10px] text-muted-foreground">{dist} tokens</span>
            </div>
            <input type="range" min={0} max={DMAX} value={dist} onChange={(e) => setDist(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: ADD }} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>at {dist} back · <span style={{ color: GATE }}>gated {biasGated.toFixed(2)}</span> · <span style={{ color: ADD }}>ALiBi head-0 {biasAlibi.toFixed(2)}</span></span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The additive family is the same rank-1 nilpotent action seen as a logit bias. ALiBi fixes one slope per
          head — a static <span style={{ color: ADD }}>geometric fan</span> that decays with distance no matter the
          content. GRAPE-A-QK keeps the exact unipotent structure but lets softplus gates on the query and key set
          the slope, so the <span style={{ color: GATE }}>decay adapts to content</span> — and drops out of first
          principles rather than being hand-set. FoX is the path-integral version: a per-token cumulative gate.
        </p>
      </div>
    </figure>
  )
}
