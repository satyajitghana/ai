"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Maple-Preview claims ternary weights. You can check that from the published
// checkpoint without downloading it: read a shard's safetensors header for the
// tensor offsets, range-request one row, and count distinct values. Every row
// measured came back with exactly three — {-s, 0, +s} — with s varying per row.
// Numbers below are the measured values, not illustrations.

const TERN = "oklch(0.60 0.15 255)"
const FULL = "oklch(0.62 0.03 250)"

type Row = { tensor: string; row: number; s: number; zeros: number }

const ROWS: Row[] = [
  { tensor: "layers.0.mlp.experts.0.gate_proj", row: 0, s: 0.02417, zeros: 38.6 },
  { tensor: "layers.0.mlp.experts.0.gate_proj", row: 1, s: 0.025146, zeros: 38.5 },
  { tensor: "layers.0.mlp.experts.0.gate_proj", row: 2, s: 0.024048, zeros: 39.7 },
  { tensor: "layers.23.mlp.experts.100.down_proj", row: 0, s: 0.031982, zeros: 39.8 },
  { tensor: "layers.23.mlp.experts.100.down_proj", row: 2, s: 0.036865, zeros: 41.2 },
  { tensor: "layers.0.self_attn.q_proj", row: 0, s: 0.036377, zeros: 38.4 },
  { tensor: "layers.0.self_attn.q_proj", row: 3, s: 0.024414, zeros: 39.4 },
  { tensor: "layers.3.self_attn.o_proj", row: 1, s: 0.050537, zeros: 42.3 },
  { tensor: "layers.3.self_attn.o_proj", row: 3, s: 0.051514, zeros: 40.3 },
]

const CENSUS = [
  { name: "expert down_proj", params: 6_442_450_944, tern: true },
  { name: "expert gate_proj", params: 6_442_450_944, tern: true },
  { name: "expert up_proj", params: 6_442_450_944, tern: true },
  { name: "attention q/k/v/o_proj", params: 251_658_240, tern: true },
  { name: "lm_head", params: 311_164_928, tern: false },
  { name: "word_embeddings", params: 311_164_928, tern: false },
  { name: "MoE routers", params: 12_582_912, tern: false },
  { name: "norms", params: 104_448, tern: false },
]

const TOTAL = CENSUS.reduce((a, c) => a + c.params, 0)
const TERN_P = CENSUS.filter((c) => c.tern).reduce((a, c) => a + c.params, 0)

const B = (n: number) => `${(n / 1e9).toFixed(2)}B`

export function TernaryProbe() {
  const [tab, setTab] = useState<"rows" | "census">("rows")

  const chip = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">is it actually ternary?</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("rows")} className={chip(tab === "rows")}>
            measured rows
          </button>
          <button type="button" onClick={() => setTab("census")} className={chip(tab === "census")}>
            what is ternary
          </button>
        </div>
      </div>

      {tab === "rows" ? (
        <div className="p-3 sm:p-4">
          <div className="mb-2 grid grid-cols-[minmax(0,15rem)_auto_1fr_auto] gap-x-3 px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>tensor</span>
            <span>row</span>
            <span>distinct values</span>
            <span>zeros</span>
          </div>
          <div className="space-y-0.5">
            {ROWS.map((r) => (
              <div
                key={`${r.tensor}-${r.row}`}
                className="grid grid-cols-[minmax(0,15rem)_auto_1fr_auto] items-center gap-x-3 rounded-lg border bg-muted/15 px-2 py-1.5"
              >
                <span className="truncate font-mono text-[10px] text-muted-foreground">{r.tensor}</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{r.row}</span>
                <span className="font-mono text-[11px] tabular-nums" style={{ color: TERN }}>
                  &minus;{r.s.toFixed(6)} · 0 · +{r.s.toFixed(6)}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{r.zeros}%</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Three values per row, every time, perfectly symmetric about zero, with the scale{" "}
            <span className="font-mono text-foreground">s</span>{" "}changing from one row to the next. That is ternary
            with a <span className="text-foreground">per-output-channel scale</span>: each weight is one of
            &minus;1, 0, +1 multiplied by its row&rsquo;s own constant. Roughly two weights in five are exactly zero,
            which is what absmean ternarization does to a Gaussian. The claim is not just marketing — it is legible
            in the published bytes.
          </p>
        </div>
      ) : (
        <div className="p-3 sm:p-4">
          <div className="space-y-1">
            {CENSUS.map((c) => (
              <div
                key={c.name}
                className="grid grid-cols-[minmax(0,12rem)_1fr_auto_auto] items-center gap-x-3 rounded-lg border bg-muted/15 px-3 py-1.5"
              >
                <span className="truncate font-mono text-[11px] text-foreground">{c.name}</span>
                <div className="h-2 rounded-sm bg-muted/40">
                  <div
                    className="h-2 rounded-sm"
                    style={{ width: `${Math.max((c.params / TOTAL) * 100, 0.4)}%`, background: c.tern ? TERN : FULL }}
                  />
                </div>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{B(c.params)}</span>
                <span
                  className="w-fit rounded-full px-2 py-0.5 font-mono text-[9px] text-white"
                  style={{ background: c.tern ? TERN : FULL }}
                >
                  {c.tern ? "ternary" : "full"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            <span className="text-foreground">{B(TERN_P)} of {B(TOTAL)}</span>{" "}parameters — 96.9% — are ternary.
            Everything the model needs at full precision is small and predictable: the two embedding tables, the MoE
            routers, and the norms. Leaving the router alone is the pointed choice. A router picks 8 experts out of
            256 from a margin between logits, and crushing that margin to three levels would scramble which expert
            fires long before it degraded any individual expert&rsquo;s arithmetic.
          </p>
        </div>
      )}
    </figure>
  )
}
