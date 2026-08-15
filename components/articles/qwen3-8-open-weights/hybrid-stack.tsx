"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The layer mix, and the thing it is supposed to buy you.
//
// full_attention_interval is 4: three Gated DeltaNet layers, then one gated
// softmax-attention layer, repeated. Only the softmax layers hold a per-token KV
// cache. The DeltaNet layers hold a fixed-size recurrent state that does not grow
// with context at all.
//
// So the KV bill should scale with the 23 (or 16) softmax layers, not with all 92
// (or 64). Whether your runtime actually allocates it that way is a separate
// question, and the numbers below let you check.

type M = {
  id: string
  label: string
  L: number
  nFull: number
  nkv: number
  hd: number
  lv: number
  lhd: number
}

const MODELS: M[] = [
  { id: "max", label: "Qwen3.8-2.4T-A95B", L: 92, nFull: 23, nkv: 4, hd: 256, lv: 128, lhd: 128 },
  { id: "b27", label: "Qwen3.8-27B", L: 64, nFull: 16, nkv: 4, hd: 256, lv: 48, lhd: 128 },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"

export function HybridStack() {
  const [sel, setSel] = useState(1)
  const [ctxK, setCtxK] = useState(32)
  const m = MODELS[sel]

  const ctx = ctxK * 1024
  // K and V, per head, 2 bytes each.
  const perLayerPerTok = 2 * m.nkv * m.hd * 2
  const honest = m.nFull * perLayerPerTok
  const naive = m.L * perLayerPerTok
  // The recurrent state is per-sequence and constant in context length.
  const stateBytes = (m.L - m.nFull) * m.lv * m.lhd * m.lhd * 4

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">full_attention_interval: 4</span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          {m.nFull} of {m.L} layers keep a KV cache
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === sel ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-[3px]">
          {Array.from({ length: m.L }, (_, i) => {
            const full = (i + 1) % 4 === 0
            return (
              <span
                key={i}
                title={`layer ${i} — ${full ? "gated attention" : "Gated DeltaNet"}`}
                className="h-5 w-[7px] rounded-[2px]"
                style={{ background: full ? ACCENT : WARM, opacity: full ? 1 : 0.45 }}
              />
            )
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: WARM, opacity: 0.45 }} />
            Gated DeltaNet — fixed recurrent state
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />
            gated attention — per-token KV
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">context</span>
          <Range min={4} max={256} step={4} value={ctxK} onChange={(e) => setCtxK(Number(e.target.value))} className="flex-1" aria-label="context length in K tokens" accent={ACCENT} />
          <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{ctxK}K</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              KV for the {m.nFull} attention layers
            </div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              {((honest * ctx) / 1e9).toFixed(2)} GB
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">{honest / 1024} KB per token</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              if all {m.L} layers are allocated
            </div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {((naive * ctx) / 1e9).toFixed(2)} GB
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">{naive / 1024} KB per token — exactly 4×</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              DeltaNet recurrent state
            </div>
            <div className="font-mono text-sm tabular-nums text-foreground">{(stateBytes / 1e9).toFixed(2)} GB</div>
            <div className="font-mono text-[9px] text-muted-foreground">per sequence, flat in context</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The recurrent state is the whole argument for the hybrid: it costs{" "}
          <span className="text-foreground">{(stateBytes / 1e9).toFixed(2)} GB and then stops growing</span>, while the
          KV cache grows linearly forever. At 256K the attention layers alone want{" "}
          {((honest * 262144) / 1e9).toFixed(1)} GB; three quarters of the stack contributes nothing to that.
          {m.id === "b27" ? (
            <>
              {" "}
              Worth checking against your runtime, though. The most careful GGUF publisher for this model quotes{" "}
              <span className="text-foreground">256 KB per token</span>, which is not the 64 KB the sixteen attention
              layers require — it is precisely what you get when all sixty-four layers are given a cache. Whether that
              is a llama.cpp allocation detail or a deliberate margin, the ratio is exactly the hybrid interval, and
              the difference is 1.6 GB at 8K.
            </>
          ) : null}
        </p>
      </div>
    </figure>
  )
}
