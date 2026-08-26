"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What "UD" / dynamic quantization actually does to a file, read off the GGUF
// tensor-info blocks rather than off the label.
//
// For each tier I fetched the first 32 MB of the .gguf over HTTP Range, parsed
// the header (magic, version, tensor count, KV count, KV pairs, then one
// {name, n_dims, dims[], ggml_type, offset} record per tensor), and computed
// each tensor's byte size from its shape and block layout — Q4_K is 144 bytes
// per 256 weights, Q5_K 176, Q6_K 210, Q8_0 34 per 32, IQ2_XS 74 per 256,
// IQ3_XXS 98, IQ4_XS 136, and so on. Summing those plus the 11,010,605-byte
// header lands within 19 bytes of the published file size on every tier, so
// the per-class bits-per-weight below are exact, not estimates.
//
// `flat` is the counterfactual: the same 34,660,610,688 parameters with every
// quantizable tensor cut at the tier's own modal routed-expert width, leaving
// only the tensors that are F32 in the real file (routers, norms, the SSM
// gates, conv1d) alone. It is the naive recipe, not llama.cpp's stock one.
//
// The layer strip is the fingerprint: block 1 is cut wider in six of the nine
// tiers, and blocks 34, 38 and 39 have their ffn_down_exps promoted in eight of
// nine (Q6_K_XL is the exception — its down projection is already Q8_0 for the
// whole stack). Same indices, tier after tier, which is what an importance
// matrix looks like when it is doing its job.

const LOW = "oklch(0.58 0.19 27)"
const MID = "oklch(0.68 0.13 85)"
const HIGH = "oklch(0.60 0.15 255)"
const FIXED = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const GIB = 1024 * 1024 * 1024

type Bpw = { embd: number; out: number; gate: number; up: number; down: number; shexp: number; attn: number; ssm: number; router: number }
type Recipe = { base: string; hi: Record<string, string> }

type Tier = {
  tier: string
  bytes: number
  flatBytes: number
  flatType: string
  flatBpw: number
  bpw: Bpw
  recipe: { gate: Recipe; up: Recipe; down: Recipe }
}

