"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Rigel's 40-layer stack, read from config.json and the safetensors header of
// open-lm-engine/rigel-base. Every layer is a sequence mixer followed by a MoE
// feed-forward block. Layers 4, 8, ... 40 (1-based) mix with grouped-query
// attention; the other 30 with Mamba-2. Every MoE block has 128 SwiGLU experts
// of intermediate size 128 and routes each token to 2 of them. All parameter
// counts below are summed tensor shapes from the header, not estimates.

type Mixer = "mamba" | "attn"

const COLOR = {
  mamba: "oklch(0.60 0.15 255)", // blue — Mamba-2
  attn: "oklch(0.68 0.16 55)", // amber — attention
  moe: "oklch(0.62 0.14 155)", // green — MoE feed-forward
  emb: "oklch(0.62 0.02 260)", // grey — tied embedding
}

const N_LAYERS = 40
const mixerOf = (i: number): Mixer => (i % 4 === 3 ? "attn" : "mamba")

// Per-layer tensor sums from the header.
const MAMBA_PARAMS = 6_600_032 // in_proj 4384x1024, conv1d 2304x4 + bias, out_proj 1024x2048, norm, A_log, dt_bias, D
const ATTN_PARAMS = 2_621_440 // c_attn 1536x1024 (q 1024 + k 256 + v 256), c_proj 1024x1024
const EXPERT_PARAMS = 393_216 // c_fc 256x1024 (gate+up) + c_proj 1024x128
const N_EXPERTS = 128
const TOP_K = 2
const ROUTER_PARAMS = 131_072 // 128 x 1024

// Whole-model totals, by category (sum = 2,345,567,552).
const PARTS = [
  { key: "experts", label: "experts", color: COLOR.moe, total: 2_013_265_920, active: 31_457_280 },
  { key: "mamba", label: "Mamba-2 mixers", color: COLOR.mamba, total: 198_000_960, active: 198_000_960 },
  { key: "attn", label: "attention mixers", color: COLOR.attn, total: 26_214_400, active: 26_214_400 },
  { key: "emb", label: "tied embedding", color: COLOR.emb, total: 102_760_448, active: 102_760_448 },
  { key: "router", label: "routers + norms", color: "oklch(0.75 0.02 260)", total: 5_325_824, active: 5_325_824 },
] as const

const TOTAL = 2_345_567_552
const ACTIVE = 363_758_912

