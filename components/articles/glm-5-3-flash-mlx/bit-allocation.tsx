"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// OrcaSAQ's bit-allocation table, redrawn -- the README ships this as a plain
// markdown table with no diagram. Six line items, transcribed directly from
// the "Bit allocation for GLM-5.3-Flash" section, at each of the four base
// quantization tiers (2bit-lite follows a separate recipe and isn't part of
// this table -- see the README's own "2bit-lite" section instead).
//
// The six tensor counts sum to exactly 37,338 -- the README's own stated
// total of quantized tensors -- which is a free sanity check that the
// transcription below matches the source table rather than a coincidence:
// 24768 + 12384 + 6 + 3 + 129 + 48 = 37338.
//
// The mechanical rule for *which* tensors are even eligible: a tensor is
// re-quantized iff the FP8 release shipped it with a `_scale_inv` companion.
// Everything else -- the 34 linear-attention layers, the sparse indexer, mHC,
// norms, embed_tokens, lm_head, and the entire vision tower -- was never FP8
// upstream and stays BF16 at every tier, which is why its bar below never
// moves when the tier picker does.

const TIERS = [2, 3, 4, 6] as const
type Tier = (typeof TIERS)[number]

type Row = {
  label: string
  count: number
  bits: Record<Tier, number>
  policy: "base" | "base+1" | "base+2"
}

const ROWS: Row[] = [
  { label: "Expert gate_proj / up_proj", count: 24_768, bits: { 2: 2, 3: 3, 4: 4, 6: 6 }, policy: "base" },
  { label: "Expert down_proj", count: 12_384, bits: { 2: 3, 3: 4, 4: 5, 6: 8 }, policy: "base+1" },
  { label: "Dense-MLP gate/up (layers 0–2)", count: 6, bits: { 2: 2, 3: 3, 4: 4, 6: 6 }, policy: "base" },
  { label: "Dense-MLP down_proj (layers 0–2)", count: 3, bits: { 2: 3, 3: 4, 4: 5, 6: 8 }, policy: "base+1" },
  { label: "Shared expert gate/up/down", count: 129, bits: { 2: 4, 3: 5, 4: 6, 6: 8 }, policy: "base+2" },
  { label: "Sparse-attn q_a/q_b/kv_a/o_proj", count: 48, bits: { 2: 2, 3: 3, 4: 4, 6: 6 }, policy: "base" },
]

const TOTAL_QUANTIZED = ROWS.reduce((n, r) => n + r.count, 0) // 37,338

const BASE = "oklch(0.60 0.15 255)"
const PLUS1 = "oklch(0.68 0.13 85)"
const PLUS2 = "oklch(0.58 0.19 27)"
const BF16 = "oklch(0.55 0.10 300)"

const colourFor = (p: Row["policy"]) => (p === "base" ? BASE : p === "base+1" ? PLUS1 : PLUS2)

export function BitAllocation() {
  const [tier, setTier] = useState<Tier>(4)

  const AXIS_MAX = 16 // shares the axis with the always-BF16 row, on purpose
  const W = 700
  const LABEL_W = 260
  const BAR_W = W - LABEL_W - 60
  const ROW_H = 30
  const H = (ROWS.length + 1) * ROW_H + 20
  const px = (bits: number) => (bits / AXIS_MAX) * BAR_W

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">OrcaSAQ bit allocation, by base tier</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {TOTAL_QUANTIZED.toLocaleString()} tensors quantized · 173 config entries
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              aria-pressed={tier === t}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tier === t
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t}-bit
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Bit width by tensor category at the ${tier}-bit tier, on a shared 0 to 16 bit axis. Expert and sparse-attention projections sit at the base ${tier} bits, down_proj tensors get one bit more, the shared expert gets two bits more, and everything that was never FP8 -- linear-attention layers, the sparse indexer, hyper-connections, norms, embed_tokens, lm_head, and the vision tower -- stays at 16-bit BF16 regardless of tier.`}
            </title>
            {ROWS.map((r, i) => {
              const y = 4 + i * ROW_H
              const bits = r.bits[tier]
              const c = colourFor(r.policy)
              return (
                <g key={r.label}>
                  <text x={0} y={y + 12} fontSize={8.5} fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    {r.label}
                  </text>
                  <text x={0} y={y + 22} fontSize={7} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    {r.count.toLocaleString()} tensors · {r.policy}
                  </text>
                  <rect x={LABEL_W} y={y + 3} width={BAR_W} height={16} rx={3} fill="currentColor" fillOpacity={0.06} />
                  <rect x={LABEL_W} y={y + 3} width={px(bits)} height={16} rx={3} fill={c} fillOpacity={0.85} />
                  <text x={LABEL_W + px(bits) + 6} y={y + 15} fontSize={9} fill={c} fontFamily="ui-monospace, monospace">
                    {bits}-bit
                  </text>
                </g>
              )
            })}
            {(() => {
              const i = ROWS.length
              const y = 4 + i * ROW_H
              return (
                <g>
                  <line
                    x1={0}
                    y1={y - 5}
                    x2={W}
                    y2={y - 5}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                    strokeDasharray="3 3"
                  />
                  <text x={0} y={y + 12} fontSize={8.5} fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    Linear attn, indexer, mHC, norms,
                  </text>
                  <text x={0} y={y + 22} fontSize={8.5} fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    embed/lm_head, vision tower
                  </text>
                  <rect x={LABEL_W} y={y + 3} width={BAR_W} height={16} rx={3} fill="currentColor" fillOpacity={0.06} />
                  <rect x={LABEL_W} y={y + 3} width={px(16)} height={16} rx={3} fill={BF16} fillOpacity={0.85} />
                  <text
                    x={LABEL_W + px(16) - 6}
                    y={y + 15}
                    fontSize={9}
                    textAnchor="end"
                    fill="white"
                    fontFamily="ui-monospace, monospace"
                  >
                    16-bit, always
                  </text>
                </g>
              )
            })()}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["base — gate_proj / up_proj, sparse-attn", BASE],
            ["base +1 — down_proj", PLUS1],
            ["base +2 — shared expert", PLUS2],
            ["never quantized — BF16", BF16],
          ].map(([label, colour]) => (
            <span key={label} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: colour, opacity: 0.85 }} />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Only tensors that shipped with a <code>_scale_inv</code> companion in the original FP8
          checkpoint are eligible to be re-quantized at all — the MoE and dense-MLP linears, plus the
          four projections of every sparse-attention block: 11 sparse layers at depth 3, 7, 11 through
          43, plus the MTP block, twelve blocks times four projections is <span className="text-foreground">48</span>{" "}
          tensors. Everything below the dashed line in this diagram was <span style={{ color: BF16 }}>never
          FP8 to begin with</span>, so it rides through at BF16 no matter which tier is selected —{" "}
          <span className="text-foreground">the bar simply does not move</span>. MLX fuses each
          layer&rsquo;s routed experts into one <code>switch_mlp</code> module, so 173 config entries
          are enough to carry per-tensor overrides for all {TOTAL_QUANTIZED.toLocaleString()} of them.
        </p>
      </div>
    </figure>
  )
}
