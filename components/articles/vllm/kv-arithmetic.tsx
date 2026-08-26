"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The PagedAttention paper's argument, done as arithmetic instead of prose.
//
// Where the byte figures come from, in the clone at 17da485:
//
//   vllm/v1/kv_cache_interface.py:410
//     unpadded_page_size_bytes = num_heads * num_states * state_content_size_bytes
//   vllm/v1/kv_cache_interface.py:406
//     state_content_size_bytes = (head_size + head_size_v) * dtype_size
//   vllm/v1/core/kv_cache_utils.py:1284  _get_kv_cache_bytes_per_block
//     bytes_per_block = sum(page_size_bytes for each layer in the group)
//   vllm/v1/core/kv_cache_utils.py:1362
//     num_blocks = available_memory // bytes_per_block
//   vllm/config/cache.py:79
//     DEFAULT_BLOCK_SIZE = 16
//
// So one block id costs, across the whole model:
//
//   layers * block_size * kv_heads * 2 * head_dim * dtype_bytes
//
// Model shapes are read from each model's config.json on HuggingFace
// (num_hidden_layers, num_key_value_heads, head_dim or hidden_size/heads,
// torch_dtype). Llama 3.1 8B via the ungated NousResearch mirror.
//
// The two strategies compared are exactly the paper's Figure 3: a contiguous
// allocator must reserve the request's worst case up front (reservation waste),
// while a paged allocator wastes at most block_size - 1 tokens at the tail
// (internal fragmentation).

const LIVE = "oklch(0.55 0.16 155)"
const INTERNAL = "oklch(0.68 0.13 85)"
const RESERVED = "oklch(0.58 0.19 27)"
const IDLE = "oklch(0.62 0.03 250)"

const BLOCK = 16
const GIB = 1024 * 1024 * 1024

type Model = {
  k: string
  label: string
  layers: number
  kvHeads: number
  headDim: number
  bytes: number
  maxLen: number
}

const MODELS: Model[] = [
  { k: "l8", label: "Llama-3.1-8B", layers: 32, kvHeads: 8, headDim: 128, bytes: 2, maxLen: 131072 },
  { k: "q8", label: "Qwen3-8B", layers: 36, kvHeads: 8, headDim: 128, bytes: 2, maxLen: 40960 },
  { k: "q32", label: "Qwen3-32B", layers: 64, kvHeads: 8, headDim: 128, bytes: 2, maxLen: 40960 },
]

