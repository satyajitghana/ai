"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"

// Tokens per parameter, as published, against the number everyone quotes.
//
// Chinchilla's "about 20" answers one specific question: for a fixed TRAINING
// budget, where does validation loss bottom out? It is the right answer to that
// question and almost nobody is asking it, because a model that will serve
// billions of requests is paid for at inference, where the bill scales with
// parameters and not with how much the thing read.
//
// Ratios below are D/N from published counts. The 2026 end of the ladder is not
// a rounding of Chinchilla — it is three to four orders of magnitude away from
// it, on purpose.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Row = { name: string; year: string; N: number; D: number; note: string; c: string }

const LADDER: Row[] = [
  { name: "GPT-3", year: "2020", N: 175e9, D: 300e9, note: "pre-Chinchilla: a huge model that had barely read", c: WARM },
  { name: "Chinchilla", year: "2022", N: 70e9, D: 1.4e12, note: "the compute-optimal point, and the source of “20”", c: ACCENT },
  { name: "Llama 2 70B", year: "2023", N: 70e9, D: 2e12, note: "already past the rule", c: MUTED },
  { name: "Llama 3 70B", year: "2024", N: 70e9, D: 15e12, note: "deliberately over-trained for cheap serving", c: MUTED },
  { name: "Qwen3-0.6B", year: "2025", N: 0.6e9, D: 36e12, note: "small model, enormous read", c: GOOD },
  { name: "LFM2.5-350M", year: "2026", N: 0.354e9, D: 28e12, note: "28T tokens into 354M parameters", c: GOOD },
]

