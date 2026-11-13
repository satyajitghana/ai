"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How long a conversation costs in positions and in cache, from the configs.
// Haru: one position per 133 ms frame (7.5 Hz); 8 of its 32 layers are full
// attention with 4 KV heads of 256 dims, so each position stores
// 8 x 2 x 4 x 256 bf16 values = 32,768 bytes; the 24 Gated DeltaNet layers keep
// a fixed state instead (32 value heads x 128 x 128 in float32 per layer).
// The comparison rows change one thing each: the same backbone with every layer
// full attention, the same streams interleaved one token per position, and
// Moshi's 12.5 Hz temporal steps with its 3,000-step attention ring.

const KV_PER_POS = 8 * 2 * 4 * 256 * 2 // bytes
const DELTA_STATE = 24 * 32 * 128 * 128 * 4 // bytes, constant
const ACCENT = "oklch(0.64 0.17 300)"

function group(n: number) {
  const s = String(Math.round(n))
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function bytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`
  return `${Math.round(b / 1e6)} MB`
}

type Row = { name: string; sub: string; pos: number; mem: number | null; memNote: string; hl?: boolean }

export function ContextBudget() {
  const [min, setMin] = useState(10)
  const frames = min * 60 * 7.5

  const rows: Row[] = [
    {
      name: "Haru-4B",
      sub: "3 streams summed, 7.5 Hz, 8 of 32 layers full attention",
      pos: frames,
      mem: frames * KV_PER_POS + DELTA_STATE,
      memNote: "KV of 8 layers + fixed DeltaNet state",
      hl: true,
    },
    {
      name: "same, all 32 layers full",
      sub: "what the hybrid backbone saves",
      pos: frames,
      mem: frames * KV_PER_POS * 4,
      memNote: "KV of 32 layers",
    },
    {
      name: "same streams, interleaved",
      sub: "user, text, model as 3 positions per frame",
      pos: frames * 3,
      mem: frames * 3 * KV_PER_POS + DELTA_STATE,
      memNote: "3x the positions to attend over",
    },
    {
      name: "Moshi",
      sub: "12.5 Hz temporal steps, 3,000-step ring",
      pos: min * 60 * 12.5,
      mem: null,
      memNote: min * 60 * 12.5 > 3000 ? "past 240 s, the oldest frames fall out of its ring" : "inside its 240 s ring",
    },
  ]
  const maxPos = Math.max(...rows.map((r) => r.pos))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what a long call costs the model</span>
        <span className="font-mono text-[10px] text-muted-foreground">arithmetic on config.json and the safetensors header</span>
      </div>
      <div className="p-3 sm:p-4">
        <label className="block font-mono text-[11px] text-muted-foreground">
          <span className="flex justify-between">
            <span>conversation length</span>
            <span className="text-foreground">{min} min</span>
          </span>
          <Range min={1} max={60} step={1} value={min} accent={ACCENT} onChange={(e) => setMin(Number(e.target.value))} aria-label="conversation length in minutes" className="mt-1 w-full" />
        </label>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.name} className="rounded-md border bg-muted/10 p-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-mono text-[12px]" style={r.hl ? { color: ACCENT } : undefined}>
                  {r.name}
                </span>
                <span className="font-mono text-[11px] text-foreground">
                  {group(r.pos)} positions{r.mem !== null ? `, ${bytes(r.mem)}` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-sm bg-muted/30">
                <div className="h-full rounded-sm" style={{ width: `${(r.pos / maxPos) * 100}%`, background: r.hl ? ACCENT : "oklch(0.6 0.03 260)" }} />
              </div>
              <div className="mt-1 flex flex-wrap justify-between gap-x-3 font-mono text-[10px] text-muted-foreground">
                <span>{r.sub}</span>
                <span>{r.memNote}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        Cache sizes are bf16 keys and values for the full-attention layers, plus the DeltaNet recurrent state at the float32 the
        config names (about 50 MB, the same at minute one and minute sixty). Weights, activations and the prompt are not counted.
        Moshi&apos;s cache size is left out because I did not read its attention layout for this piece; its ring length is from its
        loader config.
      </figcaption>
    </figure>
  )
}
