"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// A compute ledger for Beam, using only numbers Reflection published and the
// numbers other articles on this site already report:
//   pretraining FLOPs  C ≈ 6 · N_active · D  (reasoned, per model)
//   GPU-hours          GPUs × days × 24      (reasoned, from reported counts)
// and, for Beam, the sustained per-GPU throughput the two together imply.
// The 2,250 TFLOP/s reference is the B300 dense BF16 peak Ai2 normalises MFU
// to (see the Olmo-core 3 article); Reflection has not said what precision
// it trained in, so the "share of peak" readout is a BF16-referenced estimate.

type Row = { label: string; value: number; note: string; hl?: boolean }

const FLOP_ROWS: Row[] = [
  { label: "Kolibri-1", value: 6 * 3.46e9 * 20e12, note: "3.46B active x 20T tokens", hl: false },
  { label: "Beam", value: 6 * 23e9 * 23.8e12, note: "23B active x 23.8T tokens", hl: true },
  { label: "GLM-5.2", value: 6 * 40e9 * 28.5e12, note: "40B active x 28.5T tokens", hl: false },
  { label: "Inkling", value: 6 * 41e9 * 45e12, note: "41B active x 45T tokens", hl: false },
]

const HOUR_ROWS: Row[] = [
  { label: "Kolibri-1, all training", value: 392_000, note: "reported on its card" },
  { label: "Beam pretraining", value: 6144 * 28 * 24, note: "6,144 GB300 x under 4 weeks (upper bound)", hl: true },
  { label: "Beam RL", value: 10500 * 28 * 24, note: "10,500 GB300 x 4 weeks", hl: true },
]

const PEAK_TFLOPS = 2250
const BEAM_FLOPS = 6 * 23e9 * 23.8e12

// toExponential is exact per spec, so server and client print the same string.
const sci = (v: number) => v.toExponential(2).replace("e+", "e")
const mil = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1000)}k`)

export function ComputeLedger() {
  const [mode, setMode] = useState<"flops" | "hours">("flops")
  const [days, setDays] = useState(28)

  const rows = mode === "flops" ? FLOP_ROWS : HOUR_ROWS
  // FLOPs span two decades, so draw them on a log axis; GPU-hours on a linear one.
  const lo = mode === "flops" ? 23 : 0
  const hi = mode === "flops" ? 25.5 : 7.5e6
  const pos = (v: number) => (mode === "flops" ? (mlog10(v) - lo) / (hi - lo) : v / hi)

  const sustained = BEAM_FLOPS / (6144 * days * 86400) / 1e12 // TFLOP/s per GPU
  const share = (sustained / PEAK_TFLOPS) * 100

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Compute ledger</div>
        <div className="flex gap-1 font-mono text-xs">
          <button type="button" onClick={() => setMode("flops")} className={`rounded-md border px-2 py-0.5 ${mode === "flops" ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            pretraining FLOPs, 6ND
          </button>
          <button type="button" onClick={() => setMode("hours")} className={`rounded-md border px-2 py-0.5 ${mode === "hours" ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            GPU-hours
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 font-mono text-xs">
              <span className={r.hl ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">{mode === "flops" ? sci(r.value) : mil(r.value)}</strong>
                {" "}
                {mode === "flops" ? "FLOPs" : "GPU-h"}
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded bg-muted/40">
              <div className="h-full rounded" style={{ width: `${(Math.max(0.02, pos(r.value)) * 100).toFixed(2)}%`, background: r.hl ? "#65a30d" : "#94a3b8" }} />
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.note}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[10px] text-muted-foreground">
        {mode === "flops" ? "log axis, 1e23 to about 3e25" : "linear axis, 0 to 7.5M"}
      </div>

      <div className="mt-4 rounded-lg border p-3">
        <label className="block text-xs text-muted-foreground">
          Beam&apos;s pretraining wall-clock, &quot;under four weeks&quot;: <strong className="font-mono text-foreground">{days} days</strong>
          <Range min={18} max={28} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="pretraining days" className="mt-1 w-full" />
        </label>
        <div className="mt-2 grid gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground sm:grid-cols-2">
          <span>
            implied sustained: <strong className="text-foreground">{sustained.toFixed(0)} TFLOP/s</strong> per GPU
          </span>
          <span>
            of a 2,250 TFLOP/s BF16 peak: <strong className="text-foreground">{share.toFixed(1)}%</strong>
          </span>
        </div>
      </div>
    </figure>
  )
}
