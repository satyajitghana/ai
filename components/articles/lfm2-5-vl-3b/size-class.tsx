"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// All 28 vision benchmarks from Liquid AI's table, with the parameter counts
// they publish alongside each model. The per-model averages in the ROWS data
// are the blog's own "Average" row; I recompute them from the 28 rows in the
// component and show both when they disagree, because a mismatch would mean I
// transcribed something wrong.

const MODELS = [
  { name: "LFM2.5-VL-3B", p: 3.1, self: true },
  { name: "LFM2-VL-3B", p: 3.1, prev: true },
  { name: "gemma-4-E2B-it", p: 5.1 },
  { name: "gemma-4-E4B-it", p: 8 },
  { name: "InternVL 3.5 2B", p: 2.4 },
  { name: "InternVL 3.5 4B", p: 4.7 },
  { name: "Qwen3.5-2B", p: 2.3 },
  { name: "Qwen3.5-4B", p: 4.7 },
]

// blog's published Average row, for cross-checking
const PUBLISHED = [69.4, 57.2, 52.0, 59.7, 64.6, 69.4, 63.7, 70.1]

type Row = { g: string; n: string; s: number[] }

const ROWS: Row[] = [
  { g: "General", n: "MMStar", s: [63.3, 57.7, 45.3, 52.9, 57.7, 65.5, 55.1, 59.3] },
  { g: "General", n: "MME", s: [73.1, 73.0, 54.9, 67.6, 73.6, 81.0, 76.2, 79.5] },
  { g: "General", n: "RealWorldQA", s: [73.1, 71.1, 60.0, 64.3, 61.6, 67.7, 65.1, 67.1] },
  { g: "General", n: "SimpleVQA", s: [35.4, 33.0, 27.3, 30.4, 30.5, 33.7, 35.2, 40.7] },
  { g: "General", n: "SEED-Bench (image)", s: [77.7, 76.6, 71.4, 75.3, 75.4, 76.4, 75.8, 76.1] },
  { g: "General", n: "MMBench (dev EN v1.1)", s: [81.0, 80.0, 64.2, 71.6, 76.2, 81.1, 73.1, 78.4] },
  { g: "General", n: "CountBenchQA", s: [87.3, 92.2, 70.4, 80.5, 70.4, 82.5, 83.8, 86.7] },
  { g: "Multilingual", n: "MMMB", s: [83.0, 81.9, 73.3, 80.4, 76.3, 81.5, 75.9, 82.0] },
  { g: "Multilingual", n: "Multilingual MMBench", s: [79.5, 76.3, 62.8, 71.2, 70.9, 76.6, 69.9, 77.0] },
  { g: "Multimodal IF", n: "MM-IFEval", s: [60.6, 51.4, 65.6, 68.2, 47.1, 54.5, 55.4, 63.1] },
  { g: "STEM", n: "LogicVista", s: [37.4, 32.2, 29.5, 34.5, 30.9, 36.2, 34.0, 37.6] },
  { g: "STEM", n: "MathVista (mini)", s: [68.5, 62.1, 37.8, 45.2, 56.8, 67.1, 48.7, 63.6] },
  { g: "STEM", n: "MMMU-Pro", s: [30.5, 28.7, 26.9, 32.6, 21.3, 22.7, 24.9, 36.0] },
  { g: "STEM", n: "MMMU (val)", s: [48.4, 45.6, 41.1, 49.3, 52.0, 60.7, 44.1, 50.3] },
  { g: "Doc/OCR", n: "ChartQA (test)", s: [81.3, 80.4, 43.2, 42.1, 81.7, 86.2, 78.4, 84.2] },
  { g: "Doc/OCR", n: "DocVQA (val)", s: [91.1, 89.8, 85.7, 87.4, 88.4, 91.8, 92.6, 94.8] },
  { g: "Doc/OCR", n: "InfographicVQA (val)", s: [70.2, 67.8, 54.4, 60.9, 69.3, 76.9, 73.5, 80.3] },
  { g: "Doc/OCR", n: "OCRBench v1", s: [84.2, 81.7, 70.2, 73.5, 83.9, 82.0, 84.4, 85.6] },
  { g: "Doc/OCR", n: "OCRBench v2 (En)", s: [47.5, 43.9, 44.4, 48.8, 45.5, 49.1, 47.7, 58.7] },
  { g: "Doc/OCR", n: "TextVQA (val)", s: [84.3, 83.0, 62.5, 69.0, 76.6, 77.5, 77.3, 81.2] },
  { g: "Grounding", n: "RefCOCO-avg", s: [87.9, 57.1, 67.3, 72.1, 82.9, 88.8, 78.5, 86.6] },
  { g: "Multi-Image", n: "BLINK", s: [61.5, 50.2, 45.2, 52.2, 52.0, 57.2, 48.6, 58.7] },
  { g: "Multi-Image", n: "MuirBench", s: [58.3, 34.9, 32.9, 51.8, 45.0, 53.5, 48.2, 62.0] },
  { g: "Hallucination", n: "HallusionBench", s: [47.2, 46.4, 41.8, 49.8, 47.6, 52.1, 49.3, 51.7] },
  { g: "Hallucination", n: "POPE", s: [88.7, 89.2, 84.0, 86.9, 88.0, 88.9, 88.6, 86.0] },
  { g: "GUI", n: "ScreenSpot-v2 Desktop", s: [78.7, 6.0, 28.1, 45.8, 79.9, 82.0, 63.8, 76.3] },
  { g: "GUI", n: "ScreenSpot-v2 Mobile", s: [81.2, 7.6, 42.9, 60.3, 86.2, 87.8, 69.7, 81.4] },
  { g: "GUI", n: "ScreenSpot-v2 Web", s: [82.2, 2.5, 22.4, 47.6, 79.9, 82.6, 65.9, 77.8] },
]

