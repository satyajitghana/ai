"use client"

// Our oracle fit of the ray representations to analytic ground-truth rays,
// one camera at a time. Bars are the mean angular error on a log scale; the
// white ticks are the paper's Table 1 values for the rows that have a
// counterpart there (reported, a different optimiser and camera sampling, so
// compare shapes, not digits). Data: public/articles/omniray/code/oracle_results.json.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { GEOMS } from "./data"

const ROWS: { key: "pinhole" | "sh" | "radial" | "radialSh" | "free"; label: string; params: string }[] = [
  { key: "pinhole", label: "pinhole", params: "6" },
  { key: "sh", label: "spherical harmonics only", params: "192" },
  { key: "radial", label: "radial base", params: "24" },
  { key: "radialSh", label: "radial + SH residual", params: "216" },
  { key: "free", label: "+ free-form residual", params: "216 + grid" },
]

const LO = -4 // 1e-4 degrees
const HI = 2 // 1e2 degrees
const W = 560
const X0 = 168
const X1 = 470

const x = (deg: number) => X0 + ((Math.min(Math.max(mlog10(Math.max(deg, 1e-4)), LO), HI) - LO) / (HI - LO)) * (X1 - X0)
const fmt = (d: number) => (d >= 10 ? d.toFixed(1) : d >= 0.1 ? d.toFixed(2) : d >= 0.001 ? d.toFixed(4) : "< 0.001")

export function StageErrors() {
  const [g, setG] = useState(0)
  const geom = GEOMS[g]
  const rowH = 34
  const H = ROWS.length * rowH + 44

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what each representation can express</span>
        <span className="text-muted-foreground/60">our oracle fit, measured</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Camera">
          {GEOMS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === g}
              onClick={() => setG(i)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                i === g ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img">
            <title>
              {`Mean angular error in degrees, log scale, of each ray representation fitted to a ${geom.label} camera. ` +
                ROWS.map((r) => `${r.label}: ${fmt(geom.oracle[r.key])} degrees`).join("; ")}
            </title>
            {[-4, -3, -2, -1, 0, 1, 2].map((e) => (
              <g key={e}>
                <line x1={X0 + ((e - LO) / (HI - LO)) * (X1 - X0)} x2={X0 + ((e - LO) / (HI - LO)) * (X1 - X0)} y1={8} y2={H - 26} className="stroke-border" strokeDasharray="1 4" />
                <text x={X0 + ((e - LO) / (HI - LO)) * (X1 - X0)} y={H - 12} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
                  {e === 0 ? "1°" : `1e${e}°`}
                </text>
              </g>
            ))}
            {ROWS.map((r, i) => {
              const y = 14 + i * rowH
              const v = geom.oracle[r.key]
              const paper = geom.paper?.[r.key]
              return (
                <g key={r.key}>
                  <text x={X0 - 10} y={y + 14} textAnchor="end" fontSize={11} className="fill-foreground font-mono">
                    {r.label}
                  </text>
                  <text x={X0 - 10} y={y + 26} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                    {`${r.params} parameters`}
                  </text>
                  <rect x={X0} y={y + 6} width={Math.max(x(v) - X0, 1.5)} height={14} rx={2} className={cn(v < 0.25 ? "fill-emerald-500/70" : v < 5 ? "fill-amber-500/70" : "fill-rose-500/70")} />
                  {paper !== undefined && <rect x={x(paper) - 1.5} y={y + 2} width={3} height={22} className="fill-foreground" />}
                  <text x={Math.max(x(v), X0) + 6} y={y + 17} fontSize={10} className="fill-foreground font-mono">
                    {fmt(v)}
                    {"°"}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {`Camera sampled on ${geom.n.toLocaleString("en-US")} pixels. Green: under a quarter of a degree. White tick: the paper's Table 1 value for the matching row (reported; K = 16 radial, SH L = 7, composite = radial 16 + SH 7).`}
        </p>
      </div>
    </figure>
  )
}
