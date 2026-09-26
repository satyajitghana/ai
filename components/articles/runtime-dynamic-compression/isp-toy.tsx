"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Iterative sensitivity probing on a toy model, so the chicken-and-egg problem
// in Section 3.1 of the paper can be watched rather than taken on trust.
//
// What is the paper's, verbatim in spirit:
//   - the codec ladder {0.7, 1, 1.125, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 4, 5}
//   - the distortion law phi(b) = 2^(a - c*b), a = 1.710, c = 2.264 (Eq. 10)
//   - sensitivity measured by changing ONE layer under the CURRENT allocation,
//     s_i(q) = L(c[i <- q]) - L(c)                                   (Eq. 1)
//   - allocation by the Lagrangian dual: each layer picks
//     argmin_q s_i(q) + lambda * b(q), lambda bisected to the budget  (Eq. 4-5)
//   - round 1 probes the uncompressed model; later rounds re-probe under the
//     allocation the previous round produced.
//
// What is mine, and invented for illustration: twelve equal-size layers with
// made-up sensitivity amplitudes ALPHA, and a "true" loss with a pairwise term
// between neighbouring layers, GAMMA * phi(b_i) * phi(b_i+1). That term is the
// super-additivity the paper describes — two adjacent heavily compressed layers
// cost more than the sum of each alone — and it is invisible when every other
// layer is at 16 bits, which is exactly why round 1 misprices at low budgets.
// No expert removal here: codecs only.

const LADDER = [0.7, 1, 1.125, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 4, 5]
const PHI = LADDER.map((b) => mpow(2, 1.71 - 2.264 * b))
const UNCOMPRESSED = -1 // index sentinel: 16-bit layer, phi = 0

const ALPHA = [1.6, 0.5, 0.8, 0.35, 1.1, 0.4, 0.6, 0.3, 0.9, 0.45, 0.7, 1.4]
const GAMMA = 1.2
const N = ALPHA.length

const BUDGETS = [1.25, 1.5, 1.75, 2, 2.5, 3]
const ROUNDS = 4

const phiOf = (j: number) => (j === UNCOMPRESSED ? 0 : PHI[j])

function loss(c: number[]): number {
  let s = 0
  for (let i = 0; i < N; i++) s += ALPHA[i] * phiOf(c[i])
  for (let i = 0; i + 1 < N; i++) s += GAMMA * phiOf(c[i]) * phiOf(c[i + 1])
  return s
}

// Eq. 1: change one layer, keep every other layer where it currently is.
function probe(c: number[]): number[][] {
  const base = loss(c)
  return c.map((_, i) =>
    LADDER.map((__, j) => {
      const t = c.slice()
      t[i] = j
      return loss(t) - base
    })
  )
}

// Eq. 4-5: for a price lambda per bit every layer chooses independently;
// bisect lambda to the smallest price whose allocation fits the budget.
function allocate(S: number[][], budget: number): { c: number[]; lambda: number } {
  const pick = (lam: number) =>
    S.map((row) => {
      let best = 0
      let bv = Infinity
      row.forEach((s, j) => {
        const v = s + lam * LADDER[j]
        if (v < bv) {
          bv = v
          best = j
        }
      })
      return best
    })
  const cap = budget * N + 1e-9
  let lo = 0
  let hi = 64
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    const bits = pick(mid).reduce((a, j) => a + LADDER[j], 0)
    if (bits <= cap) hi = mid
    else lo = mid
  }
  return { c: pick(hi), lambda: hi }
}

function run(budget: number) {
  let cur = new Array<number>(N).fill(UNCOMPRESSED)
  const rounds: { c: number[]; lambda: number; loss: number }[] = []
  for (let r = 0; r < ROUNDS; r++) {
    const { c, lambda } = allocate(probe(cur), budget)
    rounds.push({ c, lambda, loss: loss(c) })
    cur = c
  }
  // Uniform baseline: every layer on the largest rung that fits the budget.
  let u = 0
  LADDER.forEach((b, j) => {
    if (b <= budget + 1e-9) u = j
  })
  return { rounds, uniform: loss(new Array<number>(N).fill(u)), uniformBits: LADDER[u] }
}

const ONE = "oklch(0.66 0.16 45)"
const ISP = "oklch(0.6 0.16 250)"

const W = 720
const ROW_H = 92
const PL = 92
const PR = 8
const TOP = 14

