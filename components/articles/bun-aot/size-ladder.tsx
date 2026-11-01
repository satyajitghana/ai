"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { MODES, PROGRAMS, mb } from "./data"

// Output size of the same program under four flag sets. All bars share one
// scale (the largest file in the table) so a bar's length is comparable
// across programs, not just within one.

const MAX = 140569256
const COLORS = {
  jit: "oklch(0.62 0.02 260)",
  trim: "oklch(0.70 0.13 85)",
  aot: "oklch(0.68 0.14 235)",
  aottrim: "oklch(0.64 0.15 150)",
} as const

export function SizeLadder() {
  const [pid, setPid] = useState("serve")
  const p = PROGRAMS.find((x) => x.id === pid) ?? PROGRAMS[0]
  const base = p.bytes.jit
  return (
    <figure className="not-prose my-6 rounded-lg border p-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Program">
        {PROGRAMS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === pid}
            onClick={() => setPid(x.id)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              x.id === pid ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">{p.what}</p>
      <ul className="mt-3 space-y-2">
        {MODES.map((m) => {
          const b = p.bytes[m.id]
          const pct = (b / MAX) * 100
          return (
            <li key={m.id}>
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span>
                  {m.label} <span className="text-muted-foreground">{m.flags}</span>
                </span>
                <span>
                  <span className="text-foreground">{mb(b)} MB</span>
                  <span className="ml-2 text-muted-foreground">{Math.round((b / base) * 100)}% of plain</span>
                </span>
              </div>
              <div className="mt-1 h-3 w-full rounded-sm bg-muted/50">
                <div className="h-3 rounded-sm" style={{ width: pct + "%", background: COLORS[m.id] }} />
              </div>
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Measured: Linux x64, Bun 1.4.4 canary (da867c60b). Trim alone is the same 84.5 MB for every program; trim after AOT follows what the program uses.
      </figcaption>
    </figure>
  )
}
