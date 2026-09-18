"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Jina-OCR-v1's tech report, Table 8: FastMTP decoding efficiency on
// olmOCR-Bench, one NVIDIA L4, vLLM 0.20.1, batch size 1. Every number below is
// read directly from that table — nothing interpolated. k is the draft depth
// (how many tokens FastMTP's single shared block proposes per verification
// round); acceptance is the position-averaged (tau-1)/k the paper reports;
// speedup is against that execution mode's own k=0 baseline (the two modes
// have different baselines, so only the *ratio* is comparable across them).
type Mode = "eager" | "graph"

type Point = {
  k: number
  toksPerSec: number
  speedup: number
  acceptance: number | null // cumulative, percent
}

const DATA: Record<Mode, Point[]> = {
  eager: [
    { k: 0, toksPerSec: 42.7, speedup: 1.0, acceptance: null },
    { k: 1, toksPerSec: 64.0, speedup: 1.5, acceptance: 82.6 },
    { k: 2, toksPerSec: 77.9, speedup: 1.82, acceptance: 69.1 },
    { k: 3, toksPerSec: 83.1, speedup: 1.95, acceptance: 57.6 },
  ],
  graph: [
    { k: 0, toksPerSec: 158.3, speedup: 1.0, acceptance: null },
    { k: 1, toksPerSec: 185.6, speedup: 1.17, acceptance: 82.9 },
    { k: 2, toksPerSec: 183.8, speedup: 1.16, acceptance: 69.3 },
    { k: 3, toksPerSec: 172.9, speedup: 1.09, acceptance: 57.9 },
  ],
}

// Conditional acceptance a_d: probability that draft position d is accepted
// GIVEN every shallower position already was. This is what "each additional
// depth contributes less" actually means — it is not the same number as the
// cumulative "acceptance" column above.
const CONDITIONAL: Record<Mode, number[]> = {
  eager: [0.83, 0.663, 0.636],
  graph: [0.83, 0.663, 0.655],
}

const BEST_K: Record<Mode, number> = { eager: 3, graph: 1 }

const MODE_META: Record<Mode, { label: string; color: string; baseline: string }> = {
  eager: { label: "Eager", color: "oklch(0.6 0.16 255)", baseline: "42.7 tok/s" },
  graph: { label: "CUDA graphs", color: "oklch(0.68 0.17 55)", baseline: "158.3 tok/s" },
}

const WARN = "oklch(0.6 0.21 25)"

