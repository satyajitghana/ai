"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

import { FORMATS, KV_BYTES_PER_TOKEN, MAX_CONTEXT, MHA_BYTES_PER_TOKEN, NODES } from "./data"

// Do the weights plus one sequence's cache fit? Weights: file sizes read from
// the headers (FP8) or the Hub (NVFP4); BF16 and 2-bit are arithmetic. KV: 63
// own cache layers x 576 values in FP8 plus 44 indexer key layers x 128, read
// from config.json and the headers. 0.85 is the --gpu-memory-utilization in the
// model card's own serving command.

const ACCENT = "oklch(0.62 0.16 35)"
const BLUE = "oklch(0.60 0.15 255)"
const UTIL = 0.85

const gb = (x: number) => x / 1e9
const fmtTok = (t: number) => (t >= 1e6 ? `${(t / 1e6).toFixed(2)}M` : t >= 1e3 ? `${Math.round(t / 1e3)}K` : `${t}`)

export function MemoryFit() {
  const [f, setF] = useState(1)
  const [n, setN] = useState(1)
  const [lg, setLg] = useState(20) // context = 2^lg
  const fmt = FORMATS[f]
  const node = NODES[n]
  const ctx = Math.min(MAX_CONTEXT, Math.round(mpow(2, lg)))
  const budget = node.gb * 1e9 * UTIL
  const kv = ctx * KV_BYTES_PER_TOKEN
  const mha = ctx * MHA_BYTES_PER_TOKEN
  const free = budget - fmt.bytes
  const fits = free >= kv
  const cap = Math.max(0, Math.floor(free / KV_BYTES_PER_TOKEN))
  const scale = Math.max(budget, fmt.bytes + kv) * 1.02
  const pct = (x: number) => `${Math.min(100, (x / scale) * 100)}%`
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">memory fit · weights {fmt.kind}, cache from config · nominal GPU sizes</span>
        <span className="font-mono text-xs">{fits ? "fits" : "does not fit"}</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1 font-mono text-xs" role="group" aria-label="Weight format">
          {FORMATS.map((x, i) => (
            <button key={x.id} type="button" aria-pressed={f === i} onClick={() => setF(i)} className={`rounded-md border px-2 py-1 ${f === i ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 font-mono text-xs" role="group" aria-label="Hardware">
          {NODES.map((x, i) => (
            <button key={x.id} type="button" aria-pressed={n === i} onClick={() => setN(i)} className={`rounded-md border px-2 py-1 ${n === i ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {x.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">context</span>
          <Range min={10} max={20} step={0.25} value={lg} onChange={(e) => setLg(Number(e.target.value))} aria-label="Context length" accent={ACCENT} />
          <span className="w-14 text-right tabular-nums">{fmtTok(ctx)}</span>
        </label>
        <div>
          <div className="relative h-7 overflow-hidden rounded-md bg-muted/40">
            <div className="absolute inset-y-0 left-0" style={{ width: pct(fmt.bytes), background: BLUE }} />
            <div className="absolute inset-y-0" style={{ left: pct(fmt.bytes), width: pct(kv), background: ACCENT }} />
            <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: pct(budget) }} />
          </div>
          <div className="mt-1 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <span>
              <span style={{ color: BLUE }}>&#9632;</span> weights {gb(fmt.bytes).toFixed(0)} GB
            </span>
            <span>
              <span style={{ color: ACCENT }}>&#9632;</span> cache for one sequence {gb(kv).toFixed(1)} GB
            </span>
            <span>| budget {gb(budget).toFixed(0)} GB (85% of {node.gb})</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["cache per token", `${(KV_BYTES_PER_TOKEN / 1024).toFixed(1)} KiB`],
            ["same cache as plain MHA", `${gb(mha).toFixed(0)} GB`],
            ["left after weights", free > 0 ? `${gb(free).toFixed(0)} GB` : "none"],
            ["tokens of cache that fit", free > 0 ? fmtTok(cap) : "0"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          No activations, CUDA graphs or communication buffers are counted, so a configuration that fits here by a few GB will not fit in practice.
        </p>
      </div>
    </figure>
  )
}
