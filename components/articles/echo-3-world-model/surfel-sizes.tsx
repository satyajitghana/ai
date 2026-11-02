"use client"

import { useState } from "react"

import { mpow } from "@/lib/dmath"

import { FLAT_FRACTION, MAJOR_LOG2, MAJOR_QUANTILES_MM, SPLATS } from "./data"

// How big is a splat, and how thick? Bars: the longest axis of all 7,276,512
// splats, in octaves of a millimetre. The drawn splat below is the median one
// at true relative proportions (3.84 mm by 2.19 mm by 0.045 mm).

const LABELS = ["0.5-1", "1-2", "2-4", "4-8", "8-16", "16-32", "32-64", "64-128"]
const MAX = Math.max(...MAJOR_LOG2)
const MEDIAN = { major: 3.84, mid: 2.19, minor: 0.0454 }

export function SurfelSizes() {
  const [sel, setSel] = useState(2)
  const count = MAJOR_LOG2[sel]
  const share = (count / SPLATS) * 100
  const scale = 18 // px per mm for the drawn splat
  const rx = (MEDIAN.major / 2) * scale
  const ry = (MEDIAN.mid / 2) * scale
  const thick = Math.max(0.5, MEDIAN.minor * scale)
  const lo = mpow(2, sel - 1)
  const hi = mpow(2, sel)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">longest axis per splat · measured</span>
        <span className="font-mono text-xs">
          {LABELS[sel]} mm: {count.toLocaleString("en-US")} splats ({share.toFixed(1)}%)
        </span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <svg viewBox="0 0 300 150" className="w-full" role="img" aria-label="Bar chart of splat longest-axis sizes in octaves of a millimetre">
          {MAJOR_LOG2.map((v, k) => (
            <g key={k} onClick={() => setSel(k)} style={{ cursor: "pointer" }}>
              <rect
                x={8 + k * 36}
                y={120 - (v / MAX) * 100}
                width={30}
                height={(v / MAX) * 100}
                fill={k === sel ? "oklch(0.62 0.16 35)" : "oklch(0.60 0.15 255)"}
              />
              <text x={23 + k * 36} y={136} fontSize={8} textAnchor="middle" fill="currentColor">
                {LABELS[k]}
              </text>
            </g>
          ))}
          <text x={150} y={148} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.6}>
            mm (octaves)
          </text>
        </svg>
        <svg viewBox="0 0 300 150" className="w-full" role="img" aria-label="The median splat drawn face-on and edge-on at true proportions">
          <ellipse cx={80} cy={70} rx={rx} ry={ry} fill="oklch(0.80 0.08 255)" stroke="oklch(0.45 0.12 255)" />
          <text x={80} y={125} fontSize={9} textAnchor="middle" fill="currentColor">
            face-on: 3.84 × 2.19 mm
          </text>
          <rect x={190} y={70 - thick / 2} width={rx * 2} height={thick} fill="oklch(0.45 0.12 255)" />
          <text x={190 + rx} y={125} fontSize={9} textAnchor="middle" fill="currentColor">
            edge-on: 0.045 mm thick
          </text>
        </svg>
      </div>
      <p className="border-t px-4 py-3 text-sm text-muted-foreground">
        Bin {LABELS[sel]} mm spans {lo.toFixed(1)} to {hi.toFixed(1)} mm. Median longest axis{" "}
        {MAJOR_QUANTILES_MM[2].mm} mm; 99th percentile {MAJOR_QUANTILES_MM[5].mm} mm. {(FLAT_FRACTION * 100).toFixed(1)}%
        of the splats have their shortest axis at the format&apos;s floor of e<sup>−10</sup> m: they are discs, not blobs.
      </p>
    </figure>
  )
}
