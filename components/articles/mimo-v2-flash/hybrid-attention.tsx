"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// MiMo-V2-Flash's hybrid block, one layer at a time. Each block is 5 Sliding-Window
// Attention layers (each token sees only a small local window) followed by 1 Global
// Attention layer (each token sees everything). The trick: stacked SWA layers COMPOUND
// their reach — after 5 of them the effective receptive field is ~5 windows wide, even
// though every layer only ever looked one window back — and the periodic global layer
// then mixes across the whole sequence. Cheap local layers most of the time, full reach
// once per block. Auto-advances through the 6 layers; the shaded span is what the query
// token can reach so far. Illustrative; the real window is 128 tokens.

const N = 30 // token cells (a stand-in for a long context)
const WIN = 4 // window in cells (stands in for 128 tokens)
const LAYERS = [
  { type: "SWA", i: 1 },
  { type: "SWA", i: 2 },
  { type: "SWA", i: 3 },
  { type: "SWA", i: 4 },
  { type: "SWA", i: 5 },
  { type: "GA", i: 1 },
] as const

export function HybridAttention() {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 1) % LAYERS.length), 1800)
    return () => clearInterval(id)
  }, [playing])

  const layer = LAYERS[k]
  const q = N - 1 // query at the far right
  // cumulative receptive field: each stacked SWA adds ~one window; GA = everything
  const swaCount = LAYERS.slice(0, k + 1).filter((l) => l.type === "SWA").length
  const reach = layer.type === "GA" ? N : Math.min(N, swaCount * WIN + 1)
  const first = q - reach + 1

  const SWA = "oklch(0.72 0.14 195)"
  const GA = "oklch(0.72 0.15 40)"
  const c = layer.type === "GA" ? GA : SWA

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>one hybrid block · 5× sliding-window + 1× global</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        {/* layer chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {LAYERS.map((l, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setK(i)}
                className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all"
                style={i === k ? { borderColor: l.type === "GA" ? GA : SWA, background: l.type === "GA" ? GA : SWA, color: "var(--background)" } : undefined}
              >
                {l.type}{l.type === "SWA" ? ` ${l.i}` : ""}
              </button>
              {i < LAYERS.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
            </span>
          ))}
        </div>

        {/* token strip */}
        <div className="mt-4 flex gap-[3px]">
          {Array.from({ length: N }).map((_, t) => {
            const inReach = t >= first && t <= q
            const isQuery = t === q
            return (
              <div
                key={t}
                className={cn("h-6 flex-1 rounded-[2px] transition-all duration-300")}
                style={{
                  background: isQuery ? "var(--foreground)" : inReach ? c : "var(--muted)",
                  opacity: isQuery ? 1 : inReach ? 0.8 : 0.35,
                }}
                title={isQuery ? "query token" : inReach ? "reachable" : "not yet reachable"}
              />
            )
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span>← earlier tokens</span>
          <span>query ↑</span>
        </div>

        {/* stats */}
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">this layer</div>
            <div className="font-medium" style={{ color: c }}>{layer.type === "GA" ? "global attention" : `sliding window (${WIN}-cell)`}</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">effective reach so far</div>
            <div className="font-medium text-foreground">{reach >= N ? "whole sequence" : `${reach} cells`}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {layer.type === "GA"
            ? "The 6th layer is global: every token attends to the entire sequence, mixing information the local layers couldn't reach directly. One global layer per block restores full context at a fraction of the cost of making every layer global."
            : `Sliding-window layer ${layer.i}: each token attends only to its local window (128 tokens in the real model). But stacking them compounds the reach — after ${swaCount} SWA layer${swaCount > 1 ? "s" : ""} the query effectively sees ~${swaCount} windows back, with a KV cache bounded by the window, not the context length.`}
        </p>
      </div>
    </figure>
  )
}
