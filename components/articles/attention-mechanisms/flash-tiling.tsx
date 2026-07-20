"use client"

import { useState } from "react"

import { ATT, FigureCard, IDX, IO, Legend, PlayPause, useReducedMotion, useTicker, WARM } from "./shared"
import { Range } from "@/components/articles/ui/range"

// FlashAttention (Dao 2022) — the exact same attention function, computed IO-aware.
// The N×N score matrix is split into tiles. A Q-tile stays in fast SRAM while K/V tiles
// stream past it; for each K/V tile the kernel updates a running softmax (running max m,
// running sum l) and rescales the output accumulator O. The full matrix is never written
// to slow HBM — only O, m, l are. Watch the K/V tile sweep and the running stats update.
// It is a SYSTEMS optimisation, not a new attention: same numbers, fewer HBM round-trips.

const TR = 3 // Q tiles (rows)
const TC = 5 // K/V tiles (cols)

const W = 720
const H = 300
const GX = 250
const GY = 74
const TW = 58
const TH = 46
const tileX = (j: number) => GX + j * TW
const tileY = (i: number) => GY + i * TH

function score(i: number, j: number) {
  return 2.2 * Math.sin((i + 1) * 1.3 + (j + 1) * 0.9) * Math.cos((j + 1) * 0.4 + i)
}

export function FlashTiling() {
  const reduced = useReducedMotion()
  const [i, setI] = useState(1) // which Q tile (outer loop)
  const [j, setJ] = useState(TC - 1) // which K/V tile (inner loop)
  const [playing, setPlaying] = useState(true)

  useTicker(playing, reduced, 700, () => setJ((x) => (x + 1) % TC))

  // running (online) softmax over K/V tiles 0..j for the current Q tile i
  let m = -Infinity
  for (let jj = 0; jj <= j; jj++) m = Math.max(m, score(i, jj))
  let l = 0
  for (let jj = 0; jj <= j; jj++) l += Math.exp(score(i, jj) - m)
  const progress = (j + 1) / TC

  return (
    <FigureCard
      label="FlashAttention · tiles through SRAM, running softmax"
      right={<PlayPause playing={playing} onToggle={() => setPlaying((p) => !p)} hidden={reduced} />}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`FlashAttention: Q-tile ${i + 1} is held in SRAM while K/V tile ${j + 1} of ${TC} streams past; the running max and sum update and the output accumulator is rescaled. The full score matrix is never materialised.`}
      >
        <defs>
          <filter id="fa-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* HBM slab on the left */}
        <rect x={24} y={58} width={150} height={190} rx={9} fill="var(--muted)" opacity={0.4} stroke="var(--border)" />
        <text x={99} y={50} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
          HBM · large, slow
        </text>
        {["Q", "K", "V"].map((n, r) => (
          <g key={n}>
            <rect x={40} y={74 + r * 34} width={118} height={26} rx={5} fill={r === 0 ? ATT : IDX} opacity={0.5} />
            <text x={99} y={91 + r * 34} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} fill="var(--background)">
              {n} tiles
            </text>
          </g>
        ))}
        <text x={99} y={198} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
          writes back only
        </text>
        <text x={99} y={211} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill={IO}>
          O, m, l
        </text>
        <text x={99} y={230} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>
          never the N×N matrix
        </text>

        {/* tile grid = the conceptual score matrix (ghosted = not in HBM) */}
        <text x={GX} y={GY - 20} className="fill-muted-foreground font-mono" fontSize={10}>
          score tiles (only one lives in SRAM at a time) →
        </text>
        {Array.from({ length: TR }, (_, ri) =>
          Array.from({ length: TC }, (_, cj) => {
            const activeRow = ri === i
            const activeTile = activeRow && cj === j
            const processed = activeRow && cj < j
            return (
              <rect
                key={`${ri}-${cj}`}
                x={tileX(cj) + 2}
                y={tileY(ri) + 2}
                width={TW - 4}
                height={TH - 4}
                rx={4}
                fill={activeTile ? WARM : activeRow ? ATT : "var(--muted-foreground)"}
                opacity={activeTile ? 0.92 : processed ? 0.4 : activeRow ? 0.14 : 0.06}
                stroke={activeTile ? WARM : "transparent"}
                strokeWidth={1.5}
                filter={activeTile ? "url(#fa-soft)" : undefined}
                className="transition-all duration-300"
              />
            )
          })
        )}
        {/* SRAM badge on the active tile */}
        <text x={tileX(j) + TW / 2} y={tileY(i) + TH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill="var(--background)">
          SRAM
        </text>
        {/* Q-tile label on the active row */}
        <text x={GX - 8} y={tileY(i) + TH / 2 + 4} textAnchor="end" className="font-mono" fontSize={10} fontWeight={600} fill={ATT}>
          Q{i + 1}
        </text>

        {/* running softmax panel */}
        <g>
          <text x={GX} y={GY + TR * TH + 30} className="fill-muted-foreground font-mono" fontSize={10}>
            running softmax (updated per tile):
          </text>
          <text x={GX} y={GY + TR * TH + 48} className="font-mono" fontSize={11} fill={IO}>
            m = {m.toFixed(2)}
          </text>
          <text x={GX + 90} y={GY + TR * TH + 48} className="font-mono" fontSize={11} fill={IO}>
            l = {l.toFixed(2)}
          </text>
          {/* O accumulator progress */}
          <text x={GX + 180} y={GY + TR * TH + 48} className="font-mono" fontSize={11} fill={ATT}>
            O rescaled ×{j + 1}
          </text>
          <rect x={GX} y={GY + TR * TH + 56} width={300} height={7} rx={3.5} fill="var(--muted)" />
          <rect x={GX} y={GY + TR * TH + 56} width={300 * progress} height={7} rx={3.5} fill={ATT} className="transition-all duration-300" />
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">Q tile (outer)</span>
          {Array.from({ length: TR }, (_, r) => (
            <button
              key={r}
              type="button"
              onClick={() => setI(r)}
              aria-pressed={i === r}
              className="cursor-pointer rounded-md border border-transparent px-2 py-1 font-mono text-[10px] transition-colors"
              style={i === r ? { background: ATT, color: "var(--background)" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              Q{r + 1}
            </button>
          ))}
        </div>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>K/V tile (inner loop)</span>
            <span className="tabular-nums text-foreground">{j + 1} / {TC}</span>
          </span>
          <Range
            min={0}
            max={TC - 1}
            value={j}
            onChange={(e) => setJ(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: WARM }}
          />
        </label>
      </div>

      <Legend
        items={[
          { color: ATT, label: "Q tile held in SRAM" },
          { color: WARM, label: "K/V tile streaming now" },
          { color: "var(--muted-foreground)", label: "not materialised", op: 0.14 },
          { color: IO, label: "running m, l" },
        ]}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        FlashAttention changes <em>where</em> the arithmetic happens, not <em>what</em> it computes — the output is
        bit-for-bit the same softmax attention. By tiling and keeping an online softmax (running max{" "}
        <span style={{ color: IO }}>m</span> and running sum <span style={{ color: IO }}>l</span>), it never writes the
        N×N matrix to HBM; it reads Q, K, V in tiles and writes back only the output. That turns the memory traffic from
        Θ(N²) toward Θ(N²d²/M) with SRAM size M — the reason a long-context forward pass stopped being memory-bound.
        FlashAttention-2 and -3 push the same idea with better GPU work-partitioning and FP8 on Hopper.
      </p>
    </FigureCard>
  )
}
