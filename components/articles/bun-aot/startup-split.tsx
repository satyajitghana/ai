"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where a launch spends its wall time. The totals are measured (median of 40
// launches, spawn included). The split is reasoned by subtraction: the hello
// binary is the boot floor, the Bun.serve one adds the server and one request,
// and whatever is left of the app's time is loading and compiling its code.

type Row = { id: string; label: string; boot: number; runtime: number; code: number }

const ROWS: Row[] = [
  { id: "jit", label: "plain", boot: 5.3, runtime: 3.0, code: 28.1 },
  { id: "aot", label: "aot", boot: 5.2, runtime: 3.0, code: 6.2 },
]

const TOTAL: Record<string, number> = { jit: 36.4, aot: 14.4 }
const PARTS = [
  { key: "boot", label: "runtime boot (hello binary)", color: "oklch(0.62 0.02 260)" },
  { key: "runtime", label: "server + one request (serve minus hello)", color: "oklch(0.70 0.13 85)" },
  { key: "code", label: "load and compile app code (remainder)", color: "oklch(0.68 0.14 235)" },
] as const

export function StartupSplit() {
  const [only, setOnly] = useState<string | null>(null)
  const scale = 40
  return (
    <figure className="not-prose my-6 rounded-lg border p-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Highlight">
        {PARTS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={only === p.key}
            onClick={() => setOnly(only === p.key ? null : p.key)}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
              only === p.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {ROWS.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span>{r.label}</span>
              <span>{TOTAL[r.id].toFixed(1)} ms measured</span>
            </div>
            <div className="mt-1 flex h-4 w-full overflow-hidden rounded-sm bg-muted/40">
              {PARTS.map((p) => (
                <div
                  key={p.key}
                  style={{
                    width: (r[p.key] / scale) * 100 + "%",
                    background: p.color,
                    opacity: only === null || only === p.key ? 1 : 0.2,
                  }}
                  title={p.label + ": " + r[p.key].toFixed(1) + " ms"}
                />
              ))}
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
              {r.boot.toFixed(1)} + {r.runtime.toFixed(1)} + {r.code.toFixed(1)} ms
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Totals measured (Hono + zod + sqlite app, median of 40). The three-way split is reasoned from the hello and Bun.serve binaries, not profiled.
      </figcaption>
    </figure>
  )
}
