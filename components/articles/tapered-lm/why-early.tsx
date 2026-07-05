"use client"

import { useState } from "react"

// The evidence behind the design. If you measure how much each layer actually
// changes the residual stream — the representational "work" it does — the early
// layers do most of it and the late layers mostly refine. Uniform width spends the
// same capacity on a late layer that barely moves the representation as on an early
// one that transforms it. Tapering matches capacity to where the work is. Bars =
// illustrative per-layer representation change; the line = the tapered width
// allocation, which tracks it. Drag the marker to compare the two at any depth.
// SSR renders a sensible default (layer 2 highlighted).

const L = 12

// illustrative "representation change per layer": large early, small late
const change = Array.from({ length: L }, (_, l) => 0.15 + 0.85 * Math.exp(-l / 3.5))
// tapered width allocation (cosine), same shape family
const width = Array.from({ length: L }, (_, l) => 0.35 + 0.65 * (0.5 * (1 + Math.cos((Math.PI * l) / (L - 1)))))

const BAR = "oklch(0.7 0.04 260)"
const LINE = "oklch(0.72 0.15 285)"

const W = 620
const H = 260
const padL = 40
const padR = 20
const padT = 20
const padB = 40
const bw = (W - padL - padR) / L
const baseY = H - padB
const sy = (v: number) => padT + (1 - v) * (H - padT - padB)
const cx = (l: number) => padL + bw * (l + 0.5)

export function WhyEarly() {
  const [sel, setSel] = useState(2)

  const linePts = width.map((v, l) => `${cx(l)},${sy(v)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        where the work happens · representation change vs allocated width, by depth
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Per-layer representation change is large in early layers and small in late layers; the tapered width allocation follows the same decreasing shape. At layer ${sel}, representation change is ${change[sel].toFixed(2)} and allocated width is ${width[sel].toFixed(2)}.`}>
          <defs>
            <filter id="we-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* gridlines */}
          {[0.25, 0.5, 0.75, 1].map((v) => (
            <line key={v} x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="currentColor" strokeOpacity="0.07" />
          ))}
          <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="currentColor" strokeOpacity="0.22" />

          {/* selected-layer marker */}
          <rect x={padL + bw * sel} y={padT} width={bw} height={baseY - padT} fill="currentColor" opacity={0.05} />

          {/* representation-change bars */}
          {change.map((v, l) => (
            <rect
              key={l}
              x={padL + bw * l + 3}
              y={sy(v)}
              width={bw - 6}
              height={baseY - sy(v)}
              rx="2"
              fill={BAR}
              fillOpacity={l === sel ? 0.85 : 0.5}
              className="transition-all duration-200"
            />
          ))}

          {/* x labels */}
          {[0, 3, 6, 9, 11].map((l) => (
            <text key={l} x={cx(l)} y={baseY + 15} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">L{l}</text>
          ))}

          {/* tapered width line + dots */}
          <polyline points={linePts} fill="none" stroke={LINE} strokeWidth="2.5" />
          {width.map((v, l) => (
            <circle key={l} cx={cx(l)} cy={sy(v)} r={l === sel ? 4.5 : 3} fill={l === sel ? "var(--background)" : LINE} stroke={LINE} strokeWidth={l === sel ? 2 : 0} filter={l === sel ? "url(#we-soft)" : undefined} className="transition-all duration-200" />
          ))}

          {/* series labels */}
          <text x={W - padR} y={sy(width[L - 1]) - 8} textAnchor="end" className="font-mono" fontSize="10" fill={LINE}>tapered width</text>
          <text x={cx(2)} y={sy(change[1]) - 6} className="fill-muted-foreground/70 font-mono" fontSize="10">representation change</text>
          <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">layer depth →</text>

          {/* readout */}
          <g transform={`translate(${Math.min(cx(sel) + 8, W - padR - 132)}, ${padT + 2})`}>
            <rect width="130" height="34" rx="6" fill="var(--background)" stroke="var(--border)" strokeWidth="1" filter="url(#we-soft)" />
            <text x="9" y="14" className="fill-foreground font-mono" fontSize="10" fontWeight={600}>layer {sel}</text>
            <text x="9" y="27" className="font-mono" fontSize="9.5" fill={BAR}>change {change[sel].toFixed(2)}</text>
            <text x="76" y="27" className="font-mono" fontSize="9.5" fill={LINE}>w {width[sel].toFixed(2)}</text>
          </g>
        </svg>

        {/* control */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>layer (drag to inspect)</span>
            <span className="tabular-nums text-foreground">L{sel}</span>
          </div>
          <input type="range" min={0} max={L - 1} step={1} value={sel} onChange={(e) => setSel(+e.target.value)} className="w-full cursor-pointer accent-[oklch(0.72_0.15_285)]" aria-label="layer" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Later layers largely <span className="text-foreground">refine</span> rather than transform —
          they nudge the residual stream where early layers rewrite it. Uniform allocation ignores that
          and spends equal capacity everywhere. Tapering pours width into the layers doing the heavy
          lifting, which is why the same parameter budget buys a better model.
        </p>
      </div>
    </figure>
  )
}