const fmtN = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(v >= 10e9 ? 0 : 2)}B` : `${(v / 1e6).toFixed(0)}M`)
const fmtD = (v: number) => `${(v / 1e12).toFixed(v >= 1e12 ? 1 : 2)}T`

export function AllocationLadder() {
  const [sel, setSel] = useState(1)
  const [serveShare, setServeShare] = useState(70)

  const W = 700
  const H = 176
  const X0 = 150
  const X1 = 660
  // The axis has to start at 1, not 10: GPT-3 sits at 1.7 tokens per parameter
  // and would otherwise be plotted off the left edge, on top of its own label.
  const LO = 0 // 10^0 = 1
  const HI = 5 // 10^5 = 100,000
  const PX = (ratio: number) => X0 + ((mlog10(ratio) - LO) / (HI - LO)) * (X1 - X0)

  const row = LADDER[sel]
  const ratio = row.D / row.N

  // A crude but honest lifetime-cost split: training is 6ND, serving is roughly
  // 2N per generated token times however many tokens the model ever emits.
  const share = serveShare / 100
  const trainFlops = 6 * row.N * row.D
  // pick the serving volume implied by the requested split at Chinchilla's ratio
  const serveTokens = (share / Math.max(1e-6, 1 - share)) * (trainFlops / (2 * row.N))
  const serveFlops = 2 * row.N * serveTokens
  const total = trainFlops + serveFlops

  const fmtE = (v: number) => {
    const e = Math.floor(mlog10(v))
    const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹"
    const sup = String(e).replace(/\d/g, (d) => SUP[Number(d)])
    return `${(v / mpow(10, e)).toFixed(2)}×10${sup}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          tokens per parameter, as actually shipped
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          Chinchilla says 20 · 2026 ships {Math.round(LADDER[5].D / LADDER[5].N).toLocaleString()}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              A logarithmic axis of tokens per parameter from one to one hundred thousand, with six
              published models placed on it. GPT-3 sits at two, Chinchilla at twenty, Llama 3 at two
              hundred and fourteen, and the 2025 and 2026 models three to four orders of magnitude
              further right at sixty thousand and seventy-nine thousand.
            </title>

            {/* the Chinchilla marker */}
            <line x1={PX(20)} y1={10} x2={PX(20)} y2={H - 34} stroke={ACCENT} strokeDasharray="3 3" strokeOpacity={0.8} />
            <text x={PX(20)} y={8} fontSize={9} textAnchor="middle" fill={ACCENT} fontFamily="ui-monospace, monospace">
              Chinchilla ≈ 20
            </text>

            {/* the inference-aware band */}
            <rect x={PX(100)} y={14} width={PX(200) - PX(100)} height={H - 50} fill={GOOD} fillOpacity={0.08} />
            <text x={(PX(100) + PX(200)) / 2} y={H - 30} fontSize={8} textAnchor="middle" fill={GOOD} fontFamily="ui-monospace, monospace">
              inference-aware
            </text>

            {LADDER.map((r, i) => {
              const y = 22 + i * 21
              const on = i === sel
              return (
                <g key={r.name} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                  <text
                    x={X0 - 10}
                    y={y + 3}
                    fontSize={9.5}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={on ? 1 : 0.6}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.name}
                  </text>
                  <line x1={X0} y1={y} x2={PX(r.D / r.N)} y2={y} stroke={r.c} strokeOpacity={on ? 0.7 : 0.3} strokeWidth={on ? 2 : 1} />
                  <circle cx={PX(r.D / r.N)} cy={y} r={on ? 5 : 3.5} fill={r.c} />
                  <text
                    x={PX(r.D / r.N) + 9}
                    y={y + 3}
                    fontSize={9}
                    fill={r.c}
                    fontFamily="ui-monospace, monospace"
                  >
                    {Math.round(r.D / r.N).toLocaleString()}
                  </text>
                </g>
              )
            })}

            <line x1={X0} y1={H - 26} x2={X1} y2={H - 26} stroke="currentColor" strokeOpacity={0.25} />
            {[0, 1, 2, 3, 4, 5].map((e) => (
              <g key={e}>
                <line x1={PX(mpow(10, e))} y1={H - 26} x2={PX(mpow(10, e))} y2={H - 22} stroke="currentColor" strokeOpacity={0.25} />
                <text
                  x={PX(mpow(10, e))}
                  y={H - 12}
                  fontSize={8}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.42}
                  fontFamily="ui-monospace, monospace"
                >
                  10<tspan fontSize={6} dy={-3}>{e}</tspan>
                </text>
              </g>
            ))}
            <text x={X1} y={H - 2} fontSize={8.5} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              tokens per parameter →
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[11px] text-foreground">
              {row.name} <span className="text-muted-foreground">({row.year})</span>
            </span>
            <span className="font-mono text-[10px]" style={{ color: row.c }}>
              {fmtN(row.N)} params · {fmtD(row.D)} tokens · {Math.round(ratio).toLocaleString()} tok/param
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.note}</div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-40 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            lifetime FLOPs on serving
          </span>
          <Range
            min={0}
            max={95}
            step={5}
            value={serveShare}
            onChange={(e) => setServeShare(Number(e.target.value))}
            className="flex-1"
            aria-label="how much of the model's total lifetime compute goes to inference rather than training"
            accent={GOOD}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {serveShare}%
          </span>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            { l: "training, 6ND", v: fmtE(trainFlops), c: ACCENT },
            { l: "serving, 2N per token", v: fmtE(serveFlops), c: GOOD },
            { l: "lifetime total", v: fmtE(total), c: WARM },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          the serving figure is the volume implied by the slider, not a measured one — the point is
          the shape, not the digits
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          &ldquo;Twenty tokens per parameter&rdquo; is the most-quoted number in applied scaling and
          it answers a question almost nobody is asking. It is where validation loss bottoms out for
          a fixed <em>training</em>{" "}budget. Push the slider: once most of a model&rsquo;s lifetime
          arithmetic is spent answering requests rather than reading, the parameter count is what you
          pay for forever, and the optimum moves — first to the{" "}
          <span style={{ color: GOOD }}>100–200</span>{" "}band that inference-aware fits recommend,
          and then well past it.
          <br />
          <br />
          <span className="text-foreground">
            The 2026 end of that ladder is not a refinement of Chinchilla. It is three to four
            orders of magnitude away from it
          </span>
          , and it is a deliberate choice rather than a correction: an over-read small model is worse
          per training FLOP and much cheaper to run for the next two years.
        </p>
      </div>
    </figure>
  )
}
