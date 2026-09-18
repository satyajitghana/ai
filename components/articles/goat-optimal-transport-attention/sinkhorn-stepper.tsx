"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"
import { ATT, FigureCard, Legend, OK, SINK, useReducedMotion, useTicker } from "./shared"

// Sinkhorn–Knopp, one half-step at a time: start from a raw affinity kernel,
// then alternately rescale every ROW to sum to 1, then every COLUMN to sum to
// 1, and repeat. Step 1 (the first row-normalize) is exactly softmax — and its
// column sums are wildly uneven, a sink in miniature. Each further half-step
// squeezes the OTHER axis back toward its budget without fully undoing the
// axis just fixed, so both marginals converge together. That alternation,
// not a single normalization, is what a genuine two-sided OT attention plan
// (e.g. Sinkformers) actually pays for — one more full pass over the score
// matrix per iteration.

const N = 5
const HALF_STEPS = 8 // 4 full Sinkhorn iterations after the raw kernel
const BAR_MAX = 4 // fixed scale so "how far from budget" reads consistently across steps

function content(i: number, j: number): number {
  return 1.0 - 0.3 * Math.abs(i - j) + (j === 0 ? 2.5 : 0)
}

const RAW: number[][] = Array.from({ length: N }, (_, i) =>
  Array.from({ length: N }, (_, j) => mexp(content(i, j)))
)

function rowNormalize(M: number[][]): number[][] {
  return M.map((row) => {
    const z = row.reduce((a, b) => a + b, 0)
    return row.map((v) => v / z)
  })
}
function colNormalize(M: number[][]): number[][] {
  const sums = Array.from({ length: N }, (_, j) => M.reduce((s, row) => s + row[j], 0))
  return M.map((row) => row.map((v, j) => v / sums[j]))
}
const rowSums = (M: number[][]) => M.map((row) => row.reduce((a, b) => a + b, 0))
const colSums = (M: number[][]) =>
  Array.from({ length: N }, (_, j) => M.reduce((s, row) => s + row[j], 0))

// Precompute every step once, at module scope — pure function of fixed data,
// deterministic on server and client.
const STEPS: { M: number[][]; kind: "raw" | "row" | "col" }[] = [{ M: RAW, kind: "raw" }]
for (let k = 1; k <= HALF_STEPS; k++) {
  const prev = STEPS[k - 1].M
  const isRow = k % 2 === 1
  STEPS.push({ M: isRow ? rowNormalize(prev) : colNormalize(prev), kind: isRow ? "row" : "col" })
}

function labelFor(i: number): string {
  if (i === 0) return "raw"
  const iter = Math.ceil(i / 2)
  return STEPS[i].kind === "row" ? `row ${iter}` : `col ${iter}`
}

export function SinkhornStepper() {
  const [step, setStep] = useState(1) // start at step 1 = plain softmax, the recognizable baseline
  const [playing, setPlaying] = useState(false)
  const reduced = useReducedMotion()

  useTicker(playing, reduced, 1100, () => {
    setStep((s) => (s >= HALF_STEPS ? 0 : s + 1))
  })

  const cur = STEPS[step]
  const rs = rowSums(cur.M)
  const cs = colSums(cur.M)
  const maxEntry = Math.max(...cur.M.flat())

  const CELL = 30
  const GAP = 3
  const GRID = N * CELL + (N - 1) * GAP
  const RBARW = 46
  const CBARH = 46
  const PAD = 10
  const W = GRID + PAD + RBARW
  const H = GRID + PAD + CBARH
  const rowRefX = GRID + PAD + (1 / BAR_MAX) * RBARW
  const colRefY = GRID + PAD + CBARH - (1 / BAR_MAX) * CBARH

  return (
    <FigureCard
      label="Sinkhorn–Knopp · alternating row / column normalization"
      right={
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-pressed={playing}
        >
          {reduced ? "step mode" : playing ? "pause" : "play"}
        </button>
      }
    >
      {/* step buttons */}
      <div className="flex flex-wrap items-center gap-1 border-b pb-3">
        {STEPS.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setPlaying(false)
              setStep(i)
            }}
            aria-current={i === step ? "step" : undefined}
            className="cursor-pointer rounded px-2 py-1 font-mono text-[10px] transition-colors"
            style={
              i === step
                ? { background: "var(--foreground)", color: "var(--background)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            {i}·{labelFor(i)}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 pt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-[300px]"
          role="img"
          aria-label={`Sinkhorn iteration step ${step}: ${cur.kind === "raw" ? "raw affinity kernel, before any normalization" : cur.kind === "row" ? "after row-normalizing" : "after column-normalizing"}. Row sums and column sums shown as bars against a budget of 1.0.`}
        >
          {/* matrix */}
          {cur.M.map((row, i) =>
            row.map((v, j) => (
              <rect
                key={`${i}-${j}`}
                x={j * (CELL + GAP)}
                y={i * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={4}
                fill={ATT}
                opacity={Math.max(0.05, Math.min(1, v / maxEntry))}
              />
            ))
          )}

          {/* row-sum bars, right of the grid */}
          <line
            x1={rowRefX}
            x2={rowRefX}
            y1={0}
            y2={GRID}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          {rs.map((s, i) => {
            const w = Math.min(RBARW, (s / BAR_MAX) * RBARW)
            const over = s > 1.15
            const near = s >= 0.85 && s <= 1.15
            return (
              <rect
                key={i}
                x={GRID + PAD}
                y={i * (CELL + GAP)}
                width={Math.max(1, w)}
                height={CELL}
                rx={2}
                fill={cur.kind === "raw" ? "var(--muted-foreground)" : over ? SINK : near ? OK : "var(--muted-foreground)"}
                opacity={0.85}
              />
            )
          })}

          {/* column-sum bars, below the grid */}
          <line
            x1={0}
            x2={GRID}
            y1={colRefY}
            y2={colRefY}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          {cs.map((s, j) => {
            const h = Math.min(CBARH, (s / BAR_MAX) * CBARH)
            const over = s > 1.15
            const near = s >= 0.85 && s <= 1.15
            return (
              <rect
                key={j}
                x={j * (CELL + GAP)}
                y={GRID + PAD + CBARH - h}
                width={CELL}
                height={Math.max(1, h)}
                rx={2}
                fill={cur.kind === "raw" ? "var(--muted-foreground)" : over ? SINK : near ? OK : "var(--muted-foreground)"}
                opacity={0.85}
              />
            )
          })}
        </svg>

        <div className="grid w-full max-w-[300px] grid-cols-2 gap-2 font-mono text-[10px] text-muted-foreground">
          <span>row sums (right) → budget 1.0</span>
          <span className="text-right">col sums (below) → budget 1.0</span>
        </div>
      </div>

      <p className="mt-4 font-mono text-xs text-muted-foreground">
        {cur.kind === "raw"
          ? "raw kernel: neither axis is normalized yet."
          : cur.kind === "row"
            ? `after row-normalize: every row sums to 1.00 (this step alone is plain softmax); column 0 still holds ${cs[0].toFixed(2)}× its budget.`
            : `after column-normalize: every column sums to 1.00; rows have drifted to ${Math.min(...rs).toFixed(2)}–${Math.max(...rs).toFixed(2)}.`}
      </p>

      <Legend
        items={[
          { color: ATT, label: "matrix entry" },
          { color: SINK, label: "axis over its 1.0 budget" },
          { color: OK, label: "axis at its 1.0 budget", ring: true },
        ]}
      />
    </FigureCard>
  )
}
