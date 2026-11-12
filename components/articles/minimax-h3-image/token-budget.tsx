"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How many rows MiniMax-H3-Image's transformer sees, and what one sampling step
// costs, for a given canvas, prompt length and set of edit references.
//
// Every constant is read from the release, not guessed:
//   transformer/config.json      hidden 5376, 50 layers, 56 heads x 128 = 7168
//                                attention width, FFN 14336 (SwiGLU), 2 refiner
//                                layers, patch (1, 2, 2)
//   transformer safetensors      per block: qkv 21504x5376, out 5376x7168,
//   headers (HTTP range reads)   fc1 28672x5376, fc2 5376x14336
//                                -> 385,351,680 weights touched by every row
//   vae_diffusers/config.json    spatial downsample 2*2*2*2 = 16
//   diffusers modular pipeline   min_generation_area 2048^2, references resized
//                                to a short edge in [1024, 2048] for the VAE and
//                                to 1024 for the Qwen3-VL vision tower
//                                (16 px patches, 2x2 merge = 32 px per token)
//
// FLOPs per step = 50 * (2 * N * 385.35M + 4 * N^2 * 7168), plus the two
// refiner blocks over the text rows. The 4*N^2*d term is QK^T and AV. The
// AdaLN projections are left out: they run once per timestep, not per row.

const P_ROW = 385_351_680
const LAYERS = 50
const D_ATTN = 7168
const HEADS = 56
const STEPS = 6
const MIN_AREA = 2048 * 2048

type Size = { key: string; label: string; w: number; h: number }
const SIZES: Size[] = [
  { key: "1k", label: "1024²", w: 1024, h: 1024 },
  { key: "2k", label: "2048²", w: 2048, h: 2048 },
  { key: "16-9", label: "5472×3072", w: 5472, h: 3072 },
  { key: "4k", label: "4096²", w: 4096, h: 4096 },
  { key: "21-9", label: "6272×2688", w: 6272, h: 2688 },
]
const REF_EDGES = [1024, 1536, 2048]

const ACCENT = "oklch(0.62 0.15 300)"
const WARM = "oklch(0.70 0.13 70)"
const COOL = "oklch(0.62 0.12 220)"

function canvas(w: number, h: number): { w: number; h: number; scaled: boolean } {
  if (w * h >= MIN_AREA) return { w, h, scaled: false }
  const s = Math.sqrt(MIN_AREA / (w * h))
  return { w: Math.round((w * s) / 32) * 32, h: Math.round((h * s) / 32) * 32, scaled: true }
}

function stepFlops(n: number, text: number) {
  const lin = LAYERS * 2 * n * P_ROW
  const att = LAYERS * 4 * n * n * D_ATTN
  const refiner = 2 * (2 * text * P_ROW + 4 * text * text * D_ATTN)
  return { lin, att, total: lin + att + refiner }
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

function Pills<T extends string | number>({
  label,
  options,
  value,
  onChange,
  fmt,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  fmt: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            value === o
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {fmt(o)}
        </button>
      ))}
    </div>
  )
}