const fmtBytes = (b: number) => {
  if (b >= GIB) return `${(b / GIB).toFixed(1)} GiB`
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MiB`
  return `${(b / 1024).toFixed(0)} KiB`
}
const fmtInt = (n: number) => n.toLocaleString("en-US")

export function KvArithmetic() {
  const [mk, setMk] = useState("l8")
  const [poolGiB, setPoolGiB] = useState(60)
  const [seqLen, setSeqLen] = useState(1000)
  const [reserve, setReserve] = useState(8192)

  const m = MODELS.find((x) => x.k === mk)!
  const perToken = m.layers * m.kvHeads * 2 * m.headDim * m.bytes
  const perBlock = perToken * BLOCK
  const pool = poolGiB * GIB

  const L = seqLen
  const R = Math.max(reserve, L)

  // Paged: ceil(L / 16) blocks, the tail block is partly empty.
  const blocksPerSeq = Math.ceil(L / BLOCK)
  const pagedBytes = blocksPerSeq * perBlock
  const nPaged = Math.floor(pool / pagedBytes)

  // Contiguous: the request reserves its worst case up front.
  const contBytes = R * perToken
  const nCont = Math.floor(pool / contBytes)

  type Seg = { k: string; label: string; colour: string; bytes: number }

  const pagedSegs: Seg[] = [
    { k: "live", label: "token state", colour: LIVE, bytes: nPaged * L * perToken },
    {
      k: "int",
      label: "internal frag.",
      colour: INTERNAL,
      bytes: nPaged * (blocksPerSeq * BLOCK - L) * perToken,
    },
  ]
  pagedSegs.push({
    k: "idle",
    label: "unallocated",
    colour: IDLE,
    bytes: pool - pagedSegs[0].bytes - pagedSegs[1].bytes,
  })

  const contSegs: Seg[] = [
    { k: "live", label: "token state", colour: LIVE, bytes: nCont * L * perToken },
    { k: "res", label: "reservation", colour: RESERVED, bytes: nCont * (R - L) * perToken },
  ]
  contSegs.push({
    k: "idle",
    label: "unallocated",
    colour: IDLE,
    bytes: pool - contSegs[0].bytes - contSegs[1].bytes,
  })

  const W = 700
  const X0 = 112
  const BAR = 434
  const H = 152

  const bar = (segs: Seg[], y: number, left: string, count: number) => {
    let x = X0
    const rects: ReactNode[] = []
    const labels: ReactNode[] = []
    segs.forEach((s) => {
      const w = pool > 0 ? (Math.max(s.bytes, 0) / pool) * BAR : 0
      rects.push(
        <rect
          key={s.k}
          x={x}
          y={y}
          width={Math.max(w, 0)}
          height={26}
          fill={s.colour}
          fillOpacity={s.k === "idle" ? 0.16 : 0.8}
        />,
      )
      if (w >= 44) {
        labels.push(
          <text
            key={s.k}
            x={x + w / 2}
            y={y + 40}
            fontSize={9}
            textAnchor="middle"
            fill={s.colour}
            fontFamily="ui-monospace, monospace"
          >
            {`${((s.bytes / pool) * 100).toFixed(1)}%`}
          </text>,
        )
      }
      x += w
    })
    return (
      <g>
        <text
          x={X0 - 10}
          y={y + 17}
          fontSize={9.5}
          textAnchor="end"
          fill="currentColor"
          fillOpacity={0.75}
          fontFamily="ui-monospace, monospace"
        >
          {left}
        </text>
        {rects}
        <rect
          x={X0}
          y={y}
          width={BAR}
          height={26}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
        />
        <text
          x={X0 + BAR + 10}
          y={y + 17}
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.85}
          fontFamily="ui-monospace, monospace"
        >
          {`${fmtInt(count)} seqs`}
        </text>
        {labels}
      </g>
    )
  }

  const ratio = nCont > 0 ? nPaged / nCont : 0
  const verdict =
    nCont === 0
      ? "a contiguous allocator fits nothing at all"
      : ratio >= 1.05
        ? `${ratio.toFixed(1)}x more concurrent sequences`
        : "no advantage at this reservation"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {fmtBytes(perToken)}/token · {fmtBytes(perBlock)} per 16-token block
        </span>
        <span className="font-mono text-[10px]" style={{ color: LIVE }}>
          {verdict}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => {
                setMk(x.k)
                setReserve((r) => Math.min(r, x.maxLen))
              }}
              aria-pressed={mk === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mk === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
          <span className="self-center font-mono text-[10px] text-muted-foreground">
            {m.layers}L · {m.kvHeads} kv heads · {m.headDim} head dim · bf16
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`${poolGiB} GiB of KV cache for ${m.label}. A contiguous allocator reserving ${fmtInt(
                R,
              )} tokens per request fits ${fmtInt(nCont)} sequences of ${fmtInt(
                L,
              )} tokens; 16-token paged blocks fit ${fmtInt(nPaged)}.`}
            </title>
            <text
              x={X0}
              y={14}
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.45}
              fontFamily="ui-monospace, monospace"
            >
              {`${poolGiB} GiB KV cache pool · ${fmtInt(L)}-token requests`}
            </text>
            {bar(contSegs, 26, "contiguous", nCont)}
            {bar(pagedSegs, 96, "paged · 16", nPaged)}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ["token state", LIVE],
              ["internal fragmentation", INTERNAL],
              ["reservation", RESERVED],
              ["unallocated", IDLE],
            ] as const
          ).map(([label, colour]) => (
            <span key={label} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: colour, opacity: label === "unallocated" ? 0.3 : 0.8 }}
              />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["KV pool", poolGiB, setPoolGiB, 4, 140, 4, IDLE, "gigabytes of GPU memory given to the KV cache"],
              ["sequence", seqLen, setSeqLen, 100, 16000, 100, LIVE, "actual tokens each request ends up using"],
              ["reservation", reserve, setReserve, 1024, m.maxLen, 1024, RESERVED, "tokens a contiguous allocator must reserve up front"],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={Math.min(v, hi)}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {label === "KV pool" ? `${v} Gi` : fmtInt(Math.min(v, hi))}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This is the whole PagedAttention argument as arithmetic. One block id costs{" "}
          <code>layers x 16 x kv_heads x 2 x head_dim x dtype_bytes</code> — for {m.label} that is{" "}
          <span className="text-foreground">{fmtBytes(perBlock)}</span>, and a token costs{" "}
          <span className="text-foreground">{fmtBytes(perToken)}</span>. vLLM divides the profiled
          free memory by that block cost and gets a fixed pool of block ids (
          <code>kv_cache_utils.py:1362</code>).
          <br />
          <br />
          An allocator that needs one contiguous run per request has to reserve the worst case it
          might reach, so the{" "}
          <span style={{ color: RESERVED }}>reservation</span> is dead memory for the whole life of
          the request. A paged allocator hands out one block at a time and wastes at most fifteen
          tokens in the tail block —{" "}
          <span style={{ color: INTERNAL }}>internal fragmentation</span> — which is bounded, not
          proportional.
          <br />
          <br />
          <span className="text-foreground">
            The win is entirely a function of how wrong the reservation is.
          </span>{" "}
          Drag the reservation down to the sequence length and paging buys nothing. Drag it to the
          model&rsquo;s advertised context window — which is what a naive allocator has to assume,
          because nobody tells the server how long the answer will be — and it buys an order of
          magnitude. That gap is why every serving engine is paged now.
        </p>
      </div>
    </figure>
  )
}
