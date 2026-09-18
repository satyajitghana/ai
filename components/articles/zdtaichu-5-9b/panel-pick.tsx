"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every benchmark row in the ZDTaichu5.0-9B release tables, and which of them
// made it into the release figure.
//
// Numbers are parsed straight out of the three <table> blocks in the Hugging
// Face model card (huggingface.co/TaichuAI/ZDTaichu5.0-9B, README.md) — 27 rows
// across spatial/embodied, general visual understanding, and language/agent.
// `inFigure` marks the 12 panels drawn in docs/assets/taichu-release-benchmark-
// comparison.svg, read off the rendered SVG.
//
// The point: the model card's own tables and the model card's own figure tell
// different stories about the same model, and the gap is not small. Against the
// three open baselines the release itself chose, ZDTaichu leads 17 of 27 rows.
// The 12 rows promoted to the figure are ones it leads 10 of. Nothing here is
// fabricated by the vendor — every loss is printed in the tables above the
// figure. It just is not what the picture shows.

type Row = {
  bench: string
  area: string
  section: "spatial" | "general" | "agent"
  zd: number
  qwen: number
  step3: number
  gemma: number
  gemini: number | null
  gpt: number | null
  inFigure: boolean
}

const ROWS: Row[] = [
  { bench: "CV-Bench", area: "Basic spatial perception", section: "spatial", zd: 86.82, qwen: 87.19, step3: 83.49, gemma: 68.1, gemini: 90.07, gpt: 86.84, inFigure: false },
  { bench: "3DSRBench", area: "Basic spatial perception", section: "spatial", zd: 60.96, qwen: 56.78, step3: 55.01, gemma: 53.62, gemini: 68.92, gpt: 60.2, inFigure: false },
  { bench: "SparBench", area: "Basic spatial perception", section: "spatial", zd: 51.82, qwen: 50.79, step3: 45.68, gemma: 28.5, gemini: 48.74, gpt: 55.07, inFigure: false },
  { bench: "ViewSpatial", area: "Complex spatial reasoning", section: "spatial", zd: 62.5, qwen: 48.2, step3: 46.14, gemma: 41.68, gemini: 50.36, gpt: 47.3, inFigure: true },
  { bench: "MMSI-Bench", area: "Complex spatial reasoning", section: "spatial", zd: 47.2, qwen: 38.7, step3: 32.18, gemma: 29.2, gemini: 45.2, gpt: 41.3, inFigure: true },
  { bench: "MindCube-tiny", area: "Complex spatial reasoning", section: "spatial", zd: 78.27, qwen: 57.6, step3: 62.81, gemma: 48.85, gemini: 70.87, gpt: 60.38, inFigure: true },
  { bench: "ERQA", area: "Embodied interaction", section: "spatial", zd: 48.0, qwen: 41.5, step3: 47.75, gemma: 30.2, gemini: 66.0, gpt: 59.8, inFigure: false },
  { bench: "RoboSpatial", area: "Embodied interaction", section: "spatial", zd: 56.0, qwen: 54.1, step3: 52.86, gemma: 49.43, gemini: 57.4, gpt: 43.78, inFigure: false },
  { bench: "VSI-Bench", area: "Embodied interaction", section: "spatial", zd: 59.69, qwen: 55.68, step3: 42.42, gemma: 32.91, gemini: 52.51, gpt: 54.49, inFigure: true },
  { bench: "MathVista Mini", area: "Multimodal reasoning", section: "general", zd: 84.5, qwen: 85.7, step3: 83.97, gemma: 65.3, gemini: 87.9, gpt: 83.1, inFigure: false },
  { bench: "WeMath", area: "Multimodal reasoning", section: "general", zd: 75.9, qwen: 75.2, step3: 73.03, gemma: 50.19, gemini: 86.9, gpt: 79.0, inFigure: true },
  { bench: "MathVerse Mini Vision Only", area: "Multimodal reasoning", section: "general", zd: 76.4, qwen: 84.14, step3: 74.6, gemma: 53.55, gemini: null, gpt: null, inFigure: false },
  { bench: "MMStar", area: "General VQA", section: "general", zd: 76.8, qwen: 79.7, step3: 77.48, gemma: 62.0, gemini: 83.1, gpt: 77.1, inFigure: true },
  { bench: "AI2D", area: "General VQA", section: "general", zd: 91.48, qwen: 90.2, step3: 89.35, gemma: 79.15, gemini: 94.1, gpt: 92.2, inFigure: true },
  { bench: "RealWorldQA", area: "General VQA", section: "general", zd: 76.99, qwen: 80.3, step3: 74.44, gemma: 59.08, gemini: 83.3, gpt: 83.3, inFigure: true },
  { bench: "OCRBench", area: "OCR", section: "general", zd: 85.5, qwen: 89.2, step3: 86.75, gemma: 76.9, gemini: 90.4, gpt: 80.7, inFigure: false },
  { bench: "MMLU-Pro", area: "Knowledge", section: "agent", zd: 77.2, qwen: 82.5, step3: 76.02, gemma: 69.4, gemini: 89.8, gpt: 87.4, inFigure: false },
  { bench: "MMLU-Redux", area: "Knowledge", section: "agent", zd: 88.4, qwen: 91.1, step3: 86.5, gemma: 85.3, gemini: 95.9, gpt: 95.0, inFigure: false },
  { bench: "IFEval", area: "Instruction following", section: "agent", zd: 93.7, qwen: 88.72, step3: 82.16, gemma: 87.8, gemini: 93.5, gpt: 94.8, inFigure: true },
  { bench: "IFBench", area: "Instruction following", section: "agent", zd: 69.0, qwen: 64.5, step3: 41.49, gemma: 34.7, gemini: 70.4, gpt: 75.4, inFigure: false },
  { bench: "AIME 2025", area: "Reasoning and coding", section: "agent", zd: 86.7, qwen: 83.75, step3: 87.66, gemma: 41.3, gemini: 95.0, gpt: 100.0, inFigure: false },
  { bench: "AIME 2026", area: "Reasoning and coding", section: "agent", zd: 89.2, qwen: 87.92, step3: 88.75, gemma: 42.5, gemini: 90.6, gpt: 96.7, inFigure: false },
  { bench: "HMMT Feb 2025", area: "Reasoning and coding", section: "agent", zd: 84.2, qwen: 83.2, step3: 78.18, gemma: 26.7, gemini: 97.3, gpt: 99.4, inFigure: false },
  { bench: "HMMT Feb 2026", area: "Reasoning and coding", section: "agent", zd: 72.7, qwen: 73.48, step3: 63.64, gemma: 33.7, gemini: 86.36, gpt: 96.97, inFigure: false },
  { bench: "LiveCodeBench v6", area: "Reasoning and coding", section: "agent", zd: 73.4, qwen: 65.6, step3: 58.86, gemma: 52.0, gemini: 90.7, gpt: 87.7, inFigure: true },
  { bench: "TAU2-Bench", area: "General agent", section: "agent", zd: 87.7, qwen: 79.1, step3: 81.7, gemma: 42.4, gemini: 85.4, gpt: 87.1, inFigure: true },
  { bench: "Claw-Eval (general)", area: "General agent", section: "agent", zd: 71.4, qwen: 66.5, step3: 66.6, gemma: 52.1, gemini: null, gpt: null, inFigure: true },
]

