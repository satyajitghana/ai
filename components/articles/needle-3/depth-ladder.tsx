"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The flagship claim, made literal: one 20-layer checkpoint, five documented
// depths, each a standalone model. Every number below is Cactus's own —
// read from the live benchmark charts at cactuscompute.com/needle (Figures 2
// and 3) and from the intelligence-ladders post — nothing here is estimated.
//
// Two things the numbers force into the open, which the announcement's "up to
// 4k tok/s" and "25-121M" do not:
//
//   1. The 2-layer, 25M-parameter slice is excluded from Cactus's own base
//      chart. Not because it can't load — it can, the ladder guarantees
//      that — but because its confidence head withholds almost every call,
//      so its gated score is ~0. Forced to answer anyway it manages 0.9 on
//      Mobile Actions and 20.5 on DroidCall. "Sliceable" and "useful out of
//      the box" are different claims at the bottom of the ladder.
//   2. Per-slice file size and MFLOPs/token are published for only four of
//      the five depths, and Cactus's own aggregate "400-4k tok/s decode on a
//      Pi 5" is never broken out by depth anywhere I could find — on the
//      live page, the README, or the three guide posts. The size column
//      below marks exactly what's missing rather than filling it in.

type Depth = {
  layers: number
  params: string
  sizeClaimed: string | null
  mflops: number | null
  mobileBase: number | null // confidence-gated, "" mark for withheld
  mobileBaseForced: number | null
  droidBase: number | null
  droidBaseForced: number | null
  mobileTuned: number
  droidTuned: number
}

const DEPTHS: Depth[] = [
  {
    layers: 2,
    params: "25M",
    sizeClaimed: null,
    mflops: null,
    mobileBase: 0,
    mobileBaseForced: 0.9,
    droidBase: 0,
    droidBaseForced: 20.5,
    mobileTuned: 66.7,
    droidTuned: 56.5,
  },
  {
    layers: 4,
    params: "29M",
    sizeClaimed: "8 MB",
    mflops: 30,
    mobileBase: 11.7,
    mobileBaseForced: null,
    droidBase: 21.0,
    droidBaseForced: null,
    mobileTuned: 79.1,
    droidTuned: 62.5,
  },
  {
    layers: 8,
    params: "52M",
    sizeClaimed: null,
    mflops: 48,
    mobileBase: 36.8,
    mobileBaseForced: null,
    droidBase: 36.5,
    droidBaseForced: null,
    mobileTuned: 83.7,
    droidTuned: 68.0,
  },
  {
    layers: 16,
    params: "98M",
    sizeClaimed: null,
    mflops: 83,
    mobileBase: 80.7,
    mobileBaseForced: null,
    droidBase: 40.0,
    droidBaseForced: null,
    mobileTuned: 84.6,
    droidTuned: 69.0,
  },
  {
    layers: 20,
    params: "121M",
    sizeClaimed: "29 MB claimed · 35.3 MB measured",
    mflops: 100,
    mobileBase: 86.0,
    mobileBaseForced: null,
    droidBase: 47.0,
    droidBaseForced: null,
    mobileTuned: 84.5,
    droidTuned: 70.0,
  },
]

const GOOD = "oklch(0.55 0.16 155)"
const WARM = "oklch(0.68 0.13 85)"
const TUNED = "oklch(0.63 0.19 27)"
const MUTED = "oklch(0.62 0.03 250)"
const DEEPSEEK = { mobile: 88.4, droid: 60.5 }

