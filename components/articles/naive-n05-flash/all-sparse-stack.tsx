"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The 48-layer Naive-N0.5-Flash backbone, laid out from the real
// config.json `hybrid_layer_pattern`: 1 = Sliding-Window Attention (128-token
// window), 0 = DeepSeek Sparse Attention (backbone reads the indexer's top
// 2,048 keys). There is no "2" — no layer does dense global attention.
//
// The point of the widget: slide the context length up to 1M and watch the
// backbone key-read cost per decode step. Because every layer is bounded
// (128 for SWA, 2,048 for DSA), the all-sparse stack's attention work flattens
// once the context passes 2,048. A conventional hybrid that keeps its 9 global
// layers DENSE pays a key-read for every token in context on each of them, so
// its cost keeps climbing linearly. The prose carries every number.
//
// Honest caveat (stated on the card and in the prose): DSA layers still run a
// lightweight indexer that SCORES all visible keys, an O(L) term. It is cheap
// (16 fp8 heads, one KV head) but not zero, so the model is flat in the
// expensive attention matmul and near-linear in the cheap indexer scan.

// 1 = SWA, 0 = DSA — copied verbatim from config.json hybrid_layer_pattern.
const PATTERN: readonly number[] = [
  0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1,
  1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0,
]

const SWA_WINDOW = 128
const DSA_TOPK = 2048
const N_SWA = PATTERN.filter((p) => p === 1).length // 39
const N_DSA = PATTERN.filter((p) => p === 0).length // 9

// Context lengths the slider snaps to, with human labels.
const CTX: readonly { v: number; label: string }[] = [
  { v: 128, label: "128" },
  { v: 512, label: "512" },
  { v: 2048, label: "2,048" },
  { v: 8192, label: "8K" },
  { v: 32768, label: "32K" },
  { v: 131072, label: "128K" },
  { v: 524288, label: "512K" },
  { v: 1048576, label: "1M" },
]

const SWA_COLOR = "oklch(0.72 0.14 195)"
const DSA_COLOR = "oklch(0.72 0.15 55)"
const FULL_COLOR = "oklch(0.62 0.18 25)"

function fmt(n: number): string {
  return n.toLocaleString("en-US")
}

export function AllSparseStack() {
  const [i, setI] = useState(CTX.length - 1) // default: 1M
  const L = CTX[i].v

  // Backbone keys read per token, per decode step.
  const swaKeys = Math.min(L, SWA_WINDOW)
  const dsaKeys = Math.min(L, DSA_TOPK)
  const fullKeys = L

  const naive = N_SWA * swaKeys + N_DSA * dsaKeys
  const hybridFull = N_SWA * swaKeys + N_DSA * fullKeys // the 9 DSA layers made dense

  const ratio = naive > 0 ? hybridFull / naive : 1
  const barMax = Math.max(naive, hybridFull)

  return (
    <figure className="my-8 rounded-xl border border-border bg-card/40 p-4 sm:p-6">
      <figcaption className="mb-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Every layer is bounded.</span> The 48-layer
        stack as it ships: {N_SWA} sliding-window layers (128-token window) and {N_DSA} DeepSeek
        Sparse Attention layers (backbone reads the top 2,048 keys). No layer does dense global
        attention. Slide the context length and watch the backbone key-reads per token.
      </figcaption>

      {/* 48-layer stack */}
      <div className="mb-5">
        <div className="flex flex-wrap gap-[3px]" role="img" aria-label={`48 layers: ${N_SWA} sliding-window attention and ${N_DSA} DeepSeek Sparse Attention, no full-attention layers`}>
          {PATTERN.map((p, idx) => (
            <div
              key={idx}
              title={`Layer ${idx}: ${p === 1 ? "SWA (128-token window)" : "DSA (top-2,048)"}`}
              className="h-6 flex-1 rounded-[3px] min-w-[8px]"
              style={{ background: p === 1 ? SWA_COLOR : DSA_COLOR }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: SWA_COLOR }} />
            {N_SWA} SWA · window 128
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: DSA_COLOR }} />
            {N_DSA} DSA · top-2,048
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px] border border-dashed border-muted-foreground" />
            full attention: none
          </span>
        </div>
      </div>

      {/* slider */}
      <label className="block text-xs font-medium text-muted-foreground">
        Context length: <span className="text-foreground">{CTX[i].label} tokens</span>
      </label>
      <Range
        className="mt-2 w-full"
        min={0}
        max={CTX.length - 1}
        step={1}
        value={i}
        accent={DSA_COLOR}
        onChange={(e) => setI(Number(e.currentTarget.value))}
        aria-label="Context length"
      />

      {/* cost bars */}
      <div className="mt-5 space-y-3">
        <CostBar
          label="Naive-N0.5-Flash (all-sparse)"
          value={naive}
          max={barMax}
          color={DSA_COLOR}
          note={`${N_SWA}×${fmt(swaKeys)} + ${N_DSA}×${fmt(dsaKeys)}`}
        />
        <CostBar
          label="same stack, 9 layers made full-attention"
          value={hybridFull}
          max={barMax}
          color={FULL_COLOR}
          note={`${N_SWA}×${fmt(swaKeys)} + ${N_DSA}×${fmt(fullKeys)}`}
        />
      </div>

      <p className="mt-4 text-sm text-foreground">
        At {CTX[i].label} context: {fmt(naive)} backbone keys per token vs {fmt(hybridFull)} —{" "}
        <span className="font-semibold" style={{ color: DSA_COLOR }}>
          {ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×
        </span>{" "}
        cheaper, and flat above 2,048.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Backbone attention only. Each DSA layer also runs a lightweight indexer that scores all{" "}
        {CTX[i].label} visible keys (16 fp8 heads, one KV head) to pick the top 2,048 — an O(L) term
        that is cheap but not zero. So the heavy attention matmul is flat; the model is only
        near-linear in that cheap scan.
      </p>
    </figure>
  )
}

function CostBar({
  label,
  value,
  max,
  color,
  note,
}: {
  label: string
  value: number
  max: number
  color: string
  note: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-foreground">{fmt(value)}</span>
      </div>
      <div className="mt-1 h-5 w-full overflow-hidden rounded bg-muted">
        <div
          className={cn("h-full rounded transition-[width] duration-300")}
          style={{ width: `${Math.max(pct, 0.4)}%`, background: color }}
        />
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{note}</div>
    </div>
  )
}
