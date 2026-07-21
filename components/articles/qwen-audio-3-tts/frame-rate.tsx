"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Why a 12.5 Hz tokenizer is the headline choice. An autoregressive TTS LM emits
// one token at a time, so its decode cost scales with tokens-per-second of audio —
// i.e. the tokenizer's frame rate. At 12.5 Hz a ten-second clip is 125 tokens /
// 125 sequential steps; a typical 50 Hz neural codec is 500, four times the steps
// for the same audio. Drag the frame rate and watch the step count — and the
// latency it implies — move. Qwen sits at the low end on purpose.

const ACCENT = "oklch(0.6 0.18 300)" // violet
const BASE = 12.5 // Qwen's tokenizer frame rate
const CLIP = 10 // seconds of speech, fixed for the comparison
const MAXHZ = 75

export function FrameRate() {
  const [hz, setHz] = useState(BASE)
  const tokens = Math.round(hz * CLIP)
  const baseTokens = BASE * CLIP // 125
  const mult = hz / BASE
  const pct = Math.min(100, (hz / MAXHZ) * 100)
  const basePct = (BASE / MAXHZ) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        frame rate → decode steps · fewer tokens per second, fewer AR steps
      </div>
      <div className="p-3 sm:p-4">
        {/* stat readouts */}
        <div className="grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">frame rate</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">
              {hz.toFixed(2)}
              <span className="text-xs text-muted-foreground"> Hz</span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">tokens / 10 s</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>
              {tokens}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">AR steps vs 12.5 Hz</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">
              {mult.toFixed(1)}×
            </div>
          </div>
        </div>

        {/* proportional bar with the 12.5 Hz baseline tick */}
        <div className="relative mt-4 h-6 overflow-hidden rounded-md bg-muted/40">
          <div
            className="h-full rounded-md transition-all duration-200"
            style={{ width: `${pct}%`, background: ACCENT, opacity: 0.85 }}
          />
          <div
            className="absolute inset-y-0 w-px bg-foreground/50"
            style={{ left: `${basePct}%` }}
          />
          <span
            className="absolute top-0 translate-x-1 font-mono text-[9px] text-foreground/70"
            style={{ left: `${basePct}%` }}
          >
            12.5 Hz
          </span>
        </div>

        {/* control */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>tokenizer frame rate — drag</span>
            <span className="tabular-nums text-foreground">{tokens} sequential steps</span>
          </div>
          <Range min={6.25} max={MAXHZ} step={6.25} value={hz} onChange={(e) => setHz(+e.target.value)} className="w-full" aria-label="frame rate" accent={ACCENT} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every token is one autoregressive step, and steps are serial — so halving the frame
          rate roughly halves the time-to-audio. Most neural speech codecs sit at 25–75 Hz;
          Qwen's supervised tokenizer at <span style={{ color: ACCENT }}>12.5 Hz</span> keeps the
          token stream {baseTokens === tokens ? "as short as it gets here" : `~${mult.toFixed(1)}× shorter than the ${hz.toFixed(0)} Hz setting`}{" "}
          while still preserving content and speaker — the whole point of making the tokenizer
          <span className="text-foreground"> supervised</span> rather than a raw reconstruction codec.
        </p>
      </div>
    </figure>
  )
}
