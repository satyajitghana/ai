"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Pure arithmetic on the paper's two filters, labelled reasoned. The paper
// discards a sample when the student reproduces the candidate answer on all G
// rollouts (Section 3.4); it keeps a sample only if pseudo-verification passed.
// Assuming the G rollouts are independent draws that each hit the candidate
// with probability p, P(discard) = p^G. Real rollouts of one model on one
// question are correlated, so this is a lower bound on how often a sample
// survives. The paper's main text I read does not state G.

const ACCENT = "oklch(0.62 0.16 35)"
const W = 640
const H = 230
const PX = 46
const PY = 14
const PW = W - PX - 16
const PH = H - PY - 36

const sx = (p: number) => PX + p * PW
const sy = (v: number) => PY + PH - v * PH

export function ConsensusGate() {
  const [g, setG] = useState(8)
  const [p, setP] = useState(0.9)
  const [v, setV] = useState(0.6)

  const keep = (pp: number) => v * (1 - mpow(pp, g))
  const path = Array.from({ length: 101 }, (_, i) => i / 100)
    .map((pp, i) => `${i ? "L" : "M"}${sx(pp).toFixed(1)} ${sy(keep(pp)).toFixed(1)}`)
    .join(" ")
  const pDiscard = mpow(p, g)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">consensus gate · independent-rollout arithmetic · reasoned</span>
        <span className="font-mono text-xs">G = {g}</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Probability that a generated sample survives both filters, against how often the student already
            reproduces its candidate answer. The curve is flat at the verification pass rate for hard questions and
            falls to zero as the student approaches certainty; more rollouts per sample move the cliff toward 1.
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={PX} x2={PX + PW} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PX - 6} y={sy(t) + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {(t * 100).toFixed(0)}%
              </text>
              <text x={sx(t)} y={H - 18} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          <text x={PX + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            p = chance one student rollout reproduces the candidate answer
          </text>
          <text x={12} y={PY + PH / 2} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55} transform={`rotate(-90 12 ${PY + PH / 2})`} textAnchor="middle">
            P(sample kept)
          </text>
          <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} />
          <line x1={sx(p)} x2={sx(p)} y1={PY} y2={PY + PH} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 3" />
          <circle cx={sx(p)} cy={sy(keep(p))} r={5} fill={ACCENT} stroke="var(--background)" strokeWidth={1.5} />
        </svg>

        <div className="mt-1 grid gap-2 font-mono text-xs sm:grid-cols-3">
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-muted-foreground">rollouts G</span>
            <Range min={1} max={16} step={1} value={g} onChange={(e) => setG(Number(e.target.value))} aria-label="Rollouts G" accent={ACCENT} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-muted-foreground">student p</span>
            <Range min={0} max={1} step={0.01} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Student reproduces candidate" accent={ACCENT} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-muted-foreground">verify pass</span>
            <Range min={0.1} max={1} step={0.05} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Pseudo-verification pass rate" accent={ACCENT} />
          </label>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          {[
            ["gate discards it", `${(pDiscard * 100).toFixed(1)}%`],
            ["verification passes", `${(v * 100).toFixed(0)}%`],
            ["sample is kept", `${(keep(p) * 100).toFixed(1)}%`],
          ].map(([k, val]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{val}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Assumes the G rollouts are independent, so P(discard) = p<sup>G</sup>. Real rollouts of one model on one
          question are correlated, which makes the true gate discard more of the confident questions than this does.
          The pass rate is a free knob; the paper does not report one.
        </p>
      </div>
    </figure>
  )
}