export function TokenBudget() {
  const [sizeKey, setSizeKey] = useState("4k")
  const [text, setText] = useState(512)
  const [refs, setRefs] = useState(0)
  const [refEdge, setRefEdge] = useState(1024)

  const size = SIZES.find((s) => s.key === sizeKey) ?? SIZES[3]
  const c = canvas(size.w, size.h)
  const target = (c.w / 32) * (c.h / 32)
  const refLatent = refs * (refEdge / 32) * (refEdge / 32)
  const refVision = refs * 1024
  const n = text + refVision + refLatent + target
  const f = stepFlops(n, text + refVision)
  const base = stepFlops(1024 + text, text)
  const attShare = f.att / (f.att + f.lin)
  const naiveScoresGB = (n * n * HEADS * 2) / 1e9

  const parts = [
    { v: text, color: COOL, label: "prompt tokens" },
    { v: refVision, color: "oklch(0.72 0.08 220)", label: "reference vision tokens" },
    { v: refLatent, color: WARM, label: "reference latent rows" },
    { v: target, color: ACCENT, label: "rows being generated" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one packed sequence · {fmtInt(n)} rows
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          constants from the released config and headers
        </span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <Pills label="canvas" options={SIZES.map((s) => s.key)} value={sizeKey} onChange={setSizeKey} fmt={(k) => SIZES.find((s) => s.key === k)?.label ?? k} />
        <Pills label="ref edge" options={REF_EDGES} value={refEdge} onChange={setRefEdge} fmt={(v) => `${v} px`} />

        <label className="flex items-center gap-3 pt-1">
          <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            prompt
          </span>
          <Range min={64} max={4096} step={64} value={text} onChange={(e) => setText(Number(e.target.value))} aria-label="prompt tokens" />
          <span className="w-24 shrink-0 text-right font-mono text-[11px]">{text} tokens</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            references
          </span>
          <Range min={0} max={16} step={1} value={refs} onChange={(e) => setRefs(Number(e.target.value))} aria-label="reference images" />
          <span className="w-24 shrink-0 text-right font-mono text-[11px]">{refs} images</span>
        </label>

        <div className="pt-3">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>the sequence, in packed order</span>
            <span>{c.scaled ? `generated on a ${c.w}×${c.h} canvas, resized back` : `${c.w}×${c.h} canvas`}</span>
          </div>
          <div className="flex h-5 w-full overflow-hidden rounded-md border bg-muted/20">
            {parts
              .filter((p) => p.v > 0)
              .map((p) => (
                <div
                  key={p.label}
                  title={`${p.label}: ${fmtInt(p.v)}`}
                  style={{ width: `${((p.v / n) * 100).toFixed(2)}%`, background: p.color }}
                  className="h-full border-r border-background/60 last:border-r-0"
                />
              ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-muted-foreground">
            {parts.map((p) => (
              <span key={p.label}>
                <span style={{ color: p.color }}>■</span> {p.label} {fmtInt(p.v)}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>where one step&apos;s arithmetic goes</span>
            <span>attention {(attShare * 100).toFixed(0)}%</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-md border bg-muted/20">
            <div style={{ width: `${((1 - attShare) * 100).toFixed(2)}%`, background: COOL }} className="h-full" />
            <div style={{ width: `${(attShare * 100).toFixed(2)}%`, background: ACCENT }} className="h-full" />
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            <span style={{ color: COOL }}>■</span> matrix multiplies, linear in rows{" "}
            <span style={{ color: ACCENT }}>■</span> attention scores and mixing, quadratic in rows
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">per step</dt>
            <dd>{(f.total / 1e12).toFixed(0)} TFLOP</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">six steps</dt>
            <dd>{((STEPS * f.total) / 1e15).toFixed(2)} PFLOP</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">vs a 1024² image</dt>
            <dd>{(f.total / base.total).toFixed(1)}×</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">score matrix, one layer, if stored</dt>
            <dd>{naiveScoresGB.toFixed(0)} GB</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {c.scaled
            ? "Anything under 2048² is generated on a 2048²-area canvas first, so a small request costs about what a 4 MP one does."
            : "A fused attention kernel never stores the score matrix; the last tile shows why it has to."}{" "}
          The 1024² baseline is the transformer at 1,024 rows, which the default pipeline never runs.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Rows and FLOPs from the released config and safetensors headers. A reference is taken as a square
        at the chosen edge: its VAE copy adds (edge/32)² rows and its 1024 px vision copy adds 1,024
        tokens to the text stream. The prompt length is yours to set; MiniMax&apos;s example prompt is 256
        words, a few hundred tokens. Counts arithmetic only, not memory traffic or kernel efficiency.
      </figcaption>
    </figure>
  )
}
