"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

// Block-wise autoregressive diffusion, animated as a composed SVG scene. Generation is
// autoregressive ACROSS blocks — each block is decoded conditioned on the finished ones, drawn as
// curved causal connectors between blocks — but DIFFUSION within a block: every token of the active
// block is denoised in parallel over a few steps, not one-at-a-time. That's the whole speed story:
// the sequential axis is blocks (few) instead of tokens (many). Left blocks are done (context);
// the active block resolves in parallel; right blocks wait. Loops.

const BLOCKS = [
  ["The", "cat", "sat", "on"],
  ["the", "warm", "mat", "by"],
  ["the", "old", "brick", "wall"],
]
const BLK = 4
const STEPS = 3 // denoise steps per block
const revealOrder = [2, 0, 3, 1]

const DONE = "oklch(0.62 0.13 230)"
const ACT = "oklch(0.72 0.15 150)"

// scene geometry (viewBox units)
const W = 720
const H = 244
const PILL_W = 104
const PILL_H = 30
const PGAP = 9
const COL_TOP = 26
const COL_H = BLK * PILL_H + (BLK - 1) * PGAP // 147
const CX = [136, 360, 584]

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
    return revealOrder.indexOf(i) < stepInBlock ? "resolved" : "denoising"
  }

  const pillY = (i: number) => COL_TOP + i * (PILL_H + PGAP)
  const midY = COL_TOP + COL_H / 2

  // arched causal connector between block b and b+1
  const causal = (bx1: number, bx2: number) => {
    const mx = (bx1 + bx2) / 2
    const bow = 20
    return `M ${bx1} ${midY} C ${mx} ${midY - bow}, ${mx} ${midY - bow}, ${bx2} ${midY}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>block-wise AR diffusion · causal across blocks, parallel within</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Three blocks of ${BLK} tokens. Finished blocks feed the active block through causal connectors; the active block denoises all its tokens in parallel.`}>
          <defs>
            <marker id="bd-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={DONE} strokeWidth={1.5} />
            </marker>
            <filter id="bd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* causal connectors between blocks (behind columns) */}
          {[0, 1].map((b) => {
            const lit = activeBlock > b
            return (
              <path
                key={b}
                d={causal(CX[b] + PILL_W / 2, CX[b + 1] - PILL_W / 2)}
                fill="none"
                stroke={lit ? DONE : "var(--border)"}
                strokeWidth={1.5}
                strokeDasharray={lit ? undefined : "3 3"}
                opacity={lit ? 0.9 : 0.5}
                markerEnd={lit ? "url(#bd-arr)" : undefined}
                className="transition-all duration-300"
              />
            )
          })}

          {BLOCKS.map((blk, b) => (
            <g key={b}>
              {/* block container */}
              <rect
                x={CX[b] - PILL_W / 2 - 8}
                y={COL_TOP - 8}
                width={PILL_W + 16}
                height={COL_H + 16}
                rx={10}
                fill="var(--muted)"
                opacity={b === activeBlock ? 0.28 : 0.16}
                stroke={b < activeBlock ? DONE : b === activeBlock ? ACT : "var(--border)"}
                strokeOpacity={b > activeBlock ? 0.6 : 0.45}
                strokeWidth={1}
                strokeDasharray="4 3"
                className="transition-all duration-300"
              />
              {blk.map((tok, i) => {
                const st = cellState(b, i)
                const solid = st === "done" || st === "resolved"
                const fill = st === "done" ? DONE : st === "resolved" ? ACT : "transparent"
                const stroke = st === "denoising" ? ACT : st === "wait" ? "var(--border)" : "none"
                const label = solid ? tok : st === "denoising" ? "▩" : "·"
                const textFill = solid ? "var(--background)" : st === "denoising" ? ACT : "var(--muted-foreground)"
                return (
                  <g key={i}>
                    <rect
                      x={CX[b] - PILL_W / 2}
                      y={pillY(i)}
                      width={PILL_W}
                      height={PILL_H}
                      rx={6}
                      fill={fill}
                      opacity={st === "wait" ? 0.5 : 1}
                      stroke={stroke}
                      strokeWidth={1.3}
                      strokeDasharray={st === "wait" || st === "denoising" ? "3 2" : undefined}
                      filter={solid ? "url(#bd-soft)" : undefined}
                      className="transition-all duration-300"
                    />
                    <text x={CX[b]} y={pillY(i) + PILL_H / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fill={textFill}>{label}</text>
                  </g>
                )
              })}
              <text x={CX[b]} y={COL_TOP + COL_H + 24} textAnchor="middle" className="font-mono" fontSize={9.5} fill="var(--muted-foreground)">
                block {b} {b < activeBlock ? "· context" : b === activeBlock ? "· denoising" : "· waiting"}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
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
