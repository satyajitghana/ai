"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The backbone's own structure, read from config.json and verified against
// the safetensors headers of all 131 shards (HTTP range requests, no weight
// data downloaded) -- not redrawn from a diagram, because the model card
// doesn't ship one for any of the three architecture pieces it names.
//
// 78 layers total. mlp_layer_types: layer 0 = "dense" (a standard FFN),
// layers 1-77 = "sparse" (MoE: 256 routed experts + 1 shared expert, top-8
// routed per token). indexer_types: 21 layers are "full" (they compute their
// own DeepSeek Sparse Attention index), 57 are "shared" (IndexCache: they
// reuse a nearby full layer's index instead of computing one). This isn't
// just a compute-time shortcut -- the 57 "shared" layers structurally do not
// own indexer.{wk,wq_b,weights_proj,k_norm} tensors at all. Checked directly:
// model.layers.{0,1,5}.self_attn.indexer.wk.weight exist (full); layers
// {2,3,4,6} do not (shared). Per-full-layer indexer cost: 9,371,904 params
// (wk 786,432 + wq_b 8,388,608 + weights_proj 196,608 + k_norm 256). If all
// 78 layers had their own, that's 730.8M; owning only 21 costs 196.8M --
// IndexCache saves 534.2M params of indexer weights alone, on top of the
// compute it skips.
//
// Backbone parameter split, summed from every tensor's real shape:
//   dense/attention/hc/embed/head/norms (always active)     22.777B
//   shared expert, all 77 MoE layers (always active)          2.907B
//   router gate, all 77 MoE layers (always active, tiny)      0.121B
//   routed experts, 8-of-256 active fraction                 23.253B
//   routed experts, the other 248-of-256 (idle this token)  720.850B
//                                                    TOTAL  769.907B
//                                                   ACTIVE   49.058B
// Matches the card's own "770B total, 49B activated" to three sig figs.

const DENSE = "oklch(0.68 0.13 85)"
const MOE_SHARED = "oklch(0.60 0.15 255)"
const MOE_FULL = "oklch(0.55 0.16 155)"
const IDLE = "oklch(0.62 0.03 250)"
const ACTIVE = "oklch(0.55 0.16 155)"

const N_LAYERS = 78
const FULL_LAYERS = new Set([0, 1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77])

const W = 700
const CELL = 15
const GAP = 2.2
const COLS = 26
const GRID_X = 14

const DENSE_ALWAYS = 22_776_541_853
const SHARED_EXPERT = 2_906_652_672
const GATE = 121_130_240
const ROUTED_TOTAL = 744_103_084_032
const ROUTED_ACTIVE = 23_253_221_376
const TOTAL = DENSE_ALWAYS + SHARED_EXPERT + GATE + ROUTED_TOTAL
const ACTIVE_TOTAL = DENSE_ALWAYS + SHARED_EXPERT + GATE + ROUTED_ACTIVE
const ROUTED_IDLE = ROUTED_TOTAL - ROUTED_ACTIVE

const bn = (n: number) => (n / 1e9).toFixed(3)

