"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Spark-X2.6-1.7B alternates three sliding-window layers (window 512) with one
// full-attention layer, 28 layers in all. Only the 7 full layers keep a cache
// that grows with the context. Every constant below is read from config.json
// (num_hidden_layers 28, layer_types, num_key_value_heads 2, head_dim 256,
// sliding_window 512); the arithmetic is reasoned, not measured, except the
// 32k point, which the needle run checked against real cache tensors.

const ACCENT = "oklch(0.66 0.17 45)"
const LAYERS = 28
const FULL_EVERY = 4 // layers 3, 7, 11, ... are full attention
const KV_HEADS = 2
const HEAD_DIM = 256
const WINDOW = 512
const WEIGHTS_GIB = 3415314432 / 1073741824 // model.safetensors.index.json total_size

const STOPS = [4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
const LABELS = ["4k", "8k", "16k", "32k", "64k", "128k", "256k", "512k", "1M"]

const isFull = (i: number) => i % FULL_EVERY === FULL_EVERY - 1

function kvGiB(tokens: number, bytes: number, hybrid: boolean) {
  const perTok = 2 * KV_HEADS * HEAD_DIM * bytes // K and V
  let total = 0
  for (let i = 0; i < LAYERS; i++) {
    if (!hybrid || isFull(i)) total += perTok * tokens
    else total += perTok * Math.min(tokens, WINDOW - 1)
  }
  return total / 1073741824
}

const fmt = (g: number) => (g < 1 ? `${(g * 1024).toFixed(0)} MiB` : `${g.toFixed(2)} GiB`)

export function KvBudget() {
  const [idx, setIdx] = useState(8)
  const [fp8, setFp8] = useState(false)
  const bytes = fp8 ? 1 : 2
  const tokens = STOPS[idx]
  const hybrid = kvGiB(tokens, bytes, true)
  const dense = kvGiB(tokens, bytes, false)
  const scale = Math.max(dense, WEIGHTS_GIB)
  const bar = (g: number) => `${Math.max(1.2, (g / scale) * 100)}%`
  const fullLayers = Array.from({ length: LAYERS }, (_, i) => i).filter(isFull).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>kv cache vs context · from config.json</span>
        <span className="text-muted-foreground/50">reasoned</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div role="img" aria-label={`${fullLayers} of ${LAYERS} layers are full attention`} className="flex gap-[3px]">
          {Array.from({ length: LAYERS }, (_, i) => (
            <div
              key={i}
              title={`layer ${i}: ${isFull(i) ? "full attention" : "sliding window 512"}`}
              className={cn("h-7 flex-1 rounded-sm border", isFull(i) ? "border-transparent" : "bg-muted/40")}
              style={isFull(i) ? { background: ACCENT } : undefined}
            />
          ))}
        </div>
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>layer 0</span>
          <span>
            <span style={{ color: ACCENT }}>■</span> {fullLayers} full · <span>□</span> {LAYERS - fullLayers} window-512
          </span>
          <span>layer 27</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
            <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">context {LABELS[idx]}</span>
            <Range min={0} max={STOPS.length - 1} step={1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} accent={ACCENT} aria-label="context length" />
          </label>
          <button
            type="button"
            onClick={() => setFp8(!fp8)}
            className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted/40"
            aria-pressed={fp8}
          >
            cache: {fp8 ? "8-bit" : "bf16"}
          </button>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {[
            { name: "this layout (7 full + 21 window)", g: hybrid, c: ACCENT },
            { name: "if all 28 layers were full", g: dense, c: "oklch(0.6 0.02 260)" },
            { name: "weights, bf16 (for scale)", g: WEIGHTS_GIB, c: "oklch(0.75 0.01 260)" },
          ].map((r) => (
            <div key={r.name}>
              <div className="mb-1 flex justify-between">
                <span className="text-muted-foreground">{r.name}</span>
                <span>{fmt(r.g)}</span>
              </div>
              <div className="h-3 rounded-sm bg-muted/30">
                <div className="h-3 rounded-sm" style={{ width: bar(r.g), background: r.c }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Window layers stay at {fmt(kvGiB(0, bytes, true) + (21 * 2 * KV_HEADS * HEAD_DIM * bytes * (WINDOW - 1)) / 1073741824)} whatever the context. At {LABELS[idx]} the
          hybrid is {(dense / hybrid).toFixed(2)}x smaller than a dense stack of the same width.
        </p>
      </div>
    </figure>
  )
}
