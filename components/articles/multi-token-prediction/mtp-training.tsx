"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The training objective, animated. A window slides along the sequence; from each
// position t the model predicts the next n tokens at once, so n loss terms fire per
// position instead of one. Flip n between 1 (ordinary next-token) and 4 to see the
// signal get denser — the reason MTP trains a better model. Loops.

const TOKENS = ["the", "cat", "sat", "on", "a", "warm", "mat", "by", "the", "fire", "."]

const CELL = 58
const TOP = 70 // vertical space for the prediction arcs
const BOXY = TOP + 6
const BOXH = 30

const rnd = (v: number) => Math.round(v * 100) / 100

export function MTPTraining() {
  const [n, setN] = useState(4)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)

  const lastT = TOKENS.length - 1 - 1 // need at least one future token
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((p) => (p >= lastT ? 0 : p + 1)), 1100)
    return () => clearInterval(id)
  }, [playing, lastT])

  const W = TOKENS.length * CELL
  const H = BOXY + BOXH + 16
  const cx = (i: number) => i * CELL + CELL / 2
  const reach = Math.min(n, TOKENS.length - 1 - t)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>multi-token training objective · live</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A window slides along a sentence; from the current position, arcs predict the next n tokens." style={{ width: "100%", minWidth: 520 }}>
            {/* prediction arcs from t to t+1..t+reach */}
            {Array.from({ length: reach }, (_, k) => {
              const from = cx(t)
              const to = cx(t + k + 1)
              const midY = TOP - 10 - k * 12
              const hue = 150 + k * 14
              return (
                <g key={k}>
                  <path
                    d={`M ${rnd(from)} ${BOXY} Q ${rnd((from + to) / 2)} ${rnd(midY)} ${rnd(to)} ${BOXY}`}
                    fill="none"
                    stroke={`oklch(0.72 0.14 ${hue})`}
                    strokeWidth="1.8"
                    markerEnd="url(#mtpArrow)"
                    opacity="0.9"
                  />
                  <text x={rnd((from + to) / 2)} y={rnd(midY + 2)} textAnchor="middle" fontFamily="monospace" fontSize="9" fill={`oklch(0.72 0.14 ${hue})`}>
                    +{k + 1}
                  </text>
                </g>
              )
            })}
            <defs>
              <marker id="mtpArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--muted-foreground)" />
              </marker>
            </defs>

            {/* token boxes */}
            {TOKENS.map((tok, i) => {
              const isPos = i === t
              const isTarget = i > t && i <= t + reach
              return (
                <g key={i}>
                  <rect
                    x={i * CELL + 4}
                    y={BOXY}
                    width={CELL - 8}
                    height={BOXH}
                    rx="6"
                    fill={isPos ? "oklch(0.72 0.15 195)" : isTarget ? "oklch(0.72 0.13 150)" : "var(--background)"}
                    fillOpacity={isPos ? 0.9 : isTarget ? 0.18 : 1}
                    stroke="var(--border)"
                  />
                  <text
                    x={cx(i)}
                    y={BOXY + 20}
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontSize="11"
                    fill={isPos ? "oklch(0.2 0 0)" : "var(--foreground)"}
                  >
                    {tok}
                  </text>
                </g>
              )
            })}
            <text x={cx(t)} y={BOXY + BOXH + 13} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">
              position t
            </text>
          </svg>
        </div>

        {/* loss readout */}
        <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">L(t)</span> ={" "}
          {Array.from({ length: reach }, (_, k) => (
            <span key={k}>
              {k > 0 ? " − " : "− "}log P(
              <span style={{ color: `oklch(0.72 0.14 ${150 + k * 14})` }}>{TOKENS[t + k + 1]}</span>
              {" | z"}
              <sub>t</sub>)
            </span>
          ))}
          <span className="ml-2 text-muted-foreground">
            → {reach} signal{reach > 1 ? "s" : ""} at this position
          </span>
        </div>

        {/* n selector */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">n =</span>
          {[1, 2, 4].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setN(k)}
              aria-pressed={n === k}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                n === k
                  ? "border-transparent bg-foreground text-background"
                  : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {k}
              {k === 1 ? " (next-token)" : ""}
            </button>
          ))}
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {n === 1
            ? "At n=1 this is ordinary next-token training: one prediction, one loss term per position. The model only ever learns to look one step ahead."
            : `At n=${n} each position supplies ${n} loss terms, forcing the trunk to encode information about tokens further ahead — a denser signal that, at scale, yields a better model even after the extra heads are thrown away.`}
        </p>
      </div>
    </figure>
  )
}
