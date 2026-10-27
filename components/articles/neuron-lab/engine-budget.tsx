"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { DOWNLOAD_MB, KV_BYTES_PER_TOKEN, WEIGHTS_MB } from "./data"

// Memory the in-browser engine needs. Weights: the engine's own figure for the unpacked Q8_0 tensors (680 MB).
// KV cache: 28 layers x (K 8 heads x 128 + V 8 x 128) x 4 bytes = 229,376 bytes per token per sequence, in the
// engine's float32 layout (Qwen3-0.6B config; the engine allocates it as a sequence grows, not up front).
// The three-column comparison decodes three sequences together, so its cache is three times one.

const MB = 1e6
const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1))

export function EngineBudget() {
  const [tokens, setTokens] = useState(300)
  const [streams, setStreams] = useState(3)
  const kv = (tokens * KV_BYTES_PER_TOKEN * streams) / MB
  const total = WEIGHTS_MB + kv
  const parts = [
    { label: "weights (Q8_0, unpacked)", v: WEIGHTS_MB, color: "oklch(0.6 0.05 255)" },
    { label: `KV cache (${streams} sequence${streams > 1 ? "s" : ""})`, v: kv, color: "oklch(0.65 0.16 55)" },
  ]
  const scale = Math.max(total, 1800)
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what the engine holds in memory (arithmetic on the engine&apos;s own layout)
      </div>
      <div className="space-y-3 px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">context tokens</span>
          <Range className="w-full" min={50} max={2048} step={10} value={tokens} onChange={(e) => setTokens(+e.target.value)} aria-label="Context length in tokens" />
          <span className="w-16 shrink-0 text-right font-mono tabular-nums">{tokens}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">sequences</span>
          <Range className="w-full" min={1} max={4} step={1} value={streams} onChange={(e) => setStreams(+e.target.value)} aria-label="Sequences decoded together" />
          <span className="w-16 shrink-0 text-right font-mono tabular-nums">{streams}</span>
        </label>
        <div className="space-y-1.5" role="img" aria-label={`${fmt(total)} megabytes in all: ${WEIGHTS_MB} for weights and ${fmt(kv)} for the key-value cache.`}>
          <div className="flex h-4 w-full overflow-hidden rounded bg-muted">
            {parts.map((p) => (
              <div key={p.label} style={{ width: `${((p.v / scale) * 100).toFixed(2)}%`, background: p.color }} title={`${p.label}: ${fmt(p.v)} MB`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {parts.map((p) => (
              <span key={p.label}>
                <i className="mr-1 inline-block h-2 w-2 rounded-sm align-baseline" style={{ background: p.color }} />
                {p.label}: <span className="font-mono tabular-nums text-foreground">{fmt(p.v)} MB</span>
              </span>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">download on first use</dt>
          <dd className="text-right font-mono tabular-nums">{DOWNLOAD_MB} MB</dd>
          <dt className="text-muted-foreground">KV cache per token, per sequence</dt>
          <dd className="text-right font-mono tabular-nums">{KV_BYTES_PER_TOKEN.toLocaleString("en-US")} bytes</dd>
          <dt className="text-muted-foreground">total held by the engine</dt>
          <dd className="text-right font-mono tabular-nums">{fmt(total)} MB</dd>
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          Browsers do not publish how much memory a tab may use, so no device is named here. The weights are a fixed cost; the cache grows with the text, and the three-column comparison pays for three sequences at once.
        </p>
      </div>
    </figure>
  )
}
