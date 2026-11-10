"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { MERGE } from "./data"

// Draw calls before and after merging by material, one dot per GLB. "Before" is glTF-Validator's drawCallCount
// on the GLB the dataset ships (one per primitive per mesh-carrying node). "After" is the same count on the file my
// merge script writes: node transforms baked into the vertices, every primitive that shares a material joined
// into one, then validated again (278 of 278 with zero errors). MEASURED. Only static, untextured, unanimated
// assets are eligible; an animated part has to stay its own node.

const W = 640
const H = 300
const L = 44
const R = 14
const T = 12
const B = 34
const LO = 0 // 10^0
const HI = 3 // 10^3

const sx = (v: number) => L + ((mlog10(Math.max(1, v)) - LO) / (HI - LO)) * (W - L - R)
const sy = (v: number) => H - B - ((mlog10(Math.max(1, v)) - LO) / (HI - LO)) * (H - T - B)

const C_DOT = "oklch(0.62 0.13 255)"
const C_SEL = "oklch(0.65 0.19 35)"

const PICKS = ["Merchant", "Zombie", "Bed", "Spear", "Mug", "Cargo ferry"]

const totals = MERGE.reduce(
  (a, r) => [a[0] + r[0], a[1] + r[1], a[2] + r[2], a[3] + r[3]],
  [0, 0, 0, 0],
)

export function DrawCallMerge() {
  const [sel, setSel] = useState(() => MERGE.findIndex((r) => r[4] === "Merchant"))
  const row = MERGE[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          draw calls per GLB · as shipped vs merged by material · 278 static assets · measured
        </span>
        <span className="font-mono text-xs">{row[4]}</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Log-log scatter of draw calls per asset. The horizontal axis is the shipped GLB, from 1 to about 420 draw
            calls; the vertical axis is the same asset after merging primitives by material, mostly between 4 and 25.
            Nearly every dot sits far below the diagonal, which marks no change.
          </title>
          {[1, 10, 100, 1000].map((v) => (
            <g key={v}>
              <line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.1} />
              <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={sx(v)} y={H - B + 14} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {v}
              </text>
              <text x={L - 6} y={sy(v) + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {v}
              </text>
            </g>
          ))}
          <line x1={sx(1)} y1={sy(1)} x2={sx(1000)} y2={sy(1000)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />
          <text x={sx(500)} y={sy(500) + 14} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
            no change
          </text>
          <text x={(W + L) / 2} y={H - 4} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
            as shipped
          </text>
          <text x={12} y={(H - B + T) / 2} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6} transform={`rotate(-90 12 ${(H - B + T) / 2})`}>
            merged
          </text>
          {MERGE.map((r, i) => (
            <circle
              key={i}
              cx={sx(r[0])}
              cy={sy(r[1])}
              r={i === sel ? 6 : 3}
              fill={i === sel ? C_SEL : C_DOT}
              fillOpacity={i === sel ? 1 : 0.45}
              stroke={i === sel ? "currentColor" : "none"}
              onClick={() => setSel(i)}
              style={{ cursor: "pointer" }}
            >
              <title>{`${r[4]}: ${r[0]} to ${r[1]} draw calls`}</title>
            </circle>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Pick an asset">
          {PICKS.map((p) => {
            const i = MERGE.findIndex((r) => r[4] === p)
            if (i < 0) return null
            return (
              <button
                key={p}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={sel === i}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-[11px]",
                  sel === i ? "bg-foreground text-background" : "bg-background hover:bg-muted",
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <div><dt className="text-muted-foreground">draw calls</dt><dd className="tabular-nums">{row[0]} to {row[1]}</dd></div>
          <div><dt className="text-muted-foreground">bytes</dt><dd className="tabular-nums">{(row[2] / 1024).toFixed(0)} to {(row[3] / 1024).toFixed(0)} KiB</dd></div>
          <div><dt className="text-muted-foreground">all 278, draw calls</dt><dd className="tabular-nums">{totals[0].toLocaleString("en-US")} to {totals[1].toLocaleString("en-US")}</dd></div>
          <div><dt className="text-muted-foreground">all 278, bytes</dt><dd className="tabular-nums">{((100 * totals[3]) / totals[2]).toFixed(1)}% of shipped</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Click a dot or a name. The median asset goes from 87 draw calls to 11. A file can grow when the original
          reused one mesh in several nodes, because baking the transforms writes each copy out: one of the oak
          trees goes from 319 KiB to 1,018 KiB while its draw calls drop from 73 to 8.
        </p>
      </div>
    </figure>
  )
}
