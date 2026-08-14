"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 40-layer stack, read from configs/magi2_preview.json and confirmed
// against the published tensor shapes.
//
//   mm_layers  [0, 1, 38, 39]   dense MLP, and attention packed 3x
//   moe_layers [2 .. 37]        256 experts x 12 heads, top-6 per head
//
// The shape evidence for "packed 3x": on layer 0, linear_qkv is [27648, 3072]
// and linear_proj is [9216, 3072]; on layer 2 the same tensors are [9216, 3072]
// and [3072, 3072]. Exactly 3x, and k_norm goes [384] vs [128] to match. So the
// four mm layers hold one attention per modality while the 36 middle layers
// share one.

type Kind = "mm" | "moe"

const LAYERS: { i: number; kind: Kind }[] = Array.from({ length: 40 }, (_, i) => ({
  i,
  kind: [0, 1, 38, 39].includes(i) ? "mm" : "moe",
}))

const DETAIL: Record<Kind, { name: string; rows: [string, string][]; note: string }> = {
  mm: {
    name: "multimodal dense layer",
    rows: [
      ["linear_qkv", "[27648, 3072] — 3× a normal layer"],
      ["linear_proj", "[9216, 3072] — 3×"],
      ["k_norm / q_norm", "[384] — 3 × 128"],
      ["mlp.up_gate_proj", "[49152, 3072] — 3 × 16384"],
      ["mlp.down_proj", "[9216, 8192] — 3×"],
      ["MoE", "none"],
    ],
    note: "Four of these, and they sit at the very top and very bottom of the stack — two at the entrance, two at the exit. Every weight is carried three times over, one set per modality, so video, audio and text each get their own attention and their own MLP. No routing here at all: these are ordinary dense layers, just triplicated.",
  },
  moe: {
    name: "MoE layer",
    rows: [
      ["linear_qkv", "[9216, 3072] — shared across modalities"],
      ["moe_mlp.W_gate / W_up", "[3072, 256, 1280]"],
      ["moe_mlp.W_down", "[3072, 1280, 256]"],
      ["split_linear / merge_linear", "[3072, 3072] — the multi-head split"],
      ["shared_expert", "always on, all modalities"],
      ["modality_specific_shared_expert", "[7680, 3072] — 3× packed"],
    ],
    note: "Thirty-six of these in the middle. Attention is now shared across modalities — one set of weights, not three — and the MLP becomes 3,072 expert slots. That first dimension is 256 experts × 12 heads: the token is split into 12 pieces of 256 dims each, and every piece routes to its own top-6. Only the modality-specific shared expert stays triplicated.",
  },
}

const COLORS: Record<Kind, string> = {
  mm: "oklch(0.55 0.16 155)",
  moe: "oklch(0.60 0.15 255)",
}

export function LayerStack() {
  const [sel, setSel] = useState(2)
  const kind = LAYERS[sel].kind
  const d = DETAIL[kind]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">40 layers · hidden 3072</span>
        <span className="font-mono text-[10px] text-muted-foreground">4 dense · 36 MoE</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1">
          {LAYERS.map((l) => (
            <button
              key={l.i}
              type="button"
              onClick={() => setSel(l.i)}
              aria-pressed={l.i === sel}
              title={`layer ${l.i} · ${l.kind === "mm" ? "dense, 3× modality-specific" : "MoE"}`}
              className={cn(
                "h-7 w-[calc(100%/10-0.25rem)] cursor-pointer rounded-sm border font-mono text-[9px] transition-all sm:w-[calc(100%/14-0.25rem)] lg:w-[calc(100%/20-0.25rem)]",
                l.i === sel ? "ring-2 ring-foreground/40" : "",
              )}
              style={{
                background: COLORS[l.kind],
                borderColor: "transparent",
                color: "white",
                opacity: l.kind === kind ? 1 : 0.4,
              }}
            >
              {l.i}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.mm }} />
            dense, 3× modality-specific
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.moe }} />
            MoE, shared attention
          </span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: COLORS[kind] }}>
            layer {sel} — {d.name}
          </div>
          <div className="mt-2 space-y-0.5">
            {d.rows.map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
                <span className="w-56 shrink-0 truncate text-muted-foreground">{k}</span>
                <span className="text-foreground">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t pt-2 text-sm leading-6 text-muted-foreground">{d.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The layout says something about what Sand AI thinks each part of the stack is for. Mixing the three
          modalities is treated as an entrance-and-exit problem — four dense layers with private weights per
          modality, two at each end. Everything in between runs one shared attention over all of it and spends its
          capacity on routed experts instead. Dense where the modalities are still separate, sparse where they are
          already fused.
        </p>
      </div>
    </figure>
  )
}