const TIERS: Tier[] = [
  {
    tier: "Q2_K_XL", bytes: 12290649152, flatBytes: 10127117357, flatType: "IQ2_XS", flatBpw: 2.3125,
    bpw: { embd: 5.5, out: 4.5, gate: 2.331, up: 2.331, down: 3.181, shexp: 5.888, attn: 5.548, ssm: 6.562, router: 32 },
    recipe: {
      gate: { base: "IQ2_XS", hi: { "1": "IQ3_XXS" } },
      up: { base: "IQ2_XS", hi: { "1": "IQ3_XXS" } },
      down: { base: "IQ3_XXS", hi: { "1": "IQ4_XS", "34": "IQ4_XS", "38": "IQ4_XS", "39": "IQ4_XS" } },
    },
  },
  {
    tier: "IQ3_XXS", bytes: 13211176000, flatBytes: 11209444397, flatType: "IQ2_S", flatBpw: 2.5625,
    bpw: { embd: 6.562, out: 6.562, gate: 2.562, up: 2.562, down: 3.152, shexp: 6.562, attn: 6.562, ssm: 6.562, router: 32 },
    recipe: {
      gate: { base: "IQ2_S", hi: {} },
      up: { base: "IQ2_S", hi: {} },
      down: { base: "IQ3_XXS", hi: { "34": "IQ4_XS", "38": "IQ4_XS", "39": "IQ4_XS" } },
    },
  },
  {
    tier: "Q3_K_XL", bytes: 16845532224, flatBytes: 13374098477, flatType: "IQ3_XXS", flatBpw: 3.0625,
    bpw: { embd: 8.5, out: 6.562, gate: 3.092, up: 3.092, down: 4.455, shexp: 8.5, attn: 8.5, ssm: 8.5, router: 32 },
    recipe: {
      gate: { base: "IQ3_XXS", hi: { "1": "IQ4_XS" } },
      up: { base: "IQ3_XXS", hi: { "1": "IQ4_XS" } },
      down: { base: "IQ4_XS", hi: { "1": "Q5_K", "34": "Q6_K", "38": "Q6_K", "39": "Q6_K" } },
    },
  },
  {
    tier: "IQ4_XS", bytes: 17730530368, flatBytes: 14997589037, flatType: "IQ3_S", flatBpw: 3.4375,
    bpw: { embd: 8.5, out: 6.562, gate: 3.438, up: 3.438, down: 4.423, shexp: 8.5, attn: 8.5, ssm: 8.5, router: 32 },
    recipe: {
      gate: { base: "IQ3_S", hi: {} },
      up: { base: "IQ3_S", hi: {} },
      down: { base: "IQ4_XS", hi: { "34": "Q6_K", "38": "Q6_K", "39": "Q6_K" } },
    },
  },
  {
    tier: "Q4_K_S", bytes: 20893035584, flatBytes: 19597478957, flatType: "Q4_K", flatBpw: 4.5,
    bpw: { embd: 8.5, out: 6.562, gate: 4.5, up: 4.5, down: 4.655, shexp: 8.5, attn: 8.5, ssm: 8.5, router: 32 },
    recipe: {
      gate: { base: "Q4_K", hi: {} },
      up: { base: "Q4_K", hi: {} },
      down: { base: "Q4_K", hi: { "34": "Q6_K", "38": "Q6_K", "39": "Q6_K" } },
    },
  },
  {
    tier: "Q4_K_XL", bytes: 22360476736, flatBytes: 19597478957, flatType: "Q4_K", flatBpw: 4.5,
    bpw: { embd: 8.5, out: 8.5, gate: 4.525, up: 4.525, down: 5.606, shexp: 8.5, attn: 8.5, ssm: 8.5, router: 32 },
    recipe: {
      gate: { base: "Q4_K", hi: { "1": "Q5_K" } },
      up: { base: "Q4_K", hi: { "1": "Q5_K" } },
      down: { base: "Q5_K", hi: { "1": "Q6_K", "34": "Q6_K", "38": "Q6_K", "39": "Q6_K" } },
    },
  },
  {
    tier: "Q5_K_XL", bytes: 26592529472, flatBytes: 23926787117, flatType: "Q5_K", flatBpw: 5.5,
    bpw: { embd: 8.5, out: 8.5, gate: 5.527, up: 5.527, down: 6.756, shexp: 8.5, attn: 8.5, ssm: 8.5, router: 32 },
    recipe: {
      gate: { base: "Q5_K", hi: { "1": "Q6_K" } },
      up: { base: "Q5_K", hi: { "1": "Q6_K" } },
      down: { base: "Q6_K", hi: { "1": "Q8_0", "34": "Q8_0", "38": "Q8_0", "39": "Q8_0" } },
    },
  },
  {
    tier: "Q6_K_XL", bytes: 31843798080, flatBytes: 28526677037, flatType: "Q6_K", flatBpw: 6.5625,
    bpw: { embd: 8.5, out: 8.5, gate: 6.611, up: 6.611, down: 8.5, shexp: 8.5, attn: 8.5, ssm: 8.5, router: 32 },
    recipe: {
      gate: { base: "Q6_K", hi: { "1": "Q8_0" } },
      up: { base: "Q6_K", hi: { "1": "Q8_0" } },
      down: { base: "Q8_0", hi: {} },
    },
  },
  {
    tier: "Q8_K_XL", bytes: 38451203136, flatBytes: 36914711597, flatType: "Q8_0", flatBpw: 8.5,
    bpw: { embd: 8.5, out: 8.5, gate: 8.688, up: 8.688, down: 9.25, shexp: 8.688, attn: 8.684, ssm: 8.5, router: 32 },
    recipe: {
      gate: { base: "Q8_0", hi: { "1": "BF16" } },
      up: { base: "Q8_0", hi: { "1": "BF16" } },
      down: { base: "Q8_0", hi: { "1": "BF16", "34": "BF16", "38": "BF16", "39": "BF16" } },
    },
  },
]

