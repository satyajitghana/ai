"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Table 1 of the Jeveration paper (arXiv 2611.24738), every row as printed: params (B),
// sequential steps, output side in px, end-to-end latency on one H200 at batch 1 (ms),
// GenEval, DPG and HPSv2.1. The paper's speedup column is 9508.4 / latency, i.e. relative to
// Janus-Pro-7B. Here the baseline is yours to pick, and "pixels per second" divides each
// row's output pixels by its latency, since the rows do not make images of one size.

type Row = { name: string; unified: boolean; params: number; steps: number; res: number; ms: number; geneval: number; dpg: number; hps: number }

const ROWS: Row[] = [
  { name: "PixArt-α", unified: false, params: 0.6, steps: 20, res: 512, ms: 378.8, geneval: 0.49, dpg: 71.6, hps: 29.98 },
  { name: "PixArt-Σ", unified: false, params: 0.6, steps: 20, res: 512, ms: 419.5, geneval: 0.54, dpg: 79.5, hps: 30.49 },
  { name: "SANA-0.6B", unified: false, params: 0.6, steps: 20, res: 512, ms: 587.3, geneval: 0.65, dpg: 84.3, hps: 29.86 },
  { name: "SANA-Sprint 0.6B", unified: false, params: 0.6, steps: 1, res: 1024, ms: 121.2, geneval: 0.72, dpg: 78.63, hps: 28.74 },
  { name: "SDXL-DMD2", unified: false, params: 2.6, steps: 1, res: 1024, ms: 204.0, geneval: 0.56, dpg: 74.09, hps: 28.2 },
  { name: "SDXL-LCM", unified: false, params: 2.6, steps: 4, res: 1024, ms: 336.7, geneval: 0.53, dpg: 71.08, hps: 26.99 },
  { name: "FLUX.1-schnell", unified: false, params: 12.0, steps: 1, res: 1024, ms: 345.6, geneval: 0.69, dpg: 85.97, hps: 29.63 },
  { name: "Z-Image-Turbo", unified: false, params: 6.2, steps: 8, res: 1024, ms: 1965.2, geneval: 0.76, dpg: 84.99, hps: 29.76 },
  { name: "SD3-medium", unified: false, params: 2.0, steps: 28, res: 1024, ms: 2086.0, geneval: 0.62, dpg: 84.1, hps: 29.88 },
  { name: "JanusFlow-1.3B", unified: true, params: 1.3, steps: 30, res: 384, ms: 445.8, geneval: 0.63, dpg: 80.09, hps: 22.9 },
  { name: "Janus-Pro-1B", unified: true, params: 1.5, steps: 576, res: 384, ms: 7593.2, geneval: 0.73, dpg: 82.63, hps: 27.73 },
  { name: "Janus-Pro-7B", unified: true, params: 7.0, steps: 576, res: 384, ms: 9508.4, geneval: 0.8, dpg: 83.91, hps: 28.47 },
  { name: "Show-o Turbo-512", unified: true, params: 1.3, steps: 4, res: 512, ms: 94.1, geneval: 0.63, dpg: 83.35, hps: 27.35 },
  { name: "Show-o-512", unified: true, params: 1.3, steps: 50, res: 512, ms: 1631.0, geneval: 0.68, dpg: 67.27, hps: 27.85 },
  { name: "MMaDA-8B", unified: true, params: 8.0, steps: 15, res: 512, ms: 3860.9, geneval: 0.63, dpg: 69.97, hps: 23.74 },
  { name: "Jeveration", unified: true, params: 5.2, steps: 1, res: 512, ms: 77.8, geneval: 0.74, dpg: 78.24, hps: 28.06 },
]
const J = ROWS[ROWS.length - 1]

const BASELINES = [
  { name: "Janus-Pro-7B", why: "the paper's" },
  { name: "Show-o Turbo-512", why: "fastest unified" },
  { name: "SANA-Sprint 0.6B", why: "fastest one-step" },
  { name: "FLUX.1-schnell", why: "best-known one-step" },
]

const METRICS = [
  { id: "ms", label: "latency" },
  { id: "pps", label: "pixels / second" },
] as const
const QUALITY = [
  { id: "geneval", label: "GenEval" },
  { id: "dpg", label: "DPG" },
  { id: "hps", label: "HPSv2.1" },
] as const

