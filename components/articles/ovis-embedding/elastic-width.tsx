"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Table 7 of the Ovis-Embedding paper: the six MMEB-v3 suites at five nested
// widths, for the full pipeline (shared PCA rotation + zero-initialised
// residual adapter) and, in the last two rows, for naive truncation of the same
// frozen encoder. All scores are the paper's (reported). The storage column is
// arithmetic: d dimensions × 2 bytes (fp16) × one million vectors.

const WIDTHS = [2048, 1024, 512, 256, 128] as const

const SUITES: { name: string; metric: string; v: number[] }[] = [
  { name: "Text", metric: "nDCG@5", v: [46.78, 46.69, 46.15, 45.3, 43.05] },
  { name: "Image", metric: "Hit@1", v: [77.23, 77.3, 77.27, 76.7, 75.5] },
  { name: "Video", metric: "Hit@1", v: [64.43, 64.26, 64.25, 63.92, 63.17] },
  { name: "Audio", metric: "Hit@1", v: [48.02, 48.04, 48.16, 48.04, 47.69] },
  { name: "VisDoc", metric: "nDCG@5", v: [77.73, 77.6, 76.85, 74.64, 70.76] },
  { name: "Agent", metric: "Hit@1", v: [45.32, 45.64, 44.66, 43.05, 39.14] },
]
const AVG = [58.0, 58.04, 57.55, 56.49, 54.08]
const RET = [100.0, 100.1, 99.2, 97.4, 93.2]
const NAIVE = [58.0, 57.61, 56.28, 54.42, 49.78]
const NAIVE_RET = [100.0, 99.3, 97.0, 93.8, 85.8]

const ADAPT = "oklch(0.62 0.16 255)"
const TRUNC = "oklch(0.66 0.15 45)"

export function ElasticWidth() {
  const [wi, setWi] = useState(4)
  const d = WIDTHS[wi]
  const mbPerMillion = d * 2 // fp16 bytes per vector = MB per million vectors

  // chart: average score vs width, both curves, on a 45..60 axis
  const X0 = 36
  const X1 = 300
  const Y0 = 110
  const Y1 = 12
  const lo = 48
  const hi = 60
  const px = (i: number) => X0 + (i / (WIDTHS.length - 1)) * (X1 - X0)
  const py = (v: number) => Y0 - ((v - lo) / (hi - lo)) * (Y0 - Y1)
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">shorter vectors: PCA rotation + adapter vs plain truncation</span>
        <span className="font-mono text-[10px] text-muted-foreground">paper Table 7, reported</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {WIDTHS.map((w, i) => (
            <button
              key={w}
              type="button"
              onClick={() => setWi(i)}
              aria-pressed={wi === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] tabular-nums transition-colors",
                wi === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              d = {w}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <svg viewBox="0 0 310 130" className="w-full" role="img" aria-label="Average MMEB-v3 score against embedding width for the adapted and the naively truncated embedding; the two curves separate as the width shrinks.">
              {[48, 52, 56, 60].map((t) => (
                <g key={t}>
                  <line x1={X0} x2={X1} y1={py(t)} y2={py(t)} stroke="currentColor" strokeOpacity={0.08} />
                  <text x={X0 - 6} y={py(t) + 3} textAnchor="end" fontSize={8} className="fill-muted-foreground font-mono">
                    {t}
                  </text>
                </g>
              ))}
              {WIDTHS.map((w, i) => (
                <text key={w} x={px(i)} y={124} textAnchor="middle" fontSize={8} className="fill-muted-foreground font-mono">
                  {w}
                </text>
              ))}
              <line x1={px(wi)} x2={px(wi)} y1={Y1} y2={Y0} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 2" />
              <path d={path(NAIVE)} fill="none" stroke={TRUNC} strokeWidth={2} />
              <path d={path(AVG)} fill="none" stroke={ADAPT} strokeWidth={2} />
              {AVG.map((v, i) => (
                <circle key={`a${i}`} cx={px(i)} cy={py(v)} r={i === wi ? 3.5 : 2.2} fill={ADAPT} />
              ))}
              {NAIVE.map((v, i) => (
                <circle key={`n${i}`} cx={px(i)} cy={py(v)} r={i === wi ? 3.5 : 2.2} fill={TRUNC} />
              ))}
            </svg>
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[9.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ADAPT }} /> PCA + adapter (not in the released repos)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: TRUNC }} /> cut to the first d, renormalise
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <Cell label="average, adapted" value={AVG[wi].toFixed(2)} sub={`${RET[wi].toFixed(1)}% of full width`} />
            <Cell label="average, truncated" value={NAIVE[wi].toFixed(2)} sub={`${NAIVE_RET[wi].toFixed(1)}% of full width`} />
            <Cell label="fp16 bytes per vector" value={group3(d * 2)} sub={d === 2048 ? "the native width" : `${(2048 / d).toFixed(0)}× smaller than 2,048`} />
            <Cell
              label="index, 1M vectors, fp16"
              value={mbPerMillion >= 1000 ? `${(mbPerMillion / 1000).toFixed(1)} GB` : `${mbPerMillion} MB`}
              sub="vectors only, no ANN overhead"
            />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {SUITES.map((s) => {
            const drop = s.v[0] - s.v[wi]
            return (
              <div key={s.name} className="flex items-center gap-2">
                <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {s.name} <span className="opacity-60">{s.metric}</span>
                </span>
                <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${s.v[wi].toFixed(2)}%`, background: ADAPT, opacity: 0.8 }} />
                </div>
                <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{s.v[wi].toFixed(2)}</span>
                <span
                  className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums"
                  style={{ color: drop > 3 ? "oklch(0.63 0.17 20)" : undefined }}
                >
                  {drop > 0 ? `−${drop.toFixed(2)}` : `+${(-drop).toFixed(2)}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        At 1,024 dimensions the adapted embedding loses nothing measurable, and plain truncation
        loses 0.39 of a point. At 128 the gap is 4.30 points, and the cost is not spread evenly:
        audio and video barely move, while visual documents and agent retrieval each drop more than
        six. The 2,048 column averages 58.00, not the 58.46 of the headline table, because the
        adapter was fitted on the encoder as it stood after stage 2.
      </p>
    </figure>
  )
}

// thousands separators without Intl, so server and browser print the same string
function group3(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-foreground">{value}</div>
      <div className="text-[9.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}
