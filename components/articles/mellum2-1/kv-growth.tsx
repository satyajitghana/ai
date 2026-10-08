"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Per-sequence attention memory, computed from the two config.json files.
//   Mellum2.1: 28 layers, 4 KV heads x head_dim 128, bf16 -> 2,048 bytes per
//              token per layer (K and V). layer_types: 21 sliding (window 1,024),
//              7 full. A sliding layer never holds more than 1,024 tokens.
//   "Mellum2.1, all full": the same model if every layer were full attention.
//   Qwen3.5-9B: 8 full-attention layers, 4 KV heads x head_dim 256, bf16 ->
//              4,096 bytes per token per layer; 24 Gated DeltaNet layers hold a
//              fixed fp32 state of 32 value heads x 128 x 128 each (the small
//              conv state is left out).
// bf16 cache, no cache quantization, one sequence. Exact integer arithmetic.

const CTX = [1024, 2304, 4096, 8192, 16384, 32768, 65536, 114000, 131072]

const MEL_LAYER = 4 * 128 * 2 * 2 // bytes / token / layer
const QWEN_LAYER = 4 * 256 * 2 * 2
const QWEN_STATE = 24 * 32 * 128 * 128 * 4 // bytes, constant

function mellum(ctx: number) {
  return 21 * Math.min(ctx, 1024) * MEL_LAYER + 7 * ctx * MEL_LAYER
}
function mellumAllFull(ctx: number) {
  return 28 * ctx * MEL_LAYER
}
function qwen(ctx: number) {
  return 8 * ctx * QWEN_LAYER + QWEN_STATE
}

function fmt(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

const ROWS = [
  { key: "mel", name: "Mellum2.1 (21 sliding + 7 full)", f: mellum, color: "oklch(0.62 0.17 245)" },
  { key: "full", name: "same model, all 28 full", f: mellumAllFull, color: "oklch(0.62 0.02 260)" },
  { key: "qwen", name: "Qwen3.5-9B (24 linear + 8 full)", f: qwen, color: "oklch(0.64 0.15 35)" },
] as const

export function KvGrowth() {
  const [i, setI] = useState(7)
  const ctx = CTX[i]
  const ref = mellumAllFull(CTX[CTX.length - 1])
  const vals = ROWS.map((r) => ({ ...r, b: r.f(ctx) }))
  const mel = vals[0].b
  const full = vals[1].b
  const qw = vals[2].b

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>attention memory per sequence · from config.json</span>
        <span className="text-muted-foreground/50">bf16 cache</span>
      </div>
      <div className="p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">
            context <span className="text-foreground">{ctx.toLocaleString("en-US")}</span>
          </span>
          <Range
            min={0}
            max={CTX.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="Context length in tokens"
            className="flex-1"
          />
        </div>

        <div className="space-y-3">
          {vals.map((r) => {
            const pct = (r.b / ref) * 100
            return (
              <div key={r.key} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:w-56">
                  {r.name}
                </span>
                <div className="relative h-6 flex-1">
                  <div
                    className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm transition-all duration-300"
                    style={{ width: `${Math.max(pct, 0.6)}%`, background: r.color }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 pl-2 font-mono text-[11px] tabular-nums text-muted-foreground"
                    style={{ left: `${Math.min(pct, 78)}%` }}
                  >
                    {fmt(r.b)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          At <span className="font-mono text-foreground">{ctx.toLocaleString("en-US")}</span>{" "}tokens Mellum2.1 holds{" "}
          <span className="font-mono text-foreground">{fmt(mel)}</span>{" "}of keys and values, which is{" "}
          <span className="font-mono text-foreground">{(full / mel).toFixed(1)}x</span>{" "}less than the same model with
          full attention everywhere and{" "}
          <span className="font-mono text-foreground">{(qw / mel).toFixed(1)}x</span>{" "}less than Qwen3.5-9B. The 21
          sliding layers stop growing at 1,024 tokens (44 MB in all), so past a few thousand tokens the cost is set by
          the 7 full layers alone: 14,336 bytes per token. Qwen3.5-9B also caps three layers in four, with a fixed
          linear-attention state, but its 8 full layers use 256-wide heads and cost 32,768 bytes per token.
        </p>
      </div>
    </figure>
  )
}
