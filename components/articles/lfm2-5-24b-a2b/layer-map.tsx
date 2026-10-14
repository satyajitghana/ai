"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// LFM2.5-24B-A2B's 40 blocks, in the order config.json's `layer_types` lists
// them, with the parameter counts I summed from the ten safetensors headers
// (HTTP range requests; no weights downloaded). Every count below is exact.
//
// The cache panel is my arithmetic on the config's dimensions, BF16 (2 bytes):
//   LFM2.5      10 attention layers x 8 KV heads x 64 dims x (K + V) x 2 B = 20,480 B/token
//               + 30 conv layers x 2,048 channels x 3 taps x 2 B = 368,640 B, fixed
//   all-GQA     the same 40 layers, every one attention          = 81,920 B/token
//   all-MHA     40 layers, 32 KV heads (no grouping)              = 327,680 B/token
//   Qwen3.6     10 full-attention layers x 2 KV heads x 256 dims x 2 x 2 B = 20,480 B/token
//               + 30 Gated DeltaNet states, 32 heads x 128 x 128, FP32 = 62,914,560 B, fixed
// Only + - * / and Math.round reach the DOM.

const TYPES: ("conv" | "attn")[] = [
  "conv", "conv", "attn", "conv", "conv", "conv", "attn", "conv", "conv", "conv",
  "attn", "conv", "conv", "conv", "attn", "conv", "conv", "conv", "attn", "conv",
  "conv", "conv", "attn", "conv", "conv", "conv", "attn", "conv", "conv", "conv",
  "attn", "conv", "conv", "conv", "attn", "conv", "conv", "conv", "attn", "conv",
]
const DENSE_LAYERS = 2

const CONV_PARAMS = 16_783_360 // in_proj 2048->6144, depthwise conv k=3, out_proj
const ATTN_PARAMS = 10_485_760 // q 2048x2048, k 512x2048, v 512x2048, o 2048x2048
const DENSE_FFN = 72_351_744 // SwiGLU, 2048 -> 11,776 -> 2048
const EXPERT = 9_437_184 // SwiGLU, 2048 -> 1,536 -> 2048
const EXPERTS = 64
const TOPK = 4
const ROUTER = 131_072 // 64 x 2048

const CONTEXTS = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072]

const SERIES = [
  { id: "LFM2.5-24B-A2B", note: "10 of 40 layers keep a cache", perTok: 20_480, fixed: 368_640, color: "#7c5cff" },
  { id: "Qwen3.6-35B-A3B", note: "10 of 40, 2 KV heads of 256", perTok: 20_480, fixed: 62_914_560, color: "#0ea5e9" },
  { id: "same 40 layers, all GQA", note: "every layer attention, 8 KV heads", perTok: 81_920, fixed: 0, color: "#94a3b8" },
  { id: "same 40 layers, all MHA", note: "no grouping, 32 KV heads", perTok: 327_680, fixed: 0, color: "#cbd5e1" },
]

const GIB = 1024 * 1024 * 1024
const fmt = (n: number) => n.toLocaleString("en-US")
const m1 = (n: number) => Math.round(n / 100_000) / 10
const g2 = (bytes: number) => Math.round((bytes / GIB) * 100) / 100

function mib(bytes: number) {
  const v = bytes / (1024 * 1024)
  return v < 10 ? Math.round(v * 100) / 100 : Math.round(v)
}

