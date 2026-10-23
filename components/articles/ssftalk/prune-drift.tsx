"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// prune_audio_llm_frames (src/mechinterp.rs) as written, on the benchmark's own input:
// one second at 24 kHz, all zero except samples 2,400..4,800 set to 9,000.
// Samples above the threshold (250) are packed 64 to a u64 word; frame f then counts
// the set bits in words [f*wpf, (f+1)*wpf) with wpf = frame_samples / 64 in integer
// division, and a frame with at least 8 is "active". When frame_samples is not a
// multiple of 64, each frame looks at the wrong window. MEASURED: our Python port
// gives 0.8800 for 480-sample frames, as the README says; the frame-true answer is
// 0.9000. Everything here is integer arithmetic.

const N = 24000
const ON_START = 2400
const ON_END = 4800
const MIN_ACTIVE = 8
const SIZES = [256, 320, 400, 480, 640, 960]

function analyse(fs: number) {
  const total = Math.ceil(N / fs)
  const nWords = Math.ceil(N / 64)
  const wpf = Math.max(1, Math.floor(fs / 64))
  const activeIn = (a: number, b: number) => Math.max(0, Math.min(b, ON_END) - Math.max(a, ON_START))
  const frames = Array.from({ length: total }, (_, f) => {
    const w0 = Math.min(f * wpf, nWords)
    const w1 = Math.min((f + 1) * wpf, nWords)
    const seenA = w0 * 64
    const seenB = Math.min(w1 * 64, N)
    const bug = seenB > seenA && activeIn(seenA, seenB) >= MIN_ACTIVE
    const truth = activeIn(f * fs, Math.min((f + 1) * fs, N)) >= MIN_ACTIVE
    return { bug, truth, seenA, seenB }
  })
  const bugActive = frames.filter((x) => x.bug).length
  const trueActive = frames.filter((x) => x.truth).length
  const covered = Math.min(total * wpf, nWords) * 64
  return { total, wpf, frames, bugActive, trueActive, covered }
}

export function PruneDrift() {
  const [fs, setFs] = useState(480)
  const a = analyse(fs)
  const pct = (active: number) => (((a.total - active) / a.total) * 100).toFixed(1)
  const unseen = Math.max(0, N - a.covered)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5" role="group" aria-label="Frame size">
        <span className="mr-1 font-mono text-xs text-muted-foreground">frame_samples</span>
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFs(s)}
            aria-pressed={fs === s}
            className={cn(
              "min-w-10 cursor-pointer rounded-md border px-2 py-1 font-mono text-xs transition-colors",
              fs === s ? "border-foreground/40 bg-muted/50" : "border-border text-muted-foreground hover:bg-muted/20",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">frames</div>
            <div className="text-base tabular-nums">{a.total}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">window read</div>
            <div className="text-base tabular-nums">{a.wpf * 64} samples</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">&quot;tokens saved&quot; as coded</div>
            <div className="text-base tabular-nums">{pct(a.bugActive)}%</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">frame-true answer</div>
            <div className="text-base tabular-nums">{pct(a.trueActive)}%</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-[2px]" aria-hidden>
          {a.frames.slice(0, 96).map((x, i) => (
            <span
              key={i}
              title={`frame ${i}: reads samples ${x.seenA}..${x.seenB}`}
              className={cn(
                "h-5 w-2.5 rounded-[2px] border",
                x.bug && x.truth && "border-foreground/50 bg-foreground/60",
                x.bug && !x.truth && "border-rose-600 bg-rose-500/70",
                !x.bug && x.truth && "border-amber-600 bg-amber-400/60",
                !x.bug && !x.truth && "border-border bg-muted/30",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Dark: active either way. Red: counted active only because its window slid onto the burst. Amber: really
          active, missed. {unseen > 0 ? `The last ${unseen.toLocaleString("en-US")} samples are never read.` : "Every sample is read."}
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        The benchmark input (1 s, 10% of it a constant 9,000, the rest zero) through ssftalk&apos;s pruning gate as coded,
        against counting each frame&apos;s own samples. Pick a frame size that is not a multiple of 64 to see the drift.
      </figcaption>
    </figure>
  )
}
