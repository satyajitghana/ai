"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { THINK_SETS, MODE_NOTE } from "./data"

// Measured: the prompts, three modes, one sampled run each (temperature 1.0,
// top_p 0.95, seeds 0..9) on an int8 CPU re-implementation of the model. Bars
// are new tokens generated; a dot is the verdict. A run that hit the token cap
// before closing its think block is marked as truncated.

const ACCENT = "oklch(0.66 0.17 45)"
const MODES = ["none", "low", "high"] as const

export function ThinkModes({ set = "easy" }: { set?: "easy" | "hard" }) {
  const { prompts: PROMPT_TEXT, modes: THINK } = THINK_SETS[set]
  const n = PROMPT_TEXT.length
  const [sel, setSel] = useState(0)
  const max = Math.max(...THINK.flatMap((m) => m.runs.map((r) => r.tokens)))
  const row = (mode: (typeof MODES)[number]) => THINK.find((m) => m.mode === mode)!
  const pick = MODES.map((m) => row(m).runs[sel])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>thinking modes · {n} prompts x 3 modes</span>
        <span className="text-muted-foreground/50">measured</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          {MODES.map((m) => {
            const d = row(m)
            const ok = d.runs.filter((r) => r.ok).length
            const avg = Math.round(d.runs.reduce((a, r) => a + r.tokens, 0) / d.runs.length)
            return (
              <div key={m} className="rounded-md border p-2">
                <div className="text-muted-foreground">{m}</div>
                <div className="text-base">{ok}/{n} correct</div>
                <div className="text-muted-foreground">{avg} tokens avg</div>
              </div>
            )
          })}
        </div>
        <div className="space-y-1.5" role="group" aria-label="Prompts">
          {Array.from({ length: n }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              className={cn("block w-full rounded-md border px-2 py-1 text-left", sel === i ? "bg-muted/40" : "hover:bg-muted/20")}
            >
              <div className="mb-1 truncate font-mono text-[11px] text-muted-foreground">
                {i + 1}. {PROMPT_TEXT[i]}
              </div>
              {MODES.map((m) => {
                const r = row(m).runs[i]
                return (
                  <div key={m} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-9 text-muted-foreground">{m}</span>
                    <div className="h-2 flex-1 rounded-sm bg-muted/30">
                      <div className="h-2 rounded-sm" style={{ width: `${Math.max(0.8, (r.tokens / max) * 100)}%`, background: r.ok ? ACCENT : "oklch(0.55 0.02 260)" }} />
                    </div>
                    <span className="w-16 text-right">{r.tokens}</span>
                    <span className="w-6">{r.ok ? "ok" : r.trunc ? "cut" : "no"}</span>
                  </div>
                )
              })}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Prompt {sel + 1}: {pick.map((r, i) => `${MODES[i]} ${r.ok ? "right" : r.trunc ? "hit the token cap" : "wrong"} (${r.tokens})`).join(" · ")}. {MODE_NOTE}
        </p>
      </div>
    </figure>
  )
}
