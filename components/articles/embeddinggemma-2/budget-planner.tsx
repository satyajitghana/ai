"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How one EmbeddingGemma 2 input spends its 8,192-token context, and what the
// final mean pool ends up averaging over. Token rates are the model card's:
// an image costs its vision budget (280 by default, 70 to 1,120 allowed), a
// video frame 140, a second of audio 25. Each image, frame and audio clip is
// wrapped in a begin and an end marker token (processing_embedding_gemma2.py,
// replace_*_token), so it costs two more. The default caps are the shipped
// processors': the video processor keeps at most 32 frames and resamples
// longer clips uniformly (video_processing_embedding_gemma2.py:192-193), and
// the Gemma 4 audio feature extractor truncates at 480,000 samples, 30 s at
// 16 kHz (feature_extraction_gemma4.py:230). Parameter counts per module are
// summed from the safetensors header.

const CONTEXT = 8192
const BUDGETS = [70, 140, 280, 560, 1120] as const
const FRAME_TOKENS = 140
const AUDIO_TPS = 25
const MAX_FRAMES = 32
const MAX_AUDIO_S = 30

const PARAMS = { text: 271.0, vision: 167.76, audio: 305.61 } // millions, from the header

const C = {
  text: "oklch(0.62 0.15 255)",
  image: "oklch(0.68 0.15 160)",
  video: "oklch(0.72 0.14 85)",
  audio: "oklch(0.6 0.17 300)",
  over: "oklch(0.63 0.19 25)",
}

export function BudgetPlanner() {
  const [text, setText] = useState(40)
  const [images, setImages] = useState(2)
  const [bi, setBi] = useState(2)
  const [videoS, setVideoS] = useState(20)
  const [audioS, setAudioS] = useState(0)
  const [caps, setCaps] = useState(true)

  const budget = BUDGETS[bi]
  const frames = caps ? Math.min(videoS, MAX_FRAMES) : videoS
  const audioKept = caps ? Math.min(audioS, MAX_AUDIO_S) : audioS

  const tText = text
  const tImage = images * (budget + 2)
  const tVideo = frames * (FRAME_TOKENS + 2)
  const tAudio = audioKept > 0 ? audioKept * AUDIO_TPS + 2 : 0
  const total = tText + tImage + tVideo + tAudio
  const over = total > CONTEXT

  const needVision = images > 0 || videoS > 0
  const needAudio = audioS > 0
  const params = PARAMS.text + (needVision ? PARAMS.vision : 0) + (needAudio ? PARAMS.audio : 0)
  const label = needVision && needAudio ? "740M" : needVision ? "440M" : needAudio ? "570M" : "270M"

  const parts = [
    { k: "text", n: tText, c: C.text },
    { k: "images", n: tImage, c: C.image },
    { k: "video", n: tVideo, c: C.video },
    { k: "audio", n: tAudio, c: C.audio },
  ]
  const scale = Math.max(total, CONTEXT)
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

  const notes: string[] = []
  if (caps && videoS > MAX_FRAMES)
    notes.push(
      `${videoS} s of video at 1 frame per second is ${videoS} frames; the processor keeps ${MAX_FRAMES}, spaced evenly, so one frame now stands for about ${(videoS / MAX_FRAMES).toFixed(1)} s.`,
    )
  if (caps && audioS > MAX_AUDIO_S)
    notes.push(`The feature extractor cuts the clip at ${MAX_AUDIO_S} s; the other ${audioS - MAX_AUDIO_S} s are never heard.`)
  if (over) notes.push(`${group3(total - CONTEXT)} tokens past the window. Split the input, lower the vision budget, or sample fewer frames.`)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one input, one 8,192-token window, one mean</span>
        <span className="font-mono text-[10px] text-muted-foreground">rates from the model card, caps from the processors</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-2">
        <div className="space-y-3 font-mono text-[11px]">
          <Slider label="text tokens" value={text} min={0} max={2000} step={10} onChange={setText} shown={group3(text)} />
          <Slider label="images" value={images} min={0} max={30} step={1} onChange={setImages} shown={String(images)} />
          <div>
            <div className="mb-1 text-muted-foreground">vision budget per image</div>
            <div className="flex flex-wrap gap-1.5">
              {BUDGETS.map((b, i) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBi(i)}
                  aria-pressed={bi === i}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 text-[10px] tabular-nums transition-colors",
                    bi === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {group3(b)}
                </button>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {group3(budget * 9)} patches of 16 px, pooled 3 x 3 into {group3(budget)} tokens
            </div>
          </div>
          <Slider label="video, seconds at 1 fps" value={videoS} min={0} max={120} step={1} onChange={setVideoS} shown={`${videoS} s`} />
          <Slider label="audio, seconds" value={audioS} min={0} max={400} step={5} onChange={setAudioS} shown={`${audioS} s`} />
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={caps} onChange={(e) => setCaps(e.target.checked)} />
            keep the shipped defaults (32 frames, 30 s of audio)
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>context used</span>
              <span className="tabular-nums" style={{ color: over ? C.over : undefined }}>
                {group3(total)} / {group3(CONTEXT)}
              </span>
            </div>
            <div className="relative h-5 overflow-hidden rounded-sm bg-muted/40">
              {(() => {
                let x = 0
                return parts.map((p) => {
                  const w = (p.n / scale) * 100
                  const el = <div key={p.k} className="absolute inset-y-0" style={{ left: `${x.toFixed(3)}%`, width: `${w.toFixed(3)}%`, background: p.c, opacity: 0.85 }} />
                  x += w
                  return el
                })
              })()}
              <div className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${((CONTEXT / scale) * 100).toFixed(3)}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">share of the positions the final mean averages</div>
            <div className="space-y-1">
              {parts.map((p) => (
                <div key={p.k} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">{p.k}</span>
                  <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                    <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${pct(p.n).toFixed(2)}%`, background: p.c, opacity: 0.85 }} />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{pct(p.n).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <Cell label="modules to load" value={label} sub={`${params.toFixed(1)}M counted in the header`} />
            <Cell
              label="text's share of the mean"
              value={`${pct(tText).toFixed(1)}%`}
              sub={total > tText ? "media tokens outnumber words" : "text only"}
            />
          </div>

          {notes.length > 0 && (
            <ul className="space-y-1 text-[11px] leading-5" style={{ color: C.over }}>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        Two product photos at the default budget and a forty-token description put 564 image
        positions and 40 text positions into the same mean, so the words are about 7% of what is
        averaged. Attention mixes every position with the others first, so this is a share of
        positions, not of meaning, but it is the reason a long video or a stack of images can drown
        a caption. Twenty seconds of video adds 2,840 more.
      </p>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  shown,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  shown: string
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{shown}</span>
      </div>
      <Range min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="w-full" />
    </div>
  )
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-foreground">{value}</div>
      <div className="text-[9.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}

// thousands separators without Intl, so server and browser print the same string
function group3(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
