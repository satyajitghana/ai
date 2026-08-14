"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The two hard ceilings in the card's Limitations section, turned into the
// number they jointly imply:
//
//   "Audio generation is limited to 9,000 acoustic frames."
//   "creating complete songs up to five minutes long"
//
//   9,000 frames / 300 s = 30 frames per second
//
// The card never states a frame rate, so this is derived rather than quoted —
// but the two limits only agree at 30 Hz, and the RVQ stack described (one
// 16,384-entry semantic codebook plus seven 1,024-entry acoustic codebooks)
// then gives a fixed bit budget per second, which is the second number below.

const FRAMES_MAX = 9000
const FPS = 30

// bits per frame: log2(16384) = 14 for the semantic codebook,
// log2(1024) = 10 for each of the seven acoustic codebooks
const SEMANTIC_BITS = 14
const ACOUSTIC_BITS = 10 * 7
const BITS_PER_FRAME = SEMANTIC_BITS + ACOUSTIC_BITS

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"

export function FrameBudget() {
  const [seconds, setSeconds] = useState(300)

  const frames = Math.round(seconds * FPS)
  const over = frames > FRAMES_MAX
  const kbps = (BITS_PER_FRAME * FPS) / 1000
  // 32 kHz, 16-bit, stereo PCM for comparison
  const pcmKbps = (32000 * 16 * 2) / 1000
  const tokens = frames * 8

  const mm = Math.floor(seconds / 60)
  const ss = String(Math.round(seconds % 60)).padStart(2, "0")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the 9,000-frame ceiling</span>
        <span className="font-mono text-[10px]" style={{ color: over ? "oklch(0.58 0.19 25)" : ACCENT }}>
          {frames.toLocaleString()} / {FRAMES_MAX.toLocaleString()} frames
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="relative h-10 overflow-hidden rounded-lg border bg-muted/25">
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${Math.min(100, (frames / FRAMES_MAX) * 100)}%`,
              background: over ? "oklch(0.58 0.19 25)" : ACCENT,
            }}
          />
          <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[10px] text-foreground">
            5:00 cap
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">song length</span>
          <Range
            min={15}
            max={330}
            step={1}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="min-w-[10rem] flex-1"
            aria-label="song length in seconds"
            accent={ACCENT}
          />
          <span className="font-mono text-[11px] tabular-nums text-foreground">
            {mm}:{ss}
          </span>
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {[
            { k: frames.toLocaleString(), v: "acoustic frames", c: over ? "oklch(0.58 0.19 25)" : ACCENT },
            { k: tokens.toLocaleString(), v: "RVQ tokens (8 per frame)", c: WARM },
            { k: `${kbps.toFixed(2)} kbit/s`, v: "token bitrate", c: "var(--foreground)" },
          ].map((s) => (
            <div key={s.v} className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
              <div className="font-mono text-[10px] text-muted-foreground">{s.v}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: s.c }}>
                {s.k}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
          8 codebooks per frame: 1 semantic at 16,384 entries (14 bits) + 7 acoustic at 1,024 (10 bits each) = 84
          bits/frame
          <br />
          84 bits × 30 frames/s = {kbps.toFixed(2)} kbit/s, against {pcmKbps.toLocaleString()} kbit/s for the 32 kHz
          16-bit stereo PCM it decodes to — about {Math.round(pcmKbps / kbps)}× compression
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The card gives two ceilings without connecting them: songs up to five minutes, and generation limited to
          9,000 acoustic frames. Those only agree at 30 frames per second, which is the frame rate the card never
          states. It is worth deriving because it fixes everything else — eight codebooks per frame at 84 bits
          means the Global LLM is autoregressing over a{" "}
          <span className="text-foreground">2.52 kbit/s</span>{" "}representation, and a full-length song is 9,000
          steps of it. The prompt ceiling is separate and much smaller: 5,000 text tokens for lyrics and
          description combined.
        </p>
      </div>
    </figure>
  )
}
