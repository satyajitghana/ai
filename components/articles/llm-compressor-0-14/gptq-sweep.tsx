"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { COLS, ROWS, sweep } from "./gptq-math"

// GPTQ's column sweep on a 6 x 12 layer, against round-to-nearest.
//
// Step the slider and GPTQ quantizes one more column: every row rounds that
// column to its grid, and the rounding error, scaled by the inverse Hessian's
// Cholesky row, is subtracted from every column not yet quantized. The cells
// that moved carry a bar showing how far. The strip under the matrix is that
// Cholesky row, the recipe for the fan-out. The chart is the layer's output
// error on held-out tokens as columns are committed, GPTQ against rounding
// the same columns and leaving the rest alone.
//
// The algorithm is Algorithm 1 of the GPTQ paper with one block; the layer, the
// calibration tokens and their correlation are seeded random numbers (see
// gptq-math.ts). All arithmetic is + - * / and sqrt, so SSR and the browser agree.

const RHOS = [0, 0.5, 0.9, 0.99]
const BITS = [2, 3, 4]

const POS = "oklch(0.72 0.15 55)"
const NEG = "oklch(0.62 0.14 250)"
const GPTQ = "oklch(0.6 0.13 190)"
const RTN = "oklch(0.62 0.19 340)"

const CW = 52
const CH = 30
const PL = 34
const TOP = 18
const W = PL + COLS * CW + 8
const GRID_H = ROWS * CH
const STRIP_Y = TOP + GRID_H + 46
const STRIP_H = 44
const CHART_Y = STRIP_Y + STRIP_H + 40
const CHART_H = 120
const H = CHART_Y + CHART_H + 30

