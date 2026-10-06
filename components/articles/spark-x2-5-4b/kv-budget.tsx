"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What "1M context on a 16 GB laptop" costs, from Spark-X2.5-4B's config.json.
// Only the 9 full-attention layers keep a cache that grows with the context;
// the 27 sliding-window layers keep at most 512 positions each. Per token, per
// full layer: K and V, 4 KV heads x 256 dims. Byte widths: bf16 = 2,
// llama.cpp q8_0 = 34 bytes per 32 values, q4_0 = 18 bytes per 32 values.
// Weight sizes are the GGUF files in XHToken/Spark-X2.5-4B-GGUF, in GiB.
// This is a lower bound: compute buffers and the runtime itself are extra.

const GIB = 1024 * 1024 * 1024
const FULL_LAYERS = 9
const SWA_LAYERS = 27
const ALL_LAYERS = 36
const WINDOW = 512
const KV_HEADS = 4
const HEAD_DIM = 256

const KV_TYPES = [
  { id: "bf16", label: "bf16 cache", bytes: 2 },
  { id: "q8_0", label: "q8_0 cache", bytes: 34 / 32 },
  { id: "q4_0", label: "q4_0 cache", bytes: 18 / 32 },
] as const

const WEIGHTS = [
  { id: "q4", label: "Q4_K_M", gib: 2600224352 / GIB },
  { id: "q8", label: "Q8_0", gib: 4375021152 / GIB },
  { id: "bf16", label: "BF16", gib: 8229920352 / GIB },
] as const

// Context stops on a power-of-two ladder, 4K to 1M.
const CTX = [4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]

const RAM = 16
const RESERVED = 4

const C_WEIGHTS = "oklch(0.62 0.12 250)"
const C_GLOBAL = "oklch(0.64 0.17 40)"
const C_SWA = "oklch(0.72 0.12 140)"
const C_RES = "oklch(0.70 0.02 250)"

function fmtCtx(n: number) {
  return n >= 1048576 ? `${n / 1048576}M` : `${n / 1024}K`
}

function fmtGiB(x: number) {
  return x >= 10 ? x.toFixed(1) : x.toFixed(2)
}

export function KvBudget() {
  const [ci, setCi] = useState(CTX.length - 1)
  const [kv, setKv] = useState<(typeof KV_TYPES)[number]["id"]>("bf16")
  const [wq, setWq] = useState<(typeof WEIGHTS)[number]["id"]>("q4")

  const ctx = CTX[ci]
  const kvb = KV_TYPES.find((k) => k.id === kv)!.bytes
  const w = WEIGHTS.find((x) => x.id === wq)!.gib

  const perLayerToken = 2 * KV_HEADS * HEAD_DIM * kvb
  const global = (FULL_LAYERS * perLayerToken * ctx) / GIB
  const swa = (SWA_LAYERS * perLayerToken * Math.min(ctx, WINDOW)) / GIB
  const allGlobal = (ALL_LAYERS * perLayerToken * ctx) / GIB
  const total = RESERVED + w + global + swa
  const fits = total <= RAM

  const scale = Math.max(RAM, total)
  const seg = (v: number) => `${((v / scale) * 100).toFixed(2)}%`

  const chip = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Spark-X2.5-4B · memory at a given context</span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[10px] text-white"
          style={{ background: fits ? C_SWA : C_GLOBAL }}
        >
          {fits ? "fits in 16 GiB" : "does not fit in 16 GiB"}
        </span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div>
          <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length</span>
            <span className="tabular-nums text-foreground">
              {fmtCtx(ctx)} tokens ({ctx.toLocaleString("en-US")})
            </span>
          </div>
          <Range
            min={0}
            max={CTX.length - 1}
            step={1}
            value={ci}
            onChange={(e) => setCi(Number(e.target.value))}
            aria-label="Context length"
            className="w-full"
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 font-mono text-[10px] text-muted-foreground">weights</span>
            {WEIGHTS.map((x) => (
              <button key={x.id} type="button" onClick={() => setWq(x.id)} className={chip(wq === x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 font-mono text-[10px] text-muted-foreground">KV</span>
            {KV_TYPES.map((x) => (
              <button key={x.id} type="button" onClick={() => setKv(x.id)} className={chip(kv === x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="relative h-7 w-full overflow-hidden rounded-md border bg-muted/20">
            <div className="absolute inset-y-0 left-0 flex" style={{ width: "100%" }}>
              <div style={{ width: seg(RESERVED), background: C_RES }} title="OS and apps" />
              <div style={{ width: seg(w), background: C_WEIGHTS }} title="weights" />
              <div style={{ width: seg(swa), background: C_SWA }} title="sliding-window cache" />
              <div style={{ width: seg(global), background: C_GLOBAL }} title="full-attention cache" />
            </div>
            <div
              className="absolute inset-y-0 border-l-2 border-dashed border-foreground/70"
              style={{ left: seg(RAM) }}
              aria-hidden
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>0</span>
            <span className="tabular-nums">dashed line = 16 GiB · bar = {fmtGiB(total)} GiB</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            { k: "OS + apps (assumed)", v: RESERVED, c: C_RES },
            { k: "weights", v: w, c: C_WEIGHTS },
            { k: "27 sliding layers", v: swa, c: C_SWA },
            { k: "9 full layers", v: global, c: C_GLOBAL },
          ].map((r) => (
            <div key={r.k} className="rounded-lg border bg-muted/15 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.c }} />
                {r.k}
              </div>
              <div className="mt-0.5 tabular-nums text-foreground">{fmtGiB(r.v)} GiB</div>
            </div>
          ))}
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The sliding-window layers stop growing at 512 tokens, so past a few thousand tokens almost all of the cache is
          the nine full-attention layers. If all 36 layers were full attention, this cache would be{" "}
          <span className="tabular-nums text-foreground">{fmtGiB(allGlobal)} GiB</span>{" "}instead of{" "}
          <span className="tabular-nums text-foreground">{fmtGiB(global + swa)} GiB</span>. The hybrid layout is a real
          4x saving. It still does not make a million bf16 tokens fit in a laptop: only a 4-bit cache gets near, and a
          lossy cache is a quality trade the card does not measure.
        </p>
      </div>
    </figure>
  )
}
