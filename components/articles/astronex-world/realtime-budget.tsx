"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A FLOP count for one 8-latent-frame block of the released causal sampler
// (inference/pipelines/causal_diffusion_inference.py), from the shapes in
// transformer/config.json and the safetensors headers:
//   30 layers, width 3072, FFN 14,336, 390 tokens per latent frame at 832x480
//   (30x52 latents, 2x2 patches), 8 frames per block, a 20-frame KV window,
//   a second self-attention for PRoPE with its own output projection, 512 text
//   tokens read through cross-attention.
// Per denoising step the sampler runs the DiT once with the prompt and once with
// the negative prompt (CFG 3.0), and optionally a third time for camera
// guidance; after the last step it runs a clean pass per branch to commit the
// block's keys and values to the cache.

const L = 30
const D = 3072
const FFN = 14336
const TOK_FRAME = 390
const BLOCK = 8
const WINDOW = 20
const TEXT = 512
const PIX_FRAMES = BLOCK * 4 // the VAE turns each latent frame into 4 output frames
const FPS = 24

const TOK = TOK_FRAME * BLOCK // 3,120 query tokens
const KEYS = TOK_FRAME * WINDOW // 7,800 keys at steady state

// Linear layers a query token passes through, per layer: q,k,v,o; the PRoPE
// output projection; cross-attention q and o (text k,v are cached); the FFN.
const LINEAR_PER_TOKEN = L * (4 * D * D + D * D + 2 * D * D + 2 * D * FFN)
const LINEAR = 2 * LINEAR_PER_TOKEN * TOK
const SELF_ATTN = L * 2 * (2 * 2 * TOK * KEYS * D) // QK^T and AV, RoPE branch + PRoPE branch
const CROSS_ATTN = L * 2 * 2 * TOK * TEXT * D
const PER_FORWARD = LINEAR + SELF_ATTN + CROSS_ATTN

const VIDEO_SECONDS = PIX_FRAMES / FPS

function fmt(n: number, d = 1) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function RealtimeBudget() {
  const [steps, setSteps] = useState<4 | 8>(8)
  const [cfg, setCfg] = useState(true)
  const [camGuide, setCamGuide] = useState(false)
  const [peak, setPeak] = useState(120)
  const [util, setUtil] = useState(50)

  const branches = 1 + (cfg ? 1 : 0) + (camGuide ? 1 : 0)
  const forwards = steps * branches + (1 + (cfg ? 1 : 0))
  const flops = forwards * PER_FORWARD
  const sustained = peak * 1e12 * (util / 100)
  const seconds = flops / sustained
  const fps = PIX_FRAMES / seconds
  const factor = VIDEO_SECONDS / seconds
  const needed = flops / VIDEO_SECONDS / 1e12

  const barMax = Math.max(seconds, VIDEO_SECONDS) * 1.05
  const pct = (v: number) => `${((v / barMax) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one causal block · 8 latent frames = {PIX_FRAMES} frames = {fmt(VIDEO_SECONDS, 2)} s of video</span>
        <span>832x480</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {([8, 4] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSteps(s)}
              className={cn(
                "rounded-md border px-2.5 py-1",
                steps === s ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {s} UniPC steps{s === 8 ? " (released)" : ""}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={cfg}
            onClick={() => setCfg((v) => !v)}
            className={cn("rounded-md border px-2.5 py-1", cfg ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground")}
          >
            CFG 3.0: {cfg ? "on (released)" : "off"}
          </button>
          <button
            type="button"
            aria-pressed={camGuide}
            onClick={() => setCamGuide((v) => !v)}
            className={cn("rounded-md border px-2.5 py-1", camGuide ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground")}
          >
            camera guidance: {camGuide ? "on" : "off (released)"}
          </button>
        </div>

        <label className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="w-44 shrink-0">gpu peak bf16: {peak} TFLOPS</span>
          <Range min={50} max={1000} step={10} value={peak} onChange={(e) => setPeak(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="w-44 shrink-0">achieved utilisation: {util}%</span>
          <Range min={10} max={100} step={5} value={util} onChange={(e) => setUtil(Number(e.target.value))} />
        </label>

        <div className="space-y-2 font-mono text-xs">
          <div>
            <div className="mb-1 flex justify-between text-muted-foreground">
              <span>video this block plays for</span>
              <span>{fmt(VIDEO_SECONDS, 2)} s</span>
            </div>
            <div className="h-3 rounded bg-muted/40">
              <div className="h-3 rounded" style={{ width: pct(VIDEO_SECONDS), background: "oklch(0.66 0.15 165)" }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-muted-foreground">
              <span>time to compute it</span>
              <span>{fmt(seconds, 2)} s</span>
            </div>
            <div className="h-3 rounded bg-muted/40">
              <div
                className="h-3 rounded transition-all duration-300"
                style={{ width: pct(seconds), background: seconds > VIDEO_SECONDS ? "oklch(0.62 0.19 25)" : "oklch(0.66 0.15 165)" }}
              />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
          <div>
            <dt>DiT passes / block</dt>
            <dd className="text-foreground">{forwards}</dd>
          </div>
          <div>
            <dt>TFLOP / pass</dt>
            <dd className="text-foreground">{fmt(PER_FORWARD / 1e12)}</dd>
          </div>
          <div>
            <dt>needed for 24 fps</dt>
            <dd className="text-foreground">{fmt(needed, 0)} TFLOPS</dd>
          </div>
          <div>
            <dt>you get</dt>
            <dd className={cn(factor >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {fmt(fps)} fps ({fmt(factor, 2)}x real time)
            </dd>
          </div>
        </dl>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Counts matrix multiplies only, so it is a floor on the work: no VAE decode, no text encoder, no
          softmax or norms. Utilisation is your guess at how much of the peak the kernels reach; flex-attention
          at these sequence lengths rarely gets near 100%.
        </p>
      </div>
    </figure>
  )
}
