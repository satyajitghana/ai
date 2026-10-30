"use client"

import { useState } from "react"

import { ACCENT, Frame, GREEN, STREAM, T, VIOLET } from "./viz"

// REPORTED, not measured by us: the repository's research log, depth survey
// of Qwen3.5-4B (32 layers; 384 random neurons + 64 random-direction controls
// per layer; doses of +0.8 of the residual norm). The log gives the share of
// neurons above the layer's control p95 as ranges per band of layers, not per
// layer, so the chart draws bands. By chance 5 percent would be above p95.

type Band = { from: number; to: number; lo: number; hi: number; tone: string; what: string }

const BANDS: Band[] = [
  { from: 3, to: 3, lo: 14, hi: 14, tone: STREAM, what: "Layer 3: 14 percent above the control p95." },
  { from: 4, to: 7, lo: 29, hi: 40, tone: ACCENT, what: "Layers 4 to 7: 29 to 40 percent. The strongest pulls are topical: 'aircraft engine radial', 'ottoman empire pasha', 'sauce dish ingredients'. The commonness of the top words is lowest here (rarest words)." },
  { from: 8, to: 12, lo: 18, hi: 29, tone: STREAM, what: "Layers 8 to 12: 18 to 29 percent. Topics and situations (the log's full-layer run at layer 8: medical consult, online retail, income, emergency contacts)." },
  { from: 13, to: 19, lo: 8, hi: 17, tone: VIOLET, what: "Layers 13 to 19: 8 to 17 percent, the dip. The strongest pulls move discourse words ('even eventually actually while', 'subjective matter personal opinion'). The log tested whether the dip was a blind spot of the word-count metric; an all-words metric did not flatten it." },
  { from: 20, to: 26, lo: 28, hi: 41, tone: GREEN, what: "Layers 20 to 26: 28 to 41 percent. Lexical families ('manage management managing managed'); word-family share peaks at 0.06 to 0.09 at layers 23 to 26, against 0.00 for the controls." },
  { from: 27, to: 28, lo: 15, hi: 16, tone: STREAM, what: "Layers 27 and 28: 15 to 16 percent." },
  { from: 29, to: 31, lo: 1, hi: 6, tone: STREAM, what: "Layers 29 to 31: 1 to 6 percent, near chance for this metric. The log notes the steer lens, which sees the output directly, shows no trough." },
]

const X0 = 46
const DX = 20
const Y0 = 250
const DY = 5.4

export function DepthGradient() {
  const [sel, setSel] = useState(1)
  const b = BANDS[sel]
  return (
    <Frame
      label="how much of a layer's neurons steer text, by depth · REPORTED · Qwen3.5-4B, from the repository's log"
      note="Not our measurement and not our model: the numbers are the log's own ranges, drawn as bars from the lowest to the highest layer share in each band. The dashed line is the 5 percent expected by chance. Layers 0 to 2 are left out because at +0.8 of the residual norm 92 percent of layer-0 rollouts are empty, for random directions as well."
    >
      <svg viewBox="0 0 740 290" role="img" className="h-auto w-full">
        <title>
          Bar chart over layers 0 to 31 of Qwen3.5-4B. Each band of layers shows the range of the share of neurons whose
          steered text differs from random-direction controls: low at layer 3, high at layers 4 to 7, lower from 8 to
          19, high again from 20 to 26, and near chance from 29 to 31.
        </title>
        {[0, 10, 20, 30, 40].map((v) => (
          <g key={v}>
            <line x1={X0} y1={Y0 - v * DY} x2={X0 + 32 * DX} y2={Y0 - v * DY} stroke="currentColor" strokeOpacity={0.1} />
            <T x={X0 - 6} y={Y0 - v * DY + 3} anchor="end" size={8.5} opacity={0.5}>
              {v}%
            </T>
          </g>
        ))}
        <line x1={X0} y1={Y0 - 5 * DY} x2={X0 + 32 * DX} y2={Y0 - 5 * DY} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="4 3" />
        <T x={X0 + 32 * DX + 4} y={Y0 - 5 * DY + 3} size={8.5} opacity={0.6}>chance</T>
        <rect x={X0} y={Y0 - 45 * DY} width={3 * DX} height={45 * DY} fill="currentColor" fillOpacity={0.05} />
        <T x={X0 + 1.5 * DX} y={Y0 - 22 * DY} anchor="middle" size={8.5} opacity={0.5}>L0-2</T>
        <T x={X0 + 1.5 * DX} y={Y0 - 19 * DY} anchor="middle" size={8} opacity={0.4}>not</T>
        <T x={X0 + 1.5 * DX} y={Y0 - 16.5 * DY} anchor="middle" size={8} opacity={0.4}>measured</T>
        {BANDS.map((bd, i) => {
          const x = X0 + bd.from * DX + 2
          const w = (bd.to - bd.from + 1) * DX - 4
          const yTop = Y0 - bd.hi * DY
          const h = Math.max(6, (bd.hi - bd.lo) * DY)
          return (
            <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
              <rect x={x} y={Y0 - 45 * DY} width={w} height={45 * DY} fill="transparent" />
              <rect x={x} y={yTop} width={w} height={h} rx={3} fill={bd.tone} fillOpacity={sel === i ? 0.9 : 0.4} stroke={bd.tone} />
              <T x={x + w / 2} y={yTop - 5} anchor="middle" size={8.5} opacity={sel === i ? 1 : 0.6}>
                {bd.lo === bd.hi ? `${bd.hi}` : `${bd.lo}-${bd.hi}`}
              </T>
            </g>
          )
        })}
        {[0, 4, 8, 12, 16, 20, 24, 28, 31].map((l) => (
          <T key={l} x={X0 + l * DX + DX / 2} y={Y0 + 14} anchor="middle" size={8.5} opacity={0.55}>
            {l}
          </T>
        ))}
        <T x={X0 + 16 * DX} y={Y0 + 30} anchor="middle" size={9} opacity={0.6}>layer</T>
      </svg>
      <div className="mt-2 rounded-md border bg-muted/20 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-mono text-xs text-foreground">
          layers {b.from === b.to ? b.from : `${b.from} to ${b.to}`}
        </span>
        <p className="mt-1">{b.what}</p>
      </div>
    </Frame>
  )
}
