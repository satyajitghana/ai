"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { NEEDLE } from "./data"

// Measured: one synthetic haystack per length, five vault codes planted at
// 10/30/50/70/90 percent, each asked about separately from a copy of the same
// cache. Greedy decoding, no thinking, int8 CPU re-implementation.

const ACCENT = "oklch(0.66 0.17 45)"

export function NeedleGrid() {
  const [sel, setSel] = useState<{ t: number; d: number } | null>(null)
  const depths = NEEDLE[0].results.map((r) => r.depth)
  const cell = sel ? NEEDLE.find((n) => n.target === sel.t)!.results.find((r) => r.depth === sel.d)! : null
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>needle probe · five codes per haystack</span>
        <span className="text-muted-foreground/50">measured</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid gap-1.5 font-mono text-xs" style={{ gridTemplateColumns: `5.5rem repeat(${depths.length}, 1fr)` }}>
          <div />
          {depths.map((d) => (
            <div key={d} className="text-center text-muted-foreground">{Math.round(d * 100)}%</div>
          ))}
          {NEEDLE.map((n) => (
            <div key={n.target} className="contents">
              <div className="flex flex-col justify-center text-muted-foreground">
                <span>{n.tokens.toLocaleString("en-US")}</span>
                <span className="text-[10px]">tokens</span>
              </div>
              {n.results.map((r) => (
                <button
                  key={r.depth}
                  type="button"
                  onClick={() => setSel({ t: n.target, d: r.depth })}
                  aria-label={`${n.tokens} tokens, depth ${Math.round(r.depth * 100)} percent: ${r.ok ? "found" : "missed"}`}
                  className={cn("h-10 rounded-md border text-center", sel?.t === n.target && sel.d === r.depth && "ring-2 ring-offset-1")}
                  style={r.ok ? { background: ACCENT, color: "white", borderColor: "transparent" } : undefined}
                >
                  {r.ok ? "found" : "miss"}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 min-h-[2.5rem] text-xs text-muted-foreground">
          {cell
            ? `Asked for vault ${cell.name} (true code ${cell.code}); the model said "${cell.answer}".`
            : "Select a cell to see the question and the model's answer."}
        </p>
        <p className="text-xs text-muted-foreground">
          Prefill took {NEEDLE.map((n) => `${n.prefillS.toFixed(0)} s for ${n.tokens.toLocaleString("en-US")}`).join(", ")} tokens on 2 CPU threads.
        </p>
      </div>
    </figure>
  )
}
