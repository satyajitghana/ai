"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { RUN_META, RUNS, STEPS, type RunKey } from "./runs-data"

// My toy runs, not the paper's: a frozen trunk (2,048-token vocabulary, 64-wide
// RMS-normalised hidden states that share a mean direction), only the LM head
// trains, 40,000 steps of batch 128, constant learning rate after a 200-step
// warmup, gradient clipping at 1. BF16 is simulated in NumPy by rounding fp32
// bits; "mixed" rounds the GEMM's inputs and its output logits, "true" also
// stores the head and its optimizer state in BF16. Every curve is a logged
// value on a fixed held-out batch of 2,048 positions, every 500 steps.

type Metric = "loss" | "zmean" | "qerr" | "kl"

const METRICS: { id: Metric; label: string; log: boolean; lo: number; hi: number; ticks: number[] }[] = [
  { id: "loss", label: "eval loss (native forward)", log: false, lo: 4.6, hi: 6.2, ticks: [4.8, 5.2, 5.6, 6.0] },
  { id: "zmean", label: "|mean logit|", log: false, lo: 0, hi: 1100, ticks: [0, 250, 500, 750, 1000] },
  { id: "qerr", label: "RMS(z_bf16 − z_fp32), log10", log: true, lo: -4, hi: 1, ticks: [-4, -3, -2, -1, 0, 1] },
  { id: "kl", label: "KL(p_fp32 ‖ p_bf16), log10", log: true, lo: -8, hi: 1, ticks: [-8, -6, -4, -2, 0] },
]

const GROUPS: { id: string; label: string; keys: RunKey[] }[] = [
  { id: "prec", label: "precision, Adam", keys: ["adam_fp32", "adam_mixed", "adam_true"] },
  { id: "fix", label: "fixes, BF16 mixed", keys: ["adam_mixed", "sgd_mixed", "mu_mixed", "z_mixed", "z3_mixed"] },
  { id: "true", label: "BF16 true", keys: ["adam_true", "sgd_true"] },
  { id: "lr", label: "learning rate", keys: ["adam_mixed", "adam_mixed_lr003"] },
]

const W = 660
const H = 230
const PL = 44
const PR = 12
const PT = 12
const PB = 24

function val(v: number, m: (typeof METRICS)[number]): number {
  const x = m.id === "zmean" ? Math.abs(v) : v
  if (!m.log) return x
  return x > 0 ? mlog10(x) : m.lo
}

export function TimeBombRuns() {
  const [metric, setMetric] = useState<Metric>("loss")
  const [group, setGroup] = useState("prec")
  const M = METRICS.find((x) => x.id === metric) ?? METRICS[0]
  const G = GROUPS.find((g) => g.id === group) ?? GROUPS[0]
  const sx = (t: number) => PL + (t / STEPS) * (W - PL - PR)
  const sy = (v: number) => {
    const c = Math.min(M.hi, Math.max(M.lo, v))
    return PT + ((M.hi - c) / (M.hi - M.lo)) * (H - PT - PB)
  }
  const path = (k: RunKey) => {
    const r = RUNS[k]
    let d = ""
    for (let i = 0; i < r.t.length; i++) {
      const v = r[metric][i]
      if (!Number.isFinite(v)) break
      d += `${i === 0 ? "M" : "L"}${sx(r.t[i]).toFixed(1)},${sy(val(v, M)).toFixed(1)}`
    }
    return d
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured: toy LM head, NumPy on CPU, simulated BF16</span>
        <span className="font-mono text-[10px] text-muted-foreground">one seed per run, 40,000 steps</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                group === g.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === m.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${M.label} over ${STEPS} steps for ${G.keys.map((k) => RUN_META[k].label).join(", ")}`}>
          {M.ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} className="stroke-border" strokeWidth="0.6" />
              <text x={PL - 5} y={sy(t) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                {M.log ? `1e${t}` : t}
              </text>
            </g>
          ))}
          {[0, 10000, 20000, 30000, 40000].map((t) => (
            <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
              {t === 0 ? "0" : `${t / 1000}k`}
            </text>
          ))}
          {G.keys.map((k) => (
            <path key={k} d={path(k)} fill="none" stroke={RUN_META[k].color} strokeWidth={k.startsWith("adam") ? 1.6 : 2.2} />
          ))}
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[9px] text-muted-foreground">
          {G.keys.map((k) => (
            <span key={k} style={{ color: RUN_META[k].color }}>
              — {RUN_META[k].label}
            </span>
          ))}
          <span>x: step</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[460px] font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">run</th>
                <th className="py-1 pr-2 text-right font-normal">best loss</th>
                <th className="py-1 pr-2 text-right font-normal">final loss</th>
                <th className="py-1 pr-2 text-right font-normal">final |mean logit|</th>
                <th className="py-1 text-right font-normal">final RMS err</th>
              </tr>
            </thead>
            <tbody>
              {G.keys.map((k) => {
                const s = RUN_META[k]
                return (
                  <tr key={k} className="border-t border-border/60">
                    <td className="py-1 pr-2" style={{ color: s.color }}>
                      {s.label}
                    </td>
                    <td className="py-1 pr-2 text-right">{s.best}</td>
                    <td className="py-1 pr-2 text-right">{s.final}</td>
                    <td className="py-1 pr-2 text-right">{s.zmean}</td>
                    <td className="py-1 text-right">{s.qerr}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  )
}
