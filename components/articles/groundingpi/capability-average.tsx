"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The headline "73.68 vs 71.54" is a mean of 11 capability scores, each itself
// an unweighted mean of benchmark columns. Every value below was recomputed from
// the paper's per-benchmark tables (Tables 1-4, 25-29, 36-39) and matches the
// paper's Figure 4 within 0.01 (rounding of the table entries); the two
// averages reproduce at two decimals.

type Cap = { name: string; from: string; gpi: number; astra: number }

const CAPS: Cap[] = [
  { name: "Grounding", from: "COCO, LVIS", gpi: 59.5, astra: 58.86 },
  { name: "Dense", from: "Dense200, VisDrone", gpi: 57.48, astra: 51.08 },
  { name: "Referring", from: "HumanRef, RefCOCO family", gpi: 84.89, astra: 78.31 },
  { name: "Visual prompt", from: "FSC147, Dense200, COCO, LVIS", gpi: 73.59, astra: 65.84 },
  { name: "Grounding point", from: "COCO, LVIS", gpi: 82.15, astra: 79.66 },
  { name: "Dense point", from: "Dense200, VisDrone", gpi: 74.37, astra: 76.09 },
  { name: "Referring point", from: "HumanRef, RefCOCOg", gpi: 89.7, astra: 85.51 },
  { name: "Robo point", from: "RoboSpatial, RefSpatial", gpi: 75.12, astra: 81.08 },
  { name: "GUI", from: "ScreenSpot-Pro, -V2, OSWorld-G", gpi: 78.92, astra: 92.58 },
  { name: "OCR", from: "HierText, ICDAR2015, TotalText, SROIE", gpi: 54.79, astra: 48.89 },
  { name: "Layout", from: "DocLayNet, M6Doc", gpi: 79.95, astra: 69.06 },
]

const GPI = "oklch(0.55 0.17 300)"
const ASTRA = "oklch(0.62 0.03 250)"

export function CapabilityAverage() {
  const [off, setOff] = useState<string[]>([])
  const on = CAPS.filter((c) => !off.includes(c.name))
  const mean = (k: "gpi" | "astra") => (on.length ? on.reduce((a, c) => a + c[k], 0) / on.length : 0)
  const g = mean("gpi")
  const a = mean("astra")
  const wins = on.filter((c) => c.gpi > c.astra).length

  const toggle = (n: string) => setOff((o) => (o.includes(n) ? o.filter((x) => x !== n) : [...o, n]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">11 capability scores · GroundingPI vs GPT-6 Astra</span>
        <span className="flex gap-3 font-mono text-[10px]">
          <span style={{ color: GPI }}>■ GroundingPI</span>
          <span style={{ color: ASTRA }}>■ GPT-6 Astra</span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {CAPS.map((c) => {
            const isOff = off.includes(c.name)
            const d = c.gpi - c.astra
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggle(c.name)}
                aria-pressed={!isOff}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left transition-opacity hover:bg-muted/30",
                  isOff && "opacity-30",
                )}
              >
                <span className="w-28 shrink-0 text-right">
                  <span className="block truncate font-mono text-[10px] text-foreground">{c.name}</span>
                  <span className="hidden truncate font-mono text-[8px] text-muted-foreground sm:block">{c.from}</span>
                </span>
                <span className="flex-1 space-y-0.5">
                  <span className="block h-2.5 rounded-sm bg-muted/40">
                    <span className="block h-2.5 rounded-sm" style={{ width: `${c.gpi}%`, background: GPI }} />
                  </span>
                  <span className="block h-2.5 rounded-sm bg-muted/40">
                    <span className="block h-2.5 rounded-sm" style={{ width: `${c.astra}%`, background: ASTRA }} />
                  </span>
                </span>
                <span
                  className={cn(
                    "w-12 shrink-0 text-right font-mono text-[10px] tabular-nums",
                    d >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400",
                  )}
                >
                  {d >= 0 ? "+" : ""}
                  {d.toFixed(2)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">GroundingPI mean</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: GPI }}>
              {g.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">GPT-6 Astra mean</div>
            <div className="font-mono text-lg tabular-nums text-foreground">{a.toFixed(2)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">capabilities won</div>
            <div className="font-mono text-lg tabular-nums text-foreground">
              {wins} / {on.length}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Click a row to drop it from both averages. With all eleven in, the paper&apos;s 73.68 and 71.54 come back
          exactly. The three red rows are where Astra is ahead, and GUI is the big one: a 13.67-point gap that the
          average absorbs because it is one row in eleven. Each row also hides its own composition; Referring averages
          seven columns, one of which is already an average of three others.
        </p>
      </div>
    </figure>
  )
}
