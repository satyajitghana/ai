"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { LRS, RUNS, SEEDS, type Run } from "./runs-data"

// My grokking runs, not the paper's: a+b mod 31, a 1-layer width-64 ReLU
// Transformer, full-batch AdamW (lr 1e-3 as in the paper, or 3e-3; betas
// 0.9/0.98, weight decay 1, eps 1e-8), fp32, on a shared 4-core CPU. The same seed, data split and
// initialisation run once with torch.nn.functional.cross_entropy and once
// with the fixed cross-entropy; the curves are the logged values, every 50
// epochs. A slingshot is marked where the mean training margin falls more
// than 3 below its maximum over the previous 100 epochs.

type Metric = "margin" | "lgloss" | "te"

const STD = "oklch(0.66 0.17 40)"
const FIX = "oklch(0.60 0.15 255)"

const METRICS: { id: Metric; label: string; lo: number; hi: number; ticks: number[]; tick: (v: number) => string }[] = [
  { id: "margin", label: "mean train margin m", lo: -4, hi: 20, ticks: [0, 5, 10, 15, 20], tick: (v) => String(v) },
  { id: "lgloss", label: "train loss (fp64, log10)", lo: -8, hi: 1, ticks: [0, -2, -4, -6, -8], tick: (v) => `1e${v}` },
  { id: "te", label: "test accuracy %", lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100], tick: (v) => `${v}` },
]

const W = 660
const H = 220
const PL = 40
const PR = 12
const PT = 14
const PB = 24
const EMAX = 10000

function line(r: Run, k: Metric, lo: number, hi: number): string {
  const ys = r[k]
  let d = ""
  for (let i = 0; i < r.ep.length; i++) {
    const x = PL + (r.ep[i] / EMAX) * (W - PL - PR)
    const v = Math.min(hi, Math.max(lo, ys[i]))
    const y = PT + ((hi - v) / (hi - lo)) * (H - PT - PB)
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
  }
  return d
}

export function SlingshotRuns() {
  const [seed, setSeed] = useState<number>(SEEDS[0])
  const [lr, setLr] = useState<string>(LRS[0])
  const [metric, setMetric] = useState<Metric>("margin")
  const M = METRICS.find((x) => x.id === metric) ?? METRICS[0]
  const std = RUNS[`${lr}_std_${seed}`]
  const fix = RUNS[`${lr}_fix_${seed}`]
  const sy = (v: number) => PT + ((M.hi - v) / (M.hi - M.lo)) * (H - PT - PB)
  const sx = (e: number) => PL + (e / EMAX) * (W - PL - PR)
  const lastStd = std.te[std.te.length - 1]
  const lastFix = fix.te[fix.te.length - 1]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured: a+b mod 31, fp32, CPU, lr {lr}, seed {seed}</span>
        <span className="font-mono text-[10px] text-muted-foreground">same init, same split, only the loss differs</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setMetric(x.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === x.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
          <span className="mx-1 self-center font-mono text-[10px] text-muted-foreground">lr</span>
          {LRS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLr(l)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                lr === l ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
          <span className="mx-1 self-center font-mono text-[10px] text-muted-foreground">seed</span>
          {SEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeed(s)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                seed === s ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${M.label} over 10,000 epochs at learning rate ${lr}, seed ${seed}: standard cross-entropy has ${std.spikes.length} slingshots, fixed cross-entropy has ${fix.spikes.length}`}>
          {M.ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} className="stroke-border" strokeWidth="0.6" />
              <text x={PL - 5} y={sy(t) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                {M.tick(t)}
              </text>
            </g>
          ))}
          {[0, 2500, 5000, 7500, 10000].map((t) => (
            <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
              {t === 0 ? "0" : `${t / 1000}k`}
            </text>
          ))}
          {metric === "margin" && (
            <g>
              <line x1={PL} x2={W - PR} y1={sy(16.64)} y2={sy(16.64)} stroke={STD} strokeDasharray="3 3" strokeWidth="0.8" />
              <text x={PL + 4} y={sy(16.64) + 11} fill={STD} style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                fp32 cliff 16.64
              </text>
              <line x1={PL} x2={W - PR} y1={sy(18.42)} y2={sy(18.42)} className="stroke-muted-foreground" strokeDasharray="1 3" strokeWidth="0.8" />
              <text x={PL + 4} y={sy(18.42) - 3} className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                log(1/ε) 18.42
              </text>
            </g>
          )}
          {std.spikes.map((e) => (
            <path key={e} d={`M${sx(e).toFixed(1)},${PT - 2}l-4,-7h8z`} fill={STD} />
          ))}
          <path d={line(fix, metric, M.lo, M.hi)} fill="none" stroke={FIX} strokeWidth="2.2" />
          <path d={line(std, metric, M.lo, M.hi)} fill="none" stroke={STD} strokeWidth="1.5" />
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[9px] text-muted-foreground">
          <span style={{ color: STD }}>— F.cross_entropy (standard)</span>
          <span style={{ color: FIX }}>— fixed cross-entropy</span>
          <span style={{ color: STD }}>▼ slingshot</span>
          <span>x: epoch</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">slingshots</div>
            <div className="font-mono text-sm tabular-nums">
              <span style={{ color: STD }}>{std.spikes.length}</span> vs <span style={{ color: FIX }}>{fix.spikes.length}</span>
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">standard vs fixed</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">test accuracy at 10k</div>
            <div className="font-mono text-sm tabular-nums">
              <span style={{ color: STD }}>{lastStd.toFixed(1)}%</span> vs <span style={{ color: FIX }}>{lastFix.toFixed(1)}%</span>
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">standard vs fixed</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">margin at 10k</div>
            <div className="font-mono text-sm tabular-nums">
              <span style={{ color: STD }}>{std.margin[std.margin.length - 1].toFixed(2)}</span> vs{" "}
              <span style={{ color: FIX }}>{fix.margin[fix.margin.length - 1].toFixed(2)}</span>
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">mean over the 480 training pairs</div>
          </div>
        </div>
      </div>
    </figure>
  )
}
