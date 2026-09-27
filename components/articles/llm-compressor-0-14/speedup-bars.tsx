"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The end-to-end GPTQ runtimes behind "~15x" and "~30x", from the final
// comparison table of the benchmark notes linked from PR #3128
// (gist HDCharles/bdc242021d4ba4c9e430f72221daedb7, README.md): one H100,
// W4A16 group 128, 8 random-token calibration samples of 256 tokens, the wall
// clock of the whole oneshot() call. "main" is the pre-PR code; its Hessian
// offload was an off-by-default option that the PR removed.
//
// The per-column view is my arithmetic: seconds divided by the number of weight
// columns GPTQ walks, 32 x (6 x 4,096 + 14,336) = 1,245,184 for Llama 3 8B and
// 48 x (3 x 2,048 + 4,096 + 128 x (2,048 + 2,048 + 768)) = 30,375,936 for
// Qwen3-30B-A3B (router gates and lm_head are not quantized).

type Row = { label: string; s: number | null; note?: string }
type Model = { id: string; label: string; sub: string; cols: number; rows: Row[] }

const MODELS: Model[] = [
  {
    id: "llama",
    label: "Llama 3 8B",
    sub: "dense, 32 layers, whole model on the GPU",
    cols: 1_245_184,
    rows: [
      { label: "main, Hessian offload", s: 408.7 },
      { label: "main", s: 266.39 },
      { label: "PR eager", s: 157.61 },
      { label: "PR eager + batching", s: 115.17 },
      { label: "PR Triton", s: 17.9 },
      { label: "PR Triton + batching", s: 17.19 },
    ],
  },
  {
    id: "qwen",
    label: "Qwen3-30B-A3B",
    sub: "MoE, 48 layers × 128 experts, CPU-offloaded",
    cols: 30_375_936,
    rows: [
      { label: "main, Hessian offload", s: null, note: "not completed" },
      { label: "main", s: 6653.18 },
      { label: "PR eager", s: 3779.61 },
      { label: "PR eager + batching", s: 278.94 },
      { label: "PR Triton", s: 336.76 },
      { label: "PR Triton + batching", s: 212.79 },
    ],
  },
]

const MAIN = "oklch(0.62 0.02 260)"
const EAGER = "oklch(0.7 0.13 70)"
const TRITON = "oklch(0.6 0.13 190)"

const colorOf = (label: string) => (label.startsWith("main") ? MAIN : label.includes("Triton") ? TRITON : EAGER)

const fmtS = (s: number) =>
  s >= 1000 ? `${Math.floor(s / 1000)},${(s % 1000).toFixed(2).padStart(6, "0")} s` : `${s.toFixed(2)} s`

const W = 720
const PL = 170
const PR = 150
const ROW = 30
const TOP = 10

export function SpeedupBars() {
  const [mi, setMi] = useState(0)
  const [perCol, setPerCol] = useState(false)
  const m = MODELS[mi]
  const main = m.rows[1].s as number

  // Log axis spanning every value on either model, so switching models keeps the scale.
  const lo = perCol ? 5 : 10
  const hi = perCol ? 400 : 10000
  const val = (s: number) => (perCol ? (s / m.cols) * 1e6 : s)
  const xOf = (v: number) => PL + ((mlog10(v) - mlog10(lo)) / (mlog10(hi) - mlog10(lo))) * (W - PL - PR)
  const ticks = perCol ? [5, 10, 20, 50, 100, 200, 400] : [10, 30, 100, 300, 1000, 3000, 10000]
  const H = TOP + m.rows.length * ROW + 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          GPTQ end to end · H100 · W4A16 g128 · 8 × 256 random tokens
        </span>
        <div className="flex gap-1">
          {MODELS.map((mm, i) => (
            <button
              key={mm.id}
              type="button"
              onClick={() => setMi(i)}
              aria-pressed={mi === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                mi === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {mm.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{m.sub}</span>
          <div className="flex gap-1 font-mono text-xs">
            {[
              { v: false, t: "wall clock" },
              { v: true, t: "per weight column" },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                onClick={() => setPerCol(o.v)}
                aria-pressed={perCol === o.v}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
                  perCol === o.v
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {o.t}
              </button>
            ))}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`${m.label}: GPTQ end-to-end runtime, main ${fmtS(main)}, PR Triton with batching ${fmtS(m.rows[5].s as number)}, log scale.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={xOf(t)}
                y1={TOP}
                x2={xOf(t)}
                y2={TOP + m.rows.length * ROW}
                stroke="currentColor"
                strokeOpacity="0.1"
              />
              <text
                x={xOf(t)}
                y={TOP + m.rows.length * ROW + 14}
                textAnchor="middle"
                fontSize="10"
                className="fill-muted-foreground font-mono"
              >
                {t >= 1000 ? `${t / 1000}k` : t}
              </text>
            </g>
          ))}
          {m.rows.map((r, i) => {
            const y = TOP + i * ROW
            if (r.s === null)
              return (
                <g key={r.label}>
                  <text x={PL - 8} y={y + ROW / 2 + 4} textAnchor="end" fontSize="11" className="fill-muted-foreground font-mono">
                    {r.label}
                  </text>
                  <text x={PL + 4} y={y + ROW / 2 + 4} fontSize="11" className="fill-muted-foreground font-mono">
                    {r.note}
                  </text>
                </g>
              )
            const v = val(r.s)
            const x1 = xOf(v)
            return (
              <g key={r.label}>
                <text x={PL - 8} y={y + ROW / 2 + 4} textAnchor="end" fontSize="11" className="fill-foreground font-mono">
                  {r.label}
                </text>
                <rect x={PL} y={y + 6} width={Math.max(2, x1 - PL)} height={ROW - 12} rx="3" fill={colorOf(r.label)} fillOpacity="0.85" />
                <text x={x1 + 6} y={y + ROW / 2 + 4} fontSize="11" className="fill-foreground font-mono">
                  {perCol ? `${v.toFixed(1)} µs` : fmtS(r.s)}
                  <tspan className="fill-muted-foreground">
                    {r.s === main ? "" : ` · ${(main / r.s).toFixed(1)}×`}
                  </tspan>
                </text>
              </g>
            )
          })}
          <text x={W - 4} y={TOP + m.rows.length * ROW + 14} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
            {perCol ? "µs per column, log" : "seconds, log"}
          </text>
        </svg>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {perCol ? (
            <>
              Divide by the number of weight columns GPTQ walks and the two models collapse onto each other: the
              old eager path cost about 214 µs a column on Llama and 219 µs on Qwen, whose expert matrices have 768
              or 2,048 rows against Llama&apos;s 1,024 to 14,336. A cost that ignores the size of the column is
              per-step overhead, not arithmetic.
            </>
          ) : mi === 0 ? (
            <>
              Dense Llama has only pairs of same-shaped projections, so batching adds almost nothing on the Triton
              path. The kernel alone takes 266.39 s to 17.90 s.
            </>
          ) : (
            <>
              On the MoE, 128 experts per layer share a shape, and batching them is worth 1.6× on top of the kernel.
              Batched eager, with no Triton at all, already beats unbatched Triton.
            </>
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
          Measured by the PR author on one H100; ratios are against main without Hessian offload, the default.
          Per-column figures are my arithmetic.
        </p>
      </div>
    </figure>
  )
}