export function LayerAnatomy() {
  const [view, setView] = useState<"total" | "active">("total")

  const barW = 672
  const scale = barW / TOTAL
  const alwaysW = (DENSE_ALWAYS + SHARED_EXPERT + GATE) * scale
  const idleW = ROUTED_IDLE * scale
  const activeSliverW = ROUTED_ACTIVE * scale

  const activeBarScale = barW / TOTAL // same scale, so the "active" bar visually shrinks
  const activeBarW = ACTIVE_TOTAL * activeBarScale

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">78 layers, config.json + safetensors headers</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          21 full-indexer · 57 shared (IndexCache)
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 150`} width={W} height={150} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Seventy-eight layers drawn as a grid. Layer 0 is a dense feed-forward layer. Layers 1 through 77 are mixture-of-experts layers, each with 256 routed experts and 1 shared expert. Of those 77 MoE layers, 21 -- marked with a ring -- compute their own DeepSeek Sparse Attention index; the other 56 reuse a nearby full layer's index instead of computing their own, via IndexCache.`}
            </title>
            {Array.from({ length: N_LAYERS }, (_, i) => {
              const col = i % COLS
              const row = Math.floor(i / COLS)
              const x = GRID_X + col * (CELL + GAP)
              const y = 8 + row * (CELL + GAP)
              const isDense = i === 0
              const isFull = FULL_LAYERS.has(i)
              const fill = isDense ? DENSE : isFull ? MOE_FULL : MOE_SHARED
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={fill}
                  fillOpacity={isDense || isFull ? 0.85 : 0.35}
                  stroke={isFull ? MOE_FULL : "none"}
                  strokeWidth={isFull ? 1.4 : 0}
                  strokeOpacity={0.9}
                />
              )
            })}
            <g transform="translate(14, 68)">
              <rect x={0} y={-8} width={11} height={11} rx={2} fill={DENSE} fillOpacity={0.85} />
              <text x={15} y={0} fontSize={7} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                layer 0, dense FFN
              </text>
              <rect x={165} y={-8} width={11} height={11} rx={2} fill={MOE_FULL} fillOpacity={0.85} stroke={MOE_FULL} strokeWidth={1.4} />
              <text x={180} y={0} fontSize={7} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                MoE, full indexer (21)
              </text>
              <rect x={355} y={-8} width={11} height={11} rx={2} fill={MOE_SHARED} fillOpacity={0.35} />
              <text x={370} y={0} fontSize={7} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                MoE, shared indexer via IndexCache (57)
              </text>
            </g>
          </svg>
        </div>

        <div className="mt-2 flex gap-1.5">
          {(["total", "active"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "total" ? "769.907B total" : "49.058B active"}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 70`} width={W} height={70} role="img" className="min-w-[660px] max-w-full">
            <title>
              {view === "total"
                ? `The backbone's 769.907 billion parameters, drawn to scale: 96.6 percent, 744.103 billion, sits in the routed expert banks. Of that, only 23.253 billion -- 8 of 256 experts per token -- is active on any given token. The rest, 720.850 billion, sits idle. The remaining 25.805 billion -- attention, the shared expert, the router, and everything else -- is always active.`
                : `The same 769.907 billion parameters, but only the 49.058 billion that are actually active on a given token are drawn -- the rest of the bar is empty space at the same scale, to show how small the active slice is against the full backbone.`}
            </title>
            {view === "total" ? (
              <>
                <rect x={14} y={16} width={alwaysW} height={26} rx={3} fill={ACTIVE} fillOpacity={0.85} />
                <rect x={14 + alwaysW} y={16} width={activeSliverW} height={26} rx={0} fill={ACTIVE} fillOpacity={0.55} />
                <rect x={14 + alwaysW + activeSliverW} y={16} width={idleW} height={26} rx={3} fill={IDLE} fillOpacity={0.25} />
                <text x={14} y={12} fontSize={7} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  always-active (25.805B) + active routed slice (23.253B)
                </text>
                <text x={14 + alwaysW + idleW / 2 + activeSliverW} y={54} textAnchor="middle" fontSize={7} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  idle this token — 720.850B, 93.6% of the whole backbone
                </text>
              </>
            ) : (
              <>
                <rect x={14} y={16} width={barW} height={26} rx={3} fill="currentColor" fillOpacity={0.05} />
                <rect x={14} y={16} width={activeBarW} height={26} rx={3} fill={ACTIVE} fillOpacity={0.85} />
                <text x={14 + Math.min(activeBarW + 8, barW - 4)} y={33} fontSize={8} fill={ACTIVE} fontFamily="ui-monospace, monospace">
                  49.058B — 6.4%
                </text>
              </>
            )}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two independent things happen in a MoE layer here, and IndexCache and top-8 routing are not
          the same mechanism. Routing determines <span style={{ color: ACTIVE }}>which 8 of 256 experts</span>{" "}
          run — that&rsquo;s the usual MoE story, and it&rsquo;s why 96.6% of the backbone (744.103B) sits
          in expert banks while only {bn(ROUTED_ACTIVE)}B of it fires per token. IndexCache is a separate
          decision about the attention side: whether a layer computes{" "}
          <span style={{ color: MOE_FULL }}>its own sparse-attention index</span> at all, or reuses{" "}
          <span style={{ color: MOE_SHARED }}>a nearby layer&rsquo;s</span>. Checked directly against the
          weight files: the 57 shared-indexer layers don&rsquo;t just skip running their own indexer at
          inference — they don&rsquo;t own one. That&rsquo;s 534.2M parameters of indexer weights that
          simply don&rsquo;t exist, on top of whatever compute reusing an index saves.
        </p>
      </div>
    </figure>
  )
}
