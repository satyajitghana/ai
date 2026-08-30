"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// This map is NOT read from config.json -- the gated repo returns a 401 on
// every raw file, this article's own config.json included. It is read from
// something the Hub API hands back anyway: quantization_config's
// modules_to_not_convert list (1,509 entries), which names every tensor the
// FP8 conversion left untouched, layer by layer.
//
// That list is enough to reconstruct the map on its own. A layer index with
// an "mlp.gate" entry never went through FP8 conversion on its router, which
// only exists if that layer routes to experts -- so its absence marks the
// three dense layers. A layer index with "self_attn.indexer.*" entries has a
// sparse-attention indexer -- absent on linear-attention layers, present on
// every sparse-attention block and on the extra MTP layer.
//
// Parsed straight out of the array (regex over "model.layers.N.xxx", grouped
// by N, checked for those two substrings):
//   dense (no mlp.gate):      layers 0, 1, 2
//   indexer present:          layers 3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 45(MTP)
//   everything else:          linear attention (34 layers) / routed MoE (43 layers incl. MTP)
//
// That reproduces zai-org/GLM-5.3-Flash's own published layer_types field
// (34 linear_attention + 11 deepseek_sparse_attention over 45 layers,
// first_k_dense_replace: 3) exactly, plus one MTP layer -- from a gated repo,
// without ever reading its config.json. And 12 indexer-bearing blocks (11 +
// MTP) at 4 FP8 attention projections each is the same 48-tensor count
// documented for this base model's own sparse-attention footprint elsewhere
// on this site (GLM-5.3-Flash-MLX).

const BACKBONE = 45
const DENSE_LAYERS = new Set([0, 1, 2])
const INDEXER_LAYERS = new Set([3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43])
const MTP_INDEX = 45 // rendered as a 46th cell, set apart

const DENSE = "oklch(0.62 0.03 250)"
const LINEAR = "oklch(0.60 0.15 255)"
const SPARSE = "oklch(0.62 0.16 35)"
const MTP = "oklch(0.55 0.16 155)"

type View = "ffn" | "attn"

export function LayerMap() {
  const [view, setView] = useState<View>("attn")

  const cells = Array.from({ length: BACKBONE + 1 }, (_, i) => i)
  const indexerCount = INDEXER_LAYERS.size + 1 // + MTP
  const linearCount = BACKBONE - INDEXER_LAYERS.size
  const moeCount = BACKBONE - DENSE_LAYERS.size + 1 // + MTP

  const colourOf = (i: number) => {
    if (i === MTP_INDEX) return MTP
    if (view === "ffn") return DENSE_LAYERS.has(i) ? DENSE : LINEAR
    return INDEXER_LAYERS.has(i) ? SPARSE : LINEAR
  }

  const opacityOf = (i: number) => {
    if (i === MTP_INDEX) return 0.9
    if (view === "ffn") return DENSE_LAYERS.has(i) ? 0.4 : 0.6
    return INDEXER_LAYERS.has(i) ? 0.9 : 0.55
  }

  const W = 700
  const COLS = 23
  const GAP_BEFORE_MTP = 14
  const CELL = Math.floor((W - 20 - GAP_BEFORE_MTP) / (COLS + 1))
  const rows = Math.ceil((BACKBONE + 1) / COLS)
  const H = rows * (CELL + 4) + 34

  const posOf = (i: number) => {
    if (i === MTP_INDEX) {
      const r = Math.floor((BACKBONE - 1) / COLS)
      return { x: 10 + COLS * (CELL + 0.8) + GAP_BEFORE_MTP, y: 8 + r * (CELL + 4) }
    }
    const r = Math.floor(i / COLS)
    const c = i % COLS
    return { x: 10 + c * (CELL + 0.8), y: 8 + r * (CELL + 4) }
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          layer map, derived from the gated repo&rsquo;s own tensor-exclusion list
        </span>
        <div className="flex gap-1">
          {(["attn", "ffn"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "attn" ? "linear vs sparse" : "dense vs routed"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {view === "attn"
                ? `Forty-five backbone layers plus one MTP layer, one square each. Thirty-four squares are linear-attention layers; eleven plus the MTP layer carry a sparse-attention indexer, derived from which layer indices have indexer tensors excluded from FP8 conversion.`
                : `Forty-five backbone layers plus one MTP layer, one square each. The first three are dense feed-forward layers, derived from which layer indices have no router (mlp.gate) tensor in the FP8-exclusion list; every other layer, including MTP, routes to experts.`}
            </title>
            {cells.map((i) => {
              const { x, y } = posOf(i)
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={CELL - 0.8}
                  height={CELL}
                  rx={2}
                  fill={colourOf(i)}
                  fillOpacity={opacityOf(i)}
                />
              )
            })}
            <text x={10} y={H - 12} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              layer 0 → 44, plus MTP (set apart) · {view === "attn" ? `${indexerCount} indexer-bearing blocks, ${linearCount} linear` : `${moeCount} routed, ${DENSE_LAYERS.size} dense`}
            </text>
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {(view === "attn"
            ? [
                ["linear attention (KDA)", LINEAR, 0.55],
                ["sparse attention · has an indexer", SPARSE, 0.9],
                ["MTP layer · has an indexer too", MTP, 0.9],
              ]
            : [
                ["dense FFN (layers 0–2)", DENSE, 0.4],
                ["routed to experts", LINEAR, 0.6],
                ["MTP layer · also routed", MTP, 0.9],
              ]
          ).map(([label, colour, op]) => (
            <span key={label as string} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: colour as string, opacity: op as number }} />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {view === "attn" ? (
            <>
              Eleven sparse-attention blocks plus the MTP block is <span className="text-foreground">twelve</span>{" "}
              indexer-bearing units. At four excluded-from-FP8 attention projections each, that is the same{" "}
              <span className="text-foreground">48</span> tensors this site derived independently for the base
              model&rsquo;s own sparse-attention footprint — reached here from a repo that never let this session
              read its config.json.
            </>
          ) : (
            <>
              Three dense layers, then every remaining layer — including the MTP layer — routes through the
              expert pool. That is <span className="text-foreground">first_k_dense_replace: 3</span> in
              everything but name, recovered without the field itself being readable.
            </>
          )}{" "}
          Either way the shape is identical to zai-org/GLM-5.3-Flash&rsquo;s own published architecture: the
          gate is closed on the README, not on the thing that actually decides what got edited.
        </p>
      </div>
    </figure>
  )
}
