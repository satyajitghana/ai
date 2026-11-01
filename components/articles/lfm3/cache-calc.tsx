"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2, mpow } from "@/lib/dmath"

import { CONV_STATE_BYTES, KV_BYTES_PER_TOKEN, LAYERS, WINDOW } from "./data"

// What the model has to remember per sequence, by context length. Arithmetic on the config (reasoned): bf16 keys and
// values for 4 key-value heads of 128 dimensions, 2,048 bytes per token per attention layer. LFM3 has 6 full-attention
// layers, 5 windowed and 13 convolution layers. The comparison is a hypothetical stack of 24 full-attention layers
// with the same key-value shape.

const MIB = 1024 * 1024
const N_FULL = LAYERS.filter((k) => k === "full").length
const N_WIN = LAYERS.filter((k) => k === "slide").length
const N_CONV = LAYERS.filter((k) => k === "conv").length

const C_FULL = "oklch(0.62 0.17 35)"
const C_WIN = "oklch(0.68 0.14 85)"
const C_CONV = "oklch(0.66 0.13 200)"
const C_REF = "oklch(0.6 0.02 260)"

const PRESETS = [4096, 32768, 131072, 262144]

function ctxFromT(t: number) {
  return Math.round(mpow(2, 8 + (t / 1000) * 10))
}

const fmtCtx = (n: number) => (n >= 1024 ? `${(n / 1024).toLocaleString("en-US", { maximumFractionDigits: 1 })}K` : String(n))
const fmtMiB = (b: number) => (b / MIB >= 100 ? (b / MIB).toFixed(0) : (b / MIB).toFixed(1))

export function CacheCalc() {
  const [t, setT] = useState(1000)
  const n = ctxFromT(t)
  const full = N_FULL * KV_BYTES_PER_TOKEN * n
  const win = N_WIN * KV_BYTES_PER_TOKEN * Math.min(n, WINDOW)
  const conv = N_CONV * CONV_STATE_BYTES
  const lfm = full + win + conv
  const ref = LAYERS.length * KV_BYTES_PER_TOKEN * n
  const w = (b: number) => `${Math.max(0.4, (b / ref) * 100)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">per-sequence cache, bf16 · arithmetic on config.json</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Context length presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setT(Math.round(((mlog2(p) - 8) / 10) * 1000))}
              aria-pressed={n === p}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${n === p ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {fmtCtx(p)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <label className="space-y-2 text-sm">
          <span className="flex items-center justify-between gap-3">
            <span>context length</span>
            <span className="font-mono">{n.toLocaleString("en-US")} tokens</span>
          </span>
          <Range min={0} max={1000} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="Context length in tokens, log scale" accent={C_FULL} />
        </label>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between font-mono text-xs">
              <span>LFM3-1.7B: 6 full + 5 window + 13 conv</span>
              <span>{fmtMiB(lfm)} MiB</span>
            </div>
            <div className="flex h-5 overflow-hidden rounded-md border" role="img" aria-label={`LFM3 cache ${fmtMiB(lfm)} MiB`}>
              <div style={{ width: w(full), background: C_FULL }} title={`full attention ${fmtMiB(full)} MiB`} />
              <div style={{ width: w(win), background: C_WIN }} title={`window ${fmtMiB(win)} MiB`} />
              <div style={{ width: w(conv), background: C_CONV }} title={`conv ${fmtMiB(conv)} MiB`} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-xs">
              <span>24 full-attention layers, same key-value shape</span>
              <span>{fmtMiB(ref)} MiB</span>
            </div>
            <div className="h-5 overflow-hidden rounded-md border" role="img" aria-label={`Full-attention stack cache ${fmtMiB(ref)} MiB`}>
              <div className="h-full" style={{ width: "100%", background: C_REF, opacity: 0.55 }} />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">full layers</dt>
            <dd className="text-sm">{fmtMiB(full)} MiB</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">window layers</dt>
            <dd className="text-sm">{fmtMiB(win)} MiB</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">conv layers</dt>
            <dd className="text-sm">{fmtMiB(conv)} MiB</dd>
          </div>
          <div className="rounded-lg border p-2">
            <dt className="text-muted-foreground">smaller by</dt>
            <dd className="text-sm">{(ref / lfm).toFixed(2)}x</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          The window layers stop growing at {WINDOW} tokens and the conv layers never grow, so past a few thousand tokens the cache is the six full layers and nothing else: a quarter of the full stack, which is what 6 of 24 predicts.
        </p>
      </div>
    </figure>
  )
}
