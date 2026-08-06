"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Reconstructs pdf-inspector's vector-outlined-text heuristic from src/detector.rs:
// a page is flagged "needs OCR despite having drawing operators" when
//   path_ops >= 1000 && path_ops > text_ops * 200 && unique_alphanum_chars < 30
// i.e. a huge volume of path-drawing ops, almost no real text-showing ops, and
// almost no distinct characters actually rendered as text — the signature of
// glyphs drawn as outlined vector paths instead of selectable text. All three
// inputs are plain ranges; the verdict is computed live, no network/model call.

const ACCENT = "oklch(0.7 0.16 45)"
const OK = "oklch(0.65 0.14 155)"

type Preset = { name: string; pathOps: number; textOps: number; uniqueChars: number }

const PRESETS: Preset[] = [
  { name: "normal body text", pathOps: 80, textOps: 420, uniqueChars: 61 },
  { name: "logo-heavy report", pathOps: 900, textOps: 380, uniqueChars: 45 },
  { name: "vector-outlined text", pathOps: 2400, textOps: 8, uniqueChars: 4 },
]

export function VectorTextClassifier() {
  const [pathOps, setPathOps] = useState(80)
  const [textOps, setTextOps] = useState(420)
  const [uniqueChars, setUniqueChars] = useState(61)

  const c1 = pathOps >= 1000
  const c2 = pathOps > textOps * 200
  const c3 = uniqueChars < 30
  const flagged = c1 && c2 && c3

  const applyPreset = (p: Preset) => {
    setPathOps(p.pathOps)
    setTextOps(p.textOps)
    setUniqueChars(p.uniqueChars)
  }

  const row = (
    label: string,
    val: number,
    setVal: (n: number) => void,
    min: number,
    max: number,
  ) => (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{val}</span>
      </div>
      <Range
        min={min}
        max={max}
        step={1}
        value={val}
        onChange={(e) => setVal(+e.target.value)}
        className="w-full"
        aria-label={label}
        accent={ACCENT}
      />
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        vector-outlined-text heuristic (detector.rs)
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="cursor-pointer rounded-full border border-transparent px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {row("path_ops (drawing operators sampled)", pathOps, setPathOps, 0, 3000)}
          {row("text_ops (Tj / TJ operators sampled)", textOps, setTextOps, 0, 800)}
          {row("unique alphanumeric chars rendered", uniqueChars, setUniqueChars, 0, 80)}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-1.5 border-t pt-3 font-mono text-[11px] sm:grid-cols-3">
          <div className={c1 ? "text-foreground" : "text-muted-foreground"}>
            {c1 ? "✓" : "✗"} path_ops ≥ 1000
          </div>
          <div className={c2 ? "text-foreground" : "text-muted-foreground"}>
            {c2 ? "✓" : "✗"} path_ops &gt; text_ops × 200
          </div>
          <div className={c3 ? "text-foreground" : "text-muted-foreground"}>
            {c3 ? "✓" : "✗"} unique_chars &lt; 30
          </div>
        </div>

        <div
          className="mt-3 rounded-lg border px-3 py-2.5 text-center font-mono text-[12px]"
          style={{ borderColor: flagged ? ACCENT : OK, color: flagged ? ACCENT : OK }}
        >
          {flagged
            ? "flagged: suspected vector_text → route page to OCR"
            : "classified as selectable text → no OCR needed"}
        </div>
      </div>
    </figure>
  )
}
