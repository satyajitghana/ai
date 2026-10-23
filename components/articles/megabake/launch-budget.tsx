"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What one decode token costs at batch 1, three ways, from a deliberately crude
// model. Every term is either a figure MegaBake's own README/ROADMAP reports or
// arithmetic on those figures; the article labels which is which.
//
//   bytes        = params x 2                          (bf16 weights, read once per token)
//   floor        = bytes / bandwidth                   (the memory bus, nothing else)
//   per-op       = max(N x launch, floor + N x fixed)  (host enqueues N kernels; GPU runs them)
//   CUDA graphs  = floor + N x (fixed + replayGap)     (one host submit; ~0.25 us between kernels)
//   megakernel   = floor + I x interval               (one launch; I grid-barrier intervals)
//
//   N = layers x kernels per layer,  I = layers x intervals per layer + 3
//
// Defaults reproduce the repo's SmolLM-135M decode numbers on its H200 MIG
// slice (60 SMs, ~2.2 TB/s): Inductor call 11,575 us and kernels 1,384 us,
// MegaBake kernel 1,503 us over 183 barriers. Back-solved: ~21 us of host per
// Inductor launch at 540 launches, ~2.3 us of fixed GPU cost per Inductor
// kernel, ~7.5 us per MegaBake barrier interval. Those three are reasoned, not
// measured by anyone.
//
// Arithmetic is +, -, *, / and Math.max only.

type Preset = {
  key: string
  label: string
  params: number
  layers: number
  kpl: number
  launch: number
  fixed: number
  bw: number
  ipl: number
  interval: number
}

const REPLAY_GAP = 0.25

const PRESETS: Preset[] = [
  {
    key: "repo",
    label: "SmolLM-135M · repo's host",
    params: 134.5,
    layers: 30,
    kpl: 18,
    launch: 21,
    fixed: 2.3,
    bw: 2.2,
    ipl: 6,
    interval: 7.5,
  },
  {
    key: "fast",
    label: "same · 5 µs launches",
    params: 134.5,
    layers: 30,
    kpl: 18,
    launch: 5,
    fixed: 2.3,
    bw: 2.2,
    ipl: 6,
    interval: 7.5,
  },
  {
    key: "events",
    label: "same · 3 µs intervals",
    params: 134.5,
    layers: 30,
    kpl: 18,
    launch: 21,
    fixed: 2.3,
    bw: 2.2,
    ipl: 6,
    interval: 3,
  },
  {
    key: "big",
    label: "1.7B-sized · same costs",
    params: 1711,
    layers: 24,
    kpl: 18,
    launch: 21,
    fixed: 2.3,
    bw: 2.2,
    ipl: 6,
    interval: 7.5,
  },
]

type Slider = {
  key: keyof Omit<Preset, "key" | "label">
  label: string
  min: number
  max: number
  step: number
  fmt: (v: number) => string
}

const SLIDERS: Slider[] = [
  { key: "params", label: "parameters (millions)", min: 50, max: 3000, step: 0.5, fmt: (v) => `${v.toFixed(1)} M` },
  { key: "layers", label: "decoder layers", min: 4, max: 64, step: 1, fmt: (v) => `${v}` },
  { key: "kpl", label: "kernels per layer (per-op path)", min: 4, max: 40, step: 1, fmt: (v) => `${v}` },
  { key: "launch", label: "host time per launch", min: 2, max: 40, step: 0.5, fmt: (v) => `${v.toFixed(1)} µs` },
  { key: "fixed", label: "fixed GPU cost per kernel", min: 0, max: 10, step: 0.1, fmt: (v) => `${v.toFixed(1)} µs` },
  { key: "bw", label: "memory bandwidth", min: 0.5, max: 8, step: 0.1, fmt: (v) => `${v.toFixed(1)} TB/s` },
  { key: "ipl", label: "megakernel barrier intervals per layer", min: 1, max: 15, step: 1, fmt: (v) => `${v}` },
  { key: "interval", label: "cost per barrier interval", min: 0.5, max: 20, step: 0.1, fmt: (v) => `${v.toFixed(1)} µs` },
]

