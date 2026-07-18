"use client"

import { useState } from "react"

// Monolith 1.0's context extension, drawn as a growing window. Pretrained at 4,096
// tokens, then stretched in two YaRN stages (RoPE base 5e6): 4K -> 65,536 -> 1,048,576,
// each stage a 16x jump, 256x overall. Pick a stage and watch the usable window fill the
// 1M capacity frame. The 65,536 midpoint is illustrative — the geometric midpoint of a
// two-stage 256x extension.

const ACCENT = "oklch(0.62 0.14 200)"

const STAGES = [
  { key: "pretrain", label: "pretrain", sub: "4,096", len: 4096, note: "base ctx" },
  { key: "yarn1", label: "YaRN ①", sub: "65,536", len: 65536, note: "×16" },
  { key: "yarn2", label: "YaRN ②", sub: "1,048,576", len: 1048576, note: "×16" },
] as const

const W = 760
const H = 300
const AX0 = 70 // axis left
const AX1 = 690 // axis right
const AXY = 244 // tick baseline
const BAR_Y = 128
const BAR_H = 54

const r2 = (n: number) => Math.round(n * 100) / 100
const LMIN = Math.log10(4096)
const LMAX = Math.log10(1048576)
const xForLen = (len: number) => r2(AX0 + ((Math.log10(len) - LMIN) / (LMAX - LMIN)) * (AX1 - AX0))

const TICKS = [4096, 16384, 65536, 262144, 1048576]
const tickLabel = (n: number) => (n >= 1048576 ? "1M" : `${Math.round(n / 1024)}K`)

function down(x1: number, y1: number, x2: number, y2: number) {
  const my = r2((y1 + y2) / 2)
  return `M ${r2(x1)} ${r2(y1)} C ${r2(x1)} ${my}, ${r2(x2)} ${my}, ${r2(x2)} ${r2(y2)}`
}

export function YarnContext() {
  const [stage, setStage] = useState(2)

  const cur = STAGES[stage]
  const fillRight = xForLen(cur.len)
  const fillW = Math.max(fillRight - AX0, 6) // keep a visible sliver at 4K
  const SHW = 108

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>two-stage yarn · 4K &rarr; 1,048,576</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Context window at the ${cur.label} stage: ${cur.sub} tokens on a log axis from 4,096 to 1,048,576.`}
        >
          <defs>
            <filter id="mono-yarn-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* stage checkpoint nodes across the top (evenly spaced == geometric progression) */}
          {STAGES.map((s, i) => {
            const cx = xForLen(s.len)
            const active = i === stage
            return (
              <g key={s.key}>
                {/* connector down to the axis marker */}
                <path d={down(cx, 96, cx, BAR_Y)} fill="none" stroke={active ? ACCENT : "var(--border)"} strokeWidth={1.4} strokeOpacity={active ? 0.8 : 0.5} />
                <rect
                  x={r2(cx - SHW / 2)}
                  y={54}
                  width={SHW}
                  height={42}
                  rx={9}
                  fill={active ? ACCENT : "var(--background)"}
                  fillOpacity={active ? 0.16 : 1}
                  stroke={active ? ACCENT : "var(--border)"}
                  strokeWidth={1.5}
                  filter="url(#mono-yarn-soft)"
                />
                <text x={cx} y={72} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={active ? 600 : 400}>{s.label}</text>
                <text x={cx} y={87} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: active ? ACCENT : "var(--muted-foreground)" }}>{s.sub}</text>
              </g>
            )
          })}

          {/* x16 arcs between consecutive stages */}
          {[0, 1].map((i) => {
            const xm = r2((xForLen(STAGES[i].len) + xForLen(STAGES[i + 1].len)) / 2)
            return (
              <text key={i} x={xm} y={114} textAnchor="middle" className="font-mono" fontSize={9.5} style={{ fill: ACCENT }}>&times;16 YaRN</text>
            )
          })}

          {/* capacity frame (full 1M) */}
          <rect x={AX0} y={BAR_Y} width={AX1 - AX0} height={BAR_H} rx={8} fill="var(--muted)" fillOpacity={0.4} stroke="var(--border)" strokeWidth={1.5} />
          {/* usable window fill */}
          <rect x={AX0} y={BAR_Y} width={r2(fillW)} height={BAR_H} rx={8} fill={ACCENT} fillOpacity={0.22} stroke={ACCENT} strokeWidth={1.5} className="transition-all duration-500" />
          <text x={AX0 + 12} y={BAR_Y + BAR_H / 2 + 4} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>usable context window</text>

          {/* current-length marker */}
          <line x1={fillRight} y1={BAR_Y - 6} x2={fillRight} y2={BAR_Y + BAR_H + 6} stroke={ACCENT} strokeWidth={1.5} className="transition-all duration-500" />

          {/* ticks + labels */}
          {TICKS.map((n) => {
            const x = xForLen(n)
            return (
              <g key={n}>
                <line x1={x} y1={AXY - 6} x2={x} y2={AXY} stroke="var(--border)" strokeWidth={1} />
                <text x={x} y={AXY + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>{tickLabel(n)}</text>
              </g>
            )
          })}
          <line x1={AX0} y1={AXY} x2={AX1} y2={AXY} stroke="var(--border)" strokeWidth={1} />
          <text x={AX1} y={AXY - 12} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9.5}>context length (log)</text>
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            {STAGES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStage(i)}
                aria-pressed={stage === i}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (stage === i ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {s.label} · {s.sub}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            RoPE base <span className="text-foreground">5e6</span> · <span style={{ color: ACCENT }}>256x</span> the 4K pretraining length
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Monolith pretrains at a cheap <span className="text-foreground">4,096</span>-token window, then applies YaRN twice
          on a <span className="text-foreground">5e6</span> RoPE base to reach{" "}
          <span style={{ color: ACCENT }}>1,048,576</span> tokens — a 256x stretch done in two 16x steps instead of one
          reckless jump. Each stage re-anchors the rotary frequencies so positions far past training stay in distribution;
          two smaller stretches keep long-range attention coherent where a single 256x jump would smear it.
        </p>
      </div>
    </figure>
  )
}
