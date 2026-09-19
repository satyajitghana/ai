"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The decode roof.
//
// A Splash decode step reads a fixed 16.73 GB (see ByteLedger) and emits at most
// eight tokens. So decode throughput has a hard physical ceiling:
//
//     tokens/s  ≤  (memory bandwidth / 16.73 GB) × accepted tokens per step
//
// which is a straight line through the origin, one per chip. Nothing in the
// kernels, the scheduler or the draft can put a point above its own chip's line.
// All they can do is get closer to it, or move right by accepting more tokens
// per pass.
//
// Bandwidths are Apple's published figures for the M5 Pro and the two M5 Max
// bins. The acceptance presets are Inco's own published figures for this exact
// drafter at this exact block size: 4.80 tokens on average over five datasets,
// 4.39 on HumanEval and 4.79 on MBPP — the two that look most like the coding
// prompts the Splash benchmark uses.
//
// The two plotted rates are Inco's: 74 tok/s on a 48 GB M5 Pro, from the launch
// post's own table, and the 144 tok/s that appears in the launch video on an
// "M5 Max" and nowhere in the written benchmark.

const STEP_GB = 16.729

const CHIPS = [
  { key: "pro", label: "M5 Pro", sub: "307 GB/s", bw: 307 },
  { key: "max32", label: "M5 Max, 32-core", sub: "460 GB/s", bw: 460 },
  { key: "max40", label: "M5 Max, 40-core", sub: "614 GB/s", bw: 614 },
] as const

// Each plotted rate is judged against the smallest chip it is claimed on: 74 on
// the M5 Pro, 144 on the cheaper of the two M5 Max bins.
const RATES = [
  { label: "74 tok/s", value: 74, against: 307 },
  { label: "144 tok/s", value: 144, against: 460 },
] as const

const PRESETS = [
  { label: "mean, 5 sets", value: 4.8 },
  { label: "HumanEval", value: 4.39 },
  { label: "MBPP", value: 4.79 },
  { label: "GSM8K", value: 5.46 },
  { label: "no draft", value: 1 },
]

const ACCENT = "oklch(0.58 0.15 245)"
const WARN = "oklch(0.58 0.19 28)"
const GOOD = "oklch(0.52 0.15 155)"

const W = 760
const H = 360
const L = 52
const R = 210
const T = 30
const B = 48
const PW = W - L - R
const PH = H - T - B

const X_MAX = 8
const Y_MAX = 300

const px = (a: number) => L + (a / X_MAX) * PW
const py = (v: number) => T + PH - (Math.min(v, Y_MAX) / Y_MAX) * PH

export function BandwidthRoof() {
  const [accept, setAccept] = useState(4.8)

  const ceiling = (bw: number) => (bw / STEP_GB) * accept
  const gbsNeeded = (rate: number) => (rate / accept) * STEP_GB

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Decode ceiling · Qwen3.8-27B · 16.73 GB read per step
      </div>

      <div className="px-2 pt-4 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A chart of decode tokens per second against tokens accepted per verification pass. Three straight lines through the origin mark the hard ceiling set by each chip's memory bandwidth: M5 Pro at 307 gigabytes per second, M5 Max 32-core at 460, M5 Max 40-core at 614. Two measured rates are plotted at the chosen acceptance length: Inco's published 74 tokens per second on an M5 Pro, and the 144 tokens per second claimed on an M5 Max. At the published acceptance length of 4.80 tokens per pass, 144 sits above the 32-core M5 Max ceiling and below the 40-core one."
        >
          <defs>
            <filter id="roof-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {[0, 50, 100, 150, 200, 250, 300].map((v) => (
            <g key={v}>
              <line
                x1={L}
                y1={py(v)}
                x2={L + PW}
                y2={py(v)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : "2 4"}
              />
              <text
                x={L - 8}
                y={py(v) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {v}
              </text>
            </g>
          ))}

          {[1, 2, 3, 4, 5, 6, 7, 8].map((a) => (
            <g key={a}>
              <line
                x1={px(a)}
                y1={py(0)}
                x2={px(a)}
                y2={py(0) + 4}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={px(a)}
                y={py(0) + 17}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {a}
              </text>
            </g>
          ))}
          <text
            x={L + PW / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            tokens accepted per verification pass
          </text>
          <text
            x={L - 36}
            y={T + PH / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${L - 36} ${T + PH / 2})`}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            decode tok/s
          </text>

          {CHIPS.map((c, i) => {
            const yEnd = py((c.bw / STEP_GB) * X_MAX)
            return (
              <g key={c.key}>
                <line
                  x1={px(0)}
                  y1={py(0)}
                  x2={px(X_MAX)}
                  y2={yEnd}
                  stroke={ACCENT}
                  strokeWidth={1.5}
                  strokeOpacity={0.35 + i * 0.25}
                />
                <text
                  x={px(X_MAX) + 8}
                  y={yEnd - 3}
                  className="fill-foreground font-mono"
                  fontSize={10}
                  fillOpacity={0.6 + i * 0.15}
                >
                  {c.label}
                </text>
                <text
                  x={px(X_MAX) + 8}
                  y={yEnd + 9}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {c.sub} · ceiling {ceiling(c.bw).toFixed(0)}
                </text>
              </g>
            )
          })}

          <line
            x1={px(accept)}
            y1={py(0)}
            x2={px(accept)}
            y2={T + 4}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={px(accept)}
            y={T - 8}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={10}
          >
            {accept.toFixed(2)} accepted
          </text>

          {RATES.map((rate) => {
            const over = gbsNeeded(rate.value) > rate.against
            return (
              <g key={rate.label}>
                <circle
                  cx={px(accept)}
                  cy={py(rate.value)}
                  r={5.5}
                  fill="var(--background)"
                  stroke={over ? WARN : GOOD}
                  strokeWidth={2}
                  filter="url(#roof-soft)"
                />
                <text
                  x={accept < 2.6 ? px(accept) + 12 : px(accept) - 12}
                  y={py(rate.value) + 3.5}
                  textAnchor={accept < 2.6 ? "start" : "end"}
                  className="fill-foreground font-mono"
                  fontSize={11}
                >
                  {rate.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-36 shrink-0 font-mono text-muted-foreground">
            accepted per pass
          </span>
          <input
            type="range"
            min={1}
            max={8}
            step={0.01}
            value={accept}
            onChange={(e) => setAccept(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            aria-label="Tokens accepted per verification pass"
          />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">
            {accept.toFixed(2)}
          </span>
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setAccept(p.value)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                Math.abs(accept - p.value) < 0.005
                  ? "border-foreground/40 bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {p.label} {p.value.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="px-4 py-1.5 text-left font-mono font-normal">rate</th>
              <th className="px-3 py-1.5 text-left font-mono font-normal">on</th>
              <th className="px-4 py-1.5 text-right font-mono font-normal">
                needs GB/s
              </th>
              <th className="px-4 py-1.5 text-right font-mono font-normal">
                of peak
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              { rate: 74, chip: CHIPS[0] },
              { rate: 144, chip: CHIPS[1] },
              { rate: 144, chip: CHIPS[2] },
            ].map((row, i) => {
              const gbs = gbsNeeded(row.rate)
              const frac = gbs / row.chip.bw
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-1.5 font-mono tabular-nums">
                    {row.rate} tok/s
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {row.chip.label}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums">
                    {gbs.toFixed(0)}
                  </td>
                  <td
                    className="px-4 py-1.5 text-right font-mono tabular-nums"
                    style={{ color: frac > 1 ? WARN : undefined }}
                  >
                    {(frac * 100).toFixed(0)}%{frac > 1 ? " — impossible" : ""}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
