"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { FONTS, STAGES, TABLES, type FontId } from "./data"

// Where the bytes of a variable font go: the uncompressed sfnt table sizes of each intermediate file, read back from the
// table directory with fontTools. The woff2 transform changes what these cost on the wire, but not who the big ones are.

const PALETTE = [
  "oklch(0.60 0.17 30)",
  "oklch(0.62 0.15 285)",
  "oklch(0.62 0.15 150)",
  "oklch(0.70 0.14 80)",
  "oklch(0.60 0.12 220)",
  "oklch(0.62 0.15 340)",
  "oklch(0.55 0.02 260)",
]

const fmt = (n: number) => n.toLocaleString("en-US")

export function TableBytes() {
  const [font, setFont] = useState<FontId>("Inter")
  const t = TABLES[font]
  const max = t.rows.orig.total

  return (
    <div className="not-prose my-8 rounded-lg border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">font</span>
        {FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFont(f.id)}
            aria-pressed={font === f.id}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              font === f.id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {STAGES.map((s) => {
          const row = t.rows[s.id]
          return (
            <div key={s.id}>
              <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>{s.label}</span>
                <span className="tabular-nums">{fmt(row.total)} B in tables</span>
              </div>
              <div
                className="flex h-5 overflow-hidden rounded bg-muted"
                style={{ width: `${(row.total / max) * 100}%`, minWidth: "4%" }}
                role="img"
                aria-label={`${s.label}: ${t.keys.map((k) => `${k} ${fmt(row.parts[k] ?? 0)} bytes`).join(", ")}.`}
              >
                {t.keys.map((k, i) => (
                  <span key={k} className="h-full" title={`${k} ${fmt(row.parts[k] ?? 0)} B`} style={{ width: `${((row.parts[k] ?? 0) / row.total) * 100}%`, background: PALETTE[i] }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {t.keys.map((k, i) => (
          <li key={k} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: PALETTE[i] }} />
            {k} <span className="tabular-nums text-foreground">{fmt(t.rows.orig.parts[k] ?? 0)}</span>
            <span>{"→"}</span>
            <span className="tabular-nums text-foreground">{fmt(t.rows.opt.parts[k] ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        measured. Uncompressed sfnt table lengths. Legend: original {"→"} wght 400-700. gvar holds the per-glyph weight and optical-size deltas; GPOS is kerning and mark positioning.
      </p>
    </div>
  )
}