const OPEN_LABEL: Record<string, string> = {
  qwen: "Qwen3.5-9B",
  step3: "STEP3-VL-10B",
  gemma: "gemma4-8B-E4B",
}

function bestOpen(r: Row): { key: string; value: number } {
  const cands = [
    { key: "qwen", value: r.qwen },
    { key: "step3", value: r.step3 },
    { key: "gemma", value: r.gemma },
  ]
  return cands.reduce((a, b) => (b.value > a.value ? b : a))
}

type View = "figure" | "all" | "losses"

const VIEWS: { id: View; label: string; blurb: string }[] = [
  { id: "figure", label: "the 12 figure panels", blurb: "what the release figure draws" },
  { id: "all", label: "all 27 table rows", blurb: "what the tables above it print" },
  { id: "losses", label: "the 10 losses", blurb: "rows an open baseline wins" },
]

export function PanelPick() {
  const [view, setView] = useState<View>("figure")

  const scored = ROWS.map((r) => {
    const b = bestOpen(r)
    return { r, best: b, win: r.zd >= b.value, delta: r.zd - b.value }
  })

  const shown =
    view === "figure"
      ? scored.filter((s) => s.r.inFigure)
      : view === "losses"
        ? scored.filter((s) => !s.win)
        : scored

  const wins = shown.filter((s) => s.win).length
  const total = shown.length
  const pct = total === 0 ? 0 : (wins * 1000) / total / 10

  return (
    <figure
      className="my-8 rounded-md border"
      data-panel-pick={view}
      aria-label="ZDTaichu5.0-9B benchmark rows: release figure versus full tables"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={cn(
              "rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors",
              view === v.id
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-4">
        <span className="font-heading text-3xl font-semibold tabular-nums">
          {wins}/{total}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          {pct.toFixed(1)}% — rows where ZDTaichu5.0-9B is at least the best of{" "}
          Qwen3.5-9B, STEP3-VL-10B and gemma4-8B-E4B
        </span>
      </div>
      <p className="text-muted-foreground mt-1 mb-0 px-4 font-mono text-xs">
        {VIEWS.find((v) => v.id === view)?.blurb}
      </p>

      <div className="mt-3 overflow-x-auto px-2 pb-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-muted-foreground border-b font-mono text-xs">
              <th className="px-2 py-1.5 text-left font-normal">benchmark</th>
              <th className="px-2 py-1.5 text-right font-normal">ZDTaichu</th>
              <th className="px-2 py-1.5 text-right font-normal">best open</th>
              <th className="px-2 py-1.5 text-left font-normal">which</th>
              <th className="px-2 py-1.5 text-right font-normal">Δ</th>
              <th className="px-2 py-1.5 text-center font-normal">in figure</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ r, best, win, delta }) => (
              <tr
                key={r.bench}
                className={cn(
                  "border-b last:border-0",
                  !win && "bg-destructive/5"
                )}
              >
                <td className="px-2 py-1.5">
                  <span className="font-medium">{r.bench}</span>
                  <span className="text-muted-foreground block font-mono text-[11px]">
                    {r.area}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums",
                    win && "font-semibold"
                  )}
                >
                  {r.zd.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {best.value.toFixed(2)}
                </td>
                <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">
                  {OPEN_LABEL[best.key]}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums",
                    win ? "text-muted-foreground" : "text-destructive font-semibold"
                  )}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-center font-mono text-xs">
                  {r.inFigure ? "yes" : "—"}
                </td>
            </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="text-muted-foreground border-t px-4 py-3 font-mono text-xs">
        Scores parsed from the three tables in the ZDTaichu5.0-9B model card;
        &ldquo;in figure&rdquo; read off the release SVG. Eight of the ten losses
        are to Qwen3.5-9B — the model&rsquo;s own language backbone.
      </figcaption>
    </figure>
  )
}
