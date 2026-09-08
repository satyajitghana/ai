"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Decode-step timeline for offloaded sparse attention, built from SparDA's own
// Algorithm 2 (Appendix A) and the "Decoupled sparse selection" paragraph of
// Section 4.1. The mechanism, not a measured profile -- durations below are
// illustrative units chosen so the diagram reads cleanly, not wall-clock ms.
//
// Baseline (synchronous offload, e.g. NOSA's per-layer UVA transfer): layer l's
// query Q_l drives top-k selection, so the fetch of layer l's KV blocks can only
// start once layer l is already executing -- select, then fetch (blocking),
// then attend, then FFN. Every layer pays the full PCIe latency serially.
//
// SparDA: the Forecast F_l is produced alongside Q_l/K_l/V_l right after layer
// l's linear projection (paper Eq. 3-4), and it predicts B_{l+1} -- the blocks
// layer l+1 will need -- immediately. That launches the CPU->GPU prefetch for
// l+1 while layer l is still attending and running its FFN, so by the time
// l+1 starts, its KV blocks are already resident on GPU. Zero visible stall,
// after the first layer's one-time fill.

type Mode = "sync" | "sparda"

const SELECT_FULL = 3 // baseline: multi-head selector, Q_l-driven
const SELECT_FORECAST = 1 // SparDA: compact one-head-per-GQA-group indexer
const FETCH = 5 // PCIe CPU->GPU transfer -- the dominant, slow step
const ATTEND = 2
const FFN = 2

const SELECT = "oklch(0.75 0.15 85)"
const STALL = "oklch(0.62 0.19 25)"
const HIDDEN = "oklch(0.55 0.16 155)"
const COMPUTE = "oklch(0.60 0.15 255)"
const FFNC = "oklch(0.72 0.13 55)"

type Bar = { t: "select" | "stall" | "hidden" | "attend" | "ffn"; a: number; b: number }
const colourOf = (t: Bar["t"]) => (t === "select" ? SELECT : t === "stall" ? STALL : t === "hidden" ? HIDDEN : t === "attend" ? COMPUTE : FFNC)

