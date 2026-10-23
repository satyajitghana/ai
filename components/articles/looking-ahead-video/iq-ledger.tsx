"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Physics-IQ Verified scores from the Looking Ahead paper (arXiv 2610.29989v1), copied
// cell by cell. Every row is the mean of four seeds (42-45) over the benchmark's 198
// samples; the paper reports no spread across seeds.
//
// - "1.3B components": Table 6 (the full form of Table 4), Wan2.1-1.3B, 20,000 steps on
//   8 GPUs, offsets {1,2,3}.
// - "1.3B fusion": Table 7, how the fused source features enter the predictor.
// - "5B image" / "5B video": Table 2, Wan2.2-TI2V-5B, 25,000 steps on 32 GPUs, image-to-video
//   and video-to-video. Table 2 has no MSE column.
//
// The first row of each set is the matched teacher-forcing baseline; deltas are against it.

type Metric = "IQ" | "SP" | "ST" | "WS" | "MSE"
type Row = { label: string; note?: string; v: Partial<Record<Metric, number>>; ours?: boolean }
type Set = { id: string; name: string; caption: string; rows: Row[] }

const SETS: Set[] = [
  {
    id: "c13",
    name: "1.3B components",
    caption: "Wan2.1-1.3B, paper Table 6. Which representations get the future loss, whether the predictor sees text, and parallel vs chained.",
    rows: [
      { label: "Teacher forcing", v: { IQ: 27.6, SP: 32.8, ST: 25.5, WS: 20.4, MSE: 31.6 } },
      { label: "+ clean source", v: { IQ: 28.8, SP: 33.0, ST: 29.5, WS: 21.0, MSE: 31.9 } },
      { label: "+ noisy source", v: { IQ: 29.9, SP: 34.7, ST: 28.2, WS: 21.6, MSE: 35.0 } },
      { label: "+ clean + noisy", note: "default", ours: true, v: { IQ: 30.9, SP: 36.2, ST: 29.6, WS: 23.2, MSE: 34.5 } },
      { label: "… + text to predictor", v: { IQ: 29.8, SP: 34.8, ST: 28.4, WS: 22.0, MSE: 34.2 } },
      { label: "… chained", v: { IQ: 30.1, SP: 34.3, ST: 29.8, WS: 21.7, MSE: 34.4 } },
    ],
  },
  {
    id: "f13",
    name: "1.3B fusion",
    caption: "Wan2.1-1.3B, paper Table 7. Teacher forcing (27.6 IQ, Table 6) shown for reference.",
    rows: [
      { label: "Teacher forcing", v: { IQ: 27.6, SP: 32.8, ST: 25.5, WS: 20.4, MSE: 31.6 } },
      { label: "Token concat", note: "joint attention", v: { IQ: 28.8, SP: 34.1, ST: 28.1, WS: 21.0, MSE: 32.0 } },
      { label: "Dim concat", note: "linear fusion", v: { IQ: 29.5, SP: 32.2, ST: 31.2, WS: 20.6, MSE: 34.1 } },
      { label: "Token-wise AdaLN", note: "default", ours: true, v: { IQ: 30.9, SP: 36.2, ST: 29.6, WS: 23.2, MSE: 34.5 } },
    ],
  },
  {
    id: "i5",
    name: "5B image→video",
    caption: "Wan2.2-TI2V-5B, paper Table 2, I2V columns.",
    rows: [
      { label: "Teacher forcing", v: { IQ: 30.4, SP: 34.8, ST: 32.8, WS: 24.0 } },
      { label: "3 offsets", v: { IQ: 32.1, SP: 33.6, ST: 39.3, WS: 23.2 } },
      { label: "3 offsets, chained", v: { IQ: 30.7, SP: 34.6, ST: 33.0, WS: 23.3 } },
      { label: "5 offsets", note: "default", ours: true, v: { IQ: 33.8, SP: 36.8, ST: 41.1, WS: 25.2 } },
      { label: "5 offsets, chained", v: { IQ: 31.0, SP: 35.6, ST: 33.0, WS: 23.9 } },
      { label: "offsets 1, 3, 5", v: { IQ: 33.1, SP: 36.9, ST: 38.5, WS: 25.5 } },
    ],
  },
  {
    id: "v5",
    name: "5B video→video",
    caption: "Wan2.2-TI2V-5B, paper Table 2, V2V columns (conditioned on up to three seconds of real video).",
    rows: [
      { label: "Teacher forcing", v: { IQ: 40.6, SP: 48.5, ST: 40.8, WS: 37.8 } },
      { label: "3 offsets", v: { IQ: 43.0, SP: 50.3, ST: 44.6, WS: 39.8 } },
      { label: "3 offsets, chained", v: { IQ: 40.5, SP: 48.5, ST: 39.3, WS: 37.9 } },
      { label: "5 offsets", note: "default", ours: true, v: { IQ: 44.4, SP: 51.1, ST: 47.2, WS: 40.7 } },
      { label: "5 offsets, chained", v: { IQ: 39.9, SP: 47.6, ST: 38.9, WS: 36.6 } },
      { label: "offsets 1, 3, 5", v: { IQ: 43.5, SP: 51.8, ST: 43.8, WS: 40.6 } },
    ],
  },
]

