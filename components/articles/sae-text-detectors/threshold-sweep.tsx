"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { DENSE, DOMAINS, SWEEP } from "./data"

// The paper's interpretability threshold, rebuilt with a crude score. tau keeps only
// features whose top token holds at least tau of the feature's activation mass; the
// probe is re-fit on the kept features each time. AUC is threshold-free; the false
// alarm rate is the share of HUMAN documents flagged at the threshold that gives 5%
// false alarms on held-out documents from the training domains.

const ACCENT = "oklch(0.62 0.16 35)"
const WARN = "oklch(0.60 0.15 255)"
const pct = (x: number) => `${(x * 100).toFixed(0)}%`

function Bar({ v, color, label }: { v: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative h-3 flex-1 rounded bg-muted/25">
        <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${v * 100}%`, background: color }} />
      </span>
      <span className="w-20 text-right">{label}</span>
    </div>
  )
}

export function ThresholdSweep() {
  const [k, setK] = useState(3)
  const row = SWEEP[k]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">interpretability threshold sweep · toy detector · measured</span>
        <span className="font-mono text-xs">tau {row.tau.toFixed(1)}</span>
      </div>
      <div className="p-3 sm:p-4">
        <label className="flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">tau</span>
          <Range min={0} max={SWEEP.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Interpretability threshold" accent={ACCENT} />
        </label>
        <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          {[
            ["features kept of 1,024", String(row.kept)],
            ["non-zero weights", String(row.nonzero)],
            ["AUC, training domains", row.valAuc.toFixed(3)],
          ].map(([a, b]) => (
            <div key={a} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{a}</dt>
              <dd className="mt-0.5 text-sm">{b}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-4 font-mono text-[11px]">
          {DOMAINS.map((d) => {
            const c = row.test[d.id]
            const dn = DENSE.test[d.id]
            return (
              <div key={d.id}>
                <div className="mb-1 text-muted-foreground">{d.label}</div>
                <Bar v={c.auc} color={ACCENT} label={`AUC ${c.auc.toFixed(2)}`} />
                <Bar v={c.fpr} color={WARN} label={`humans flagged ${pct(c.fpr)}`} />
                <div className="mt-0.5 text-[10px] text-muted-foreground">dense probe on the raw activations: AUC {dn.auc.toFixed(2)}, humans flagged {pct(dn.fpr)}</div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Held-out domains only. The score used for the mask is the share of a feature&apos;s activation on one token, a stand-in for the paper&apos;s
          model-written description and simulation score, so the curve is the shape of the idea and not a replication of its Figure 4.
        </p>
      </div>
    </figure>
  )
}
