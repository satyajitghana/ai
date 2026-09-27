"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One user, Kimi K3, 16 chips a side: what the published numbers say a decode
// step costs, and what the memory bus says it could cost.
//
// Reported (Inferact, 23 Sep 2026): batch-1 decode without speculation, 249
// tok/s on 16x TPU v7 and 127 on 16x GB200; with DSpark at a FORCED acceptance
// length (the repo's --fixed-acceptance-length flag), 350 / 229 at 3 and
// 709 / 452 at 6. Tokens per second = acceptance length / step time, so each
// published point is a step time:
//   TPU    3 / 350 = 8.571 ms     6 / 709 = 8.463 ms
//   GB200  3 / 229 = 13.100 ms    6 / 452 = 13.274 ms
// Between 3 and 6 the step time is interpolated linearly; outside, it is held at
// the nearer point. Only the four published points are measurements.
//
// Reasoned ceiling for one token per step (no speculation), perfect sharding:
//   bytes = 108.81 GB bf16 trunk + 1,472 routed experts per token
//   TPU layout: gate/up re-encoded to FP8, down kept MXFP4 = 28,041,216 B/expert
//   GB200, MXFP4 as shipped                                  = 17,547,264 B/expert
//   bandwidth = 16 x 7,380 GB/s (TPU v7) or 16 x 8,000 GB/s (GB200)
//
// Arithmetic is +, -, *, / only.

const TRUNK = 108.81e9
const EXPERTS_PER_TOKEN = 1472

type Platform = {
  key: string
  label: string
  sub: string
  b1: number
  al3: number
  al6: number
  expertBytes: number
  bandwidth: number
  bar: string
  dot: string
}

const PLATFORMS: Platform[] = [
  {
    key: "tpu",
    label: "TPU megakernel",
    sub: "16× TPU v7",
    b1: 249,
    al3: 350,
    al6: 709,
    expertBytes: 28_041_216,
    bandwidth: 16 * 7380e9,
    bar: "bg-blue-500/85 dark:bg-blue-400/80",
    dot: "border-blue-600 dark:border-blue-400",
  },
  {
    key: "gpu",
    label: "vLLM baseline",
    sub: "16× GB200",
    b1: 127,
    al3: 229,
    al6: 452,
    expertBytes: 17_547_264,
    bandwidth: 16 * 8000e9,
    bar: "bg-zinc-400/90 dark:bg-zinc-500/90",
    dot: "border-zinc-600 dark:border-zinc-300",
  },
]

const SCALE = 1000

const stepMs = (p: Platform, al: number) => {
  const s3 = 3000 / p.al3
  const s6 = 6000 / p.al6
  if (al <= 3) return s3
  if (al >= 6) return s6
  return s3 + ((s6 - s3) * (al - 3)) / 3
}
const ceiling = (p: Platform) => p.bandwidth / (TRUNK + EXPERTS_PER_TOKEN * p.expertBytes)
const pct = (v: number) => `${((Math.min(v, SCALE) / SCALE) * 100).toFixed(2)}%`

const PRESETS: { al: number; label: string }[] = [
  { al: 3, label: "3 · published" },
  { al: 4.11, label: "4.11 · drafter's average" },
  { al: 6, label: "6 · headline" },
  { al: 6.42, label: "6.42 · math" },
]

export function DecodeRoofline() {
  const [al, setAl] = useState(6)
  const published = al === 3 || al === 6
  const [tpu, gpu] = PLATFORMS
  const tpuRate = al / (stepMs(tpu, al) / 1000)
  const gpuRate = al / (stepMs(gpu, al) / 1000)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one user · tokens/s = acceptance length ÷ step time
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {published ? "published point" : "interpolated between published points"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
            acceptance length (tokens emitted per verify step): {al.toFixed(2)}
          </span>
          <Range
            min={1}
            max={8}
            step={0.01}
            value={al}
            onChange={(e) => setAl(Number(e.target.value))}
            aria-label="Acceptance length"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.al}
              type="button"
              onClick={() => setAl(p.al)}
              aria-pressed={al === p.al}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                al === p.al ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {PLATFORMS.map((p) => {
            const step = stepMs(p, al)
            const rate = al / (step / 1000)
            const ceil = ceiling(p)
            const breakEven = step / (1000 / p.b1)
            return (
              <div key={p.key}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
                  <span>
                    {p.label} <span className="text-muted-foreground">· {p.sub}</span>
                  </span>
                  <span className="tabular-nums">
                    {rate.toFixed(0)} tok/s{" "}
                    <span className="text-muted-foreground">· {step.toFixed(2)} ms per step</span>
                  </span>
                </div>
                <div className="relative h-7 rounded-sm bg-foreground/[0.04]">
                  <div className={cn("absolute top-0 left-0 h-7 rounded-sm", p.bar)} style={{ width: pct(rate) }} />
                  <div
                    className={cn("absolute top-1 h-5 w-3 -translate-x-1/2 rounded-full border-2 bg-background", p.dot)}
                    style={{ left: pct(p.b1) }}
                    title="measured, batch 1, no speculation"
                  />
                  <div
                    className="absolute -top-1 h-9 border-l-2 border-dashed border-foreground/70"
                    style={{ left: pct(ceil) }}
                    title="bandwidth ceiling, one token per step"
                  />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-3 font-mono text-[10px] text-muted-foreground tabular-nums">
                  <span>○ no speculation, batch 1: {p.b1} tok/s</span>
                  <span>┆ bus ceiling, one token a step: {ceil.toFixed(0)} tok/s</span>
                  <span>speculation pays above {breakEven.toFixed(2)} accepted</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-1 rounded-md border bg-background/60 p-3 font-mono text-[11px] tabular-nums sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">TPU ÷ GB200 at this length</span>
            <span>{(tpuRate / gpuRate).toFixed(2)}×</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">TPU ÷ GB200, no speculation</span>
            <span>{(tpu.b1 / gpu.b1).toFixed(2)}×</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">TPU, share of its ceiling (batch 1)</span>
            <span>{((tpu.b1 / ceiling(tpu)) * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">GB200, share of its ceiling (batch 1)</span>
            <span>{((gpu.b1 / ceiling(gpu)) * 100).toFixed(0)}%</span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Scale 0 to {SCALE} tok/s. The four points at 3 and 6 are Inferact&rsquo;s,
          measured with the acceptance length forced; everything between is a
          straight line through them, and nothing outside them was measured. The
          dashed ceilings are my arithmetic for one token per step and assume
          perfect sharding and a baseline reading its experts in MXFP4. The GB200
          ceiling is the higher one: the TPU lead is a software lead.
        </p>
      </div>
    </figure>
  )
}
