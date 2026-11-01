"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { FULL_ATTENTION_LAYERS, GROUPS, TOTAL_PARAMS } from "./data"

// config.json's layer_types: 64 layers, every fourth one full attention (and
// non-causal under Drex's loader), the rest Gated DeltaNet. Sizes are summed from
// the safetensors headers (measured).

const TONE: Record<string, string> = {
  mlp: "bg-sky-600",
  linear: "bg-emerald-600",
  full: "bg-amber-500",
  embed: "bg-violet-500",
  vision: "bg-rose-400",
  readout: "bg-foreground",
  norm: "bg-muted-foreground",
}

const fmt = (n: number) => n.toLocaleString("en-US")

export function ParamStack() {
  const [sel, setSel] = useState("mlp")
  const g = GROUPS.find((x) => x.id === sel) ?? GROUPS[0]
  const fullSet = new Set(FULL_ATTENTION_LAYERS)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="grid gap-4 p-3 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">64 layers, in order (row of 8)</div>
          <div className="grid w-fit gap-[3px]" style={{ gridTemplateColumns: "repeat(8, 20px)" }}>
            {Array.from({ length: 64 }, (_, i) => {
              const full = fullSet.has(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`layer ${i}: ${full ? "full attention, non-causal" : "Gated DeltaNet, causal"}`}
                  title={`layer ${i}: ${full ? "full attention (non-causal)" : "Gated DeltaNet (causal)"}`}
                  onClick={() => setSel(full ? "full" : "linear")}
                  className={cn("h-5 w-5 rounded-[3px]", full ? "bg-amber-500" : "bg-emerald-600")}
                />
              )
            })}
          </div>
          <div className="mt-2 flex gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-emerald-600" /> 48 DeltaNet
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> 16 full attention
            </span>
          </div>
        </div>
        <div className="grid content-start gap-1.5">
          {GROUPS.map((x) => {
            const pct = (100 * x.params) / TOTAL_PARAMS
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setSel(x.id)}
                className={cn("grid gap-0.5 rounded border px-2 py-1 text-left", sel === x.id ? "border-foreground" : "border-transparent")}
              >
                <span className="flex justify-between font-mono text-[11px]">
                  <span>{x.label}</span>
                  <span>
                    {fmt(x.params)} ({pct.toFixed(pct < 0.1 ? 3 : 2)}%)
                  </span>
                </span>
                <span className="h-2 rounded bg-muted">
                  <span className={cn("block h-2 rounded", TONE[x.tone])} style={{ width: `${Math.max(0.4, pct).toFixed(2)}%` }} />
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        <b>{g.label}.</b> {g.note}. Total {fmt(TOTAL_PARAMS)} parameters with the readout (measured).
      </figcaption>
    </figure>
  )
}
