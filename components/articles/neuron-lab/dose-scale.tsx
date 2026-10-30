"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { COL_MEDIAN, LAYERS, PEAK_MAX, PEAK_MEDIAN, RES_NORM } from "./data"

// What "dose 1" means in each layer of Qwen3-0.6B. Every array comes from the lab's published data files (see
// data.ts); the three derived numbers are plain arithmetic on them:
//   write length  = dose x RES_NORM[L]                  how far the neuron's direction is pushed, in residual units
//   offset        = dose x RES_NORM[L] / col length      what is added to the neuron's activation
//   x median peak = offset / PEAK_MEDIAN[L]              against what a typical neuron there ever reaches

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2))
const ACCENT = "oklch(0.65 0.16 55)"

export function DoseScale() {
  const [layer, setLayer] = useState(16)
  const [dose, setDose] = useState(0.8)
  const res = RES_NORM[layer]
  const col = COL_MEDIAN[layer]
  const offset = (dose * res) / col
  const rel = Math.abs(offset) / PEAK_MEDIAN[layer]
  const maxRel = Math.abs(offset) / PEAK_MAX[layer]
  const bars = [
    { label: "median neuron's peak", v: PEAK_MEDIAN[layer], note: "on the reference text" },
    { label: "strongest neuron's peak", v: PEAK_MAX[layer], note: "any neuron of this layer" },
    { label: `your offset (dose ${dose.toFixed(2)})`, v: Math.abs(offset), note: "added at every position", accent: true },
  ]
  const top = Math.max(...bars.map((b) => b.v))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what a dose means, layer by layer (measured: Qwen3-0.6B on 69,596 corpus tokens)
      </div>
      <div className="space-y-3 px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-16 shrink-0 font-mono text-muted-foreground">layer</span>
          <Range className="w-full" min={0} max={LAYERS - 1} step={1} value={layer} onChange={(e) => setLayer(+e.target.value)} accent={ACCENT} aria-label="Layer" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">L{layer}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-16 shrink-0 font-mono text-muted-foreground">dose</span>
          <Range className="w-full" min={-2} max={2} step={0.05} value={dose} onChange={(e) => setDose(+e.target.value)} accent={ACCENT} aria-label="Dose" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{dose > 0 ? "+" : dose < 0 ? "−" : ""}{Math.abs(dose).toFixed(2)}</span>
        </label>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">typical residual length at L{layer}</dt>
          <dd className="text-right font-mono tabular-nums">{fmt(res)}</dd>
          <dt className="text-muted-foreground">typical down_proj column length</dt>
          <dd className="text-right font-mono tabular-nums">{col.toFixed(3)}</dd>
          <dt className="text-muted-foreground">write length (dose &times; residual length)</dt>
          <dd className="text-right font-mono tabular-nums">{fmt(dose * res)}</dd>
          <dt className="text-muted-foreground">activation offset (write length &divide; column length)</dt>
          <dd className="text-right font-mono tabular-nums">{offset >= 0 ? "+" : "−"}{fmt(Math.abs(offset))}</dd>
        </dl>
        <div className="space-y-1.5" role="img" aria-label={`At layer ${layer}, a dose of ${dose} adds ${fmt(Math.abs(offset))} to the neuron's activation, ${rel.toFixed(1)} times the median neuron's peak and ${maxRel.toFixed(2)} times the strongest neuron's peak.`}>
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-44 shrink-0 text-muted-foreground">{b.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                <div className="h-full" style={{ width: `${Math.min(100, (b.v / top) * 100).toFixed(1)}%`, background: b.accent ? ACCENT : "oklch(0.6 0.04 255)" }} />
              </div>
              <span className="w-14 shrink-0 text-right font-mono tabular-nums">{fmt(b.v)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          At L{layer} this dose is {rel.toFixed(1)}&times; what a typical neuron there ever reaches and {maxRel.toFixed(2)}&times; the strongest one&apos;s peak. A dose of 1 is a large push on purpose: the neuron is being made to do what it would only do on its best text, plus more.
        </p>
      </div>
    </figure>
  )
}
