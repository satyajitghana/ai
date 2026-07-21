"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// BM25's first fix over TF-IDF, made visible. In TF-IDF a term's contribution grows
// linearly with its count — a word appearing 20 times counts 20×. BM25 saturates it:
//   factor(tf) = tf·(k1+1) / (tf + k1)
// which rises fast for the first few occurrences and then flattens toward an asymptote
// of (k1+1). The first mention of a word is strong evidence; the tenth is nearly noise.
// Drag k1 to set how quickly it saturates (0 = binary, ∞ → linear); drag the marker to
// read the factor at any term count. Static-friendly (sensible default render).

const SAT = "oklch(0.72 0.15 195)"
const LIN = "oklch(0.7 0.04 40)"

const W = 600
const H = 300
const padL = 44
const padR = 20
const padT = 20
const padB = 40
const TFMAX = 12
const YMAX = 6

const sx = (tf: number) => padL + (tf / TFMAX) * (W - padL - padR)
const sy = (v: number) => padT + (1 - Math.min(v, YMAX) / YMAX) * (H - padT - padB)

export function TfSaturation() {
  const [k1, setK1] = useState(1.2)
  const [tf, setTf] = useState(3)

  const bm25 = (t: number) => (t * (k1 + 1)) / (t + k1)
  const asymptote = k1 + 1

  const bm25Pts = Array.from({ length: 97 }, (_, i) => {
    const t = (i / 96) * TFMAX
    return `${sx(t)},${sy(bm25(t))}`
  }).join(" ")
  // filled area under the BM25 curve
  const bm25Area = `${sx(0)},${sy(0)} ${bm25Pts} ${sx(TFMAX)},${sy(0)}`
  const linearPts = `${sx(0)},${sy(0)} ${sx(TFMAX)},${sy(TFMAX * 0.5)}`

  const val = bm25(tf)
  const pct = Math.round((val / asymptote) * 100)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">term-frequency saturation · why the 10th occurrence barely counts</div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`BM25's term-frequency factor rises quickly then flattens toward an asymptote of ${asymptote.toFixed(1)}, unlike linear TF-IDF which keeps growing. At ${tf} occurrences the factor is ${val.toFixed(2)}.`}>
          <defs>
            <filter id="tfs-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.18" />
            </filter>
            <linearGradient id="tfs-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SAT} stopOpacity="0.16" />
              <stop offset="100%" stopColor={SAT} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* gridlines */}
          {[1, 2, 3, 4, 5].map((v) => (
            <line key={v} x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="currentColor" strokeOpacity="0.08" />
          ))}
          {[0, 3, 6, 9, 12].map((t) => (
            <line key={t} x1={sx(t)} y1={padT} x2={sx(t)} y2={H - padB} stroke="currentColor" strokeOpacity="0.06" />
          ))}

          {/* axes */}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity="0.25" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" strokeOpacity="0.25" />
          {[0, 3, 6, 9, 12].map((t) => (
            <text key={t} x={sx(t)} y={H - padB + 15} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">{t}</text>
          ))}
          <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">term frequency in document</text>
          <text x={13} y={H / 2} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9" transform={`rotate(-90 13 ${H / 2})`}>contribution</text>

          {/* asymptote */}
          <line x1={padL} y1={sy(asymptote)} x2={W - padR} y2={sy(asymptote)} stroke={SAT} strokeOpacity="0.4" strokeDasharray="3 4" />
          <text x={W - padR} y={sy(asymptote) - 5} textAnchor="end" className="font-mono" fontSize="9" fill={SAT}>asymptote k1+1 = {asymptote.toFixed(1)}</text>

          {/* linear TF-IDF */}
          <polyline points={linearPts} fill="none" stroke={LIN} strokeWidth="2" strokeOpacity="0.7" />
          <text x={sx(11)} y={sy(11 * 0.5) + 4} textAnchor="end" className="font-mono" fontSize="9.5" fill={LIN}>linear TF-IDF</text>

          {/* BM25 curve + fill */}
          <polygon points={bm25Area} fill="url(#tfs-fill)" />
          <polyline points={bm25Pts} fill="none" stroke={SAT} strokeWidth="2.5" />
          <text x={sx(9.5)} y={sy(bm25(9.5)) - 8} className="font-mono" fontSize="9.5" fill={SAT}>BM25</text>

          {/* draggable marker */}
          <line x1={sx(tf)} y1={padT} x2={sx(tf)} y2={H - padB} stroke={SAT} strokeOpacity="0.35" strokeWidth="1" />
          <circle cx={sx(tf)} cy={sy(val)} r="5" fill="var(--background)" stroke={SAT} strokeWidth="2" filter="url(#tfs-soft)" />
          <g transform={`translate(${Math.min(sx(tf) + 8, W - padR - 92)}, ${Math.max(sy(val) - 26, padT + 2)})`}>
            <rect width="90" height="20" rx="5" fill="var(--background)" stroke="var(--border)" strokeWidth="1" filter="url(#tfs-soft)" />
            <text x="8" y="14" className="fill-foreground font-mono" fontSize="10">tf {tf} → {val.toFixed(2)}</text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>k1 — saturation rate (Lucene 1.2)</span>
              <span className="tabular-nums text-foreground">{k1.toFixed(1)}</span>
            </div>
            <Range min={0} max={3} step={0.1} value={k1} onChange={(e) => setK1(+e.target.value)} className="w-full cursor-pointer " aria-label="k1" accent="oklch(0.72 0.15 195)" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>tf — occurrences (marker)</span>
              <span className="tabular-nums text-foreground">{val.toFixed(2)} · {pct}% of max</span>
            </div>
            <Range min={0} max={TFMAX} step={1} value={tf} onChange={(e) => setTf(+e.target.value)} className="w-full cursor-pointer " aria-label="term frequency marker" accent="oklch(0.72 0.15 195)" />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The curve flattens toward <span className="text-foreground">k1+1</span>: extra repetitions of a term give
          ever-smaller returns. Small k1 saturates almost instantly (any occurrence counts about the same);
          large k1 keeps rewarding repetition, approaching the straight TF-IDF line. Real relevance behaves like
          the curve, not the line — which is exactly what BM25 encodes.
        </p>
      </div>
    </figure>
  )
}
