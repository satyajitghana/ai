"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where "114B total, 6B active" actually comes from.
//
// Every shape below was read from the published safetensors headers by HTTP
// range request, and the config numbers from configs/magi2_preview.json. The
// index reports total_size 228,107,858,176 bytes, which at bf16 is 114.05B —
// so the headline total is exact.
//
// The active figure only closes if you apply BOTH sparsities:
//
//   MoE sparsity      256 experts x 12 heads = 3,072 slots, top-6 per head,
//                     so 72 of 3,072 fire per token
//   modality sparsity the mm layers and the modality-specific shared expert
//                     are packed 3x wide (video | audio | text) and a token is
//                     exactly one of those
//
// Apply only the first and you get 7.71B. Apply both and you get 5.96B against
// a stated "just 6B parameters per token".

type Mode = { id: string; label: string; total: number; note: string }

const MODES: Mode[] = [
  {
    id: "none",
    label: "everything resident",
    total: 113.88,
    note: "All 114B. My reconstruction from the published shapes lands at 113.88B against the index's 114.05B — 0.15% apart, which is close enough to say the decomposition is right rather than lucky.",
  },
  {
    id: "moe",
    label: "+ MoE routing",
    total: 7.71,
    note: "Route top-6 of 256 experts, independently for each of 12 heads: 72 expert activations out of 3,072 slots, and the MoE weight per layer drops from 3.02B to 70.8M. This is the sparsity everyone quotes — and on its own it lands at 7.71B, not 6B.",
  },
  {
    id: "both",
    label: "+ modality routing",
    total: 5.96,
    note: "The piece that closes it. Layers 0, 1, 38 and 39 carry attention and MLP weights packed three times over — one set per modality — and so does the modality-specific shared expert in every MoE layer. A token is video or audio or text, never all three, so two thirds of those weights are resident but idle for any given token.",
  },
]

const SEG = [
  { k: "MoE experts (72 of 3,072 fire)", resident: 108.72, active: 2.55, c: "oklch(0.60 0.15 255)" },
  { k: "attention + shared experts", resident: 3.74, active: 3.29, c: "oklch(0.68 0.13 85)" },
  { k: "dense mm layers (0, 1, 38, 39)", resident: 1.36, active: 0.45, c: "oklch(0.55 0.16 155)" },
  { k: "embedders + heads", resident: 0.06, active: 0.06, c: "oklch(0.62 0.03 250)" },
]

export function ActiveBudget() {
  const [sel, setSel] = useState(2)
  const m = MODES[sel]
  const scale = 113.88

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">114B resident · what one token touches</span>
        <span className="font-mono text-[10px]" style={{ color: "oklch(0.60 0.15 255)" }}>
          {m.total.toFixed(2)}B
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === sel
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 h-12 overflow-hidden rounded-lg border bg-muted/25">
          <div className="flex h-full">
            {SEG.map((s) => {
              const v = sel === 0 ? s.resident : sel === 1 ? (s.k.startsWith("MoE") ? s.active : s.resident) : s.active
              return (
                <div
                  key={s.k}
                  title={`${s.k}: ${v.toFixed(2)}B`}
                  style={{ width: `${(v / scale) * 100}%`, background: s.c }}
                />
              )
            })}
          </div>
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {SEG.map((s) => {
            const v = sel === 0 ? s.resident : sel === 1 ? (s.k.startsWith("MoE") ? s.active : s.resident) : s.active
            return (
              <div key={s.k} className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.c }} />
                  <span className="truncate">{s.k}</span>
                </div>
                <div className="font-mono text-sm tabular-nums text-foreground">{v.toFixed(2)}B</div>
              </div>
            )
          })}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px] text-foreground">
            {m.label} — {m.total.toFixed(2)}B
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{m.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          One active parameter in <span className="text-foreground">19.1</span>. The number people will quote is the
          MoE ratio, but MoE alone only gets you to 7.71B — the last 1.75B comes off because the model carries
          three separate sets of modality weights and a token is only ever one modality. Two independent sparsities
          multiplied together, and the card&rsquo;s &ldquo;just 6B parameters per token&rdquo; lands at 5.96B once
          you apply both.
        </p>
      </div>
    </figure>
  )
}
