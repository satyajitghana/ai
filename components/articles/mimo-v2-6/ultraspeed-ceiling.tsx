"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What a block-diffusion drafter can and cannot buy you.
//
// The shipped drafter is `dflash/` in MiMo-V2.6-Pro-RL: DFlashDraftModel, 5
// layers, hidden 6144, block_size 8, is_causal false, mask_token_id 151675,
// reading concatenated hidden states from target layers [0, 15, 31, 47, 69].
// `spec_generate` fills block_size positions with the mask token, runs ONE
// bidirectional draft pass, and hands the block to the target for a single
// verification forward. The card's own phrasing: "predicts 7 subsequent tokens
// in a single forward pass for parallel verification."
//
// So the arithmetic is fixed by the config, not by me. With acceptance rate p
// per drafted position, expected accepted run length before the first miss is
//
//   E[a] = (1 - p^(B-1)) / (1 - p)          B - 1 = 7 drafted positions
//
// and the target always contributes one more token at the miss (or after a full
// block), so tokens per target forward = E[a] + 1, capped at B = 8. Cost is one
// target forward plus one draft forward; the draft is 5 layers against 70, and
// dense rather than MoE, so I charge it at r of a target pass and let the reader
// move r. Speedup = tokens-per-step / (1 + r).
//
// The ceiling — p = 1, r = 0 — is 8x. That is the number to hold against "up to
// 20x", which is a serving claim I cannot test from the weights.

const BLOCK = 8

// New tokens committed per decode step = 1 + E[accepted run], and the accepted
// run is the longest matching prefix of the 7 drafted positions, so
// E = Σ_{i=1..7} p^i. Summed term by term rather than with Math.pow, so the
// value is bit-identical on the server and in the browser.
function tokensPerStep(p: number): number {
  let acc = 1
  let term = 1
  for (let i = 0; i < BLOCK - 1; i++) {
    term *= p
    acc += term
  }
  return acc
}

export function UltraSpeedCeiling() {
  const [pPct, setPPct] = useState(85)
  const [rPct, setRPct] = useState(12)

  const p = pPct / 100
  const r = rPct / 100
  const tps = tokensPerStep(p)
  const speedup = tps / (1 + r)
  const ceiling = BLOCK / (1 + r)

  const W = 620
  const H = 190
  const PL = 44
  const PR = 90
  const PT = 12
  const PB = 28
  const maxY = 21

  const xs: number[] = []
  for (let i = 0; i <= 100; i++) xs.push(i / 100)
  const path = xs
    .map((q, i) => {
      const y = tokensPerStep(q) / (1 + r)
      const px = PL + (q * (W - PL - PR)) / 1
      const py = PT + (H - PT - PB) * (1 - y / maxY)
      return `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`
    })
    .join(" ")

  const markX = PL + p * (W - PL - PR)
  const markY = PT + (H - PT - PB) * (1 - speedup / maxY)
  const y20 = PT + (H - PT - PB) * (1 - 20 / maxY)
  const y8 = PT + (H - PT - PB) * (1 - ceiling / maxY)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        DFlash drafter · block_size 8 · 7 drafted positions per target forward
      </div>

      <div className="overflow-x-auto px-2 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="min-w-[480px]"
          role="img"
          aria-label="Decode speedup against draft acceptance rate. The curve saturates near eight times; the claimed twenty times sits well above it."
        >
          <line
            x1={PL}
            y1={H - PB}
            x2={W - PR}
            y2={H - PB}
            stroke="currentColor"
            strokeOpacity="0.25"
          />
          <line
            x1={PL}
            y1={PT}
            x2={PL}
            y2={H - PB}
            stroke="currentColor"
            strokeOpacity="0.25"
          />

          <line
            x1={PL}
            y1={y20}
            x2={W - PR}
            y2={y20}
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeDasharray="4 3"
          />
          <text
            x={W - PR + 6}
            y={y20 + 4}
            className="fill-current font-mono text-[10px] opacity-70"
          >
            20× claimed
          </text>

          <line
            x1={PL}
            y1={y8}
            x2={W - PR}
            y2={y8}
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeDasharray="2 3"
          />
          <text
            x={W - PR + 6}
            y={y8 + 4}
            className="fill-current font-mono text-[10px] opacity-70"
          >
            {ceiling.toFixed(1)}× ceiling
          </text>

          <path
            d={path}
            fill="none"
            stroke="var(--hg-accent, oklch(0.72 0.15 195))"
            strokeWidth="2"
          />
          <circle
            cx={markX}
            cy={markY}
            r="4"
            fill="var(--hg-accent, oklch(0.72 0.15 195))"
          />

          {[0, 5, 10, 15, 20].map((t) => {
            const py = PT + (H - PT - PB) * (1 - t / maxY)
            return (
              <text
                key={t}
                x={PL - 6}
                y={py + 4}
                textAnchor="end"
                className="fill-current font-mono text-[10px] opacity-60"
              >
                {t}×
              </text>
            )
          })}
          {[0, 0.5, 1].map((q) => (
            <text
              key={q}
              x={PL + q * (W - PL - PR)}
              y={H - PB + 16}
              textAnchor="middle"
              className="fill-current font-mono text-[10px] opacity-60"
            >
              {(q * 100).toFixed(0)}%
            </text>
          ))}
          <text
            x={(PL + W - PR) / 2}
            y={H - 2}
            textAnchor="middle"
            className="fill-current font-mono text-[10px] opacity-60"
          >
            per-position acceptance rate
          </text>
        </svg>
      </div>

      <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:gap-5">
        <label className="flex flex-1 items-center gap-2 font-mono text-xs">
          <span className="w-28 shrink-0 text-muted-foreground">
            accept {pPct}%
          </span>
          <Range
            min={0}
            max={100}
            step={1}
            value={pPct}
            onChange={(e) => setPPct(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="per-position acceptance rate"
          />
        </label>
        <label className="flex flex-1 items-center gap-2 font-mono text-xs">
          <span className="w-28 shrink-0 text-muted-foreground">
            draft cost {rPct}%
          </span>
          <Range
            min={0}
            max={50}
            step={1}
            value={rPct}
            onChange={(e) => setRPct(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="draft forward cost as a fraction of a target forward"
          />
        </label>
      </div>

      <div className="border-t px-4 py-3 font-mono text-xs">
        <span className="text-foreground">
          {tps.toFixed(2)} tokens per target forward → {speedup.toFixed(2)}×
        </span>
        <span className="text-muted-foreground">
          {" "}
          · hard ceiling 8 tokens per forward, whatever the acceptance rate
        </span>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Measured from the shipped `dflash/config.json` and `dflash.py`:
        block_size 8, one draft pass and one verification pass per step. The
        acceptance rate and the draft-cost fraction are yours to set — I have no
        way to measure either without serving the model.
      </figcaption>
    </figure>
  )
}
