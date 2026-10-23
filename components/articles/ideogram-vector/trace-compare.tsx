"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { TRACE, type TraceRow } from "./data"

// Ideogram Vector's image-to-SVG output against VTracer 0.6.12 on the same
// source raster. The three sources and Ideogram's SVGs are the "Vectorize an
// image" examples on ideogram.ai/models/vector. I ran VTracer (pip wheel,
// colour mode, stacked, spline) with three settings on a shared 4-core Xeon
// @ 2.10 GHz VM, CPU only, two threads. PSNR is over RGB at the source's pixel
// size: each SVG rendered with CairoSVG onto white and compared with the
// decoded WebP source. Ideogram's own conversion time is unknown, so it is not
// shown.

type Preset = "simplified" | "default" | "precise"

const PRESETS: { id: Preset; label: string; note: string }[] = [
  { id: "simplified", label: "simplified", note: "filter_speckle 8, color_precision 5, layer_difference 32: VTracer told to keep it small." },
  { id: "default", label: "default", note: "VTracer's own defaults: filter_speckle 4, color_precision 6, layer_difference 16." },
  { id: "precise", label: "precise", note: "filter_speckle 2, color_precision 7, layer_difference 8: more layers, finer colour steps." },
]

const IDEO = "oklch(0.66 0.17 330)"
const VT = "oklch(0.58 0.05 250)"

type Metric = { id: keyof TraceRow; label: string; better: "low" | "high"; fmt: (v: number) => string; log: boolean }

const METRICS: Metric[] = [
  {
    id: "bytes",
    label: "file size",
    better: "low",
    log: true,
    fmt: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} MB` : `${Math.round(v / 1000)} kB`),
  },
  { id: "paths", label: "paths", better: "low", log: true, fmt: (v) => v.toLocaleString("en-US") },
  { id: "colours", label: "distinct flat fills", better: "low", log: true, fmt: (v) => v.toLocaleString("en-US") },
  { id: "psnr", label: "PSNR vs source", better: "high", log: false, fmt: (v) => `${v.toFixed(1)} dB` },
]

export function TraceCompare() {
  const names = Object.keys(TRACE)
  const [name, setName] = useState(names[2])
  const [preset, setPreset] = useState<Preset>("default")
  const row = TRACE[name]
  const vt = row.vt[preset]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">same source raster · Ideogram Vector vs VTracer 0.6.12</span>
        <span className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm" style={{ background: IDEO }} /> Ideogram
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm" style={{ background: VT }} /> VTracer
          </span>
        </span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Source image">
          {names.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setName(n)}
              aria-pressed={name === n}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                name === n ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="VTracer preset">
          <span className="mr-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">VTracer</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              aria-pressed={preset === p.id}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                preset === p.id ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="m-0 text-xs leading-5 text-muted-foreground">
          {PRESETS.find((p) => p.id === preset)!.note} Source {row.size} px.
          {vt.secs !== undefined ? ` VTracer took ${vt.secs} s.` : ""}
        </p>

        <div className="space-y-3">
          {METRICS.map((m) => {
            const a = row.ideogram[m.id] as number | null
            const b = vt[m.id] as number | null
            const vals = [a, b].filter((v): v is number => v !== null && v !== undefined)
            const max = Math.max(...vals)
            const w = (v: number) =>
              m.log ? Math.max(2, (mlog10(v) / mlog10(max * 1.05)) * 100) : Math.max(2, (v / (max * 1.05)) * 100)
            return (
              <div key={String(m.id)}>
                <div className="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  {m.label} · {m.better === "low" ? "lower is leaner" : "higher is closer"}
                  {m.log ? " · log" : ""}
                </div>
                {[
                  { v: a, c: IDEO, l: "Ideogram" },
                  { v: b, c: VT, l: "VTracer" },
                ].map((x) => (
                  <div key={x.l} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2">
                    <span className="text-right font-mono text-[10px]">{x.l}</span>
                    <div className="h-2.5 rounded-sm bg-muted/40">
                      {x.v !== null && x.v !== undefined ? (
                        <div className="h-2.5 rounded-sm" style={{ width: `${w(x.v).toFixed(2)}%`, background: x.c }} />
                      ) : null}
                    </div>
                    <span className="font-mono text-[10px] tabular-nums">
                      {x.v !== null && x.v !== undefined ? m.fmt(x.v) : "not rendered"}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <p className="m-0 text-xs leading-5 text-muted-foreground">
          Ideogram&rsquo;s file also carries {row.ideogram.gradients} gradients; VTracer&rsquo;s carries none at any
          setting, so every smooth ramp in the source becomes a staircase of flat layers. PSNR rewards matching pixels,
          not editability: it is a sanity check that the smaller file is not simply worse, nothing more.
        </p>
      </div>
    </figure>
  )
}
