"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Fara1.5's 4B -> 9B -> 27B ladder plotted against three proprietary computer-use
// agents on Online-Mind2Web (Microsoft's self-reported numbers; the three
// baselines are the official leaderboard scores for each proprietary system).
// The point isn't "27B wins" by itself -- it's WHERE each size lands relative to
// closed systems: 4B only ties the weakest baseline, 9B clears two of three,
// 27B clears all three. Online-Mind2Web is the only axis with all three
// reference points; the WebVoyager comparison (Fara27B also beats Operator
// there) is folded into the readout line instead of a second chart.

const SIZES = [
  { key: "4b", label: "4B", m2w: 57.3, wv: 80.8 },
  { key: "9b", label: "9B", m2w: 63.4, wv: 86.6 },
  { key: "27b", label: "27B", m2w: 72.3, wv: 89.3 },
] as const

const BASELINES = [
  { label: "Gemini 2.5 CU", value: 57.3, color: "oklch(0.62 0.03 260)" },
  { label: "OpenAI Operator", value: 58.3, color: "oklch(0.64 0.15 40)" },
  { label: "Yutori Navigator n1", value: 64.7, color: "oklch(0.6 0.12 320)" },
]

const ACCENT = "oklch(0.6 0.18 275)"

const W = 720
const H = 260
const CL = 58
const CR = W - 16
const CT = 26
const CB = 206
const YMIN = 50
const YMAX = 76

const cy = (v: number) => CB - ((v - YMIN) / (YMAX - YMIN)) * (CB - CT)
const cx = (k: number) => CL + (k / (SIZES.length - 1)) * (CR - CL)

export function ScalingCrossover() {
  const [i, setI] = useState(2)
  const cur = SIZES[i]

  const statuses = BASELINES.map((b) => ({
    ...b,
    diff: Math.round((cur.m2w - b.value) * 10) / 10,
  }))
  const cleared = statuses.filter((s) => s.diff > 0).length
  const tied = statuses.filter((s) => s.diff === 0).length

  const linePath = SIZES.map(
    (s, k) => `${k === 0 ? "M" : "L"} ${cx(k).toFixed(1)} ${cy(s.m2w).toFixed(1)}`
  ).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>fara1.5 ladder vs. proprietary computer-use agents</span>
        <span className="text-muted-foreground/50">online-mind2web</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At Fara1.5-${cur.label}, Online-Mind2Web score is ${cur.m2w} percent, clearing ${cleared} of 3 proprietary baselines${tied ? ` and tying ${tied}` : ""}.`}
        >
          <defs>
            <filter id="sc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {[50, 56, 62, 68, 74].map((v) => (
            <g key={v}>
              <line x1={CL} y1={cy(v)} x2={CR} y2={cy(v)} stroke="var(--border)" strokeWidth={1} opacity={0.4} />
              <text x={CL - 8} y={cy(v) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={9}>
                {v}
              </text>
            </g>
          ))}

          {statuses.map((b) => (
            <g key={b.label}>
              <line
                x1={CL}
                y1={cy(b.value)}
                x2={CR}
                y2={cy(b.value)}
                stroke={b.color}
                strokeWidth={1.3}
                strokeDasharray="4 3"
                opacity={0.85}
              />
              <text x={CR} y={cy(b.value) - 4} textAnchor="end" className="font-mono" fontSize={9.5} style={{ fill: b.color }}>
                {b.label} {b.value}
              </text>
            </g>
          ))}

          <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2.2} />
          {SIZES.map((s, k) => (
            <g key={s.key}>
              <circle
                cx={cx(k)}
                cy={cy(s.m2w)}
                r={k === i ? 5.5 : 3}
                fill={ACCENT}
                stroke="var(--background)"
                strokeWidth={k === i ? 1.5 : 0}
                filter={k === i ? "url(#sc-soft)" : undefined}
                className="transition-all duration-300"
              />
              <text
                x={cx(k)}
                y={CB + 20}
                textAnchor="middle"
                className="font-mono"
                fontSize={11}
                fontWeight={k === i ? 700 : 500}
                fill={k === i ? "var(--foreground)" : "var(--muted-foreground)"}
              >
                {s.label}
              </text>
            </g>
          ))}
          <text x={CL} y={CB + 36} className="fill-muted-foreground/70 font-mono" fontSize={9}>
            parameters (log scale)
          </text>
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {SIZES.map((s, k) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={i === k}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                i === k ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Fara1.5-{s.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            clears <span style={{ color: ACCENT }}>{cleared}</span>{" "}of 3{tied ? ` · ties ${tied}` : ""}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          At <span className="text-foreground">4B</span>, Fara1.5 lands at 57.3% -- it exactly ties Gemini 2.5 Computer
          Use and trails both Operator and Navigator n1. At <span className="text-foreground">9B</span>{" "}it clears Gemini
          and Operator but still trails Navigator n1 by 1.3 points. Only at <span className="text-foreground">27B</span>{" "}
          does it clear all three -- by 15.0, 14.0, and 7.6 points. On WebVoyager the shape repeats: {cur.wv}% at{" "}
          {cur.label}, against Operator&apos;s 87.0%. The open, MIT-licensed family needs the full ladder to beat closed
          systems outright -- the smallest size is only competitive with the weakest one.
        </p>
      </div>
    </figure>
  )
}
