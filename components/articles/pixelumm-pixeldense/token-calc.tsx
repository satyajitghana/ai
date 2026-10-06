"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How many tokens does a picture cost, and how big is each one?
//
// The point the widget makes: a 16-pixel pixel patch and a latent DiT token
// (8x VAE + 2x2 patch) cover the same 16x16 pixels, so the sequence length is
// identical. What changes is the width of each token: 768 raw values against
// 64 latent values. Pixel-space diffusion does not pay in sequence length; it
// pays in how much each token has to carry, which is why it predicts the clean
// patch (x-prediction) instead of the noise.
//
// Only integer arithmetic reaches the DOM (+, *, /, floor), so nothing here
// needs lib/dmath.

const PIX = "oklch(0.62 0.17 30)"
const LAT = "oklch(0.58 0.13 250)"
const MUTED = "oklch(0.62 0.03 250)"

type Row = {
  key: string
  label: string
  who: string
  latent: boolean
  // tokens for a square side s (and f frames in video mode)
  tokens: (s: number, f: number) => number
  values: number
  // the Transformer width it feeds, when the article names one
  width?: number
}

const latentFrames = (f: number) => 1 + Math.floor((f - 1) / 4)

const IMAGE_ROWS: Row[] = [
  {
    key: "p16",
    label: "pixels, 16x16 patch",
    who: "PixelUMM images",
    latent: false,
    tokens: (s) => (s / 16) * (s / 16),
    values: 16 * 16 * 3,
    width: 4096,
  },
  {
    key: "p32",
    label: "pixels, 32x32 patch",
    who: "PixelGen-XXL; PixelUMM F1-R02",
    latent: false,
    tokens: (s) => (s / 32) * (s / 32),
    values: 32 * 32 * 3,
    width: 1536,
  },
  {
    key: "vae8",
    label: "8x VAE, 16 ch, 2x2 patch",
    who: "SD3 / FLUX layout",
    latent: true,
    tokens: (s) => (s / 16) * (s / 16),
    values: 2 * 2 * 16,
  },
  {
    key: "vae16",
    label: "16x VAE, 48 ch, 2x2 patch",
    who: "Wan2.2 VAE; PixelUMM F4-R02",
    latent: true,
    tokens: (s) => (s / 32) * (s / 32),
    values: 2 * 2 * 48,
  },
]

const VIDEO_ROWS: Row[] = [
  {
    key: "tube",
    label: "pixels, 4x16x16 tube",
    who: "PixelUMM video",
    latent: false,
    tokens: (s, f) => Math.floor(f / 4) * (s / 16) * (s / 16),
    values: 4 * 16 * 16 * 3,
    width: 4096,
  },
  {
    key: "frame",
    label: "pixels, 16x16 per frame",
    who: "every frame on its own",
    latent: false,
    tokens: (s, f) => f * (s / 16) * (s / 16),
    values: 16 * 16 * 3,
    width: 4096,
  },
  {
    key: "wan21",
    label: "4x8x8 causal VAE, 16 ch",
    who: "Wan2.1 layout, 1x2x2 patch",
    latent: true,
    tokens: (s, f) => latentFrames(f) * (s / 16) * (s / 16),
    values: 2 * 2 * 16,
  },
  {
    key: "wan22",
    label: "4x16x16 causal VAE, 48 ch",
    who: "Wan2.2 layout, 1x2x2 patch",
    latent: true,
    tokens: (s, f) => latentFrames(f) * (s / 32) * (s / 32),
    values: 2 * 2 * 48,
  },
]

const fmt = (n: number) => n.toLocaleString("en-US")

export function TokenCalc() {
  const [mode, setMode] = useState<"image" | "video">("image")
  const [side, setSide] = useState(512)
  const [frames, setFrames] = useState(96)

  const rows = mode === "image" ? IMAGE_ROWS : VIDEO_ROWS
  const f = mode === "image" ? 1 : frames
  const computed = rows.map((r) => ({ ...r, n: r.tokens(side, f) }))
  const maxN = Math.max(...computed.map((r) => r.n))
  const base = computed[0].n
  const rawValues = side * side * 3 * f

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">tokenizer calculator · pixels vs latents</span>
        <div className="flex gap-1.5">
          {(["image", "video"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="block">
          <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>side (square)</span>
            <span className="tabular-nums text-foreground">
              {side} x {side} px
            </span>
          </span>
          <Range min={256} max={1024} step={64} value={side} onChange={(e) => setSide(Number(e.target.value))} accent={PIX} aria-label="Image side in pixels" />
        </label>
        {mode === "video" ? (
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>frames</span>
              <span className="tabular-nums text-foreground">
                {frames} frames{frames === 96 ? " (4 s at 24 fps)" : ""}
              </span>
            </span>
            <Range min={16} max={192} step={4} value={frames} onChange={(e) => setFrames(Number(e.target.value))} accent={PIX} aria-label="Number of video frames" />
          </label>
        ) : null}

        <div className="font-mono text-[10px] text-muted-foreground">
          raw input: <span className="tabular-nums text-foreground">{fmt(rawValues)}</span> numbers
        </div>

        <div className="space-y-2">
          {computed.map((r) => {
            const over = r.width !== undefined && r.values > r.width
            return (
              <div key={r.key} className="rounded-md border px-2.5 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-mono text-[11px] text-foreground">{r.label}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{r.who}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-3 flex-1 rounded-sm bg-muted/40">
                    <div
                      className="h-3 rounded-sm"
                      style={{ width: `${((r.n / maxN) * 100).toFixed(2)}%`, background: r.latent ? LAT : PIX, opacity: 0.85 }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{fmt(r.n)} tok</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[10px] text-muted-foreground">
                  <span>
                    <span className="tabular-nums" style={{ color: r.latent ? LAT : PIX }}>
                      {fmt(r.values)}
                    </span>{" "}
                    values per token
                  </span>
                  <span>
                    attention pairs x
                    <span className="tabular-nums text-foreground">{((r.n * r.n) / (base * base)).toFixed(r.n < base ? 3 : 2)}</span> vs first row
                  </span>
                  {r.width !== undefined ? (
                    <span style={{ color: over ? PIX : MUTED }}>
                      {over ? "wider than" : "fits in"} a {fmt(r.width)}-wide token
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {mode === "image"
            ? "A 16-pixel patch and an 8x VAE with 2x2 patches give the same number of tokens. The pixel token is 12 times wider: 768 raw values against 64 latent ones. Pixel diffusion pays in token width, not sequence length."
            : "Tubes of 4 frames cut the token count by 4 against per-frame patches. Causal video VAEs keep the first frame on its own, so their latent has 1 + (F - 1) / 4 frames, rounded down."}
        </div>
      </div>
    </figure>
  )
}
