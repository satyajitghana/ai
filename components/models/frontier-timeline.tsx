"use client"

import { useMemo } from "react"

import type { ModelRecord } from "@/data/models"

// The scaling01 question in one chart: Intelligence Index against release date,
// with a running-max "frontier" line for the US and for China. The gap between
// the two envelopes — and whether it's closing — is the whole story. Points are
// every dated, scored model; the lines are the best-so-far per origin.

const US = "oklch(0.6 0.16 255)"
const CN = "oklch(0.62 0.19 20)"

const W = 640
const H = 380
const padL = 40
const padR = 16
const padT = 16
const padB = 34
const r2 = (n: number) => Math.round(n * 100) / 100

// "YYYY-MM" -> fractional year
function toYear(s: string | null): number | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})$/.exec(s)
  if (!m) return null
  return Number(m[1]) + (Number(m[2]) - 1) / 12
}

export function FrontierTimeline({ models }: { models: ModelRecord[] }) {
  const pts = useMemo(
    () =>
      models
        .map((m) => ({ m, t: toYear(m.released), y: m.intelligence }))
        .filter((p) => p.t != null && p.y != null) as { m: ModelRecord; t: number; y: number }[],
    [models],
  )

  const bounds = useMemo(() => {
    if (!pts.length) return null
    const ts = pts.map((p) => p.t)
    const ys = pts.map((p) => p.y)
    return { tlo: Math.min(...ts) - 0.05, thi: Math.max(...ts) + 0.05, ylo: 0, yhi: Math.max(...ys) + 4 }
  }, [pts])

  const sx = (t: number) => (bounds ? r2(padL + ((t - bounds.tlo) / (bounds.thi - bounds.tlo || 1)) * (W - padL - padR)) : 0)
  const sy = (y: number) => (bounds ? r2(padT + (1 - (y - bounds.ylo) / (bounds.yhi - bounds.ylo || 1)) * (H - padT - padB)) : 0)

  // running-max upper envelope for one origin
  const envelope = (origin: string): string => {
    const seq = pts.filter((p) => p.m.origin === origin).sort((a, b) => a.t - b.t)
    let best = -Infinity
    const out: string[] = []
    for (const p of seq) {
      if (p.y >= best) {
        out.push(`${sx(p.t)},${sy(best === -Infinity ? p.y : best)}`)
        best = p.y
        out.push(`${sx(p.t)},${sy(best)}`)
      }
    }
    if (out.length && bounds) out.push(`${sx(bounds.thi)},${sy(best)}`)
    return out.join(" ")
  }

  const usEnv = envelope("US")
  const cnEnv = envelope("China")

  const years = bounds ? Array.from({ length: Math.ceil(bounds.thi) - Math.floor(bounds.tlo) + 1 }, (_, i) => Math.floor(bounds.tlo) + i).filter((y) => y >= bounds.tlo && y <= bounds.thi) : []

  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        the frontier over time · US vs China intelligence, best-so-far
      </div>
      <div className="p-3 sm:p-4">
        {bounds ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Intelligence Index of models over release date, with US and China frontier envelopes.">
            {/* y grid */}
            {Array.from({ length: 5 }, (_, i) => (bounds.yhi * i) / 4).map((gy, i) => (
              <g key={i}>
                <line x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity="0.07" />
                <text x={padL - 5} y={sy(gy) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">{Math.round(gy)}</text>
              </g>
            ))}
            {years.map((yr) => (
              <text key={yr} x={sx(yr)} y={H - padB + 14} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">{yr}</text>
            ))}
            <text x={11} y={(H - padB) / 2} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9" transform={`rotate(-90 11 ${(H - padB) / 2})`}>Intelligence Index</text>

            {/* points */}
            {pts.map((p, i) => {
              const isUs = p.m.origin === "US"
              const isCn = p.m.origin === "China"
              const col = isUs ? US : isCn ? CN : "oklch(0.6 0.02 260)"
              return <circle key={i} cx={sx(p.t)} cy={sy(p.y)} r={isUs || isCn ? 3.2 : 2.2} fill={p.m.openWeights ? col : "var(--background)"} stroke={col} strokeWidth={p.m.openWeights ? 0 : 1.5} opacity={isUs || isCn ? 0.9 : 0.4} />
            })}

            {/* envelopes */}
            {cnEnv ? <polyline points={cnEnv} fill="none" stroke={CN} strokeWidth="2" /> : null}
            {usEnv ? <polyline points={usEnv} fill="none" stroke={US} strokeWidth="2" /> : null}
          </svg>
        ) : (
          <p className="py-12 text-center font-mono text-xs text-muted-foreground">no dated, scored models yet</p>
        )}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded" style={{ background: US }} /> US frontier</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded" style={{ background: CN }} /> China frontier</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-foreground/70" /> open</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-foreground/70" /> closed</span>
        </div>
      </div>
    </figure>
  )
}
