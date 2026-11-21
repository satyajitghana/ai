"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"
import { WSTAT } from "@/components/articles/pv-lio/wstat-data"

// Real residuals from my PV-LIO runs. Every 25th scan, the patched build re-evaluated the scan's
// residuals at the converged pose and printed a sample of about 120 of them: the return's range,
// the plane's standard deviation along its normal (from the 6x6 plane covariance), the point's
// (from the range-and-bearing model) and the octree layer of the matched plane. Each dot is one
// residual; its weight in the update is 1 / (plane variance + point variance). The dashed line is
// FAST-LIO2's fixed 3.16 cm (variance 0.001 m^2) for every residual.

const W = 640
const H = 260
const L = 50
const R = 16
const T = 14
const B = 34
const FAST = 0.0316

type Show = "total" | "plane" | "point"

export function ResidualSpread() {
  const keys = Object.keys(WSTAT)
  const [key, setKey] = useState(keys[0])
  const [show, setShow] = useState<Show>("total")
  const d = WSTAT[key]
  const sig = (p: [number, number, number, number]) =>
    show === "plane" ? p[1] : show === "point" ? p[2] : Math.sqrt(p[1] * p[1] + p[2] * p[2])
  const rMax = d.rMax
  const yLo = -3.5
  const yHi = -0.5
  const X = (r: number) => L + (Math.min(r, rMax) / rMax) * (W - L - R)
  const Y = (s: number) => {
    const v = Math.min(yHi, Math.max(yLo, mlog10(Math.max(s, 1e-6))))
    return T + ((yHi - v) / (yHi - yLo)) * (H - T - B)
  }
  const below = d.pts.filter((p) => sig(p) < FAST).length
  const share = d.pts.length ? Math.round((below / d.pts.length) * 100) : 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <div className="flex gap-1">
          {keys.map((k) => (
            <button key={k} type="button" onClick={() => setKey(k)} aria-pressed={key === k}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", key === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {WSTAT[k].short}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["total", "plane", "point"] as Show[]).map((s) => (
            <button key={s} type="button" onClick={() => setShow(s)} aria-pressed={show === s}
              className={cn("cursor-pointer rounded border px-2 py-1 transition-colors", show === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {s === "total" ? "plane + point" : s === "plane" ? "plane only" : "point only"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="w-full rounded-md border bg-muted/20"
          aria-label={`${d.pts.length} residuals sampled from PV-LIO on ${d.label}: standard deviation along the plane normal against range. ${share}% sit below FAST-LIO2's fixed 3.16 cm.`}>
          {([[0.001, "1 mm"], [0.01, "1 cm"], [0.1, "10 cm"]] as const).map(([v, lab]) => (
            <g key={lab}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth="0.8" />
              <text x={L - 6} y={Y(v) + 3} textAnchor="end" className="font-mono" fontSize="9" fill="var(--muted-foreground)">{lab}</text>
            </g>
          ))}
          {d.ticks.map((t) => (
            <text key={t} x={X(t)} y={H - B + 14} textAnchor="middle" className="font-mono" fontSize="9" fill="var(--muted-foreground)">{t} m</text>
          ))}
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="font-mono" fontSize="9" fill="var(--muted-foreground)">range of the return</text>
          {d.pts.map((p, i) => (
            <circle key={i} cx={X(p[0])} cy={Y(sig(p))} r={1.7}
              fill={p[3] === 0 ? "oklch(0.62 0.17 255)" : p[3] === 1 ? "oklch(0.66 0.15 160)" : "oklch(0.74 0.15 75)"} opacity="0.55" />
          ))}
          <line x1={L} x2={W - R} y1={Y(FAST)} y2={Y(FAST)} stroke="oklch(0.66 0.18 25)" strokeDasharray="5 3" strokeWidth="1.4" />
          <text x={W - R - 4} y={Y(FAST) - 5} textAnchor="end" className="font-mono" fontSize="9" fill="oklch(0.66 0.18 25)">FAST-LIO2: 3.16 cm for every residual</text>
        </svg>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="residuals sampled" value={`${d.pts.length}`} />
          <Stat label="below FAST-LIO2's 3.16 cm" value={`${share}%`} highlight />
          <Stat label="median, plane + point" value={`${(d.medTotal * 100).toFixed(2)} cm`} />
          <Stat label="matched, sampled scans (median)" value={`${d.matched}`} />
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Dot colour is the octree layer of the plane the residual matched: blue a root voxel, green one
          cut down, amber two. {d.note}
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
