"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
  ShuffleIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The noisy-top-k router, made visible. One token's worth of routing, walked
// through five observable stages: raw logits → + gaussian noise → keep top-2 →
// softmax over the survivors → weighted combine. Maps 1:1 onto the four lines of
// NoisyTopKRouter.forward plus the gated sum in SparseMoE.forward.
//
// Progressive enhancement: the article's prose, math, and code explain the same
// thing; this just lets you watch it (and resample the noise to see routing flip).

const EXPERTS = 8
const K = 2
// One cohesive palette: equal lightness/chroma, hue swept around the wheel —
// the same recipe the /health categories use, so it reads as "house" colour.
const COLORS = Array.from(
  { length: EXPERTS },
  (_, i) => `oklch(0.72 0.13 ${(i * 45) % 360})`
)

// A single token's router logits (x · W_g). Deterministic so SSR == first paint.
const BASE_LOGITS = [1.9, -0.6, 1.4, 0.8, -1.2, 2.1, 0.1, -0.3]
const INIT_NOISE = [0.3, 0.5, -0.2, 0.7, 0.1, -0.4, 0.6, 0.2]

const STAGES = [
  {
    title: "router logits",
    code: "logits = x @ W_g",
    caption: "One linear layer turns the token into one score per expert.",
  },
  {
    title: "+ gaussian noise",
    code: "logits += randn() * softplus(x @ W_noise)",
    caption:
      "Add learned, per-expert gaussian noise. It lets routing explore early instead of locking onto a few experts.",
  },
  {
    title: "keep top-2",
    code: "top, idx = logits.topk(2); rest = -inf",
    caption: "Keep only the two largest. Everything else is set to −∞.",
  },
  {
    title: "softmax → gates",
    code: "gates = softmax(sparse_logits)",
    caption:
      "Softmax over the survivors. −∞ becomes 0, so two experts get all the weight and it sums to 1.",
  },
  {
    title: "weighted sum",
    code: "out = Σ gate[i] · expert[i](x)",
    caption: "Run only those two experts. Scale each by its gate, add them up.",
  },
] as const

function gaussian() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function MoeRouter() {
  const [stage, setStage] = useState(0)
  const [noise, setNoise] = useState<number[]>(INIT_NOISE)
  const [playing, setPlaying] = useState(false)

  const { noisy, topSet, gates, ordered } = useMemo(() => {
    const noisy = BASE_LOGITS.map((l, i) => l + noise[i])
    const order = [...noisy.keys()].sort((a, b) => noisy[b] - noisy[a])
    const topSet = new Set(order.slice(0, K))
    const maxTop = Math.max(...[...topSet].map((i) => noisy[i]))
    const exps = noisy.map((v, i) =>
      topSet.has(i) ? Math.exp(v - maxTop) : 0
    )
    const sum = exps.reduce((a, b) => a + b, 0)
    const gates = exps.map((e) => e / sum)
    const ordered = [...topSet].sort((a, b) => gates[b] - gates[a])
    return { noisy, topSet, gates, ordered }
  }, [noise])

  const atEnd = stage >= STAGES.length - 1
  useEffect(() => {
    if (!playing || atEnd) return
    const t = setTimeout(() => setStage((s) => s + 1), 1400)
    return () => clearTimeout(t)
  }, [playing, atEnd, stage])

  const gateMode = stage >= 3
  // logit bars share a fixed domain so heights are comparable across stages.
  const barHeight = (i: number) => {
    if (gateMode) return topSet.has(i) ? `${Math.max(gates[i] * 100, 2)}%` : "0%"
    const v = stage === 0 ? BASE_LOGITS[i] : noisy[i]
    return `${Math.min(Math.max(((v + 2.5) / 5) * 100, 4), 100)}%`
  }
  const dim = (i: number) => stage >= 2 && !topSet.has(i)
  const label = (i: number) => {
    if (gateMode) return topSet.has(i) ? `${Math.round(gates[i] * 100)}%` : "·"
    return (stage === 0 ? BASE_LOGITS[i] : noisy[i]).toFixed(1)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>noisy top-2 router · 8 experts</span>
        <span>
          step {stage + 1}/{STAGES.length}
        </span>
      </div>

      {/* the bars */}
      <div className="flex h-44 items-end gap-2 px-4 pt-5 sm:gap-3">
        {Array.from({ length: EXPERTS }, (_, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums transition-opacity",
                dim(i) ? "text-muted-foreground/40" : "text-muted-foreground"
              )}
            >
              {label(i)}
            </span>
            <div
              className="w-full rounded-t-sm transition-all duration-500 ease-out"
              style={{
                height: barHeight(i),
                background: COLORS[i],
                opacity: dim(i) ? 0.18 : 1,
              }}
            />
            <span
              className={cn(
                "font-mono text-[10px] transition-opacity",
                dim(i) ? "text-muted-foreground/40" : "text-foreground"
              )}
            >
              E{i}
            </span>
          </div>
        ))}
      </div>

      {/* stage readout */}
      <div className="border-t px-4 py-3">
        <div className="font-mono text-xs">
          <span className="text-muted-foreground">{STAGES[stage].title} — </span>
          <code className="rounded bg-muted px-1.5 py-0.5">{STAGES[stage].code}</code>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {STAGES[stage].caption}
        </p>
        {gateMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
            <span className="text-muted-foreground">out =</span>
            {ordered.map((i, n) => (
              <span key={i} className="flex items-center gap-1.5">
                {n > 0 ? <span className="text-muted-foreground">+</span> : null}
                <span className="tabular-nums">{Math.round(gates[i] * 100)}%</span>
                <span
                  className="inline-block size-2.5 rounded-[2px]"
                  style={{ background: COLORS[i] }}
                />
                <span>E{i}(x)</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* controls */}
      <div className="flex items-center gap-3 border-t px-3 py-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={atEnd}
          className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing && !atEnd ? <PauseIcon size={13} weight="fill" /> : <PlayIcon size={13} weight="fill" />}
          {playing && !atEnd ? "pause" : "play"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            setStage((s) => Math.max(0, s - 1))
          }}
          disabled={stage === 0}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← prev
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            setStage((s) => Math.min(STAGES.length - 1, s + 1))
          }}
          disabled={atEnd}
          className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          next →
        </button>
        <button
          type="button"
          onClick={() => {
            setNoise(Array.from({ length: EXPERTS }, () => gaussian() * 0.9))
            setStage((s) => Math.max(1, s))
          }}
          className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="resample the routing noise"
        >
          <ShuffleIcon size={13} weight="bold" />
          resample noise
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            setStage(0)
            setNoise(INIT_NOISE)
          }}
          className="ml-auto flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowCounterClockwiseIcon size={13} weight="bold" />
          reset
        </button>
      </div>
    </figure>
  )
}
