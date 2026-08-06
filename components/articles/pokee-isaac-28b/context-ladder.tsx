"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// The context-length "ladder": four real, named numbers, each measuring a
// DIFFERENT thing (a benchmark-verified retrieval length, a training-context
// endpoint, an architectural max). That mismatch is the point — the widget
// makes "10x context, 1% of the params" visible while forcing the caveat that
// the two axes were not measured the same way. Context uses a log scale (the
// range spans ~78x); parameters use a LINEAR scale against Kimi K3's total, so
// the ~1% claim reads as what it is — a sliver, not a log-compressed wedge.

const ACCENT = "oklch(0.72 0.15 195)" // Pokee-Isaac row
const MUTED = "oklch(0.62 0.02 260)"

type Row = {
  label: string
  model: string
  context: number
  contextFmt: string
  params: number
  paramsFmt: string
  note: string
}

const ROWS: Row[] = [
  {
    label: "128K",
    model: "Kimi K2 — training context",
    context: 128_000,
    contextFmt: "128K",
    params: 1.04e12,
    paramsFmt: "1.04T total",
    note: "128K is K2's training-context endpoint, from Moonshot's K2 tech report — not a benchmark score. Barely two Kimi generations ago, this was frontier.",
  },
  {
    label: "256K",
    model: "Qwen 3.5 122B — max served context",
    context: 256_000,
    contextFmt: "256K",
    params: 122e9,
    paramsFmt: "122B",
    note: "256K is Qwen 3.5 122B's architectural context ceiling, per Pokee's own pricing table (Table 9) — a hard limit, not a measured result.",
  },
  {
    label: "1M",
    model: "Kimi K3 — training context",
    context: 1_000_000,
    contextFmt: "1M",
    params: 2.78e12,
    paramsFmt: "2.78T total",
    note: "1M is what K3 was trained up to (Moonshot's tech report), not a length Pokee benchmarked it at. See the K3 piece for the KDA mechanism behind it.",
  },
  {
    label: "10M",
    model: "Pokee-Isaac 28B — RULER-measured",
    context: 10_000_000,
    contextFmt: "10M",
    params: 28e9,
    paramsFmt: "28B dense",
    note: "10M is a RULER retrieval score of 93.3% Pokee reports measuring directly — an evaluated capability at that length, not a spec-sheet maximum.",
  },
]

const CTX_LOG_MIN = 5.0 // 100K
const CTX_LOG_MAX = 7.0 // 10M
const ctxPct = (v: number) => ((Math.log10(v) - CTX_LOG_MIN) / (CTX_LOG_MAX - CTX_LOG_MIN)) * 100

const PARAM_MAX = 2.78e12 // Kimi K3, linear reference
const paramPct = (v: number) => (v / PARAM_MAX) * 100

export function ContextLadder() {
  const [active, setActive] = useState(3)
  const row = ROWS[active]
  const k3 = ROWS[2]
  const isaac = ROWS[3]
  const ctxRatio = (isaac.context / k3.context).toFixed(0)
  const paramPctOfK3 = ((isaac.params / k3.params) * 100).toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>context length vs. parameters · four claims, four measurements</span>
        <span className="text-muted-foreground/50">click a row</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 grid grid-cols-[minmax(0,6.5rem)_1fr] gap-3 font-mono text-[10px] text-muted-foreground sm:grid-cols-[minmax(0,9.5rem)_1fr]">
          <span />
          <div className="grid grid-cols-2 gap-2">
            <span>context (log scale)</span>
            <span>parameters (linear, vs. K3)</span>
          </div>
        </div>

        <div className="space-y-2">
          {ROWS.map((r, i) => {
            const on = i === active
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,6.5rem)_1fr] items-center gap-3 rounded-md px-1 py-1 text-left transition-colors sm:grid-cols-[minmax(0,9.5rem)_1fr]",
                  on ? "bg-muted/40" : "hover:bg-muted/20"
                )}
              >
                <span
                  className={cn(
                    "truncate font-mono text-[11px]",
                    on ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.contextFmt}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="relative h-2.5 flex-1 rounded-sm bg-muted/30">
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{
                          width: `${ctxPct(r.context).toFixed(2)}%`,
                          background: on ? ACCENT : MUTED,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-2.5 flex-1 rounded-sm bg-muted/30">
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{
                          width: `${Math.max(paramPct(r.params), 0.6).toFixed(2)}%`,
                          background: on ? ACCENT : MUTED,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-16 shrink-0 font-mono text-[10px] tabular-nums",
                        on ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {r.paramsFmt}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-md border bg-muted/15 px-3 py-2">
          <div className="font-mono text-[11px] font-medium text-foreground">{row.model}</div>
          <div className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{row.note}</div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Read the last two rows together: Pokee-Isaac claims <span style={{ color: ACCENT }}>{ctxRatio}×</span>{" "}
          the context of Kimi K3 at <span style={{ color: ACCENT }}>{paramPctOfK3}%</span>{" "}of its parameters. That
          comparison is real arithmetic, but the two 10M and 1M numbers were not produced the same way — one is a
          benchmark result, the other a training-context spec — which the panel above exists to keep visible rather
          than flatten into one axis.
        </p>
      </div>
    </figure>
  )
}
