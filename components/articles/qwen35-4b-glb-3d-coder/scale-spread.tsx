"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { GROUPS, HEIGHTS } from "./data"

// Height of every shipped GLB, in glTF units, which the glTF 2.0 spec defines as metres. Read from the scene
// bounds trimesh computes after applying every node transform. MEASURED on 241 of the 417 validation assets
// (the domains that group cleanly; the rest are scenery, stations and markers). The band is the height of an
// adult person, 1.6 to 1.9 m, as a yardstick.

const W = 640
const H = 320
const L = 44
const R = 10
const T = 12
const B = 46
const LO = -1 // 0.1 m
const HI = 1.2 // about 15.8 m

const sy = (m: number) => T + (1 - (mlog10(m) - LO) / (HI - LO)) * (H - T - B)
const colW = (W - L - R) / GROUPS.length

// Deterministic jitter so server and client agree.
const jit = (i: number) => (((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5

const C_DOT = "oklch(0.62 0.13 255)"
const C_SEL = "oklch(0.65 0.19 35)"
const C_BAND = "oklch(0.7 0.12 150)"

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

export function ScaleSpread() {
  const [sel, setSel] = useState(() => HEIGHTS.findIndex((h) => h[2] === "Merchant"))
  const [g, setG] = useState(0)
  const inGroup = HEIGHTS.filter((h) => h[0] === g)
  const med = median(inGroup.map((h) => h[1]))
  const human = inGroup.filter((h) => h[1] >= 1.6 && h[1] <= 1.9).length
  const row = HEIGHTS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          asset height in glTF units (metres) · 241 shipped GLBs · measured
        </span>
        <span className="font-mono text-xs tabular-nums">
          {row[2]} · {row[1].toFixed(2)} m
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Strip plot of asset heights on a log scale from 0.1 to 15 metres, in seven columns: characters,
            creatures, items and weapons, props, vehicles, nature and architecture. Most columns cluster around 2 to
            5 metres whatever the object is. A green band at 1.6 to 1.9 metres marks a person.
          </title>
          <rect x={L} y={sy(1.9)} width={W - L - R} height={sy(1.6) - sy(1.9)} fill={C_BAND} opacity={0.22} />
          <text x={W - R - 4} y={sy(1.9) - 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
            a person, 1.6 to 1.9 m
          </text>
          {[0.1, 0.3, 1, 3, 10].map((m) => (
            <g key={m}>
              <line x1={L} x2={W - R} y1={sy(m)} y2={sy(m)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={L - 6} y={sy(m) + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {m} m
              </text>
            </g>
          ))}
          {GROUPS.map((name, k) => (
            <text
              key={name}
              x={L + (k + 0.5) * colW}
              y={H - B + 16}
              textAnchor="middle"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
              fill="currentColor"
              fillOpacity={k === g ? 1 : 0.55}
              fontWeight={k === g ? 700 : 400}
              onClick={() => setG(k)}
              style={{ cursor: "pointer" }}
            >
              {name.split(" ")[0]}
            </text>
          ))}
          {HEIGHTS.map((h, i) => (
            <circle
              key={i}
              cx={L + (h[0] + 0.5 + 0.7 * jit(i)) * colW}
              cy={sy(Math.max(0.1, h[1]))}
              r={i === sel ? 5.5 : 2.6}
              fill={i === sel ? C_SEL : C_DOT}
              fillOpacity={i === sel ? 1 : h[0] === g ? 0.75 : 0.3}
              stroke={i === sel ? "currentColor" : "none"}
              onClick={() => {
                setSel(i)
                setG(h[0])
              }}
              style={{ cursor: "pointer" }}
            >
              <title>{`${h[2]}: ${h[1].toFixed(2)} m`}</title>
            </circle>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Pick a group">
          {GROUPS.map((name, k) => (
            <button
              key={name}
              type="button"
              onClick={() => setG(k)}
              aria-pressed={g === k}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px]",
                g === k ? "bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 font-mono text-xs">
          <div><dt className="text-muted-foreground">assets</dt><dd className="tabular-nums">{inGroup.length}</dd></div>
          <div><dt className="text-muted-foreground">median height</dt><dd className="tabular-nums">{med.toFixed(2)} m</dd></div>
          <div><dt className="text-muted-foreground">within 1.6 to 1.9 m</dt><dd className="tabular-nums">{human} of {inGroup.length}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Click a dot to name it. A plain mug is 0.11 m and a magical mug 2.21 m; a pocket watch is 0.12 m and a
          magical one 5.74 m. Nothing in the system prompt names a unit. The pages place the camera by hand, 8 to
          13 units from the origin in 211 of the 307 I could parse, and build the asset to fill that view.
        </p>
      </div>
    </figure>
  )
}
