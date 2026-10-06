"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One Kandinsky 6.0 Video clip as two token streams on a shared clock.
//
// Every constant is read from the release, not guessed:
// - Video: Hunyuan VAE, 8x spatial and 4x temporal compression, 16 channels
//   (vae/config.json); DiT patch (1, 2, 2) (transformer/config.json). So one
//   video token is a 16 x 16 pixel patch of one latent frame, and T latent
//   frames decode to 4(T - 1) + 1 pixel frames at 24 fps (pipeline.py).
// - Audio: MMAudio VAE at 44,100 Hz with downsample_factor 1024, 40 channels,
//   no patching: one latent frame is one token (audio_vae/config.json,
//   dit.py: audio_embeddings = TextEmbeddings(in_audio_dim, model_dim_a)).
//   Length is ceil(frames / 24 * 44100 / 1024) (prepare_latents.py).
// - RoPE: video latent frame k gets temporal position k; audio token a gets
//   position a on a 1-D RoPE whose frequencies are all multiplied by
//   audio_freqs_scaling = 0.144 (rope.py, transformer/config.json).
// - Stream parameters: measured from the safetensors headers of
//   Kandinsky-6.0-Lite-5s-Diffusers and Kandinsky-6.0-Pro-distill-5s-Diffusers.
//
// Arithmetic is + - * / and Math.ceil/floor only, all exact, so no lib/dmath.

const FPS = 24
const SR = 44100
const HOP = 1024
const TOK_PX = 16
const ROPE_SCALE = 0.144

type Res = { id: string; w: number; h: number; note: string }
const RESOLUTIONS: Res[] = [
  { id: "864x480", w: 864, h: 480, note: "SD landscape, the release default" },
  { id: "480x864", w: 480, h: 864, note: "SD portrait" },
  { id: "512x512", w: 512, h: 512, note: "SD square" },
  { id: "768x512", w: 768, h: 512, note: "the RL rollout size" },
]

type Model = { id: string; label: string; video: number; audio: number; cross: number }
const MODELS: Model[] = [
  { id: "lite", label: "Lite", video: 1909391360, audio: 543657984, cross: 595152896 },
  { id: "pro", label: "Pro", video: 18375260160, audio: 4909455360, cross: 5664921600 },
]

const fmt = (n: number) => n.toLocaleString("en-US")
const sci = (n: number) => {
  if (n < 1e6) return fmt(Math.round(n))
  if (n < 1e9) return `${(n / 1e6).toFixed(1)} M`
  if (n < 1e12) return `${(n / 1e9).toFixed(2)} G`
  return `${(n / 1e12).toFixed(2)} T`
}

// Pixel-frame span [start, end) of video latent frame k: the causal VAE keeps
// frame 0 alone, then packs four frames per latent.
const latentSpan = (k: number): [number, number] =>
  k === 0 ? [0, 1] : [4 * k - 3, 4 * k + 1]

