"use client"

import { useState } from "react"

import { DATA } from "@/components/articles/delta-matching/data"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Our tiny training runs (public/articles/delta-matching/code/toy_train.py): a 2-layer, 128-wide character model with QK-RMSNorm
// gains, trained with exact attention (ref) or with simulated-FP8 attention using each delta. Everything is read from data.ts,
// the mean over seeds of what the script logged. Not the paper's setting: a toy, a few minutes of CPU.

type Mode = "ref" | "stale" | "consistent" | "matched"
type Run = {
  seeds: number
  steps: readonly number[]
  loss: readonly number[]
  val: readonly number[]
  gainStep: readonly number[]
  maxGainProd: readonly (readonly number[])[]
  topShare: readonly (readonly number[])[]
  resid: readonly (readonly number[])[]
}
const TRAIN = (DATA as unknown as { train?: Partial<Record<Mode, Run>> }).train ?? {}

const SERIES: { k: Mode; label: string; color: string }[] = [
  { k: "ref", label: "exact attention", color: "oklch(0.55 0.02 250)" },
  { k: "stale", label: "FP8, stale delta", color: "oklch(0.62 0.19 30)" },
  { k: "consistent", label: "FP8, consistent dO", color: "oklch(0.68 0.14 85)" },
  { k: "matched", label: "FP8, matched delta", color: "oklch(0.58 0.15 160)" },
]

const VIEWS = [
  { k: "loss", label: "training loss" },
  { k: "gain", label: "QK gain concentration" },
  { k: "resid", label: "row-sum residual during training" },
]

function smooth(xs: readonly number[]): number[] {
  return xs.map((_, i) => {
    const a = Math.max(0, i - 2)
    const b = Math.min(xs.length - 1, i + 2)
    let s = 0
    for (let j = a; j <= b; j++) s += xs[j]
    return s / (b - a + 1)
  })
}

const W = 520
const H = 200
const PAD = { l: 38, r: 10, t: 8, b: 22 }

function Lines({ series, xs, ylo, yhi, fmtY }: { series: { k: string; color: string; ys: number[] }[]; xs: readonly number[]; ylo: number; yhi: number; fmtY: (v: number) => string }) {
  const x0 = xs[0]
  const x1 = xs[xs.length - 1]
  const px = (x: number) => PAD.l + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r)
  const py = (y: number) => PAD.t + (1 - (Math.min(yhi, Math.max(ylo, y)) - ylo) / (yhi - ylo)) * (H - PAD.t - PAD.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ylo + f * (yhi - ylo))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart of the logged quantity against optimizer step for each attention variant">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} className="stroke-border" strokeWidth={0.5} />
          <text x={PAD.l - 4} y={py(t) + 3} textAnchor="end" fontSize={8} className="fill-muted-foreground">
            {fmtY(t)}
          </text>
        </g>
      ))}
      {[0, 0.5, 1].map((f) => (
        <text key={f} x={px(x0 + f * (x1 - x0))} y={H - 6} textAnchor="middle" fontSize={8} className="fill-muted-foreground">
          {Math.round(x0 + f * (x1 - x0))}
        </text>
      ))}
      {series.map((s) => (
        <polyline key={s.k} fill="none" stroke={s.color} strokeWidth={1.6} points={s.ys.map((y, i) => `${px(xs[i]).toFixed(1)},${py(y).toFixed(1)}`).join(" ")} />
      ))}
    </svg>
  )
}

export function TrainToy() {
  const [view, setView] = useState("loss")
  const have = SERIES.filter((s) => TRAIN[s.k])
  if (have.length === 0) return null
  const first = TRAIN[have[0].k] as Run

  let chart: React.ReactNode = null
  if (view === "loss") {
    const ser = have.map((s) => ({ k: s.k, color: s.color, ys: smooth((TRAIN[s.k] as Run).loss) }))
    chart = <Lines series={ser} xs={first.steps.slice(0, ser[0].ys.length)} ylo={2.4} yhi={3.4} fmtY={(v) => v.toFixed(2)} />
  } else if (view === "gain") {
    const ser = have.map((s) => ({ k: s.k, color: s.color, ys: [...(TRAIN[s.k] as Run).topShare[1]] }))
    chart = <Lines series={ser} xs={first.gainStep.slice(0, ser[0].ys.length)} ylo={0} yhi={Math.max(0.2, ...ser.flatMap((s) => s.ys)) * 1.1} fmtY={(v) => `${(v * 100).toFixed(0)}%`} />
  } else {
    const fp = have.filter((s) => s.k !== "ref" && (TRAIN[s.k] as Run).resid.length > 0)
    const ser = fp.map((s) => ({ k: s.k, color: s.color, ys: (TRAIN[s.k] as Run).resid.map((r) => mlog10(Math.max(r[0], 1e-12))) }))
    chart = ser.length ? <Lines series={ser} xs={first.gainStep.slice(0, ser[0].ys.length)} ylo={-9} yhi={-1.5} fmtY={(v) => `1e${v.toFixed(0)}`} /> : null
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">tiny character model, 800 steps · mean of {first.seeds} seeds · our simulation of FP8 attention</span>
        <span className="font-mono text-[10px] text-muted-foreground">a toy, not the paper&apos;s setting</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.k}
              type="button"
              onClick={() => setView(v.k)}
              aria-pressed={view === v.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === v.k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {chart}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]">
          {have.map((s) => {
            const r = TRAIN[s.k] as Run
            const mean = r.val.reduce((a, b) => a + b, 0) / r.val.length
            return (
              <li key={s.k} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />
                {s.label}: validation CE <span className="tabular-nums text-foreground">{mean.toFixed(3)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </figure>
  )
}
