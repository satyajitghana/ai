"use client"

import { useState } from "react"

// What "high-throughput" has to mean, if it means anything measurable, since
// the release publishes no tokens/sec and no latency.
//
// All numbers are derived from config.json, not from a benchmark:
//   num_key_value_heads 2 · head_dim 128 · num_hidden_layers 48
//   sliding_window 1024 (convention: k >= q - sliding_window inclusive, so the
//   span is 1025 keys) · global_layers = 12 of 48 · torch_dtype bfloat16
//
// KV bytes per token per layer = 2 (K and V) x kv_heads x head_dim x 2 bytes
//                              = 2 x 2 x 128 x 2 = 1024 B.
// A sliding-window layer stops growing at 1025 keys; a global layer does not.
// Everything below is +, x and min, so it is exact on every engine and needs no
// dmath wrapper.

const KV_BYTES_PER_TOKEN_PER_LAYER = 2 * 2 * 128 * 2 // 1024 B
const LAYERS = 48
const GLOBAL_LAYERS = 12
const LOCAL_LAYERS = LAYERS - GLOBAL_LAYERS
const WINDOW_SPAN = 1025
const WEIGHTS_BYTES = 2_070_810_000 // model.safetensors on the Hub

const STOPS = [1024, 4096, 8192, 16384, 32768, 65536, 131072]

function hybridBytes(ctx: number) {
  return (
    GLOBAL_LAYERS * KV_BYTES_PER_TOKEN_PER_LAYER * ctx +
    LOCAL_LAYERS * KV_BYTES_PER_TOKEN_PER_LAYER * Math.min(ctx, WINDOW_SPAN)
  )
}

function allGlobalBytes(ctx: number) {
  return LAYERS * KV_BYTES_PER_TOKEN_PER_LAYER * ctx
}

function gb(bytes: number) {
  return bytes / 1e9
}

function fmt(bytes: number) {
  const g = gb(bytes)
  return g >= 1 ? `${g.toFixed(2)} GB` : `${(bytes / 1e6).toFixed(0)} MB`
}

const HYBRID = "oklch(0.58 0.14 200)"
const NAIVE = "oklch(0.58 0.16 28)"

export function KvBudget() {
  const [idx, setIdx] = useState(STOPS.length - 1)
  const ctx = STOPS[idx]

  const h = hybridBytes(ctx)
  const a = allGlobalBytes(ctx)
  const ratio = a / h

  // Concurrent full-length sequences on one 80 GB accelerator, weights resident.
  const budget = 80e9 - WEIGHTS_BYTES - 4e9 // 4 GB left for activations and runtime
  const seqH = Math.floor(budget / h)
  const seqA = Math.floor(budget / a)

  const W = 700
  const H = 150
  const L = 96
  const R = 96
  const barW = W - L - R
  const maxB = allGlobalBytes(131072)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          KV cache per sequence, derived from config.json
        </span>
        <span className="font-mono text-[10px]" style={{ color: HYBRID }}>
          {ratio.toFixed(2)}× smaller than all-global
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <label className="block font-mono text-xs text-muted-foreground">
          context length
          <input
            type="range"
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="mt-1.5 block w-full accent-foreground"
            aria-label="context length in tokens"
          />
        </label>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>1K</span>
          <span className="text-foreground">{ctx.toLocaleString()} tokens</span>
          <span>131K</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 h-auto w-full"
          role="img"
          aria-label={`At ${ctx.toLocaleString()} tokens the hybrid stack holds ${fmt(h)} of KV cache against ${fmt(a)} if all 48 blocks were global — ${ratio.toFixed(2)} times smaller.`}
        >
          {[
            { label: "as shipped", sub: "12 global + 36 windowed", v: h, c: HYBRID, n: seqH },
            { label: "all 48 global", sub: "the same model, no window", v: a, c: NAIVE, n: seqA },
          ].map((row, i) => {
            const y = 20 + i * 54
            const w = (row.v / maxB) * barW
            return (
              <g key={row.label}>
                <text
                  x={L - 8}
                  y={y + 15}
                  textAnchor="end"
                  className="fill-foreground font-mono"
                  style={{ fontSize: 10 }}
                >
                  {row.label}
                </text>
                <text
                  x={L - 8}
                  y={y + 26}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 7.5 }}
                >
                  {row.sub}
                </text>
                <rect x={L} y={y} width={barW} height={24} rx={2} className="fill-foreground/5" />
                <rect x={L} y={y} width={Math.max(w, 1.5)} height={24} rx={2} fill={row.c} />
                <text
                  x={L + Math.max(w, 1.5) + 8}
                  y={y + 16}
                  className="fill-foreground font-mono"
                  style={{ fontSize: 11 }}
                >
                  {fmt(row.v)}
                </text>
                <text
                  x={W - 4}
                  y={y + 38}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 8 }}
                >
                  {row.n} concurrent on one 80 GB card
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        KV bytes = 2 × kv_heads(2) × head_dim(128) × 2 bytes = 1024 B per token
        per block; a windowed block stops at 1,025 keys. Concurrency assumes the
        2.07 GB bf16 checkpoint resident and 4 GB reserved for activations and
        runtime, with no paging or KV quantisation — an upper bound on a bound,
        not a measurement. Paradigma publishes no throughput figure of its own.
      </figcaption>
    </figure>
  )
}
