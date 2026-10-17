"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Nemotron 3.5 Super VL's 88-layer backbone, copied from llm_config.layers_block_type
// in nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16/config.json, plus the memory
// one sequence needs at a given context. Per-layer parameter counts are summed
// tensor shapes from the BF16 safetensors headers (range-read, not downloaded).
// Cache sizes are arithmetic on config fields:
//   KV per attention layer per token = 2 (K,V) x 2 KV heads x 128 head dim values
//   Mamba-2 state per layer           = 128 heads x 64 head dim x 128 state values
//   conv state per layer              = 10,240 channels x 3 (kernel 4, minus one) values
// Weight sizes are the summed file sizes of each release.

type Block = "mamba" | "attention" | "moe"

const PATTERN = (
  "M E M E M E M A E M E M E M E M A E M E M E M E M A E M E M E M E M E M A E M E M E M E M E M A E " +
  "M E M E M E M E M A E M E M E M E M E M A E M E M E M E M A E M E M E M E M E"
)
  .split(" ")
  .map((c): Block => (c === "M" ? "mamba" : c === "A" ? "attention" : "moe"))

const COLOR: Record<Block, string> = {
  mamba: "oklch(0.60 0.15 255)",
  attention: "oklch(0.70 0.16 55)",
  moe: "oklch(0.64 0.15 145)",
}

const LABEL: Record<Block, string> = {
  mamba: "Mamba-2 mixer",
  attention: "attention mixer (GQA)",
  moe: "latent MoE feed-forward",
}

const PARAMS: Record<Block, number> = {
  mamba: 109_640_064,
  attention: 35_655_680,
  moe: 2_873_102_848,
}
const ACTIVE: Record<Block, number> = {
  mamba: 109_640_064,
  attention: 35_655_680,
  moe: 175_641_088,
}

const DETAIL: Record<Block, string> = {
  mamba: "128 heads of 64 channels, state size 128, 8 B/C groups, causal conv of width 4. Its state is the same size at token 10 and at token 1,000,000.",
  attention: "32 query heads, 2 KV heads, head dim 128. The only layers whose cache grows with the context: 1 KiB per token in BF16.",
  moe: "Project 4,096 down to a 1,024-wide latent, route to 22 of 512 experts there, project back up; one shared expert runs at full width.",
}

const N_MAMBA = 40
const N_ATTN = 8
const KV_VALUES_PER_TOKEN_PER_LAYER = 2 * 2 * 128 // 512
const SSM_VALUES_PER_LAYER = 128 * 64 * 128 // 1,048,576
const CONV_VALUES_PER_LAYER = 10_240 * 3

type Precision = "bf16" | "nvfp4" | "gguf"
const PREC: Record<
  Precision,
  { label: string; weightsGB: number; weightsNote: string; kvBytes: number; kvName: string; ssmBytes: number; ssmName: string }
> = {
  bf16: {
    label: "BF16",
    weightsGB: 248.907,
    weightsNote: "BF16 checkpoint, 64 shards, vision and MTP included",
    kvBytes: 2,
    kvName: "BF16",
    ssmBytes: 4,
    ssmName: "FP32",
  },
  nvfp4: {
    label: "NVFP4",
    weightsGB: 74.987,
    weightsNote: "experts NVFP4, Mamba and attention FP8, vision BF16",
    kvBytes: 1,
    kvName: "FP8",
    ssmBytes: 2,
    ssmName: "FP16",
  },
  gguf: {
    label: "Q4_K_M GGUF",
    weightsGB: 71.837,
    weightsNote: "70.10 GB language model + 1.73 GB vision projector file",
    kvBytes: 2,
    kvName: "F16",
    ssmBytes: 4,
    ssmName: "F32",
  },
}

