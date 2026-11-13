"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { BASE, KNOB_RUNS, type KnobRun } from "./knob-data"

// The five NAS knobs, turned one at a time on the RELEASED checkpoints
// (rfdetr 1.11.1, rf-detr-nano.pth / rf-detr-small.pth), each setting scored on
// all 5,000 COCO val2017 images with pycocotools through the package's own
// predict() (FP32, threshold 0, default top-300). Resolution goes through
// predict(shape=...), queries by lowering num_queries on the model and its
// transformer, decoder depth by truncating transformer.decoder.layers, windows
// through the num_windows config argument (weights load identically). Patch size
// cannot be changed on a released checkpoint. The knob values per size come from
// src/rfdetr/config.py; the grid sizes (11 x 7 x 7 x 3 x 4 = 6,468) from the paper.

type Knob = "res" | "dec" | "queries" | "windows"
const KNOBS: { id: Knob; label: string; unit: string; grid: string }[] = [
  { id: "res", label: "resolution", unit: "px", grid: "11 values in the paper's search" },
  { id: "dec", label: "decoder layers", unit: "", grid: "7 values (0-6)" },
  { id: "queries", label: "queries", unit: "", grid: "4 values" },
  { id: "windows", label: "windows", unit: "", grid: "3 values" },
]

const ACCENT = "oklch(0.62 0.19 300)"

function valueOf(r: KnobRun, k: Knob) {
  return k === "res" ? r.res : k === "dec" ? r.dec : k === "queries" ? r.queries : r.windows
}

export function KnobExplorer() {
  const [size, setSize] = useState<"nano" | "small">("nano")
  const [knob, setKnob] = useState<Knob>("dec")
  const base = BASE[size]

  // runs that differ from the default only in the chosen knob
  const runs = KNOB_RUNS.filter((r) => {
    if (r.size !== size) return false
    const others = (["res", "dec", "queries", "windows"] as Knob[]).filter((k) => k !== knob)
    return others.every((k) => valueOf(r, k) === valueOf(base, k))
  }).sort((a, b) => valueOf(a, knob) - valueOf(b, knob))

  const W = 640
  const H = 230
  const PL = 44
  const PR = 12
  const PT = 16
  const PB = 40
  const lo = 0
  const hi = 60
  const y = (v: number) => PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo))
  const n = Math.max(runs.length, 1)
  const slot = (W - PL - PR) / n
  const bw = Math.min(56, slot * 0.6)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-1">
          {(["nano", "small"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              aria-pressed={size === s}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                size === s
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              RF-DETR-{s === "nano" ? "N" : "S"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {KNOBS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKnob(k.id)}
              aria-pressed={knob === k.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                knob === k.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <p className="font-mono text-xs text-muted-foreground">
          released default: {base.res} px · patch 16 · {base.windows} windows · {base.dec} decoder layers ·{" "}
          {base.queries} queries · <span className="text-foreground">{base.AP.toFixed(1)} AP</span> on my run
        </p>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`COCO AP of released RF-DETR-${size === "nano" ? "N" : "S"} as ${KNOBS.find((k) => k.id === knob)?.label} changes: ${runs
            .map((r) => `${valueOf(r, knob)} gives ${r.AP.toFixed(1)}`)
            .join(", ")}.`}
        >
          {[0, 20, 40, 60].map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PL - 6} y={y(t) + 3} fontSize="10" textAnchor="end" className="fill-muted-foreground font-mono">
                {t}
              </text>
            </g>
          ))}
          <line x1={PL} x2={W - PR} y1={y(base.AP)} y2={y(base.AP)} stroke={ACCENT} strokeOpacity={0.5} strokeDasharray="4 4" />
          {runs.map((r, i) => {
            const cx = PL + slot * (i + 0.5)
            const isBase = valueOf(r, knob) === valueOf(base, knob)
            return (
              <g key={i}>
                <rect
                  x={cx - bw / 2}
                  y={y(r.AP)}
                  width={bw}
                  height={y(lo) - y(r.AP)}
                  rx={3}
                  fill={ACCENT}
                  fillOpacity={isBase ? 0.95 : 0.45}
                />
                <text x={cx} y={y(r.AP) - 5} fontSize="11" textAnchor="middle" className="fill-foreground font-mono">
                  {r.AP.toFixed(1)}
                </text>
                <text x={cx} y={H - PB + 15} fontSize="11" textAnchor="middle" className="fill-muted-foreground font-mono">
                  {valueOf(r, knob)}
                  {isBase ? "*" : ""}
                </text>
              </g>
            )
          })}
          <text x={(W + PL) / 2} y={H - 6} fontSize="10" textAnchor="middle" className="fill-muted-foreground font-mono">
            {KNOBS.find((k) => k.id === knob)?.label} (* = released default) · COCO val2017 AP50:95
          </text>
        </svg>

        <div className="mt-3 grid gap-1 font-mono text-xs text-muted-foreground sm:grid-cols-2">
          <span>
            paper&apos;s search: 11 resolutions × 7 patch sizes × 7 decoder depths × 3 window settings × 4 query
            settings = 6,468 configs
          </span>
          <span>
            on a released checkpoint: resolution, queries (down), decoder depth (down), windows turn; patch size
            does not
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground/80">
          Each bar is one full pass over the 5,000 val2017 images with the official weights, one knob moved from the
          default. Accuracy only: latency for these settings is in the paper&apos;s Figures 4 and 5 (T4, TensorRT).
        </p>
      </div>
    </figure>
  )
}
