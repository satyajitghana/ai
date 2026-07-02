"use client"

import { useState } from "react"

// BM25's first fix over TF-IDF, made visible. In TF-IDF a term's contribution grows
// linearly with its count — a word appearing 20 times counts 20×. BM25 saturates it:
//   factor(tf) = tf·(k1+1) / (tf + k1)
// which rises fast for the first few occurrences and then flattens toward an asymptote
// of (k1+1). The first mention of a word is strong evidence; the tenth is nearly noise.
// Drag k1 to set how quickly it saturates (0 = binary, ∞ → linear). Static-friendly.

export function TfSaturation() {
  const [k1, setK1] = useState(1.2)

  const W = 600
  const H = 300
  const padL = 40
  const padR = 20
  const padT = 18
  const padB = 40
  const TFMAX = 12
  const YMAX = 6
  const sx = (tf: number) => padL + (tf / TFMAX) * (W - padL - padR)
  const sy = (v: number) => padT + (1 - Math.min(v, YMAX) / YMAX) * (H - padT - padB)

  const bm25 = (tf: number) => (tf * (k1 + 1)) / (tf + k1)
  const asymptote = k1 + 1

  const bm25Pts = Array.from({ length: 97 }, (_, i) => {
    const tf = (i / 96) * TFMAX
    return `${sx(tf)},${sy(bm25(tf))}`
  }).join(" ")
  const linearPts = Array.from({ length: 2 }, (_, i) => {
    const tf = i * TFMAX
    return `${sx(tf)},${sy(tf * 0.5)}`
  }).join(" ")

  const SAT = "oklch(0.72 0.15 195)"
  const LIN = "oklch(0.7 0.04 40)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">term-frequency saturation · why the 10th occurrence barely counts</div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="BM25's term-frequency factor rises quickly then flattens toward an asymptote of k1 plus 1, unlike linear TF-IDF which keeps growing.">
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          {[0, 3, 6, 9, 12].map((tf) => (
            <text key={tf} x={sx(tf)} y={H - padB + 15} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.5">{tf}</text>
          ))}
          <text x={(W) / 2} y={H - 4} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.45">term frequency in document</text>
          <text x={12} y={H / 2} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.45" transform={`rotate(-90 12 ${H / 2})`}>contribution</text>

          {/* asymptote */}
          <line x1={padL} y1={sy(asymptote)} x2={W - padR} y2={sy(asymptote)} stroke={SAT} strokeOpacity="0.35" strokeDasharray="3 4" />
          <text x={W - padR} y={sy(asymptote) - 5} textAnchor="end" fontFamily="monospace" fontSize="9" fill={SAT}>asymptote k1+1 = {asymptote.toFixed(1)}</text>

          <polyline points={linearPts} fill="none" stroke={LIN} strokeWidth="2" strokeOpacity="0.7" />
          <text x={sx(11)} y={sy(11 * 0.5) + 4} textAnchor="end" fontFamily="monospace" fontSize="9.5" fill={LIN}>linear TF-IDF</text>
          <polyline points={bm25Pts} fill="none" stroke={SAT} strokeWidth="2.5" />
          <text x={sx(9.5)} y={sy(bm25(9.5)) - 8} fontFamily="monospace" fontSize="9.5" fill={SAT}>BM25</text>
        </svg>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>k1 — saturation rate (Lucene default 1.2)</span>
            <span className="tabular-nums text-foreground">{k1.toFixed(1)}</span>
          </div>
          <input type="range" min={0} max={3} step={0.1} value={k1} onChange={(e) => setK1(+e.target.value)} className="w-full accent-foreground" aria-label="k1" />
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
