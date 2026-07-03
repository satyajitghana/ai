"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon, SnowflakeIcon } from "@phosphor-icons/react/dist/ssr"

// The architecture, animated — the "two towers" made literal. A single diffusion LM
// has to be two things at once: a causal reader of clean context AND a bidirectional
// denoiser of the noisy block — conflicting jobs. TwoTower splits them into two stacks
// of layers. The LEFT tower is the FROZEN pretrained autoregressive model: it reads the
// clean context and never gets a gradient. The RIGHT tower is the TRAINABLE denoiser: it
// refines the current block bidirectionally. The load-bearing detail is LAYER-ALIGNED
// cross-attention — denoiser layer i reads context layer i — so as a forward pass sweeps
// up the towers, each aligned arrow lights and the masked block resolves in parallel.
// When the block is done it commits into the context tower and the next block begins.

const LAYERS = 5 // representative; the real model is 52 layers
const FINAL = ["the", "warm", "mat", "."]
const REVEAL = [1, 3, 0, 2] // parallel, non-causal denoise order

const FROZEN = "oklch(0.62 0.13 230)"
const TRAIN = "oklch(0.72 0.15 150)"

export function TwoTower() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)

  const CYCLE = LAYERS + 3
  const step = t % CYCLE
  const block = 2 + Math.floor(t / CYCLE) // block index, increments each cycle

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x + 1) % (CYCLE * 1000)), 700)
    return () => clearInterval(id)
  }, [playing, CYCLE])

  // forward pass sweeps bottom→top: active layer index (0 = bottom)
  const active = Math.min(step, LAYERS - 1)
  const reached = step >= LAYERS - 1 // pass has reached the top
  // block tokens resolve in the last steps, in parallel reveal order
  const resolvedCount = reached ? Math.min(step - (LAYERS - 2), FINAL.length) : 0
  const isResolved = (i: number) => REVEAL.indexOf(i) < resolvedCount

  // layers rendered top (LAYERS-1) → bottom (0)
  const rows = Array.from({ length: LAYERS }, (_, r) => LAYERS - 1 - r)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>TwoTower · a forward pass sweeps up · layer-aligned cross-attention</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        {/* tower headers */}
        <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: FROZEN }}>
            <SnowflakeIcon size={12} weight="fill" /> frozen AR context tower
          </div>
          <div className="w-16 sm:w-24" />
          <div className="flex items-center justify-end gap-1.5 font-mono text-[11px]" style={{ color: TRAIN }}>
            <span className="inline-block size-2 rounded-full" style={{ background: TRAIN }} /> trainable denoiser tower
          </div>
        </div>

        {/* the two towers, layer by layer, with a cross-attention arrow between aligned layers */}
        <div className="space-y-1.5">
          {rows.map((L) => {
            const on = L <= active // this layer's pass has fired
            const isActive = L === active
            const arrowLit = reached || L < active // aligned cross-attn has carried
            return (
              <div key={L} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                {/* context (frozen) layer */}
                <div
                  className="flex h-8 items-center justify-center rounded font-mono text-[10px] transition-all duration-300"
                  style={{
                    background: on ? FROZEN : `${FROZEN}1f`,
                    color: on ? "var(--background)" : `${FROZEN}`,
                    boxShadow: isActive ? `0 0 0 2px ${FROZEN}` : "none",
                  }}
                >
                  L{L + 1}
                </div>

                {/* layer-aligned cross-attention: context layer i → denoiser layer i */}
                <div className="flex w-16 items-center justify-center sm:w-24">
                  <div
                    className="h-px w-full transition-all duration-300"
                    style={{ background: arrowLit ? TRAIN : "var(--border)", opacity: arrowLit ? 1 : 0.5 }}
                  />
                  <span
                    className="ml-[-4px] text-[10px] leading-none transition-colors duration-300"
                    style={{ color: arrowLit ? TRAIN : "var(--border)" }}
                  >
                    ▶
                  </span>
                </div>

                {/* denoiser (trainable) layer */}
                <div
                  className="flex h-8 items-center justify-center rounded font-mono text-[10px] transition-all duration-300"
                  style={{
                    background: arrowLit ? TRAIN : `${TRAIN}1f`,
                    color: arrowLit ? "var(--background)" : `${TRAIN}`,
                    boxShadow: isActive ? `0 0 0 2px ${TRAIN}` : "none",
                  }}
                >
                  L{L + 1}
                </div>
              </div>
            )
          })}
        </div>

        {/* bases: clean committed context (left) vs the noisy block being denoised (right) */}
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
          <div className="rounded-md border border-dashed p-2" style={{ borderColor: `${FROZEN}55` }}>
            <div className="flex flex-wrap gap-1">
              {["The", "cat", "sat", "on"].map((w, i, a) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="rounded px-1.5 py-0.5 font-mono text-[10px] text-background" style={{ background: FROZEN }}>{w}</span>
                  {i < a.length - 1 ? <span className="text-muted-foreground/50">→</span> : null}
                </span>
              ))}
            </div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">clean context · committed blocks · KV + Mamba state</div>
          </div>

          <div className="w-16 sm:w-24" />

          <div className="rounded-md border border-dashed p-2" style={{ borderColor: `${TRAIN}55` }}>
            <div className="flex flex-wrap gap-1">
              {FINAL.map((w, i) => {
                const r = isResolved(i)
                return (
                  <span
                    key={i}
                    className="min-w-[38px] rounded px-1.5 py-0.5 text-center font-mono text-[10px] transition-all duration-300"
                    style={r ? { background: TRAIN, color: "var(--background)" } : { border: `1px dashed ${TRAIN}88`, color: TRAIN }}
                  >
                    {r ? w : "▩"}
                  </span>
                )
              })}
            </div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">block {block} · denoised in parallel · bidirectional</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two stacks of layers, two jobs. A forward pass sweeps up both towers; at each level the
          denoiser layer <span style={{ color: TRAIN }}>cross-attends</span> to the{" "}
          <span style={{ color: FROZEN }}>aligned frozen layer</span> for what&apos;s already decided, and
          the masked block resolves in parallel rather than left-to-right. When the block is done it
          commits into the context tower and the next block begins — <em>autoregressive across blocks,
          diffusion within one</em>. The frozen tower keeps the pretrained model&apos;s causal reading
          intact; the denoiser specializes in refinement. Neither role compromises the other — which a
          single shared network can&apos;t avoid.
        </p>
      </div>
    </figure>
  )
}