export function LayerMap() {
  const [sel, setSel] = useState(2)
  const [ci, setCi] = useState(7)
  const ctx = CONTEXTS[ci]

  const kind = TYPES[sel]
  const dense = sel < DENSE_LAYERS
  const mixer = kind === "conv" ? CONV_PARAMS : ATTN_PARAMS
  const ffnStored = dense ? DENSE_FFN : EXPERTS * EXPERT + ROUTER
  const ffnActive = dense ? DENSE_FFN : TOPK * EXPERT + ROUTER

  const totals = SERIES.map((s) => s.perTok * ctx + s.fixed)
  const worst = totals[3]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">LFM2.5-24B-A2B, block by block</span>
        <span className="font-mono text-[10px] text-muted-foreground">config.json + safetensors headers; cache sizes are my arithmetic</span>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="grid grid-cols-10 gap-1 sm:grid-cols-20" role="listbox" aria-label="the 40 blocks">
            {TYPES.map((t, i) => {
              const on = i === sel
              return (
                <button
                  key={i}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => setSel(i)}
                  className={`flex h-10 flex-col items-center justify-center rounded border font-mono text-[9px] leading-3 transition ${
                    on ? "ring-2 ring-foreground" : "opacity-85 hover:opacity-100"
                  }`}
                  style={{
                    background: t === "attn" ? "rgba(14,165,233,0.35)" : "rgba(124,92,255,0.22)",
                    borderStyle: i < DENSE_LAYERS ? "dashed" : "solid",
                  }}
                  title={`layer ${i}: ${t === "attn" ? "GQA attention" : "short conv"}, ${i < DENSE_LAYERS ? "dense FFN" : "MoE FFN"}`}
                >
                  <span>{i}</span>
                  <span className="text-muted-foreground">{t === "attn" ? "A" : "C"}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">
            C = gated short convolution (30 blocks) &middot; A = grouped-query attention (10 blocks, every
            fourth from layer 2) &middot; dashed = dense FFN (layers 0 and 1); the other 38 carry a 64-expert
            MoE. Click a block.
          </p>
        </div>

        <div className="grid gap-3 rounded-lg border bg-background/60 p-3 font-mono text-[11px] sm:grid-cols-2">
          <div>
            <div className="text-foreground">
              layer {sel}: {kind === "attn" ? "GQA attention" : "gated short conv"} + {dense ? "dense FFN" : "MoE FFN"}
            </div>
            <div className="mt-1 text-muted-foreground">
              {kind === "attn"
                ? "q 2048x2048 · k, v 512x2048 (8 KV heads of 64) · o 2048x2048 · QK-norm"
                : "in_proj 2048 -> 3x2048 (B, C, x) · y = C * conv3(B * x) · out_proj"}
            </div>
            <div className="mt-1 text-muted-foreground">
              {dense
                ? "SwiGLU 2048 -> 11,776 -> 2048, every token"
                : "64 experts, SwiGLU 2048 -> 1,536 -> 2048 · sigmoid router, top-4, bias picks only"}
            </div>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex justify-between gap-2"><span>mixer params</span><span className="text-foreground">{fmt(mixer)}</span></div>
            <div className="flex justify-between gap-2"><span>FFN params stored</span><span className="text-foreground">{fmt(ffnStored)}</span></div>
            <div className="flex justify-between gap-2"><span>FFN params run per token</span><span className="text-foreground">{fmt(ffnActive)}</span></div>
            <div className="flex justify-between gap-2"><span>cache this layer keeps</span><span className="text-foreground">{kind === "attn" ? "2,048 B per token" : "12,288 B, fixed"}</span></div>
            <div className="flex justify-between gap-2"><span>block total, stored / active</span><span className="text-foreground">{m1(mixer + ffnStored)}M / {m1(mixer + ffnActive)}M</span></div>
          </div>
        </div>

        <div>
          <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
            <span>context: {fmt(ctx)} tokens</span>
            <Range
              className="min-w-[10rem] flex-1"
              min={0}
              max={CONTEXTS.length - 1}
              step={1}
              value={ci}
              onChange={(e) => setCi(Number(e.target.value))}
              aria-label="context length"
            />
          </label>
          <div className="mt-3 space-y-2.5">
            {SERIES.map((s, k) => {
              const b = totals[k]
              return (
                <div key={s.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                    <span>
                      <span className="text-foreground">{s.id}</span> &middot; {s.note}
                    </span>
                    <span className="text-foreground">
                      {b >= GIB ? `${g2(b)} GiB` : `${mib(b)} MiB`}
                    </span>
                  </div>
                  <div className="mt-1 h-4 w-full overflow-hidden rounded bg-muted/30" aria-hidden>
                    <div className="h-full rounded" style={{ width: `${Math.max(0.6, (b / worst) * 100)}%`, background: s.color }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 font-mono text-[9px] leading-4 text-muted-foreground">
            BF16 cache for one sequence. LFM2.5 and Qwen3.6 store the same 20,480 bytes per token; they differ in
            the fixed state their non-attention layers carry (0.35 MiB of conv taps against about 60 MiB of FP32
            DeltaNet state). Making all 40 layers attention would cost four times as much; dropping grouping, sixteen.
            Weights are separate: the Q4_K_M file is 14.53 GB.
          </p>
        </div>
      </div>
    </figure>
  )
}
