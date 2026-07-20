"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// BM25's second fix: document-length normalization, the b knob. Two documents mention
// a query term the SAME number of times (tf = 2), but one is short and one is long.
// Without normalization they'd score equally — yet the term is a bigger share of the
// short document, so it's more likely to be about it. BM25 divides the saturation term
// by  (1 − b + b·|D|/avgdl)  so a longer-than-average document is penalized. Drag b from
// 0 (ignore length) to 1 (full normalization) and watch the long document's bar fall.

const K1 = 1.2
const AVGDL = 12
const TF = 2
const DOCS = [
  { name: "short doc", len: 5 },
  { name: "long doc", len: 30 },
]

const ACCENT = "oklch(0.72 0.15 195)"

// scene geometry (viewBox units)
const W = 600
const H = 196
const NODEX = 22
const GX = 296 // score bar left edge
const BARMAX = 240 // score bar full width
const VMAX = 1.8 // fixed score scale (keeps bars stable)
const ROWY = [66, 138]
const docW = (len: number) => 44 + len * 3.9 // short 63 · long 161
const NODEH = 30

export function LengthNorm() {
  const [b, setB] = useState(0.75)

  const factor = (len: number) => (TF * (K1 + 1)) / (TF + K1 * (1 - b + (b * len) / AVGDL))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">document-length normalization · same term count, different lengths</div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Two documents with the same term count but different lengths. At b = ${b.toFixed(2)}, the short document scores ${factor(5).toFixed(2)} and the long document scores ${factor(30).toFixed(2)}.`}>
          <defs>
            <marker id="ln-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="ln-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* column headers */}
          <text x={NODEX} y={26} className="fill-muted-foreground/70 font-mono" fontSize={10}>document · width = length</text>
          <text x={GX} y={26} className="fill-muted-foreground/70 font-mono" fontSize={10}>normalized score (tf = {TF}, avgdl = {AVGDL})</text>

          {DOCS.map((d, r) => {
            const cy = ROWY[r]
            const nw = docW(d.len)
            const nRight = NODEX + nw
            const score = factor(d.len)
            const bw = Math.max((score / VMAX) * BARMAX, 3)
            const midx = (nRight + GX) / 2
            return (
              <g key={d.name}>
                {/* name above node */}
                <text x={NODEX} y={cy - NODEH / 2 - 6} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{d.name}</text>
                {/* document glyph — width encodes length */}
                <rect x={NODEX} y={cy - NODEH / 2} width={nw} height={NODEH} rx={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#ln-soft)" />
                {/* tf occurrence ticks */}
                {[0, 1].map((k) => (
                  <rect key={k} x={NODEX + 10 + k * 11} y={cy - 7} width={4.5} height={14} rx={1.5} fill={ACCENT} opacity={0.85} />
                ))}
                <text x={nRight - 8} y={cy + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>|D|={d.len}</text>

                {/* connector to score bar */}
                <path d={`M ${nRight} ${cy} C ${midx} ${cy}, ${midx} ${cy}, ${GX - 3} ${cy}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeOpacity={0.5} markerEnd="url(#ln-arrow)" />

                {/* score bar */}
                <rect x={GX} y={cy - 8} width={BARMAX} height={16} rx={4} fill="var(--muted)" opacity={0.35} />
                <rect x={GX} y={cy - 8} width={bw} height={16} rx={4} fill={ACCENT} className="transition-all duration-200" />
                <text x={W - 8} y={cy + 4} textAnchor="end" className="fill-foreground font-mono tabular-nums" fontSize={11} fontWeight={600}>{score.toFixed(3)}</text>
              </g>
            )
          })}
        </svg>

        {/* control */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>b — length normalization (Lucene default 0.75)</span>
            <span className="tabular-nums text-foreground">{b.toFixed(2)}</span>
          </div>
          <Range min={0} max={1} step={0.05} value={b} onChange={(e) => setB(+e.target.value)} className="w-full cursor-pointer " aria-label="b" accent="oklch(0.72 0.15 195)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {b < 0.05
            ? "At b = 0 length is ignored entirely — both documents score the same despite one being 6× longer."
            : "As b rises, the longer-than-average document is penalized: the same two mentions are diluted across more text, so they're weaker evidence that the document is about the term. At b = 1 the normalization is full; b = 0.75 is the usual compromise."}
        </p>
      </div>
    </figure>
  )
}
