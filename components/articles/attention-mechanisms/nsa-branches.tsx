"use client"

import { useState } from "react"

import { ATT, FigureCard, IDX, IO, Legend, LOCAL } from "./shared"

// Native Sparse Attention (DeepSeek, Yuan 2025). For each query, three branches read
// the past in parallel over the SAME KV, then a learned gate blends them:
//   compression — squash the whole past into coarse block summaries (global gist)
//   selection   — score blocks, keep the top-n at full resolution (the important detail)
//   window      — the last w tokens verbatim (local coherence)
//   out = g_cmp·cmp + g_slc·slc + g_win·win,   g^c ∈ [0,1] from an MLP + sigmoid
// Drag the query; the selected blocks and the gate weights update. Illustrative;
// real NSA uses larger blocks and is trained end-to-end so the gate learns the mix.

const N = 24
const BLK = 4
const NBLK = N / BLK
const TOPN = 3
const WIN = 6

const LANE_X = 150
const W = 720
const H = 300
const stripW = W - LANE_X - 24
const cellGap = 2
const cw = (stripW - (N - 1) * cellGap) / N
const cellX = (i: number) => LANE_X + i * (cw + cellGap)
const bw = (stripW - (NBLK - 1) * cellGap * 2) / NBLK
const blkX = (b: number) => LANE_X + b * (bw + cellGap * 2)

const LANES = [
  { id: "cmp", y: 54, label: "compression", color: ATT, sub: "coarse block summaries" },
  { id: "slc", y: 122, label: "selection", color: IDX, sub: `top-${TOPN} blocks` },
  { id: "win", y: 190, label: "sliding window", color: LOCAL, sub: `last ${WIN} tokens` },
] as const

function blockScore(q: number, b: number) {
  return (Math.sin((b + 1) * 1.7 + q * 0.5) * 0.6 + Math.cos((b + 1) * 0.6 + q * 0.3) * 0.4 + 1) / 2
}
// deterministic gate: three independent sigmoids of mock query features
const sig = (x: number) => 1 / (1 + Math.exp(-x))

export function NsaBranches() {
  const [q, setQ] = useState(N - 1)

  const bq = Math.floor(q / BLK)
  const ranked = Array.from({ length: bq }, (_, b) => b).sort((a, c) => blockScore(q, c) - blockScore(q, a))
  const selected = new Set(ranked.slice(0, TOPN))
  const winStart = Math.max(0, q - WIN + 1)

  const g = {
    cmp: sig(0.9 * Math.sin(q * 0.4) + 0.3),
    slc: sig(1.2 * Math.cos(q * 0.5) + 0.8),
    win: sig(0.8 * Math.sin(q * 0.7 + 1) + 0.5),
  }
  const gSum = g.cmp + g.slc + g.win

  return (
    <FigureCard label="native sparse attention · three branches + gate">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Native sparse attention for a query at position ${q}: a compression branch reads coarse summaries, a selection branch keeps the top-${TOPN} scored blocks, a window branch reads the last ${WIN} tokens, and a gate blends the three.`}
      >
        <defs>
          <filter id="nsa-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
          </filter>
        </defs>

        {LANES.map((lane) => (
          <g key={lane.id}>
            <text x={16} y={lane.y + 14} className="font-mono" fontSize={11} fontWeight={600} fill={lane.color}>
              {lane.label}
            </text>
            <text x={16} y={lane.y + 28} className="fill-muted-foreground font-mono" fontSize={9}>
              {lane.sub}
            </text>
            <text x={16} y={lane.y + 41} className="fill-muted-foreground/70 font-mono" fontSize={9}>
              g = {(lane.id === "cmp" ? g.cmp : lane.id === "slc" ? g.slc : g.win).toFixed(2)}
            </text>

            {lane.id === "cmp"
              ? // coarse block summaries: one fat cell per past block
                Array.from({ length: NBLK }, (_, b) => {
                  const past = b <= bq
                  return (
                    <rect
                      key={b}
                      x={blkX(b)}
                      y={lane.y}
                      width={bw}
                      height={26}
                      rx={4}
                      fill={ATT}
                      opacity={past ? 0.55 : 0.08}
                      className="transition-all duration-200"
                    />
                  )
                })
              : // per-token cells for selection + window
                Array.from({ length: N }, (_, i) => {
                  let on = false
                  if (lane.id === "slc") on = selected.has(Math.floor(i / BLK)) && i <= q
                  if (lane.id === "win") on = i >= winStart && i <= q
                  const visible = i <= q
                  return (
                    <rect
                      key={i}
                      x={cellX(i)}
                      y={lane.y}
                      width={cw}
                      height={26}
                      rx={2.5}
                      fill={on ? lane.color : "var(--muted-foreground)"}
                      opacity={on ? 0.85 : visible ? 0.1 : 0.04}
                      className="transition-all duration-200"
                    />
                  )
                })}
          </g>
        ))}

        {/* query marker column */}
        <line x1={cellX(q) + cw / 2} y1={44} x2={cellX(q) + cw / 2} y2={224} stroke="var(--foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.3} />

        {/* gate → output */}
        <g>
          <rect x={LANE_X} y={244} width={stripW} height={40} rx={7} fill="var(--background)" stroke={IO} strokeWidth={1.5} filter="url(#nsa-soft)" />
          <text x={LANE_X + 14} y={268} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            gate · out = Σ gᶜ · branchᶜ
          </text>
          {/* gate weight bars */}
          {(["cmp", "slc", "win"] as const).map((k, idx) => {
            const val = g[k] / gSum
            const color = k === "cmp" ? ATT : k === "slc" ? IDX : LOCAL
            const barX = LANE_X + stripW - 200 + idx * 66
            return (
              <g key={k}>
                <rect x={barX} y={256} width={54} height={8} rx={4} fill="var(--muted)" />
                <rect x={barX} y={256} width={54 * val} height={8} rx={4} fill={color} className="transition-all duration-300" />
                <text x={barX} y={278} className="fill-muted-foreground font-mono" fontSize={8}>
                  {k} {(val * 100).toFixed(0)}%
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>query position (drag)</span>
          <span className="tabular-nums text-foreground">{q}</span>
        </div>
        <input
          type="range"
          min={BLK * TOPN}
          max={N - 1}
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ accentColor: IDX }}
        />
      </div>

      <Legend
        items={[
          { color: ATT, label: "compressed summary" },
          { color: IDX, label: "selected block" },
          { color: LOCAL, label: "local window" },
          { color: IO, label: "learned gate" },
        ]}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The trick that makes NSA <em>trainable</em>, not just an inference hack, is that all three read paths are
        differentiable and a small gate (an MLP + sigmoid on the query) learns how much to trust each one, per token.
        Compression gives cheap global gist, selection recovers the few blocks that actually matter at full resolution,
        and the window keeps local coherence — and because the sparsity is learned end-to-end, the model never has to be
        retrofitted onto a dense checkpoint.
      </p>
    </FigureCard>
  )
}
