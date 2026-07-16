"use client"

import { useState } from "react"

// Soofi S's whole thesis, as a chart. Decoding is memory-bandwidth bound: every
// generated token must re-read the weights AND the attention cache of every sequence
// in the batch. In a dense full-attention model that per-sequence KV cache grows with
// context, so throughput decays as context lengthens. Soofi keeps only 6 of 52 layers
// as attention (2 KV heads each) — ~6 KB/token — while 23 Mamba-2 layers hold a
// fixed-size recurrent state, so aggregate decode throughput stays nearly flat.
// Values are the report's measured aggregate decode TPS/GPU (TP=1, one B200, batch 32,
// latency-subtraction protocol); intermediate points are illustrative of the shape.

const SOOFI = "oklch(0.62 0.20 320)" // magenta-violet, matches the report's Soofi colour
const QWEN = "oklch(0.62 0.03 260)" // muted — the other hybrid
const DENSE = "oklch(0.60 0.16 25)" // warm — the dense baseline that decays

// Context lengths (K tokens) and measured/illustrative aggregate decode TPS/GPU (k = ×1000).
const CTX = [4, 8, 16, 32, 40, 64, 128, 256]
const SERIES = {
  soofi: [4.5, 4.78, 4.85, 4.85, 4.82, 4.55, 4.38, 4.3],
  qwen: [3.1, 3.02, 2.95, 2.72, 2.6, 2.28, 1.6, 0.82],
  dense: [2.6, 2.15, 1.7, 0.92, 0.52, 0.35, 0.18, 0.09],
}

const W = 760
const H = 330
const PL = 52
const PR = 130
const PT = 20
const PB = 44

const YMIN = 0.06
const YMAX = 5.5
const ly = (v: number) => Math.log10(v)
const x = (i: number) => PL + (i / (CTX.length - 1)) * (W - PL - PR)
const y = (v: number) => PT + (1 - (ly(v) - ly(YMIN)) / (ly(YMAX) - ly(YMIN))) * (H - PT - PB)

const YT = [0.1, 0.5, 1, 2, 5]

function line(vals: number[]) {
  return vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
}

export function ThroughputScaling() {
  const [i, setI] = useState(4) // default 40K — the report's headline operating point

  const s = SERIES.soofi[i]
  const q = SERIES.qwen[i]
  const d = SERIES.dense[i]
  const ratio = s / d
  const ctx = CTX[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>aggregate decode throughput vs context · batch 32 · one B200</span>
        <span className="text-muted-foreground/60">reported endpoints · shape illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${ctx}K context, Soofi S sustains ${s.toFixed(2)}k decode TPS per GPU versus ${d.toFixed(2)}k for a dense 14B baseline, a ${ratio.toFixed(1)}-times gap`}>
          {/* y gridlines + labels */}
          {YT.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={PL - 8} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{t < 1 ? t : `${t}k`}</text>
            </g>
          ))}
          {/* x labels */}
          {CTX.map((c, idx) => (
            <text key={c} x={x(idx)} y={H - PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{c}K</text>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>input context length →</text>

          {/* selected-context marker */}
          <line x1={x(i)} x2={x(i)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/25" strokeWidth={1} strokeDasharray="3 3" />

          {/* curves */}
          <path d={line(SERIES.dense)} fill="none" stroke={DENSE} strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          <path d={line(SERIES.qwen)} fill="none" stroke={QWEN} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" opacity={0.9} />
          <path d={line(SERIES.soofi)} fill="none" stroke={SOOFI} strokeWidth={2.75} strokeLinecap="round" />

          {/* markers at selected context */}
          {([["soofi", SOOFI, s], ["qwen", QWEN, q], ["dense", DENSE, d]] as const).map(([k, c, v]) => (
            <circle key={k} cx={x(i)} cy={y(v)} r={4} fill={c} stroke="var(--background)" strokeWidth={1.5} />
          ))}

          {/* right-edge series labels */}
          <text x={W - PR + 8} y={y(SERIES.soofi[CTX.length - 1]) + 3} className="font-mono" fontSize={10} fill={SOOFI} fontWeight={600}>Soofi S 30B-A3B</text>
          <text x={W - PR + 8} y={y(SERIES.qwen[CTX.length - 1]) + 3} className="font-mono" fontSize={9.5} fill={QWEN}>Qwen3.5 35B-A3B</text>
          <text x={W - PR + 8} y={y(SERIES.dense[CTX.length - 1]) + 3} className="font-mono" fontSize={9.5} fill={DENSE}>Ministral 3 14B</text>
          <text x={PL + 2} y={PT + 2} className="fill-muted-foreground font-mono" fontSize={9}>decode TPS/GPU (log)</text>
        </svg>

        {/* controls */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>context length (drag)</span>
            <span>
              Soofi <span style={{ color: SOOFI }}>{s.toFixed(2)}k</span> vs dense <span style={{ color: DENSE }}>{d.toFixed(2)}k</span> ·{" "}
              <span className="text-foreground">{ratio.toFixed(1)}×</span> at {ctx}K
            </span>
          </div>
          <input type="range" min={0} max={CTX.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.20_320)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The dense 14B line falls off a cliff as context grows — each decoded token re-reads a{" "}
          <a href="/articles/how-llm-inference-works" className="text-foreground underline decoration-foreground/30 underline-offset-2">KV cache</a>{" "}
          that grows with sequence length. Soofi keeps only <span className="text-foreground">6 of 52 layers</span> as
          attention (~6&nbsp;KB/token, 11–53× smaller than the dense baselines) while 23 Mamba-2 layers carry a{" "}
          <span style={{ color: SOOFI }}>fixed-size recurrent state</span>, so its throughput stays nearly flat and is
          a reported <span className="text-foreground">9.2×</span> the dense 14B at 40K. Qwen3.5, the other hybrid,
          decays more gently than dense but still trails Soofi.
        </p>
      </div>
    </figure>
  )
}
