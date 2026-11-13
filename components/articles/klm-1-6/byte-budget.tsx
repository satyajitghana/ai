"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where KLM-1.6's bytes go. Every count below is summed from the safetensors
// header of huggingface.co/MinimaLabs/KLM-1.6 (range-read, 51,160 bytes), whose
// tensors total 98,975,308 elements: 98,812,308 F32, 125,000 I32, 38,000 I64.
//   embed.weight                       4,160 x 512            =  2,129,920
//   n-gram tables + projections        125,001x32 + 38,001x32 + 2 x 512x32 = 5,248,832
//   18 Gated DeltaNet-2 mixers         18 x 1,842,308         = 33,161,544
//   6 attention mixers                 6 x 1,048,706          =  6,292,236
//   24 SwiGLU FFNs                     24 x 2,162,688         = 51,904,512
//   norms + attention-residual queries 24 x 1,024 + 512 + 2 x 49 x 512 = 75,264
//   n-gram keys (integers, never quantized) 125,000 x 4 + 38,000 x 8 bytes = 804,000 bytes
// Runtime state, from modeling_klm.py: an attention layer caches keys and
// values for 4 KV heads of 64 = 512 numbers per token; a Gated DeltaNet-2 layer
// keeps 4 heads of 128 x 128 = 65,536 fp32 numbers whatever the length, plus
// three short-convolution windows of 3 x 512.

const GROUPS = [
  { key: "ffn", label: "24 SwiGLU feed-forwards", n: 51_904_512, color: "oklch(0.60 0.14 255)" },
  { key: "gdn", label: "18 Gated DeltaNet-2 mixers", n: 33_161_544, color: "oklch(0.66 0.14 150)" },
  { key: "att", label: "6 attention mixers", n: 6_292_236, color: "oklch(0.70 0.15 60)" },
  { key: "ngram", label: "n-gram memory tables", n: 5_248_832, color: "oklch(0.62 0.12 20)" },
  { key: "emb", label: "embeddings (tied), 4,160 rows", n: 2_129_920, color: "oklch(0.60 0.10 300)" },
  { key: "misc", label: "norms and residual-mix queries", n: 75_264, color: "oklch(0.60 0.02 260)" },
]
const FLOATS = GROUPS.reduce((s, g) => s + g.n, 0) // 98,812,308
const KEY_BYTES = 804_000

type Prec = "fp32" | "bf16" | "int8" | "int4"
const BITS: Record<Prec, number> = { fp32: 32, bf16: 16, int8: 8, int4: 4 }
const PREC_LABEL: Record<Prec, string> = { fp32: "FP32 (the release)", bf16: "BF16", int8: "8-bit", int4: "4-bit" }

const ATT_LAYERS = 6
const GDN_LAYERS = 18
const KV_PER_TOKEN = 2 * 4 * 64 // keys + values, per attention layer
const GDN_STATE = 4 * 128 * 128 // per layer, fp32 in the reference recurrence
const CONV_STATE = 3 * 3 * 512 // q, k, v windows of 3 positions

const fmtMb = (b: number) => `${(b / 1e6).toFixed(b >= 1e8 ? 0 : 1)} MB`
const fmtInt = (n: number) => n.toLocaleString("en-US")

export function ByteBudget() {
  const [prec, setPrec] = useState<Prec>("fp32")
  const [ctx, setCtx] = useState(2048)
  const [act, setAct] = useState<4 | 2>(4)
  const [allAttn, setAllAttn] = useState(false)

  const bits = BITS[prec]
  const weights = (FLOATS * bits) / 8 + KEY_BYTES
  const attLayers = allAttn ? 24 : ATT_LAYERS
  const gdnLayers = allAttn ? 0 : GDN_LAYERS
  const kv = attLayers * KV_PER_TOKEN * ctx * act
  const state = gdnLayers * (GDN_STATE * 4 + CONV_STATE * act)
  const crossover = GDN_STATE / KV_PER_TOKEN // 128 tokens: one layer's state equals one layer's cache

  const runtimeMax = 24 * KV_PER_TOKEN * 2048 * 4
  const pctRun = (b: number) => `${((b / runtimeMax) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>KLM-1.6 · weights and running state</span>
        <span className="text-muted-foreground/60">counts from the safetensors header</span>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="weight precision">
            <span className="w-full font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:w-24">weights</span>
            {(["fp32", "bf16", "int8", "int4"] as Prec[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrec(p)}
                aria-pressed={prec === p}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-xs",
                  prec === p ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PREC_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="flex h-7 w-full overflow-hidden rounded-md border">
            {GROUPS.map((g) => (
              <div
                key={g.key}
                title={`${g.label}: ${fmtInt(g.n)} parameters`}
                style={{ width: `${((g.n / FLOATS) * 100).toFixed(3)}%`, background: g.color }}
              />
            ))}
          </div>
          <ul className="grid gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-2">
            {GROUPS.map((g) => (
              <li key={g.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />
                  {g.label}
                </span>
                <span className="tabular-nums text-muted-foreground">{fmtMb((g.n * bits) / 8)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2">
              <span className="pl-[18px]">n-gram keys, int32 and int64</span>
              <span className="tabular-nums text-muted-foreground">{fmtMb(KEY_BYTES)}</span>
            </li>
          </ul>
          <p className="font-mono text-sm">
            weights at {PREC_LABEL[prec]}: <span className="font-semibold tabular-nums">{fmtMb(weights)}</span>
            {prec === "fp32" ? null : <span className="text-muted-foreground"> (arithmetic only: no such file is published, and real quantizers add scales)</span>}
          </p>
        </div>

        <div className="space-y-3 border-t pt-4">
          <label className="block space-y-1">
            <span className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>tokens in context</span>
              <span className="tabular-nums text-foreground">{fmtInt(ctx)}</span>
            </span>
            <Range min={1} max={2048} step={1} value={ctx} onChange={(e) => setCtx(Number(e.target.value))} aria-label="context length" />
          </label>
          <div className="flex flex-wrap gap-4 font-mono text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={act === 2} onChange={(e) => setAct(e.target.checked ? 2 : 4)} />
              <span>cache in BF16 (FP32 when loaded as released)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allAttn} onChange={(e) => setAllAttn(e.target.checked)} />
              <span>what if all 24 layers were attention</span>
            </label>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between font-mono text-xs">
                <span>KV cache, {attLayers} attention layers</span>
                <span className="tabular-nums">{fmtMb(kv)}</span>
              </div>
              <div className="h-3 rounded-sm bg-muted/40">
                <div className="h-3 rounded-sm" style={{ width: pctRun(kv), background: "oklch(0.70 0.15 60)" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-mono text-xs">
                <span>recurrent state, {gdnLayers} Gated DeltaNet-2 layers</span>
                <span className="tabular-nums">{fmtMb(state)}</span>
              </div>
              <div className="h-3 rounded-sm bg-muted/40">
                <div className="h-3 rounded-sm" style={{ width: pctRun(state), background: "oklch(0.66 0.14 150)" }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            One Gated DeltaNet-2 layer holds {fmtInt(GDN_STATE)} numbers at any length; one attention layer caches{" "}
            {fmtInt(KV_PER_TOKEN)} per token, so the two are equal at {fmtInt(crossover)} tokens. Past that, every attention
            layer costs more than a recurrent one.
          </p>
        </div>
      </div>
    </figure>
  )
}
