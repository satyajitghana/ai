"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two web-data filters, measured the same way, and what each one costs.
//
// Protocol is identical across all columns: MiniCPM-1.2B architecture with the
// MiniCPM3-4B tokenizer, 100B training tokens per run, Lighteval, zero-shot.
// Individual runs train on a single dataset; the mixed runs use 60% English, 30%
// Chinese, 10% StarCoder-v2 code.
//
// The published averages reproduce exactly from the per-benchmark rows, which is
// how you know the tables are describing what they say they are.
//
// The pattern worth seeing is not that Ultra-FineWeb wins on average. It is
// WHERE each filter's gains and losses land. FineWeb-edu buys large gains on
// MMLU and ARC and gives back ground on five of nine English benchmarks —
// CommonSenseQA, HellaSwag, PIQA, SIQA, Winogrande. An education-quality filter
// narrows the distribution, and the benchmarks that measure everyday commonsense
// notice.
//
// Ultra-FineWeb keeps almost all of the MMLU and ARC gains and loses ground on
// exactly one benchmark, by 0.15 points.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Row = { b: string; base: number; edu: number; ultra: number; zh?: boolean }

const SETS: { key: string; label: string; sub: string; rows: Row[]; avg: Row[] }[] = [
  {
    key: "individual",
    label: "individual data",
    sub: "each dataset trained in isolation — a direct comparison of differently processed data from identical sources",
    rows: [
      { b: "MMLU", base: 28.84, edu: 31.8, ultra: 32.24 },
      { b: "ARC-C", base: 25.17, edu: 34.56, ultra: 35.67 },
      { b: "ARC-E", base: 59.18, edu: 69.95, ultra: 70.62 },
      { b: "CommonSenseQA", base: 34.32, edu: 31.53, ultra: 36.45 },
      { b: "HellaSwag", base: 42.91, edu: 42.17, ultra: 42.76 },
      { b: "OpenbookQA", base: 22.2, edu: 25.2, ultra: 26.2 },
      { b: "PIQA", base: 73.29, edu: 72.14, ultra: 73.67 },
      { b: "SIQA", base: 38.95, edu: 38.13, ultra: 39.61 },
      { b: "Winogrande", base: 55.64, edu: 55.56, ultra: 55.8 },
    ],
    avg: [{ b: "average, English", base: 42.278, edu: 44.56, ultra: 45.891 }],
  },
  {
    key: "mix",
    label: "mixed corpus",
    sub: "60% English, 30% Chinese, 10% StarCoder-v2 code — the configuration a real pretraining run would use",
    rows: [
      { b: "MMLU", base: 28.5, edu: 30.95, ultra: 30.94 },
      { b: "ARC-C", base: 24.15, edu: 32.34, ultra: 33.36 },
      { b: "ARC-E", base: 55.6, edu: 67.13, ultra: 67.97 },
      { b: "CommonSenseQA", base: 36.2, edu: 35.79, ultra: 37.18 },
      { b: "HellaSwag", base: 40.28, edu: 40.21, ultra: 39.65 },
      { b: "OpenbookQA", base: 21.6, edu: 23.8, ultra: 24.4 },
      { b: "PIQA", base: 71.11, edu: 71.22, ultra: 70.08 },
      { b: "SIQA", base: 39.76, edu: 39.2, ultra: 40.48 },
      { b: "Winogrande", base: 55.09, edu: 52.96, ultra: 54.38 },
      { b: "C-Eval", base: 33.79, edu: 34.32, ultra: 34.1, zh: true },
      { b: "CMMLU", base: 30.23, edu: 33.18, ultra: 33.35, zh: true },
    ],
    avg: [
      { b: "average, English", base: 41.366, edu: 43.733, ultra: 44.271 },
      { b: "average, Chinese", base: 32.01, edu: 33.75, ultra: 33.725 },
      { b: "average, all", base: 39.665, edu: 41.918, ultra: 42.354 },
    ],
  },
]

const COLS = [
  { key: "edu", label: "FineWeb-edu", c: WARM },
  { key: "ultra", label: "Ultra-FineWeb", c: GOOD },
] as const

export function FilterComparison() {
  const [sel, setSel] = useState("individual")
  const s = SETS.find((x) => x.key === sel) ?? SETS[0]
  const regressions = (k: "edu" | "ultra") => s.rows.filter((r) => r[k] < r.base).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          MiniCPM-1.2B · 100B training tokens per run · zero-shot · change against unfiltered FineWeb
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {regressions("edu")} regressions vs {regressions("ultra")}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SETS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{s.sub}</div>

        <div className="mt-3 space-y-1">
          <div className="flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            <span className="w-32 shrink-0 text-right">benchmark</span>
            <span className="w-14 shrink-0 text-right">FineWeb</span>
            <span className="flex-1 text-center">change against it</span>
          </div>
          {[...s.rows, ...s.avg].map((r, i) => {
            const isAvg = i >= s.rows.length
            return (
              <div
                key={r.b}
                className={cn("flex items-center gap-2 rounded-md px-1 py-0.5", isAvg && "bg-muted/30", r.zh && "opacity-90")}
              >
                <span className="w-32 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{r.b}</span>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {r.base.toFixed(2)}
                </span>
                <div className="relative h-8 flex-1">
                  <div className="absolute left-1/2 top-0 h-8 border-l border-dashed" style={{ borderColor: "currentColor", opacity: 0.25 }} />
                  {COLS.map((c, j) => {
                    const d = r[c.key] - r.base
                    const w = (Math.abs(d) / 13) * 50
                    return (
                      <div
                        key={c.key}
                        className="absolute h-[9px] rounded-sm"
                        style={{
                          top: j * 12 + 3,
                          left: d >= 0 ? "50%" : `${50 - w}%`,
                          width: `${Math.max(0.4, w)}%`,
                          background: d >= 0 ? c.c : WARM,
                          opacity: d >= 0 ? 0.9 : 1,
                        }}
                        title={`${c.label}: ${r[c.key].toFixed(2)} (${d >= 0 ? "+" : ""}${d.toFixed(2)})`}
                      />
                    )
                  })}
                </div>
                {COLS.map((c) => {
                  const d = r[c.key] - r.base
                  return (
                    <span
                      key={c.key}
                      className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums"
                      style={{ color: d >= 0 ? c.c : WARM }}
                    >
                      {d >= 0 ? "+" : ""}
                      {d.toFixed(2)}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {COLS.map((c) => (
            <span key={c.key} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: c.c }} />
              {c.label} (upper bar / first column)
            </span>
          ))}
          <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: WARM }} />
            bars left of the line are regressions
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read the direction of the bars, not their length. On individual data, FineWeb-edu buys{" "}
          <span className="text-foreground">+10.77 on ARC-E and +9.39 on ARC-C</span>{" "}and gives ground back on
          five of nine English benchmarks — CommonSenseQA, HellaSwag, PIQA, SIQA and Winogrande all move the wrong
          way. An education-quality filter narrows the training distribution, and the benchmarks that measure
          everyday commonsense are the ones that notice.
          <br />
          <br />
          Ultra-FineWeb keeps essentially all of the ARC and MMLU gains and regresses on{" "}
          <span className="text-foreground">exactly one benchmark, by 0.15 points</span>. That is the interesting
          claim, and it is a different one from &ldquo;higher average&rdquo;: the two filters are not on the same
          quality axis at different points, they are trading against different things. One is selecting for a
          topic; the other is selecting for whatever a verification run says helps.
        </p>
      </div>
    </figure>
  )
}
