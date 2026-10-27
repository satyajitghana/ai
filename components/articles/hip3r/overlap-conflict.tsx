"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { RUN } from "./data"

// One overlap, frame by frame, from the same simulated run (seed 0). MEASURED on a synthetic backend.
// Chunk A and chunk B both predict these frames. After stage I each prediction is placed in the world; the lines
// are each placed camera's distance from ground truth (after the global Sim(3) fit), and the shared camera's.

const SERIES = [
  { id: "chunk_a", label: "chunk A's prediction", color: "oklch(0.62 0.19 28)" },
  { id: "chunk_b", label: "chunk B's prediction", color: "oklch(0.62 0.13 250)" },
  { id: "shared", label: "shared camera", color: "oklch(0.62 0.15 150)" },
] as const

const W = 520
const H = 220
const L = 40
const B = 28

export function OverlapConflict() {
  const o = RUN.overlap
  const [on, setOn] = useState<Record<string, boolean>>({ chunk_a: true, chunk_b: true, shared: true })
  const [sel, setSel] = useState(Math.floor(o.frames.length / 2))
  const n = o.frames.length
  const vals = (id: string) => o[id as "chunk_a" | "chunk_b" | "shared"] as number[]
  const top = Math.max(...SERIES.flatMap((s) => vals(s.id))) * 1.1
  const px = (k: number) => L + (k / (n - 1)) * (W - L - 8)
  const py = (v: number) => H - B - (v / top) * (H - B - 10)
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured · one 20-frame overlap, frames {o.frames[0]} to {o.frames[n - 1]} · our simplified re-implementation
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3">
        {SERIES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={on[s.id]}
            onClick={() => setOn({ ...on, [s.id]: !on[s.id] })}
            className={cn("flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs", on[s.id] ? "text-foreground" : "text-muted-foreground opacity-60")}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>
      <div className="p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Position error in metres of each placed camera prediction and of the shared camera, across the frames of one overlap between two chunks."
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={L} x2={W - 8} y1={py(top * f * 0.9)} y2={py(top * f * 0.9)} stroke="var(--border)" strokeWidth={0.5} />
              <text x={L - 4} y={py(top * f * 0.9) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
                {(top * f * 0.9).toFixed(1)}
              </text>
            </g>
          ))}
          {SERIES.filter((s) => on[s.id]).map((s) => (
            <polyline
              key={s.id}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              points={vals(s.id).map((v, k) => `${px(k).toFixed(1)},${py(v).toFixed(1)}`).join(" ")}
            />
          ))}
          <line x1={px(sel)} x2={px(sel)} y1={8} y2={H - B} stroke="var(--foreground)" strokeWidth={0.8} strokeDasharray="3 3" />
          <text x={L} y={H - 8} fontSize={9} className="fill-muted-foreground font-mono">
            frame {o.frames[0]}
          </text>
          <text x={W - 8} y={H - 8} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
            frame {o.frames[n - 1]} (m of error)
          </text>
        </svg>
        <input
          type="range"
          min={0}
          max={n - 1}
          value={sel}
          onChange={(e) => setSel(Number(e.target.value))}
          className="mt-1 w-full"
          aria-label="Frame in the overlap"
        />
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs sm:grid-cols-4">
          <dt className="text-muted-foreground">frame {o.frames[sel]}</dt>
          <dd />
          {SERIES.map((s) => (
            <div key={s.id} className="contents">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="tabular-nums">{vals(s.id)[sel].toFixed(2)} m</dd>
            </div>
          ))}
          <dt className="text-muted-foreground">A and B disagree by</dt>
          <dd className="tabular-nums">{o.gap[sel].toFixed(2)} m</dd>
          <dt className="text-muted-foreground">means over the overlap</dt>
          <dd className="tabular-nums">
            {mean(o.chunk_a).toFixed(2)} / {mean(o.chunk_b).toFixed(2)} / {mean(o.shared).toFixed(2)}
          </dd>
        </dl>
      </div>
    </figure>
  )
}
