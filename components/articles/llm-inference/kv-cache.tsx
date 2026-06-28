"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

// Two things the KV cache buys, and what it costs. Top: per-step decode work.
// Without a cache, step k re-attends over all k tokens (work grows 1,2,3,… → the
// total is quadratic); with a cache you store K/V once and each step does O(1)
// new work → linear. Bottom: that cache isn't free — it grows linearly with
// context and competes with batch size for VRAM. Numbers use the ~1 MB/token of a
// 13B model from the article.

const N = 14 // decode steps to animate

export function KVCache() {
  const [cache, setCache] = useState(true)
  const [ptr, setPtr] = useState(0)
  const [ctxK, setCtxK] = useState(4) // context length in thousands of tokens

  useEffect(() => {
    const id = setInterval(() => setPtr((p) => (p >= N ? 0 : p + 1)), 380)
    return () => clearInterval(id)
  }, [])

  const work = (k: number) => (cache ? 1 : k + 1)
  // normalize both modes to the same scale (the without-cache peak) so "with
  // cache" reads as genuinely small flat bars, not a full-height row
  const maxWork = N
  const cumWith = N
  const cumWithout = (N * (N + 1)) / 2
  const cum = Array.from({ length: ptr }, (_, k) => work(k)).reduce((a, b) => a + b, 0)

  // cache memory: 13B ~ 1 MB/token; context in thousands → MB → GB
  const cacheGB = (ctxK * 1000 * 1) / 1024
  const reqsPer80 = Math.max(1, Math.floor(80 / Math.max(cacheGB, 0.1)))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">KV cache · work per decode step</span>
        <div className="flex gap-1">
          {[
            { v: true, label: "with cache" },
            { v: false, label: "without cache" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setCache(o.v)}
              aria-pressed={cache === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                cache === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* per-step work bars */}
        <div className="flex h-28 items-end gap-1">
          {Array.from({ length: N }).map((_, k) => {
            const filled = k < ptr
            return (
              <div key={k} className="flex flex-1 flex-col items-center justify-end">
                <div
                  className="w-full rounded-sm transition-all duration-300"
                  style={{
                    height: `${(work(k) / maxWork) * 100}%`,
                    background: filled
                      ? cache
                        ? "oklch(0.72 0.15 150)"
                        : "oklch(0.72 0.15 25)"
                      : "var(--muted)",
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="text-center font-mono text-[10px] text-muted-foreground">
          decode step → (work per step ∝ height)
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="this step" value={`${ptr > 0 ? work(ptr - 1) : 0}×`} />
          <Stat label="total work" value={cache ? `${cumWith} (linear)` : `${cumWithout} (n²)`} highlight />
          <Stat label="cache speedup" value={`~${(cumWithout / cumWith).toFixed(1)}×`} />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {cache
            ? "With the cache, each step appends one token's K/V and does O(1) new attention work — generation is linear in length. That's the ~5× (and more, for long outputs) speedup over recomputing."
            : "Without a cache, every step recomputes attention over the whole growing sequence — work climbs 1, 2, 3, … and the total is quadratic. This is the cost the cache exists to erase."}
        </p>

        {/* the cost: memory */}
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>context length (13B, ~1 MB/token)</span>
            <span className="text-foreground tabular-nums">{ctxK}k tokens</span>
          </div>
          <input
            type="range"
            min={1}
            max={32}
            step={1}
            value={ctxK}
            onChange={(e) => setCtxK(parseInt(e.target.value))}
            className="w-full cursor-pointer accent-foreground"
            aria-label="context length in thousands of tokens"
          />
          <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
            <Stat label="KV cache size" value={`${cacheGB.toFixed(1)} GB`} highlight />
            <Stat label="≈ requests / 80GB GPU" value={`${reqsPer80}`} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The cache grows linearly with context and per layer, so long contexts get
            expensive fast — and every gigabyte spent on cache is a gigabyte not spent on
            batch size. Cache directly trades against concurrency, which is why the field
            quantizes it (INT8/INT4), windows it, shares it (GQA), and pages it
            (PagedAttention).
          </p>
        </div>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium text-foreground", highlight && "")}>{value}</div>
    </div>
  )
}
