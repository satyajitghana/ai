"use client"

import { useEffect, useMemo, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

// ikd-Tree map management, animated. The map is one incremental k-d tree, not a
// growing pile. As the sensor moves, new points are inserted in place (with
// on-tree voxel downsampling) and points that fall outside a local window around
// the sensor are removed in one box-wise delete — so the active map stays bounded
// and queries stay fast. The leading edge inserts; the trailing edge box-deletes.

const L = 26 // half-window
const SPAN = 100

function makeField() {
  // deterministic scatter forming a couple of "walls" + clutter
  let s = 987654
  const r = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const pts: [number, number][] = []
  for (let x = 4; x < SPAN; x += 3) {
    pts.push([x, 20 + r() * 4]) // top wall
    pts.push([x, 80 + r() * 4]) // bottom wall
  }
  for (let i = 0; i < 60; i++) pts.push([r() * SPAN, 28 + r() * 44]) // clutter
  return pts
}

export function IkdMap() {
  const field = useMemo(makeField, [])
  const [sxPos, setSx] = useState(30)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setSx((x) => (x >= SPAN - 4 ? 4 : x + 1.2)), 90)
    return () => clearInterval(id)
  }, [playing])

  const active = field.filter(([x]) => Math.abs(x - sxPos) <= L)
  const W = 460
  const Hh = 200
  const sc = (v: number, max: number, px: number) => 12 + (v / max) * (px - 24)
  const X = (x: number) => sc(x, SPAN, W)
  const Y = (y: number) => sc(y, 100, Hh)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>ikd-Tree · incremental map with a moving window</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="A sensor moving through a point field; a window around it is the active ikd-Tree map, with points inserted at the leading edge and box-deleted at the trailing edge." className="w-full rounded-md border bg-muted/20">
          {/* window */}
          <rect x={X(sxPos - L)} y={Y(6)} width={X(sxPos + L) - X(sxPos - L)} height={Y(94) - Y(6)} rx="4" fill="oklch(0.72 0.14 195 / 0.08)" stroke="oklch(0.72 0.14 195)" strokeWidth="1" strokeDasharray="3 3" />
          {/* points */}
          {field.map(([x, y], i) => {
            const on = Math.abs(x - sxPos) <= L
            const edgeIns = x > sxPos + L - 4 && x <= sxPos + L
            const edgeDel = x < sxPos - L + 4 && x >= sxPos - L
            return (
              <circle key={i} cx={X(x)} cy={Y(y)} r={on ? 2.4 : 1.6}
                fill={!on ? "var(--muted-foreground)" : edgeIns ? "oklch(0.72 0.15 150)" : edgeDel ? "oklch(0.72 0.15 25)" : "oklch(0.72 0.14 195)"}
                opacity={on ? 1 : 0.2} />
            )
          })}
          {/* sensor */}
          <circle cx={X(sxPos)} cy={Y(50)} r="4" fill="var(--foreground)" />
          <text x={X(sxPos)} y={Y(50) - 7} textAnchor="middle" className="font-mono"fontSize="8" fill="var(--foreground)">sensor</text>
          <text x={X(sxPos + L) - 2} y={Y(10)} textAnchor="end" className="font-mono"fontSize="7" fill="oklch(0.72 0.15 150)">insert →</text>
          <text x={X(sxPos - L) + 2} y={Y(10)} className="font-mono"fontSize="7" fill="oklch(0.72 0.15 25)">← box-delete</text>
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="active map points" value={`${active.length}`} highlight />
          <Stat label="window" value="bounded" />
          <Stat label="query" value="kNN, balanced" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A static k-d tree would have to be rebuilt from scratch every time the map
          changed. The ikd-Tree instead inserts and deletes points <em>in place</em>, does
          voxel downsampling on the tree itself, removes whole regions with one box-wise
          delete as the window slides, and lazily re-balances only the subtrees that get
          lopsided — so a moving robot keeps a bounded, balanced map and the nearest-neighbor
          search in the measurement step stays cheap.
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
