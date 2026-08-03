"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Scale comparison across disclosed open-weight MoEs. Restricted to models
// with a verified total/active parameter count from a primary source
// (config.json or tech report) — not every model A.X K2 benchmarks against
// publishes a comparable breakdown, which is itself part of the honesty
// story (see the caption). A.X K2 highlighted; Kimi K3 tagged as the site's
// other 2026 MoE deep-dive for direct comparison.

const ACCENT = "oklch(0.62 0.16 150)" // A.X K2
const CROSS = "oklch(0.58 0.15 265)" // Kimi K3 (cross-link)
const MUTED = "oklch(0.62 0.03 250)"

type Row = { label: string; total: number; active: number; note: string; tag?: "self" | "cross" }

const ROWS: Row[] = [
  { label: "Qwen3.5", total: 397e9, active: 17e9, note: "397B-A17B" },
  { label: "A.X K1", total: 519e9, active: 33e9, note: "519B-A33B, predecessor" },
  { label: "A.X K2", total: 688e9, active: 33e9, note: "688B-A33B", tag: "self" },
  { label: "Kimi K2", total: 1.04e12, active: 32.6e9, note: "1.04T-A32.6B" },
  { label: "Kimi K3", total: 2.78e12, active: 104.2e9, note: "2.78T-A104.2B", tag: "cross" },
]

const T = (n: number) => (n >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : `${(n / 1e9).toFixed(1)}B`)

type View = "total" | "active" | "ratio"

export function MoEScale() {
  const [view, setView] = useState<View>("total")

  const value = (r: Row) => (view === "total" ? r.total : view === "active" ? r.active : r.total / r.active)
  const max = Math.max(...ROWS.map(value))
  const fmt = (r: Row) => (view === "ratio" ? `${value(r).toFixed(1)}×` : T(value(r)))

  const barColor = (r: Row) => (r.tag === "self" ? ACCENT : r.tag === "cross" ? CROSS : MUTED)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">disclosed open-weight moe scale · 2026</span>
        <div className="flex gap-1">
          {(
            [
              { id: "total", label: "total params" },
              { id: "active", label: "active params" },
              { id: "ratio", label: "sparsity (total÷active)" },
            ] as { id: View; label: string }[]
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setView(o.id)}
              aria-pressed={view === o.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === o.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {ROWS.map((r) => {
            const w = Math.max((value(r) / max) * 100, 1.5)
            return (
              <div key={r.label} className="grid grid-cols-[minmax(0,5.5rem)_1fr_auto] items-center gap-3">
                <div className="flex items-center gap-1.5 truncate font-mono text-[11px]">
                  <span
                    className={cn("truncate", r.tag ? "font-semibold text-foreground" : "text-muted-foreground")}
                  >
                    {r.label}
                  </span>
                </div>
                <div className="h-5 rounded-sm bg-muted/30">
                  <div
                    className="h-5 rounded-sm transition-all duration-300"
                    style={{ width: `${w}%`, background: barColor(r) }}
                  />
                </div>
                <div className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
                  {fmt(r)}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} /> A.X K2 (this piece)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CROSS }} /> Kimi K3 (cross-link)
          </span>
          {ROWS.map((r) => (
            <span key={r.label} className="text-muted-foreground/70">
              {r.label}: {r.note}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Total parameters range 7× across this set (397B to 2.78T), but the <span className="text-foreground">sparsity
          ratio</span>{" "}— total divided by active — clusters much tighter: 15.7× (A.X K1) to 31.9× (Kimi K2), with A.X K2
          at <span style={{ color: ACCENT }} className="font-medium">20.9×</span>{" "}and Kimi K3 at{" "}
          <span style={{ color: CROSS }} className="font-medium">26.7×</span>. K2 grew total capacity 519B → 688B by
          adding routed experts (192 → 256) while holding active compute flat at 33B — a pure capacity bet, not a
          bigger per-token forward pass. K3 spends its extra headroom differently, tripling active parameters (32.6B →
          104.2B) alongside the total. This table is shorter than A.X K2&rsquo;s own benchmark comparison: DeepSeek-V4
          Flash, GLM-5.1, Kimi-K2.6 and MiniMax M2.7 all appear in that table but none publish a total/active
          breakdown as precise as the four models here — which is itself part of the disclosure gap this piece keeps
          pointing at.
        </p>
      </div>
    </figure>
  )
}
