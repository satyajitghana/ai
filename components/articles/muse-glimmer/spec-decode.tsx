"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// DFlash speculative decoding, and why the same drafter is worth 3.1x on a
// 5090 and 1.5x on an M4 Max.
//
// Baselines and averages are from the model card's table; the low/high range on
// the DFlash bars is read off the blog's chart, which carries error bars across
// seven prompt categories that the card's single average hides.

const BASE = "oklch(0.62 0.03 250)"
const SPEC = "oklch(0.60 0.15 255)"

type Dev = {
  name: string
  runtime: string
  base: number
  avg: number
  lo: number
  hi: number
  /** the speedup as Meta prints it; they truncate rather than round (50.2/26.6 = 1.89 is published as 1.8x) */
  stated: string
  why: string
}

const DEVICES: Dev[] = [
  {
    name: "RTX 5090",
    runtime: "llama.cpp",
    base: 74.9,
    avg: 233.4,
    lo: 132,
    hi: 340,
    stated: "3.1",
    why: "Enormous arithmetic throughput relative to memory bandwidth. Verifying 16 proposed tokens costs almost the same wall-clock as verifying one, because the weights only have to be read once either way — so nearly the full block size turns into speedup.",
  },
  {
    name: "Apple M5 Max",
    runtime: "ExecuTorch",
    base: 26.6,
    avg: 50.2,
    lo: 38,
    hi: 62,
    stated: "1.8",
    why: "Unified memory narrows the bandwidth gap, so the verification pass is no longer nearly free. The drafter still pays for itself, but the ceiling is set by how much compute the verify step actually costs.",
  },
  {
    name: "Apple M4 Max",
    runtime: "ExecuTorch",
    base: 23.7,
    avg: 37.8,
    lo: 29,
    hi: 47,
    stated: "1.5",
    why: "The least headroom of the three. A 1.5x gain is real and worth having, but it is the clearest evidence that speculative decoding buys you bandwidth, not arithmetic — and this machine was short of arithmetic, not bandwidth.",
  },
]

const MAX = 360

export function SpecDecode() {
  const [sel, setSel] = useState(0)
  const d = DEVICES[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          DFlash · 16 tokens proposed per drafter pass
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">batch 1 · greedy</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {DEVICES.map((dev, i) => {
            const on = i === sel
            return (
              <button
                key={dev.name}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={on}
                className={cn(
                  "w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors",
                  on ? "border-foreground/30 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
                )}
              >
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground">{dev.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {dev.runtime} · {dev.stated}× as published
                  </span>
                </div>
                {/* baseline bar */}
                <div className="relative h-3 rounded-sm bg-muted/40">
                  <div className="h-3 rounded-sm" style={{ width: `${(dev.base / MAX) * 100}%`, background: BASE }} />
                </div>
                {/* speculative bar with range */}
                <div className="relative mt-1 h-3 rounded-sm bg-muted/40">
                  <div className="h-3 rounded-sm" style={{ width: `${(dev.avg / MAX) * 100}%`, background: SPEC }} />
                  <div
                    className="absolute inset-y-0 border-x"
                    style={{
                      left: `${(dev.lo / MAX) * 100}%`,
                      width: `${((dev.hi - dev.lo) / MAX) * 100}%`,
                      borderColor: "var(--foreground)",
                      opacity: 0.45,
                    }}
                  />
                </div>
                <div className="mt-1 flex gap-3 font-mono text-[9px] text-muted-foreground">
                  <span>baseline {dev.base} tok/s</span>
                  <span style={{ color: SPEC }}>DFlash {dev.avg} tok/s</span>
                  <span>range {dev.lo}–{dev.hi}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: SPEC }}>
            {d.name} — {d.stated}× published, {(d.avg / d.base).toFixed(2)}× from the table ({(d.lo / d.base).toFixed(1)}–{(d.hi / d.base).toFixed(1)}× across prompts)
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{d.why}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Speculative decoding does not make a model faster; it converts a memory-bandwidth problem into an
          arithmetic one. Single-stream decoding is bandwidth-bound — you read 17 GB of weights to emit one token —
          so proposing a block of 16 and verifying them in one pass amortizes that read across all 16. How much you
          gain therefore depends entirely on how much spare arithmetic the device has once the weights are moving,
          which is why the identical drafter is worth{" "}
          <span className="text-foreground">3.1× on a 5090 and 1.5× on an M4 Max</span>. Worth noting too that the
          card reports one average per device while the blog&rsquo;s chart carries error bars: on the 5090 the
          DFlash result spans roughly 132 to 340 tok/s across seven prompt categories, so the real range is about
          1.8× to 4.5× and the single &ldquo;3.1×&rdquo; is the midpoint of a wide distribution.
        </p>
      </div>
    </figure>
  )
}
