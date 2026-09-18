"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { ATT, FigureCard, Legend, OK, SINK } from "./shared"

// The whole "why entropic OT could forbid a sink" argument in one picture.
// Both grids start from the SAME content scores. Key 0 then gets an extra
// additive bias (the slider) — a token every query finds a little relevant
// regardless of content, the textbook setup for a sink. Softmax only
// constrains each ROW to sum to 1, so nothing stops every row from routing
// its mass to the same column; the Sinkhorn plan additionally constrains
// every COLUMN to sum to 1 (a fixed capacity budget per key), computed by
// alternately rescaling rows and columns of the same exp(score/tau) kernel
// (Sinkhorn–Knopp) until both marginals hold.
//
// N=6 keeps the grid legible; deterministic content scores (no Math.random);
// all exponentials go through lib/dmath so SSR and the client agree bit-for-bit.

const N = 6
const TAU = 1
const ITERS = 60
const BUDGET_MAX = N // fixed bar scale so the contrast reads at a glance

function contentScore(i: number, j: number): number {
  return 1.1 - 0.28 * Math.abs(i - j)
}

function softmaxPlan(scores: number[][]): number[][] {
  return scores.map((row) => {
    const m = Math.max(...row)
    const ex = row.map((s) => mexp((s - m) / TAU))
    const z = ex.reduce((a, b) => a + b, 0)
    return ex.map((e) => e / z)
  })
}

// Entropic OT with UNIFORM row *and* column marginals (both = 1): the
// two-sided constraint softmax never has. Alternately rescale rows, then
// columns, of the same kernel until both hold — Sinkhorn–Knopp.
function sinkhornPlan(scores: number[][]): number[][] {
  const K = scores.map((row) => row.map((s) => mexp(s / TAU)))
  let u = Array(N).fill(1)
  let v = Array(N).fill(1)
  for (let it = 0; it < ITERS; it++) {
    u = u.map((_, i) => 1 / K[i].reduce((s, kij, j) => s + kij * v[j], 0))
    v = v.map((_, j) => 1 / K.reduce((s, row, i) => s + row[j] * u[i], 0))
  }
  return K.map((row, i) => row.map((kij, j) => u[i] * kij * v[j]))
}

const colSums = (P: number[][]) =>
  Array.from({ length: N }, (_, j) => P.reduce((s, row) => s + row[j], 0))

export function SinkVsTransport() {
  const [bias, setBias] = useState(2)

  const scores = useMemo(
    () =>
      Array.from({ length: N }, (_, i) =>
        Array.from({ length: N }, (_, j) => contentScore(i, j) + (j === 0 ? bias : 0))
      ),
    [bias]
  )
  const soft = useMemo(() => softmaxPlan(scores), [scores])
  const ot = useMemo(() => sinkhornPlan(scores), [scores])
  const softCols = colSums(soft)
  const otCols = colSums(ot)

  return (
    <FigureCard label="softmax vs. entropic-OT attention · same scores, one biased key">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Panel title="softmax — row-only" P={soft} colSum={softCols} />
        <Panel title="Sinkhorn OT — row + column" P={ot} colSum={otCols} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          sink bias on key 0
        </span>
        <Range
          min={0}
          max={6}
          step={0.25}
          value={bias}
          onChange={(e) => setBias(Number(e.target.value))}
          className="w-full cursor-pointer"
          accent={SINK}
        />
        <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
          {bias.toFixed(2)}
        </span>
      </div>

      <p className="mt-3 font-mono text-xs text-muted-foreground">
        column 0 receives <span style={{ color: SINK }}>{softCols[0].toFixed(2)}×</span> its
        fair share under softmax, vs. <span style={{ color: OK }}>{otCols[0].toFixed(2)}×</span>{" "}
        under the OT plan — pinned at 1.00 no matter how large the bias gets.
      </p>

      <Legend
        items={[
          { color: ATT, label: "attention weight" },
          { color: SINK, label: "column over its 1.0 budget" },
          { color: OK, label: "column at its 1.0 budget", ring: true },
        ]}
      />
    </FigureCard>
  )
}

function Panel({
  title,
  P,
  colSum,
}: {
  title: string
  P: number[][]
  colSum: number[]
}) {
  const CELL = 32
  const GAP = 3
  const GRID = N * CELL + (N - 1) * GAP
  const BARH = 44
  const GAP_TO_BARS = 10
  const H = GRID + GAP_TO_BARS + BARH
  const refY = GRID + GAP_TO_BARS + BARH - (1 / BUDGET_MAX) * BARH

  return (
    <div>
      <div className="mb-2 font-mono text-[11px] text-muted-foreground">{title}</div>
      <svg
        viewBox={`0 0 ${GRID} ${H}`}
        className="mx-auto block w-full max-w-[240px]"
        role="img"
        aria-label={`${title} attention matrix, with per-column totals below; the dashed line marks a fair-share budget of 1.0`}
      >
        {P.map((row, i) =>
          row.map((v, j) => (
            <rect
              key={`${i}-${j}`}
              x={j * (CELL + GAP)}
              y={i * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={4}
              fill={ATT}
              opacity={Math.max(0.05, Math.min(1, v))}
            />
          ))
        )}

        {/* budget reference line at column-sum = 1 */}
        <line
          x1={0}
          x2={GRID}
          y1={refY}
          y2={refY}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />

        {/* column-sum bars */}
        {colSum.map((s, j) => {
          const h = Math.min(BARH, (s / BUDGET_MAX) * BARH)
          const over = s > 1.15
          const near = s >= 0.85 && s <= 1.15
          return (
            <rect
              key={j}
              x={j * (CELL + GAP)}
              y={GRID + GAP_TO_BARS + BARH - h}
              width={CELL}
              height={Math.max(1, h)}
              rx={2}
              fill={over ? SINK : near ? OK : "var(--muted-foreground)"}
              opacity={0.85}
            />
          )
        })}
      </svg>
      <div className="mt-1 text-center font-mono text-[10px] text-muted-foreground">
        column sums (dashed = budget 1.0) · col 0 = {colSum[0].toFixed(2)}
      </div>
    </div>
  )
}