export function FastMTPTradeoff() {
  const [k, setK] = useState(3)

  const W = 700
  const H = 240
  const padL = 34
  const padR = 16
  const padT = 16
  const padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const yMax = 2.05
  const yMin = 0.95
  const yFor = (s: number) => padT + plotH - ((s - yMin) / (yMax - yMin)) * plotH
  const xFor = (kk: number) => padL + (kk / 3) * plotW

  const path = (mode: Mode) =>
    DATA[mode].map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.k).toFixed(1)} ${yFor(p.speedup).toFixed(1)}`).join(" ")

  const eagerAt = DATA.eager[k]
  const graphAt = DATA.graph[k]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          FastMTP on olmOCR-Bench &middot; NVIDIA L4, batch 1 &middot; speedup vs. each mode&rsquo;s own k=0 baseline
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px]">
          {(["eager", "graph"] as Mode[]).map((m) => (
            <span key={m} className="flex items-center gap-1" style={{ color: MODE_META[m].color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: MODE_META[m].color }} />
              {MODE_META[m].label}
            </span>
          ))}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              {`Speedup versus FastMTP draft depth k, on olmOCR-Bench, NVIDIA L4. In eager PyTorch execution, speedup rises monotonically to 1.95x at k=3. Under CUDA graphs, speedup peaks at k=1 (1.17x) and falls at deeper k, reaching only 1.09x at k=3 — the deepest, most-advertised setting is the worst one to run once the baseline itself is fast.`}
            </title>

            <line x1={padL} y1={yFor(1)} x2={W - padR} y2={yFor(1)} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2,3" />
            <text x={padL} y={yFor(1) - 5} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              1.0x — no speculation
            </text>

            {[1, 1.5, 2].map((t) => (
              <g key={t}>
                <line x1={padL} y1={yFor(t)} x2={W - padR} y2={yFor(t)} stroke="currentColor" strokeOpacity={0.06} />
                <text x={4} y={yFor(t) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {t}x
                </text>
              </g>
            ))}

            {[0, 1, 2, 3].map((kk) => (
              <text
                key={kk}
                x={xFor(kk)}
                y={H - 8}
                fontSize={9}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.45}
                fontFamily="ui-monospace, monospace"
              >
                k={kk}
              </text>
            ))}

            {(["eager", "graph"] as Mode[]).map((mode) => (
              <g key={mode}>
                <path d={path(mode)} fill="none" stroke={MODE_META[mode].color} strokeWidth={2} />
                {DATA[mode].map((p) => {
                  const isBest = p.k === BEST_K[mode]
                  return (
                    <g key={p.k}>
                      <circle cx={xFor(p.k)} cy={yFor(p.speedup)} r={isBest ? 4 : 2.5} fill={MODE_META[mode].color} />
                      {isBest ? (
                        <circle cx={xFor(p.k)} cy={yFor(p.speedup)} r={7} fill="none" stroke={MODE_META[mode].color} strokeWidth={1.5} />
                      ) : null}
                      {p.acceptance != null ? (
                        <text
                          x={xFor(p.k)}
                          y={yFor(p.speedup) - 10}
                          fontSize={9}
                          textAnchor="middle"
                          fill={MODE_META[mode].color}
                          fontFamily="ui-monospace, monospace"
                        >
                          {p.acceptance.toFixed(0)}%
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </g>
            ))}

            {/* scrub marker */}
            <line x1={xFor(k)} y1={padT} x2={xFor(k)} y2={H - padB} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2,2" />
          </svg>
        </div>

        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>scrub draft depth k</span>
          <span>acceptance % labeled at each point is cumulative, (&tau;&minus;1)/k</span>
        </div>
        <div className="mt-1 flex gap-1.5">
          {[0, 1, 2, 3].map((kk) => (
            <button
              key={kk}
              type="button"
              onClick={() => setK(kk)}
              aria-pressed={k === kk}
              className={cn(
                "flex-1 cursor-pointer rounded-md border py-1.5 font-mono text-xs transition-colors",
                k === kk ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              k={kk}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 font-mono text-xs">
          {(["eager", "graph"] as Mode[]).map((mode) => {
            const p = mode === "eager" ? eagerAt : graphAt
            const isBest = k === BEST_K[mode]
            return (
              <div key={mode}>
                <div className="flex items-center gap-1.5" style={{ color: MODE_META[mode].color }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: MODE_META[mode].color }} />
                  {MODE_META[mode].label}
                  {isBest ? <span className="text-muted-foreground">&nbsp;(best k)</span> : null}
                </div>
                <div className="mt-1 text-lg tabular-nums">
                  {p.speedup.toFixed(2)}x{" "}
                  <span className="text-[10px] text-muted-foreground">{p.toksPerSec.toFixed(1)} tok/s</span>
                </div>
              </div>
            )
          })}
        </div>

        {k > 0 ? (
          <div className="mt-3">
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              conditional acceptance a<sub>d</sub> — P(position d accepted | all shallower positions accepted)
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: k }, (_, i) => i).map((i) => (
                <div key={i} className="flex-1">
                  <div className="h-5 overflow-hidden rounded-sm bg-muted">
                    <div
                      className="h-full"
                      style={{ width: `${CONDITIONAL.eager[i] * 100}%`, background: MODE_META.eager.color, opacity: 0.75 }}
                    />
                  </div>
                  <div className="mt-0.5 text-center font-mono text-[10px] text-muted-foreground">
                    d={i + 1}: {(CONDITIONAL.eager[i] * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both modes see nearly identical acceptance —{" "}
          <span style={{ color: MODE_META.eager.color }}>eager</span> and{" "}
          <span style={{ color: MODE_META.graph.color }}>CUDA graphs</span> agree to within half a point at every k
          — because acceptance is a property of the draft block and the document, not the execution backend. What
          differs is the baseline each mode is racing against.{" "}
          <span style={{ color: MODE_META.eager.color }}>Eager</span> decoding is slow (42.7 tok/s) enough that
          three extra draft tokens per round are worth their cost, so k=3 wins at 1.95x. Once{" "}
          <span style={{ color: MODE_META.graph.color }}>CUDA graphs</span> speed the baseline itself up to
          158.3 tok/s &mdash; a 3.71x jump with no speculation at all &mdash; that fixed per-step draft-and-verify
          cost stops being free, and the best depth collapses to k=1 (1.17x). Running k=3 under CUDA graphs, the
          setting the &ldquo;doubles decoding speed&rdquo; headline implies, actually lands at{" "}
          <span style={{ color: WARN }}>1.09x</span> &mdash; barely above doing nothing, and the worst of the three
          depths tested in that mode.
        </p>
      </div>
    </figure>
  )
}
