"use client"

// When does the SH codebook pay? The codebook holds min(N, 262,144) entries,
// so below 262,144 splats it is one entry per splat plus a label, and the file
// grows; far above it the table vanishes into the labels.
//
// Two models of the whole RAD file's change, codebook vs --no-cluster-sh:
//  - "before deflate" (REASONED from bin/rad/rad.js): 28 B/splat of other
//    properties, 45 B of s8 SH, or a 2/4 B label + 45 B per entry.
//  - "after deflate" (REASONED, from rates I MEASURED on the train scene,
//    1,074,761 leaf splats, my re-implementation): other 17.56 B/splat,
//    s8 SH 29.63 B/splat, u32 label 2.05 B/splat, u16 label 1.66 B/splat
//    (from the 65,536-entry run), 30.48 B per codebook entry.
// Dots are MEASURED files from my re-implementation: train (-42.7%) and the
// 53,671-splat plush (+5.3%). The 60M mark is the post's scene (REPORTED
// -55.6%). Log axis via lib/dmath.

import { useState } from "react"
import { mlog10, mpow } from "@/lib/dmath"

const MAX = 262_144
const PRE = { other: 28, sh: 45, entry: 45, l16: 2, l32: 4 }
const POST = { other: 17.56, sh: 29.63, entry: 30.48, l16: 1.66, l32: 2.05 }
type Model = typeof PRE

function change(n: number, m: Model) {
  const k = Math.min(n, MAX)
  const label = k > 65_536 ? m.l32 : m.l16
  const cb = m.other + label + (k * m.entry) / n
  const raw = m.other + m.sh
  return cb / raw - 1
}

const W = 700
const H = 300
const L = 56
const R = 20
const T = 18
const B = 44
const X0 = 4 // 10^4
const X1 = 8.3 // 2 x 10^8
const Y0 = -0.7
const Y1 = 0.3
const sx = (lg: number) => L + ((lg - X0) / (X1 - X0)) * (W - L - R)
const sy = (v: number) => T + ((Y1 - v) / (Y1 - Y0)) * (H - T - B)

const DOTS = [
  { n: 53_671, v: 0.053, label: "plush 53.7k, +5.3%" },
  { n: 1_074_761, v: -0.427, label: "train 1.07M, -42.7%" },
]

function path(m: Model) {
  const pts: string[] = []
  for (let i = 0; i <= 200; i++) {
    const lg = X0 + ((X1 - X0) * i) / 200
    const n = mpow(10, lg)
    pts.push(`${i ? "L" : "M"}${sx(lg).toFixed(1)},${sy(change(n, m)).toFixed(1)}`)
  }
  return pts.join(" ")
}

const PRE_PATH = path(PRE)
const POST_PATH = path(POST)

export function ScaleCurve() {
  const [lg, setLg] = useState(mlog10(60_000_000))
  const n = Math.round(mpow(10, lg))
  const pre = change(n, PRE)
  const post = change(n, POST)
  const pct = (v: number) => `${v < 0 ? "" : "+"}${(v * 100).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>file size with the SH codebook vs without · by splat count</span>
        <span className="text-muted-foreground/60">reasoned · dots measured</span>
      </div>
      <div className="p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label="Change in RAD file size from the SH codebook, against splat count on a log axis. Below 262,144 splats the file grows by about 5 percent; above it the saving climbs, to about 56 percent before deflate and 58 percent after deflate at 60 million splats. Measured dots: a 53,671-splat scene grew 5.3 percent, the 1.07 million splat train scene shrank 42.7 percent.">
          {[-0.6, -0.4, -0.2, 0, 0.2].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.5 : 0.12} />
              <text x={L - 6} y={sy(v) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">{v > 0 ? "+" : ""}{Math.round(v * 100)}%</text>
            </g>
          ))}
          {[4, 5, 6, 7, 8].map((e) => (
            <text key={e} x={sx(e)} y={H - B + 16} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
              {["10k", "100k", "1M", "10M", "100M"][e - 4]}
            </text>
          ))}
          <line x1={sx(mlog10(MAX))} x2={sx(mlog10(MAX))} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
          <text x={sx(mlog10(MAX)) + 4} y={T + 10} fontSize={9} className="fill-muted-foreground font-mono">262,144 entries</text>
          <path d={PRE_PATH} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="5 3" />
          <path d={POST_PATH} fill="none" className="stroke-sky-500" strokeWidth={2} />
          {DOTS.map((d) => (
            <g key={d.label}>
              <circle cx={sx(mlog10(d.n))} cy={sy(d.v)} r={4.5} className="fill-amber-500" />
              <text x={sx(mlog10(d.n)) + 8} y={sy(d.v) + (d.v > 0 ? -6 : 14)} fontSize={9} className="fill-foreground font-mono">{d.label}</text>
            </g>
          ))}
          <circle cx={sx(mlog10(60_000_000))} cy={sy(-0.556)} r={4.5} fill="none" className="stroke-foreground" strokeWidth={1.5} />
          <text x={sx(mlog10(60_000_000)) - 8} y={sy(-0.556) + 16} fontSize={9} textAnchor="end" className="fill-foreground font-mono">post: 60M, -55.6%</text>
          <line x1={sx(lg)} x2={sx(lg)} y1={T} y2={H - B} className="stroke-foreground" strokeOpacity={0.6} />
          <text x={L} y={H - 6} fontSize={9} className="fill-muted-foreground font-mono">splats after LOD (log)</text>
        </svg>
        <input type="range" min={X0} max={X1} step={0.01} value={lg} onChange={(e) => setLg(Number(e.target.value))}
          className="mt-2 w-full" aria-label="Splat count, log scale" />
        <div className="mt-2 rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">{n.toLocaleString("en-US")} splats</span> · codebook of{" "}
          {Math.min(n, MAX).toLocaleString("en-US")} entries · before deflate{" "}
          <span className="text-foreground">{pct(pre)}</span> · after deflate{" "}
          <span className="text-sky-600 dark:text-sky-400">{pct(post)}</span>
          <span className="block pt-1">Dashed: raw bytes from rad.js. Solid: deflate rates measured on the train scene. Neither counts LOD interior splats separately; they are splats like any other here.</span>
        </div>
      </div>
    </figure>
  )
}
