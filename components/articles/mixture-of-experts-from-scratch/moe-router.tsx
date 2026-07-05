"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
  ShuffleIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The noisy-top-k router, drawn as one composed scene: a token node feeds a router
// node, whose per-expert scores are the bar chart. Walked through five observable
// stages — raw logits → + gaussian noise → keep top-2 → softmax over the survivors →
// weighted combine — mapping 1:1 onto NoisyTopKRouter.forward plus the gated sum in
// SparseMoE.forward. Restrained palette: the two winners take the accent + amber; the
// six losers fade. Resample the noise to watch the routing flip. Illustrative.

const ACCENT = "oklch(0.60 0.15 255)"
const AMBER = "oklch(0.72 0.15 60)"
const EXPERTS = 8
const K = 2

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

// ── scene geometry (viewBox units) ─────────────────────────────────────────
const W = 680
const H = 300
const CHART_L = 216
const CHART_R = 664
const BASE_Y = 252
const TOP_Y = 44
const BW = 30
const GAP = (CHART_R - CHART_L - EXPERTS * BW) / (EXPERTS - 1)
const bx = (i: number) => CHART_L + i * (BW + GAP)

export function MoeRouter() {
  const [stage, setStage] = useState(0)
  const [noise, setNoise] = useState<number[]>(INIT_NOISE)
  const [playing, setPlaying] = useState(false)

  const { noisy, topSet, gates, ordered } = useMemo(() => {
    const noisy = BASE_LOGITS.map((l, i) => l + noise[i])
    const order = [...noisy.keys()].sort((a, b) => noisy[b] - noisy[a])
    const topSet = new Set(order.slice(0, K))
    const maxTop = Math.max(...[...topSet].map((i) => noisy[i]))
    const exps = noisy.map((v, i) => (topSet.has(i) ? Math.exp(v - maxTop) : 0))
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
  const winner = ordered[0] // highest gate → accent
  const runner = ordered[1] // second → amber

  // shared, comparable heights
  const frac = (i: number) => {
    if (gateMode) return topSet.has(i) ? gates[i] : 0
    const v = stage === 0 ? BASE_LOGITS[i] : noisy[i]
    return Math.min(Math.max((v + 2.5) / 5, 0.04), 1)
  }
  const barH = (i: number) => frac(i) * (BASE_Y - TOP_Y)
  const dim = (i: number) => stage >= 2 && !topSet.has(i)
  const hot = (i: number) => stage >= 2 && topSet.has(i)
  const label = (i: number) => {
    if (gateMode) return topSet.has(i) ? `${Math.round(gates[i] * 100)}%` : "·"
    return (stage === 0 ? BASE_LOGITS[i] : noisy[i]).toFixed(1)
  }
  const barColor = (i: number) => {
    if (hot(i)) return i === winner ? ACCENT : AMBER
    return "var(--muted-foreground)"
  }
  const barOpacity = (i: number) => {
    if (hot(i)) return 0.92
    if (dim(i)) return 0.16
    return 0.42
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>noisy top-2 router · 8 experts</span>
        <span>
          step {stage + 1}/{STAGES.length}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Router scene: a token feeds a router producing 8 per-expert scores; the two highest (experts ${[...topSet].join(" and ")}) are kept.`}
        >
          <defs>
            <marker id="moe-r-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="moe-r-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* token → router nodes */}
          <g>
            <rect x={18} y={116} width={78} height={34} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#moe-r-soft)" />
            <text x={57} y={137} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
              token x
            </text>
          </g>
          <path d={`M 96 133 C 108 133, 108 133, 118 133`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-r-arrow)" />
          <g>
            <rect x={120} y={116} width={84} height={34} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#moe-r-soft)" />
            <text x={162} y={132} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
              router
            </text>
            <text x={162} y={144} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
              x · W_g
            </text>
          </g>
          <path d={`M 204 133 C 210 133, 208 133, ${CHART_L - 4} 133`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-r-arrow)" />

          {/* baseline axis */}
          <line x1={CHART_L - 8} y1={BASE_Y} x2={CHART_R + 4} y2={BASE_Y} stroke="var(--border)" strokeWidth={1} />

          {/* bars */}
          {Array.from({ length: EXPERTS }, (_, i) => {
            const h = barH(i)
            return (
              <g key={i}>
                <text
                  x={bx(i) + BW / 2}
                  y={BASE_Y - h - 6}
                  textAnchor="middle"
                  fontSize={10}
                  className={cn("font-mono tabular-nums", dim(i) ? "fill-muted-foreground/40" : "fill-muted-foreground")}
                >
                  {label(i)}
                </text>
                <rect
                  x={bx(i)}
                  y={BASE_Y - h}
                  width={BW}
                  height={Math.max(h, 0.5)}
                  rx={4}
                  fill={barColor(i)}
                  opacity={barOpacity(i)}
                  stroke={hot(i) ? barColor(i) : "transparent"}
                  strokeWidth={1.5}
                  filter={hot(i) ? "url(#moe-r-soft)" : undefined}
                  className="transition-all duration-500 ease-out"
                />
                <text
                  x={bx(i) + BW / 2}
                  y={BASE_Y + 15}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  className={cn("font-mono", dim(i) ? "fill-muted-foreground/40" : "fill-foreground")}
                >
                  E{i}
                </text>
              </g>
            )
          })}
        </svg>

        {/* stage readout — min-height reserved so autoplay never shifts layout */}
        <div className="mt-1 min-h-[116px] border-t pt-3">
          <div className="font-mono text-xs">
            <span className="text-muted-foreground">{STAGES[stage].title} — </span>
            <code className="rounded bg-muted px-1.5 py-0.5">{STAGES[stage].code}</code>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{STAGES[stage].caption}</p>
          {gateMode ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
              <span className="text-muted-foreground">out =</span>
              {ordered.map((i, n) => (
                <span key={i} className="flex items-center gap-1.5">
                  {n > 0 ? <span className="text-muted-foreground">+</span> : null}
                  <span className="tabular-nums">{Math.round(gates[i] * 100)}%</span>
                  <span
                    className="inline-block size-2.5 rounded-[2px]"
                    style={{ background: i === winner ? ACCENT : AMBER }}
                  />
                  <span>E{i}(x)</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
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
