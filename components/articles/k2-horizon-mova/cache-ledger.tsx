"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// "No additional KV cache cost compared to standard GQA" — true, and not the
// same thing as a small cache.
//
// K2-Horizon-MoVA-36B-A4B: 48 layers, all full attention (use_sliding_window is
// false and sliding_window is null), num_key_value_heads 8, head_dim 128, so
//
//   bytes/token = 2 (K and V) · 48 layers · 8 heads · 128 dims · 2 bytes = 196,608
//
// which is 192 KiB per token in BF16. MoVA does not change that number; that is
// the claim, and it is exactly right. What it also does not change is that 48
// full-attention layers at 512K context is 96 GiB of cache for one sequence.
//
// The comparison row is MiMo-V2.6-Pro, which spends its architecture budget on
// the opposite problem: 70 layers of which 60 are sliding-window at window 128,
// so only the 10 global layers scale with context.
//
// Numbers below are all from the two configs. No Math.pow anywhere: everything
// is +, ×, / on exact integers, so server and client agree bit for bit.

const KIB = 1024
const GIB = 1024 * 1024 * 1024

type Model = {
  id: string
  label: string
  detail: string
  layersFull: number
  layersLocal: number
  window: number
  kvHeads: number
  headDim: number
  accent?: boolean
}

const MODELS: Model[] = [
  {
    id: "mova",
    label: "K2-Horizon-MoVA-36B-A4B",
    detail: "48 full-attention layers · 8 KV heads × 128",
    layersFull: 48,
    layersLocal: 0,
    window: 0,
    kvHeads: 8,
    headDim: 128,
    accent: true,
  },
  {
    id: "gqa",
    label: "matched plain GQA",
    detail: "same 48 layers, same 8 × 128, ordinary v_proj",
    layersFull: 48,
    layersLocal: 0,
    window: 0,
    kvHeads: 8,
    headDim: 128,
  },
  {
    id: "mimo",
    label: "MiMo-V2.6-Pro",
    detail: "10 global + 60 sliding-window at 128 · 8 KV heads × 160",
    layersFull: 10,
    layersLocal: 60,
    window: 128,
    kvHeads: 8,
    // head_dim 192 for QK but v_head_dim 128; the cache holds one of each.
    headDim: 160,
  },
]

function bytes(m: Model, tokens: number, bytesPerScalar: number): number {
  const perLayerPerToken = 2 * m.kvHeads * m.headDim * bytesPerScalar
  const full = m.layersFull * tokens * perLayerPerToken
  const local = m.layersLocal * Math.min(tokens, m.window) * perLayerPerToken
  return full + local
}

const CTX = [4, 32, 128, 512] as const // thousands of tokens

function fmt(b: number): string {
  if (b >= GIB) return `${(b / GIB).toFixed(1)} GiB`
  return `${(b / (1024 * 1024)).toFixed(0)} MiB`
}

export function CacheLedger() {
  const [ctxIdx, setCtxIdx] = useState(3)
  const [fp8, setFp8] = useState(false)

  const tokens = CTX[ctxIdx] * 1024
  const bps = fp8 ? 1 : 2
  const vals = MODELS.map((m) => bytes(m, tokens, bps))
  const max = Math.max(...vals)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-4 border-b px-4 py-3">
        <label className="flex flex-1 items-center gap-2 font-mono text-xs">
          <span className="w-24 shrink-0 text-muted-foreground">
            context {CTX[ctxIdx]}K
          </span>
          <Range
            min={0}
            max={CTX.length - 1}
            step={1}
            value={ctxIdx}
            onChange={(e) => setCtxIdx(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="context length"
          />
        </label>
        <button
          type="button"
          onClick={() => setFp8((v) => !v)}
          aria-pressed={fp8}
          className="rounded-sm border px-2 py-1 font-mono text-xs transition-colors hover:bg-muted"
        >
          {fp8 ? "FP8 cache" : "BF16 cache"}
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        {MODELS.map((m, i) => (
          <div key={m.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
              <span
                className={
                  m.accent ? "text-foreground" : "text-muted-foreground"
                }
              >
                {m.label}
              </span>
              <span className="tabular-nums">{fmt(vals[i])}</span>
            </div>
            <div className="mt-1 h-3 w-full overflow-hidden rounded-sm bg-muted">
              <div
                className={
                  m.accent
                    ? "h-full bg-[var(--hg-accent,oklch(0.72_0.15_195))]"
                    : "h-full bg-muted-foreground/45"
                }
                style={{ width: `${((vals[i] / max) * 100).toFixed(2)}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {m.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3 font-mono text-xs">
        <span className="text-foreground">
          {(bytes(MODELS[0], 1, bps) / KIB).toFixed(0)} KiB per token
        </span>
        <span className="text-muted-foreground">
          {" "}
          · identical to the matched GQA row, which is the claim · and{" "}
          {(vals[0] / vals[2]).toFixed(1)}× the hybrid at this length
        </span>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Per sequence, one batch element, from each model&rsquo;s own
        <code>config.json</code>. The MiMo row caches a 160-wide entry per KV
        head because its query/key head dim is 192 and its value head dim is
        128; the exact number does not change the shape of the comparison, which
        is 60 layers that stop growing at 128 tokens.
      </figcaption>
    </figure>
  )
}
