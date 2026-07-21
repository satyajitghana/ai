"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { blendedPrice, type ModelRecord, type Origin } from "@/data/models"

// Ranked bars for a single metric — output speed, blended price (cheapest first),
// context window, or the Intelligence Index. Colored by origin so the US/China
// split reads at a glance; top-N shown, models missing the metric skipped.

const ORIGIN_COLOR: Record<Origin, string> = {
  US: "oklch(0.6 0.16 255)",
  China: "oklch(0.62 0.19 20)",
  EU: "oklch(0.72 0.15 85)",
  Canada: "oklch(0.6 0.13 200)",
  UAE: "oklch(0.6 0.13 160)",
  Korea: "oklch(0.62 0.16 320)",
  Israel: "oklch(0.68 0.13 130)",
  India: "oklch(0.68 0.16 40)",
  Other: "oklch(0.65 0.02 260)",
}

type Metric = {
  key: string
  label: string
  asc: boolean // true = smaller is better (price)
  get: (m: ModelRecord) => number | null
  fmt: (v: number) => string
}

const METRICS: Metric[] = [
  { key: "speed", label: "output speed (tok/s)", asc: false, get: (m) => m.speedTps, fmt: (v) => `${Math.round(v)}` },
  { key: "price", label: "blended price ($/M) — cheapest", asc: true, get: blendedPrice, fmt: (v) => `$${v < 1 ? v.toFixed(2) : v.toFixed(1)}` },
  { key: "intelligence", label: "Intelligence Index", asc: false, get: (m) => m.intelligence, fmt: (v) => `${v}` },
  { key: "context", label: "context (K tokens)", asc: false, get: (m) => m.contextK, fmt: (v) => (v >= 1000 ? `${v / 1000}M` : `${v}K`) },
]

const TOP = 16

export function MetricRanking({ models }: { models: ModelRecord[] }) {
  const [mk, setMk] = useState("speed")
  const metric = METRICS.find((m) => m.key === mk) ?? METRICS[0]

  const rows = useMemo(() => {
    const withV = models
      .map((m) => ({ m, v: metric.get(m) }))
      .filter((r) => r.v != null && (metric.key !== "price" || r.v > 0)) as { m: ModelRecord; v: number }[]
    withV.sort((a, b) => (metric.asc ? a.v - b.v : b.v - a.v))
    return withV.slice(0, TOP)
  }, [models, metric])

  const max = Math.max(...rows.map((r) => r.v), 1e-9)

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">top {TOP} · {metric.label}</span>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button key={m.key} type="button" onClick={() => setMk(m.key)} className={chip(m.key === mk)}>{m.key}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={`${r.m.provider}-${r.m.name}`} className="grid grid-cols-[128px_1fr_54px] items-center gap-2 sm:grid-cols-[168px_1fr_54px]">
              <span className="truncate font-mono text-[11px] text-foreground" title={`${r.m.provider} · ${r.m.name}`}>{r.m.name}</span>
              <span className="h-4 overflow-hidden rounded bg-muted/40">
                <span className="block h-full rounded" style={{ width: `${(r.v / max) * 100}%`, background: ORIGIN_COLOR[r.m.origin] }} />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{metric.fmt(r.v)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(ORIGIN_COLOR) as Origin[]).filter((o) => rows.some((r) => r.m.origin === o)).map((o) => (
            <span key={o} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ORIGIN_COLOR[o] }} /> {o}</span>
          ))}
        </div>
      </div>
    </figure>
  )
}
