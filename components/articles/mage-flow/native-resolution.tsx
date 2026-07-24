"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One checkpoint, no resolution buckets. Images of any size and aspect ratio are
// flattened into variable-length latent token sequences and packed together;
// per-sample 2D-RoPE and variable-length FlashAttention preserve each image's
// native spatial layout. So a single model covers 512→2048 on any ratio, up to
// an extreme 4:1. Pick a canvas. Token counts are illustrative (∝ pixels/256).

const ACCENT = "oklch(0.62 0.17 300)"

const PRESETS = [
  { w: 512, h: 512, label: "512²" },
  { w: 1024, h: 1024, label: "1024²" },
  { w: 2048, h: 2048, label: "2048²" },
  { w: 1536, h: 1024, label: "3:2" },
  { w: 512, h: 2048, label: "1:4 tall" },
  { w: 2048, h: 512, label: "4:1 wide" },
]

const MAXBOX = 200

export function NativeResolution() {
  const [i, setI] = useState(1)
  const p = PRESETS[i]
  const scale = MAXBOX / Math.max(p.w, p.h)
  const bw = Math.round(p.w * scale)
  const bh = Math.round(p.h * scale)
  const tokens = Math.round((p.w * p.h) / 256) // one latent token per 16×16 px patch (illustrative)
  const g = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const dv = gcd(p.w, p.h)
  const ratio = `${p.w / dv} : ${p.h / dv}`

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one checkpoint · native resolution 512→2048</span>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((x, k) => (
            <button key={x.label} type="button" onClick={() => setI(k)} className={chip(k === i)}>{x.label}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex min-h-[220px] items-center justify-center rounded-lg border bg-muted/10 p-4">
          <div
            className="flex items-center justify-center rounded-md border-2 font-mono text-[10px] transition-all duration-300"
            style={{ width: bw, height: bh, borderColor: ACCENT, background: "color-mix(in oklch, " + ACCENT + " 12%, transparent)", color: ACCENT }}
          >
            {p.w}×{p.h}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">resolution</div>
            <div className="mt-0.5 text-sm tabular-nums text-foreground">{p.w}×{p.h}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">aspect ratio</div>
            <div className="mt-0.5 text-sm tabular-nums" style={{ color: ACCENT }}>{ratio}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">≈ latent tokens</div>
            <div className="mt-0.5 text-sm tabular-nums text-foreground">{g(tokens)}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          No fixed-resolution buckets and no center-crop: each image becomes a <span style={{ color: ACCENT }}>variable-length</span>{" "}
          token sequence at its true shape, and the batch packs different shapes together. That&rsquo;s what lets one 4B
          model span 512² to 2048² and a 4:1 panorama without retraining.
        </p>
      </div>
    </figure>
  )
}
