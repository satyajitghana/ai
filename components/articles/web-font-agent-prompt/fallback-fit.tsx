"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { FIT, LOADS, WIDTH_FALLBACK, WIDTH_INTER } from "./data"

// size-adjust on the fallback face. The two widths are measured (the same three paragraphs set in Inter and in
// Liberation Sans at 100 px). The line-width error and the "would it re-wrap" estimate below are my arithmetic on
// them; the table at the bottom is the measured Chromium result.

const COLUMN = 620
const FONT_PX = 18

export function FallbackFit() {
  const [adj, setAdj] = useState(100)
  const [net, setNet] = useState<"slow" | "fast">("slow")

  // A line of text that is exactly COLUMN px wide in Inter is this wide in the fallback at the chosen size-adjust.
  const ratio = WIDTH_INTER / WIDTH_FALLBACK // advance of Inter per advance of the fallback, at equal font-size
  const fallbackLine = (COLUMN / ratio) * (adj / 100)
  const err = fallbackLine - COLUMN
  const exact = ratio * 100
  const lines = 8 // the test text wraps to 3 + 3 + 2 lines at this width in Inter
  const reflowPx = Math.abs(err) * lines

  return (
    <div className="not-prose my-8 rounded-lg border bg-card p-4 text-card-foreground">
      <label className="flex items-center gap-3 text-xs">
        <span className="w-28 shrink-0 font-mono text-muted-foreground">size-adjust</span>
        <Range min={90} max={110} step={0.01} value={adj} onChange={(e) => setAdj(Number(e.target.value))} aria-label="size-adjust on the fallback face" className="w-full" />
        <span className="w-20 shrink-0 text-right font-mono tabular-nums">{adj.toFixed(2)}%</span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAdj(100)}
          className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted"
        >
          none (100%)
        </button>
        <button
          type="button"
          onClick={() => setAdj(Number(exact.toFixed(2)))}
          className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted"
        >
          fitted ({FIT.size}%)
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">a {COLUMN} px line of Inter, set in the fallback instead</div>
          <div className="relative h-3 rounded bg-muted" role="img" aria-label={`The fallback line is ${fallbackLine.toFixed(1)} pixels wide against ${COLUMN} for Inter.`}>
            <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (fallbackLine / (COLUMN * 1.12)) * 100)}%`, background: "oklch(0.60 0.17 30)", opacity: 0.85 }} />
            <div className="absolute inset-y-[-3px] w-px bg-foreground" style={{ left: `${(COLUMN / (COLUMN * 1.12)) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>fallback {fallbackLine.toFixed(1)} px</span>
            <span>Inter {COLUMN} px (the line)</span>
          </div>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          error per line {err >= 0 ? "+" : ""}
          {err.toFixed(1)} px ({((err / COLUMN) * 100).toFixed(1)}%), about {reflowPx.toFixed(0)} px of drift over {lines} lines at {FONT_PX} px. reasoned.
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          also from hhea, divided by the same factor: ascent-override {FIT.ascent}%, descent-override {FIT.descent}%, line-gap-override {FIT.gap}%.
        </p>
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">measured, 7 loads each</span>
          {(["slow", "fast"] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNet(n)}
              aria-pressed={net === n}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                net === n ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {n === "slow" ? "1.6 Mbps, 150 ms" : "9 Mbps, 40 ms"}
            </button>
          ))}
        </div>
        <table className="w-full text-left font-mono text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-normal">variant</th>
              <th className="py-1 pr-2 text-right font-normal">font B</th>
              <th className="py-1 pr-2 text-right font-normal">ready ms</th>
              <th className="py-1 text-right font-normal">CLS</th>
            </tr>
          </thead>
          <tbody>
            {LOADS[net].map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-1 pr-2">{r.label}</td>
                <td className="py-1 pr-2 text-right">{r.bytes.toLocaleString("en-US")}</td>
                <td className="py-1 pr-2 text-right">{r.ready}</td>
                <td className="py-1 text-right">{r.cls.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
