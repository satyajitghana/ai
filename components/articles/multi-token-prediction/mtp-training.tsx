"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The training objective, animated. A window slides along the sequence; from each
// position t the model predicts the next n tokens at once, so n loss terms fire per
// position instead of one. Flip n between 1 (ordinary next-token) and 4 to see the
// signal get denser — the reason MTP trains a better model. Scrub t or let it loop.

const ACCENT = "oklch(0.66 0.15 150)"
const TOKENS = ["the", "cat", "sat", "on", "a", "warm", "mat", "by", "the", "fire", "."]

const CELL = 54
const TOP = 78 // vertical space for the prediction arcs
const BOXY = TOP + 4
const BOXH = 32
const W = TOKENS.length * CELL
const H = BOXY + BOXH + 20
const cx = (i: number) => i * CELL + CELL / 2
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

  const reach = Math.min(n, TOKENS.length - 1 - t)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
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

      <div className="space-y-4 p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A window at position ${t} predicts the next ${reach} token${reach > 1 ? "s" : ""}, one arc per prediction.`}>
          <defs>
            <marker id="mt-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="mt-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* prediction arcs from t to t+1..t+reach */}
          {Array.from({ length: reach }, (_, k) => {
            const from = cx(t)
            const to = cx(t + k + 1)
            const peak = TOP - 8 - k * 13
            return (
              <g key={k}>
                <path
                  d={`M ${rnd(from)} ${BOXY} C ${rnd(from)} ${rnd(peak)}, ${rnd(to)} ${rnd(peak)}, ${rnd(to)} ${BOXY}`}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={1.5}
                  markerEnd="url(#mt-arrow)"
                  opacity={0.85 - k * 0.14}
                />
                <text x={rnd((from + to) / 2)} y={rnd(peak - 3)} textAnchor="middle" fill={ACCENT} className="font-mono" fontSize={9} fontWeight={600} opacity={0.9 - k * 0.12}>
                  +{k + 1}
                </text>
              </g>
            )
          })}

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
                  rx={7}
                  fill={isPos ? ACCENT : isTarget ? ACCENT : "var(--background)"}
                  fillOpacity={isPos ? 0.95 : isTarget ? 0.16 : 1}
                  stroke={isPos || isTarget ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  filter={isPos ? "url(#mt-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={cx(i)}
                  y={BOXY + BOXH / 2 + 4}
                  textAnchor="middle"
                  fill={isPos ? "var(--background)" : "var(--foreground)"}
                  className="font-mono"
                  fontSize={11}
                  fontWeight={isPos ? 600 : 400}
                >
                  {tok}
                </text>
              </g>
            )
          })}
          <text x={cx(t)} y={BOXY + BOXH + 14} textAnchor="middle" fill="var(--muted-foreground)" className="font-mono" fontSize={9}>
            position t
          </text>
        </svg>

        {/* position scrubber */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>position t (drag)</span>
            <span className="tabular-nums text-foreground">{t}</span>
          </div>
          <Range
            min={0}
            max={lastT}
            step={1}
            value={t}
            onChange={(e) => {
              setPlaying(false)
              setT(Number(e.target.value))
            }}
            className="w-full cursor-pointer "
            aria-label="window position t" accent="oklch(0.66 0.15 150)" />
        </div>

        {/* loss readout — min-height reserves the tallest case (n=4, four loss
            terms wrapping at mobile width) so the row count never changes as the
            window advances and reach shrinks toward the end of the sequence */}
        <div className="min-h-[80px] rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">L(t)</span> ={" "}
          {Array.from({ length: reach }, (_, k) => (
            <span key={k}>
              {k > 0 ? " − " : "− "}log P(
              <span style={{ color: ACCENT, opacity: 1 - k * 0.14 }}>{TOKENS[t + k + 1]}</span>
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
                n === k ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {k}
              {k === 1 ? " (next-token)" : ""}
            </button>
          ))}
        </div>

        {/* every n's paragraph overlaid in one grid cell so the block sizes to
            the tallest and switching n never reflows the page */}
        <div className="grid">
          {[1, 2, 4].map((k) => (
            <p
              key={k}
              aria-hidden={k !== n}
              className={cn(
                "col-start-1 row-start-1 text-sm leading-6 text-muted-foreground transition-opacity duration-300",
                k === n ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              {k === 1
                ? "At n=1 this is ordinary next-token training: one prediction, one loss term per position. The model only ever learns to look one step ahead."
                : `At n=${k} each position supplies ${k} loss terms, forcing the trunk to encode information about tokens further ahead — a denser signal that, at scale, yields a better model even after the extra heads are thrown away.`}
            </p>
          ))}
        </div>
      </div>
    </figure>
  )
}