type Row = { key: string; label: string; us: number; note: string; bar: string }

const fmtMs = (us: number) => (us >= 1000 ? `${(us / 1000).toFixed(2)} ms` : `${us.toFixed(0)} µs`)

export function LaunchBudget() {
  const [s, setS] = useState<Preset>(PRESETS[0])
  const set = (k: Slider["key"], v: number) => setS((p) => ({ ...p, key: "custom", [k]: v }))

  const bytes = s.params * 1e6 * 2
  const floorUs = (bytes / (s.bw * 1e12)) * 1e6
  const n = s.layers * s.kpl
  const intervals = s.layers * s.ipl + 3
  const hostUs = n * s.launch
  const gpuUs = floorUs + n * s.fixed
  const perOp = Math.max(hostUs, gpuUs)
  const graphs = floorUs + n * (s.fixed + REPLAY_GAP)
  const mega = floorUs + intervals * s.interval

  const rows: Row[] = [
    {
      key: "perop",
      label: "Per-op kernels (Inductor, no CUDA graphs)",
      us: perOp,
      note: hostUs >= gpuUs ? `host-bound: ${n} launches × ${s.launch} µs` : `GPU-bound: ${n} kernels`,
      bar: "bg-zinc-400/90 dark:bg-zinc-500/90",
    },
    {
      key: "graphs",
      label: "Same kernels, replayed as a CUDA graph",
      us: graphs,
      note: `${n} kernels, ${REPLAY_GAP} µs apart, one submit`,
      bar: "bg-sky-500/80 dark:bg-sky-400/75",
    },
    {
      key: "mega",
      label: "One megakernel",
      us: mega,
      note: `1 launch, ${intervals} barrier intervals`,
      bar: "bg-amber-500/85 dark:bg-amber-400/80",
    },
  ]
  const scale = Math.max(perOp, graphs, mega, floorUs) * 1.05
  const pct = (v: number) => `${((v / scale) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          batch 1 · one decode token · bf16 weights read once
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">model, not measurement</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setS(p)}
              aria-pressed={s.key === p.key}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                s.key === p.key ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {SLIDERS.map((sl) => (
            <label key={sl.key} className="block">
              <span className="mb-0.5 flex justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                <span>{sl.label}</span>
                <span className="tabular-nums text-foreground">{sl.fmt(s[sl.key])}</span>
              </span>
              <Range
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={s[sl.key]}
                onChange={(e) => set(sl.key, Number(e.target.value))}
                aria-label={sl.label}
              />
            </label>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
                <span>{r.label}</span>
                <span className="tabular-nums">{fmtMs(r.us)}</span>
              </div>
              <div className="relative h-6 rounded-sm bg-foreground/[0.04]">
                <div className={cn("absolute top-0 left-0 h-6 rounded-sm", r.bar)} style={{ width: pct(r.us) }} />
                <div
                  className="absolute -top-1 h-8 border-l-2 border-dashed border-foreground/70"
                  style={{ left: pct(floorUs) }}
                  title="memory-bus floor"
                />
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.note}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-1 rounded-md border bg-background/60 p-3 font-mono text-[11px] tabular-nums sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">weights per token</span>
            <span>{(bytes / 1e6).toFixed(0)} MB</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">┆ memory-bus floor</span>
            <span>{fmtMs(floorUs)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">megakernel vs per-op</span>
            <span>{(perOp / mega).toFixed(2)}×</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">megakernel vs CUDA graph</span>
            <span>{(graphs / mega).toFixed(2)}×</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">megakernel share of floor</span>
            <span>{((floorUs / mega) * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">host time, per-op path</span>
            <span>{fmtMs(hostUs)}</span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The default preset is back-solved so that it lands on MegaBake&rsquo;s own SmolLM-135M decode
          numbers: an 11.6 ms Inductor call, 1.38 ms of Inductor kernels, a 1.50 ms megakernel. The
          per-launch, per-kernel and per-interval costs are my arithmetic on those, not measurements.
          Host-side costs that both paths pay (Dynamo guards, argument binding) are left out. The CUDA
          graph row is the baseline nobody has run yet.
        </p>
      </div>
    </figure>
  )
}
