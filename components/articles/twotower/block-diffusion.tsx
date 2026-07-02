"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Block-wise autoregressive diffusion, animated. Generation is autoregressive ACROSS
// blocks — each block is decoded left-to-right, conditioned on the finished ones — but
// DIFFUSION within a block: every token of the active block is denoised in parallel
// over a few steps, not one-at-a-time. That's the whole speed story: the sequential
// axis is blocks (few) instead of tokens (many). Left blocks are done (context);
// the active block resolves in parallel; right blocks wait. Loops.

const BLOCKS = [
  ["The", "cat", "sat", "on"],
  ["the", "warm", "mat", "by"],
  ["the", "old", "brick", "wall"],
]
const BLK = 4
const STEPS = 3 // denoise steps per block
const revealOrder = [2, 0, 3, 1]

export function BlockDiffusion() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)

  const totalTicks = BLOCKS.length * (STEPS + 1)
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x + 1) % totalTicks), 900)
    return () => clearInterval(id)
  }, [playing, totalTicks])

  const activeBlock = Math.floor(t / (STEPS + 1))
  const stepInBlock = t % (STEPS + 1)

  const cellState = (b: number, i: number): "done" | "resolved" | "denoising" | "wait" => {
    if (b < activeBlock) return "done"
    if (b > activeBlock) return "wait"
    // active block: tokens reveal in parallel across steps
    return revealOrder.indexOf(i) < stepInBlock ? "resolved" : "denoising"
  }

  const DONE = "oklch(0.62 0.13 230)"
  const ACT = "oklch(0.72 0.15 150)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>block-wise AR diffusion · causal across blocks, parallel within</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          {BLOCKS.map((blk, b) => (
            <div key={b} className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {blk.map((tok, i) => {
                  const st = cellState(b, i)
                  return (
                    <span
                      key={i}
                      className={cn("min-w-[44px] rounded px-1.5 py-1 text-center font-mono text-[11px] transition-all")}
                      style={
                        st === "done"
                          ? { background: DONE, color: "var(--background)" }
                          : st === "resolved"
                            ? { background: ACT, color: "var(--background)" }
                            : st === "denoising"
                              ? { border: `1px dashed ${ACT}99`, color: ACT }
                              : { border: "1px dashed var(--border)", color: "var(--muted-foreground)", opacity: 0.5 }
                      }
                    >
                      {st === "done" || st === "resolved" ? tok : st === "denoising" ? "▩" : "·"}
                    </span>
                  )
                })}
              </div>
              <span className="font-mono text-[9px] text-muted-foreground">
                block {b} {b < activeBlock ? "· context" : b === activeBlock ? "· denoising" : "· waiting"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: DONE }} /> decided (context tower)</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: ACT }} /> just resolved</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded border border-dashed" style={{ borderColor: ACT }} /> denoising in parallel</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A plain AR model emits one token per forward pass — the sequential axis is the whole
          sequence. TwoTower makes the sequential axis the <span className="text-foreground">blocks</span>,
          and denoises all {BLK} tokens of a block together in a handful of steps. Fewer sequential
          steps for the same text is where the <span className="text-foreground">2.42×</span> throughput
          comes from.
        </p>
      </div>
    </figure>
  )
}
