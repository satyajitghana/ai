"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 307 GB you download, split by who trained it.
//
// Sizes are the ones the repo's own checkpoint table gives. The "origin" column
// is from the same table: the text encoder is Qwen/Qwen3.5-27B, the video VAE
// comes from Wan-AI/Wan2.2-TI2V-5B, and the audio VAE is
// stable-audio-open-1.0. Only the two transformers are described as "released
// with MAGI-2".

type Part = {
  dir: string
  gb: number
  own: boolean
  what: string
  origin: string
}

const PARTS: Part[] = [
  { dir: "preview/", gb: 228, own: true, what: "The 114B MoE transformer that does the generating — 56 shards.", origin: "trained by Sand AI, released with MAGI-2" },
  { dir: "text_encoder/", gb: 56, own: false, what: "Encodes the prompt. Its output width, 5120, is the text_in_channels the transformer expects.", origin: "Qwen/Qwen3.5-27B" },
  { dir: "refiner/", gb: 14, own: true, what: "Second-stage transformer: takes the 512×896 preview to 1088×1920 in 5 denoising steps.", origin: "trained by Sand AI, released with MAGI-2" },
  { dir: "stable-audio-open-1.0/", gb: 5, own: false, what: "Decodes the generated audio latents into waveform.", origin: "Stability AI" },
  { dir: "vae/", gb: 3, own: false, what: "Video VAE. Stride [8, 16, 16] and z_dim 48 — the 48 channels the video embedder takes.", origin: "Wan-AI/Wan2.2-TI2V-5B" },
  { dir: "turbo_vae/", gb: 2, own: true, what: "Distilled VAE decoder, on by default (use_turbo_vae: true). The one place a distilled model already ships.", origin: "distilled by Sand AI" },
]

const TOTAL = PARTS.reduce((a, p) => a + p.gb, 0)
const OWN = PARTS.filter((p) => p.own).reduce((a, p) => a + p.gb, 0)

const OWNC = "oklch(0.60 0.15 255)"
const EXT = "oklch(0.68 0.13 85)"

export function CheckpointLedger() {
  const [sel, setSel] = useState(0)
  const p = PARTS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">{TOTAL} GB to download</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {Math.round((OWN / TOTAL) * 100)}% trained by Sand AI
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex h-12 overflow-hidden rounded-lg border">
          {PARTS.map((x, i) => (
            <button
              key={x.dir}
              type="button"
              aria-label={x.dir}
              onClick={() => setSel(i)}
              className="cursor-pointer border-r border-background/40 transition-opacity last:border-r-0"
              style={{
                width: `${(x.gb / TOTAL) * 100}%`,
                background: x.own ? OWNC : EXT,
                opacity: i === sel ? 1 : 0.55,
              }}
            />
          ))}
        </div>

        <div className="mt-2 space-y-0.5">
          {PARTS.map((x, i) => (
            <button
              key={x.dir}
              type="button"
              onClick={() => setSel(i)}
              className={cn(
                "flex w-full cursor-pointer items-baseline gap-2 rounded px-1.5 py-1 text-left transition-colors",
                i === sel ? "bg-muted/50" : "hover:bg-muted/25",
              )}
            >
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: x.own ? OWNC : EXT }}
              />
              <span className="w-44 shrink-0 truncate font-mono text-[10px] text-foreground">{x.dir}</span>
              <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {x.gb} GB
              </span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">{x.origin}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: p.own ? OWNC : EXT }}>
            {p.dir} — {p.gb} GB · {p.origin}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{p.what}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          <span className="text-foreground">64 of the 307 GB is other people&rsquo;s models</span> — a Qwen text
          encoder, Wan 2.2&rsquo;s video VAE, Stability&rsquo;s audio VAE — and the repo says so plainly, linking
          each one. That is the normal shape of a video model now: the hard, expensive, novel part is the
          generative transformer, and the perception stack around it is assembled from whatever is best and
          open. Worth knowing before you call this a from-scratch 114B release.
        </p>
      </div>
    </figure>
  )
}
