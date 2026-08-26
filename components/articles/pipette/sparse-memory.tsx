"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Sparse activation splits one number into two, and on a phone they are paid by
// two different components.
//
// Decode throughput is memory-bandwidth bound: per token you stream the weights
// you actually use. Peak RAM is not — every expert has to be resident whether it
// fires or not. So an 8.5B model activating 1.5B decodes roughly like a 1.5B and
// occupies roughly like an 8.5B, and Pipette measures exactly that: LFM2.5-8B-A1B
// decodes 2.4x faster than Qwen3.5-4B and 2.6x faster than Ministral-3-3B at
// 2,048 input tokens on a Galaxy S26 Ultra, and still peaks at 5.29 GiB.
//
// The RAM model below is calibrated on that 5.29 GiB figure (Q4_K_M ≈ 4.85 bits
// per weight, plus ~0.5 GiB of cache and activations). The speed model is the
// naive bandwidth argument — and comparing it against the measured ratios is
// more interesting than getting it to agree.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

const BITS = 4.85 // Q4_K_M, effective bits per weight
const OVERHEAD = 0.49 // GiB of KV cache + activations, from the LFM2.5-8B-A1B fit

const ramGiB = (totalB: number) => (totalB * 1e9 * BITS) / 8 / 2 ** 30 + OVERHEAD

// Pipette, Galaxy S26 Ultra, Q4_K_M, 2,048 input tokens
const MEASURED = [
  { name: "LFM2.5-8B-A1B", total: 8.5, active: 1.5, ratio: 1, colour: GOOD },
  { name: "Qwen3.5-4B", total: 4, active: 4, ratio: 2.4, colour: WARM },
  { name: "Ministral-3-3B", total: 3, active: 3, ratio: 2.6, colour: ACCENT },
]

export function SparseMemory() {
  const [total, setTotal] = useState(85) // tenths of a billion
  const [active, setActive] = useState(15) // tenths of a billion, so 1.5B is reachable exactly
  const [budget, setBudget] = useState(60) // tenths of a GiB

  const T = total / 10
  const A = Math.min(T, Math.max(0.1, active / 10))
  const ram = ramGiB(T)
  const budgetG = budget / 10
  const fits = ram <= budgetG

  // naive bandwidth model: throughput scales with 1 / active weights streamed
  const predicted = (other: number) => other / A

  const W = 700
  const H = 128
  const X0 = 128
  const MAXR = Math.max(ram, budgetG, 8) * 1.08
  const px = (v: number) => X0 + (v / MAXR) * (W - X0 - 84)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {T.toFixed(1)}B stored · {A.toFixed(1)}B active per token · Q4_K_M
        </span>
        <span className="font-mono text-[10px]" style={{ color: fits ? GOOD : BAD }}>
          {ram.toFixed(2)} GiB peak — {fits ? "fits your budget" : "over your budget"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two bars. Memory scales with all ${T.toFixed(1)} billion stored parameters and reaches ${ram.toFixed(2)} GiB; decode speed scales with only the ${A.toFixed(1)} billion activated per token. A budget marker sits at ${budgetG.toFixed(1)} GiB.`}
            </title>

            <text x={X0 - 10} y={26} fontSize={8.5} textAnchor="end" fill={WARM} fontFamily="ui-monospace, monospace">
              memory — all weights
            </text>
            <rect x={px(0)} y={14} width={Math.max(2, px(ram) - px(0))} height={20} rx={3} fill={WARM} fillOpacity={0.75} />
            <text x={px(ram) + 7} y={28} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
              {ram.toFixed(2)} GiB
            </text>

            <text x={X0 - 10} y={62} fontSize={8.5} textAnchor="end" fill={GOOD} fontFamily="ui-monospace, monospace">
              streamed per token
            </text>
            <rect x={px(0)} y={50} width={Math.max(2, px(ramGiB(A) - OVERHEAD) - px(0))} height={20} rx={3} fill={GOOD} fillOpacity={0.8} />
            <text x={px(ramGiB(A) - OVERHEAD) + 7} y={64} fontSize={9} fill={GOOD} fontFamily="ui-monospace, monospace">
              {(ramGiB(A) - OVERHEAD).toFixed(2)} GiB — what sets decode speed
            </text>

            <line x1={px(budgetG)} y1={8} x2={px(budgetG)} y2={86} stroke={fits ? GOOD : BAD} strokeDasharray="3 3" />
            <text x={px(budgetG)} y={100} fontSize={7.5} textAnchor="middle" fill={fits ? GOOD : BAD} fontFamily="ui-monospace, monospace">
              your RAM budget
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["stored", total, setTotal, 5, 140, 1, WARM, "total parameters, in tenths of a billion", (v: number) => `${(v / 10).toFixed(1)}B`],
              ["active", active, setActive, 1, total, 1, GOOD, "parameters that fire on a given token, in tenths of a billion", (v: number) => `${(Math.min(v, total) / 10).toFixed(1)}B`],
              ["budget", budget, setBudget, 10, 120, 1, ACCENT, "how much RAM you are willing to spend, in tenths of a gibibyte", (v: number) => `${(v / 10).toFixed(1)}G`],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria, fmt]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-16 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={v}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {fmt(v)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            the naive bandwidth model against Pipette&rsquo;s measurements
          </div>
          <div className="mt-1.5 grid gap-1">
            {MEASURED.filter((m) => m.ratio > 1).map((m) => {
              const pred = predicted(m.active)
              const off = ((m.ratio - pred) / pred) * 100
              return (
                <div key={m.name} className="flex flex-wrap items-baseline gap-x-3 font-mono text-[10px]">
                  <span className="w-40 shrink-0" style={{ color: m.colour }}>
                    vs {m.name}
                  </span>
                  <span className="text-muted-foreground">
                    predicted {pred.toFixed(2)}× · measured{" "}
                    <span className="text-foreground">{m.ratio.toFixed(1)}×</span>
                  </span>
                  <span style={{ color: Math.abs(off) < 15 ? GOOD : WARM }}>
                    {off >= 0 ? "+" : ""}
                    {off.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
            predictions at the {T.toFixed(1)}B / {A.toFixed(1)}B setting above ·
            Pipette&rsquo;s figures are Galaxy S26 Ultra, Q4_K_M, 2,048 input tokens
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two bars are the whole idea. Decode is memory-bandwidth bound, so per token you pay for
          the weights you <em>read</em>; RAM is a residency question, so you pay for the weights you{" "}
          <em>have</em>. Sparse activation puts those on different sides of a factor of five, which
          is why an 8.5B model can decode like a 1.5B one — and why it still needs 5.29 GiB of a
          phone, because an expert that never fires still has to be somewhere.
          <br />
          <br />
          The comparison panel is the more interesting half. Against Qwen3.5-4B the naive model
          over-predicts and against Ministral-3-3B it under-predicts, which means parameter
          arithmetic gets you the direction and not the number.{" "}
          <span className="text-foreground">
            The residual is kernel quality, routing overhead, memory layout and what the runtime
            happens to be good at
          </span>{" "}
          — none of which is on any model card, and all of which is why a benchmark that actually
          runs on the device exists.
        </p>
      </div>
    </figure>
  )
}