export function DepthLadder() {
  const [i, setI] = useState(4)
  const [metric, setMetric] = useState<"mobile" | "droid">("mobile")
  const d = DEPTHS[i]

  const base = metric === "mobile" ? d.mobileBase : d.droidBase
  const baseForced = metric === "mobile" ? d.mobileBaseForced : d.droidBaseForced
  const tuned = metric === "mobile" ? d.mobileTuned : d.droidTuned
  const deepseek = metric === "mobile" ? DEEPSEEK.mobile : DEEPSEEK.droid
  const max = 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one checkpoint · five documented depths · drag the ladder
        </span>
        <div className="flex gap-1">
          {(["mobile", "droid"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "mobile" ? "Mobile Actions" : "DroidCall"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* the ladder itself */}
        <div className="flex items-center gap-1.5">
          {DEPTHS.map((x, idx) => (
            <button
              key={x.layers}
              type="button"
              onClick={() => setI(idx)}
              aria-pressed={i === idx}
              className={cn(
                "flex-1 cursor-pointer rounded-md border px-1 py-2 text-center transition-colors",
                i === idx ? "border-foreground/40 bg-muted/50" : "border-border hover:bg-muted/20",
              )}
            >
              <div className="font-mono text-xs font-medium">{x.layers}L</div>
              <div className="font-mono text-[9px] text-muted-foreground">{x.params}</div>
            </button>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
          <span className="flex-1 text-center">2</span>
          <span className="flex-1 text-center">4</span>
          <span className="flex-1 text-center">8</span>
          <span className="flex-1 text-center">16</span>
          <span className="flex-1 text-center">20</span>
        </div>

        {/* selected-depth readout */}
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              parameters
            </div>
            <div className="mt-0.5 font-mono text-sm tabular-nums">{d.params}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              CQ2-bit file
            </div>
            <div className="mt-0.5 font-mono text-sm tabular-nums">
              {d.sizeClaimed ?? "not published"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              MFLOPs / token
            </div>
            <div className="mt-0.5 font-mono text-sm tabular-nums">
              {d.mflops ?? "not published"}
            </div>
          </div>
        </div>

        {/* base vs fine-tuned bars */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              base, gated
            </span>
            <div className="h-5 flex-1 rounded-sm bg-muted/40">
              <div
                className="h-5 rounded-sm"
                style={{ width: `${((base ?? 0) / max) * 100}%`, background: base ? WARM : MUTED, opacity: 0.85 }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums">
              {base != null ? base.toFixed(1) : "—"}
            </span>
          </div>
          {baseForced != null ? (
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                base, forced
              </span>
              <div className="h-5 flex-1 rounded-sm bg-muted/40">
                <div
                  className="h-5 rounded-sm"
                  style={{ width: `${(baseForced / max) * 100}%`, background: MUTED, opacity: 0.7 }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums">
                {baseForced.toFixed(1)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-right font-mono text-[10px]" style={{ color: TUNED }}>
              fine-tuned
            </span>
            <div className="relative h-5 flex-1 rounded-sm bg-muted/40">
              <div
                className="h-5 rounded-sm"
                style={{ width: `${(tuned / max) * 100}%`, background: TUNED, opacity: 0.95 }}
              />
              <div
                className="absolute top-0 h-5 border-l border-dashed"
                style={{ left: `${(deepseek / max) * 100}%`, borderColor: GOOD }}
                title={`DeepSeek V4 Flash · ${deepseek}`}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: TUNED }}>
              {tuned.toFixed(1)}
            </span>
          </div>
          <div className="pl-[7.5rem] font-mono text-[9px]" style={{ color: GOOD }}>
            ┊ DeepSeek V4 Flash (cloud) · {deepseek} — {tuned >= deepseek ? "passed" : "not passed"} at {d.layers}L
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {i === 0 ? (
            <>
              <span className="text-foreground">The 2-layer slice is the one Cactus leaves off its own chart.</span>{" "}
              Confidence-gated, it withholds almost every call — the bar above is not rounding, its gated score really
              is ~0. Forced to answer anyway it reaches 0.9 on Mobile Actions and 20.5 on DroidCall. Fine-tuned on
              DroidCall it jumps to 56.5, still short of DeepSeek&rsquo;s 60.5; fine-tuned on Mobile Actions it reaches
              66.7. Two layers of a generalist is not a product. Two layers tuned on one product&rsquo;s tools is a
              different, much smaller claim — and the one Cactus actually ships.
            </>
          ) : i === 4 && metric === "mobile" ? (
            <>
              <span className="text-foreground">This is the one place the ladder-then-tune argument does not close.</span>{" "}
              Tuned, the 20-layer subnetwork scores 84.5 — a hair below its own <em>untuned</em> 86.0, and still 3.9
              points under DeepSeek&rsquo;s 88.4. Fine-tuning on Mobile Actions helps every smaller slice a great deal
              (2L: +65.8, 4L: +60.1) and very slightly <em>hurts</em> the slice that was already close to its ceiling.
              The &ldquo;passes DeepSeek V4 Flash from 4 layers up&rdquo; banner is true — on DroidCall.
            </>
          ) : (
            <>
              Switch the toggle above: on DroidCall every tuned depth from 4 layers up clears DeepSeek&rsquo;s 60.5.
              On Mobile Actions, none of them do — the closest is 16L at 84.6, still under DeepSeek&rsquo;s 88.4. One
              benchmark supports the banner; the other, shown in the same figure, does not.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
