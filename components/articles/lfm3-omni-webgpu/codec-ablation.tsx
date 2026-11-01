"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Measured on this page's author's CPU: 5.45 s of Kokoro-82M speech through
// LiquidCodec (12 codebooks). Log-spectral distance in dB over an 80-bin mel
// spectrogram, bins within 60 dB of the peak. Codebooks replaced by random
// codes, mean of 3 seeds.
const DATA: { k: number; d: number }[] = [
  { k: 0, d: 3.02 },
  { k: 2, d: 4.57 },
  { k: 4, d: 8.04 },
  { k: 6, d: 11.19 },
  { k: 9, d: 14.56 },
  { k: 12, d: 16.24 },
]
const NOISE = 14.43
const SHIFT = 17.34
const MAX = 18

export function CodecAblation() {
  const [i, setI] = useState(0)
  const d = DATA[i]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        break k of 12 codebooks on purpose, decode, measure the spectral distance (measured)
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <svg viewBox="0 0 520 190" className="w-full" role="img" aria-label="bars of spectral distance by number of corrupted codebooks">
          {DATA.map((x, j) => {
            const h = (x.d / MAX) * 140
            return (
              <g key={x.k} onClick={() => setI(j)} style={{ cursor: "pointer" }}>
                <rect x={30 + j * 80} y={150 - h} width={52} height={h} rx={4} fill={j === i ? "oklch(0.72 0.15 195)" : "oklch(0.6 0.05 250)"} />
                <text x={56 + j * 80} y={168} textAnchor="middle" fontSize={11} fill="currentColor" fontFamily="ui-monospace, monospace">
                  k={x.k}
                </text>
                <text x={56 + j * 80} y={144 - h} textAnchor="middle" fontSize={10} fill="currentColor" fontFamily="ui-monospace, monospace">
                  {x.d.toFixed(1)}
                </text>
              </g>
            )
          })}
          {[
            { v: NOISE, t: "white noise vs speech" },
            { v: SHIFT, t: "same speech shifted 80 ms" },
          ].map((l, j) => (
            <g key={l.t}>
              <line x1={20} x2={510} y1={150 - (l.v / MAX) * 140} y2={150 - (l.v / MAX) * 140} stroke="currentColor" strokeDasharray="4 4" opacity={0.4} />
              <text x={510} y={146 - (l.v / MAX) * 140 + j * 24} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.7} fontFamily="ui-monospace, monospace">
                {l.t} {l.v.toFixed(1)}
              </text>
            </g>
          ))}
        </svg>
        <Range min={0} max={DATA.length - 1} step={1} value={i} onChange={(e) => setI(+e.target.value)} className="w-full" />
        <p className="font-mono text-xs text-muted-foreground">
          {d.k === 0 ? "All 12 codebooks intact:" : `${d.k} of 12 codebooks random:`} {d.d.toFixed(2)} dB mean log-spectral distance.
        </p>
      </div>
    </figure>
  )
}
