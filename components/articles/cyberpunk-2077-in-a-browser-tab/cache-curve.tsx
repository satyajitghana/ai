"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A SYNTHETIC LRU simulation. Not the port's cache, not the game's data. A
// 40x40-tile world of private blocks plus 3,000 Zipf-shared blocks, a random
// walk (or teleports every 50 steps) issuing 200,000 block references; the
// second session is a different walk over the same world, starting from the
// first session's cache. The point is the shape: persistence only pays once the
// cache holds most of what a session touches.

type Pt = [number, number, number]
const DATA: Record<string, { unique: number; world: number; refs: number; pts: Pt[] }> = {
  walk: { unique: 33260, world: 41400, refs: 200000, pts: [[0.02, 0.447, 0.4414], [0.05, 0.5326, 0.527], [0.1, 0.6036, 0.6009], [0.2, 0.6782, 0.6772], [0.35, 0.7615, 0.7487], [0.5, 0.7842, 0.8029], [0.75, 0.8047, 0.8592], [1.0, 0.8337, 0.9274], [1.5, 0.8337, 0.9639]] },
  teleport: { unique: 34189, world: 41400, refs: 200000, pts: [[0.02, 0.5637, 0.5613], [0.05, 0.6059, 0.6065], [0.1, 0.6377, 0.6433], [0.2, 0.6828, 0.695], [0.35, 0.7286, 0.7435], [0.5, 0.7663, 0.7963], [0.75, 0.8109, 0.8695], [1.0, 0.8291, 0.9445], [1.5, 0.8291, 0.9725]] },
}

const W = 440
const H = 240
const X0 = 44
const X1 = 420
const Y0 = 20
const Y1 = 200
const YMIN = 0.4
const YMAX = 1.0

export function CacheCurve() {
  const [trace, setTrace] = useState<"walk" | "teleport">("walk")
  const [i, setI] = useState(5)
  const d = DATA[trace]
  const n = d.pts.length
  const x = (k: number) => X0 + (k * (X1 - X0)) / (n - 1)
  const y = (v: number) => Y1 - ((v - YMIN) * (Y1 - Y0)) / (YMAX - YMIN)
  const line = (col: 1 | 2) => d.pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(k)},${y(p[col])}`).join(" ")
  const cur = d.pts[i]
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">Synthetic block cache: first visit against a return visit</div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-xs">
        {(["walk", "teleport"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTrace(t)} className={cn("rounded-full border px-3 py-1", trace === t ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>{t === "walk" ? "walking the map" : "teleporting every 50 steps"}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart of synthetic LRU hit rate against cache size as a multiple of the blocks one session touches, for a first visit and a return visit.">
        {[0.4, 0.6, 0.8, 1.0].map((v) => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.15" />
            <text x={X0 - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.7">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {d.pts.map((p, k) => (
          <text key={p[0]} x={x(k)} y={Y1 + 16} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.7">{p[0]}x</text>
        ))}
        <path d={line(1)} fill="none" stroke="#64748b" strokeWidth="2" />
        <path d={line(2)} fill="none" stroke="#f59e0b" strokeWidth="2" />
        <line x1={x(i)} x2={x(i)} y1={Y0} y2={Y1} stroke="currentColor" strokeOpacity="0.4" strokeDasharray="3 3" />
        <circle cx={x(i)} cy={y(cur[1])} r="4" fill="#64748b" />
        <circle cx={x(i)} cy={y(cur[2])} r="4" fill="#f59e0b" />
        <text x={X0} y={H - 8} fontSize="10" fill="currentColor" fillOpacity="0.7">cache size as a multiple of the blocks one session touches</text>
      </svg>
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-xs">
        <input type="range" min={0} max={n - 1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="cache size" className="w-48" />
        <span>cache {cur[0]}x of {d.unique.toLocaleString("en-US")} touched blocks</span>
        <span className="text-[#64748b]">first visit {Math.round(cur[1] * 1000) / 10}%</span>
        <span className="text-[#d97706]">return visit {Math.round(cur[2] * 1000) / 10}%</span>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Synthetic, run by me on a CPU: {d.refs.toLocaleString("en-US")} references over a {d.world.toLocaleString("en-US")}-block world, LRU eviction, seed 2077. The two lines stay within about three points of each other until the cache holds half of what one session touches; the return visit is ahead by 5 to 6 points at 0.75x and 9 to 11 at 1x. Nothing here is measured on the port: its block size, eviction rule and working set are not published.</p>
    </div>
  )
}
