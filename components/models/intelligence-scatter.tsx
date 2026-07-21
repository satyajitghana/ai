"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { blendedPrice, type ModelRecord, type Origin } from "@/data/models"

// The flagship comparison: Intelligence Index (y) against a chosen x-axis —
// blended price (log), output speed, latency, or context (log). Points are
// colored by origin (the US-vs-China story) and drawn filled for open-weight
// models, ringed for closed. Toggle the x-axis and filter by origin / license;
// hover a point for the model. Null values are skipped, never faked.

const ORIGIN_COLOR: Record<Origin, string> = {
  US: "oklch(0.6 0.16 255)",
  China: "oklch(0.62 0.19 20)",
  EU: "oklch(0.72 0.15 85)",
  Canada: "oklch(0.6 0.13 200)",
  Other: "oklch(0.65 0.02 260)",
}

type Axis = {
  key: string
  label: string
  log: boolean
  get: (m: ModelRecord) => number | null
  fmt: (v: number) => string
}

const AXES: Axis[] = [
  { key: "price", label: "blended price ($/M)", log: true, get: blendedPrice, fmt: (v) => `$${v < 1 ? v.toFixed(2) : v.toFixed(1)}` },
  { key: "speed", label: "output speed (tok/s)", log: false, get: (m) => m.speedTps, fmt: (v) => `${Math.round(v)}` },
  { key: "latency", label: "latency TTFT (s)", log: false, get: (m) => m.latencyS, fmt: (v) => `${v.toFixed(2)}s` },
  { key: "context", label: "context (K tokens)", log: true, get: (m) => m.contextK, fmt: (v) => (v >= 1000 ? `${v / 1000}M` : `${v}K`) },
]

const W = 640
const H = 380
const padL = 46
const padR = 16
const padT = 18
const padB = 42
const r2 = (n: number) => Math.round(n * 100) / 100

export function IntelligenceScatter({ models }: { models: ModelRecord[] }) {
  const [axisKey, setAxisKey] = useState("price")
  const [origin, setOrigin] = useState<"all" | "US" | "China">("all")
  const [license, setLicense] = useState<"all" | "open" | "closed">("all")
  const [hover, setHover] = useState<number | null>(null)

  const axis = AXES.find((a) => a.key === axisKey) ?? AXES[0]

  const pts = useMemo(() => {
    return models
      .map((m, i) => ({ m, i, x: axis.get(m), y: m.intelligence }))
      .filter((p) => p.x != null && p.x > 0 && p.y != null)
      .filter((p) => origin === "all" || p.m.origin === origin)
      .filter((p) => license === "all" || (license === "open") === p.m.openWeights) as {
      m: ModelRecord
      i: number
      x: number
      y: number
    }[]
  }, [models, axis, origin, license])

  const tx = (v: number, lo: number, hi: number) =>
    axis.log
      ? (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo) || 1)
      : (v - lo) / (hi - lo || 1)

  const bounds = useMemo(() => {
    if (!pts.length) return null
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const xlo = axis.log ? Math.min(...xs) * 0.8 : 0
    const xhi = Math.max(...xs) * 1.08
    const ylo = Math.max(0, Math.min(...ys) - 6)
    const yhi = Math.max(...ys) + 4
    return { xlo, xhi, ylo, yhi }
  }, [pts, axis])

  const sx = (x: number) => (bounds ? r2(padL + tx(x, bounds.xlo, bounds.xhi) * (W - padL - padR)) : 0)
  const sy = (y: number) =>
    bounds ? r2(padT + (1 - (y - bounds.ylo) / (bounds.yhi - bounds.ylo || 1)) * (H - padT - padB)) : 0

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  const hp = hover != null ? pts.find((p) => p.i === hover) : null

  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          intelligence vs {axis.label}
        </span>
        <div className="flex flex-wrap gap-1">
          {AXES.map((a) => (
            <button key={a.key} type="button" onClick={() => setAxisKey(a.key)} className={chip(a.key === axisKey)}>
              {a.key}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* filters */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">origin</span>
          {(["all", "US", "China"] as const).map((o) => (
            <button key={o} type="button" onClick={() => setOrigin(o)} className={chip(origin === o)}>{o}</button>
          ))}
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">license</span>
          {(["all", "open", "closed"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLicense(l)} className={chip(license === l)}>{l}</button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
            {pts.length} models
          </span>
        </div>

        {bounds ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Scatter plot of Intelligence Index against ${axis.label} for ${pts.length} models.`}>
            {/* y gridlines */}
            {Array.from({ length: 5 }, (_, i) => bounds.ylo + ((bounds.yhi - bounds.ylo) * i) / 4).map((gy, i) => (
              <g key={i}>
                <line x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity="0.07" />
                <text x={padL - 6} y={sy(gy) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">{Math.round(gy)}</text>
              </g>
            ))}
            {/* axis labels */}
            <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">{axis.label}</text>
            <text x={12} y={(H - padB) / 2} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9" transform={`rotate(-90 12 ${(H - padB) / 2})`}>Intelligence Index</text>

            {/* points */}
            {pts.map((p) => {
              const col = ORIGIN_COLOR[p.m.origin]
              const on = hover === p.i
              return (
                <g key={p.i} onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={on ? 6.5 : 4.5} fill={p.m.openWeights ? col : "var(--background)"} stroke={col} strokeWidth={p.m.openWeights ? 0 : 2} opacity={hover == null || on ? 1 : 0.45} />
                </g>
              )
            })}

            {/* hover label */}
            {hp ? (
              <g transform={`translate(${Math.min(sx(hp.x) + 8, W - 150)}, ${Math.max(sy(hp.y) - 30, padT)})`}>
                <rect width="146" height="26" rx="5" fill="var(--background)" stroke="var(--border)" />
                <text x="7" y="11" className="fill-foreground font-mono" fontSize="9.5">{hp.m.name}</text>
                <text x="7" y="21" className="fill-muted-foreground font-mono" fontSize="8.5">{hp.m.provider} · AAI {hp.y} · {axis.fmt(hp.x)}</text>
              </g>
            ) : null}
          </svg>
        ) : (
          <p className="py-12 text-center font-mono text-xs text-muted-foreground">no models have both metrics yet</p>
        )}

        {/* legend */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(ORIGIN_COLOR) as Origin[]).filter((o) => pts.some((p) => p.m.origin === o)).map((o) => (
            <span key={o} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORIGIN_COLOR[o] }} /> {o}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-foreground/70" /> open</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-foreground/70" /> closed</span>
        </div>
      </div>
    </figure>
  )
}