const METRICS: Metric[] = ["IQ", "SP", "ST", "WS", "MSE"]
const C_BASE = "oklch(0.62 0.03 260)"
const C_OURS = "oklch(0.6 0.15 150)"
const C_OTHER = "oklch(0.62 0.1 250)"
const C_DOWN = "oklch(0.6 0.18 25)"

export function IqLedger() {
  const [setId, setSetId] = useState("c13")
  const [metricRaw, setMetric] = useState<Metric>("IQ")
  const set = SETS.find((s) => s.id === setId) ?? SETS[0]
  const hasMetric = set.rows.every((r) => r.v[metricRaw] !== undefined)
  const metric: Metric = hasMetric ? metricRaw : "IQ"
  const vals = set.rows.map((r) => r.v[metric] ?? 0)
  const base = vals[0]
  const lo = Math.floor(Math.min(...vals) - 3)
  const hi = Math.ceil(Math.max(...vals) + 1)
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {SETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSetId(s.id)}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs transition-colors",
              s.id === setId ? "bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        <span className="mr-1 font-mono text-xs text-muted-foreground">metric</span>
        {METRICS.map((m) => {
          const ok = set.rows.every((r) => r.v[m] !== undefined)
          return (
            <button
              key={m}
              type="button"
              disabled={!ok}
              onClick={() => setMetric(m)}
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-xs",
                m === metric ? "bg-foreground text-background" : "hover:bg-muted",
                !ok && "cursor-not-allowed opacity-30",
              )}
            >
              {m}
            </button>
          )
        })}
      </div>

      <div className="space-y-1.5 px-4 py-3">
        {set.rows.map((r, i) => {
          const v = r.v[metric] ?? 0
          const d = v - base
          const color = i === 0 ? C_BASE : r.ours ? C_OURS : d < 0 ? C_DOWN : C_OTHER
          return (
            <div key={r.label} className="grid grid-cols-[minmax(0,9.5rem)_1fr_4.5rem] items-center gap-2 text-xs">
              <span className={cn("truncate", r.ours && "font-semibold")}>
                {r.label}
                {r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}
              </span>
              <div className="relative h-5 rounded bg-muted/40">
                <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${pct(v)}%`, background: color, opacity: 0.85 }} />
                <div className="absolute inset-y-[-3px] w-px bg-foreground/60" style={{ left: `${pct(base)}%` }} />
              </div>
              <span className="text-right font-mono tabular-nums">
                {v.toFixed(1)}
                {i > 0 ? (
                  <span className={cn("ml-1", d < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                    {d >= 0 ? "+" : "−"}
                    {Math.abs(d).toFixed(1)}
                  </span>
                ) : null}
              </span>
            </div>
          )
        })}
        <div className="pt-1 font-mono text-[11px] text-muted-foreground">
          axis {lo} to {hi} · vertical tick = teacher forcing · higher is better
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        {set.caption} Reported: mean of four seeds over 198 benchmark samples; no seed spread is published.
      </figcaption>
    </figure>
  )
}
