"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// One sequence's recurrent memory for each released RWKV-7 G1k size, against
// the KV cache of a Qwen3 model of similar size, from 1K to 1M tokens.
//
// RWKV shapes are measured: layers, width and head count were read from the
// pickled tensor shapes inside each .pth on Hugging Face (r_k is [heads, 64]).
// Per layer the state is H x 64 x 64 WKV numbers plus two shift vectors of
// width D (one for time-mix, one for the MLP). Qwen3 shapes are from each
// model's config.json: 2 (K and V) x layers x KV heads x head_dim per token.
// "reference" is RWKV-LM's rwkv_v7_demo_rnn.py (WKV state in fp32, shifts in
// bf16); "fp16" is Albatross, which keeps the whole state in fp16. The KV
// cache is bf16 in both modes.

type Size = {
  id: string
  layers: number
  width: number
  heads: number
  params: number
  pair: string
  pLayers: number
  pKvHeads: number
  pHeadDim: number
  pMaxCtx: number
}

const SIZES: Size[] = [
  { id: "1.5B", layers: 24, width: 2048, heads: 32, params: 1527668736, pair: "Qwen3-1.7B", pLayers: 28, pKvHeads: 8, pHeadDim: 128, pMaxCtx: 40960 },
  { id: "2.9B", layers: 32, width: 2560, heads: 40, params: 2948065280, pair: "Qwen3-4B", pLayers: 36, pKvHeads: 8, pHeadDim: 128, pMaxCtx: 40960 },
  { id: "7.2B", layers: 32, width: 4096, heads: 64, params: 7199932416, pair: "Qwen3-8B", pLayers: 36, pKvHeads: 8, pHeadDim: 128, pMaxCtx: 40960 },
  { id: "13.3B", layers: 61, width: 4096, heads: 64, params: 13270298624, pair: "Qwen3-14B", pLayers: 40, pKvHeads: 8, pHeadDim: 128, pMaxCtx: 40960 },
]

const N = 64
const KI = 1024
const MI = 1024 * 1024
const GI = 1024 * 1024 * 1024

const r1 = (n: number) => Math.round(n * 10) / 10

function bytes(n: number): string {
  if (n >= GI) return `${r1(n / GI)} GiB`
  if (n >= MI) return `${r1(n / MI)} MiB`
  if (n >= KI) return `${r1(n / KI)} KiB`
  return `${n} B`
}

function count(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

function tokens(n: number): string {
  if (n >= MI) return `${r1(n / MI)}M`
  if (n >= KI) return `${r1(n / KI)}K`
  return `${n}`
}

export function StateVsCache() {
  const [si, setSi] = useState(3)
  const [tExp, setTExp] = useState(15) // context = 2^tExp tokens
  const [batch, setBatch] = useState(1)
  const [fp16, setFp16] = useState(false)

  const s = SIZES[si]
  const T = 2 ** tExp

  const wkv = s.layers * s.heads * N * N
  const shift = 2 * s.layers * s.width
  const stateNumbers = wkv + shift
  const stateBytes = fp16 ? stateNumbers * 2 : wkv * 4 + shift * 2

  const kvPerToken = 2 * s.pLayers * s.pKvHeads * s.pHeadDim
  const kvBytes = kvPerToken * 2 * T
  const weights = s.params * 2

  const crossNumbers = Math.ceil(stateNumbers / kvPerToken)
  const crossBytes = Math.ceil(stateBytes / (kvPerToken * 2))

  const rows = [
    { id: "rwkv", label: `RWKV-7 ${s.id} state`, value: stateBytes * batch, color: "oklch(0.55 0.12 250)", note: "same at every length" },
    { id: "kv", label: `${s.pair} KV cache`, value: kvBytes * batch, color: "oklch(0.62 0.17 30)", note: T > s.pMaxCtx ? `past its ${tokens(s.pMaxCtx)} native window` : "grows with every token" },
    { id: "w", label: `RWKV-7 ${s.id} weights, bf16`, value: weights, color: "oklch(0.6 0.02 260)", note: "for scale, shared by the batch" },
  ]

  const lo = mlog10(1024 * 1024)
  const hi = mlog10(Math.max(2 * 1024 * GI, ...rows.map((r) => r.value)))
  const width = (v: number) => r1(Math.max(1.5, ((mlog10(v) - lo) / (hi - lo)) * 100))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">memory carried between tokens · log scale</span>
        <div className="flex flex-wrap gap-1">
          {SIZES.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSi(i)}
              aria-pressed={i === si}
              className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                i === si ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:border-foreground/25"
              }`}
            >
              {v.id}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 font-mono text-[11px]">
                <span className="text-foreground">{r.label}</span>
                <span className="text-muted-foreground">
                  <span className="tabular-nums text-foreground">{bytes(r.value)}</span> · {r.note}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted/40">
                <div className="h-full rounded-full" style={{ width: `${width(r.value)}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>context length</span>
              <span className="tabular-nums text-foreground">{tokens(T)} tokens</span>
            </div>
            <Range min={10} max={20} step={1} value={tExp} onChange={(e) => setTExp(Number(e.target.value))} aria-label="context length" className="w-full" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>concurrent sequences</span>
              <span className="tabular-nums text-foreground">{batch}</span>
            </div>
            <Range min={1} max={64} step={1} value={batch} onChange={(e) => setBatch(Number(e.target.value))} aria-label="concurrent sequences" className="w-full" />
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input type="checkbox" checked={fp16} onChange={(e) => setFp16(e.target.checked)} />
          keep the whole state in fp16 (Albatross) instead of an fp32 WKV state (RWKV-LM reference)
        </label>

        <dl className="mt-4 grid gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">state numbers</dt>
            <dd className="tabular-nums">
              {s.layers}·{s.heads}·64·64 + 2·{s.layers}·{s.width} = {count(stateNumbers)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">KV numbers per token</dt>
            <dd className="tabular-nums">
              2·{s.pLayers}·{s.pKvHeads}·{s.pHeadDim} = {count(kvPerToken)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">equal in numbers at</dt>
            <dd className="tabular-nums">{count(crossNumbers)} tokens</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">equal in bytes at</dt>
            <dd className="tabular-nums">{count(crossBytes)} tokens</dd>
          </div>
          <div className="flex justify-between gap-2 sm:col-span-2">
            <dt className="text-muted-foreground">cache ÷ state at this length</dt>
            <dd className="tabular-nums">{r1(kvBytes / stateBytes)}x</dd>
          </div>
        </dl>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The RWKV bar does not move with the context slider; that is the whole claim. The KV bar crosses it within a
          few hundred tokens for every size, and by a million tokens a 14B-class cache is larger than the 13.3B
          model&rsquo;s own weights. What the bars do not show is what each memory can hold: the cache keeps every
          key and value exactly, the state keeps whatever the update rule decided was worth keeping.
        </p>
      </div>
    </figure>
  )
}