const CLASSES: { k: keyof Bpw; label: string; note: string; routed: boolean }[] = [
  { k: "gate", label: "ffn_gate_exps", note: "40 x 256 experts", routed: true },
  { k: "up", label: "ffn_up_exps", note: "40 x 256 experts", routed: true },
  { k: "down", label: "ffn_down_exps", note: "40 x 256 experts", routed: true },
  { k: "shexp", label: "ffn_*_shexp", note: "shared expert", routed: false },
  { k: "attn", label: "attn_*", note: "qkv, gate, q/k/v/o", routed: false },
  { k: "ssm", label: "ssm_out", note: "gated-delta output", routed: false },
  { k: "embd", label: "token_embd", note: "248,320 rows", routed: false },
  { k: "out", label: "output", note: "the lm head", routed: false },
  { k: "router", label: "ffn_gate_inp", note: "the router", routed: false },
]

const W = 700
const AX = 152
const AW = 380 // 0 .. 10 bits
const ROW = 21
const TOP = 26
const AXMAX = 10

const bx = (b: number) => AX + (Math.min(b, AXMAX) / AXMAX) * AW
const colour = (b: number) => (b >= 32 ? FIXED : b >= 8 ? HIGH : b >= 4 ? MID : LOW)

const LW = 11.4
const LX = 152

