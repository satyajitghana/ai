"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the pi adapter's LoRA sits inside Qwen3.8-27B. Every shape here was read
// from safetensors headers by HTTP range request:
//   - harness-hub/Qwen3.8-27B-pi-adapted, adapter_model.safetensors (commit 80d05c9):
//     512 tensors, all F32, 159,383,552 parameters, on 64 MLPs and on the
//     self_attn of layers 3, 7, ..., 63 only.
//   - Qwen/Qwen3.8-27B, the shard holding layers 0-3: the shapes of the base
//     matrices, and the linear_attn modules the adapter's target names never match.
// layer_types in the base config: every fourth layer is full_attention, the other 48 linear_attention.
// The rank slider is arithmetic: a LoRA on a d_out x d_in matrix adds r * (d_in + d_out) parameters.

type Mod = { name: string; dIn: number; dOut: number; adapted: boolean; group: "mlp" | "attn" | "linear" }

const MLP: Mod[] = [
  { name: "mlp.gate_proj", dIn: 5120, dOut: 17408, adapted: true, group: "mlp" },
  { name: "mlp.up_proj", dIn: 5120, dOut: 17408, adapted: true, group: "mlp" },
  { name: "mlp.down_proj", dIn: 17408, dOut: 5120, adapted: true, group: "mlp" },
]
const FULL: Mod[] = [
  { name: "self_attn.q_proj", dIn: 5120, dOut: 12288, adapted: true, group: "attn" },
  { name: "self_attn.k_proj", dIn: 5120, dOut: 1024, adapted: true, group: "attn" },
  { name: "self_attn.v_proj", dIn: 5120, dOut: 1024, adapted: true, group: "attn" },
  { name: "self_attn.o_proj", dIn: 6144, dOut: 5120, adapted: true, group: "attn" },
]
const LINEAR: Mod[] = [
  { name: "linear_attn.in_proj_qkv", dIn: 5120, dOut: 10240, adapted: false, group: "linear" },
  { name: "linear_attn.in_proj_z", dIn: 5120, dOut: 6144, adapted: false, group: "linear" },
  { name: "linear_attn.in_proj_a", dIn: 5120, dOut: 48, adapted: false, group: "linear" },
  { name: "linear_attn.in_proj_b", dIn: 5120, dOut: 48, adapted: false, group: "linear" },
  { name: "linear_attn.out_proj", dIn: 6144, dOut: 5120, adapted: false, group: "linear" },
]

const LAYERS = 64
const isFull = (i: number) => i % 4 === 3
const modsOf = (i: number) => [...(isFull(i) ? FULL : LINEAR), ...MLP]
const BASE_PARAMS = 27_781_427_952
const RANKS = [8, 16, 32, 64, 128]

const loraParams = (m: Mod, r: number) => (m.adapted ? r * (m.dIn + m.dOut) : 0)
const fmtInt = (n: number) => n.toLocaleString("en-US")
const fmtM = (n: number) => `${(n / 1e6).toFixed(1)}M`
const fmtMB = (bytes: number) => `${(bytes / 1e6).toFixed(0)} MB`

export function AdapterAnatomy() {
  const [layer, setLayer] = useState(3)
  const [ri, setRi] = useState(2)
  const r = RANKS[ri]

  let mlp = 0
  let attn = 0
  for (let i = 0; i < LAYERS; i++) {
    for (const m of modsOf(i)) {
      if (m.group === "mlp") mlp += loraParams(m, r)
      else attn += loraParams(m, r)
    }
  }
  const total = mlp + attn
  const mods = modsOf(layer)
  const maxW = Math.max(...mods.map((m) => m.dIn * m.dOut))

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Qwen3.8-27B-pi-adapted: what the LoRA touches</span>
        <span className="font-mono text-[11px] text-muted-foreground">from the safetensors headers</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">64 decoder layers. Click one.</div>
        <div className="grid grid-cols-16 gap-[3px]" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
          {Array.from({ length: LAYERS }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`layer ${i}, ${isFull(i) ? "full attention" : "linear attention"}`}
              aria-pressed={layer === i}
              onClick={() => setLayer(i)}
              className={cn(
                "h-7 cursor-pointer rounded-[4px] border font-mono text-[9px] tabular-nums transition-colors",
                isFull(i)
                  ? "border-[oklch(0.62_0.15_250/0.6)] bg-[oklch(0.62_0.15_250/0.35)] text-foreground"
                  : "border-foreground/10 bg-muted/40 text-muted-foreground",
                layer === i && "ring-2 ring-foreground/60"
              )}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-[oklch(0.62_0.15_250/0.6)] align-middle" />
            full attention (16): attention and MLP adapted
          </span>
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-muted align-middle" />
            linear attention (48): MLP adapted only
          </span>
        </div>

        <div className="mt-4 rounded-lg border bg-background/40 p-3">
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">
            layer {layer}, {isFull(layer) ? "full (gated) attention" : "linear attention (Gated DeltaNet)"}: bar = base matrix size
          </div>
          <div className="space-y-1.5">
            {mods.map((m) => (
              <div key={m.name} className="grid grid-cols-[minmax(0,10.5rem)_1fr] items-center gap-2 sm:grid-cols-[13rem_1fr]">
                <span className={cn("truncate font-mono text-[11px]", m.adapted ? "text-foreground" : "text-muted-foreground line-through")}>
                  {m.name}
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-3 min-w-[2px] rounded-sm" style={{ width: `${Math.max(1, (m.dIn * m.dOut * 70) / maxW)}%`, background: m.adapted ? "oklch(0.66 0.13 160 / 0.7)" : "oklch(0.6 0.02 260 / 0.35)" }} />
                  <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {m.dOut}×{m.dIn}
                    {m.adapted ? ` + A ${r}×${m.dIn}, B ${m.dOut}×${r}` : " · no adapter"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">rank r</span>
          {RANKS.map((v, i) => (
            <button key={v} type="button" className={btn(ri === i)} aria-pressed={ri === i} onClick={() => setRi(i)}>
              {v}
              {v === 32 ? " (shipped)" : ""}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "adapter params", v: fmtInt(total) },
            { k: "share of base", v: `${((total / BASE_PARAMS) * 100).toFixed(3)}%` },
            { k: "in the MLPs", v: `${((mlp / total) * 100).toFixed(1)}%` },
            { k: "file, F32 / F16", v: `${fmtMB(total * 4)} / ${fmtMB(total * 2)}` },
          ].map((s) => (
            <div key={s.k} className="rounded-lg border bg-background/40 px-2.5 py-2">
              <div className="font-mono text-[10.5px] text-muted-foreground">{s.k}</div>
              <div className="font-mono text-sm tabular-nums text-foreground">{s.v}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {r === 32
            ? `At the shipped rank the adapter is ${fmtM(total)} parameters against 27.8B: ${fmtM(mlp)} in the MLPs, ${fmtM(attn)} in the 16 full-attention blocks. The Gated DeltaNet projections of the other 48 layers, the embeddings, the output head, the MTP layer and the vision tower get nothing.`
            : `Rank scales the adapter linearly: r = ${r} would be ${fmtM(total)} parameters. Only r = 32 was trained; other ranks are arithmetic on the same shapes.`}
        </p>
      </div>
    </figure>
  )
}
