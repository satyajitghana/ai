"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// FastVideo's own blog table (haoailab.com/blogs/fasth3-preview/), "Performance"
// section: warm end-to-end latency on B200, median of 3 timed requests after one
// warmup, encoding+denoising+decoding+audio+muxing+file-output all included.
//
// Base H3 (dense FA4, the disclosed-33B teacher) calls its transformer 49 times
// per generation -- FastVideo's own characterization of H3's default schedule,
// not a number MiniMax's own card states. FastH3 always uses 4 calls (verified
// independently from checkpoint_metadata.json's dmd_denoising_steps, which lists
// exactly four fixed timesteps: 999, 749, 500, 250).
//
// 49 -> 4 calls is a fixed 12.25x reduction in transformer forwards, before any
// per-call attention savings. The observed end-to-end speedup sometimes beats
// that number and sometimes falls short of it -- this component makes that
// comparison directly, because "fewer calls" alone doesn't explain the range
// FastVideo's own table shows (6.65x to 14.38x).

const CALL_RATIO = 49 / 4 // 12.25 -- fewer calls alone, before any per-call effect

type Row = {
  dur: "5s" | "10s" | "15s"
  frames: number
  base1x: number
  base4x: number
  vsa1x: number
  vsa4x: number
}

const ROWS: Row[] = [
  { dur: "5s", frames: 124, base1x: 132.5, base4x: 40.6, vsa1x: 16.2, vsa4x: 6.1 },
  { dur: "10s", frames: 243, base1x: 377.4, base4x: 108.7, vsa1x: 31.1, vsa4x: 12.0 },
  { dur: "15s", frames: 345, base1x: 678.7, base4x: 193.1, vsa1x: 47.2, vsa4x: 15.5 },
]

const PREDICTED = "oklch(0.62 0.03 250)"
const OBSERVED_UP = "oklch(0.55 0.16 155)"
const OBSERVED_DOWN = "oklch(0.58 0.19 27)"

export function CallCountBreakdown() {
  const [durIdx, setDurIdx] = useState(2) // default 15s -- the case that beats the prediction
  const [gpu, setGpu] = useState<"1x" | "4x">("1x")

  const row = ROWS[durIdx]
  const observed = gpu === "1x" ? row.base1x / row.vsa1x : row.base4x / row.vsa4x
  const beats = observed >= CALL_RATIO
  const maxScale = Math.max(CALL_RATIO, observed) * 1.15

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">49 calls (teacher) &rarr; 4 calls (FastH3), FastVideo&rsquo;s own B200 table</span>
        <div className="flex gap-1.5">
          {(["1x", "4x"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGpu(g)}
              aria-pressed={gpu === g}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                gpu === g
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {g === "1x" ? "1× B200" : "4× B200"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex gap-1.5">
          {ROWS.map((r, i) => (
            <button
              key={r.dur}
              type="button"
              onClick={() => setDurIdx(i)}
              aria-pressed={durIdx === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                durIdx === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.dur} video ({r.frames} frames)
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
              <span className="text-muted-foreground">if speed came only from fewer calls</span>
              <span style={{ color: PREDICTED }}>{CALL_RATIO.toFixed(2)}&times;</span>
            </div>
            <div className="h-5 rounded bg-muted/20">
              <div
                className="h-5 rounded"
                style={{ width: `${(CALL_RATIO / maxScale) * 100}%`, background: PREDICTED, opacity: 0.55 }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
              <span className="text-foreground">observed end-to-end speedup, {row.dur} @ {gpu === "1x" ? "1× B200" : "4× B200"}</span>
              <span style={{ color: beats ? OBSERVED_UP : OBSERVED_DOWN }}>{observed.toFixed(2)}&times;</span>
            </div>
            <div className="h-5 rounded bg-muted/20">
              <div
                className="h-5 rounded"
                style={{ width: `${(observed / maxScale) * 100}%`, background: beats ? OBSERVED_UP : OBSERVED_DOWN, opacity: 0.9 }}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Going from <span className="text-foreground">49 calls to 4</span> predicts a fixed{" "}
          <span style={{ color: PREDICTED }}>12.25&times;</span> reduction on its own, before VSA
          makes each of those 4 calls cheaper. The observed number moves around that line rather
          than always beating it: at 5s and 10s it lands{" "}
          <span style={{ color: OBSERVED_DOWN }}>below the 12.25&times; prediction</span> (as low as
          6.65&times; at 5s on 4 GPUs) because encoding, VAE decode, audio, and muxing don&rsquo;t
          shrink along with the diffusion loop, and at 4 fixed calls that overhead is a bigger slice
          of a shorter clip. Only at 15s does per-call sparsity have enough diffusion work to work
          against, and the observed number climbs{" "}
          <span style={{ color: OBSERVED_UP }}>past the prediction</span>, topping out at 14.38&times;
          on a single B200 — the number the announcement leads with.
        </p>
      </div>
    </figure>
  )
}
