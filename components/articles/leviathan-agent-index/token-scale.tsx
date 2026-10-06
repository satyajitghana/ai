"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

// Tokens put into an agent's context per question, at six dataset sizes.
// Every number is the project's own (reported), copied from
// bench/results/SUMMARY.md at commit 702ea92: median, p90 and max over 200
// questions per scale, counted with tiktoken o200k_base. "Read all" is the
// whole corpus, computed once per scale, and is the same in every view.

const SCALES = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]
const SCALE_LABEL = ["10K", "50K", "100K", "250K", "500K", "1M"]

type Stat = "median" | "p90" | "max"

const DATA: Record<Stat, { lev: number[]; words: number[]; hist: number[] }> = {
  median: {
    lev: [404, 449, 443, 456, 442, 436],
    words: [1_182, 4_923, 7_750, 17_044, 44_479, 107_122],
    hist: [2_193, 8_992, 18_484, 35_496, 70_336, 209_412],
  },
  p90: {
    lev: [496, 514, 508, 528, 513, 512],
    words: [11_107, 40_717, 95_730, 212_119, 292_111, 1_415_519],
    hist: [13_641, 66_999, 140_041, 376_420, 662_921, 2_465_482],
  },
  max: {
    lev: [569, 582, 593, 581, 568, 602],
    words: [104_059, 497_175, 985_758, 2_433_454, 4_876_870, 9_691_544],
    hist: [104_059, 497_175, 985_758, 2_433_454, 4_876_870, 9_691_544],
  },
}
const READ_ALL = [2_007_453, 10_128_302, 20_305_450, 50_788_254, 101_602_851, 203_226_517]
const HIT5 = ["97.5%", "95.0%", "98.0%", "98.0%", "97.0%", "99.0%"]

const SERIES = [
  { key: "all", label: "read the whole file", color: "oklch(0.6 0.02 250)" },
  { key: "hist", label: "grep the machine's history", color: "oklch(0.62 0.17 30)" },
  { key: "words", label: "grep machine + question words", color: "oklch(0.72 0.13 65)" },
  { key: "lev", label: "Leviathan, 5 cards", color: "oklch(0.68 0.12 180)" },
] as const

const W = 640
const H = 300
const PAD = { l: 52, r: 16, t: 14, b: 30 }
const Y_MIN = 2 // 10^2
const Y_MAX = 9 // 10^9
const X_MIN = mlog10(7_000)
const X_MAX = mlog10(1_400_000)

const x = (n: number) => PAD.l + ((mlog10(n) - X_MIN) / (X_MAX - X_MIN)) * (W - PAD.l - PAD.r)
const y = (v: number) => PAD.t + ((Y_MAX - mlog10(v)) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b)
const r1 = (v: number) => Math.round(v * 10) / 10

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${Math.round(v / 1000)}K`
  return v.toLocaleString("en-US")
}

export function TokenScale() {
  const [stat, setStat] = useState<Stat>("median")
  const [pick, setPick] = useState(5)
  const d = DATA[stat]
  const series: Record<string, number[]> = { all: READ_ALL, hist: d.hist, words: d.words, lev: d.lev }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          tokens into context per question · the project&rsquo;s reported numbers
        </span>
        <span className="flex gap-1.5">
          {(["median", "p90", "max"] as Stat[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStat(s)}
              aria-pressed={stat === s}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] ${
                stat === s
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Log-log chart of tokens per question against dataset size">
          {[1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9].map((e) => (
            <g key={e}>
              <line x1={PAD.l} x2={W - PAD.r} y1={r1(y(e))} y2={r1(y(e))} className="stroke-border" strokeWidth={0.6} />
              <text x={PAD.l - 6} y={r1(y(e)) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9.5}>
                {fmt(e)}
              </text>
            </g>
          ))}
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={r1(y(200_000))}
            y2={r1(y(200_000))}
            stroke="oklch(0.62 0.17 30)"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <text x={PAD.l + 4} y={r1(y(200_000)) - 4} className="font-mono" fontSize={9.5} fill="oklch(0.62 0.17 30)">
            200K-token window
          </text>
          {SCALES.map((n, i) => (
            <g key={n} onClick={() => setPick(i)} className="cursor-pointer">
              <rect x={r1(x(n)) - 14} y={PAD.t} width={28} height={H - PAD.t - PAD.b} fill={pick === i ? "currentColor" : "transparent"} opacity={0.06} />
              <text x={r1(x(n))} y={H - 10} textAnchor="middle" className={pick === i ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"} fontSize={10}>
                {SCALE_LABEL[i]}
              </text>
            </g>
          ))}
          {SERIES.map((s) => {
            const v = series[s.key]
            return (
              <g key={s.key}>
                <polyline
                  points={SCALES.map((n, i) => `${r1(x(n))},${r1(y(v[i]))}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                />
                {SCALES.map((n, i) => (
                  <circle key={n} cx={r1(x(n))} cy={r1(y(v[i]))} r={pick === i ? 4 : 2.6} fill={s.color} />
                ))}
              </g>
            )
          })}
        </svg>
        <div className="mt-2 grid gap-1.5 font-mono text-[11px] sm:grid-cols-2">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tabular-nums text-foreground">{series[s.key][pick].toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          {SCALE_LABEL[pick]} records · {stat} · Leviathan hit@5 {HIT5[pick]} · click a column to read its values
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        All values reported by the project (bench/results/SUMMARY.md), not re-run. At max, both grep strategies
        hit the same busiest machine, so their worst cases coincide.
      </figcaption>
    </figure>
  )
}
