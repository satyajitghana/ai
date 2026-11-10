"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { GATE, GATE_METHODS, type GateMethod } from "./gate-data"

// Per token, how much each trained edit adds to the model: the sum over edited modules of |dW x|, with x the
// unedited model's input to that module (measured on SmolLM2-135M-Instruct, seed 0). A neuron edit can only write
// where its neurons fire; a LoRA's input direction is never exactly zero. Shading is shared across the three edits.

const TEXT_LABEL: Record<string, string> = {
  target: "held-out question about the fact",
  near: "another garden's oldest tree",
  chat: "unrelated chat",
  code: "Python",
  german: "German",
}

export function WhereItWrites() {
  const [m, setM] = useState<GateMethod>("neurons8")
  const [shared, setShared] = useState(true)
  const gmax = Math.max(...GATE_METHODS.flatMap((k) => GATE[k.id].rows.flatMap((r) => r.w)))
  const own = Math.max(...GATE[m].rows.flatMap((r) => r.w))
  const max = shared ? gmax : own
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured · where the edit writes, token by token</span>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Edit">
          {GATE_METHODS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={k.id === m}
              onClick={() => setM(k.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                k.id === m ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        {GATE[m].rows.map((r) => {
          const rest = r.w.slice(1)
          const mean = rest.reduce((s, v) => s + v, 0) / rest.length
          return (
            <div key={r.text}>
              <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{TEXT_LABEL[r.text] ?? r.text}</span>
                <span>mean write {mean.toFixed(1)} (first token left out)</span>
              </div>
              <p className="flex flex-wrap font-mono text-[11px] leading-6">
                {r.toks.map((t, i) => {
                  const a = Math.sqrt(Math.min(1, r.w[i] / max))
                  return (
                    <span
                      key={i}
                      title={`${JSON.stringify(t)} · ${r.w[i]}`}
                      className="rounded-sm px-[1px] whitespace-pre"
                      style={{ background: `color-mix(in oklch, oklch(0.66 0.17 45) ${Math.round(a * 85)}%, transparent)` }}
                    >
                      {t.replace(/\n/g, "↵")}
                    </span>
                  )
                })}
              </p>
            </div>
          )
        })}
        <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          one colour scale for all three edits (untick to scale this edit to its own maximum)
        </label>
        <p className="font-mono text-[11px] text-muted-foreground">{GATE_METHODS.find((k) => k.id === m)?.note}</p>
      </div>
    </figure>
  )
}
