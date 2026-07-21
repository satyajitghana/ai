"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// How five modalities become one token sequence. Understanding tokens (text, and
// vision via a jointly-trained ViT) land in the autoregressive Reasoner
// subsequence; generation tokens (video/image via a frozen Wan2.2 VAE, audio via
// a frozen audio VAE) land in the diffusion Generator subsequence; actions map
// every embodiment into one shared latent action space and can go either way.
// Pick a modality and trace its encoder, its compression, and where it lands.

const AR = "oklch(0.66 0.16 150)" // green — Reasoner / autoregressive
const DM = "oklch(0.7 0.15 55)" // amber — Generator / diffusion

type Stream = "ar" | "dm" | "both"

const MODS = [
  {
    key: "text",
    label: "Language",
    enc: "sub-word tokenizer",
    detail: "Text is tokenized directly and fed to the Reasoner tower as the autoregressive prefix every mode shares.",
    compress: "—",
    stream: "ar" as Stream,
  },
  {
    key: "vision",
    label: "Image / Video (understand)",
    enc: "ViT encoder (Qwen3-VL)",
    detail: "A vision transformer merges 2×2 patches and projects them into the backbone. Unlike the generation VAEs, this encoder is trained jointly with the model.",
    compress: "2×2 patch merge",
    stream: "ar" as Stream,
  },
  {
    key: "video",
    label: "Video / Image (generate)",
    enc: "Wan2.2 video VAE (frozen)",
    detail: "The generation path uses a frozen video VAE: 4× temporal and 32×32 spatial compression (a 16×16 encoder plus a 2×2 patch merge), linearly projected into the transformer.",
    compress: "4× time · 32×32 space",
    stream: "dm" as Stream,
  },
  {
    key: "audio",
    label: "Audio (generate)",
    enc: "audio VAE (frozen)",
    detail: "Raw 48 kHz stereo audio is compressed to latent tokens by a frozen audio VAE and projected into the same hidden space as every other modality.",
    compress: "48 kHz stereo → latent",
    stream: "dm" as Stream,
  },
  {
    key: "action",
    label: "Action",
    enc: "shared latent action space",
    detail: "Actions from diverse embodiments (arms, humanoids, vehicles) are mapped into one shared latent action space, so a single token vocabulary spans every robot — the key to policy and dynamics models.",
    compress: "embodiment-agnostic",
    stream: "both" as Stream,
  },
]

const streamColor = (s: Stream) => (s === "dm" ? DM : AR)
const streamLabel = (s: Stream) =>
  s === "ar" ? "AR · Reasoner" : s === "dm" ? "diffusion · Generator" : "AR + diffusion"

export function TokenStack() {
  const [k, setK] = useState("video")
  const m = MODS.find((x) => x.key === k) ?? MODS[2]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        the encoder stack · five modalities, one token sequence
      </div>
      <div className="p-3 sm:p-4">
        {/* modality tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {MODS.map((x) => {
            const on = x.key === k
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => setK(x.key)}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                  on ? "border-transparent text-background" : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={on ? { background: streamColor(x.stream) } : undefined}
              >
                {x.label}
              </button>
            )
          })}
        </div>

        {/* flow: input → encoder → tokens → subsequence */}
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="font-mono text-[10px] text-muted-foreground">encoder</div>
            <div className="mt-1 font-mono text-sm text-foreground">{m.enc}</div>
            <div className="mt-1.5 font-mono text-[10px]" style={{ color: streamColor(m.stream) }}>
              {m.compress}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <span className="font-mono text-muted-foreground/50">→</span>
          </div>

          <div className="flex flex-col justify-center rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">tokens land in</div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="h-5 w-6 rounded" style={{ background: streamColor(m.stream), opacity: 0.85 }} />
              ))}
            </div>
            <div className="mt-1.5 font-mono text-[11px]" style={{ color: streamColor(m.stream) }}>
              {streamLabel(m.stream)}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{m.detail}</p>

        {/* legend */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: AR }} /> Reasoner subsequence (understanding)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DM }} /> Generator subsequence (generation)
          </span>
        </div>
      </div>
    </figure>
  )
}
