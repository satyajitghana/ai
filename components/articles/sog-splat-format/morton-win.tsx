"use client"

// What spatial ordering actually buys, MEASURED. Each of the six per-splat
// textures in the bicycle .sog stores a fixed number of raw bytes per splat
// (its channel count). WebP lossless then squeezes each one by a different
// amount. The numbers are the real file sizes divided by 5,000,000 splats
// (opsiclear-admin/test2, splat_30000.sog):
//
//   file            raw B/splat   WebP B/splat   WebP keeps
//   means_u              3            0.63          21%
//   means_l              3            2.98          99%
//   scales               3            2.32          77%
//   quats                4            3.12          78%
//   sh0                  4            2.68          67%
//   shN_labels           2            1.61          80%
//
// means_u is the high byte of each position axis. Under Morton ordering,
// neighbouring pixels are neighbouring splats in space, so their high position
// bits barely change from pixel to pixel — and WebP's predictors collapse that
// to almost nothing. means_l, the low byte, is spatial noise and does not
// compress. That gap IS the spatial ordering working. SSR-safe, plain
// arithmetic only.

import { useState } from "react"

type Row = { key: string; label: string; raw: number; webp: number; what: string }

const ROWS: Row[] = [
  { key: "means_u", label: "means_u", raw: 3, webp: 0.63, what: "high byte of x, y, z position" },
  { key: "means_l", label: "means_l", raw: 3, webp: 2.98, what: "low byte of x, y, z position" },
  { key: "scales", label: "scales", raw: 3, webp: 2.32, what: "3 codebook indices" },
  { key: "quats", label: "quats", raw: 4, webp: 3.12, what: "smallest-three quaternion" },
  { key: "sh0", label: "sh0", raw: 4, webp: 2.68, what: "DC colour + opacity" },
  { key: "shN_labels", label: "shN_labels", raw: 2, webp: 1.61, what: "16-bit SH palette index" },
]

const HI = "oklch(0.62 0.17 255)"
const BASE = "oklch(0.62 0.03 255)"

const W = 700
const ROW_H = 34
const TOP = 36
const LABEL_X = 14
const BAR_X = 108
const BAR_W = 360
const UNIT = BAR_W / 4 // widest raw field is 4 bytes

export function MortonWin() {
  const [sel, setSel] = useState<string>("means_u")
  const H = TOP + ROWS.length * ROW_H + 58
  const active = ROWS.find((r) => r.key === sel)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what WebP keeps, per texture · bytes/splat</span>
        <span className="text-muted-foreground/60">measured</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Six per-splat SOG textures, each a bar of raw bytes per splat with the WebP-compressed size filled in. means_u keeps only 0.63 of 3 bytes, 21 percent. means_l keeps 2.98 of 3, 99 percent. scales 2.32 of 3, quats 3.12 of 4, sh0 2.68 of 4, shN_labels 1.61 of 2. The high byte of position compresses far better than the low byte because Morton ordering makes neighbouring splats' high bits nearly identical."
        >
          <text x={BAR_X} y={22} fontSize={9} className="fill-muted-foreground font-mono">
            raw bytes/splat (outline) vs on-disk WebP (filled)
          </text>

          {ROWS.map((r, i) => {
            const y = TOP + i * ROW_H
            const lit = r.key === sel
            // floor, not round: shN_labels is 1.61/2 = 80.5, and its measured
            // ratio (8,049,818 / 10,000,000 = 80.50%) is 80% as the prose states.
            // Rounding the 2-dp B/splat value would double-round up to 81.
            const keep = Math.floor((r.webp / r.raw) * 100)
            return (
              <g key={r.key} onClick={() => setSel(r.key)} style={{ cursor: "pointer" }}>
                <text x={LABEL_X} y={y + 15} fontSize={10} className="fill-foreground font-mono" fillOpacity={lit ? 1 : 0.7}>
                  {r.label}
                </text>
                {/* raw outline */}
                <rect
                  x={BAR_X}
                  y={y + 5}
                  width={r.raw * UNIT}
                  height={16}
                  rx={2}
                  fill="none"
                  stroke={lit ? HI : BASE}
                  strokeOpacity={0.5}
                  strokeDasharray="3 2"
                />
                {/* webp filled */}
                <rect
                  x={BAR_X}
                  y={y + 5}
                  width={r.webp * UNIT}
                  height={16}
                  rx={2}
                  fill={lit ? HI : BASE}
                  fillOpacity={lit ? 0.85 : 0.5}
                />
                <text x={BAR_X + r.raw * UNIT + 8} y={y + 17} fontSize={9} className="fill-muted-foreground font-mono">
                  {r.webp.toFixed(2)} / {r.raw} B · WebP keeps {keep}%
                </text>
              </g>
            )
          })}

          <line x1={BAR_X} x2={BAR_X} y1={TOP} y2={TOP + ROWS.length * ROW_H} stroke="currentColor" className="text-border" strokeWidth={1} />
        </svg>

        <div className="mt-1 rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">{active.label}.webp</span> — {active.what}. WebP keeps{" "}
          <span className="text-foreground">{active.webp.toFixed(2)} of {active.raw} B</span> ({Math.floor((active.webp / active.raw) * 100)}%).{" "}
          {active.key === "means_u"
            ? "The high position bits are nearly constant between spatially-adjacent splats, so Morton ordering lets WebP's predictors erase almost all of them."
            : active.key === "means_l"
              ? "The low position bits are spatial noise — adjacent splats differ randomly here, so there is nothing for WebP to predict."
              : "Orientation, scale and colour indices carry real per-splat entropy, so ordering helps them far less than it helps the high position byte."}
        </div>
      </div>
    </figure>
  )
}
