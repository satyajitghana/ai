"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where each piece of Qwen3.8-Flash-Next actually lands, per cafe-llama.cpp
// flag combination — verified against quimmedes/cafe-llama.cpp @ 2da8419.
//
// The two MoE-offload destinations are genuinely different allocators, not a
// rename: common/common.h defines `common_host_buffer_type()` (walks backend
// devices for `ggml_backend_dev_host_buffer_type`, i.e. pinned/page-locked host
// memory) versus the pre-existing `ggml_backend_cpu_buffer_type()` (ordinary
// pageable memory) that upstream's `-cmoe`/`-ncmoe` already used. Both are wired
// through the same `LLM_FFN_EXPS_REGEX` override in common/common.h, which only
// matches `blk.N.ffn_{up,down,gate,gate_up}(_ch)?exps` — never
// `blk.N.ffn_gate_inp` (the router; see its literal name in src/llama-arch.cpp)
// and never `per_layer_token_embd`. That last part is why the row below never
// moves with the MoE flags and needs its own flag family.
//
// `--no-ngram` is traced in src/models/qwen4exp.cpp: the hparams loader only
// populates the PLE fields inside `if (n_ple > 0 && ml.load_ngram)`, so
// `--no-ngram` (which sets `load_ngram = false`) leaves `ple_n_heads` at zero
// and the tensor is created with `TENSOR_SKIP` instead of the normal
// `TENSOR_READ_LAZY`. TENSOR_SKIP is not a placement hint — in
// src/llama-model-loader.cpp it is the model loader's early-return branch that
// logs the tensor as unused, subtracts its byte count from the load, and
// returns a null pointer. Zero bytes, in RAM or VRAM, exactly as the README
// says. `--ngram-ssd` takes the other branch: `enable_ngram_ssd = offload_ngram
// _ssd && is_ngram && use_mmap`, which mmaps the same tensor from disk instead
// of skipping it.
//
// The per-layer GPU cutoff (`-nhmoe 36` overrides only the first 36 of 48
// layers) follows src/llama-model.cpp's ordinary `i_gpu_start`/`act_gpu_layers`
// offload logic for everything it doesn't touch — which is why the last 12
// layers' experts sit on the GPU in every preset below, offload flag or not.

const GPU = "oklch(0.60 0.15 255)"
const PINNED = "oklch(0.55 0.16 155)"
const CPU = "oklch(0.68 0.13 85)"
const SSD = "oklch(0.62 0.03 250)"
const OFF = "oklch(0.58 0.13 300)"
const BAD = "oklch(0.58 0.19 27)"

type Dest = "gpu" | "gpu-bad" | "pinned" | "cpu" | "ssd" | "off"

const DEST_META: Record<Exclude<Dest, "gpu-bad">, { label: string; color: string; col: number }> = {
  gpu: { label: "GPU", color: GPU, col: 0 },
  pinned: { label: "PINNED", color: PINNED, col: 1 },
  cpu: { label: "CPU", color: CPU, col: 2 },
  ssd: { label: "SSD", color: SSD, col: 3 },
  off: { label: "OFF", color: OFF, col: 4 },
}

const COLUMNS = ["GPU VRAM", "Pinned host", "CPU RAM", "SSD (mmap)", "Disabled"]

type RowKey = "attn" | "exp1" | "exp2" | "ple"

const ROWS: { k: RowKey; label: string; sub: string }[] = [
  { k: "attn", label: "Attention + router + KV cache", sub: "dense, every layer" },
  { k: "exp1", label: "Experts, first 36 of 48 layers", sub: "~94B of 125B" },
  { k: "exp2", label: "Experts, remaining 12 layers", sub: "~31B of 125B" },
  { k: "ple", label: "PLE / N-gram table, layer 2 only", sub: "51B, one tensor" },
]

type Preset = {
  k: string
  flags: string
  label: string
  states: Record<RowKey, Dest>
  note: string
}

const PRESETS: Preset[] = [
  {
    k: "naive",
    flags: "-ngl 99",
    label: "no offload flags",
    states: { attn: "gpu", exp1: "gpu-bad", exp2: "gpu", ple: "gpu-bad" },
    note: "aspirational — even the smallest published quant (75GB) doesn't fit a single 24GB card",
  },
  {
    k: "cpumoe",
    flags: "-ncmoe 36",
    label: "generic offload (ik_llama.cpp-style)",
    states: { attn: "gpu", exp1: "cpu", exp2: "gpu", ple: "gpu-bad" },
    note: "experts solved — the 51B-parameter table is still sitting on the card",
  },
  {
    k: "hostmoe",
    flags: "-nhmoe 36",
    label: "this fork's refinement",
    states: { attn: "gpu", exp1: "pinned", exp2: "gpu", ple: "gpu-bad" },
    note: "faster PCIe transfer for the same 94B of experts — PLE untouched",
  },
  {
    k: "ssd",
    flags: "-nhmoe 36 --ngram-ssd",
    label: "PLE on demand from disk",
    states: { attn: "gpu", exp1: "pinned", exp2: "gpu", ple: "ssd" },
    note: "table mmap'd from SSD on demand — resident nowhere",
  },
  {
    k: "noplus",
    flags: "-nhmoe 36 --no-ngram",
    label: "the reported command",
    states: { attn: "gpu", exp1: "pinned", exp2: "gpu", ple: "off" },
    note: "0 bytes — the reported 28 tok/s never runs this table at all",
  },
]