// Powers of two from 4,096 to 1,048,576, listed so nothing calls Math.pow.
const CONTEXTS = [4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
const ctxLabel = (n: number) => (n >= 1048576 ? "1M" : `${n / 1024}K`)

const BUDGETS = [
  { gb: 80, label: "H100 80 GB" },
  { gb: 128, label: "DGX Spark 128 GB" },
  { gb: 141, label: "H200 141 GB" },
]

const fmtGB = (gb: number) => (gb >= 10 ? gb.toFixed(1) : gb >= 1 ? gb.toFixed(2) : gb.toFixed(3))
const fmtInt = (n: number) => n.toLocaleString("en-US")
const fmtB = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`)

const W = 760
const MX = 6
const CELL = (W - 2 * MX) / PATTERN.length

export function HybridBudget() {
  const [sel, setSel] = useState(7)
  const [ci, setCi] = useState(5)
  const [prec, setPrec] = useState<Precision>("gguf")

  const block = PATTERN[sel]
  const p = PREC[prec]
  const tokens = CONTEXTS[ci]

  const kvGB = (tokens * N_ATTN * KV_VALUES_PER_TOKEN_PER_LAYER * p.kvBytes) / 1e9
  const ssmGB = (N_MAMBA * (SSM_VALUES_PER_LAYER * p.ssmBytes + CONV_VALUES_PER_LAYER * 4)) / 1e9
  const allAttnGB = (tokens * (N_ATTN + N_MAMBA) * KV_VALUES_PER_TOKEN_PER_LAYER * p.kvBytes) / 1e9
  const total = p.weightsGB + kvGB + ssmGB
  const totalAllAttn = p.weightsGB + allAttnGB

  const scale = Math.max(300, totalAllAttn * 1.04)
  const pct = (gb: number) => `${((gb / scale) * 100).toFixed(3)}%`

  const rows = [
    { key: "w", label: `weights (${p.label})`, gb: p.weightsGB, color: "var(--muted-foreground)", op: 0.45 },
    { key: "kv", label: `KV cache, 8 attention layers (${p.kvName})`, gb: kvGB, color: COLOR.attention, op: 1 },
    { key: "ssm", label: `Mamba-2 state, 40 layers (${p.ssmName})`, gb: ssmGB, color: COLOR.mamba, op: 1 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>88 layers · input (left) → output (right)</span>
        <span className="text-muted-foreground/60">pattern from config.json</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} 74`}
          className="w-full"
          role="img"
          aria-label={`The 88-layer pattern: 40 Mamba-2 mixers, 8 attention mixers and 40 MoE blocks. Layer ${sel} is a ${LABEL[block]}.`}
        >
          {PATTERN.map((b, i) => {
            const isSel = i === sel
            const h = b === "moe" ? 30 : b === "attention" ? 46 : 38
            return (
              <rect
                key={i}
                x={MX + i * CELL + 0.6}
                y={56 - h}
                width={CELL - 1.2}
                height={h}
                rx={1.2}
                fill={COLOR[b]}
                opacity={isSel ? 1 : 0.62}
                stroke={isSel ? "var(--foreground)" : "transparent"}
                strokeWidth={isSel ? 1.4 : 0}
                onClick={() => setSel(i)}
                className="cursor-pointer"
              />
            )
          })}
          <path
            d={`M ${MX + sel * CELL + CELL / 2 - 4} 66 L ${MX + sel * CELL + CELL / 2 + 4} 66 L ${MX + sel * CELL + CELL / 2} 60 Z`}
            fill="var(--foreground)"
          />
          <text x={MX} y={8} className="fill-muted-foreground font-mono" fontSize={9}>
            tall amber = attention · blue = Mamba-2 · green = MoE
          </text>
          <text x={W - MX} y={8} textAnchor="end" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            layer {sel} · {LABEL[block]}
          </text>
        </svg>

        <Range
          min={0}
          max={PATTERN.length - 1}
          value={sel}
          onChange={(e) => setSel(Number(e.target.value))}
          className="w-full cursor-pointer"
          accent={COLOR[block]}
          aria-label="Layer"
        />

        <div className="mt-2 rounded-lg border p-3 text-sm leading-6">
          <span style={{ color: COLOR[block] }} className="font-semibold">
            {LABEL[block]}
          </span>
          {": "}
          {DETAIL[block]}
          <div className="font-mono text-xs text-muted-foreground">
            {fmtInt(PARAMS[block])} parameters stored · {fmtInt(ACTIVE[block])} active per token ({fmtB(ACTIVE[block])})
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">release</span>
          {(Object.keys(PREC) as Precision[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPrec(k)}
              aria-pressed={prec === k}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                prec === k ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PREC[k].label}
            </button>
          ))}
          <span className="font-mono text-[10px] text-muted-foreground/70">{p.weightsNote}</span>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>context for one sequence</span>
            <span className="text-foreground">{ctxLabel(tokens)} tokens ({fmtInt(tokens)})</span>
          </div>
          <Range
            min={0}
            max={CONTEXTS.length - 1}
            value={ci}
            onChange={(e) => setCi(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={COLOR.attention}
            aria-label="Context length"
          />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              this model: {fmtGB(total)} GB
            </div>
            <div className="relative h-6 w-full overflow-hidden rounded-md border bg-muted/30">
              <div className="flex h-full">
                {rows.map((r) => (
                  <div
                    key={r.key}
                    title={`${r.label}: ${fmtGB(r.gb)} GB`}
                    style={{ width: pct(r.gb), background: r.color, opacity: r.op }}
                    className="h-full transition-all duration-300"
                  />
                ))}
              </div>
              {BUDGETS.map((b) => (
                <div key={b.gb} className="absolute top-0 h-full border-l border-dashed border-foreground/50" style={{ left: pct(b.gb) }} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              same weights if all 48 mixers were this attention: {fmtGB(totalAllAttn)} GB
            </div>
            <div className="relative h-6 w-full overflow-hidden rounded-md border bg-muted/30">
              <div className="flex h-full">
                <div style={{ width: pct(p.weightsGB), background: "var(--muted-foreground)", opacity: 0.45 }} className="h-full transition-all duration-300" />
                <div style={{ width: pct(allAttnGB), background: COLOR.attention }} className="h-full transition-all duration-300" />
              </div>
              {BUDGETS.map((b) => (
                <div key={b.gb} className="absolute top-0 h-full border-l border-dashed border-foreground/50" style={{ left: pct(b.gb) }} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
            {rows.map((r) => (
              <span key={r.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: r.color, opacity: r.op }} />
                {r.label}: {fmtGB(r.gb)} GB
              </span>
            ))}
            <span>dashed: {BUDGETS.map((b) => b.label).join(" · ")}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The recurrent state is a fixed cost: forty Mamba-2 layers hold the same {fmtGB(ssmGB)} GB whether the
          conversation is four thousand tokens or a million. Only the eight attention layers grow, at{" "}
          {(N_ATTN * KV_VALUES_PER_TOKEN_PER_LAYER * p.kvBytes) / 1024} KiB per token in {p.kvName}. Swap the forty
          Mamba layers for the same attention and the cache grows six times faster. Weights are the release&apos;s file
          sizes; activations, the vision encoder&apos;s scratch and runtime buffers are not counted.
        </p>
      </div>
    </figure>
  )
}