type MetricId = (typeof METRICS)[number]["id"]
type QualityId = (typeof QUALITY)[number]["id"]

const mpps = (r: Row) => (r.res * r.res) / r.ms / 1000 // megapixels per second

export function SpeedupBaseline() {
  const [base, setBase] = useState("Janus-Pro-7B")
  const [metric, setMetric] = useState<MetricId>("ms")
  const [qual, setQual] = useState<QualityId>("geneval")

  const b = ROWS.find((r) => r.name === base) ?? ROWS[11]
  const val = (r: Row) => (metric === "ms" ? r.ms : mpps(r))
  // "better" ratio of Jeveration over the baseline
  const ratio = metric === "ms" ? b.ms / J.ms : mpps(J) / mpps(b)

  const sorted = [...ROWS].sort((x, y) => (metric === "ms" ? x.ms - y.ms : mpps(y) - mpps(x)))
  const lo = metric === "ms" ? mlog10(60) : mlog10(0.01)
  const hi = metric === "ms" ? mlog10(12000) : mlog10(12)
  const width = (v: number) => Math.max(1.5, ((mlog10(v) - lo) / (hi - lo)) * 100)

  const byQ = [...ROWS].sort((x, y) => y[qual] - x[qual])
  const rank = byQ.findIndex((r) => r.name === "Jeveration") + 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Table 1, with the baseline yours to pick</span>
        <span className="text-muted-foreground/60">one H200, batch 1, decode included</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Baseline">
          <span className="w-full font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:w-20">versus</span>
          {BASELINES.map((o) => (
            <button
              key={o.name}
              type="button"
              onClick={() => setBase(o.name)}
              aria-pressed={base === o.name}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                base === o.name ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.name} <span className="opacity-60">({o.why})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Measure">
          <span className="w-full font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:w-20">measure</span>
          {METRICS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMetric(o.id)}
              aria-pressed={metric === o.id}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                metric === o.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="font-mono text-sm">
          Jeveration is <strong>{ratio >= 1 ? `${ratio.toFixed(ratio >= 10 ? 0 : 2)}x better` : `${(1 / ratio).toFixed(2)}x worse`}</strong> than {b.name}{" "}
          on {metric === "ms" ? "latency" : "pixels per second"}
          {metric === "ms" ? ` (${J.ms} vs ${b.ms} ms)` : ` (${mpps(J).toFixed(2)} vs ${mpps(b).toFixed(2)} megapixels/s)`}.
        </p>

        <div className="space-y-1">
          {sorted.map((r) => (
            <div key={r.name} className="grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-2 font-mono text-[11px] sm:grid-cols-[11rem_1fr_6.5rem]">
              <span className={cn("truncate", r.name === "Jeveration" && "font-semibold", r.name === b.name && "underline")}>
                {r.name}
                <span className="text-muted-foreground"> {r.res}px</span>
              </span>
              <span className="h-3 rounded-sm bg-muted">
                <span
                  className={cn("block h-3 rounded-sm", r.name === "Jeveration" ? "bg-orange-500" : r.unified ? "bg-sky-600/70" : "bg-zinc-500/60")}
                  style={{ width: `${width(val(r)).toFixed(2)}%` }}
                />
              </span>
              <span className="text-right text-muted-foreground">{metric === "ms" ? `${r.ms} ms` : `${mpps(r).toFixed(2)} MP/s`}</span>
            </div>
          ))}
          <p className="pt-1 font-mono text-[10px] text-muted-foreground">
            log scale · <span className="text-sky-600">unified</span> · <span className="text-zinc-500">generation-only</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3" role="group" aria-label="Quality column">
          <span className="w-full font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:w-20">quality</span>
          {QUALITY.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setQual(o.id)}
              aria-pressed={qual === o.id}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                qual === o.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
          <span className="font-mono text-xs">
            Jeveration ranks <strong>{rank}</strong> of {ROWS.length} ({J[qual]}; best is {byQ[0].name}, {byQ[0][qual]})
          </span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Every number is the paper&apos;s Table 1. Some quality scores in that table come from other papers (marked there),
        and the rows make images of three sizes, which is why pixels per second is offered beside latency.
      </figcaption>
    </figure>
  )
}
