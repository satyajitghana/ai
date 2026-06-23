"use client"

import { useState } from "react"
import { ArrowUpIcon, LightningIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// IndexShare, GLM 5.2's trick for cheap 1M-context sparse attention. DeepSeek
// Sparse Attention runs a small "indexer" every layer to pick which tokens each
// query attends to. But adjacent layers pick 70–100% of the SAME tokens — so
// GLM 5.2 computes the indexer once per group of layers and REUSES its top-k for
// the rest, skipping the indexer in 3 of every 4 layers. Toggle to see it.

const LAYERS = 8
const GROUP = 4
const ACCENT = "oklch(0.72 0.15 195)"

export function IndexShare() {
  const [share, setShare] = useState(true)
  const passes = share ? LAYERS / GROUP : LAYERS

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">sparse-attention indexer, per layer</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "standard DSA" },
            { v: true, label: "IndexShare" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setShare(o.v)}
              aria-pressed={share === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                share === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 p-4">
        {Array.from({ length: LAYERS }, (_, i) => {
          const isF = i % GROUP === 0
          const computes = !share || isF
          const groupStart = i - (i % GROUP)
          return (
            <div key={i} className="flex items-center gap-2 font-mono text-xs">
              <span className="w-7 shrink-0 text-muted-foreground">L{i}</span>
              {/* indexer cell */}
              <div
                className="flex h-7 flex-1 items-center gap-1.5 rounded border px-2 transition-all"
                style={
                  computes
                    ? { background: ACCENT, borderColor: ACCENT, color: "oklch(0.18 0 0)" }
                    : { opacity: 0.5 }
                }
              >
                {computes ? (
                  <>
                    <LightningIcon size={12} weight="fill" />
                    compute top-k indices
                  </>
                ) : (
                  <>
                    <ArrowUpIcon size={12} weight="bold" />
                    reuse L{groupStart}&apos;s indices
                  </>
                )}
              </div>
              {/* attention cell — always runs */}
              <div className="flex h-7 w-32 shrink-0 items-center rounded border bg-muted/40 px-2 text-muted-foreground">
                sparse attention
              </div>
            </div>
          )
        })}
      </div>

      {/* meter */}
      <div className="grid grid-cols-2 gap-px border-t bg-border font-mono text-xs">
        <div className="bg-background px-3 py-2">
          <div className="text-[10px] text-muted-foreground">indexer passes</div>
          <div className="font-medium text-foreground">
            {passes} / {LAYERS}
            {share ? <span className="text-muted-foreground"> (¾ skipped)</span> : null}
          </div>
        </div>
        <div className="bg-background px-3 py-2">
          <div className="text-[10px] text-muted-foreground">per-token FLOPs @ 1M ctx</div>
          <div className="font-medium text-foreground">
            {share ? "2.9× lower" : "baseline"}
          </div>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        {share
          ? "The indexer runs once per group of 4 layers; the other 3 reuse its token selection. Because adjacent layers pick 70–100% of the same tokens, the reuse is almost lossless — and at a 1M-token context it cuts per-token FLOPs by 2.9×."
          : "Standard DeepSeek Sparse Attention recomputes the indexer at every layer — the top-k token search dominates cost as the context grows toward 1M tokens."}
      </p>
    </figure>
  )
}
