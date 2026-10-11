"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What one finished minute of AI short drama costs in video-model API fees,
// from the vendors' own published list prices (read 2026-10-11):
//   Volcengine Ark model-pricing page (updated 2026-10-10): Seedance per-second
//     examples for 5 s, 16:9 clips with no input video.
//   Alibaba Bailian model-pricing page, Beijing region: Wan per-second prices
//     (Wan 3.0 at its list price, before the time-limited 70% offer).
//   Kling developer pricing page (1 unit = $0.14) and the Gemini API pricing
//     page (Veo 3.1), both per second of output.
// The formula is the whole model: seconds generated = seconds kept x the
// reroll factor; cost = seconds generated x price per second + images x the
// image price. USD is converted at 7.2 CNY, the constant waoowaoo's billing
// code uses. Language-model and TTS costs are left out: Toonflow's own demo
// put language at about 10 yuan of 130, and TTS is billed per character.

const USD_CNY = 7.2

interface Model {
  id: string
  name: string
  vendor: string
  cur: "CNY" | "USD"
  // price per output second, by resolution
  rates: Partial<Record<Res, number>>
  usedBy: string
}

type Res = "480p" | "720p" | "1080p"

const MODELS: Model[] = [
  {
    id: "sd20mini",
    name: "Seedance 2.0 mini",
    vendor: "Volcengine Ark",
    cur: "CNY",
    rates: { "480p": 0.23, "720p": 0.5 },
    usedBy: "Huobao's default model",
  },
  {
    id: "sd20fast",
    name: "Seedance 2.0 fast",
    vendor: "Volcengine Ark",
    cur: "CNY",
    rates: { "480p": 0.37, "720p": 0.8 },
    usedBy: "offered by Huobao, Toonflow, waoowaoo",
  },
  {
    id: "sd20",
    name: "Seedance 2.0",
    vendor: "Volcengine Ark",
    cur: "CNY",
    rates: { "480p": 0.46, "720p": 0.99, "1080p": 2.48 },
    usedBy: "Toonflow's demo; waoowaoo, Pixelle, Jellyfish",
  },
  {
    id: "sd25",
    name: "Seedance 2.5",
    vendor: "Volcengine Ark",
    cur: "CNY",
    rates: { "480p": 0.67, "720p": 1.51, "1080p": 3.74 },
    usedBy: "Toonflow, waoowaoo",
  },
  {
    id: "wan30",
    name: "Wan 3.0",
    vendor: "Alibaba Bailian",
    cur: "CNY",
    rates: { "480p": 0.3, "720p": 0.6, "1080p": 1.2 },
    usedBy: "Huobao, Toonflow",
  },
  {
    id: "wan26flash",
    name: "Wan 2.6 i2v flash, silent",
    vendor: "Alibaba Bailian",
    cur: "CNY",
    rates: { "720p": 0.15, "1080p": 0.25 },
    usedBy: "the cheapest image-to-video line on the page",
  },
  {
    id: "kling30",
    name: "Kling 3.0, no native audio",
    vendor: "Kling",
    cur: "USD",
    rates: { "720p": 0.084, "1080p": 0.112 },
    usedBy: "Pixelle (kling-v3), waoowaoo via fal",
  },
  {
    id: "veo31fast",
    name: "Veo 3.1 Fast",
    vendor: "Google Gemini API",
    cur: "USD",
    rates: { "720p": 0.1, "1080p": 0.12 },
    usedBy: "ViMax's default",
  },
]

const IMAGE_CNY = 0.22 // doubao-seedream-5-0-lite, per output image

const RESES: Res[] = ["480p", "720p", "1080p"]

const cny = (x: number) => `¥${x < 100 ? x.toFixed(2) : Math.round(x).toLocaleString("en-US")}`
const usd = (x: number) => `$${x < 100 ? x.toFixed(2) : Math.round(x).toLocaleString("en-US")}`

export function CostPerMinute() {
  const [modelId, setModelId] = useState("sd20")
  const [res, setRes] = useState<Res>("720p")
  const [reroll, setReroll] = useState(2)
  const [images, setImages] = useState(4)
  const [minutes, setMinutes] = useState(60)

  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0]
  const avail = RESES.filter((r) => model.rates[r] !== undefined)
  const r = avail.includes(res) ? res : avail[avail.length > 1 ? 1 : 0]
  const rate = model.rates[r] ?? 0
  const rateCny = model.cur === "CNY" ? rate : rate * USD_CNY

  const videoPerMin = 60 * reroll * rateCny
  const imagePerMin = images * IMAGE_CNY
  const perMin = videoPerMin + imagePerMin
  const total = perMin * minutes
  const share = perMin > 0 ? (videoPerMin / perMin) * 100 : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 font-mono text-[11px] text-muted-foreground sm:px-4 sm:text-xs">
        <span className="min-w-0 truncate">cost of one finished minute, from list prices</span>
        <span className="shrink-0 text-muted-foreground/60">API fees only</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Video model">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModelId(m.id)}
              aria-pressed={m.id === modelId}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                m.id === modelId ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1" role="group" aria-label="Resolution">
            {RESES.map((x) => {
              const ok = model.rates[x] !== undefined
              return (
                <button
                  key={x}
                  type="button"
                  disabled={!ok}
                  onClick={() => setRes(x)}
                  aria-pressed={x === r}
                  className={cn(
                    "rounded-md border px-2 py-0.5 font-mono text-[11px]",
                    x === r ? "bg-foreground text-background" : "hover:bg-muted",
                    !ok && "cursor-not-allowed opacity-30",
                  )}
                >
                  {x}
                </button>
              )
            })}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {model.vendor}: {model.cur === "CNY" ? cny(rate) : usd(rate)} per second · {model.usedBy}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block font-mono text-[11px]">
            <span className="flex justify-between">
              <span>generated ÷ kept seconds</span>
              <span>{reroll.toFixed(1)}x</span>
            </span>
            <Range min={1} max={5} step={0.5} value={reroll} onChange={(e) => setReroll(Number(e.target.value))} />
          </label>
          <label className="block font-mono text-[11px]">
            <span className="flex justify-between">
              <span>images per finished minute</span>
              <span>{images}</span>
            </span>
            <Range min={0} max={40} step={1} value={images} onChange={(e) => setImages(Number(e.target.value))} />
          </label>
          <label className="block font-mono text-[11px]">
            <span className="flex justify-between">
              <span>finished minutes</span>
              <span>{minutes}</span>
            </span>
            <Range min={1} max={180} step={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[11px] text-muted-foreground">per finished minute</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{cny(perMin)}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{usd(perMin / USD_CNY)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[11px] text-muted-foreground">for {minutes} finished minutes</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{cny(total)}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{usd(total / USD_CNY)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-mono text-[11px] text-muted-foreground">share that is video</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{share.toFixed(0)}%</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              images at {cny(IMAGE_CNY)} each (Seedream 5.0 lite)
            </div>
          </div>
        </div>

        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          60 s × {reroll.toFixed(1)} × {cny(rateCny)}/s + {images} × {cny(IMAGE_CNY)} = {cny(perMin)} per minute.
          {model.cur === "USD" ? ` USD converted at ${USD_CNY} yuan.` : ""} Language-model and TTS fees are left out;
          {" "}both are small next to video.
        </p>
      </div>
    </figure>
  )
}