export function ClipTimeline() {
  const [resIdx, setResIdx] = useState(0)
  const [modelIdx, setModelIdx] = useState(1)
  const [T, setT] = useState(31)
  const [sel, setSel] = useState(15)

  const res = RESOLUTIONS[resIdx]
  const model = MODELS[modelIdx]
  const k = Math.min(sel, T - 1)

  const frames = 4 * (T - 1) + 1
  const seconds = frames / FPS
  const audioTokens = Math.ceil(((frames / FPS) * SR) / HOP)
  const audioSec = (audioTokens * HOP) / SR
  const perFrame = (res.w / TOK_PX) * (res.h / TOK_PX)
  const videoTokens = perFrame * T
  const ratio = videoTokens / audioTokens

  // Which audio tokens overlap latent frame k in time.
  const [f0, f1] = latentSpan(k)
  const t0 = f0 / FPS
  const t1 = Math.min(f1, frames) / FPS
  const a0 = Math.floor((t0 * SR) / HOP)
  const a1 = Math.min(audioTokens - 1, Math.ceil((t1 * SR) / HOP) - 1)
  const nA = a1 - a0 + 1
  // Time-true positions vs what RoPE actually assigns.
  const ropeA0 = a0 * ROPE_SCALE
  const ropeA1 = a1 * ROPE_SCALE

  // Linear-layer cost per denoising step, approx 2 x params x tokens.
  const vFlops = 2 * model.video * videoTokens
  const aFlops = 2 * model.audio * audioTokens
  const aShare = aFlops / (vFlops + aFlops)

  // SVG geometry: a fixed 5.1 s axis so a shorter clip looks shorter.
  const W = 760
  const X0 = 20
  const AX = 5.1
  const x = (t: number) => X0 + (t / AX) * (W - 2 * X0)
  const yV = 30
  const yA = 92
  const tickEvery = 1

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Timeline of one generated clip: video latent frames and audio tokens on a shared time axis"
    >
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
        <div>
          <span className="font-mono text-xs text-muted-foreground">resolution (width x height)</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {RESOLUTIONS.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setResIdx(i)}
                aria-pressed={resIdx === i}
                className={cn(
                  "rounded-sm border px-2.5 py-1 font-mono text-xs",
                  resIdx === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.id}
              </button>
            ))}
          </div>
          <p className="mt-2 mb-0 font-mono text-xs text-muted-foreground">{res.note}</p>
        </div>
        <div>
          <span className="font-mono text-xs text-muted-foreground">model</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODELS.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModelIdx(i)}
                aria-pressed={modelIdx === i}
                className={cn(
                  "rounded-sm border px-2.5 py-1 font-mono text-xs",
                  modelIdx === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 mb-0 font-mono text-xs text-muted-foreground">
            video stream {sci(model.video)} · audio stream {sci(model.audio)} · cross-attention{" "}
            {sci(model.cross)} parameters
          </p>
        </div>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">clip length (latent frames)</span>
          <Range
            min={1}
            max={31}
            step={1}
            value={T}
            onChange={(e) => setT(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="Number of video latent frames"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            {T} latent = {frames} frames = {seconds.toFixed(2)} s at 24 fps
          </span>
        </label>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">inspect video latent frame k</span>
          <Range
            min={0}
            max={T - 1}
            step={1}
            value={k}
            onChange={(e) => setSel(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="Selected video latent frame"
            accent="#d97706"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            k = {k}: frames {f0}-{Math.min(f1, frames) - 1}, {t0.toFixed(3)}-{t1.toFixed(3)} s
          </span>
        </label>
      </div>

      <div className="px-4 pt-4">
        <svg
          viewBox={`0 0 ${W} 140`}
          className="h-auto w-full"
          role="img"
          aria-label={`${T} video latent frames above ${audioTokens} audio tokens; latent frame ${k} overlaps audio tokens ${a0} to ${a1}`}
        >
          <text x={X0} y={yV - 8} className="fill-muted-foreground" fontSize="11" fontFamily="monospace">
            video: {T} latent frames x {fmt(perFrame)} tokens
          </text>
          {Array.from({ length: T }, (_, i) => {
            const [s, e] = latentSpan(i)
            const xs = x(s / FPS)
            const xe = x(Math.min(e, frames) / FPS)
            return (
              <rect
                key={`v${i}`}
                x={xs + 0.5}
                y={yV}
                width={Math.max(1, xe - xs - 1)}
                height={22}
                rx={2}
                className={i === k ? "fill-amber-500" : "fill-sky-500/50"}
              />
            )
          })}
          <text x={X0} y={yA - 8} className="fill-muted-foreground" fontSize="11" fontFamily="monospace">
            audio: {audioTokens} tokens, one per 1,024 samples ({((HOP / SR) * 1000).toFixed(1)} ms)
          </text>
          {Array.from({ length: audioTokens }, (_, a) => {
            const xs = x((a * HOP) / SR)
            const xe = x(((a + 1) * HOP) / SR)
            const on = a >= a0 && a <= a1
            return (
              <rect
                key={`a${a}`}
                x={xs}
                y={yA}
                width={Math.max(0.6, xe - xs - 0.6)}
                height={22}
                className={on ? "fill-amber-500" : "fill-emerald-500/50"}
              />
            )
          })}
          <line
            x1={x(t0)}
            x2={x(t0)}
            y1={yV + 22}
            y2={yA}
            className="stroke-amber-500"
            strokeDasharray="3 3"
          />
          <line
            x1={x(t1)}
            x2={x(t1)}
            y1={yV + 22}
            y2={yA}
            className="stroke-amber-500"
            strokeDasharray="3 3"
          />
          {Array.from({ length: Math.floor(AX / tickEvery) + 1 }, (_, i) => (
            <g key={`t${i}`}>
              <line x1={x(i)} x2={x(i)} y1={yA + 26} y2={yA + 31} className="stroke-muted-foreground" />
              <text
                x={x(i)}
                y={yA + 43}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
                fontFamily="monospace"
              >
                {i} s
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid gap-x-6 gap-y-1 px-4 py-4 font-mono text-sm sm:grid-cols-2">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <span className="text-muted-foreground">video tokens</span>
          <span className="tabular-nums">{fmt(videoTokens)}</span>
          <span className="text-muted-foreground">audio tokens</span>
          <span className="tabular-nums">
            {fmt(audioTokens)} <span className="text-muted-foreground">({audioSec.toFixed(3)} s)</span>
          </span>
          <span className="text-muted-foreground">video : audio</span>
          <span className="tabular-nums">{ratio.toFixed(0)} : 1</span>
          <span className="text-muted-foreground">audio share of stream FLOPs</span>
          <span className="tabular-nums">{(aShare * 100).toFixed(2)}%</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <span className="text-muted-foreground">attention pairs, video self</span>
          <span className="tabular-nums">{sci(videoTokens * videoTokens)}</span>
          <span className="text-muted-foreground">attention pairs, audio self</span>
          <span className="tabular-nums">{sci(audioTokens * audioTokens)}</span>
          <span className="text-muted-foreground">attention pairs, each cross</span>
          <span className="tabular-nums">{sci(videoTokens * audioTokens)}</span>
          <span className="text-muted-foreground">audio tokens under frame k</span>
          <span className="tabular-nums">
            {nA} <span className="text-muted-foreground">(a = {a0}-{a1})</span>
          </span>
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-sm border px-3 py-2 text-xs">
        <span className="font-mono text-amber-700 dark:text-amber-400">RoPE positions</span>{" "}
        video latent frame {k} rotates its queries at temporal position{" "}
        <span className="font-mono tabular-nums">{k}</span>. The audio tokens under it sit at
        positions{" "}
        <span className="font-mono tabular-nums">
          {ropeA0.toFixed(2)}-{ropeA1.toFixed(2)}
        </span>{" "}
        (index x 0.144). A time-exact scale would be 0.1393, which would put them at{" "}
        <span className="font-mono tabular-nums">
          {(a0 * 0.1393).toFixed(2)}-{(a1 * 0.1393).toFixed(2)}
        </span>
        .
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Token counts follow the release&apos;s own code and configs: 16 x 16 px per video token, four
        pixel frames per latent frame after the first, one audio token per 1,024 samples at 44.1 kHz.
        The release generates 31 latent frames; shorter clips are shown for the arithmetic, not as a
        supported setting. Stream FLOPs are 2 x parameters x tokens for each stream&apos;s own
        weights, ignoring attention and cross-attention (reasoned). Parameters measured from the
        safetensors headers.
      </figcaption>
    </figure>
  )
}