export function DynamicRecipe() {
  const [sel, setSel] = useState("Q4_K_XL")
  const t = TIERS.find((x) => x.tier === sel)!

  const delta = t.bytes - t.flatBytes
  const H = TOP + CLASSES.length * ROW + 96

  const strip = [
    { key: "gate" as const, label: "ffn_gate_exps" },
    { key: "up" as const, label: "ffn_up_exps" },
    { key: "down" as const, label: "ffn_down_exps" },
  ]
  const stripTop = TOP + CLASSES.length * ROW + 26
  const promoted = Array.from(
    new Set(strip.flatMap((s) => Object.keys(t.recipe[s.key].hi).map(Number))),
  ).sort((a, b) => a - b)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {t.tier} · {(t.bytes / GIB).toFixed(2)} GiB · {((t.bytes * 8) / 34660610688).toFixed(3)} bits/weight
        </span>
        <span className="font-mono text-[10px]" style={{ color: delta > 0 ? HIGH : MID }}>
          {delta > 0 ? "+" : "−"}
          {Math.abs(delta / GIB).toFixed(2)} GiB over flat {t.flatType}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {TIERS.map((x) => (
            <button
              key={x.tier}
              type="button"
              onClick={() => setSel(x.tier)}
              aria-pressed={sel === x.tier}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.tier
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.tier}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Bits per weight assigned to each tensor class in the ${t.tier} tier. The routed-expert projections get ${t.bpw.gate.toFixed(
                2,
              )} to ${t.bpw.down.toFixed(2)} bits; the attention, SSM, shared-expert and output tensors get ${t.bpw.attn.toFixed(
                1,
              )}; the router stays at 32-bit float. The label implies ${t.flatBpw} bits everywhere.`}
            </title>

            {[0, 2, 4, 6, 8, 10].map((g) => (
              <g key={g}>
                <line x1={bx(g)} y1={TOP - 6} x2={bx(g)} y2={TOP + CLASSES.length * ROW - 4} stroke="currentColor" strokeOpacity={0.08} />
                <text x={bx(g)} y={TOP - 10} fontSize={7} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {g}
                </text>
              </g>
            ))}
            <text x={AX - 8} y={TOP - 10} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              bits / weight
            </text>

            <line
              x1={bx(t.flatBpw)}
              y1={TOP - 6}
              x2={bx(t.flatBpw)}
              y2={TOP + CLASSES.length * ROW - 4}
              stroke={MUTED}
              strokeDasharray="4 3"
              strokeOpacity={0.9}
            />
            <text x={bx(t.flatBpw)} y={TOP + CLASSES.length * ROW + 8} fontSize={7} textAnchor="middle" fill={MUTED} fontFamily="ui-monospace, monospace">
              flat {t.flatType} = {t.flatBpw}
            </text>

            {CLASSES.map((c, i) => {
              const y = TOP + i * ROW
              const v = t.bpw[c.k]
              const over = v >= AXMAX
              return (
                <g key={c.k}>
                  <text x={AX - 8} y={y + 9} fontSize={8.5} textAnchor="end" fill="currentColor" fillOpacity={c.routed ? 0.9 : 0.55} fontFamily="ui-monospace, monospace">
                    {c.label}
                  </text>
                  <text x={AX - 8} y={y + 17} fontSize={6.5} textAnchor="end" fill="currentColor" fillOpacity={0.35} fontFamily="ui-monospace, monospace">
                    {c.note}
                  </text>
                  <rect x={AX} y={y + 2} width={Math.max(1, bx(v) - AX)} height={12} rx={2} fill={colour(v)} fillOpacity={c.routed ? 0.85 : 0.4} />
                  {over ? (
                    <path d={`M ${AX + AW} ${y + 2} l 5 6 l -5 6`} fill="none" stroke={colour(v)} strokeOpacity={0.7} />
                  ) : null}
                  <text
                    x={(over ? AX + AW + 9 : bx(v)) + 6}
                    y={y + 12}
                    fontSize={8}
                    fill={colour(v)}
                    fillOpacity={0.95}
                    fontFamily="ui-monospace, monospace"
                  >
                    {over ? "32.0 — F32, never quantized" : v.toFixed(3)}
                  </text>
                </g>
              )
            })}

            <text x={LX - 8} y={stripTop - 6} fontSize={7.5} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              per block
            </text>
            <text x={LX} y={stripTop - 6} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              {promoted.length > 1
                ? `blocks ${promoted.join(", ")} are cut wider than the other ${40 - promoted.length}`
                : promoted.length === 1
                  ? `block ${promoted[0]} is cut wider than the other 39`
                  : "every block cut at the same width in this tier"}
            </text>
            {strip.map((s, si) => {
              const r = t.recipe[s.key]
              const y = stripTop + si * 15
              return (
                <g key={s.key}>
                  <text x={LX - 8} y={y + 8} fontSize={7.5} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {s.label}
                  </text>
                  {Array.from({ length: 40 }, (_, b) => {
                    const hi = r.hi[String(b)]
                    return (
                      <rect
                        key={b}
                        x={LX + b * LW}
                        y={y}
                        width={LW - 1.6}
                        height={10}
                        rx={1}
                        fill={hi ? MID : HIGH}
                        fillOpacity={hi ? 0.95 : 0.22}
                      />
                    )
                  })}
                  <text x={LX + 40 * LW + 6} y={y + 8} fontSize={7} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                    {r.base}
                  </text>
                </g>
              )
            })}
            {[0, 10, 20, 30, 39].map((b) => (
              <text
                key={b}
                x={LX + b * LW + (LW - 1.6) / 2}
                y={stripTop + 3 * 15 + 8}
                fontSize={6.5}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.35}
                fontFamily="ui-monospace, monospace"
              >
                {b}
              </text>
            ))}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The tier name describes three tensor classes out of nine. In{" "}
          <span className="font-mono text-[11px] text-foreground">{t.tier}</span>{" "}the gate and up
          projections of the routed experts get{" "}
          <span style={{ color: colour(t.bpw.gate) }}>{t.bpw.gate.toFixed(2)} bits</span>{" "}and the
          down projection {t.bpw.down.toFixed(2)}; the attention, the gated-delta output, the shared
          expert and the output head get{" "}
          <span style={{ color: colour(t.bpw.attn) }}>{t.bpw.attn.toFixed(2)}</span>. The router —
          the 256x2,048 matrix per block that picks the experts — is left at{" "}
          <span style={{ color: FIXED }}>F32</span>{" "}in every tier, including the 2-bit one.
          <br />
          <br />
          That is what buys the {(delta / GIB).toFixed(2)} GiB gap against the flat recipe, and it
          is also why the whole-file bits-per-weight in the header strip is{" "}
          <span className="text-foreground">{((t.bytes * 8) / 34660610688).toFixed(2)}</span>, not{" "}
          {t.flatBpw}. The lower strip is the imatrix talking: the same blocks — 1, and 34/38/39 on
          the down projection — get promoted in tier after tier, which is the calibration pass
          saying those matrices carry activations the others do not.
        </p>
      </div>
    </figure>
  )
}
