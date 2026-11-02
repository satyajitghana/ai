"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { LAT, WEIGHT_BYTES } from "./data"

// One control step against its budget. Latencies are measured (onnxruntime on a
// shared 4 vCPU CPU); the bandwidth line is arithmetic on the file size.

const MODES = [
  { id: "t1", label: "fp32, 1 thread", p50: LAT.t1.p50, p95: LAT.t1.p95 },
  { id: "t2", label: "fp32, 2 threads", p50: LAT.t2.p50, p95: LAT.t2.p95 },
  { id: "int8", label: "int8 dynamic, 2 threads", p50: LAT.int8.p50, p95: LAT.int8.p95 },
] as const

const RATES = [25, 50, 100]

export function LoopBudget() {
  const [ri, setRi] = useState(1)
  const [mi, setMi] = useState(1)
  const hz = RATES[ri]
  const budget = 1000 / hz
  const m = MODES[mi]
  const scaleMax = 130
  const bytes = mi === 2 ? WEIGHT_BYTES / 4 : WEIGHT_BYTES
  const gbs = bytes / 1e9 / (m.p50 / 1000)
  const needGbs = bytes / 1e9 / (budget / 1000)
  const verdict = m.p50 <= budget ? "median fits" : "median misses"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one control step vs its budget · measured on a shared CPU</span>
        <div className="flex gap-1" role="group" aria-label="Runtime">
          {MODES.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setMi(i)}
              aria-pressed={mi === i}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${mi === i ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>control rate</span>
          <span className="font-mono">
            {hz} Hz = {budget.toFixed(0)} ms
          </span>
        </label>
        <Range min={0} max={2} step={1} value={ri} onChange={(e) => setRi(Number(e.target.value))} aria-label="Control rate" accent="oklch(0.62 0.16 35)" />
        <svg viewBox="0 0 100 22" className="h-24 w-full" role="img" aria-label={`Latency ${m.p50} ms median against a ${budget} ms budget`} preserveAspectRatio="none">
          <rect x="0" y="6" width={(budget / scaleMax) * 100} height="10" fill="oklch(0.62 0.15 150)" opacity="0.25" />
          <rect x="0" y="9" width={(m.p50 / scaleMax) * 100} height="4" fill="oklch(0.62 0.16 35)" />
          <line x1={(m.p95 / scaleMax) * 100} x2={(m.p95 / scaleMax) * 100} y1="5" y2="17" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 1" />
          <line x1={(budget / scaleMax) * 100} x2={(budget / scaleMax) * 100} y1="3" y2="19" stroke="oklch(0.55 0.15 150)" strokeWidth="0.6" />
        </svg>
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>0 ms</span>
          <span>green bar: the budget; orange: median; dashed: 95th percentile</span>
          <span>{scaleMax} ms</span>
        </div>
        <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">median</dt>
            <dd className="text-sm">{m.p50.toFixed(1)} ms</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">95th percentile</dt>
            <dd className="text-sm">{m.p95.toFixed(1)} ms</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">verdict at {hz} Hz</dt>
            <dd className="text-sm">{verdict}</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">weights read per step</dt>
            <dd className="text-sm">{(bytes / 1e6).toFixed(0)} MB</dd>
          </div>
        </dl>
        <p className="text-sm">
          Reading the weights once in {m.p50.toFixed(0)} ms is {gbs.toFixed(1)} GB/s. To fit {hz} Hz the same weights would need {needGbs.toFixed(1)} GB/s (reasoned).
        </p>
      </div>
    </figure>
  )
}
