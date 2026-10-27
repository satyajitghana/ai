"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { PARAMS, fmt } from "./data"

// Every count is the product of the shapes in the safetensors headers of model-0000{1,2}-of-00002.safetensors.
const TOTAL = PARAMS.reduce((a, p) => a + p.n, 0)
const ACTIVE = PARAMS.reduce((a, p) => a + p.active, 0)

export function ParamLedger() {
  const [view, setView] = useState<"stored" | "active">("stored")
  const rows = [...PARAMS]
    .map((p) => ({ ...p, v: view === "stored" ? p.n : p.active }))
    .filter((p) => p.v > 0)
    .sort((a, b) => b.v - a.v)
  const top = rows[0].v
  const sum = view === "stored" ? TOTAL : ACTIVE
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        where the parameters are · measured from the safetensors headers (no weights downloaded)
      </div>
      <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
        {(["stored", "active"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              view === v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v === "stored" ? "stored on disk" : "touched per decoded token"}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] tabular-nums">{fmt(Math.round(sum))}</span>
      </div>
      <div className="space-y-1.5 px-4 py-3">
        {rows.map((p) => (
          <div key={p.id} className="grid grid-cols-[9.5rem_1fr_4.5rem] items-center gap-2 font-mono text-[11px]" title={p.note}>
            <span className="truncate">{p.label}</span>
            <div className="h-2.5 overflow-hidden rounded bg-muted">
              <div className="h-full" style={{ width: `${((p.v / top) * 100).toFixed(1)}%`, background: "oklch(0.6 0.15 175)" }} />
            </div>
            <span className="text-right tabular-nums">{((p.v / sum) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        {view === "stored"
          ? "Of 3,343,978,497 stored values, 257 are an int64 position-id buffer; the rest are bf16."
          : "Active count: 6 of 64 routed experts, everything else in the text decoder, no embedding lookup, no image encoder."}
      </p>
    </figure>
  )
}
