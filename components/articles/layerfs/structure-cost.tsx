"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { LAST, REPORTED } from "./data"

// Where the bytes go. The two toy rows are measured (157 snapshots of this site's history, zlib 6). The LayerFS row is the five
// components its September research report says add up exactly to its 184,598,528-byte store, for a different workload.
type Part = { name: string; b: number; color: string }
type Bar = { id: string; title: string; src: string; parts: Part[] }

const PAY = "oklch(0.62 0.12 200)"
const STR = "oklch(0.60 0.17 30)"
const OTH = "oklch(0.62 0.04 260)"

const BARS: Bar[] = [
  {
    id: "flat",
    title: "toy, flat directories",
    src: "measured, 157 snapshots of this site",
    parts: [
      { name: "chunk payload", b: LAST.payload, color: PAY },
      { name: "directory objects", b: LAST.dirFlat, color: STR },
    ],
  },
  {
    id: "paged",
    title: "toy, paged directories",
    src: "measured, same chunks, directories in pages",
    parts: [
      { name: "chunk payload", b: LAST.payload, color: PAY },
      { name: "directory pages", b: LAST.dirPaged, color: STR },
    ],
  },
  {
    id: "layerfs",
    title: "LayerFS research candidate",
    src: "reported, 157 snapshots of DeepSeek Harness",
    parts: [
      { name: "payload groups", b: REPORTED.parts[0].b, color: PAY },
      { name: "structure groups", b: REPORTED.parts[1].b, color: STR },
      { name: "headers, database, unattributed", b: REPORTED.parts[2].b + REPORTED.parts[3].b + REPORTED.parts[4].b, color: OTH },
    ],
  },
]

export function StructureCost() {
  const [scale, setScale] = useState<"shared" | "own">("own")
  const max = Math.max(...BARS.map((b) => b.parts.reduce((s, p) => s + p.b, 0)))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        where the bytes go · payload against structure
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">bar length</span>
        {(
          [
            ["own", "fill the row (shares)"],
            ["shared", "one scale (sizes)"],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            onClick={() => setScale(k)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              scale === k ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-4 px-4 py-4">
        {BARS.map((bar) => {
          const total = bar.parts.reduce((s, p) => s + p.b, 0)
          const denom = scale === "own" ? total : max
          return (
            <div key={bar.id}>
              <div className="flex items-baseline justify-between font-mono text-[11px]">
                <span>{bar.title}</span>
                <span className="tabular-nums">{(total / 1e6).toFixed(1)} MB</span>
              </div>
              <div
                className="mt-0.5 flex h-4 overflow-hidden rounded bg-muted"
                role="img"
                aria-label={`${bar.title}: ${bar.parts.map((p) => `${p.name} ${(p.b / 1e6).toFixed(1)} MB`).join(", ")}`}
              >
                {bar.parts.map((p) => (
                  <div key={p.name} className="h-full" style={{ width: `${((p.b / denom) * 100).toFixed(2)}%`, background: p.color }} />
                ))}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-4 font-mono text-[10px] text-muted-foreground">
                {bar.parts.map((p) => (
                  <span key={p.name} className="tabular-nums">
                    <span className="mr-1 inline-block h-2 w-2 rounded-sm align-baseline" style={{ background: p.color }} />
                    {p.name} {(p.b / 1e6).toFixed(1)} MB ({((p.b / total) * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">{bar.src}</div>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
