"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// olmOCR-Bench per-category scores, Table 5 of the Jina-OCR-v1 tech report.
// Every cell is transcribed as printed; "-" means the paper reports no number
// under that protocol for that model (not a zero). Hdr/Ftr and the two
// footnoted overalls carry the paper's own caveats, kept in the footer note.
type Category =
  | "overall"
  | "arxiv"
  | "oldScansMath"
  | "tables"
  | "oldScans"
  | "multiCol"
  | "longTiny"
  | "hdrFtr"
  | "base"

const CATEGORIES: { key: Category; label: string; short: string }[] = [
  { key: "overall", label: "Overall", short: "Overall" },
  { key: "arxiv", label: "ArXiv", short: "ArXiv" },
  { key: "oldScansMath", label: "Old scans, math", short: "OS-Math" },
  { key: "tables", label: "Tables", short: "Tables" },
  { key: "oldScans", label: "Old scans", short: "OldScans" },
  { key: "multiCol", label: "Multi-column", short: "Multi-col" },
  { key: "longTiny", label: "Long / tiny text", short: "LongTiny" },
  { key: "hdrFtr", label: "Headers / footers *", short: "Hdr/Ftr" },
  { key: "base", label: "Base", short: "Base" },
]

type Row = {
  model: string
  general?: boolean
  jina?: boolean
  backbone?: boolean
  scores: Partial<Record<Category, number>>
}

const ROWS: Row[] = [
  {
    model: "Gemini 3 Flash",
    general: true,
    scores: { arxiv: 80.1, oldScansMath: 73.6, tables: 64.6, oldScans: 45.8, multiCol: 75.3, longTiny: 90.3, hdrFtr: 27.4 },
  },
  {
    model: "Qwen3-VL-235B",
    general: true,
    scores: { arxiv: 88.4, oldScansMath: 81.2, tables: 86.7, oldScans: 49.6, multiCol: 85.9, longTiny: 88.9, hdrFtr: 33.6 },
  },
  {
    model: "DeepSeek-OCR",
    backbone: true,
    scores: { arxiv: 77.5, oldScansMath: 74.5, tables: 77.3, oldScans: 33.1, multiCol: 67.3, longTiny: 83.0, hdrFtr: 96.1, base: 99.3, overall: 76.0 },
  },
  {
    model: "olmOCR-2",
    scores: { arxiv: 82.9, oldScansMath: 82.1, tables: 84.3, oldScans: 48.3, multiCol: 84.3, longTiny: 81.4, base: 99.7, overall: 82.4 },
  },
  {
    model: "LightOnOCR-2",
    scores: { arxiv: 89.6, oldScansMath: 85.6, tables: 89.0, oldScans: 42.2, multiCol: 84.8, longTiny: 91.4, hdrFtr: 19.7, base: 99.6, overall: 83.2 },
  },
  {
    model: "dots.mocr",
    scores: { arxiv: 85.9, oldScansMath: 85.5, tables: 90.7, oldScans: 48.2, multiCol: 85.3, longTiny: 81.6, hdrFtr: 94.0, base: 99.7, overall: 83.9 },
  },
  {
    model: "Jina-OCR-v1",
    jina: true,
    scores: { arxiv: 86.1, oldScansMath: 82.3, tables: 88.8, oldScans: 42.6, multiCol: 85.5, longTiny: 93.2, hdrFtr: 88.7, base: 99.9, overall: 83.4 },
  },
  {
    model: "chandra-ocr-2",
    scores: { arxiv: 86.9, oldScansMath: 89.1, tables: 92.1, oldScans: 51.1, multiCol: 82.1, longTiny: 93.7, hdrFtr: 91.4, base: 99.9, overall: 85.8 },
  },
]

const JINA_C = "oklch(0.6 0.16 255)"

export function CategoryBreakdown() {
  const [cat, setCat] = useState<Category>("oldScans")

  const rows = ROWS.filter((r) => r.scores[cat] != null)
  const sorted = [...rows].sort((a, b) => (b.scores[cat] ?? 0) - (a.scores[cat] ?? 0))
  const max = Math.max(...sorted.map((r) => r.scores[cat] ?? 0), 1)
  const jinaRank = sorted.findIndex((r) => r.jina) + 1
  const specializedCount = sorted.filter((r) => !r.general).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        olmOCR-Bench by category &middot; specialized OCR models + 2 general VLMs, per Table 5 of the tech report
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              aria-pressed={cat === c.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                cat === c.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {c.short}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          {sorted.map((r) => {
            const v = r.scores[cat] ?? 0
            const pct = (v / max) * 100
            return (
              <div key={r.model} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-32 shrink-0 truncate text-right font-mono text-xs sm:w-36",
                    r.jina ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.model}
                </span>
                <div className="relative h-6 flex-1">
                  <div
                    className={cn("absolute top-1/2 h-4 -translate-y-1/2 rounded-sm", r.general && "opacity-50")}
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      background: r.jina ? JINA_C : "oklch(0.62 0.02 260)",
                      backgroundImage: r.general
                        ? "repeating-linear-gradient(135deg, transparent 0 4px, rgba(0,0,0,0.15) 4px 6px)"
                        : undefined,
                    }}
                  />
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] tabular-nums",
                      r.jina ? "text-foreground" : "text-muted-foreground"
                    )}
                    style={{ left: `${pct}%` }}
                  >
                    {v.toFixed(1)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {cat === "oldScans" ? (
            <>
              This is Jina-OCR-v1&rsquo;s weakest category by a wide margin:{" "}
              <span style={{ color: JINA_C }}>42.6</span>, {jinaRank} of {specializedCount} specialized models,
              barely ahead of the DeepSeek-OCR backbone it post-trains (33.1) and behind chandra-ocr-2 (51.1),
              olmOCR-2 (48.3), and dots.mocr (48.2). Degraded historical scans, not tables or multi-column layout,
              are where this model is furthest from the frontier.
            </>
          ) : cat === "multiCol" ? (
            <>
              Multi-column layout is the opposite story: <span style={{ color: JINA_C }}>85.5</span>, second of all
              eight systems in the table, behind only Qwen3-VL-235B (85.9). Reading order across columns is a
              genuine strength here.
            </>
          ) : (
            <>
              Jina-OCR-v1 ranks {jinaRank} of {specializedCount} specialized models on this category.
            </>
          )}
        </p>

        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          * Hdr/Ftr rewards omitting headers and footers, so a model that faithfully transcribes everything scores
          low here on purpose &mdash; wide dispersion on this column is not a reading-order signal.
        </p>
      </div>
    </figure>
  )
}
