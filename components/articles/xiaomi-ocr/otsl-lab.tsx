"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { OTSL_PRESETS } from "./otsl-data"

type Tag = "fcel" | "ecel" | "lcel" | "ucel" | "xcel"
type Chunk = { tag: Tag; text: string }
type Placed = { text: string; r: number; c: number; rowspan: number; colspan: number }

const TAG_RE = /<(fcel|ecel|lcel|ucel|xcel|nl)>/g

// Our own decoder, written from the tag semantics documented in the repo's postprocess/otsl.py:
// fcel = cell with text, ecel = empty cell, lcel = continues the cell at left, ucel = continues the cell above,
// xcel = continues both, nl = end of row. Only fcel and ecel start a cell; the others stretch an origin cell.
export function decodeOtsl(src: string): { cells: Placed[]; rows: number; cols: number; warnings: string[] } {
  const warnings: string[] = []
  const rows: Chunk[][] = []
  for (const line of src.split("<nl>")) {
    const parts: Chunk[] = []
    const hits = [...line.matchAll(TAG_RE)]
    hits.forEach((m, k) => {
      const start = (m.index ?? 0) + m[0].length
      const end = k + 1 < hits.length ? (hits[k + 1].index ?? line.length) : line.length
      parts.push({ tag: m[1] as Tag, text: line.slice(start, end).trim() })
    })
    if (parts.length) rows.push(parts)
  }
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const grid: Chunk[][] = rows.map((r, ri) => {
    if (r.length < cols) warnings.push(`row ${ri + 1} has ${r.length} of ${cols} cells: padded with empty cells`)
    return [...r, ...Array.from({ length: cols - r.length }, (): Chunk => ({ tag: "ecel", text: "" }))]
  })
  const cells: Placed[] = []
  grid.forEach((row, r) =>
    row.forEach((ch, c) => {
      if (ch.tag !== "fcel" && ch.tag !== "ecel") {
        const okLeft = c > 0 && (ch.tag === "lcel" || ch.tag === "xcel")
        const okUp = r > 0 && (ch.tag === "ucel" || ch.tag === "xcel")
        if (!okLeft && !okUp) warnings.push(`${ch.tag} at row ${r + 1}, column ${c + 1} has nothing to continue`)
        return
      }
      let colspan = 1
      while (c + colspan < cols && (grid[r][c + colspan].tag === "lcel" || grid[r][c + colspan].tag === "xcel")) colspan++
      let rowspan = 1
      while (r + rowspan < grid.length && (grid[r + rowspan][c].tag === "ucel" || grid[r + rowspan][c].tag === "xcel")) rowspan++
      cells.push({ text: ch.text, r, c, rowspan, colspan })
    })
  )
  return { cells, rows: grid.length, cols, warnings }
}

const TAGS: [string, string][] = [
  ["<fcel>", "a cell with text"],
  ["<ecel>", "an empty cell"],
  ["<lcel>", "continues the cell to its left"],
  ["<ucel>", "continues the cell above"],
  ["<xcel>", "continues both"],
  ["<nl>", "end of row"],
]

export function OtslLab() {
  const [k, setK] = useState(0)
  const [src, setSrc] = useState(OTSL_PRESETS[0].otsl)
  const out = useMemo(() => decodeOtsl(src), [src])
  const grid = useMemo(() => {
    const byRow: Placed[][] = Array.from({ length: out.rows }, () => [])
    out.cells.forEach((c) => byRow[c.r].push(c))
    return byRow
  }, [out])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the table format · edit the string, the grid follows · our decoder, written from the repo&apos;s documented tag meanings
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {OTSL_PRESETS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setK(i)
              setSrc(p.otsl)
            }}
            aria-pressed={i === k}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              i === k ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">OTSL</span>
          <textarea
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            spellCheck={false}
            rows={9}
            className="w-full rounded border bg-background p-2 font-mono text-[11px] leading-relaxed"
          />
        </label>
        <div>
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
            {out.rows} rows × {out.cols} columns · {out.cells.length} origin cells
          </span>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {grid.map((row, r) => (
                  <tr key={r}>
                    {row.map((c) => (
                      <td
                        key={`${c.r}-${c.c}`}
                        rowSpan={c.rowspan}
                        colSpan={c.colspan}
                        className={cn("border px-2 py-1", c.colspan > 1 || c.rowspan > 1 ? "bg-muted/60 text-center" : "")}
                      >
                        {c.text || <span className="text-muted-foreground">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {out.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-amber-600 dark:text-amber-400">
              {out.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <dl className="grid gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-[11px] sm:grid-cols-2">
        {TAGS.map(([t, d]) => (
          <div key={t} className="flex gap-2">
            <dt className="shrink-0 text-foreground">{t}</dt>
            <dd className="text-muted-foreground">{d}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}
