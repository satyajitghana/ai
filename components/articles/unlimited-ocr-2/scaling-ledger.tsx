"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { BENCH, HIDDEN, KV_BYTES_PER_TOKEN, LAYERS, ROWS, fmt } from "./data"

// Per decode step, 12 layers. Attention FLOPs = LAYERS x 4 x 1280 x keys (QK^T and PV, 10 heads x 128).
// KV bytes = keys x 61,440 (bf16). Weights per token: 578,064,128 active parameters, from the header count.
const ACTIVE = 578_064_128
const W_FLOPS = 2 * ACTIVE
const W_BYTES = 2 * ACTIVE
const attnFlops = (keys: number): number => LAYERS * 4 * HIDDEN * keys

const SERIES = [
  { id: "full", label: "Full attention", color: "oklch(0.55 0.02 260)" },
  { id: "rswa", label: "R-SWA (v1)", color: "oklch(0.62 0.15 60)" },
  { id: "sr", label: "SR-SWA (v2)", color: "oklch(0.6 0.15 175)" },
] as const

export function ScalingLedger() {
  const [i, setI] = useState(6)
  const r = ROWS[i]
  const keys = { full: r.full, rswa: r.rswa, sr: r.sr }
  const maxKeys = r.full
  const bmax = BENCH[BENCH.length - 1].dense

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        cost of one decode step by document length · counts re-derived, timings measured on a CPU with NumPy
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">pages</span>
        {ROWS.map((x, k) => (
          <button
            key={x.pages}
            type="button"
            onClick={() => setI(k)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              i === k ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.pages}
          </button>
        ))}
      </div>
      <div className="space-y-4 px-4 py-4">
        {SERIES.map((s) => {
          const k = keys[s.id]
          const gf = attnFlops(k) / 1e9
          const gb = (k * KV_BYTES_PER_TOKEN) / 1e9
          return (
            <div key={s.id}>
              <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
                <span>{s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmt(k)} keys · {gf.toFixed(3)} GFLOP attention · {gb.toFixed(3)} GB of KV read
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-muted" role="img" aria-label={`${s.label}: ${fmt(k)} keys`}>
                <div className="h-full" style={{ width: `${Math.max(0.4, (k / maxKeys) * 100).toFixed(2)}%`, background: s.color }} />
              </div>
            </div>
          )
        })}
        <p className="font-mono text-[11px] text-muted-foreground">
          For scale, the weights cost {(W_FLOPS / 1e9).toFixed(2)} GFLOP and {(W_BYTES / 1e9).toFixed(2)} GB a token (578M active parameters in bf16). Full attention at {r.pages} pages reads{" "}
          {((r.full * KV_BYTES_PER_TOKEN) / W_BYTES).toFixed(2)}x that in KV; SR-SWA reads {((r.sr * KV_BYTES_PER_TOKEN) / W_BYTES).toFixed(3)}x.
        </p>
      </div>
      <div className="border-t px-4 py-3">
        <div className="mb-2 font-mono text-[11px] text-muted-foreground">
          measured: one layer, one step, 10 heads x 128, float32, one CPU thread, dense vs gathering 448 keys
        </div>
        <div className="space-y-1.5">
          {BENCH.map((b) => (
            <div key={b.s} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-2 font-mono text-[11px]">
              <span className="tabular-nums text-muted-foreground">{fmt(b.s)} keys</span>
              <div className="space-y-0.5">
                <div className="h-2 rounded" style={{ width: `${((b.dense / bmax) * 100).toFixed(1)}%`, background: SERIES[0].color }} />
                <div className="h-2 rounded" style={{ width: `${((b.sparse / bmax) * 100).toFixed(1)}%`, background: SERIES[2].color }} />
              </div>
              <span className="text-right tabular-nums">
                {b.dense.toFixed(1)} / {b.sparse.toFixed(1)} ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
