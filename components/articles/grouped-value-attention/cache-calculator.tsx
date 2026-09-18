"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The number a practitioner actually wants: bytes, not "45–47% of scalars." Straight
// from the paper's own per-layer, per-token scalar counts (Eqs. 3, 4, 13):
//
//   GQA   N = 2 · T · (G·d_h)             — a grouped key stream AND a grouped value stream
//   MLA   N = T · (d_c + d_r)             — one joint latent + a small shared RoPE slice
//   GVA   N = T · (G·d_h + d_r)           — grouped values + a small shared RoPE slice
//
// Only the PRODUCT G·d_h (the grouped key/value width) enters either formula — how it
// splits between group count and head width doesn't change the byte count — so that
// product is a single slider. Same for MLA's d_c + d_r. Multiply by layers × batch ×
// bytes-per-scalar (bf16 = 2) to get real serving memory.
//
// Defaults: G·d_h = 1024 is 8 KV heads × 128 head-dim — the actual GQA config of both
// Llama-3-8B and Llama-2-70B. MLA width 576 is DeepSeek-V2's own reported d_c=512,
// d_r=64. GVA's d_r toggles between the paper's two tested widths, 16 and 24.

const GQA_C = "oklch(0.62 0.02 260)"
const GVA_C = "oklch(0.72 0.15 195)"
const MLA_C = "oklch(0.62 0.15 250)"
const BYTES_PER_SCALAR = 2 // bf16

const LAYER_PRESETS = [
  { id: 32, label: "32 layers", sub: "~8B-class" },
  { id: 80, label: "80 layers", sub: "~70B-class" },
] as const

const DR_OPTIONS = [16, 24] as const

