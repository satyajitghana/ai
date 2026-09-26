"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What one page costs TeleOCR to *read* (prefill only), from the checkpoint's
// own shapes and the released pipeline's own constants. Everything here is
// arithmetic, not a measurement:
//
//   - Qwen2.5-VL dynamic resolution (preprocessor_config.json): 14 px patches,
//     2x2 merged into one language-model token, so one token = 28x28 px;
//     sides rounded to a multiple of 28; 3,136 <= pixels <= 12,845,056.
//   - Layout pass (TeleOCR_client.py): the page is resized to 1036x1036,
//     37 x 37 = 1,369 tokens, whatever its aspect ratio.
//   - Crop pass: every layout block is cropped from the full-resolution page
//     and read at its own resolution. The crop sizes are an assumption here:
//     `coverage` of the page area, split evenly over `blocks` crops.
//   - FLOPs (2 per multiply-add), from the safetensors headers:
//       vision blocks + patch embed 631,975,680 params, run per 14 px PATCH
//       (4 patches per token); aligner 31,464,704 per token; language model
//       440,466,432 non-embedding params per token. Attention: 4 global
//       vision layers (16 heads x 80) and 28 windowed ones (64-patch windows);
//       28 causal language layers (16 query heads x 128).
//   - ~30 text tokens of chat template + instruction per call (reasoned).
// Decode (the output tokens) is not included: it depends on how much text a
// page holds, and the paper publishes no throughput numbers to check it by.

const F = 28
const MAX_PX = 12845056
const MIN_PX = 3136
const LAYOUT_TOKENS = 37 * 37
const PROMPT_TOKENS = 30

const VIT = 631975680
const MERGER = 31464704
const LM = 440466432

type Preset = "a4" | "letter" | "photo"

const PRESETS: Record<Preset, { label: string; w: number; h: number; unit: "in" | "px" }> = {
  a4: { label: "A4 scan", w: 8.27, h: 11.69, unit: "in" },
  letter: { label: "US Letter scan", w: 8.5, h: 11, unit: "in" },
  photo: { label: "12 MP phone photo", w: 3024, h: 4032, unit: "px" },
}

// Qwen2-VL's smart_resize, as the processor applies it.
function smartResize(h: number, w: number): { h: number; w: number; tokens: number } {
  let hb = Math.max(F, Math.round(h / F) * F)
  let wb = Math.max(F, Math.round(w / F) * F)
  if (hb * wb > MAX_PX) {
    const beta = Math.sqrt((h * w) / MAX_PX)
    hb = Math.floor(h / beta / F) * F
    wb = Math.floor(w / beta / F) * F
  } else if (hb * wb < MIN_PX) {
    const beta = Math.sqrt(MIN_PX / (h * w))
    hb = Math.ceil((h * beta) / F) * F
    wb = Math.ceil((w * beta) / F) * F
  }
  return { h: hb, w: wb, tokens: (hb / F) * (wb / F) }
}

type Cost = { vitLin: number; vitAttn: number; lm: number }

// One forward pass over an image of `t` merged tokens plus the prompt.
function passCost(t: number): Cost {
  const p = 4 * t
  const vitLin = 2 * VIT * p + 2 * MERGER * t
  const vitAttn = 28 * 5120 * 64 * p + 4 * 5120 * p * p
  const l = t + PROMPT_TOKENS
  const lm = 2 * LM * l + 28 * 4096 * l * l
  return { vitLin, vitAttn, lm }
}

const add = (a: Cost, b: Cost, k = 1): Cost => ({
  vitLin: a.vitLin + k * b.vitLin,
  vitAttn: a.vitAttn + k * b.vitAttn,
  lm: a.lm + k * b.lm,
})
const total = (c: Cost) => c.vitLin + c.vitAttn + c.lm

function commas(n: number): string {
  const s = String(Math.round(n))
  let out = ""
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ","
    out += s[i]
  }
  return out
}
const tf = (flops: number) => (flops / 1e12).toFixed(1)

const C_VIT = "oklch(0.62 0.15 250)"
const C_ATT = "oklch(0.7 0.15 60)"
const C_LM = "oklch(0.64 0.13 160)"

