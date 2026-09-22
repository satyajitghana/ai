"use client"

import { useState } from "react"

// The measured allocation, read out of the GGUF tensor headers rather than the
// filenames. Every cell here comes from parsing the tensor-info block of the
// four files published at PollardWeights/Penjing-27B-Pollard on 2026-09-22:
// each tensor's name, shape and ggml type id, with ik_llama.cpp's extended ids
// (153 = IQ2_KT, 158 = IQ1_KT) resolved against ik_llama.cpp's own ggml.h.
//
// The point of drawing it per layer is that this is where a "bits placed by
// per-layer sensitivity" claim either shows up or doesn't. It shows up as
// exactly four protected blocks -- 0, 1, 63, 64 -- and a flat crush across
// 2..62, identical in all three low rungs. The IQ3_S rung has no per-layer
// structure at all.
//
// Layer 64 is not a transformer block: qwen35.nextn_predict_layers = 1, so
// block 64 is the multi-token-prediction head. It is counted here because the
// file counts it.

const LAYERS = 65

type Rung = "IQ1_KT" | "IQ2_XXS" | "IQ2_KT" | "IQ3_S"

type Row = {
  role: string
  note: string
  // type for layers 0,1 / 2..62 / 63 / 64, or a single type for all
  band: (layer: number) => string | null
}

const PROTECTED_LOW = new Set([0, 1, 63])
const MTP = 64

// The 16 full-attention blocks: qwen35.full_attention_interval = 4, so blocks
// 3, 7, 11 ... 63 carry attn_q/k/v/output; the other 48 carry the fused
// attn_qkv plus the gated-delta ssm_* tensors. Block 64 (MTP) carries a full
// attention set of its own.
const isFullAttn = (l: number) => l !== MTP && l % 4 === 3

function rowsFor(rung: Rung): Row[] {
  const primary = rung
  const crushed = "IQ1_S"
  const isLow = rung !== "IQ3_S"
  // Layer 64 (MTP) is Q2_K in the IQ1_KT build and Q6_K in every other build.
  const mtpType = rung === "IQ1_KT" ? "Q2_K" : "Q6_K"

  if (!isLow) {
    return [
      {
        role: "ffn_down",
        note: "MLP write-back",
        band: (l) => (l === MTP ? "Q6_K" : "IQ3_S"),
      },
      {
        role: "ffn_gate · ffn_up",
        note: "MLP body — 79% of the params",
        band: (l) => (l === MTP ? "Q6_K" : "IQ3_S"),
      },
      {
        role: "attn_q · attn_output",
        note: "full-attention blocks only",
        band: (l) => (l === MTP ? "Q6_K" : isFullAttn(l) ? "IQ3_S" : null),
      },
      {
        role: "attn_k",
        note: "full-attention blocks only",
        band: (l) => (l === MTP ? "Q6_K" : isFullAttn(l) ? "IQ3_S" : null),
      },
      {
        role: "attn_v",
        note: "bumped up, llama.cpp's own IQ3_S rule",
        band: (l) => (l === MTP ? "Q6_K" : isFullAttn(l) ? "Q4_K" : null),
      },
      {
        role: "attn_qkv",
        note: "bumped up, linear-attention blocks",
        band: (l) => (l === MTP || isFullAttn(l) ? null : "Q4_K"),
      },
      {
        role: "attn_gate · ssm_*",
        note: "linear-attention blocks only",
        band: (l) => (l === MTP || isFullAttn(l) ? null : "IQ3_S"),
      },
    ]
  }

  return [
    {
      role: "ffn_down",
      note: "MLP write-back — never crushed",
      band: (l) => (l === MTP ? mtpType : primary),
    },
    {
      role: "ffn_gate · ffn_up",
      note: "MLP body — crushed on 61 of 64 blocks",
      band: (l) => (l === MTP ? mtpType : PROTECTED_LOW.has(l) ? primary : crushed),
    },
    {
      role: "attn_q · attn_output",
      note: "full-attention blocks only — never crushed",
      band: (l) => (l === MTP ? mtpType : isFullAttn(l) ? primary : null),
    },
    {
      role: "attn_k · attn_v",
      note: "crushed on 15 of 16 — saves 11 MB",
      band: (l) =>
        l === MTP ? mtpType : isFullAttn(l) ? (l === 63 ? primary : crushed) : null,
    },
    {
      role: "attn_qkv · attn_gate · ssm_*",
      note: "linear-attention blocks only — never crushed",
      band: (l) => (l === MTP ? null : isFullAttn(l) ? null : primary),
    },
  ]
}

// One hue per bit class: narrow formats cool, wide formats warm, so the eye
// reads "crushed" and "protected" without a legend lookup.
const TYPE_COLOR: Record<string, string> = {
  IQ1_S: "oklch(0.56 0.15 265)",
  IQ1_KT: "oklch(0.60 0.13 235)",
  IQ2_XXS: "oklch(0.62 0.12 210)",
  IQ2_KT: "oklch(0.63 0.12 195)",
  IQ3_S: "oklch(0.64 0.12 165)",
  Q2_K: "oklch(0.60 0.14 45)",
  Q4_K: "oklch(0.68 0.13 95)",
  Q6_K: "oklch(0.66 0.15 62)",
}

