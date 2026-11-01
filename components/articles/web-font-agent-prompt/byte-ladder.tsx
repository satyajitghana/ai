"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CORE, EXT, FONTS, PIN400, STEPS, type FontId } from "./data"

// The ladder from the shipped TTF to a core file, one rung per decision in the prompt. Bytes are the exact sizes of
// files I produced with fontTools 4.68.0; the right-hand column is what the pixel diff said at that rung.

const fmt = (n: number) => n.toLocaleString("en-US")

export function ByteLadder() {
  const [font, setFont] = useState<FontId>("Inter")
  const [open, setOpen] = useState<string>("axis")
  const base = STEPS[0].bytes[font]
  const hi = (e: number) => (e / base) * 100

  return (
    <div className="not-prose my-8 rounded-lg border bg-card text-card-foreground">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
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
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {FONTS.find((f) => f.id === font)?.axes}
        </span>
      </div>

      <ol className="divide-y">
        {STEPS.map((s, i) => {
          const b = s.bytes[font]
          const isOpen = open === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? "" : s.id)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[1.4rem_1fr] items-center gap-x-2 gap-y-1 px-4 py-2.5 text-left hover:bg-muted/50"
              >
                <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{s.label}</span>
                  <span className="font-mono text-xs tabular-nums">
                    {fmt(b)} B <span className="text-muted-foreground">({hi(b).toFixed(b / base < 0.1 ? 1 : 0)}%)</span>
                  </span>
                </span>
                <span />
                {s.id === "split" ? (
                  <span className="flex h-2.5 overflow-hidden rounded bg-muted" role="img" aria-label={`Core ${fmt(CORE[font])} bytes plus extended ${fmt(EXT[font])} bytes.`}>
                    <span className="h-full" style={{ width: `${hi(CORE[font])}%`, background: "oklch(0.62 0.15 150)" }} />
                    <span className="h-full" style={{ width: `${hi(EXT[font])}%`, background: "oklch(0.62 0.15 285)" }} />
                  </span>
                ) : (
                  <span className="h-2.5 overflow-hidden rounded bg-muted" role="img" aria-label={`${fmt(b)} bytes, ${hi(b).toFixed(1)} percent of the TTF.`}>
                    <span className="block h-full" style={{ width: `${hi(b)}%`, background: "oklch(0.60 0.17 30)" }} />
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="space-y-1 bg-muted/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  <p>{s.note}</p>
                  <p>
                    <span className="font-mono text-foreground">pixels:</span> {s.pixels}
                  </p>
                  {s.id === "split" && (
                    <p className="font-mono">
                      core {fmt(CORE[font])} B (preloaded) + extended {fmt(EXT[font])} B (only if a page needs it). Splitting costs{" "}
                      {fmt(CORE[font] + EXT[font] - STEPS[4].bytes[font])} B more than one file, if a page ever needs both.
                    </p>
                  )}
                  {s.id === "axis" && (
                    <p className="font-mono">
                      For comparison, pinning wght to 400 (opsz left variable) would be {fmt(PIN400[font])} B, and would turn every bold into a
                      synthesised one.
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="border-t px-4 py-2 font-mono text-[10px] text-muted-foreground">
        measured. WOFF2 sizes, fontTools 4.68.0 + brotli. Percent is of the TTF as shipped. Click a rung.
      </p>
    </div>
  )
}