function fmtGB(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`
  if (gb >= 10) return `${gb.toFixed(1)} GB`
  return `${gb.toFixed(2)} GB`
}

// ── chart geometry ──
const W = 640
const H = 230
const PL = 52
const PR = 16
const PT = 14
const PB = 32
const MAXK = 128 // chart's right edge, thousands of tokens

export function CacheCalculator() {
  const [ctxK, setCtxK] = useState(32)
  const [batch, setBatch] = useState(32)
  const [layers, setLayers] = useState<32 | 80>(32)
  const [kvWidth, setKvWidth] = useState(1024) // G · d_h
  const [mlaWidth, setMlaWidth] = useState(576) // d_c + d_r
  const [dr, setDr] = useState<16 | 24>(16)

  const scalars = {
    gqa: 2 * kvWidth,
    gva: kvWidth + dr,
    mla: mlaWidth,
  }

  // bytes for T tokens (T given in thousands, i.e. ctxK), at current layers/batch
  const bytesAt = (perTokenPerLayer: number, k: number) =>
    (perTokenPerLayer * layers * (k * 1024) * batch * BYTES_PER_SCALAR) / 1e9

  const gGQA = bytesAt(scalars.gqa, ctxK)
  const gGVA = bytesAt(scalars.gva, ctxK)
  const gMLA = bytesAt(scalars.mla, ctxK)

  const savedGVA = (1 - scalars.gva / scalars.gqa) * 100
  const savedMLA = (1 - scalars.mla / scalars.gqa) * 100

  // chart endpoints at the right edge (MAXK), for the three lines
  const endGQA = bytesAt(scalars.gqa, MAXK)
  const endGVA = bytesAt(scalars.gva, MAXK)
  const endMLA = bytesAt(scalars.mla, MAXK)
  const maxGB = Math.max(endGQA, endGVA, endMLA) * 1.04

  const sx = (k: number) => PL + (k / MAXK) * (W - PL - PR)
  const sy = (gb: number) => PT + (1 - Math.min(gb, maxGB) / maxGB) * (H - PT - PB)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        KV cache size vs context length · GQA vs GVA vs MLA
      </div>

      <div className="p-4 sm:p-5">
        {/* readout */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">
              context · batch · layers
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {ctxK}K<span className="text-base text-muted-foreground"> tok</span>
              <span className="text-base text-muted-foreground"> · </span>
              {batch}
              <span className="text-base text-muted-foreground"> · </span>
              {layers}L
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: GQA_C }}>
                GQA
              </div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: GQA_C }}>
                {fmtGB(gGQA)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: GVA_C }}>
                GVA (−{savedGVA.toFixed(0)}%)
              </div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: GVA_C }}>
                {fmtGB(gGVA)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: MLA_C }}>
                MLA (−{savedMLA.toFixed(0)}%)
              </div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: MLA_C }}>
                {fmtGB(gMLA)}
              </div>
            </div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At ${ctxK}K tokens, batch ${batch}, ${layers} layers: GQA needs ${fmtGB(gGQA)}, GVA needs ${fmtGB(gGVA)} (${savedGVA.toFixed(0)}% less), MLA needs ${fmtGB(gMLA)} (${savedMLA.toFixed(0)}% less).`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line
                x1={PL}
                x2={W - PR}
                y1={sy(g * maxGB)}
                y2={sy(g * maxGB)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={PL - 7}
                y={sy(g * maxGB) + 3}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {fmtGB(g * maxGB)}
              </text>
            </g>
          ))}
          {[0, 32, 64, 96, 128].map((k) => (
            <text
              key={k}
              x={sx(k)}
              y={H - PB + 15}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              {k}K
            </text>
          ))}
          <text
            x={(PL + W - PR) / 2}
            y={H - 2}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            context length →
          </text>

          <path
            d={`M ${sx(0)} ${sy(0)} L ${sx(MAXK)} ${sy(endGQA)}`}
            fill="none"
            stroke={GQA_C}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M ${sx(0)} ${sy(0)} L ${sx(MAXK)} ${sy(endMLA)}`}
            fill="none"
            stroke={MLA_C}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M ${sx(0)} ${sy(0)} L ${sx(MAXK)} ${sy(endGVA)}`}
            fill="none"
            stroke={GVA_C}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <text x={sx(114)} y={sy((endGQA * 114) / MAXK) - 6} textAnchor="end" className="font-mono" fontSize={9.5} fill={GQA_C}>
            GQA
          </text>
          <text x={sx(102)} y={sy((endGVA * 102) / MAXK) - 6} textAnchor="end" className="font-mono" fontSize={9.5} fill={GVA_C}>
            GVA
          </text>
          <text x={sx(90)} y={sy((endMLA * 90) / MAXK) + 12} textAnchor="end" className="font-mono" fontSize={9.5} fill={MLA_C}>
            MLA
          </text>

          <line
            x1={sx(ctxK)}
            y1={PT}
            x2={sx(ctxK)}
            y2={H - PB}
            stroke="currentColor"
            className="text-foreground/25"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <circle cx={sx(ctxK)} cy={sy(gGQA)} r={4} fill={GQA_C} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={sx(ctxK)} cy={sy(gGVA)} r={4} fill={GVA_C} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={sx(ctxK)} cy={sy(gMLA)} r={4} fill={MLA_C} stroke="var(--background)" strokeWidth={1.5} />
        </svg>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>context length</span>
              <span className="text-foreground">{ctxK}K tok</span>
            </span>
            <Range min={1} max={MAXK} step={1} value={ctxK} onChange={(e) => setCtxK(+e.target.value)} className="w-full cursor-pointer" accent={GVA_C} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>batch size</span>
              <span className="text-foreground">{batch}</span>
            </span>
            <Range min={1} max={64} step={1} value={batch} onChange={(e) => setBatch(+e.target.value)} className="w-full cursor-pointer" accent={GVA_C} />
          </label>
        </div>

        {/* model config */}
        <div className="mt-4 rounded-lg border border-dashed p-3">
          <div className="mb-2.5 font-mono text-[10px] text-muted-foreground">model config</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>grouped KV width, G·d_h</span>
                <span className="text-foreground">{kvWidth}</span>
              </span>
              <Range min={256} max={2048} step={64} value={kvWidth} onChange={(e) => setKvWidth(+e.target.value)} className="w-full cursor-pointer" accent={GQA_C} />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>MLA width, d_c+d_r</span>
                <span className="text-foreground">{mlaWidth}</span>
              </span>
              <Range min={256} max={1024} step={32} value={mlaWidth} onChange={(e) => setMlaWidth(+e.target.value)} className="w-full cursor-pointer" accent={MLA_C} />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">layers</span>
              {LAYER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLayers(p.id)}
                  aria-pressed={layers === p.id}
                  className={cn(
                    "cursor-pointer rounded-md border border-transparent px-2 py-1 font-mono text-[10px] transition-colors",
                    layers === p.id ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  style={layers === p.id ? { background: GQA_C } : undefined}
                >
                  {p.label} · {p.sub}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">GVA d_r</span>
              {DR_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDr(d)}
                  aria-pressed={dr === d}
                  className={cn(
                    "cursor-pointer rounded-md border border-transparent px-2 py-1 font-mono text-[10px] transition-colors",
                    dr === d ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  style={dr === d ? { background: GVA_C } : undefined}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          At the default 8-KV-head / 128-dim width (Llama-3-8B and Llama-2-70B both use it), GVA saves{" "}
          <span className="text-foreground">{savedGVA.toFixed(0)}%</span>{" "}of GQA&rsquo;s cache — a bit better than the paper&rsquo;s own 45–47%, because the fixed{" "}
          {dr}-scalar positional slice is a smaller tax on a wider cache. MLA, at DeepSeek-V2&rsquo;s own reported width, saves{" "}
          <span className="text-foreground">{savedMLA.toFixed(0)}%</span>{" "}— comfortably more than GVA at any width tested here.
          None of this counts the reconstruction map <code>M</code>: it is a model weight, absorbed into the query once
          per decoded token, and never touches the cache.
        </p>
      </div>
    </figure>
  )
}