const computed = MODELS.map((_, i) => ROWS.reduce((a, r) => a + r.s[i], 0) / ROWS.length)

// wins/losses for LFM2.5-VL-3B against each other model, over all 28 rows
const RECORD = MODELS.slice(1).map((m, k) => {
  const i = k + 1
  let w = 0, l = 0
  for (const r of ROWS) {
    if (r.s[0] > r.s[i]) w++
    else if (r.s[0] < r.s[i]) l++
  }
  return { ...m, w, l }
})

const SELF = "oklch(0.60 0.15 255)"
const PREV = "oklch(0.58 0.19 25)"
const OTHER = "oklch(0.62 0.03 250)"

type View = "average" | "record"

export function SizeClass() {
  const [view, setView] = useState<View>("average")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">28 vision benchmarks · 8 models</span>
        <div className="flex gap-1">
          {(["average", "record"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "average" ? "average vs size" : "head-to-head"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "average" ? (
          <div className="space-y-1.5">
            {MODELS.map((m, i) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                  {m.name}
                </span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{ width: `${PUBLISHED[i]}%`, background: m.self ? SELF : m.prev ? PREV : OTHER }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {PUBLISHED[i].toFixed(1)}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[9px] text-muted-foreground">
                  {m.p}B params
                </span>
              </div>
            ))}
            <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
              recomputed from the 28 rows: {computed.map((c) => c.toFixed(1)).join(" · ")}
              <br />
              published average row: {PUBLISHED.map((c) => c.toFixed(1)).join(" · ")}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {RECORD.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                  {r.name}
                </span>
                <div className="flex h-4 flex-1 overflow-hidden rounded-sm bg-muted/40">
                  <div
                    className="flex items-center justify-end pr-1 font-mono text-[9px] text-white"
                    style={{ width: `${(r.w / 28) * 100}%`, background: SELF }}
                  >
                    {r.w}
                  </div>
                  {r.l > 0 ? (
                    <div
                      className="flex items-center pl-1 font-mono text-[9px] text-white"
                      style={{ width: `${(r.l / 28) * 100}%`, background: PREV }}
                    >
                      {r.l}
                    </div>
                  ) : null}
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {r.w}W–{r.l}L
                </span>
                <span className="w-8 shrink-0 text-right font-mono text-[9px] text-muted-foreground">{r.p}B</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The averages I recompute from the 28 rows match Liquid AI&rsquo;s published Average row on every model, so
          the table is internally consistent. The claim it supports is a narrow one, stated carefully: LFM2.5-VL-3B
          averages <span className="text-foreground">69.4</span>, exactly level with InternVL 3.5 4B at 4.7B
          parameters and 0.7 behind Qwen3.5-4B, also 4.7B. It beats both Gemma models, which are 5.1B and 8B. So
          &ldquo;competitive against models twice its size&rdquo; is true, and &ldquo;better than models twice its
          size&rdquo; would not have been.
        </p>
      </div>
    </figure>
  )
}
