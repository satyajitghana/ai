"use client"

import { useState } from "react"

import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { NORMS, type NormId, TOY, TOY_SPREAD } from "./data"

// Where each scene's median Gaussian spacing lands after one normalization,
// relative to the geometric mean over the scenes that have a value. Log axis
// from 1/4x to 4x. Every number is from my numpy run (see data.ts); the
// cubemap has no CDNorm value because its four faces share one camera centre.

const W = 640
const H = 300
const L = 150
const R = 28
const T = 34
const ROW = 40
const LO = 0.25
const HI = 4

const lx = (v: number) => {
  const a = mlog(LO)
  const b = mlog(HI)
  const t = (mlog(Math.min(HI, Math.max(LO, v))) - a) / (b - a)
  return L + t * (W - L - R)
}

export function SpacingSpread() {
  const [norm, setNorm] = useState<NormId>("RD")
  const vals = TOY.map((s) => s.spacing[norm])
  const have = vals.filter((v): v is number => v != null)
  const gm = mexp(have.reduce((a, v) => a + mlog(v), 0) / have.length)
  const meta = NORMS.find((n) => n.id === norm)!
  const desc = `Median Gaussian spacing per toy scene after ${meta.label}, relative to the geometric mean; max over min is ${TOY_SPREAD[norm].toFixed(2)}x.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>median Gaussian spacing after normalization</span>
        <span className="text-muted-foreground/60">numpy toy · measured</span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {NORMS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setNorm(n.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              norm === n.id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {n.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label={desc}>
          {[0.25, 0.5, 1, 2, 4].map((g) => (
            <g key={g}>
              <line x1={lx(g)} x2={lx(g)} y1={T - 12} y2={T + ROW * TOY.length - 14} stroke="currentColor" strokeOpacity={g === 1 ? 0.35 : 0.12} className="text-muted-foreground" />
              <text x={lx(g)} y={T - 16} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
                {g < 1 ? `1/${1 / g}x` : `${g}x`}
              </text>
            </g>
          ))}
          {TOY.map((s, i) => {
            const v = s.spacing[norm]
            const y = T + i * ROW + 6
            return (
              <g key={s.id}>
                <text x={L - 12} y={y + 4} textAnchor="end" fontSize={11} className="fill-foreground">
                  {s.label}
                </text>
                <line x1={L} x2={W - R} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} className="text-muted-foreground" />
                {v == null ? (
                  <text x={lx(1)} y={y + 4} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
                    undefined: one camera centre
                  </text>
                ) : (
                  <>
                    <line x1={lx(1)} x2={lx(v / gm)} y1={y} y2={y} stroke="currentColor" strokeWidth={2} className={norm === "GS" ? "text-emerald-500" : "text-orange-500"} />
                    <circle cx={lx(v / gm)} cy={y} r={6} fill="currentColor" className={norm === "GS" ? "text-emerald-500" : "text-orange-500"} />
                    <text x={lx(v / gm) + (v / gm >= 1 ? 10 : -10)} y={y - 8} textAnchor={v / gm >= 1 ? "start" : "end"} fontSize={10} className="fill-muted-foreground font-mono">
                      {(v / gm).toFixed(2)}x
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        <span className="font-mono text-foreground">{meta.label}</span> divides the scene by the {meta.long}. Largest over
        smallest median spacing across these scenes:{" "}
        <span className="font-mono text-foreground">{TOY_SPREAD[norm].toFixed(2)}x</span>
        {norm === "CD" ? " (cubemap excluded: with one camera centre the factor is zero)" : ""}
        {norm === "GS" ? ", by construction" : ""}. Doubling the object&apos;s resolution from 504 to 1022 px halves its
        spacing under every norm except GSNorm. Synthetic scenes; the paper&apos;s own real-data plot is Figure 4.
      </figcaption>
    </figure>
  )
}
