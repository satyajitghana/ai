"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { BLOCK, LOCAL, PER_PAGE, REMOTE_CAP, fmt } from "./data"

// The prompt is BOS, then <PAGE> + 273 image tokens per page, then 5 instruction tokens. Blocks are 32 tokens and
// ignore page boundaries. Page Gate keeps the blocks that hold at least one image token of the query's page
// (paper eq. 2); Token Sieve keeps at most 12 of them. This is our re-derivation of the published code.
function layout(pages: number) {
  const kind: number[] = [-1]
  for (let p = 0; p < pages; p++) {
    kind.push(-1)
    for (let i = 0; i < PER_PAGE; i++) kind.push(p)
  }
  for (let i = 0; i < 5; i++) kind.push(-1)
  const nb = Math.ceil(kind.length / BLOCK)
  const cells: { img: number[]; has: Set<number> }[] = []
  for (let b = 0; b < nb; b++) {
    const has = new Set<number>()
    const img: number[] = []
    for (let t = b * BLOCK; t < Math.min(kind.length, (b + 1) * BLOCK); t++) {
      if (kind[t] >= 0) {
        has.add(kind[t])
        img.push(kind[t])
      }
    }
    cells.push({ img, has })
  }
  return { kind, cells }
}

const MODES = [
  { id: "full", label: "Full attention" },
  { id: "rswa", label: "R-SWA (v1)" },
  { id: "sr", label: "SR-SWA (v2)" },
] as const
type Mode = (typeof MODES)[number]["id"]

export function ReadSetStrip() {
  const [pages, setPages] = useState(6)
  const [page, setPage] = useState(3)
  const [mode, setMode] = useState<Mode>("sr")
  const q = Math.min(page, pages)
  const { kind, cells } = layout(pages)
  const prompt = kind.length
  const cand: number[] = []
  cells.forEach((c, i) => {
    if (c.has.has(q - 1)) cand.push(i)
  })
  const picked = new Set(cand.slice(0, REMOTE_CAP))
  const textSoFar = (q - 1) * 1024 + 512
  const textBlocks = 4

  const attendedCell = (i: number): boolean => {
    if (mode === "full") return true
    if (mode === "rswa") return cells[i].has.size > 0
    return picked.has(i)
  }
  const keysVisual =
    mode === "full" || mode === "rswa"
      ? pages * PER_PAGE
      : cells.reduce((a, _c, i) => (picked.has(i) ? a + BLOCK : a), 0)
  const keysText = mode === "full" ? textSoFar + 6 : LOCAL
  const total = keysVisual + keysText

  const cols = 26
  const size = 15
  const gap = 3
  const rows = Math.ceil(cells.length / cols)
  const w = cols * (size + gap)
  const h = rows * (size + gap) + 34
  const colorFor = (i: number): string => {
    const c = cells[i]
    if (c.has.size === 0) return "var(--muted)"
    const par = Math.min(...c.img) % 2
    return par === 0 ? "oklch(0.78 0.08 230)" : "oklch(0.8 0.09 70)"
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one decode step: which 32-token blocks a query reads · our re-derivation from the published code
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              mode === m.id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 px-4 pt-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">pages</span>
          <Range min={2} max={12} step={1} value={pages} onChange={(e) => setPages(Number(e.target.value))} aria-label="pages in the document" className="w-full" />
          <span className="w-12 text-right font-mono tabular-nums">{pages}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">query on page</span>
          <Range min={1} max={pages} step={1} value={q} onChange={(e) => setPage(Number(e.target.value))} aria-label="page the decoder is writing" className="w-full" />
          <span className="w-12 text-right font-mono tabular-nums">{q}</span>
        </label>
      </div>
      <div className="px-4 py-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`${cells.length} prompt blocks, ${picked.size} read by the selected mode`}>
          {cells.map((c, i) => {
            const r = Math.floor(i / cols)
            const k = i % cols
            const on = attendedCell(i)
            return (
              <rect
                key={i}
                x={k * (size + gap)}
                y={r * (size + gap)}
                width={size}
                height={size}
                rx={3}
                fill={colorFor(i)}
                opacity={on ? 1 : 0.22}
                stroke={on ? "var(--foreground)" : "none"}
                strokeWidth={on ? 1.4 : 0}
              />
            )
          })}
          <text x={0} y={rows * (size + gap) + 20} fontSize={11} fill="var(--muted-foreground)" fontFamily="var(--font-mono, monospace)">
            {`prompt: ${cells.length} blocks, ${fmt(prompt)} tokens; blue and amber alternate by page, grey holds no image token`}
          </text>
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t px-4 py-3 font-mono text-[11px]">
        <div>
          <div className="text-muted-foreground">visual keys</div>
          <div className="text-base tabular-nums">{fmt(keysVisual)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{mode === "full" ? "text keys so far" : "text window"}</div>
          <div className="text-base tabular-nums">{fmt(keysText)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">read this step</div>
          <div className="text-base tabular-nums">{fmt(total)}</div>
        </div>
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Page {q} has {cand.length} candidate blocks; the cap is {REMOTE_CAP}, so under SR-SWA {cand.length <= REMOTE_CAP ? "every one is read" : "the router keeps 12"}.
        The last {textBlocks} text blocks ({LOCAL} tokens) are the local window.
      </p>
    </figure>
  )
}
