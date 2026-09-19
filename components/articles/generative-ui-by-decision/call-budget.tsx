"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The denominator behind "rendered in milliseconds".
//
// Composing a UI does not cost one model call per component. It costs two, full
// stop, because the composer asks every membership question in one evaluation
// and every placement question in a second one. The call counts here are
// measured: I ran experimental_composeSpec against the playground's own catalog
// and candidates with a recording evaluator, for the dashboard prompt the docs
// themselves suggest. Drag the per-call latency to see what the round trips add
// up to; the three markers are the only published Jev latencies I could find,
// none of which was measured on a request this size.

const ACCENT = "oklch(0.60 0.15 255)"
const MUTED = "oklch(0.62 0.03 255)"

const W = 760
const H = 208
const X0 = 108
const X1 = 738
const SPAN = 3600 // ms on the axis

type Track = {
  key: string
  label: string
  sub: string
  calls: number
  accent: boolean
}

const TRACKS: Track[] = [
  {
    key: "batch",
    label: "batch",
    sub: "37 questions, then 13",
    calls: 2,
    accent: true,
  },
  {
    key: "sequential",
    label: "sequential",
    sub: "8 elements + 1 finish",
    calls: 9,
    accent: false,
  },
  {
    key: "edit",
    label: "edit: move",
    sub: "target, destination, finish",
    calls: 3,
    accent: false,
  },
]

const MARKS = [
  { ms: 111, label: "111 ms", who: "TypeSafe's own cookbook" },
  { ms: 247, label: "247 ms", who: "Bespoke, 324 rows" },
  { ms: 339, label: "339 ms", who: "Chopra, remote median" },
]

export function CallBudget() {
  const [ms, setMs] = useState(247)
  const px = (t: number) => X0 + (Math.min(t, SPAN) / SPAN) * (X1 - X0)
  const rowY = (i: number) => 54 + i * 44

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`A timeline comparing model-call budgets for composing one dashboard. Batched composition takes 2 evaluation calls; sequential composition of the same eight-element result takes 9; a follow-up move edit takes 3. At ${ms} milliseconds per call the totals are ${2 * ms}, ${9 * ms} and ${3 * ms} milliseconds.`}
      >
        <defs>
          <filter id="gvd-cb-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
        </defs>

        {[0, 1000, 2000, 3000].map((t) => (
          <g key={t}>
            <line x1={px(t)} y1={34} x2={px(t)} y2={H - 26} stroke="var(--border)" strokeWidth={1} />
            <text
              x={px(t)}
              y={H - 12}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={9.5}
            >
              {t === 0 ? "0" : `${t / 1000} s`}
            </text>
          </g>
        ))}

        <text x={X0} y={22} className="fill-muted-foreground font-mono" fontSize={9.5}>
          ONE DASHBOARD — ROOT + GRID + HEADING + TABLE + 3 METRICS + CHART
        </text>

        {TRACKS.map((track, i) => {
          const y = rowY(i)
          const total = track.calls * ms
          const stroke = track.accent ? ACCENT : MUTED
          const blocks = Array.from({ length: track.calls }, (_, k) => k)
          const overflow = total > SPAN
          return (
            <g key={track.key}>
              <text x={X0 - 10} y={y + 12} textAnchor="end" className="fill-foreground" fontSize={11}>
                {track.label}
              </text>
              <text
                x={X0 - 10}
                y={y + 25}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={8.5}
              >
                {track.sub}
              </text>
              {blocks.map((k) => {
                const x = px(k * ms)
                const w = Math.max(2, px((k + 1) * ms) - x - 2)
                if (x >= X1) return null
                return (
                  <rect
                    key={k}
                    x={x}
                    y={y}
                    width={Math.min(w, X1 - x)}
                    height={22}
                    rx={4}
                    fill="var(--background)"
                    stroke={stroke}
                    strokeWidth={1.5}
                    opacity={track.accent ? 1 : 0.8}
                    filter={track.accent ? "url(#gvd-cb-soft)" : undefined}
                  />
                )
              })}
              <text
                x={Math.min(px(total) + 8, X1 - 4)}
                y={y + 15}
                textAnchor={overflow ? "end" : "start"}
                className="font-mono"
                fontSize={10.5}
                fill={track.accent ? ACCENT : "var(--muted-foreground)"}
                fontWeight={track.accent ? 600 : 400}
              >
                {total < 1000 ? `${total} ms` : `${(total / 1000).toFixed(2)} s`}
                {` · ${track.calls} call${track.calls === 1 ? "" : "s"}`}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">per call</span>
          <Range
            min={60}
            max={600}
            step={1}
            value={ms}
            accent={ACCENT}
            onChange={(e) => setMs(Number(e.currentTarget.value))}
            className="min-w-[180px] flex-1"
            aria-label="Milliseconds per evaluation call"
          />
          <span className="w-16 text-right font-mono text-xs tabular-nums">{ms} ms</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MARKS.map((m) => (
            <button
              key={m.ms}
              type="button"
              onClick={() => setMs(m.ms)}
              className={cn(
                "rounded-md border px-2 py-1 text-left font-mono text-[10px] leading-4 transition-colors",
                ms === m.ms ? "border-foreground/40 bg-foreground/[0.06]" : "hover:bg-muted/50",
              )}
            >
              <span className="font-semibold">{m.label}</span>
              <span className="ml-1.5 text-muted-foreground">{m.who}</span>
            </button>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-center font-mono text-xs leading-5 text-muted-foreground">
        Call counts are measured, not modelled. Latency is not: the three presets are the
        only published Jev round trips I know of, and all of them were measured on requests
        of a few hundred tokens with 8&ndash;14 questions. The batched select call here
        carries 37 questions and 161 options in roughly 7,100 tokens, which nobody has timed.
      </figcaption>
    </figure>
  )
}
