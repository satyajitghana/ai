"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Every price here is a published per-second list price, read on 2026-10-11:
//   Vivix W1 tiers   platform.vivix.ai/pricing — pack price / credits x credits per second
//                    ($399/133,000 x 1; $599/200,000 x 3; $799/266,000 x 4). The "before the
//                    promo" row is the $399 for 30,000 credits a buyer quoted on X on 9 October,
//                    which Vivix answered by calling it the regular price.
//   Seedance         BytePlus ModelArk pricing, 720p 16:9, no input video (2.5: $0.231/s,
//                    2.0: $0.151/s; both = 1280 x 720 x 24 / 1024 tokens/s x the USD/M-token rate).
//   Kling 3.0 Omni   kling.ai/dev/pricing, 720p, no video input, native audio: 0.8 units x $0.14.
//   MiniMax H3 Max   fal.ai reference-to-video, 768p: $0.08/s.
//   Veo 3.1          Gemini API pricing, 720p with audio: Standard $0.40, Fast $0.10, Lite $0.05.
// Nothing is estimated; the widget only multiplies.

type Tier = { key: string; label: string; perSec: number; note: string }

const W1_TIERS: Tier[] = [
  { key: "std", label: "vivix-w1", perSec: 399 / 133000, note: "1 credit/s, $399 pack, promo to Oct 31" },
  { key: "fast", label: "vivix-w1-fast", perSec: (599 / 200000) * 3, note: "3 credits/s, $599 pack" },
  { key: "ultra", label: "vivix-w1-ultrafast", perSec: (799 / 266000) * 4, note: "4 credits/s, $799 pack" },
  { key: "regular", label: "before the promo", perSec: 399 / 30000, note: "$399 for 30,000 credits, as quoted on 9 Oct" },
]

const OTHERS: { label: string; perSec: number; src: string }[] = [
  { label: "Veo 3.1 Lite", perSec: 0.05, src: "Gemini API, 720p" },
  { label: "MiniMax H3 Max", perSec: 0.08, src: "fal, 768p" },
  { label: "Veo 3.1 Fast", perSec: 0.1, src: "Gemini API, 720p" },
  { label: "Kling 3.0 Omni", perSec: 0.112, src: "Kling, 720p + audio" },
  { label: "Seedance 2.0", perSec: 0.151, src: "BytePlus, 720p" },
  { label: "Seedance 2.5", perSec: 0.231, src: "BytePlus, 720p" },
  { label: "Veo 3.1", perSec: 0.4, src: "Gemini API, 720p" },
]

const SEEDANCE_25_CLIP = 0.231 * 8

function usd(v: number): string {
  if (v >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`
  if (v >= 100) return `$${v.toFixed(0)}`
  if (v >= 1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(4)}`
}

export function CostCalculator() {
  const [tier, setTier] = useState("std")
  const [hours, setHours] = useState(10)
  const [duty, setDuty] = useState(100)

  const w1 = W1_TIERS.find((t) => t.key === tier) ?? W1_TIERS[0]
  const seconds = hours * 3600 * (duty / 100)
  const rows = [{ label: `W1 · ${w1.label}`, perSec: w1.perSec, src: w1.note, w1: true }, ...OTHERS.map((o) => ({ ...o, w1: false }))]
  const max = Math.max(...rows.map((r) => r.perSec))
  const clips = SEEDANCE_25_CLIP / (w1.perSec * 8)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what a session of generated video costs · published list prices</span>
        <span className="text-muted-foreground/60">usd, read 2026-10-11</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {W1_TIERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTier(t.key)}
              aria-pressed={tier === t.key}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                tier === t.key ? "border-orange-500/60 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-xs text-muted-foreground">
            hours of use: <span className="text-foreground">{hours}</span>
            <Range min={1} max={100} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-xs text-muted-foreground">
            share of each hour spent generating: <span className="text-foreground">{duty}%</span>
            <Range min={5} max={100} step={5} value={duty} onChange={(e) => setDuty(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        </div>

        <p className="font-mono text-xs text-muted-foreground">
          {Math.round(seconds).toLocaleString("en-US")} seconds of generated video
        </p>

        <div className="space-y-1.5">
          {rows.map((r) => {
            const total = r.perSec * seconds
            const pct = (r.perSec / max) * 100
            return (
              <div key={r.label} className="grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-2 font-mono text-[11px] sm:grid-cols-[11rem_1fr_6.5rem]">
                <span className={cn("truncate", r.w1 ? "font-semibold text-foreground" : "text-muted-foreground")} title={r.src}>
                  {r.label}
                </span>
                <span className="relative h-3 overflow-hidden rounded-sm bg-muted/40">
                  <span
                    className={cn("absolute inset-y-0 left-0 rounded-sm", r.w1 ? "bg-orange-500" : "bg-foreground/35")}
                    style={{ width: `${Math.max(pct, 0.6).toFixed(2)}%` }}
                  />
                </span>
                <span className={cn("text-right tabular-nums", r.w1 ? "text-foreground" : "text-muted-foreground")}>{usd(total)}</span>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
          <div>
            W1 ({w1.label}): {usd(w1.perSec)}/s = {usd(w1.perSec * 3600)} per hour of continuous output.
          </div>
          <div className="text-muted-foreground">
            One 8 s Seedance 2.5 clip costs {usd(SEEDANCE_25_CLIP)}; that buys {clips.toFixed(1)} W1 clips of the same length at this tier.
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Bars are price per second; the column on the right is the session total. The W1 rows are what the public, asynchronous
        API charges. The streaming model, <code>vivix-w1-stream</code>, is in private beta and has no published price.
      </figcaption>
    </figure>
  )
}
