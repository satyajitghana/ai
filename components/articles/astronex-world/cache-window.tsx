"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { CACHE, DEPTH, PATHS, type PathId, type Slot, simulate } from "./window-sim"

// What the causal sampler keeps in its 20-frame KV cache, block by block. The
// bookkeeping is a port of the release's own code (see window-sim.ts): four sink
// frames that never leave, the newest four history frames pinned, the other four
// history slots chosen by camera-frustum overlap (at least 0.3, at most two
// swaps a block) when retrieval is on, and the eight frames being denoised.

const ROLE: Record<Slot["role"], { label: string; color: string; text: string }> = {
  sink: { label: "sink (frames 0-3)", color: "oklch(0.55 0.15 255)", text: "white" },
  recent: { label: "recent, pinned", color: "oklch(0.72 0.03 255)", text: "black" },
  kept: { label: "kept by recency", color: "oklch(0.82 0.03 255)", text: "black" },
  retrieved: { label: "kept for overlap", color: "oklch(0.72 0.16 55)", text: "black" },
  new: { label: "current block", color: "oklch(0.35 0.02 255)", text: "white" },
}

const W = 360
const H = 200
const HALF_FOV = (32 * Math.PI) / 180

export function CacheWindow() {
  const [path, setPath] = useState<PathId>("strafe")
  const [retrieval, setRetrieval] = useState(true)
  const [block, setBlock] = useState(4)

  const sim = useMemo(() => simulate(path, retrieval), [path, retrieval])
  const state = sim.blocks[Math.min(block, sim.blocks.length - 1)]
  const roleOf = new Map(state.slots.map((s) => [s.frame, s]))
  const last = sim.poses[state.newFrames[state.newFrames.length - 1]]

  // Fit the path and the current frustum into the plot.
  const pts = sim.poses.map((p) => [p.x, p.y])
  const fl = [mcos(last.yaw - HALF_FOV), msin(last.yaw - HALF_FOV)]
  const fr = [mcos(last.yaw + HALF_FOV), msin(last.yaw + HALF_FOV)]
  const reach = DEPTH / mcos(HALF_FOV)
  const wedge = [
    [last.x, last.y],
    [last.x + fl[0] * reach, last.y + fl[1] * reach],
    [last.x + fr[0] * reach, last.y + fr[1] * reach],
  ]
  const all = [...pts, ...wedge]
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const pad = 14
  const scale = Math.min((W - 2 * pad) / Math.max(1e-6, maxX - minX), (H - 2 * pad) / Math.max(1e-6, maxY - minY))
  const ox = (W - (maxX - minX) * scale) / 2
  const oy = (H - (maxY - minY) * scale) / 2
  const sx = (x: number) => ox + (x - minX) * scale
  const sy = (y: number) => H - (oy + (y - minY) * scale)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>causal kv cache · {CACHE} latent frames, sink included</span>
        <span>--trajectory &apos;{PATHS[path].cmd}&apos;</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {(Object.keys(PATHS) as PathId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPath(id)}
              className={cn(
                "rounded-md border px-2.5 py-1 transition-colors",
                path === id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {PATHS[id].label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRetrieval((r) => !r)}
            aria-pressed={retrieval}
            className={cn(
              "ml-auto rounded-md border px-2.5 py-1 transition-colors",
              retrieval ? "border-orange-500/50 bg-orange-500/10 text-foreground" : "text-muted-foreground",
            )}
          >
            retrieval_window: {retrieval ? "true" : "false"}
          </button>
        </div>

        <label className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="w-28 shrink-0">block {state.block} of {sim.blocks.length - 1}</span>
          <Range min={0} max={sim.blocks.length - 1} step={1} value={block} onChange={(e) => setBlock(Number(e.target.value))} />
        </label>

        <div className="grid grid-cols-10 gap-1 sm:grid-cols-20" role="list" aria-label="The twenty cache slots for this block">
          {Array.from({ length: CACHE }, (_, i) => {
            const s = state.slots[i]
            if (!s)
              return (
                <div key={i} role="listitem" className="flex h-9 items-center justify-center rounded border border-dashed font-mono text-[10px] text-muted-foreground/50">
                  ·
                </div>
              )
            const r = ROLE[s.role]
            return (
              <div
                key={i}
                role="listitem"
                title={`frame ${s.frame}: ${r.label}${s.score !== undefined ? `, overlap ${s.score.toFixed(1)}` : ""}`}
                className="flex h-9 flex-col items-center justify-center rounded font-mono text-[10px] leading-tight"
                style={{ background: r.color, color: r.text }}
              >
                <span className="font-semibold">{s.frame}</span>
                {s.score !== undefined && s.role === "retrieved" ? <span className="opacity-80">{s.score.toFixed(1)}</span> : null}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {(Object.keys(ROLE) as Slot["role"][]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ROLE[k].color }} />
              {ROLE[k].label}
            </span>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border bg-background/60" role="img" aria-label="Top-down view of the camera path. Dots are latent frames; coloured dots are frames whose keys and values are in the cache for this block; the wedge is the current view, pushed to depth three, which the overlap score is measured against.">
          <polygon
            points={wedge.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")}
            fill="oklch(0.72 0.16 55)"
            opacity={0.12}
            stroke="oklch(0.72 0.16 55)"
            strokeOpacity={0.5}
          />
          <polyline
            points={sim.poses.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          {sim.poses.map((p, f) => {
            const s = roleOf.get(f)
            const future = f > state.newFrames[state.newFrames.length - 1]
            if (future) return null
            const color = s ? ROLE[s.role].color : "currentColor"
            const len = 7
            return (
              <g key={f} opacity={s ? 1 : 0.22}>
                <line
                  x1={sx(p.x)}
                  y1={sy(p.y)}
                  x2={sx(p.x) + mcos(p.yaw) * len}
                  y2={sy(p.y) - msin(p.yaw) * len}
                  stroke={color}
                  strokeWidth={1}
                />
                <circle cx={sx(p.x)} cy={sy(p.y)} r={s ? 3 : 2} fill={color} />
              </g>
            )
          })}
        </svg>

        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          {state.evicted.length
            ? `evicted at this block: ${state.evicted.join(", ")}. Nothing brings these back; retrieval only chooses among frames still resident.`
            : "nothing evicted yet: the cache is not full."}
        </p>
      </div>
    </figure>
  )
}
