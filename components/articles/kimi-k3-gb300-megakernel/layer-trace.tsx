"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One Kimi K3 layer (a KDA attention layer plus its MoE block) on rank 0 of a
// TP16 GB300 group at batch 8, stock vLLM against the specialized CuTe DSL
// decode, as Nsight Systems drew it in the vLLM blog's kernel-timeline figure.
//
// TRANSCRIBED, not measured here. Each bar's start and end were read off the
// published figure by pixel position (the axis runs 0-130 us) and are good to
// about +-1 us. The totals, 130 us and 23 kernels against 69 us and 13
// kernels, are the figure's own titles. Bars span launch to end, as Nsight
// draws them; with programmatic dependent launch a kernel can launch before
// its predecessor finishes, so bars on one stream overlap.
//
// Arithmetic is +, -, *, / only.

type Cat = "norm" | "kda" | "gemm" | "ar" | "route" | "shared" | "experts" | "prefetch"
type Bar = { lane: number; a: number; b: number; cat: Cat; label?: string; fused?: boolean }

const CATS: { key: Cat; label: string; fill: string }[] = [
  { key: "norm", label: "AttnRes / norm", fill: "fill-zinc-400 dark:fill-zinc-500" },
  { key: "kda", label: "KDA attention", fill: "fill-violet-500 dark:fill-violet-400" },
  { key: "gemm", label: "GEMM", fill: "fill-blue-500 dark:fill-blue-400" },
  { key: "ar", label: "all-reduce", fill: "fill-orange-500 dark:fill-orange-400" },
  { key: "route", label: "MoE routing", fill: "fill-green-600 dark:fill-green-500" },
  { key: "shared", label: "shared expert", fill: "fill-teal-500 dark:fill-teal-400" },
  { key: "experts", label: "routed experts", fill: "fill-red-500 dark:fill-red-400" },
  { key: "prefetch", label: "L2 prefetch", fill: "fill-zinc-300 dark:fill-zinc-600" },
]
const FILL = Object.fromEntries(CATS.map((c) => [c.key, c.fill])) as Record<Cat, string>

const LANES = ["main", "main", "aux", "aux", "prefetch"]

type Trace = { key: string; title: string; span: number; kernels: number; bars: Bar[] }

const STOCK: Trace = {
  key: "stock",
  title: "Stock vLLM",
  span: 130,
  kernels: 23,
  bars: [
    { lane: 0, a: 0.1, b: 2.2, cat: "ar" },
    { lane: 0, a: 2.9, b: 14.0, cat: "gemm", label: "GEMM" },
    { lane: 0, a: 16.5, b: 19.5, cat: "gemm" },
    { lane: 0, a: 21.6, b: 25.7, cat: "kda", label: "KDA" },
    { lane: 0, a: 27.7, b: 30.0, cat: "kda" },
    { lane: 0, a: 31.6, b: 39.1, cat: "ar", label: "AR" },
    { lane: 0, a: 40.3, b: 46.6, cat: "gemm", label: "GEMM" },
    { lane: 0, a: 57.3, b: 62.7, cat: "gemm" },
    { lane: 0, a: 63.1, b: 64.6, cat: "shared" },
    { lane: 0, a: 115.8, b: 124.3, cat: "ar", label: "AR+norm", fused: true },
    { lane: 0, a: 129.4, b: 130.0, cat: "ar" },
    { lane: 1, a: 0, b: 4.9, cat: "norm", label: "res" },
    { lane: 1, a: 12.7, b: 16.3, cat: "gemm" },
    { lane: 1, a: 19.4, b: 21.9, cat: "kda" },
    { lane: 1, a: 29.9, b: 33.8, cat: "gemm" },
    { lane: 1, a: 35.3, b: 41.7, cat: "norm", label: "AttnRes" },
    { lane: 1, a: 64.6, b: 68.5, cat: "gemm" },
    { lane: 1, a: 119.6, b: 129.8, cat: "gemm", label: "up-proj+mc", fused: true },
    { lane: 2, a: 41.0, b: 58.1, cat: "gemm", label: "GEMM" },
    { lane: 2, a: 59.1, b: 63.5, cat: "route", label: "route" },
    { lane: 2, a: 73.4, b: 103.5, cat: "experts", label: "FC1" },
    { lane: 3, a: 57.6, b: 59.5, cat: "experts" },
    { lane: 3, a: 63.5, b: 73.4, cat: "route", label: "routing" },
    { lane: 3, a: 98.2, b: 116.8, cat: "experts", label: "FC2" },
  ],
}

const FUSED: Trace = {
  key: "fused",
  title: "Specialized decode",
  span: 69,
  kernels: 13,
  bars: [
    { lane: 0, a: 0, b: 0.6, cat: "ar" },
    { lane: 0, a: 1.0, b: 11.0, cat: "gemm", label: "proj GEMM" },
    { lane: 0, a: 13.3, b: 23.9, cat: "ar", label: "o-proj+AR+res", fused: true },
    { lane: 0, a: 26.0, b: 28.7, cat: "shared" },
    { lane: 0, a: 30.7, b: 59.3, cat: "experts", label: "experts FC1+FC2" },
    { lane: 1, a: 0, b: 3.4, cat: "norm", label: "res", fused: true },
    { lane: 1, a: 9.5, b: 15.8, cat: "kda", label: "KDA" },
    { lane: 1, a: 15.8, b: 27.5, cat: "gemm", label: "proj GEMM" },
    { lane: 1, a: 28.5, b: 33.6, cat: "gemm", label: "GEMM" },
    { lane: 1, a: 56.9, b: 69.0, cat: "ar", label: "MoE tail", fused: true },
    { lane: 2, a: 22.7, b: 27.7, cat: "route", label: "front", fused: true },
    { lane: 3, a: 25.4, b: 31.2, cat: "route", label: "routing" },
    { lane: 4, a: 24.1, b: 28.2, cat: "prefetch", label: "L2" },
    { lane: 4, a: 59.7, b: 69.0, cat: "prefetch", label: "L2 prefetch" },
  ],
}

