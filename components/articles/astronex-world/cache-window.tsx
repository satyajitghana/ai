"use client"

import { useId, useMemo, useState } from "react"

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
  // Dark slate on a light page, light teal on a dark one: set per theme on the
  // figure as --cw-new / --cw-new-text.
  new: { label: "current block", color: "var(--cw-new)", text: "var(--cw-new-text)" },
}

const W = 360
const H = 200
const HALF_FOV = (32 * Math.PI) / 180

export function CacheWindow() {
  const [path, setPath] = useState<PathId>("strafe")
  const [retrieval, setRetrieval] = useState(true)
  const [block, setBlock] = useState(4)
  const clipId = `cw-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

  const sim = useMemo(() => simulate(path, retrieval), [path, retrieval])
  const state = sim.blocks[Math.min(block, sim.blocks.length - 1)]
  const roleOf = new Map(state.slots.map((s) => [s.frame, s]))

  // Lay the path out for display. The plot is fitted to the path, not to the
  // view wedge (which reaches DEPTH/cos(FOV) and would shrink the path to a
  // few overlapping dots); the wedge is drawn at full reach and clipped.
  //  - A path that runs mostly along y is turned a quarter so it runs along the
  //    wide axis of the panel.
  //  - A path that comes back over itself (strafe out and back) has each frame
  //    nudged across the path in proportion to its index, so the return leg
  //    sits beside the outbound one instead of on top of it.
  //  - A camera that never moves (pan) is drawn as a fan: each frame a dot
  //    along its own heading, further out the later it is.
  const n = sim.poses.length
  const rawX = sim.poses.map((p) => p.x)
  const rawY = sim.poses.map((p) => p.y)
  const spanX = Math.max(...rawX) - Math.min(...rawX)
  const spanY = Math.max(...rawY) - Math.min(...rawY)
  const turn = spanY > spanX
  const view = sim.poses.map((p) => (turn ? { x: p.y, y: -p.x, yaw: p.yaw - Math.PI / 2 } : { ...p }))
  const major = Math.max(spanX, spanY)
  const fan = major < 1e-6
  let hub: [number, number] | null = null
  let dp: [number, number][]
  let revisits = false
  if (fan) {
    hub = [0, 0]
    dp = view.map((p, f) => {
      const r = 0.45 + (0.55 * f) / Math.max(1, n - 1)
      return [mcos(p.yaw) * r, msin(p.yaw) * r]
    })
  } else {
    revisits = view.some((p, f) => view.some((q, g) => g > f && Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6))
    const lane = revisits ? (0.4 * major) / Math.max(1, n - 1) : 0
    dp = view.map((p, f) => [p.x, p.y + lane * f])
  }
  const lastIdx = state.newFrames[state.newFrames.length - 1]
  const apex: [number, number] = hub ?? dp[lastIdx]
  const lastYaw = view[lastIdx].yaw
  const fl = [mcos(lastYaw - HALF_FOV), msin(lastYaw - HALF_FOV)]
  const fr = [mcos(lastYaw + HALF_FOV), msin(lastYaw + HALF_FOV)]
  // Only a stub of the wedge is fitted, so its direction is always on screen.
  // The stub is fitted at every frame, not just this block's, so the scale
  // holds still while the slider moves.
  const stub = fan ? 0.5 : 0.35 * major
  const stubs = view.flatMap((p, f) => {
    const a = hub ?? dp[f]
    return [p.yaw - HALF_FOV, p.yaw + HALF_FOV].map((t) => [a[0] + mcos(t) * stub, a[1] + msin(t) * stub])
  })
  const all = [...dp, apex, ...stubs]
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const pad = 16
  const scale = Math.min((W - 2 * pad) / Math.max(1e-6, maxX - minX), (H - 2 * pad) / Math.max(1e-6, maxY - minY))
  const ox = (W - (maxX - minX) * scale) / 2
  const oy = (H - (maxY - minY) * scale) / 2
  const sx = (x: number) => ox + (x - minX) * scale
  const sy = (y: number) => H - (oy + (y - minY) * scale)
  // Full reach in world units (or past the panel edge for the fan); the clip
  // path below trims it to the plot.
  const reach = fan ? (W + H) / scale : DEPTH / mcos(HALF_FOV)
  const wedge = [apex, [apex[0] + fl[0] * reach, apex[1] + fl[1] * reach], [apex[0] + fr[0] * reach, apex[1] + fr[1] * reach]]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent [--cw-new-text:white] [--cw-new:oklch(0.35_0.02_255)] dark:[--cw-new-text:black] dark:[--cw-new:oklch(0.8_0.11_190)]">
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

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border bg-background/60" role="img" aria-label="Top-down view of the camera path. Dots are latent frames; coloured dots are frames whose keys and values are in the cache for this block; the wedge is the current view, pushed to depth three, which the overlap score is measured against. A path that doubles back is drawn with the return leg offset beside the outbound one; a camera that only turns is drawn as a fan of headings, later frames further out.">
          <defs>
            <clipPath id={clipId}>
              <rect x={1} y={1} width={W - 2} height={H - 2} />
            </clipPath>
          </defs>
          <polygon
            points={wedge.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")}
            fill="oklch(0.72 0.16 55)"
            opacity={0.12}
            stroke="oklch(0.72 0.16 55)"
            strokeOpacity={0.5}
            clipPath={`url(#${clipId})`}
          />
          {fan ? null : (
            <polyline
              points={dp.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.15}
            />
          )}
          {hub ? <circle cx={sx(hub[0])} cy={sy(hub[1])} r={2.5} fill="currentColor" opacity={0.5} /> : null}
          {dp.map((p, f) => {
            const s = roleOf.get(f)
            const future = f > lastIdx
            if (future) return null
            const color = s ? ROLE[s.role].color : "currentColor"
            const len = 7
            const yaw = view[f].yaw
            return (
              <g key={f} opacity={s ? 1 : 0.22}>
                <line
                  x1={sx(p[0])}
                  y1={sy(p[1])}
                  x2={sx(p[0]) + mcos(yaw) * len}
                  y2={sy(p[1]) - msin(yaw) * len}
                  stroke={color}
                  strokeWidth={1}
                />
                <circle cx={sx(p[0])} cy={sy(p[1])} r={s ? 2.6 : 1.8} fill={color} />
              </g>
            )
          })}
        </svg>
        <p className="-mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {fan
            ? "the camera stays put while it turns: each frame is drawn along its own heading, later frames further out."
            : turn
              ? "drawn turned a quarter, so the walk runs left to right."
              : revisits
                ? "the return leg is drawn just above the outbound one so neither hides the other."
                : null}
        </p>

        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          {state.evicted.length
            ? `evicted at this block: ${state.evicted.join(", ")}. Nothing brings these back; retrieval only chooses among frames still resident.`
            : "nothing evicted yet: the cache is not full."}
        </p>
      </div>
    </figure>
  )
}
