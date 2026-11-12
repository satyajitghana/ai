"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Selection is not success.
//
// Nex reports a "valid tool selection rate" of 100% over 956 contexts: every
// tool call named a tool that was in the request's declared list. That is the
// first gate a tool call passes. This funnel puts the gates after it (was it
// the right tool for the step, were the arguments right) and then compounds the
// per-step rate over a task of k tool calls, assuming steps fail independently
// and nothing is retried. Only two inputs are reported numbers: the 956
// contexts and the valid-name rates (100.0% for Nex-N2.6, 85.3% for its base
// GLM-5.3-Flash, both from the Nex-N2.6 README). The other sliders are
// illustrative and start at round guesses.

const N = 956
const NEX = "oklch(0.60 0.15 255)"
const BASE = "oklch(0.62 0.03 260)"

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`
}

export function SelectionFunnel() {
  const [right, setRight] = useState(90)
  const [args, setArgs] = useState(95)
  const [k, setK] = useState(20)

  const rows = [
    { label: "Valid tool name", nex: 1.0, base: 0.853, reported: true },
    { label: "Right tool for the step", nex: right / 100, base: right / 100, reported: false },
    { label: "Arguments correct", nex: args / 100, base: args / 100, reported: false },
  ]
  let nexStep = 1
  let baseStep = 1
  const cum = rows.map((r) => {
    nexStep *= r.nex
    baseStep *= r.base
    return { ...r, nexCum: nexStep, baseCum: baseStep }
  })
  const nexTask = mpow(nexStep, k)
  const baseTask = mpow(baseStep, k)

  const W = 640
  const BAR = 300
  const ROW = 34
  const H = (cum.length + 1) * ROW + 24
  const X0 = 190

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">selection vs success, {N} contexts</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          task of {k} calls: <span style={{ color: NEX }}>{pct(nexTask)}</span> vs{" "}
          <span style={{ color: BASE }}>{pct(baseTask)}</span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">right tool, given a valid name: {right}%</span>
            <Range min={50} max={100} step={1} value={right} onChange={(e) => setRight(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">arguments correct: {args}%</span>
            <Range min={50} max={100} step={1} value={args} onChange={(e) => setArgs(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">tool calls per task k = {k}</span>
            <Range min={1} max={60} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full" />
          </label>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              {`A funnel of tool-call gates. With a valid-name rate of 100%, ${right}% right tool and ${args}% correct arguments, a single call succeeds ${pct(nexStep)} of the time, and a task of ${k} calls ${pct(nexTask)}. With the base model's 85.3% valid-name rate the same task succeeds ${pct(baseTask)} of the time.`}
            </title>
            {[...cum, { label: `Whole task, ${k} calls`, nexCum: nexTask, baseCum: baseTask, reported: false }].map((r, i) => {
              const y = 8 + i * ROW
              return (
                <g key={r.label}>
                  <text x={4} y={y + 12} fontSize={10} fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    {r.label}
                  </text>
                  <text x={4} y={y + 24} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                    {i === cum.length ? "per-step rate to the power k" : r.reported ? "reported by Nex" : "illustrative"}
                  </text>
                  <rect x={X0} y={y + 2} width={BAR} height={10} rx={2} fill="currentColor" fillOpacity={0.06} />
                  <rect x={X0} y={y + 2} width={Math.max(1, BAR * r.nexCum)} height={10} rx={2} fill={NEX} fillOpacity={0.85} />
                  <rect x={X0} y={y + 15} width={BAR} height={10} rx={2} fill="currentColor" fillOpacity={0.06} />
                  <rect x={X0} y={y + 15} width={Math.max(1, BAR * r.baseCum)} height={10} rx={2} fill={BASE} fillOpacity={0.85} />
                  <text x={X0 + BAR + 8} y={y + 11} fontSize={9} fill={NEX} fontFamily="ui-monospace, monospace">
                    {pct(r.nexCum)} · {Math.round(r.nexCum * N)} of {N}
                  </text>
                  <text x={X0 + BAR + 8} y={y + 24} fontSize={9} fill={BASE} fontFamily="ui-monospace, monospace">
                    {pct(r.baseCum)} · {Math.round(r.baseCum * N)} of {N}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[10px] text-muted-foreground">
          <span style={{ color: NEX }}>top bar: Nex-N2.6, valid name 100.0%</span>
          <span style={{ color: BASE }}>bottom bar: GLM-5.3-Flash, valid name 85.3%</span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Only the valid-name rates and the 956 contexts are Nex&apos;s numbers. The other gates are illustrative
        sliders, and the last row assumes calls fail independently with no retries, which overstates the damage
        of a bad tool name: a harness that rejects an unknown tool usually lets the model try again.
      </figcaption>
    </figure>
  )
}
