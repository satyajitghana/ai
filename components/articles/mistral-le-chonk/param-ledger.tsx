"use client"

import { useState } from "react"

import { GROUPS, TOTAL_PARAMS } from "./data"

// Where the parameters sit, and which of them a single text token touches.
// Counts come from the safetensors headers; "per token" applies 4 of 128 to the
// routed experts, zero to the embedding lookup, the vision encoder and the
// draft head, and everything else in full.

const ACCENT = "oklch(0.62 0.16 35)"
const MUTED = "oklch(0.60 0.15 255)"

const b = (n: number) => (n >= 1e11 ? `${(n / 1e9).toFixed(0)}B` : n >= 1e10 ? `${(n / 1e9).toFixed(1)}B` : `${(n / 1e9).toFixed(2)}B`)

export function ParamLedger() {
  const [mode, setMode] = useState<"stored" | "token">("stored")
  const rows = GROUPS.map((g) => ({ ...g, v: mode === "stored" ? g.params : g.params * g.active }))
  const total = rows.reduce((s, r) => s + r.v, 0)
  const max = Math.max(...rows.map((r) => r.v))
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">parameter ledger · from 54 safetensors headers · measured</span>
        <div className="flex gap-1 font-mono text-xs" role="group" aria-label="Count mode">
          {(
            [
              ["stored", "stored"],
              ["token", "touched by one text token"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={`rounded-md border px-2 py-1 ${mode === id ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                <span>{r.label}</span>
                <span className="tabular-nums">{b(r.v)}</span>
              </div>
              <div className="mt-1 h-2.5 rounded-sm bg-muted/40">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${Math.max(0.6, (r.v / max) * 100)}%`, background: r.id === "routed" ? ACCENT : MUTED }}
                />
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{r.note}</div>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg border px-3 py-2 font-mono text-xs">
          {mode === "stored" ? (
            <>
              total {(TOTAL_PARAMS / 1e12).toFixed(3)}T stored; routed experts are {((rows[0].v / total) * 100).toFixed(1)}% of it
            </>
          ) : (
            <>
              {(total / 1e9).toFixed(2)}B parameters touched per text token, of which the output head is {(1.258291200 / (total / 1e9) * 100).toFixed(1)}%; the 52.3B headline adds the embedding table
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
