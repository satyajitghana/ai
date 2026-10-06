"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Which decoder blocks each --audio-depth keeps, and what that costs.
//
// MEASURED from Cactus-Compute/whistle checkpoints/whistle.safetensors (header
// read over an HTTP range request, gate tensors read by byte range):
//   - per decoder block: 2,034,402 params, 1,180,257 of them cross-attention
//   - engram tables: two, 9,963,520 params each; config "sites": [3, 7]
//   - cross_gate logits per block (sigmoid is 1.0000 to four places in all)
//   - cross-attention K is 8 heads x 48, V is 8 heads x 64 = 896 numbers per
//     frame per block; 375 frames per 30 s clip
// REASONED: the keep order is Needle's ladder_order() from
// needle/model/architecture.py (start with both ends, bisect the widest gap),
// applied to 8 blocks. Cactus says the decoder is "laddered like Needle's" and
// that its blocks run Needle's code; the Whistle training code itself is not
// published. Which engram table sits at which site is my assumption (in order).

const ORDER = [0, 7, 3, 5, 1, 2, 4, 6]
const GATE = [22.806, 22.427, 22.022, 22.011, 22.314, 22.843, 22.76, 22.842]
const ENGRAM_SITES = [3, 7]
const PER_BLOCK = 2034402
const CROSS_PER_BLOCK = 1180257
const ENGRAM_TABLE = 9963520
const CROSS_PER_FRAME = 896
const FRAMES = 375

const fmtM = (n: number) => `${(n / 1e6).toFixed(2)}M`

export function DecoderLadder() {
  const [depth, setDepth] = useState(8)
  const kept = new Set(ORDER.slice(0, depth))
  const blocks = [...kept].length
  const engrams = ENGRAM_SITES.filter((s) => kept.has(s)).length
  const params = blocks * PER_BLOCK + engrams * ENGRAM_TABLE
  const memory = blocks * FRAMES * CROSS_PER_FRAME

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">--audio-depth {depth} · the encoder always runs all 8 blocks</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Decoder depth">
          {[2, 3, 4, 5, 6, 7, 8].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDepth(d)}
              aria-pressed={depth === d}
              className={cn(
                "min-w-9 cursor-pointer rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                depth === d ? "border-foreground/40 bg-muted/50" : "border-border text-muted-foreground hover:bg-muted/20",
              )}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-8 gap-1">
          {GATE.map((g, i) => {
            const on = kept.has(i)
            const rank = ORDER.indexOf(i) + 1
            return (
              <div
                key={i}
                className={cn(
                  "rounded-md border px-1 py-2 text-center font-mono transition-opacity",
                  on ? "border-foreground/30 bg-muted/40" : "border-dashed opacity-35",
                )}
              >
                <div className="text-xs font-medium">L{i}</div>
                <div className="text-[9px] text-muted-foreground">rung {rank}</div>
                <div className="mt-1 text-[9px] tabular-nums text-muted-foreground">g {g.toFixed(1)}</div>
                {ENGRAM_SITES.includes(i) ? (
                  <div className="mt-1 text-[9px]" style={{ color: "oklch(0.62 0.16 260)" }}>
                    engram
                  </div>
                ) : (
                  <div className="mt-1 text-[9px] opacity-0">-</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">decoder blocks kept</div>
            <div className="mt-0.5 font-mono text-sm tabular-nums">
              {[...kept].sort((a, b) => a - b).map((i) => `L${i}`).join(" ")}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">decoder + engram params</div>
            <div className="mt-0.5 font-mono text-sm tabular-nums">
              {fmtM(params)}{" "}
              <span className="text-[10px] text-muted-foreground">
                ({fmtM(blocks * CROSS_PER_BLOCK)} cross-attn, {engrams} engram table{engrams === 1 ? "" : "s"})
              </span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">cross memory, 30 s clip</div>
            <div className="mt-0.5 font-mono text-sm tabular-nums">
              {(memory / 1e6).toFixed(2)}M numbers
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Keep order from Needle&rsquo;s own ladder code (both ends first, then bisect the widest gap),
        applied to Whistle&rsquo;s 8 decoder blocks: an assumption, since Whistle&rsquo;s training
        code is not published. Parameter counts and the gate logits g are read from the shipped
        checkpoint; every one of the eight gives a sigmoid of 1.0000. Cactus publishes no word error
        rate for any depth below 8.
      </figcaption>
    </figure>
  )
}