export function PrefetchTimeline() {
  const [mode, setMode] = useState<Mode>("sparda")
  const [layers, setLayers] = useState(3)

  const gpu: Bar[] = []
  const pcie: Bar[] = []

  if (mode === "sync") {
    let t = 0
    for (let l = 0; l < layers; l++) {
      gpu.push({ t: "select", a: t, b: t + SELECT_FULL })
      pcie.push({ t: "stall", a: t + SELECT_FULL, b: t + SELECT_FULL + FETCH })
      t += SELECT_FULL + FETCH
      gpu.push({ t: "attend", a: t, b: t + ATTEND })
      t += ATTEND
      gpu.push({ t: "ffn", a: t, b: t + FFN })
      t += FFN
    }
  } else {
    // steady-state SparDA: each layer's Forecast fires the next layer's fetch,
    // which runs concurrently with this layer's own attend+FFN.
    let t = 0
    for (let l = 0; l < layers; l++) {
      gpu.push({ t: "select", a: t, b: t + SELECT_FORECAST })
      gpu.push({ t: "attend", a: t + SELECT_FORECAST, b: t + SELECT_FORECAST + ATTEND })
      gpu.push({ t: "ffn", a: t + SELECT_FORECAST + ATTEND, b: t + SELECT_FORECAST + ATTEND + FFN })
      // prefetch for layer l+1, launched now, overlapping this layer's compute
      pcie.push({ t: "hidden", a: t + SELECT_FORECAST, b: t + SELECT_FORECAST + FETCH })
      t += SELECT_FORECAST + ATTEND + FFN
    }
  }

  const gpuEnd = Math.max(...gpu.map((b) => b.b))
  const pcieEnd = pcie.length ? Math.max(...pcie.map((b) => b.b)) : 0
  const end = Math.max(gpuEnd, pcieEnd)
  const perLayerBaseline = SELECT_FULL + FETCH + ATTEND + FFN
  const perLayerSparda = SELECT_FORECAST + ATTEND + FFN
  const reduction = Math.round((1 - perLayerSparda / perLayerBaseline) * 100)

  const W = 720
  const X0 = 96
  const px = (t: number) => X0 + (t / (perLayerBaseline * layers * 1.05)) * (W - X0 - 24)
  const rowH = 26
  const H = rowH * 2 + 56

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one decode step, {layers} layers · illustrative</span>
        <div className="flex gap-1.5">
          {(
            [
              ["sync", "synchronous offload"],
              ["sparda", "SparDA lookahead"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[620px] max-w-full" aria-label={`Decode timeline for ${layers} layers. ${mode === "sync" ? "Each layer selects, then stalls on a blocking PCIe fetch, then attends and runs its FFN, fully serial." : "Each layer's forecast launches the next layer's PCIe fetch immediately, overlapping it with this layer's attend and FFN, so the fetch is hidden."} Total span ${end} illustrative units.`}>
            <text x={X0 - 8} y={16} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
              GPU
            </text>
            <text x={X0 - 8} y={16 + rowH} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
              PCIe
            </text>

            <rect x={X0} y={4} width={px(end) - X0} height={rowH - 6} rx={3} fill="currentColor" fillOpacity={0.04} />
            <rect x={X0} y={4 + rowH} width={px(end) - X0} height={rowH - 6} rx={3} fill="currentColor" fillOpacity={0.04} />

            {gpu.map((b, i) => (
              <rect key={`g${i}`} x={px(b.a)} y={4} width={Math.max(1.5, px(b.b) - px(b.a))} height={rowH - 6} rx={2} fill={colourOf(b.t)} fillOpacity={0.85} />
            ))}
            {pcie.map((b, i) => (
              <rect
                key={`p${i}`}
                x={px(b.a)}
                y={4 + rowH}
                width={Math.max(1.5, px(b.b) - px(b.a))}
                height={rowH - 6}
                rx={2}
                fill={colourOf(b.t)}
                fillOpacity={mode === "sync" ? 0.85 : 0.55}
                stroke={mode === "sparda" ? HIDDEN : "none"}
                strokeDasharray={mode === "sparda" ? "2 2" : undefined}
                strokeWidth={1}
              />
            ))}

            {/* layer boundary ticks (sync mode only -- SparDA layers aren't evenly spaced on this axis) */}
            {mode === "sync" &&
              Array.from({ length: layers + 1 }, (_, i) => i * perLayerBaseline).map((t) => (
                <line key={t} x1={px(t)} x2={px(t)} y1={0} y2={2 * rowH} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
              ))}

            <line x1={px(end)} x2={px(end)} y1={0} y2={2 * rowH} stroke="currentColor" strokeOpacity={0.4} />
            <text x={px(end) + 4} y={2 * rowH - 2} className="fill-muted-foreground font-mono" fontSize={8}>
              {end} units
            </text>

            {(
              [
                ["select", SELECT, 0],
                ["blocking fetch", STALL, 68],
                ["prefetch (hidden)", HIDDEN, 168],
                ["attend", COMPUTE, 300],
                ["FFN", FFNC, 358],
              ] as const
            ).map(([label, colour, dx]) => (
              <g key={label}>
                <rect x={X0 + dx} y={H - 16} width={8} height={8} rx={1.5} fill={colour} fillOpacity={0.85} />
                <text x={X0 + dx + 12} y={H - 9} className="fill-muted-foreground font-mono" fontSize={8}>
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">layers</span>
          <Range
            min={2}
            max={5}
            step={1}
            value={layers}
            onChange={(e) => setLayers(Number(e.target.value))}
            className="flex-1"
            accent={COMPUTE}
            aria-label="number of layers shown"
          />
          <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{layers}</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          In the <span className="text-foreground">synchronous</span> baseline, layer <em>l</em>&rsquo;s own query
          drives selection, so the fetch can only start once layer <em>l</em> is already running — every layer{" "}
          <span style={{ color: STALL }}>stalls on the PCIe transfer</span> before it can attend.{" "}
          <span className="text-foreground">SparDA</span>{" "}moves that dependency one layer earlier: the Forecast is
          ready right after the linear projection, so it launches layer <em>l+1</em>&rsquo;s fetch immediately, and
          that transfer runs{" "}<span style={{ color: HIDDEN }}>hidden</span>{" "}behind layer <em>l</em>&rsquo;s attend
          and FFN. At these illustrative durations the per-layer critical path drops {reduction}% — the real,
          measured decode speedups (1.4–1.7×, batch- and model-dependent) are in the efficiency section below; this
          diagram is the mechanism they come from, not a substitute for them.
        </p>
      </div>
    </figure>
  )
}
