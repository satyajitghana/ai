"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What quark keeps in memory per sequence, layer by layer. Every width is from
// empero-ai/Quark-150M-128K-Zero config.json and modeling_quark.py:
//   global layers (3, 7, 11, 15 zero-indexed): 4 KV heads x 64, full causal, cache grows with context
//   local layers (the other 12): 12 KV heads x 64 (num_local_key_value_heads), window 256, so the
//     cache keeps the last 255 tokens; plus a conv state of 3 x 768 values (kernel 4)
// Bytes are bf16 (2 per value), as in the report's estimate.
// Parameter counts per layer are summed from the safetensors header (range-read, 165,254,528 total).
// The blend weight is the mean over 768 channels of sigmoid(mixer.mix), range-read from the same
// file: the per-channel weight the local mixer puts on sliding-window attention (the rest goes to
// the convolution). It is a weight, not a measured share of the output.

const BYTES = 2
const HD = 64
const GLOBAL_KV = 4
const LOCAL_KV = 12
const KEEP = 255
const CONV = 3 * 768

const GLOBAL_PER_TOKEN = 2 * GLOBAL_KV * HD * BYTES // 1,024 bytes per layer per token
const LOCAL_PER_TOKEN = 2 * LOCAL_KV * HD * BYTES // 3,072

const LAYERS = Array.from({ length: 16 }, (_, i) => i)
const isGlobal = (i: number) => i % 4 === 3

const PARAMS: Record<number, number> = {
  0: 9444236, 1: 9564188, 2: 9564188, 3: 6334640, 4: 9564188, 5: 9564188, 6: 9564188, 7: 6334640,
  8: 9564188, 9: 9564188, 10: 9564188, 11: 6334640, 12: 9564188, 13: 9564188, 14: 9564188, 15: 6334640,
}
const BLEND: Record<number, number> = {
  0: 0.079, 1: 0.826, 2: 0.285, 4: 0.808, 5: 0.812, 6: 0.793,
  8: 0.858, 9: 0.832, 10: 0.796, 12: 0.775, 13: 0.823, 14: 0.755,
}

const CONTEXTS = [2048, 8192, 32768, 65536, 131072]
const ctxLabel = (n: number) => `${n / 1024}K`

type Layout = "built" | "global4" | "globalOwn"
const LAYOUTS: { id: Layout; text: string; blurb: string }[] = [
  { id: "built", text: "as built", blurb: "4 global layers grow; 12 local layers keep a 255-token window and a conv state." },
  {
    id: "global4",
    text: "every layer global, 4 KV heads",
    blurb: "The comparison the report makes: all 16 layers shaped like quark's global ones.",
  },
  {
    id: "globalOwn",
    text: "every layer global, own heads",
    blurb: "The local layers keep their 12 KV heads but lose the window: what removing the window alone would cost.",
  },
]

function layerBytes(i: number, n: number, layout: Layout): number {
  if (layout === "global4") return GLOBAL_PER_TOKEN * n
  if (isGlobal(i)) return GLOBAL_PER_TOKEN * n
  if (layout === "globalOwn") return LOCAL_PER_TOKEN * n
  return LOCAL_PER_TOKEN * Math.min(n, KEEP) + CONV * BYTES
}

const fmt = (b: number) => {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  return `${(b / 1e3).toFixed(1)} KB`
}

export function CacheLedger() {
  const [ci, setCi] = useState(CONTEXTS.length - 1)
  const [layout, setLayout] = useState<Layout>("built")
  const [sel, setSel] = useState(3)

  const n = CONTEXTS[ci]
  const per = LAYERS.map((i) => layerBytes(i, n, layout))
  const total = per.reduce((s, b) => s + b, 0)
  const maxTotal = 16 * LOCAL_PER_TOKEN * n // the largest any layout reaches at this context
  const scale = Math.max(...per, 1)
  const built = LAYERS.reduce((s, i) => s + layerBytes(i, n, "built"), 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>quark · what each layer keeps</span>
        <span className="text-muted-foreground/60">config.json + safetensors header</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Layer layout">
          <span className="w-full font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:w-20">layout</span>
          {LAYOUTS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setLayout(o.id)}
              aria-pressed={layout === o.id}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                layout === o.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.text}
            </button>
          ))}
        </div>

        <div>
          <div className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>context</span>
            <span className="text-foreground">{ctxLabel(n)} tokens</span>
          </div>
          <Range
            min={0}
            max={CONTEXTS.length - 1}
            value={ci}
            onChange={(e) => setCi(Number(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="Context length"
          />
        </div>

        <div className="grid grid-cols-8 gap-1 sm:grid-cols-16" role="group" aria-label="Layers">
          {LAYERS.map((i) => {
            const g = isGlobal(i)
            const h = Math.max(4, (per[i] / scale) * 64)
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={sel === i}
                aria-label={`Layer ${i + 1}, ${g ? "global" : "local"}, ${fmt(per[i])}`}
                className={cn(
                  "flex h-24 flex-col items-center justify-end rounded-md border p-1",
                  sel === i ? "border-foreground" : "border-border hover:border-foreground/50",
                )}
              >
                <span
                  className="w-full rounded-sm"
                  style={{
                    height: `${h.toFixed(1)}px`,
                    background: g || layout !== "built" ? "oklch(0.55 0.17 285)" : "oklch(0.78 0.08 285)",
                  }}
                />
                <span className="mt-1 font-mono text-[10px] text-muted-foreground">{i + 1}</span>
              </button>
            )
          })}
        </div>

        <div className="rounded-lg border p-3 font-mono text-xs leading-6">
          <div className="flex flex-wrap justify-between gap-2">
            <span>
              layer {sel + 1}: {isGlobal(sel) ? "global, full causal GQA, 4 KV heads" : "local, sliding window + short conv, 12 KV heads"}
            </span>
            <span className="font-semibold">{fmt(per[sel])}</span>
          </div>
          <div className="text-muted-foreground">
            {PARAMS[sel].toLocaleString("en-US")} parameters
            {isGlobal(sel)
              ? ". No convolution, a narrower KV projection (512 rows against 1,536), so a third fewer parameters than a local layer."
              : `. Weight on attention in the blend: ${BLEND[sel].toFixed(3)} (the convolution gets the rest).`}
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>cache for one sequence, bf16</span>
            <span className="font-semibold">{fmt(total)}</span>
          </div>
          <div className="h-6 w-full overflow-hidden rounded-md border bg-muted/30">
            <div className="h-full" style={{ width: `${((total / maxTotal) * 100).toFixed(2)}%`, background: "oklch(0.55 0.17 285)" }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {LAYOUTS.find((l) => l.id === layout)?.blurb}{" "}
            {layout === "built"
              ? `The four global layers hold ${fmt(4 * GLOBAL_PER_TOKEN * n)} of it.`
              : `That is ${(total / built).toFixed(1)}x the layout as built.`}
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Arithmetic on config.json, not a measurement: keys and values at 2 bytes, no allocator overhead, no activations. The bar is scaled
        to the largest layout at the chosen context. Blend weights are means over 768 channels of the trained gate, read from the 128K-Zero
        weights.
      </figcaption>
    </figure>
  )
}
