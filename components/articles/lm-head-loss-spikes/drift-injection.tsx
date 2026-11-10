"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { INJ_KEYS, INJ_META, INJ_RUNS, INJECT_AT, type InjKey } from "./deep-data"

// My toy runs, not the paper's. The head trains with SGD-M (momentum 0.99,
// lr 0.03), which never drifts on its own. From step 10,000 I add the same
// vector to every row of E, along the mean hidden direction, every step: in
// exact arithmetic that moves every logit by the same amount and changes
// nothing. "gap" is the eval loss through the run's own forward minus the
// eval loss of the same weights through an FP32 head, on a fixed batch of
// 2,048 held-out positions, logged every 100 steps.

type Metric = "gap" | "qerr"
type Axis = "step" | "mean"

const METRICS: { id: Metric; label: string; lo: number; hi: number; ticks: number[] }[] = [
  { id: "gap", label: "loss gap: native − FP32 head", lo: -4, hi: 1, ticks: [-4, -3, -2, -1, 0, 1] },
  { id: "qerr", label: "RMS(z_native − z_fp32)", lo: -5, hi: 1, ticks: [-5, -4, -3, -2, -1, 0, 1] },
]

const W = 660
const H = 240
const PL = 44
const PR = 12
const PT = 12
const PB = 26

export function DriftInjection() {
  const [metric, setMetric] = useState<Metric>("gap")
  const [axis, setAxis] = useState<Axis>("step")
  const M = METRICS.find((m) => m.id === metric) ?? METRICS[0]
  const xmax = axis === "step" ? 40000 : 800
  const xticks = axis === "step" ? [0, 10000, 20000, 30000, 40000] : [0, 200, 400, 600, 800]
  const sx = (x: number) => PL + (Math.min(x, xmax) / xmax) * (W - PL - PR)
  const sy = (v: number) => {
    const c = Math.min(M.hi, Math.max(M.lo, v))
    return PT + ((M.hi - c) / (M.hi - M.lo)) * (H - PT - PB)
  }
  const ly = (v: number) => (v > 0 ? mlog10(v) : M.lo)
  const path = (k: InjKey) => {
    const r = INJ_RUNS[k]
    let d = ""
    let started = false
    for (let i = 0; i < r.t.length; i++) {
      if (axis === "mean" && r.t[i] < INJECT_AT) continue
      const x = axis === "step" ? r.t[i] : Math.abs(r.zmean[i])
      if (x > xmax) break
      const v = r[metric][i]
      d += `${started ? "L" : "M"}${sx(x).toFixed(1)},${sy(ly(v)).toFixed(1)}`
      started = true
    }
    return d
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured: injected drift on a head that never drifts</span>
        <span className="font-mono text-[10px] text-muted-foreground">SGD-M head, one seed per run, drift starts at step 10,000</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
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
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              ["step", "x: training step"],
              ["mean", "x: |mean logit| reached"],
            ] as [Axis, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAxis(id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                axis === id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${M.label} against ${axis === "step" ? "training step" : "the mean logit reached"} for drift injected at several rates`}>
          {M.ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} className="stroke-border" strokeWidth="0.6" />
              <text x={PL - 5} y={sy(t) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                {`1e${t}`}
              </text>
            </g>
          ))}
          {xticks.map((t) => (
            <text key={t} x={sx(t)} y={H - 9} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
              {axis === "step" ? (t === 0 ? "0" : `${t / 1000}k`) : t}
            </text>
          ))}
          {axis === "step" && (
            <g>
              <line x1={sx(INJECT_AT)} x2={sx(INJECT_AT)} y1={PT} y2={H - PB} className="stroke-foreground/40" strokeDasharray="3 3" strokeWidth="0.8" />
              <text x={sx(INJECT_AT) + 4} y={PT + 9} className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                drift on
              </text>
            </g>
          )}
          {INJ_KEYS.map((k) => (
            <path key={k} d={path(k)} fill="none" stroke={INJ_META[k].color} strokeWidth={INJ_META[k].prec === "bf16" ? 1.8 : 2.4} strokeDasharray={INJ_META[k].prec === "fp32" ? "5 3" : undefined} />
          ))}
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[9px] text-muted-foreground">
          {INJ_KEYS.map((k) => (
            <span key={k} style={{ color: INJ_META[k].color }}>
              — {INJ_META[k].label}
            </span>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">run</th>
                <th className="py-1 pr-2 text-right font-normal">gap &gt; 0.01 at step</th>
                <th className="py-1 pr-2 text-right font-normal">|mean| there</th>
                <th className="py-1 pr-2 text-right font-normal">gap &gt; 0.05 at step</th>
                <th className="py-1 pr-2 text-right font-normal">|mean| there</th>
                <th className="py-1 text-right font-normal">final loss</th>
              </tr>
            </thead>
            <tbody>
              {INJ_KEYS.map((k) => {
                const s = INJ_META[k]
                return (
                  <tr key={k} className="border-t border-border/60">
                    <td className="py-1 pr-2" style={{ color: s.color }}>
                      {s.label}
                    </td>
                    <td className="py-1 pr-2 text-right">{s.g1t}</td>
                    <td className="py-1 pr-2 text-right">{s.g1m}</td>
                    <td className="py-1 pr-2 text-right">{s.g5t}</td>
                    <td className="py-1 pr-2 text-right">{s.g5m}</td>
                    <td className="py-1 text-right">{s.final}</td>
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