export function IspToy() {
  const [bi, setBi] = useState(0)
  const [round, setRound] = useState(2)
  const budget = BUDGETS[bi]
  const res = useMemo(() => run(budget), [budget])
  const one = res.rounds[0]
  const isp = res.rounds[round - 1]
  const changed = one.c.filter((j, k) => j !== isp.c[k]).length

  const colW = (W - PL - PR) / N
  const barH = (b: number) => (b / 5) * (ROW_H - 26)
  const avg = (c: number[]) => c.reduce((a, j) => a + LADDER[j], 0) / N

  const rows = [
    { key: "one", label: "probe once", sub: "round 1", c: one.c, color: ONE },
    { key: "isp", label: "ISP", sub: `round ${round}`, c: isp.c, color: ISP },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          iterative sensitivity probing · toy model, paper&apos;s ladder and distortion law
        </span>
        <div className="flex gap-1">
          {Array.from({ length: ROUNDS }, (_, k) => k + 1).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRound(r)}
              aria-pressed={round === r}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                round === r
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              round {r}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>budget</span>
          <Range
            min={0}
            max={BUDGETS.length - 1}
            step={1}
            value={bi}
            onChange={(e) => setBi(Number(e.target.value))}
            aria-label="Average bits per weight budget"
            className="w-44"
          />
          <span className="text-foreground tabular-nums">{budget.toFixed(2)} bits per weight, average</span>
        </label>

        <svg
          viewBox={`0 0 ${W} ${TOP + ROW_H * 2 + 30}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Bits per layer for twelve toy layers at a ${budget} bit budget: probing once on the uncompressed model versus ISP after ${round} rounds.`}
        >
          {rows.map((row, ri) => {
            const y0 = TOP + ri * ROW_H
            const base = y0 + ROW_H - 14
            return (
              <g key={row.key}>
                <text x={0} y={y0 + 28} fontSize="12" className="fill-foreground font-mono">
                  {row.label}
                </text>
                <text x={0} y={y0 + 44} fontSize="10" className="fill-muted-foreground font-mono">
                  {row.sub}
                </text>
                <text x={0} y={y0 + 58} fontSize="10" className="fill-muted-foreground font-mono">
                  avg {avg(row.c).toFixed(2)}
                </text>
                <line x1={PL} y1={base} x2={W - PR} y2={base} stroke="currentColor" strokeOpacity="0.2" />
                {row.c.map((j, k) => {
                  const b = LADDER[j]
                  const h = barH(b)
                  const x = PL + k * colW + colW * 0.18
                  const w = colW * 0.64
                  const moved = ri === 1 && j !== one.c[k]
                  return (
                    <g key={k}>
                      <rect x={x} y={base - h} width={w} height={h} rx="2" fill={row.color} fillOpacity={moved ? 1 : 0.7} />
                      <text x={x + w / 2} y={base - h - 4} textAnchor="middle" fontSize="10" className="fill-foreground font-mono">
                        {b}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
          <text x={0} y={TOP + ROW_H * 2 + 12} fontSize="10" className="fill-muted-foreground font-mono">
            layer
          </text>
          <text x={0} y={TOP + ROW_H * 2 + 25} fontSize="10" className="fill-muted-foreground font-mono">
            amplitude
          </text>
          {ALPHA.map((a, k) => (
            <g key={`l${k}`} fontSize="10" className="fill-muted-foreground font-mono">
              <text x={PL + k * colW + colW / 2} y={TOP + ROW_H * 2 + 12} textAnchor="middle">
                L{k}
              </text>
              <text x={PL + k * colW + colW / 2} y={TOP + ROW_H * 2 + 25} textAnchor="middle">
                {a}
              </text>
            </g>
          ))}
        </svg>

        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">uniform ({res.uniformBits} everywhere)</dt>
            <dd className="text-foreground tabular-nums">toy loss {res.uniform.toFixed(3)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">probe once (round 1)</dt>
            <dd className="text-foreground tabular-nums">toy loss {one.loss.toFixed(3)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ISP, round {round}</dt>
            <dd className="font-semibold text-foreground tabular-nums">toy loss {isp.loss.toFixed(3)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {round === 1 ? (
            <>
              Round 1 probes each layer while every other layer is still at 16 bits, so the neighbour term is
              invisible and each layer looks only as sensitive as its own amplitude (the bottom row).
              Step to round 2 to re-probe under this allocation.
            </>
          ) : changed === 0 ? (
            <>
              At this budget re-probing changes nothing: compression is mild enough that the layers&apos;
              costs stay close to additive, and one probe was already enough.
            </>
          ) : (
            <>
              Re-probing under round 1&apos;s allocation moved{" "}
              <span className="text-foreground">{changed}</span> of {N} layers (solid bars). It evens out
              neighbours that were both pushed low, because now each probe sees them compressed together.
              The price of a bit, the multiplier λ, settled at{" "}
              <span className="text-foreground tabular-nums">{isp.lambda.toFixed(3)}</span> toy-loss units.
            </>
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
          Illustrative: the layer amplitudes and the neighbour term are invented. The ladder, the distortion law
          and the probe-then-allocate loop are the paper&apos;s.
        </p>
      </div>
    </figure>
  )
}
