"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Weights memory is just params × bytes-per-param, and inference doesn't need
// training precision. Pick a model size and a precision and watch the footprint —
// and which GPUs it fits on — move. INT4 is why a 7B model runs on a 6 GB laptop
// GPU. Numbers match the article's: 7B is 28 / 14 / 7 / 3.5 GB at FP32 / FP16 /
// INT8 / INT4.

const PRECISIONS = [
  { id: "fp32", label: "FP32", bytes: 4, note: "training precision" },
  { id: "fp16", label: "FP16", bytes: 2, note: "standard inference" },
  { id: "int8", label: "INT8", bytes: 1, note: "~half latency, ~no quality loss" },
  { id: "int4", label: "INT4", bytes: 0.5, note: "within 1–2 pts (GPTQ / AWQ)" },
]
const SIZES = [7, 13, 70]
const GPUS = [
  { name: "laptop GPU", vram: 6 },
  { name: "RTX 4090", vram: 24 },
  { name: "A100", vram: 40 },
  { name: "H100", vram: 80 },
]

export function Quantization() {
  const [size, setSize] = useState(7)
  const [prec, setPrec] = useState("int4")
  const p = PRECISIONS.find((x) => x.id === prec)!
  const gb = size * p.bytes // params(B) × bytes → GB (1e9 base)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        weights memory · params × bytes-per-param
      </div>

      <div className="space-y-4 p-4">
        {/* size selector */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="w-16 shrink-0 text-muted-foreground">model</span>
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              aria-pressed={size === s}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                size === s ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {s}B
            </button>
          ))}
        </div>

        {/* precision selector */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="w-16 shrink-0 text-muted-foreground">precision</span>
          {PRECISIONS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setPrec(x.id)}
              aria-pressed={prec === x.id}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                prec === x.id ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        {/* memory readout */}
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs text-muted-foreground">{size}B · {p.label}</span>
            <span className="font-mono text-2xl font-medium text-foreground tabular-nums">{gb.toFixed(1)} GB</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{p.note}</div>
        </div>

        {/* fits-on chips */}
        <div>
          <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">fits in VRAM (weights only)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GPUS.map((g) => {
              const fits = gb <= g.vram
              return (
                <div
                  key={g.name}
                  className={cn(
                    "rounded-md border px-2 py-1.5 font-mono text-[11px]",
                    fits ? "border-foreground/30" : "opacity-45"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: fits ? "oklch(0.72 0.15 150)" : "oklch(0.6 0.02 25)" }}
                    />
                    {g.name}
                  </div>
                  <div className="text-muted-foreground">{g.vram} GB · {fits ? "fits" : "too big"}</div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The savings are linear in bit-width, and inference quality barely moves:
          INT8 typically costs nothing and roughly halves latency, while INT4 lands within
          1–2 points of full precision using per-channel scaling (GPTQ, AWQ). That&rsquo;s
          why quantization is usually the highest-leverage single change for a deployment —
          and why a {size}B model at INT4 ({(size * 0.5).toFixed(1)} GB) fits where its
          FP16 form ({size * 2} GB) wouldn&rsquo;t.
        </p>
      </div>
    </figure>
  )
}
