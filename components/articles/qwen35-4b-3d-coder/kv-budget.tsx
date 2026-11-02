"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2, mpow } from "@/lib/dmath"

import { KV } from "./data"

// What the context costs in memory. The layer layout (32 layers, one in four full attention, four KV heads of
// width 256) is config.json; the arithmetic is mine. Only the eight full-attention layers keep a key and a value
// for every past token. The 24 linear-attention layers keep one fixed-size state matrix each, so the cache
// grows with a quarter of the layers a plain transformer of this depth would need. REASONED, not profiled: I did
// not run the model, and the state shape is the gated delta-rule layout of Qwen3-Next, assumed to carry over.

const MARKS = [
  { t: 16384, label: "16,384", note: "the LoRA stage's cap on example length" },
  { t: 29001, label: "29,001", note: "the mean example, measured" },
  { t: 65536, label: "65,536", note: "context in the report's evaluation" },
  { t: 71229, label: "71,229", note: "longest training sequence, reported" },
  { t: 262144, label: "262,144", note: "max_position_embeddings in config.json" },
] as const

const LO = 11 // 2^11 = 2,048
const HI = 18 // 2^18 = 262,144
const GIB = 1024 * 1024 * 1024
const MIB = 1024 * 1024

const kvPerToken = (layers: number) => 2 * layers * KV.kvHeads * KV.headDim * KV.bytes

const C_HYB = "oklch(0.62 0.15 150)"
const C_ALL = "oklch(0.62 0.16 35)"

export function KvBudget() {
  const [p, setP] = useState(mlog2(65536))
  const ctx = Math.round(mpow(2, p))
  const hyb = ctx * kvPerToken(KV.fullLayers)
  const all = ctx * kvPerToken(KV.layers)
  const state = KV.linearLayers * KV.stateBytesPerLayer
  const weights = 9078531072
  const scale = 12 * GIB
  const bar = (b: number) => `${Math.min(100, (b / scale) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          KV cache · F16 · 4 KV heads x 256 · reasoned from config.json
        </span>
        <span className="font-mono text-xs tabular-nums">{ctx.toLocaleString("en-US")} tokens</span>
      </div>
      <div className="space-y-4 p-4">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-20 shrink-0 font-mono text-muted-foreground">context</span>
          <Range
            min={LO}
            max={HI}
            step={0.01}
            value={p}
            accent={C_HYB}
            onChange={(e) => setP(Number(e.target.value))}
            aria-label="Context length, log scale"
            className="w-full"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MARKS.map((m) => (
            <button
              key={m.t}
              type="button"
              onClick={() => setP(mlog2(m.t))}
              title={m.note}
              className="rounded-md border bg-background px-2 py-1 font-mono text-[11px] hover:bg-muted"
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 font-mono text-xs">
          <div>
            <div className="mb-1 flex justify-between">
              <span>as built: 8 full-attention layers</span>
              <span className="tabular-nums">{(hyb / GIB).toFixed(2)} GiB</span>
            </div>
            <div className="h-3 overflow-hidden rounded bg-muted" role="img" aria-label={`${(hyb / GIB).toFixed(2)} GiB of KV cache`}>
              <div className="h-full" style={{ width: bar(hyb), background: C_HYB }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between">
              <span>if all 32 layers kept a KV cache</span>
              <span className="tabular-nums">{(all / GIB).toFixed(2)} GiB</span>
            </div>
            <div className="h-3 overflow-hidden rounded bg-muted" role="img" aria-label={`${(all / GIB).toFixed(2)} GiB of KV cache`}>
              <div className="h-full" style={{ width: bar(all), background: C_ALL }} />
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <div><dt className="text-muted-foreground">per token, as built</dt><dd className="tabular-nums">{(kvPerToken(KV.fullLayers) / 1024).toFixed(0)} KiB</dd></div>
          <div><dt className="text-muted-foreground">fixed linear state</dt><dd className="tabular-nums">{(state / MIB).toFixed(0)} MiB</dd></div>
          <div><dt className="text-muted-foreground">FP16 weights</dt><dd className="tabular-nums">{(weights / GIB).toFixed(2)} GiB</dd></div>
          <div><dt className="text-muted-foreground">saved by the hybrid</dt><dd className="tabular-nums">{((all - hyb) / GIB).toFixed(2)} GiB</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Bars are drawn against 12 GiB. At the evaluation&apos;s 65,536 tokens the cache is 2.00 GiB as built and 8.00 GiB
          if every layer kept one. The weights are 9,078,531,072 bytes, from the index file&apos;s metadata.
        </p>
      </div>
    </figure>
  )
}
