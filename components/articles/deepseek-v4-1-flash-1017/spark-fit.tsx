"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// Does DeepSeek-V4.1-Flash-1017 fit on N DGX Sparks? Every byte count is
// measured from the 48 safetensors headers of deepseek-ai/DeepSeek-V4.1-Flash-1017
// (HTTP range requests, no weights downloaded). Shipped formats: routed experts
// FP4 (E2M1) + one E8M0 scale per 32 weights = 4.25 bits; the rest FP8 or BF16.
// The 890 bytes of global KV cache per token is DeepSeek's figure (reported).
// 121.7 GiB usable per Spark is a community figure (reported); the reserve
// and the bandwidth ceilings are my arithmetic (reasoned). + - * / only.

const GB = 1e9
const GIB = 1073741824

const ROUTED_PARAMS = 543.582e9 // 40 layers x 384 experts x 3 x 2304 x 5120
const ACTIVE_ROUTED_PARAMS = (ROUTED_PARAMS * 6) / 384 // top-6 of 384
const DENSE_BYTES = 7.199e9 // attention, shared experts, routers, mHC, norms, Engram projections
const EMBED_HEAD_BYTES = 2.648e9 // BF16 embedding + LM head
const HEAD_BYTES = 1.324e9
const VISION_BYTES = 0.971e9
const DRAFT_BYTES = 7.933e9 // 3 DSpark/MTP layers, 128 experts each
const ENGRAM_BYTES = 202.758e9 // two FP8 n-gram tables + scales
const KV_PER_TOKEN = 890

const SPARK_GB = 273 // LPDDR5x per box, GB/s
const USABLE_GIB = 121.7
const RESERVE_GIB = 6

const BITS = [
  { v: 4.25, label: "4.25 shipped" },
  { v: 3.5, label: "3.5" },
  { v: 3.0, label: "3.0" },
  { v: 2.77, label: "2.77" },
  { v: 2.5, label: "2.5" },
]
const COUNTS = [1, 2, 4]
const CTX = [32768, 131072, 262144, 1048576]

function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-0.5 font-mono text-[11px]",
        on ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}

export function SparkFit() {
  const [n, setN] = useState(2)
  const [bits, setBits] = useState(4.25)
  const [engramDisk, setEngramDisk] = useState(false)
  const [draft, setDraft] = useState(true)
  const [ctx, setCtx] = useState(262144)

  const experts = (ROUTED_PARAMS * bits) / 8
  const engram = engramDisk ? 0 : ENGRAM_BYTES
  const drafts = draft ? DRAFT_BYTES : 0
  const kv = ctx * KV_PER_TOKEN
  const parts = [
    { k: "routed experts", b: experts, c: "oklch(0.55 0.16 260)" },
    { k: "Engram tables", b: engram, c: "oklch(0.65 0.14 75)" },
    { k: "dense + embed/head + vision", b: DENSE_BYTES + EMBED_HEAD_BYTES + VISION_BYTES, c: "oklch(0.6 0.13 160)" },
    { k: "DSpark drafter", b: drafts, c: "oklch(0.62 0.12 320)" },
    { k: "KV cache", b: kv, c: "oklch(0.6 0.17 30)" },
  ]
  const need = parts.reduce((s, p) => s + p.b, 0)
  const cap = n * (USABLE_GIB - RESERVE_GIB) * GIB
  const fits = need <= cap
  const scale = Math.max(need, cap)

  const perToken = (ACTIVE_ROUTED_PARAMS * bits) / 8 + DENSE_BYTES + HEAD_BYTES
  const pipe = (SPARK_GB * GB) / perToken
  const tp = (n * SPARK_GB * GB) / perToken

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        V4.1-Flash-1017 on DGX Sparks · bytes from the safetensors headers · ceilings are arithmetic
      </div>

      <div className="space-y-2 border-b px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-32 shrink-0 font-mono text-muted-foreground">Sparks</span>
          {COUNTS.map((c) => (
            <Btn key={c} on={n === c} onClick={() => setN(c)}>
              {c}
            </Btn>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-32 shrink-0 font-mono text-muted-foreground">expert bits/weight</span>
          {BITS.map((b) => (
            <Btn key={b.v} on={bits === b.v} onClick={() => setBits(b.v)}>
              {b.label}
            </Btn>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-32 shrink-0 font-mono text-muted-foreground">Engram tables</span>
          <Btn on={!engramDisk} onClick={() => setEngramDisk(false)}>
            in memory
          </Btn>
          <Btn on={engramDisk} onClick={() => setEngramDisk(true)}>
            on NVMe
          </Btn>
          <span className="ml-2 font-mono text-muted-foreground">drafter</span>
          <Btn on={draft} onClick={() => setDraft(true)}>
            on
          </Btn>
          <Btn on={!draft} onClick={() => setDraft(false)}>
            off
          </Btn>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-32 shrink-0 font-mono text-muted-foreground">context, one stream</span>
          {CTX.map((c) => (
            <Btn key={c} on={ctx === c} onClick={() => setCtx(c)}>
              {c >= 1048576 ? "1M" : `${c / 1024}K`}
            </Btn>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 text-xs">
        <div>
          <div className="mb-1 flex justify-between font-mono">
            <span>resident</span>
            <span className={cn("tabular-nums", fits ? "" : "text-red-600 dark:text-red-400")}>
              {(need / GB).toFixed(1)} GB of {(cap / GB).toFixed(1)} GB · {fits ? "fits" : "does not fit"}
            </span>
          </div>
          <div className="relative flex h-4 overflow-hidden rounded-sm bg-muted">
            {parts.map((p) =>
              p.b > 0 ? (
                <div
                  key={p.k}
                  title={`${p.k}: ${(p.b / GB).toFixed(1)} GB`}
                  style={{ width: `${((p.b / scale) * 100).toFixed(2)}%`, background: p.c }}
                />
              ) : null
            )}
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground"
              style={{ left: `${((cap / scale) * 100).toFixed(2)}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {parts.map((p) => (
              <span key={p.k} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.c }} />
                {p.k} {(p.b / GB).toFixed(1)} GB
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-1 font-mono sm:grid-cols-3">
          <div className="rounded bg-muted px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">read per decoded token</div>
            <div className="tabular-nums">{(perToken / GB).toFixed(2)} GB</div>
          </div>
          <div className="rounded bg-muted px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">ceiling, layers split across boxes</div>
            <div className="tabular-nums">{pipe.toFixed(1)} tok/s</div>
          </div>
          <div className="rounded bg-muted px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">ceiling, tensor parallel x{n}</div>
            <div className="tabular-nums">{tp.toFixed(1)} tok/s</div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Capacity is {USABLE_GIB} GiB usable per Spark less a {RESERVE_GIB} GiB reserve for activations and
        CUDA graphs. Ceilings assume every byte read at the full {SPARK_GB} GB/s, one stream, no
        speculative decoding and a free interconnect; real batch-1 decode lands well under them, and
        DSpark drafting can land above the plain ceiling because one verify pass accepts several tokens.
        With the tables on NVMe a token reads 48 rows of 264 bytes from them, about 12.7 KB.
      </figcaption>
    </figure>
  )
}
