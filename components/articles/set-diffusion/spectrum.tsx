"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// One picture for the whole paper: AR, block diffusion, set diffusion, and order-
// agnostic diffusion are the same thing at different settings of "which token sets do
// you decode together, and in what order." Slide along a real spectrum from strict
// autoregression to full diffusion; the token strip below reveals step by step, each
// cell colored by the step it's generated in. AR = singletons left-to-right (many
// steps, KV cache). Block diffusion = fixed contiguous blocks. Set diffusion = flexible
// sliding-window sets (fewer steps, still KV-cacheable, any-order). Order-agnostic
// diffusion = one set of everything (fewest steps, but no KV cache).

const N = 16

type Regime = {
  key: string
  name: string
  pos: number // position along the AR↔diffusion spectrum, 0..1
  steps: number[] // step index at which each position is decoded
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
  { key: "ar", name: "autoregressive", pos: 0, steps: ar, kv: "yes", order: "left-to-right", note: "One token per step, strictly left-to-right. KV cache works perfectly, but the sequential axis is the whole sequence — 16 steps for 16 tokens." },
  { key: "block", name: "block diffusion", pos: 0.34, steps: block, kv: "per block", order: "left-to-right blocks", note: "Fixed contiguous blocks decoded left-to-right, diffusion within each. Fewer steps, but the block is rigid — no infilling — and the KV cache can only update once a whole block finishes." },
  { key: "set", name: "set diffusion", pos: 0.62, steps: setD, kv: "every step", order: "flexible (sliding window)", note: "Flexible-position, flexible-size sets — here a sliding window that can decode a few tokens ahead and out of order. Fewer sequential steps than blocks, KV cache updates every step, and gaps can be filled from both sides." },
  { key: "diff", name: "order-agnostic diffusion", pos: 1, steps: diff, kv: "no", order: "any / uniform", note: "One set of the whole sequence, denoised in a random order. Maximally parallel and any-order — but it needs full bidirectional context every step, so there is no KV cache and it recomputes everything." },
]

// decode step is encoded as a single-accent lightness ramp (sequential), not a
// categorical rainbow — earlier steps darker, later steps lighter.
const stepFill = (s: number, total: number) =>
  `oklch(${(0.5 + 0.34 * (s / Math.max(1, total))).toFixed(3)} 0.13 265)`

// scene geometry (viewBox units)
const W = 760
const H = 196
const AX0 = 72
const AX1 = W - 72
const AXY = 48
const STRIPY = 108
const STRIPH = 32
const GAP = 4
const RW = (AX1 - AX0 - (N - 1) * GAP) / N
const stopX = (pos: number) => AX0 + pos * (AX1 - AX0)
const tokX = (i: number) => AX0 + i * (RW + GAP)

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

  const mx = stopX(r.pos)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one spectrum · which token sets decode together, in what order</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`AR-to-diffusion spectrum, ${r.name} selected. ${maxStep + 1} sequential steps for ${N} tokens.`}>
          <defs>
            <linearGradient id="sd-spec-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="oklch(0.7 0.13 150)" />
              <stop offset="1" stopColor="oklch(0.68 0.15 320)" />
            </linearGradient>
            <filter id="sd-spec-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* endpoint labels */}
          <text x={AX0} y={22} className="fill-muted-foreground font-mono" fontSize={10}>◀ autoregressive</text>
          <text x={AX1} y={22} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>diffusion ▶</text>

          {/* the spectrum axis */}
          <line x1={AX0} y1={AXY} x2={AX1} y2={AXY} stroke="url(#sd-spec-grad)" strokeWidth={3} strokeLinecap="round" />

          {/* stops */}
          {REGIMES.map((rg, k) => {
            const x = stopX(rg.pos)
            const active = k === ri
            const anchor = k === 0 ? "start" : k === REGIMES.length - 1 ? "end" : "middle"
            return (
              <g key={rg.key} onClick={() => setRi(k)} className="cursor-pointer">
                <line x1={x} y1={AXY - 6} x2={x} y2={AXY + 6} stroke="currentColor" className="text-border" strokeWidth={1} />
                <circle cx={x} cy={AXY} r={active ? 7 : 4} fill={active ? "var(--foreground)" : "var(--muted)"} stroke="var(--background)" strokeWidth={active ? 2 : 1.5} filter={active ? "url(#sd-spec-soft)" : undefined} className="transition-all duration-300" />
                <text x={x + (anchor === "start" ? -2 : anchor === "end" ? 2 : 0)} y={AXY + 24} textAnchor={anchor} fontSize={10} className={cn("font-mono transition-colors duration-300", active ? "fill-foreground" : "fill-muted-foreground/70")}>{rg.name.replace("order-agnostic diffusion", "order-agnostic")}</text>
              </g>
            )
          })}

          {/* connector from active stop down to the token strip */}
          <line x1={mx} y1={AXY + 30} x2={mx} y2={STRIPY - 6} stroke="var(--foreground)" strokeOpacity={0.25} strokeDasharray="3 3" strokeWidth={1} className="transition-all duration-300" />

          {/* token strip, colored by decode step */}
          {r.steps.map((s, i) => {
            const shown = s <= step
            const justNow = s === step
            return (
              <rect
                key={i}
                x={tokX(i)}
                y={STRIPY}
                width={RW}
                height={STRIPH}
                rx={3}
                fill={shown ? stepFill(s, maxStep) : "var(--muted)"}
                opacity={shown ? (justNow ? 1 : 0.72) : 0.3}
                className="transition-all duration-300"
              >
                <title>{`position ${i} · step ${s}`}</title>
              </rect>
            )
          })}
          <text x={AX0} y={STRIPY + STRIPH + 15} className="fill-muted-foreground font-mono" fontSize={9}>position 0</text>
          <text x={AX1} y={STRIPY + STRIPH + 15} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>position {N - 1}</text>
          <text x={(AX0 + AX1) / 2} y={STRIPY + STRIPH + 15} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>colored by decode step</text>
        </svg>

        {/* slide along the spectrum */}
        <div className="mt-2">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">slide along the spectrum</div>
          <Range min={0} max={REGIMES.length - 1} step={1} value={ri} onChange={(e) => setRi(+e.target.value)} className="w-full cursor-pointer " aria-label="spectrum position" accent="var(--foreground)" />
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
                    <div className="font-medium" style={{ color: rg.kv === "no" ? "oklch(0.65 0.19 25)" : "oklch(0.7 0.15 150)" }}>{rg.kv}</div>
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