export function GptqSweep() {
  const [k, setK] = useState(4)
  const [ri, setRi] = useState(2)
  const [bi, setBi] = useState(1)
  const rho = RHOS[ri]
  const bits = BITS[bi]
  const s = useMemo(() => sweep(rho, bits), [rho, bits])

  const cur = s.states[k]
  const mv = s.moved[k]
  const sp = s.spread[k]
  const vmax = s.W.reduce((m, row) => row.reduce((mm, v) => Math.max(mm, Math.abs(v)), m), 0)
  const mvmax = Math.max(1e-9, ...mv.flat().map(Math.abs))

  const errMax = Math.max(...s.rtnErr, ...s.gptqErr) * 1.08
  const cx = (i: number) => PL + (i / COLS) * (COLS * CW)
  const cy = (e: number) => CHART_Y + CHART_H - (e / errMax) * CHART_H
  const line = (arr: number[]) => arr.map((e, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(2)},${cy(e).toFixed(2)}`).join(" ")

  const gFinal = s.gptqErr[COLS]
  const rFinal = s.rtnErr[COLS]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          GPTQ column sweep · 6 × 12 layer · 48 calibration tokens
        </span>
        <div className="flex gap-1">
          {BITS.map((b, i) => (
            <button
              key={b}
              type="button"
              onClick={() => setBi(i)}
              aria-pressed={bi === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                bi === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              INT{b}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
            <span>columns quantized</span>
            <Range
              min={0}
              max={COLS}
              step={1}
              value={k}
              onChange={(e) => setK(Number(e.target.value))}
              aria-label="Number of columns GPTQ has quantized"
              className="w-40"
            />
            <span className="w-12 text-foreground tabular-nums">
              {k} / {COLS}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>input correlation</span>
            {RHOS.map((r, i) => (
              <button
                key={r}
                type="button"
                onClick={() => setRi(i)}
                aria-pressed={ri === i}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
                  ri === i
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`A 6 by 12 weight matrix after GPTQ has quantized ${k} of 12 columns at ${bits} bits with input correlation ${rho}. Held-out output error: GPTQ ${gFinal.toFixed(4)}, round-to-nearest ${rFinal.toFixed(4)} once all columns are quantized.`}
        >
          <text x={PL} y={TOP - 6} fontSize="10" className="fill-muted-foreground font-mono">
            working weights · outlined = on the grid · bar = moved by the last step
          </text>
          {cur.map((row, r) =>
            row.map((v, c) => {
              const x = PL + c * CW
              const y = TOP + r * CH
              const done = c < k
              const last = c === k - 1
              const d = mv[r][c]
              const bw = (Math.abs(d) / mvmax) * (CW - 10)
              return (
                <g key={`${r}-${c}`}>
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={CW - 2}
                    height={CH - 2}
                    rx="3"
                    fill={v >= 0 ? POS : NEG}
                    fillOpacity={0.12 + 0.6 * (Math.abs(v) / vmax)}
                    stroke={last ? "currentColor" : done ? "currentColor" : "none"}
                    strokeOpacity={last ? 0.9 : 0.35}
                    strokeWidth={last ? 2 : 1}
                  />
                  <text
                    x={x + CW / 2}
                    y={y + CH / 2 + 2}
                    textAnchor="middle"
                    fontSize="10"
                    className={cn("font-mono", done ? "fill-foreground" : "fill-muted-foreground")}
                  >
                    {v.toFixed(2)}
                  </text>
                  {!done && bw > 0.5 && (
                    <rect
                      x={x + CW / 2 - bw / 2}
                      y={y + CH - 6}
                      width={bw}
                      height="3"
                      rx="1.5"
                      fill={d >= 0 ? POS : NEG}
                    />
                  )}
                </g>
              )
            })
          )}
          {Array.from({ length: COLS }, (_, c) => (
            <text
              key={`c${c}`}
              x={PL + c * CW + CW / 2}
              y={TOP + GRID_H + 12}
              textAnchor="middle"
              fontSize="9"
              className="fill-muted-foreground font-mono"
            >
              {c}
            </text>
          ))}
          {Array.from({ length: ROWS }, (_, r) => (
            <text
              key={`r${r}`}
              x={PL - 8}
              y={TOP + r * CH + CH / 2 + 3}
              textAnchor="end"
              fontSize="9"
              className="fill-muted-foreground font-mono"
            >
              r{r}
            </text>
          ))}

          <text x={PL} y={STRIP_Y - 8} fontSize="10" className="fill-muted-foreground font-mono">
            {k === 0
              ? "Cholesky row of the next column: step the slider"
              : `how column ${k - 1}'s error fans out: U[${k - 1}, c] / U[${k - 1}, ${k - 1}]`}
          </text>
          <line
            x1={PL}
            y1={STRIP_Y + STRIP_H / 2}
            x2={PL + COLS * CW}
            y2={STRIP_Y + STRIP_H / 2}
            stroke="currentColor"
            strokeOpacity="0.2"
          />
          {sp.map((v, c) => {
            if (k === 0 || c < k) return null
            const h = Math.min(1, Math.abs(v)) * (STRIP_H / 2 - 2)
            return (
              <rect
                key={`s${c}`}
                x={PL + c * CW + CW * 0.3}
                y={v >= 0 ? STRIP_Y + STRIP_H / 2 - h : STRIP_Y + STRIP_H / 2}
                width={CW * 0.4}
                height={h}
                rx="1.5"
                fill="currentColor"
                fillOpacity="0.55"
              />
            )
          })}

          <text x={PL} y={CHART_Y - 8} fontSize="10" className="fill-muted-foreground font-mono">
            output error on held-out tokens, ||(W − Ŵ)X||² / ||WX||², as columns are committed
          </text>
          <line x1={PL} y1={CHART_Y + CHART_H} x2={PL + COLS * CW} y2={CHART_Y + CHART_H} stroke="currentColor" strokeOpacity="0.25" />
          <path d={line(s.rtnErr)} fill="none" stroke={RTN} strokeWidth="2" strokeDasharray="5 4" />
          <path d={line(s.gptqErr)} fill="none" stroke={GPTQ} strokeWidth="2.25" />
          <line x1={cx(k)} y1={CHART_Y} x2={cx(k)} y2={CHART_Y + CHART_H} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 3" />
          <circle cx={cx(k)} cy={cy(s.rtnErr[k])} r="3.5" fill={RTN} />
          <circle cx={cx(k)} cy={cy(s.gptqErr[k])} r="3.5" fill={GPTQ} />
          <g fontSize="10" className="font-mono">
            <line x1={PL + 8} y1={CHART_Y + 8} x2={PL + 30} y2={CHART_Y + 8} stroke={RTN} strokeWidth="2" strokeDasharray="5 4" />
            <text x={PL + 36} y={CHART_Y + 11} fill={RTN}>
              round to nearest
            </text>
            <line x1={PL + 8} y1={CHART_Y + 24} x2={PL + 30} y2={CHART_Y + 24} stroke={GPTQ} strokeWidth="2.25" />
            <text x={PL + 36} y={CHART_Y + 27} fill={GPTQ}>
              GPTQ
            </text>
          </g>
          <text x={PL} y={CHART_Y + CHART_H + 14} fontSize="9" className="fill-muted-foreground font-mono">
            0
          </text>
          <text x={PL + COLS * CW} y={CHART_Y + CHART_H + 14} textAnchor="end" fontSize="9" className="fill-muted-foreground font-mono">
            12 columns
          </text>
        </svg>

        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">round to nearest</dt>
            <dd className="text-foreground tabular-nums">{rFinal.toFixed(4)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">GPTQ</dt>
            <dd className="font-semibold text-foreground tabular-nums">{gFinal.toFixed(4)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">GPTQ / RTN</dt>
            <dd className="text-foreground tabular-nums">{(gFinal / rFinal).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">grid points changed</dt>
            <dd className="text-foreground tabular-nums">
              {s.differ} of {ROWS * COLS}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {k === 0 ? (
            <>
              Nothing is quantized yet. Each step rounds one column in every row to that row&apos;s grid, then
              subtracts the rounding error, scaled by one row of the inverse Hessian&apos;s Cholesky factor, from
              every column to its right.
            </>
          ) : rho === 0 ? (
            <>
              With uncorrelated inputs the fan-out is only sampling noise from 48 tokens, and GPTQ ends up{" "}
              {gFinal > rFinal ? "slightly worse than" : "about level with"} rounding on held-out tokens. The
              compensation needs correlated input channels to work with.
            </>
          ) : (
            <>
              Column {k - 1} is on the grid. Its error moved the cells to its right in proportion to the strip
              above: columns whose inputs track column {k - 1}&apos;s absorb the most. After all 12 columns GPTQ&apos;s
              output error is {(gFinal / rFinal).toFixed(2)} times rounding&apos;s, and it got there by choosing a
              different grid point for {s.differ} of {ROWS * COLS} weights.
            </>
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
          Illustrative: the layer and its calibration tokens are seeded random numbers. The update rule, the
          Cholesky factor and the 1% dampening are GPTQ&apos;s, with a single block.
        </p>
      </div>
    </figure>
  )
}
