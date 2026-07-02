"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon, SnowflakeIcon } from "@phosphor-icons/react/dist/ssr"

// The architecture, made legible. A single diffusion LM has to be two things at once:
// a causal reader of clean context AND a bidirectional denoiser of noisy blocks —
// conflicting jobs. TwoTower splits them. A FROZEN autoregressive tower reads the
// clean context left-to-right (it's the pretrained model, untouched). A TRAINABLE
// denoiser tower refines a noisy block with bidirectional attention, cross-attending
// to the context tower for what's already been decided. The block cycles through a
// few denoise steps; watch the masked block resolve while the context stays fixed.

const CONTEXT = ["The", "cat", "sat", "on"]
const FINAL = ["the", "warm", "mat", "."]
const STEPS = 4 // denoise steps for the block

export function TwoTower() {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 1) % (STEPS + 1)), 1400)
    return () => clearInterval(id)
  }, [playing])

  // how many of the block's tokens are resolved at step k (parallel, not left-to-right)
  const resolvedOrder = [1, 3, 0, 2] // arbitrary reveal order to show non-causal denoising
  const isResolved = (i: number) => resolvedOrder.indexOf(i) < k

  const FROZEN = "oklch(0.62 0.13 230)"
  const TRAIN = "oklch(0.72 0.15 150)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>TwoTower · frozen context tower + trainable denoiser</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {/* context tower */}
        <div className="rounded-md border p-3" style={{ borderColor: `${FROZEN}66` }}>
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px]" style={{ color: FROZEN }}>
            <SnowflakeIcon size={12} weight="fill" /> frozen AR context tower
          </div>
          <div className="flex flex-wrap gap-1">
            {CONTEXT.map((t, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="rounded px-1.5 py-0.5 font-mono text-[11px] text-background" style={{ background: FROZEN }}>{t}</span>
                {i < CONTEXT.length - 1 ? <span className="text-muted-foreground/50">→</span> : null}
              </span>
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">causal · reads clean tokens · never updated</div>
        </div>

        {/* denoiser tower */}
        <div className="rounded-md border p-3" style={{ borderColor: `${TRAIN}66` }}>
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px]" style={{ color: TRAIN }}>
            <span className="inline-block size-2 rounded-full" style={{ background: TRAIN }} /> trainable denoiser tower
          </div>
          <div className="flex flex-wrap gap-1">
            {FINAL.map((t, i) => {
              const on = isResolved(i)
              return (
                <span
                  key={i}
                  className="min-w-[42px] rounded px-1.5 py-0.5 text-center font-mono text-[11px] transition-all"
                  style={
                    on
                      ? { background: TRAIN, color: "var(--background)" }
                      : { border: `1px dashed ${TRAIN}88`, color: `${TRAIN}` }
                  }
                >
                  {on ? t : "▩"}
                </span>
              )
            })}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">bidirectional block · denoises in parallel · step {Math.min(k, STEPS)}/{STEPS}</div>
        </div>
      </div>

      <div className="px-4 pb-2 text-center font-mono text-[10px] text-muted-foreground/70">
        ↑ denoiser <span style={{ color: FROZEN }}>cross-attends</span> to the frozen context tower at every layer ↑
      </div>

      <div className="px-4 pb-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Two networks, two jobs. The context tower keeps the pretrained model's strong causal
          representation of what's <em>already decided</em>; the denoiser specializes in refining
          the next block bidirectionally, reading the context through cross-attention. Neither role
          compromises the other — which is what a single shared network can't avoid.
        </p>
      </div>
    </figure>
  )
}