const LAYERS = 93
const W = 640
const LEFT = 64
const RIGHT = 12
const AXIS = 130
const ROW = 17
const TOP = 6
const x = (us: number) => LEFT + (us / AXIS) * (W - LEFT - RIGHT)

function TraceSvg({ t }: { t: Trace }) {
  const h = TOP + LANES.length * ROW + 22
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" role="img" aria-label={`${t.title}: ${t.span} microseconds and ${t.kernels} kernels per layer`}>
      {["main stream", "aux stream", "prefetch"].map((name, i) => (
        <text
          key={name}
          x={4}
          y={TOP + (i === 0 ? ROW : i === 1 ? 3 * ROW : 4.6 * ROW)}
          className="fill-muted-foreground font-mono text-[10px]"
        >
          {name}
        </text>
      ))}
      {[0, 20, 40, 60, 80, 100, 120].map((us) => (
        <g key={us}>
          <line x1={x(us)} x2={x(us)} y1={TOP} y2={TOP + LANES.length * ROW} className="stroke-foreground/10" />
          <text x={x(us)} y={TOP + LANES.length * ROW + 12} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            {us}
          </text>
        </g>
      ))}
      <line
        x1={x(t.span)}
        x2={x(t.span)}
        y1={TOP - 4}
        y2={TOP + LANES.length * ROW + 2}
        strokeDasharray="3 3"
        className="stroke-foreground/70"
      />
      {t.bars.map((b, i) => {
        const bx = x(b.a)
        const bw = x(b.b) - x(b.a)
        const by = TOP + b.lane * ROW + 2
        return (
          <g key={i}>
            <rect
              x={bx}
              y={by}
              width={bw > 1 ? bw : 1}
              height={ROW - 4}
              rx={2}
              className={cn(FILL[b.cat], b.fused ? "stroke-foreground" : "stroke-none")}
              strokeWidth={b.fused ? 1.5 : 0}
            />
            {b.label && bw > b.label.length * 5.2 ? (
              <text x={bx + bw / 2} y={by + ROW - 8} textAnchor="middle" className="fill-white font-mono text-[9px]">
                {b.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function LayerTrace() {
  const [view, setView] = useState<"stock" | "fused" | "both">("both")
  const traces = view === "both" ? [STOCK, FUSED] : view === "stock" ? [STOCK] : [FUSED]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one KDA layer + MoE block · TP16 · batch 8 · rank 0 · µs
        </span>
        <div className="flex gap-1.5">
          {(
            [
              ["stock", "stock"],
              ["fused", "specialized"],
              ["both", "both"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                view === k ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        {traces.map((t) => (
          <div key={t.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
              <span className="font-semibold">{t.title}</span>
              <span className="tabular-nums text-muted-foreground">
                {t.span} µs · {t.kernels} kernels per layer · × {LAYERS} layers ≈ {((t.span * LAYERS) / 1000).toFixed(2)} ms ·{" "}
                ≈ {t.kernels * LAYERS} kernels a step
              </span>
            </div>
            <TraceSvg t={t} />
          </div>
        ))}

        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {CATS.map((c) => (
            <span key={c.key} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <svg width="10" height="10" aria-hidden="true">
                <rect width="10" height="10" rx="2" className={c.fill} />
              </svg>
              {c.label}
            </span>
          ))}
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <svg width="10" height="10" aria-hidden="true">
              <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="2" className="fill-none stroke-foreground" strokeWidth="1.5" />
            </svg>
            one kernel fused across operators
          </span>
        </div>

        <div className="grid gap-x-6 gap-y-1 rounded-md border bg-background/60 p-3 font-mono text-[11px] tabular-nums sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">per layer, stock ÷ specialized</span>
            <span>{(STOCK.span / FUSED.span).toFixed(2)}×</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">kernels removed per layer</span>
            <span>{STOCK.kernels - FUSED.kernels}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">measured step, batch 8, stock</span>
            <span>12.37 ms</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">measured step, batch 8, specialized</span>
            <span>6.91 ms</span>
          </div>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          Bars transcribed from the vLLM blog&rsquo;s Nsight Systems figure, good to about ±1 µs; the totals are
          the figure&rsquo;s own. Bars on one stream overlap because programmatic dependent launch lets a kernel
          start before its predecessor ends. The × {LAYERS} line treats every layer like this KDA layer, which is
          a reasoned approximation: 24 of the 93 are MLA layers. The measured step times come from the
          post&rsquo;s table (8 ÷ 1,157.9 tok/s, and the same divided by its 1.79× speedup) and include the
          embedding, the LM head and sampling, which the trace leaves out.
        </p>
      </div>
    </figure>
  )
}
