"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { LAYERS, N_EXPERTS, P, TOP_K, TOTAL, type LayerType } from "./data"

// Where the 33.7 B parameters sit, and which of them a decoded token touches.
// All sizes are sums of tensor shapes in the checkpoint's safetensors header (measured). "Per token" counts
// the weights one decoded token multiplies by at batch size 1: six of 128 routed experts in each of the 23 MoE
// layers, every other layer weight, and the output head. The embedding table is a lookup, not a multiply.

const B = (n: number) => n / 1e9

type Row = { id: string; label: string; n: number; token: number; color: string; note: string }

const C = {
  routed: "oklch(0.62 0.15 150)",
  mamba: "oklch(0.58 0.15 255)",
  attn: "oklch(0.70 0.15 70)",
  shared: "oklch(0.66 0.12 180)",
  head: "oklch(0.60 0.10 300)",
  enc: "oklch(0.60 0.16 25)",
  other: "oklch(0.60 0.02 260)",
}

const ROWS: Row[] = [
  { id: "routed", label: "routed experts", n: P.routed, token: (P.routed * TOP_K) / N_EXPERTS, color: C.routed, note: "23 layers x 128 experts; a token uses 6 per layer" },
  { id: "mamba", label: "Mamba-2 mixers", n: P.mamba, token: P.mamba, color: C.mamba, note: "23 layers, all read every token" },
  { id: "shared", label: "shared experts", n: P.shared, token: P.shared, color: C.shared, note: "one per MoE layer, always on" },
  { id: "attn", label: "attention layers", n: P.attention, token: P.attention, color: C.attn, note: "6 layers, grouped-query, 2 KV heads" },
  { id: "router", label: "routers", n: P.router, token: P.router, color: C.other, note: "128 scores per MoE layer" },
  { id: "lm", label: "output head", n: P.lmHead, token: P.lmHead, color: C.head, note: "131,072 x 2,688" },
  { id: "emb", label: "embedding table", n: P.embed, token: 0, color: C.head, note: "a lookup: one row per token" },
  { id: "mtp", label: "MTP drafter", n: P.mtp, token: 0, color: C.other, note: "idle unless drafting; one attention + one MoE block" },
  { id: "asr", label: "ASR encoder", n: P.asr, token: 0, color: C.enc, note: "32 layers, d=1,280; runs once per audio frame, not per text token" },
  { id: "diar", label: "diarization encoder", n: P.diar, token: 0, color: C.enc, note: "31 layers, d=512, frozen" },
  { id: "ctc", label: "CTC timestamp head", n: P.ctc, token: 0, color: C.enc, note: "after generation only" },
  { id: "rest", label: "projection, other", n: P.proj + P.other, token: 0, color: C.other, note: "1,280 to 2,688 projection" },
]

const LAYER_COLOR: Record<LayerType, string> = { mamba: C.mamba, moe: C.routed, attention: C.attn }
const LAYER_NAME: Record<LayerType, string> = { mamba: "Mamba-2", moe: "MoE feed-forward", attention: "attention (GQA)" }

type Mode = "stored" | "token" | "claim"

export function ParamLedger() {
  const [mode, setMode] = useState<Mode>("stored")
  const [hover, setHover] = useState<number | null>(null)

  const rows = ROWS.map((r) => ({ ...r, v: mode === "stored" ? r.n : r.token }))
  const sum = rows.reduce((a, r) => a + r.v, 0)
  const max = Math.max(...rows.map((r) => r.v))
  const backbone = ROWS.filter((r) => ["routed", "mamba", "shared", "attn", "router", "lm"].includes(r.id)).reduce((a, r) => a + r.token, 0)
  const encoders = P.asr + P.diar + P.ctc
  const perLayerType = (t: LayerType) =>
    t === "mamba" ? P.mamba / 23 : t === "attention" ? P.attention / 6 : (P.routed + P.shared + P.router) / 23

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the ledger · every size is a sum of tensor shapes from the safetensors header (measured)
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {(
          [
            ["stored", "stored in the file"],
            ["token", "read per decoded token"],
            ["claim", "the model card's 4.3 B"],
          ] as [Mode, string][]
        ).map(([id, t]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              mode === id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {mode === "claim" ? (
        <div className="grid gap-4 px-4 py-4 font-mono text-xs md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-muted-foreground">the card says</div>
            <div>language backbone: ~3.5 B active (of ~31.6 B)</div>
            <div>audio encoder + diarizer + adapter: ~0.8 B</div>
            <div className="text-base">total: ~4.3 B active</div>
          </div>
          <div className="space-y-2">
            <div className="text-muted-foreground">what the header sums to</div>
            <div>
              backbone layers + output head, 6 of 128 experts: <span className="tabular-nums">{B(backbone).toFixed(3)} B</span>
            </div>
            <div>
              plus the embedding table the card appears to count: <span className="tabular-nums">{B(backbone + P.embed).toFixed(3)} B</span>
            </div>
            <div>
              backbone stored, with both tables: <span className="tabular-nums">{B(TOTAL - P.mtp - encoders - P.proj - P.other).toFixed(3)} B</span> (the card: ~31.6 B)
            </div>
            <div>
              encoders + CTC head: <span className="tabular-nums">{B(encoders).toFixed(3)} B</span> (the card: ~0.8 B)
            </div>
            <div className="text-base">
              total active: <span className="tabular-nums">{B(backbone + P.embed + encoders).toFixed(2)} B</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1 px-4 py-3">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[9.5rem_1fr_4.5rem] items-center gap-2 font-mono text-[11px]">
              <span className="truncate text-muted-foreground" title={r.note}>
                {r.label}
              </span>
              <div className="h-3 overflow-hidden rounded bg-muted" role="img" aria-label={`${r.label}: ${B(r.v).toFixed(3)} billion parameters. ${r.note}.`}>
                <div className="h-full" style={{ width: `${max > 0 ? Math.max(r.v > 0 ? 0.6 : 0, (r.v / max) * 100).toFixed(2) : 0}%`, background: r.color }} />
              </div>
              <span className="text-right tabular-nums">{B(r.v).toFixed(3)} B</span>
            </div>
          ))}
          <div className="grid grid-cols-[9.5rem_1fr_4.5rem] gap-2 border-t pt-1 font-mono text-[11px]">
            <span>{mode === "stored" ? "total stored" : "multiplied per token"}</span>
            <span />
            <span className="text-right tabular-nums">{B(sum).toFixed(3)} B</span>
          </div>
        </div>
      )}

      <div className="border-t px-4 py-3">
        <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
          the 52 backbone layers, in order · hover or tab to a layer
        </div>
        <div className="flex gap-[2px]" role="list" aria-label="Backbone layers in order">
          {LAYERS.map((t, i) => (
            <button
              key={i}
              type="button"
              role="listitem"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`Layer ${i + 1}: ${LAYER_NAME[t]}, ${(perLayerType(t) / 1e6).toFixed(1)} million parameters`}
              className={cn("h-7 flex-1 rounded-[2px] outline-offset-2", hover === i && "ring-2 ring-foreground/60")}
              style={{ background: LAYER_COLOR[t] }}
            />
          ))}
        </div>
        <div className="mt-1.5 min-h-4 font-mono text-[11px] text-muted-foreground">
          {hover === null
            ? "23 Mamba-2, 23 MoE, 6 attention; attention is under 12% of the layers"
            : `layer ${hover + 1}: ${LAYER_NAME[LAYERS[hover]]} · ${(perLayerType(LAYERS[hover]) / 1e6).toFixed(1)} M parameters stored`}
        </div>
      </div>
    </figure>
  )
}