export function MoePlacement() {
  const [pk, setPk] = useState("noplus")
  const preset = PRESETS.find((p) => p.k === pk)!

  const W = 700
  const X0 = 246
  const X1 = 680
  const LANE_TOP = 30
  const LANE_H = 190
  const centers = COLUMNS.map((_, i) => X0 + (i / (COLUMNS.length - 1)) * (X1 - X0))
  const laneW = (X1 - X0) / (COLUMNS.length - 1)

  const rowY: Record<RowKey, number> = { attn: 40, exp1: 84, exp2: 128, ple: 172 }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          where each piece lands, cafe-llama.cpp flag by flag
        </span>
        <span className="font-mono text-[10px]" style={{ color: OFF }}>
          {preset.flags}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.k}
              type="button"
              onClick={() => setPk(p.k)}
              aria-pressed={pk === p.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                pk === p.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.flags}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 226`} width={W} height={226} role="img" className="min-w-[680px] max-w-full">
            <title>
              {`Memory placement diagram for four model components under the flag combination ${preset.flags}: ${ROWS.map(
                (r) => {
                  const d = preset.states[r.k]
                  const base = d.replace("-bad", "") as Exclude<Dest, "gpu-bad">
                  const fits = d.endsWith("-bad") ? ", attempted but does not fit a 24GB card" : ""
                  return `${r.label} in ${DEST_META[base].label}${fits}`
                },
              ).join("; ")}.`}
            </title>

            {/* column lanes */}
            {COLUMNS.map((label, i) => (
              <g key={label}>
                <rect
                  x={centers[i] - laneW / 2}
                  y={LANE_TOP}
                  width={laneW}
                  height={LANE_H}
                  fill="currentColor"
                  fillOpacity={i % 2 === 0 ? 0.025 : 0.05}
                />
                <text
                  x={centers[i]}
                  y={18}
                  fontSize={8}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.5}
                  fontFamily="ui-monospace, monospace"
                >
                  {label}
                </text>
              </g>
            ))}

            {/* row labels */}
            {ROWS.map((r) => (
              <g key={r.k}>
                <text x={6} y={rowY[r.k] + 9} fontSize={9} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
                  {r.label}
                </text>
                <text x={6} y={rowY[r.k] + 20} fontSize={7.5} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {r.sub}
                </text>
              </g>
            ))}

            {/* pills */}
            {ROWS.map((r) => {
              const dest = preset.states[r.k]
              const bad = dest.endsWith("-bad")
              const base = dest.replace("-bad", "") as Exclude<Dest, "gpu-bad">
              const meta = DEST_META[base]
              const cx = centers[meta.col]
              const y = rowY[r.k]
              const pillW = 82
              return (
                <g key={r.k}>
                  <rect
                    x={cx - pillW / 2}
                    y={y}
                    width={pillW}
                    height={22}
                    rx={5}
                    fill={bad ? "none" : meta.color}
                    fillOpacity={0.85}
                    stroke={bad ? BAD : "none"}
                    strokeWidth={1.4}
                    strokeDasharray={bad ? "3 2.5" : undefined}
                  />
                  <text
                    x={cx}
                    y={y + 14}
                    fontSize={9}
                    textAnchor="middle"
                    fill={bad ? BAD : "#fff"}
                    fontFamily="ui-monospace, monospace"
                  >
                    {meta.label}
                  </text>
                  {bad && (
                    <text x={cx} y={y + 32} fontSize={7} textAnchor="middle" fill={BAD} fontFamily="ui-monospace, monospace">
                      doesn&rsquo;t fit
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{preset.note}</div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "PLE at the 4-bit floor", v: "≥25.5 GB", c: OFF },
            { l: "fork's own diff vs upstream", v: "+1,179/−170, 44 files", c: PINNED },
            { l: "MTP draft, Q4_K_M", v: "2.59 GiB", c: GPU },
            { l: "router tensor", v: "never overridden", c: CPU },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two things hold steady across every preset and are easy to miss reading the flags alone.
          The top row never moves — attention, the MoE router, and the KV cache stay on the GPU in
          all five presets, because <code>-hmoe</code>/<code>-cmoe</code>&rsquo;s override regex
          matches only the expert projection tensors, never the router or anything else. And the
          third row never moves either: <code>-nhmoe 36</code> only overrides the first 36 of 48
          layers, so the remaining 12 layers&rsquo; experts ride the ordinary <code>-ngl</code>{" "}
          offload path onto the GPU regardless of which offload preset is selected.
          <br />
          <br />
          The row that actually explains the reported command is the last one. Toggle through the
          first three presets and the PLE table never leaves the{" "}
          <span style={{ color: GPU }}>GPU</span> column — offloading experts, by either mechanism,
          does nothing for it, because the same regex that skips the router also never matches{" "}
          <code>per_layer_token_embd</code>. At the 4-bit floor this article&rsquo;s own
          &ldquo;Running it locally&rdquo; section documents for that tensor, 51B parameters is at
          least <span className="text-foreground">≈25.5 GB</span> on its own — before a single
          expert or a byte of KV cache is loaded.{" "}
          <code>--ngram-ssd</code> and <code>--no-ngram</code> exist because nothing else in the
          fork touches that row at all, and the reported configuration uses the more aggressive of
          the two: the last preset&rsquo;s <span style={{ color: OFF }}>OFF</span> pill is a real 0
          bytes, not a rounding of something small.
        </p>
      </div>
    </figure>
  )
}
