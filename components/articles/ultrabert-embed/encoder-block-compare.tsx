"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Three encoders, read from their own config files: bert-base-uncased (the 2018
// shape), answerdotai/ModernBERT-base and dmis-lab/UltraBERT-Embed-150M (its
// config.json and modeling_ultrabert.py). Each row is one design choice; a row
// is flagged when the model differs from the one to its left.
// The cost meter is arithmetic on the attention pattern only: query-key score
// pairs per sequence, summed over layers, as a share of "every layer global".

type ModelId = "bert" | "modern" | "ultra"

const MODELS: { id: ModelId; name: string; year: string }[] = [
  { id: "bert", name: "BERT-base", year: "2018" },
  { id: "modern", name: "ModernBERT-base", year: "2024" },
  { id: "ultra", name: "UltraBERT-150M", year: "2026" },
]

const ROWS: { key: string; label: string; v: Record<ModelId, string> }[] = [
  { key: "pos", label: "positions", v: { bert: "learned table, 512 slots", modern: "RoPE, θ 10K local / 160K global", ultra: "RoPE, θ 10K local / 2.56M global" } },
  { key: "norm", label: "normalisation", v: { bert: "LayerNorm after each sublayer", modern: "LayerNorm before, no bias", ultra: "RMSNorm before (eps 1e-6)" } },
  { key: "mlp", label: "feed-forward", v: { bert: "GELU, 768 → 3,072 → 768", modern: "GeGLU, 2 x 1,152 wide", ultra: "SwiGLU, 2 x 1,024 wide" } },
  { key: "heads", label: "heads", v: { bert: "12 x 64", modern: "12 x 64", ultra: "6 x 128" } },
  { key: "depth", label: "depth", v: { bert: "12 layers", modern: "22 layers", ultra: "24 layers" } },
  { key: "attn", label: "attention", v: { bert: "every layer global", modern: "global every 3rd, local ±64", ultra: "global every 3rd, local ±128" } },
  { key: "ctx", label: "context", v: { bert: "512", modern: "8,192", ultra: "32,768" } },
  { key: "bias", label: "biases", v: { bert: "everywhere", modern: "none in linears", ultra: "none anywhere" } },
  { key: "vocab", label: "vocabulary", v: { bert: "30,522 WordPiece", modern: "50,368 BPE", ultra: "49,152 BPE (SmolLM2)" } },
  { key: "params", label: "parameters", v: { bert: "110M", modern: "149M", ultra: "151,032,576" } },
]

// Which layer indices are global, per model (0-based).
const LAYERS: Record<ModelId, { n: number; global: (i: number) => boolean; half: number | null }> = {
  bert: { n: 12, global: () => true, half: null },
  modern: { n: 22, global: (i) => i % 3 === 0, half: 64 },
  ultra: { n: 24, global: (i) => i % 3 === 2, half: 128 },
}

const LOCAL = "oklch(0.70 0.12 200)"
const GLOBAL = "oklch(0.64 0.17 30)"
const CHANGED = "oklch(0.72 0.15 85)"

const LENGTHS = [512, 1024, 2048, 4096, 8192, 16384, 32768]

function share(id: ModelId, L: number) {
  const { n, global, half } = LAYERS[id]
  let pairs = 0
  for (let i = 0; i < n; i++) {
    if (global(i) || half === null) pairs += L * L
    else pairs += L * Math.min(L, 2 * half + 1)
  }
  return pairs / (n * L * L)
}

function fmtLen(L: number) {
  return L >= 1024 ? `${L / 1024}K` : `${L}`
}

export function EncoderBlockCompare() {
  const [model, setModel] = useState<ModelId>("ultra")
  const [li, setLi] = useState(6)
  const L = LENGTHS[li]
  const idx = MODELS.findIndex((m) => m.id === model)
  const prev = idx > 0 ? MODELS[idx - 1].id : null
  const lay = LAYERS[model]
  const s = share(model, L)
  const maxCtx = model === "bert" ? 512 : model === "modern" ? 8192 : 32768
  const over = L > maxCtx

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one encoder layer, three generations</span>
        <span className="font-mono text-[10px] text-muted-foreground">from each model&apos;s config.json</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick an encoder">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              aria-pressed={model === m.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                model === m.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.name} <span className="opacity-60">{m.year}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 divide-y rounded-lg border">
          {ROWS.map((r) => {
            const changed = prev !== null && r.v[model] !== r.v[prev]
            return (
              <div key={r.key} className="flex items-baseline gap-3 px-3 py-1.5">
                <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">{r.label}</span>
                <span className="flex-1 font-mono text-[11px] text-foreground">{r.v[model]}</span>
                <span
                  className="w-16 shrink-0 text-right font-mono text-[9.5px]"
                  style={{ color: changed ? CHANGED : "transparent" }}
                  aria-hidden={!changed}
                >
                  {changed ? "changed" : "·"}
                </span>
              </div>
            )
          })}
        </div>
        {prev && (
          <p className="mt-1.5 font-mono text-[9.5px] text-muted-foreground">
            &quot;changed&quot; = differs from {MODELS[idx - 1].name}
          </p>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>layers, bottom to top</span>
            <span>
              <span style={{ color: GLOBAL }}>■</span> global{" "}
              <span style={{ color: LOCAL }}>■</span> local {lay.half ? `±${lay.half}` : ""}
            </span>
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: 24 }, (_, i) => {
              const exists = i < lay.n
              const g = exists && lay.global(i)
              return (
                <div
                  key={i}
                  title={exists ? `layer ${i}: ${g ? "global" : "local"}` : undefined}
                  className="h-6 flex-1 rounded-[3px]"
                  style={{ background: exists ? (g ? GLOBAL : LOCAL) : "transparent", opacity: exists ? 0.85 : 1, border: exists ? undefined : "1px dashed var(--border)" }}
                />
              )
            })}
          </div>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/15 px-3 py-2.5">
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>sequence length</span>
            <span className="tabular-nums text-foreground">{fmtLen(L)} tokens</span>
          </div>
          <Range className="mt-1.5 w-full" min={0} max={LENGTHS.length - 1} step={1} value={li} onChange={(e) => setLi(Number(e.target.value))} aria-label="Sequence length" />
          <div className="mt-2 flex items-center gap-2">
            <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
              <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(s * 100).toFixed(2)}%`, background: GLOBAL, opacity: 0.8 }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums">{(s * 100).toFixed(1)}%</span>
          </div>
          <p className="mt-1.5 font-mono text-[9.5px] leading-4 text-muted-foreground">
            attention score pairs vs. every layer global (reasoned, pattern only){over ? ` · ${MODELS[idx].name} was trained to ${fmtLen(maxCtx)}; past that it is untested` : ""}
          </p>
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        ModernBERT already did most of the modernising: rotary positions, pre-norm, a gated MLP, no
        biases, two local layers for every global one. UltraBERT keeps that skeleton and changes the
        proportions: two more layers, half as many heads at twice the width, a feed-forward barely
        wider than the residual stream, a local window twice as wide, and a global RoPE base sixteen
        times larger so 32K positions still rotate apart. At 32K tokens its attention pattern costs
        about a third of an all-global stack, because only 8 of its 24 layers look at everything.
      </p>
    </figure>
  )
}