export function PageTokenBudget() {
  const [preset, setPreset] = useState<Preset>("a4")
  const [dpi, setDpi] = useState(200)
  const [coverage, setCoverage] = useState(60)
  const [blocks, setBlocks] = useState(25)

  const p = PRESETS[preset]
  const W = p.unit === "in" ? Math.round(p.w * dpi) : p.w
  const H = p.unit === "in" ? Math.round(p.h * dpi) : p.h

  const whole = smartResize(H, W)
  const cropTokens = Math.max(4, Math.round(((coverage / 100) * W * H) / (F * F) / blocks))

  const layout = passCost(LAYOUT_TOKENS)
  const decoupled = add(layout, passCost(cropTokens), blocks)
  const onePass = passCost(whole.tokens)

  const dVisual = LAYOUT_TOKENS + blocks * cropTokens
  const dTotal = total(decoupled)
  const oTotal = total(onePass)
  const max = Math.max(dTotal, oTotal)
  const visionShare = ((decoupled.vitLin + decoupled.vitAttn) / dTotal) * 100

  const bars: { key: string; label: string; c: Cost; sum: number }[] = [
    { key: "d", label: "TeleOCR, layout + crops", c: decoupled, sum: dTotal },
    { key: "o", label: "Same encoder, whole page once", c: onePass, sum: oTotal },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        One page, two passes &middot; visual tokens and prefill compute, reasoned from the checkpoint&rsquo;s shapes
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESETS) as Preset[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              aria-pressed={preset === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                preset === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {PRESETS[k].label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>scan DPI</span>
              <span className="text-foreground">{p.unit === "px" ? "n/a" : dpi}</span>
            </span>
            <Range
              min={100}
              max={300}
              step={25}
              value={dpi}
              disabled={p.unit === "px"}
              onChange={(e) => setDpi(Number(e.target.value))}
              aria-label="Scan resolution in dots per inch"
            />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>area inside blocks</span>
              <span className="text-foreground">{coverage}%</span>
            </span>
            <Range
              min={20}
              max={90}
              step={5}
              value={coverage}
              onChange={(e) => setCoverage(Number(e.target.value))}
              aria-label="Share of the page area covered by layout blocks"
            />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>layout blocks</span>
              <span className="text-foreground">{blocks}</span>
            </span>
            <Range
              min={3}
              max={60}
              step={1}
              value={blocks}
              onChange={(e) => setBlocks(Number(e.target.value))}
              aria-label="Number of layout blocks on the page"
            />
          </label>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">page</dt>
            <dd className="text-foreground">
              {commas(W)} &times; {commas(H)} px
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">layout pass</dt>
            <dd className="text-foreground">{commas(LAYOUT_TOKENS)} tokens</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">crop pass</dt>
            <dd className="text-foreground">
              {blocks} &times; ~{commas(cropTokens)} = {commas(blocks * cropTokens)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">whole page once</dt>
            <dd className="text-foreground">{commas(whole.tokens)} tokens</dd>
          </div>
        </dl>

        <div className="space-y-2.5">
          {bars.map((b) => {
            const seg = [
              { v: b.c.vitLin, color: C_VIT },
              { v: b.c.vitAttn, color: C_ATT },
              { v: b.c.lm, color: C_LM },
            ]
            return (
              <div key={b.key}>
                <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{b.label}</span>
                  <span className="text-foreground tabular-nums">{tf(b.sum)} TFLOP</span>
                </div>
                <div className="mt-1 flex h-4 w-full overflow-hidden rounded-sm bg-muted/40">
                  {seg.map((s, i) => (
                    <div
                      key={i}
                      style={{ width: `${((s.v / max) * 100).toFixed(2)}%`, background: s.color }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
            <span>
              <span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C_VIT }} />
              vision matmuls
            </span>
            <span>
              <span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C_ATT }} />
              vision attention
            </span>
            <span>
              <span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C_LM }} />
              Qwen3 language model
            </span>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          TeleOCR reads{" "}
          <span className="text-foreground">{commas(dVisual)}</span> visual tokens for this page against{" "}
          <span className="text-foreground">{commas(whole.tokens)}</span> for one pass over the whole thing, and the
          vision encoder does <span className="text-foreground">{visionShare.toFixed(0)}%</span> of its prefill
          arithmetic. The crops keep the four global-attention layers of the encoder cheap: their cost grows with the
          square of each image&rsquo;s patch count, and a crop is a small image.
        </p>
        <p className="font-mono text-[10px] leading-4 text-muted-foreground">
          Reasoned, not measured. Crops are assumed equal in size; real ones are rounded to 28 px each and are not.
          Output tokens (the decode) are not counted at all.
        </p>
      </div>
    </figure>
  )
}
