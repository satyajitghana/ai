"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

import { TOY, type ToyRow } from "./toy-data"

// The flow-matching loss split, measured on a 2-D toy rather than argued.
//
// Every number comes from toy-data.ts, which my own script produced with exact
// Gaussian-mixture posteriors (no network is trained). For each source design
// the widget shows:
//   - the intrinsic variance E[tr Var(Delta | x_t)] (conditioned on C as well when
//     the velocity field sees the condition),
//   - the decomposition check: L_FM of a deliberately bent field, measured directly,
//     against approx error + intrinsic variance,
//   - the mean path length, and the N-step Euler error on the exact field.
// Values are static, so server and client render the same strings.

const SOURCES: { key: ToyRow["source"]; label: string; note: string }[] = [
  { key: "fixed", label: "Fixed N(0, I)", note: "one Gaussian for every condition" },
  { key: "mean", label: "Learned mean, σ = 1", note: "what VarReg keeps the spread at" },
  { key: "mean_narrow", label: "Learned mean, σ = 0.3", note: "a narrower source" },
  { key: "collapsed", label: "Collapsed, σ = 0.05", note: "what happens without VarReg" },
]
const STEPS = ["1", "2", "3", "5", "10", "50"]

export function VarianceSplit() {
  const [cond, setCond] = useState(true)
  const [target, setTarget] = useState<"uni" | "bi">("uni")
  const [step, setStep] = useState("2")

  const rows = SOURCES.map((s) => ({ s, r: TOY.find((t) => t.cond === cond && t.target === target && t.source === s.key)! }))
  const maxIv = Math.max(...TOY.filter((t) => t.target === target).map((t) => t.iv))
  const maxErr = Math.max(...rows.map(({ r }) => r.euler[step]))

  return (
    <div className="my-8 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-3 text-sm font-medium">Intrinsic variance on a 2-D toy, by source design</div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Toggle on={cond} onClick={() => setCond(true)}>field sees the condition</Toggle>
        <Toggle on={!cond} onClick={() => setCond(false)}>field ignores it</Toggle>
        <span className="mx-1 w-px self-stretch bg-border" />
        <Toggle on={target === "uni"} onClick={() => setTarget("uni")}>one mode per condition</Toggle>
        <Toggle on={target === "bi"} onClick={() => setTarget("bi")}>two modes per condition</Toggle>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map(({ s, r }) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span>
                <span className="font-medium">{s.label}</span>
                <span className="ml-2 text-muted-foreground">{s.note}</span>
              </span>
              <span className="font-mono tabular-nums">{r.iv.toFixed(3)}</span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded bg-muted/50">
              <div
                className={cn("h-full rounded-r", s.key === "fixed" ? "bg-slate-400/70" : "bg-violet-500/60")}
                style={{ width: `${((r.iv / maxIv) * 100).toFixed(2)}%` }}
              />
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground tabular-nums">
              <span>L(v) {r.lossV.toFixed(3)}</span>
              <span>approx + IV {(r.approx + r.iv).toFixed(3)}</span>
              <span>path {r.path.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Euler steps</span>
          {STEPS.map((k) => (
            <Toggle key={k} on={step === k} onClick={() => setStep(k)}>
              {k}
            </Toggle>
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          {rows.map(({ s, r }) => (
            <div key={s.key} className="flex items-center gap-3 text-xs">
              <span className="w-40 shrink-0 truncate">{s.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded bg-muted/50">
                <div className="h-full rounded-r bg-sky-500/60" style={{ width: `${((r.euler[step] / maxErr) * 100).toFixed(2)}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right font-mono tabular-nums">{r.euler[step].toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Top: the intrinsic-variance term, with the decomposition check under each bar. L(v) is the flow-matching
        loss of a deliberately bent field, measured on 200,000 pairs; it matches approximation error plus
        intrinsic variance to within Monte Carlo noise. Bottom: distance of an N-step Euler endpoint from the
        256-step endpoint, on the exact field. Six conditions on a ring of radius 2; my script, not the paper&apos;s.
      </p>
    </div>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-full border px-3 py-1", on ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground")}
    >
      {children}
    </button>
  )
}
