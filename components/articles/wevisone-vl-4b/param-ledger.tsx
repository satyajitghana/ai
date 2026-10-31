"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import {
  BASE_PARAMS,
  DECODER_MODULES,
  DECODER_TOTAL,
  MODEL_PARAMS,
  NEW_ROWS_COST,
  SAFETENSORS_TOTAL,
  UNTIE_COST,
  fmt,
} from "./data"

type View = "model" | "decoder" | "delta"

const VIEWS: { id: View; label: string }[] = [
  { id: "model", label: "whole model" },
  { id: "decoder", label: "the 9.6M decoder" },
  { id: "delta", label: "vs Qwen3-VL-4B" },
]

function Bars({ rows, total }: { rows: { id: string; label: string; n: number; note?: string }[]; total: number }) {
  const top = Math.max(...rows.map((r) => r.n))
  return (
    <div className="space-y-1.5 px-4 py-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[10.5rem_1fr_5.5rem_3.2rem] items-center gap-2 font-mono text-[11px]"
          title={r.note}
        >
          <span className="truncate">{r.label}</span>
          <div className="h-2.5 overflow-hidden rounded bg-muted">
            <div className="h-full" style={{ width: `${Math.max(0.6, (r.n / top) * 100).toFixed(1)}%`, background: "oklch(0.62 0.14 250)" }} />
          </div>
          <span className="text-right tabular-nums">{fmt(r.n)}</span>
          <span className="text-right tabular-nums text-muted-foreground">{((r.n / total) * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export function ParamLedger() {
  const [view, setView] = useState<View>("model")
  const modelRows = [...MODEL_PARAMS].sort((a, b) => b.n - a.n)
  const decRows = [...DECODER_MODULES].sort((a, b) => b.n - a.n)
  const grew = SAFETENSORS_TOTAL - BASE_PARAMS
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        where the parameters are · counted from the safetensors header and the decoder&apos;s tensor table
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              view === v.id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] tabular-nums">
          {view === "model" ? fmt(SAFETENSORS_TOTAL) : view === "decoder" ? fmt(DECODER_TOTAL) : `+${fmt(grew)}`}
        </span>
      </div>

      {view === "model" && <Bars rows={modelRows} total={SAFETENSORS_TOTAL} />}
      {view === "decoder" && <Bars rows={decRows.map((r) => ({ ...r }))} total={DECODER_TOTAL} />}
      {view === "delta" && (
        <div className="space-y-2 px-4 py-3 font-mono text-[11px]">
          <div className="grid grid-cols-[1fr_auto] gap-x-4">
            <span>Qwen3-VL-4B-Instruct (tied embeddings, 151,936 rows)</span>
            <span className="text-right tabular-nums">{fmt(BASE_PARAMS)}</span>
            <span>+ a separate lm_head: 151,936 x 2,560</span>
            <span className="text-right tabular-nums">+{fmt(UNTIE_COST)}</span>
            <span>+ 744 new vocabulary rows, in both matrices: 744 x 2,560 x 2</span>
            <span className="text-right tabular-nums">+{fmt(NEW_ROWS_COST)}</span>
            <span className="border-t pt-1 font-semibold">WeVisOne-VL-4B safetensors</span>
            <span className="border-t pt-1 text-right font-semibold tabular-nums">{fmt(BASE_PARAMS + UNTIE_COST + NEW_ROWS_COST)}</span>
          </div>
          <p className="text-muted-foreground">
            The two lines add to {fmt(grew)}, the exact gap between the two headers. Every transformer and ViT tensor has the same shape as in
            Qwen3-VL-4B.
          </p>
        </div>
      )}

      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        {view === "model"
          ? "The decoder is not in this file: mask_decoder.pt holds another 9,609,764 values in fp32."
          : view === "decoder"
            ? "The refinement that produces the alpha matte at three scales is 441,123 of them, 4.6%."
            : "The released 4B is bigger than its base only because the output head was untied and the vocabulary grew."}
      </p>
    </figure>
  )
}
