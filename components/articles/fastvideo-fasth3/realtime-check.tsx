"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"

// FastVideo's own "Performance" table, warm end-to-end B200 latency (median of
// 3 timed requests, one warmup excluded). "End-to-end time includes encoding,
// denoising, decoding, audio, muxing, and file output" -- FastVideo's own
// wording, so these are full pipeline numbers, not just the diffusion loop.
//
// The blog's own headline: "FastH3 can generate 15s 768p video in less than
// 13s with sub-realtime generation on 8xB200 GPUs." The 8xB200 column only
// exists for the VSA/Data-Free row (Base H3 was never run at 8x -- there's no
// baseline to compute an 8x speedup against, which the blog states outright).
// Checked against the real-time mark (a clip's own duration) rather than
// against the teacher: only ONE of the three durations FastVideo tested at
// 8xB200 actually finishes before its own length elapses.

type Row = {
  dur: "5s" | "10s" | "15s"
  seconds: number
  base1x: number
  base4x: number
  vsa1x: number
  vsa4x: number
  vsa8x: number
  dense1x: number
  dense4x: number
}

const ROWS: Row[] = [
  { dur: "5s", seconds: 5, base1x: 132.5, base4x: 40.6, vsa1x: 16.2, vsa4x: 6.1, vsa8x: 6.84, dense1x: 18.3, dense4x: 6.8 },
  { dur: "10s", seconds: 10, base1x: 377.4, base4x: 108.7, vsa1x: 31.1, vsa4x: 12.0, vsa8x: 11.66, dense1x: 50.2, dense4x: 15.0 },
  { dur: "15s", seconds: 15, base1x: 678.7, base4x: 193.1, vsa1x: 47.2, vsa4x: 15.5, vsa8x: 12.88, dense1x: 91.3, dense4x: 25.6 },
]

const BASE = "oklch(0.58 0.19 27)"
const VSA = "oklch(0.55 0.16 155)"
const DENSE = "oklch(0.68 0.13 85)"
const RT = "oklch(0.62 0.15 255)"

const W = 700
const H = 220
const X0 = 128
const X1 = 660
const SCALE_MIN = 1
const SCALE_MAX = 800

// log-scale position -- values reach SVG attributes, so route the transcendental
// bit (log10) through the deterministic wrapper per house rule.
function px(v: number): number {
  const t = (mlog10(v) - mlog10(SCALE_MIN)) / (mlog10(SCALE_MAX) - mlog10(SCALE_MIN))
  return X0 + t * (X1 - X0)
}

function Lollipop({ y, label, value, color, opacity = 1 }: { y: number; label: string; value: number; color: string; opacity?: number }) {
  const x = px(value)
  return (
    <g>
      <text x={X0 - 8} y={y + 3} textAnchor="end" fontSize={7.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
        {label}
      </text>
      <line x1={X0} y1={y} x2={x} y2={y} stroke={color} strokeOpacity={opacity * 0.5} strokeWidth={1.3} />
      <circle cx={x} cy={y} r={4} fill={color} fillOpacity={opacity} />
      <text x={x + 8} y={y + 3} fontSize={7.5} fill={color} fillOpacity={opacity} fontFamily="ui-monospace, monospace">
        {value.toFixed(2)}s
      </text>
    </g>
  )
}

export function RealtimeCheck() {
  const [durIdx, setDurIdx] = useState(2)
  const row = ROWS[durIdx]
  const rtX = px(row.seconds)
  const rows = [
    { y: 34, label: "Base H3 · 1×B200", value: row.base1x, color: BASE, opacity: 0.85 },
    { y: 56, label: "Base H3 · 4×B200", value: row.base4x, color: BASE, opacity: 0.55 },
    { y: 86, label: "Dense/DataFree · 1×B200", value: row.dense1x, color: DENSE, opacity: 0.85 },
    { y: 108, label: "Dense/DataFree · 4×B200", value: row.dense4x, color: DENSE, opacity: 0.55 },
    { y: 138, label: "VSA/DataFree · 1×B200", value: row.vsa1x, color: VSA, opacity: 0.6 },
    { y: 160, label: "VSA/DataFree · 4×B200", value: row.vsa4x, color: VSA, opacity: 0.8 },
    { y: 182, label: "VSA/DataFree · 8×B200", value: row.vsa8x, color: VSA, opacity: 1 },
  ]
  const beatsRealtime = row.vsa8x < row.seconds

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">warm end-to-end wall clock, log scale, FastVideo&rsquo;s own B200 table</span>
        <div className="flex gap-1.5">
          {ROWS.map((r, i) => (
            <button
              key={r.dur}
              type="button"
              onClick={() => setDurIdx(i)}
              aria-pressed={durIdx === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                durIdx === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.dur} clip
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[620px] max-w-full">
            <title>
              {`Generation wall-clock time for a ${row.dur} clip on a log scale from 1 to 800 seconds, across Base H3 dense attention and two FastH3 variants at 1, 4, and 8 B200 GPUs, with a dashed real-time reference line at ${row.seconds} seconds. ${beatsRealtime ? "The 8-GPU VSA/Data-Free point falls left of the line: it finishes before the clip's own duration." : "The 8-GPU VSA/Data-Free point falls right of the line: it takes longer than the clip's own duration, even though it is the fastest configuration shown."}`}
            </title>

            {/* axis ticks */}
            {[1, 10, 100, 800].map((t) => (
              <g key={t}>
                <line x1={px(t)} y1={20} x2={px(t)} y2={200} stroke="currentColor" strokeOpacity={0.08} />
                <text x={px(t)} y={212} fontSize={7} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {t}s
                </text>
              </g>
            ))}

            {/* real-time reference line */}
            <line x1={rtX} y1={20} x2={rtX} y2={200} stroke={RT} strokeDasharray="3 3" strokeWidth={1.3} />
            <text x={rtX} y={14} fontSize={7} textAnchor="middle" fill={RT} fontFamily="ui-monospace, monospace">
              real time ({row.dur})
            </text>

            {rows.map((r) => (
              <Lollipop key={r.label} {...r} />
            ))}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Move between clips and watch the{" "}
          <span style={{ color: VSA }}>brightest VSA/DataFree · 8×B200</span> point relative to the{" "}
          <span style={{ color: RT }}>real-time line</span>. At 5s it lands at 6.84s — 37% slower
          than just watching the clip. At 10s it&rsquo;s 11.66s — 17% slower. Only at 15s does it
          cross to the left of the line, at 12.88s, matching the announcement&rsquo;s &ldquo;less
          than 13s.&rdquo; &ldquo;Sub-realtime generation on 8xB200 GPUs&rdquo; is accurate for
          exactly the one duration FastVideo leads with — not for the other two durations in their
          own table. The <span style={{ color: BASE }}>Base H3</span> and{" "}
          <span style={{ color: DENSE }}>Dense/DataFree</span> rows never approach the line at any
          duration or GPU count shown here.
        </p>
      </div>
    </figure>
  )
}