const TYPE_BPW: Record<string, number> = {
  IQ1_S: 1.5625,
  IQ1_KT: 1.75,
  IQ2_XXS: 2.0625,
  IQ2_KT: 2.125,
  IQ3_S: 3.4375,
  Q2_K: 2.625,
  Q4_K: 4.5,
  Q6_K: 6.5625,
}

const RUNGS: { key: Rung; file: string; gb: number; bpw: number }[] = [
  { key: "IQ1_KT", file: "Penjing-27B-IQ1_KT.gguf", gb: 6.53, bpw: 1.906 },
  { key: "IQ2_XXS", file: "Penjing-27B-IQ2_XXS.gguf", gb: 7.25, bpw: 2.12 },
  { key: "IQ2_KT", file: "Penjing-27B-IQ2_KT.gguf", gb: 7.36, bpw: 2.15 },
  { key: "IQ3_S", file: "Penjing-27B-IQ3_S.gguf", gb: 12.94, bpw: 3.785 },
]

export function AllocationMap() {
  const [rung, setRung] = useState<Rung>("IQ2_KT")
  const rows = rowsFor(rung)
  const meta = RUNGS.find((r) => r.key === rung)!

  const usedTypes = Array.from(
    new Set(
      rows.flatMap((r) =>
        Array.from({ length: LAYERS }, (_, l) => r.band(l)).filter(
          (t): t is string => t !== null
        )
      )
    )
  ).sort((a, b) => TYPE_BPW[a] - TYPE_BPW[b])

  const W = 720
  const LABEL_W = 176
  const cellW = (W - LABEL_W) / LAYERS
  const rowH = 26
  const gap = 5
  const H = rows.length * (rowH + gap) + 34

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          tensor types per block, read from the GGUF header
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {meta.gb} GB · {meta.bpw.toFixed(3)} bpw measured
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {RUNGS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRung(r.key)}
              aria-pressed={rung === r.key}
              className={
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                (rung === r.key
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {r.key}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[620px]"
            role="img"
            aria-label={`Tensor type per transformer block for the ${rung} build. ${
              rung === "IQ3_S"
                ? "Every block carries the same type; there is no per-layer variation."
                : "Blocks 0, 1, 63 and 64 keep the primary type; blocks 2 through 62 are demoted to IQ1_S on ffn_gate and ffn_up."
            }`}
          >
            {rows.map((r, i) => {
              const y = i * (rowH + gap)
              return (
                <g key={r.role}>
                  <text
                    x={LABEL_W - 8}
                    y={y + rowH / 2 + 1}
                    textAnchor="end"
                    className="fill-foreground font-mono"
                    style={{ fontSize: 10 }}
                  >
                    {r.role}
                  </text>
                  <text
                    x={LABEL_W - 8}
                    y={y + rowH / 2 + 12}
                    textAnchor="end"
                    className="fill-muted-foreground font-mono"
                    style={{ fontSize: 7.5 }}
                  >
                    {r.note}
                  </text>
                  {Array.from({ length: LAYERS }, (_, l) => {
                    const t = r.band(l)
                    const x = LABEL_W + l * cellW
                    if (!t) {
                      return (
                        <rect
                          key={l}
                          x={x}
                          y={y + rowH / 2 - 1}
                          width={Math.max(cellW - 0.6, 0.8)}
                          height={2}
                          className="fill-foreground/10"
                        />
                      )
                    }
                    return (
                      <rect
                        key={l}
                        x={x}
                        y={y}
                        width={Math.max(cellW - 0.6, 0.8)}
                        height={rowH}
                        rx={1}
                        fill={TYPE_COLOR[t]}
                        opacity={t === "IQ1_S" ? 0.42 : 0.92}
                      >
                        <title>{`block ${l} · ${r.role} · ${t} (${TYPE_BPW[t]} bpw)`}</title>
                      </rect>
                    )
                  })}
                </g>
              )
            })}

            {[0, 1, 16, 32, 48, 63, 64].map((l) => (
              <text
                key={l}
                x={LABEL_W + l * cellW + cellW / 2}
                y={H - 16}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8 }}
              >
                {l === 64 ? "mtp" : l}
              </text>
            ))}
            <text
              x={LABEL_W}
              y={H - 4}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 8 }}
            >
              transformer block index
            </text>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {usedTypes.map((t) => (
            <span key={t} className="flex items-center gap-1.5 font-mono text-[10px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: TYPE_COLOR[t], opacity: t === "IQ1_S" ? 0.42 : 0.92 }}
              />
              <span className="text-foreground">{t}</span>
              <span className="text-muted-foreground">{TYPE_BPW[t]} bpw</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="inline-block h-[2px] w-2.5 bg-foreground/20" />
            <span className="text-muted-foreground">tensor absent on this block</span>
          </span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Nominal bits-per-weight are the ggml block sizes (IQ1_S 50 B/256,
        IQ2_XXS 66, IQ3_S 110, Q4_K 144, Q6_K 210; ik_llama.cpp&apos;s IQ1_KT 56
        and IQ2_KT 68). The measured file bpw in the header above is lower or
        higher than any single row because <code>token_embd</code> and{" "}
        <code>output</code> sit outside this grid.
      </figcaption>
    </figure>
  )
}
