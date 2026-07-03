"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// One picture for the whole paper: AR, block diffusion, set diffusion, and order-
// agnostic diffusion are the same thing at different settings of "which token sets do
// you decode together, and in what order." Each cell is colored by the step it's
// generated in; the strip reveals step by step. AR = singletons left-to-right (many
// steps, KV cache). Block diffusion = fixed contiguous blocks. Set diffusion = flexible
// sliding-window sets (fewer steps, still KV-cacheable, any-order). Order-agnostic
// diffusion = one set of everything (fewest steps, but no KV cache). Pick a regime.

const N = 16

type Regime = {
  key: string
  name: string
  // step index at which each position is decoded
  steps: number[]
  kv: string
  order: string
  note: string
}

// AR: one per step, left to right
const ar = Array.from({ length: N }, (_, i) => i)
// block diffusion S=4: contiguous fixed blocks
const block = Array.from({ length: N }, (_, i) => Math.floor(i / 4))
// set diffusion: overlapping sliding-window sets, ~3 wide, mildly out of order
const setD = [0, 0, 1, 0, 1, 1, 2, 1, 2, 2, 3, 2, 3, 3, 4, 3]
// order-agnostic diffusion: everything in one/two steps, random order
const diff = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0]

const REGIMES: Regime[] = [
  { key: "ar", name: "autoregressive", steps: ar, kv: "yes", order: "left-to-right", note: "One token per step, strictly left-to-right. KV cache works perfectly, but the sequential axis is the whole sequence — 16 steps for 16 tokens." },
  { key: "block", name: "block diffusion", steps: block, kv: "per block", order: "left-to-right blocks", note: "Fixed contiguous blocks decoded left-to-right, diffusion within each. Fewer steps, but the block is rigid — no infilling — and the KV cache can only update once a whole block finishes." },
  { key: "set", name: "set diffusion", steps: setD, kv: "every step", order: "flexible (sliding window)", note: "Flexible-position, flexible-size sets — here a sliding window that can decode a few tokens ahead and out of order. Fewer sequential steps than blocks, KV cache updates every step, and gaps can be filled from both sides." },
  { key: "diff", name: "order-agnostic diffusion", steps: diff, kv: "no", order: "any / uniform", note: "One set of the whole sequence, denoised in a random order. Maximally parallel and any-order — but it needs full bidirectional context every step, so there is no KV cache and it recomputes everything." },
]

const HUES = [195, 150, 265, 30, 320]

export function Spectrum() {
  const [ri, setRi] = useState(2)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  const r = REGIMES[ri]
  const maxStep = Math.max(...r.steps)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setStep((s) => (s + 1) % (maxStep + 2)), 700)
    return () => clearInterval(id)
  }, [playing, maxStep])

  useEffect(() => setStep(0), [ri])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>one spectrum · which token sets decode together, in what order</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {REGIMES.map((rg, k) => (
            <button
              key={rg.key}
              type="button"
              onClick={() => setRi(k)}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all", k === ri ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40")}
            >
              {rg.name}
            </button>
          ))}
        </div>

        {/* token strip colored by decode step */}
        <div className="mt-4 flex gap-[3px]">
          {r.steps.map((s, i) => {
            const shown = s <= step
            const justNow = s === step
            return (
              <div
                key={i}
                className={cn("h-7 flex-1 rounded-[2px] transition-all duration-300")}
                style={{
                  background: shown ? `oklch(0.72 0.14 ${HUES[s % HUES.length]})` : "var(--muted)",
                  opacity: shown ? (justNow ? 1 : 0.7) : 0.3,
                }}
                title={`position ${i} · step ${s}`}
              />
            )
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span>position 0</span>
          <span>position {N - 1}</span>
        </div>

        {/* properties + note (grid-stacked so height is constant across regimes) */}
        <div className="grid">
          {REGIMES.map((rg, k) => {
            const rgMax = Math.max(...rg.steps)
            return (
              <div
                key={rg.key}
                aria-hidden={k !== ri}
                className={cn(
                  "col-start-1 row-start-1 transition-opacity duration-300",
                  k === ri ? "opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
                  <div className="bg-background px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">sequential steps</div>
                    <div className="font-medium text-foreground">{rgMax + 1} for {N} tokens</div>
                  </div>
                  <div className="bg-background px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">KV cache</div>
                    <div className="font-medium" style={{ color: rg.kv === "no" ? "oklch(0.72 0.15 25)" : "oklch(0.72 0.15 150)" }}>{rg.kv}</div>
                  </div>
                  <div className="bg-background px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">order</div>
                    <div className="font-medium text-foreground">{rg.order}</div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">{rg.note}</p>
              </div>
            )
          })}
        </div>
      </div>
    </figure>
  )
}
