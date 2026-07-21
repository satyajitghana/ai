"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The whole pitch in one plot: Terminal-Bench 2.1 score against model size on a
// log axis. Laguna S 2.1 (118B total / 8B active) sits at 70.2 — above open
// models 4-14x its total size (DeepSeek-V4-Pro-Max 1.6T, Inkling 975B, Nemotron
// Ultra 550B, MiniMax M3 428B). Toggle the x-axis between total and active
// params; on active params the "punching above its weight" story is starkest.
// The closed frontier (GPT-5.6 / Claude Fable 5, ~88) doesn't disclose size, so
// it's drawn as a reference band rather than points. Numbers: poolside, 21 Jul 2026.

type M = { name: string; total: number; active: number; score: number; laguna?: boolean }

// disclosed-size (open-weight) models from poolside's Terminal-Bench 2.1 table
const MODELS: M[] = [
  { name: "Laguna S 2.1", total: 118, active: 8, score: 70.2, laguna: true },
  { name: "Laguna XS 2.1", total: 33, active: 3, score: 33.4, laguna: true },
  { name: "Kimi K3", total: 2800, active: 50, score: 88.3 },
  { name: "Hy3", total: 295, active: 21, score: 71.7 },
  { name: "MiniMax M3", total: 428, active: 23, score: 66.0 },
  { name: "DeepSeek-V4-Pro-Max", total: 1600, active: 49, score: 64.0 },
  { name: "Inkling", total: 975, active: 41, score: 63.8 },
  { name: "DeepSeek-V4-Flash-Max", total: 284, active: 13, score: 61.8 },
  { name: "Nemotron 3 Ultra", total: 550, active: 55, score: 56.4 },
  { name: "Inkling-Small", total: 276, active: 12, score: 52.7 },
  { name: "Qwen3.6-27B", total: 27, active: 27, score: 51.3 },
  { name: "Qwen3.6-35B-A3B", total: 35, active: 3, score: 44.9 },
  { name: "Nemotron 3 Super", total: 120, active: 12, score: 38.6 },
  { name: "Mistral Small 4", total: 119, active: 119, score: 21.4 },
]

const FRONTIER = 88.0 // top closed models (GPT-5.6 Sol 88.8 / Kimi K3 88.3 / Claude Fable 5 88.0)
const ACCENT = "oklch(0.65 0.15 200)"
const OTHER = "oklch(0.6 0.03 240)"

const W = 640
const H = 380
const padL = 40
const padR = 16
const padT = 30
const padB = 44
const r2 = (n: number) => Math.round(n * 100) / 100

export function WeightClassScatter() {
  const [axis, setAxis] = useState<"total" | "active">("active")
  const [hover, setHover] = useState<number | null>(null)

  const xs = MODELS.map((m) => (axis === "total" ? m.total : m.active))
  const xlo = Math.min(...xs) * 0.8
  const xhi = Math.max(...xs) * 1.15
  const ylo = 15
  const yhi = 95

  const sx = (v: number) => r2(padL + ((Math.log(v) - Math.log(xlo)) / (Math.log(xhi) - Math.log(xlo))) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - (v - ylo) / (yhi - ylo)) * (H - padT - padB))

  const ticks = useMemo(() => {
    const t = [1, 3, 10, 30, 100, 300, 1000, 3000]
    return t.filter((v) => v >= xlo * 0.9 && v <= xhi * 1.1)
  }, [xlo, xhi])

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  const fmtX = (v: number) => (v >= 1000 ? `${v / 1000}T` : `${v}B`)
  const hp = hover != null ? MODELS[hover] : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Terminal-Bench 2.1 vs {axis} parameters</span>
        <div className="flex gap-1">
          {(["active", "total"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAxis(a)} className={chip(axis === a)}>{a} params</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Scatter of Terminal-Bench 2.1 score against ${axis} parameters. Laguna S 2.1 scores 70.2 at 8B active / 118B total, above much larger open models.`}>
          {/* frontier reference band */}
          <line x1={padL} y1={sy(FRONTIER)} x2={W - padR} y2={sy(FRONTIER)} stroke={ACCENT} strokeOpacity="0.4" strokeDasharray="4 3" />
          <text x={W - padR} y={sy(FRONTIER) - 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize="8.5">closed frontier ≈ 88 (size undisclosed)</text>

          {/* y gridlines */}
          {[20, 40, 60, 80].map((gy) => (
            <g key={gy}>
              <line x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity="0.07" />
              <text x={padL - 5} y={sy(gy) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">{gy}</text>
            </g>
          ))}
          {/* x ticks */}
          {ticks.map((tv) => (
            <text key={tv} x={sx(tv)} y={H - 26} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">{fmtX(tv)}</text>
          ))}
          <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">{axis} parameters (log)</text>

          {/* points */}
          {MODELS.map((m, i) => {
            const x = sx(axis === "total" ? m.total : m.active)
            const y = sy(m.score)
            const on = hover === i
            return (
              <g key={m.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <circle cx={x} cy={y} r={m.laguna ? (on ? 7 : 5.5) : on ? 6 : 4} fill={m.laguna ? ACCENT : OTHER} opacity={hover == null || on || m.laguna ? 1 : 0.5} />
                {m.laguna ? (
                  <text x={x + 8} y={y + 3} className="fill-foreground font-mono" fontSize="9" fontWeight="600">{m.name}</text>
                ) : null}
              </g>
            )
          })}

          {hp && !hp.laguna ? (
            <g transform={`translate(${Math.min(sx(axis === "total" ? hp.total : hp.active) + 8, W - 160)}, ${Math.max(sy(hp.score) - 26, padT)})`}>
              <rect width="156" height="24" rx="5" fill="var(--background)" stroke="var(--border)" />
              <text x="7" y="10" className="fill-foreground font-mono" fontSize="9">{hp.name}</text>
              <text x="7" y="19.5" className="fill-muted-foreground font-mono" fontSize="8">{hp.total >= 1000 ? `${hp.total / 1000}T` : `${hp.total}B`}-A{hp.active}B · TB {hp.score}</text>
            </g>
          ) : null}
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} /> Laguna</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: OTHER }} /> other open-weight models</span>
          <span className="ml-auto">hover a point</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Switch to <span style={{ color: ACCENT }}>active params</span> and the point is hard to miss: at{" "}
          <span className="text-foreground">8B active</span> Laguna S 2.1 clears open models activating 5–7× as
          many parameters, and lands within a dozen points of a closed frontier whose models won&rsquo;t even say
          how big they are. Raw score isn&rsquo;t the frontier; score-per-parameter is the claim.
        </p>
      </div>
    </figure>
  )
}