const fmtM = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(n >= 1e8 ? 1 : 2)}M`)
const fmtInt = (n: number) => n.toLocaleString("en-US")

// Which two experts light up is illustrative: the router picks per token.
function chosenExperts(layer: number): [number, number] {
  const a = (layer * 37 + 11) % N_EXPERTS
  let b = (layer * 91 + 53) % N_EXPERTS
  if (b === a) b = (b + 1) % N_EXPERTS
  return [a, b]
}

const W = 760
const H = 150
const MX = 14
const GAP = 3
const CW = (W - 2 * MX - (N_LAYERS - 1) * GAP) / N_LAYERS
const TOP = 34
const MIX_H = 44
const MOE_H = 44
const cx = (i: number) => MX + i * (CW + GAP)

export function LayerStack() {
  const [sel, setSel] = useState(3)
  const [view, setView] = useState<"total" | "active">("total")

  const mixer = mixerOf(sel)
  const [e1, e2] = chosenExperts(sel)
  const moeTotal = N_EXPERTS * EXPERT_PARAMS + ROUTER_PARAMS
  const moeActive = TOP_K * EXPERT_PARAMS + ROUTER_PARAMS
  const scale = TOTAL

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>40 layers · input (left) → output (right)</span>
        <span className="text-muted-foreground/60">counts from the safetensors header</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Rigel's 40 layers: 30 Mamba-2 and 10 attention sequence mixers, each followed by a 128-expert MoE block. Layer ${sel + 1} is a ${mixer === "attn" ? "grouped-query attention" : "Mamba-2"} layer.`}
        >
          <text x={MX} y={14} className="fill-muted-foreground font-mono" fontSize={9}>
            MoE (128 experts, top-2)
          </text>
          <text x={MX} y={TOP + MOE_H + MIX_H + 20} className="fill-muted-foreground font-mono" fontSize={9}>
            sequence mixer
          </text>
          <text x={W - MX} y={TOP + MOE_H + MIX_H + 20} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            pattern: Mamba-2, Mamba-2, Mamba-2, attention · x10
          </text>
          {Array.from({ length: N_LAYERS }, (_, i) => {
            const m = mixerOf(i)
            const isSel = i === sel
            return (
              <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
                <rect
                  x={cx(i)}
                  y={TOP}
                  width={CW}
                  height={MOE_H - 3}
                  rx={2}
                  fill={COLOR.moe}
                  opacity={isSel ? 1 : 0.55}
                  stroke={isSel ? "var(--foreground)" : "transparent"}
                  strokeWidth={isSel ? 1.4 : 0}
                />
                <rect
                  x={cx(i)}
                  y={TOP + MOE_H}
                  width={CW}
                  height={MIX_H}
                  rx={2}
                  fill={COLOR[m]}
                  opacity={isSel ? 1 : 0.8}
                  stroke={isSel ? "var(--foreground)" : "transparent"}
                  strokeWidth={isSel ? 1.4 : 0}
                />
              </g>
            )
          })}
          <path
            d={`M ${cx(sel) + CW / 2 - 4} ${TOP - 6} L ${cx(sel) + CW / 2 + 4} ${TOP - 6} L ${cx(sel) + CW / 2} ${TOP - 1} Z`}
            fill="var(--foreground)"
          />
          <text x={W - MX} y={14} textAnchor="end" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            layer {sel + 1} · {mixer === "attn" ? "attention" : "Mamba-2"} + MoE
          </text>
        </svg>

        <div className="mt-1">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">scrub layer (drag, or click a column)</div>
          <Range
            min={0}
            max={N_LAYERS - 1}
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={COLOR[mixer]}
            aria-label="Layer"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">sequence mixer</div>
            {mixer === "mamba" ? (
              <div className="mt-1 text-sm leading-6">
                <span style={{ color: COLOR.mamba }} className="font-semibold">Mamba-2</span>
                {": "}32 heads of 64 channels, state size 128, one B/C group, causal conv of width 4, chunk size 256.
                <div className="font-mono text-xs text-muted-foreground">{fmtInt(MAMBA_PARAMS)} parameters, all active</div>
              </div>
            ) : (
              <div className="mt-1 text-sm leading-6">
                <span style={{ color: COLOR.attn }} className="font-semibold">Grouped-query attention</span>
                {": "}16 query heads, 4 KV heads, head dim 64, XSA, no positional encoding; a 4,096-token sliding window in the long-context checkpoints.
                <div className="font-mono text-xs text-muted-foreground">{fmtInt(ATTN_PARAMS)} parameters, all active</div>
              </div>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">MoE feed-forward</div>
            <div className="mt-1 text-sm leading-6">
              128 SwiGLU experts of {fmtInt(EXPERT_PARAMS)} parameters each, plus a {fmtInt(ROUTER_PARAMS)}-parameter router. A token uses 2.
              <div className="font-mono text-xs text-muted-foreground">
                {fmtInt(moeTotal)} stored · {fmtInt(moeActive)} active
              </div>
            </div>
            <svg viewBox="0 0 256 34" className="mt-2 w-full" role="img" aria-label={`Expert ${e1 + 1} and expert ${e2 + 1} of 128 are active for this token (illustrative).`}>
              {Array.from({ length: N_EXPERTS }, (_, e) => {
                const on = e === e1 || e === e2
                return (
                  <rect
                    key={e}
                    x={(e % 32) * 8 + 0.5}
                    y={Math.floor(e / 32) * 8 + 1}
                    width={7}
                    height={7}
                    rx={1}
                    fill={on ? COLOR.moe : "var(--muted-foreground)"}
                    opacity={on ? 1 : 0.18}
                  />
                )
              })}
            </svg>
            <div className="font-mono text-[10px] text-muted-foreground/70">which 2 light up is illustrative; the router picks per token</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">whole model</span>
            {(["total", "active"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  view === v ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "total" ? `stored: ${fmtM(TOTAL)}` : `active per token: ${fmtM(ACTIVE)}`}
              </button>
            ))}
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-md border bg-muted/30">
            {PARTS.map((p) => {
              const n = view === "total" ? p.total : p.active
              return (
                <div
                  key={p.key}
                  title={`${p.label}: ${fmtInt(n)}`}
                  style={{ width: `${((n / scale) * 100).toFixed(3)}%`, background: p.color }}
                  className="h-full transition-all duration-300"
                />
              )
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {PARTS.map((p) => {
              const n = view === "total" ? p.total : p.active
              const denom = view === "total" ? TOTAL : ACTIVE
              return (
                <div key={p.key} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: p.color }} />
                  <span>
                    {p.label} {fmtM(n)} ({((n / denom) * 100).toFixed(1)}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Stored, the model is 86% experts. Active, the experts shrink to 31.5M because a token touches 2 of 128, and the
          sequence mixers become most of the per-token work: 224.2M of the 261.0M active non-embedding parameters. The bar
          keeps the stored total as its scale, so the active view is the slice that actually runs.
        </p>
      </div>
    </figure>
  )
}
