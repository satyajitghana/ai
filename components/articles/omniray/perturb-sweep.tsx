"use client"

// A 180° equidistant fisheye, deliberately spoiled in two ways, then fitted one
// stage at a time (radial base, then a spherical-harmonic residual, then a
// free-form residual on a coarse grid). "Smooth" adds a low-order tangent
// deviation of the stated size (RMS degrees); "local" adds six small Gaussian
// bumps of the stated size. Every point is the mean of five random draws.
// Data: public/articles/omniray/code/oracle_results.json (our re-implementation
// of the oracle fit, not the authors' code).

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { LOCAL_SWEEP, SMOOTH_SWEEP } from "./data"

const W = 520
const H = 250
const X0 = 54
const X1 = 500
const Y0 = 16
const Y1 = 206
const LO = -4
const HI = 1.5

const STAGES = [
  { key: "radial", frac: "fracRadial", label: "radial base", cls: "stroke-rose-500", dot: "fill-rose-500" },
  { key: "radialSh", frac: "fracRadialSh", label: "+ SH residual", cls: "stroke-amber-500", dot: "fill-amber-500" },
  { key: "free", frac: "fracFree", label: "+ free-form", cls: "stroke-emerald-500", dot: "fill-emerald-500" },
] as const

const yv = (deg: number) => Y1 - ((Math.min(Math.max(mlog10(Math.max(deg, 1e-4)), LO), HI) - LO) / (HI - LO)) * (Y1 - Y0)

export function PerturbSweep() {
  const [mode, setMode] = useState<"smooth" | "local">("smooth")
  const rows = mode === "smooth" ? SMOOTH_SWEEP : LOCAL_SWEEP
  const n = rows.length
  const xi = (i: number) => X0 + (i / (n - 1)) * (X1 - X0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>when the radial base is not enough</span>
        <span className="text-muted-foreground/60">our fits, mean of 5 draws</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Kind of deviation">
          {(
            [
              ["smooth", "smooth deviation from radial"],
              ["local", "local bumps"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                mode === id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px]" role="img">
            <title>
              {`Mean angular error in degrees, log scale, after each fitting stage, against the size of the ${mode === "smooth" ? "smooth deviation" : "local bumps"} in degrees. ` +
                rows.map((r) => `${r.amp} degrees: radial ${r.radial.toFixed(3)}, plus SH ${r.radialSh.toFixed(3)}, plus free-form ${r.free.toFixed(3)}`).join("; ")}
            </title>
            {[-4, -3, -2, -1, 0, 1].map((e) => (
              <g key={e}>
                <line x1={X0} x2={X1} y1={yv(10 ** e)} y2={yv(10 ** e)} className="stroke-border" strokeDasharray="1 4" />
                <text x={X0 - 6} y={yv(10 ** e) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                  {e === 0 ? "1°" : `1e${e}°`}
                </text>
              </g>
            ))}
            <line x1={X0} x2={X1} y1={yv(0.25)} y2={yv(0.25)} className="stroke-foreground/60" strokeDasharray="5 3" />
            <text x={X1} y={yv(0.25) - 4} textAnchor="end" fontSize={9} className="fill-foreground font-mono">
              0.25°
            </text>
            {rows.map((r, i) => (
              <text key={i} x={xi(i)} y={H - 26} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
                {`${r.amp}°`}
              </text>
            ))}
            <text x={(X0 + X1) / 2} y={H - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {mode === "smooth" ? "size of the smooth deviation (RMS)" : "size of each local bump (peak)"}
            </text>
            {STAGES.map((s) => (
              <g key={s.key}>
                <polyline fill="none" strokeWidth={2} className={s.cls} points={rows.map((r, i) => `${xi(i)},${yv(r[s.key])}`).join(" ")} />
                {rows.map((r, i) => (
                  <circle key={i} cx={xi(i)} cy={yv(r[s.key])} r={3} className={s.dot} />
                ))}
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {STAGES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={cn("inline-block h-0.5 w-4", s.dot)} />
              {s.label}
            </span>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse font-mono text-[11px]">
            <caption className="pb-1 text-left text-[10px] text-muted-foreground">share of pixels whose ray is still more than 0.25° off after each stage</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-3 text-left font-normal">size</th>
                {STAGES.map((s) => (
                  <th key={s.key} className="px-2 py-1 text-right font-normal">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.amp} className="border-t">
                  <td className="py-1 pr-3 text-muted-foreground">{`${r.amp}°`}</td>
                  {STAGES.map((s) => (
                    <td key={s.key} className="px-2 py-1 text-right text-foreground">
                      {`${(r[s.frac] * 100).toFixed(r[s.frac] > 0 && r[s.frac] < 0.1 ? 1 : 0)}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  )
}
