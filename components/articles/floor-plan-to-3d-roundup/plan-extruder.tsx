"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A floor plan extruded into walls, two ways.
//
// "elements": what a BIM-style editor does with the plan. Each wall is an axis, a thickness
// and a height; each door or window is an element hosted by a wall, with a width, a sill and
// a head, and the wall gets a hole cut where it sits. The plan gives the axes, thicknesses and
// widths. The heights (wall 250 cm, door head 210 cm, window sill 90 cm, slab 12 cm) are not on a
// plan: they are defaults. The 250 and the 12 are 3d-new-era-ai's own (Level::DEFAULT_HEIGHT and
// DEFAULT_FLOOR_THICKNESS in newera-core/src/elements.rs); 210 and 90 are usual values, mine.
//
// "traced": what 3d-new-era-ai's raster tracer (newera-mcp/src/trace.rs) makes of the same plan
// drawn as pixels. Walls are dark bands. A door or window is a gap in the band. Collinear pieces
// whose gap is at most max_gap (default 130 cm) are joined into one wall, so the opening becomes
// solid wall. A wider gap leaves two walls and a void from floor to top with no sill or lintel.
// Either way no door or window element exists afterwards, and every wall gets the tool's h
// (default 250 cm). One image is one storey.
//
// Geometry is axis-aligned boxes in centimetres, drawn in isometric with fixed cos/sin 30°
// constants, so there is no trigonometry at runtime.

type WallId = "N" | "E" | "S" | "W" | "P"
type Kind = "none" | "door" | "window" | "wide"
type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; tone: "wall" | "bridge" | "upper" | "slab" }

const W = 900
const D = 600
const TE = 25
const TP = 12
const DOOR_HEAD = 210
const SILL = 90
const WIN_HEAD = 210
const WIDTH: Record<Kind, number> = { none: 0, door: 90, window: 120, wide: 200 }
const NEXT: Record<Kind, Kind> = { none: "door", door: "window", window: "wide", wide: "none" }
const LABEL: Record<Kind, string> = { none: "no opening", door: "door 90", window: "window 120", wide: "window 200" }
const ORDER: WallId[] = ["N", "E", "S", "W", "P"]

const C30 = 0.8660254
const S30 = 0.5

type WallGeom = { id: WallId; horiz: boolean; fixed: number; from: number; to: number; t: number; at: number }

function walls(px: number, at: Record<WallId, number>): WallGeom[] {
  return [
    { id: "N", horiz: true, fixed: 0, from: -TE / 2, to: W + TE / 2, t: TE, at: at.N },
    { id: "S", horiz: true, fixed: D, from: -TE / 2, to: W + TE / 2, t: TE, at: at.S },
    { id: "W", horiz: false, fixed: 0, from: TE / 2, to: D - TE / 2, t: TE, at: at.W },
    { id: "E", horiz: false, fixed: W, from: TE / 2, to: D - TE / 2, t: TE, at: at.E },
    { id: "P", horiz: false, fixed: px, from: TE / 2, to: D - TE / 2, t: TP, at: at.P },
  ]
}

function box(g: WallGeom, a: number, b: number, z0: number, z1: number, tone: Box["tone"]): Box {
  return g.horiz
    ? { x0: a, x1: b, y0: g.fixed - g.t / 2, y1: g.fixed + g.t / 2, z0, z1, tone }
    : { x0: g.fixed - g.t / 2, x1: g.fixed + g.t / 2, y0: a, y1: b, z0, z1, tone }
}

// before(a, b): a is farther from the viewer (who looks from +x, +y, +z) and is drawn first
function before(a: Box, b: Box): boolean {
  const e = 0.01
  if (a.x1 <= b.x0 + e) return true
  if (b.x1 <= a.x0 + e) return false
  if (a.y1 <= b.y0 + e) return true
  if (b.y1 <= a.y0 + e) return false
  return a.z1 <= b.z0 + e
}

function order(list: Box[]): Box[] {
  const n = list.length
  const indeg = new Array(n).fill(0)
  const out: number[][] = list.map(() => [])
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j && before(list[i], list[j]) && !before(list[j], list[i])) {
        out[i].push(j)
        indeg[j]++
      }
  const res: Box[] = []
  const done = new Array(n).fill(false)
  for (let k = 0; k < n; k++) {
    let pick = -1
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0) { pick = i; break }
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i]) { pick = i; break }
    done[pick] = true
    res.push(list[pick])
    for (const j of out[pick]) indeg[j]--
  }
  return res
}

const FILL: Record<Box["tone"], [string, string, string]> = {
  wall: ["oklch(0.95 0.01 250)", "oklch(0.82 0.02 250)", "oklch(0.72 0.03 250)"],
  upper: ["oklch(0.94 0.03 200)", "oklch(0.8 0.05 200)", "oklch(0.7 0.06 200)"],
  bridge: ["oklch(0.9 0.1 75)", "oklch(0.8 0.13 70)", "oklch(0.7 0.14 65)"],
  slab: ["oklch(0.9 0.01 90)", "oklch(0.78 0.02 90)", "oklch(0.68 0.02 90)"],
}

export function PlanExtruder() {
  const [mode, setMode] = useState<"elements" | "traced">("elements")
  const [px, setPx] = useState(420)
  const [h, setH] = useState(250)
  const [slab, setSlab] = useState(12)
  const [storeys, setStoreys] = useState(2)
  const [gap, setGap] = useState(130)
  const [open, setOpen] = useState<Record<WallId, Kind>>({ N: "wide", E: "window", S: "door", W: "none", P: "door" })

  const at = useMemo<Record<WallId, number>>(() => ({ N: px / 2, S: px + (W - px) / 2, W: D / 2, E: D / 2, P: D * 0.7 }), [px])
  const geoms = useMemo(() => walls(px, at), [px, at])
  const traced = mode === "traced"
  const levels = traced ? 1 : storeys

  const { boxes, stats } = useMemo(() => {
    const list: Box[] = []
    let bridged = 0
    let voids = 0
    let cut = 0
    for (let lv = 0; lv < levels; lv++) {
      const base = lv * (h + slab)
      const tone: Box["tone"] = lv === 0 ? "wall" : "upper"
      if (lv > 0) list.push({ x0: -TE / 2, x1: W + TE / 2, y0: -TE / 2, y1: D + TE / 2, z0: base - slab, z1: base, tone: "slab" })
      for (const g of geoms) {
        const k = open[g.id]
        const w = WIDTH[k]
        if (k === "none") {
          list.push(box(g, g.from, g.to, base, base + h, tone))
          continue
        }
        const a = Math.max(g.from, g.at - w / 2)
        const b = Math.min(g.to, g.at + w / 2)
        if (traced) {
          if (w <= gap) {
            bridged++
            list.push(box(g, g.from, a, base, base + h, tone))
            list.push(box(g, a, b, base, base + h, "bridge"))
            list.push(box(g, b, g.to, base, base + h, tone))
          } else {
            voids++
            list.push(box(g, g.from, a, base, base + h, tone))
            list.push(box(g, b, g.to, base, base + h, tone))
          }
          continue
        }
        cut++
        const sill = k === "door" ? 0 : SILL
        const head = Math.min(h, k === "door" ? DOOR_HEAD : WIN_HEAD)
        list.push(box(g, g.from, a, base, base + h, tone))
        list.push(box(g, b, g.to, base, base + h, tone))
        if (sill > 0) list.push(box(g, a, b, base, base + sill, tone))
        if (head < h) list.push(box(g, a, b, base + head, base + h, tone))
      }
    }
    return { boxes: order(list), stats: { bridged, voids, cut } }
  }, [geoms, open, h, slab, levels, traced, gap])

  // isometric fit: the footprint is 925 x 625 cm, the height up to two storeys
  const k = 0.3
  const ox = 230
  const topZ = levels * h + (levels - 1) * slab
  const oy = 30 + topZ * k
  const P = (x: number, y: number, z: number) => `${(ox + (x - y) * C30 * k).toFixed(1)},${(oy + (x + y) * S30 * k - z * k).toFixed(1)}`
  const isoH = Math.ceil(oy + (W + D + TE) * S30 * k + 12)

  // plan view
  const ps = 0.36
  const pox = 20
  const poy = 20
  const X = (x: number) => pox + x * ps
  const Y = (y: number) => poy + y * ps

  const counts = ORDER.filter((id) => open[id] !== "none")
  const doors = counts.filter((id) => open[id] === "door").length
  const wins = counts.length - doors

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">plan to 3D: elements vs a traced raster</span>
        <span className="text-muted-foreground/60">click a wall in the plan to change its opening</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["elements", "walls and openings as elements"],
              ["traced", "walls traced from pixels (trace.rs)"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          {!traced &&
            [1, 2].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={storeys === n}
                onClick={() => setStoreys(n)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  storeys === n ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {n === 1 ? "one storey" : "two storeys"}
              </button>
            ))}
        </div>

        <div className="mt-3 grid gap-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
          <label className="block">
            <span className="flex justify-between">
              <span>partition axis x</span>
              <span className="text-foreground">{px} cm</span>
            </span>
            <Range aria-label="Partition position in centimetres" min={300} max={600} step={10} value={px} onChange={(e) => setPx(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex justify-between">
              <span>{traced ? "h (wall height)" : "storey height"}</span>
              <span className="text-foreground">{h} cm</span>
            </span>
            <Range aria-label="Wall height in centimetres" min={220} max={350} step={10} value={h} onChange={(e) => setH(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          {traced ? (
            <label className="block">
              <span className="flex justify-between">
                <span>max_gap</span>
                <span className="text-foreground">{gap} cm</span>
              </span>
              <Range aria-label="Largest gap the tracer bridges, in centimetres" min={0} max={250} step={10} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="mt-1 w-full" />
            </label>
          ) : (
            <label className="block">
              <span className="flex justify-between">
                <span>slab</span>
                <span className="text-foreground">{slab} cm</span>
              </span>
              <Range aria-label="Slab thickness in centimetres" min={0} max={30} step={2} value={slab} onChange={(e) => setSlab(Number(e.target.value))} className="mt-1 w-full" />
            </label>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <svg viewBox="0 0 370 270" className="w-full" role="img" aria-label="The floor plan, top view. Click a wall to cycle its opening.">
            <rect x={X(-TE / 2)} y={Y(-TE / 2)} width={(W + TE) * ps} height={(D + TE) * ps} className="fill-muted/30" />
            {geoms.map((g) => {
              const k2 = open[g.id]
              const w = WIDTH[k2]
              const a = Math.max(g.from, g.at - w / 2)
              const b = Math.min(g.to, g.at + w / 2)
              const pieces: [number, number, string][] = []
              if (k2 === "none") pieces.push([g.from, g.to, "solid"])
              else {
                pieces.push([g.from, a, "solid"], [b, g.to, "solid"])
                if (traced && w <= gap) pieces.push([a, b, "bridge"])
              }
              const rect = (s0: number, s1: number) =>
                g.horiz
                  ? { x: X(s0), y: Y(g.fixed - g.t / 2), width: (s1 - s0) * ps, height: g.t * ps }
                  : { x: X(g.fixed - g.t / 2), y: Y(s0), width: g.t * ps, height: (s1 - s0) * ps }
              const hit = g.horiz
                ? { x: X(g.from), y: Y(g.fixed) - 9, width: (g.to - g.from) * ps, height: 18 }
                : { x: X(g.fixed) - 9, y: Y(g.from), width: 18, height: (g.to - g.from) * ps }
              // symbols for an opening, in plan
              let symbol = null
              if (k2 !== "none" && !(traced && w <= gap)) {
                if (traced) {
                  const r = rect(a, b)
                  symbol = <rect {...r} fill="none" stroke="oklch(0.6 0.2 25)" strokeDasharray="2 2" strokeWidth={1} />
                } else if (k2 === "door") {
                  const r = w * ps
                  const hx = g.horiz ? X(a) : X(g.fixed)
                  const hy = g.horiz ? Y(g.fixed) : Y(a)
                  const d = g.horiz
                    ? `M${hx},${hy} L${hx},${hy + r} A${r},${r} 0 0 0 ${hx + r},${hy}`
                    : `M${hx},${hy} L${hx + r},${hy} A${r},${r} 0 0 1 ${hx},${hy + r}`
                  symbol = <path d={d} fill="none" className="stroke-foreground/60" strokeWidth={0.8} />
                } else {
                  const r = rect(a, b)
                  symbol = (
                    <g className="stroke-foreground/70" strokeWidth={0.8}>
                      <rect {...r} fill="none" />
                      {g.horiz ? (
                        <line x1={r.x} x2={r.x + r.width} y1={r.y + r.height / 2} y2={r.y + r.height / 2} />
                      ) : (
                        <line y1={r.y} y2={r.y + r.height} x1={r.x + r.width / 2} x2={r.x + r.width / 2} />
                      )}
                    </g>
                  )
                }
              }
              return (
                <g key={g.id}>
                  {pieces.map(([s0, s1, kind], i) => (
                    <rect key={i} {...rect(s0, s1)} fill={kind === "bridge" ? "oklch(0.8 0.13 70)" : undefined} className={kind === "bridge" ? undefined : "fill-foreground/80"} />
                  ))}
                  {symbol}
                  <rect
                    {...hit}
                    fill="transparent"
                    className="cursor-pointer hover:fill-foreground/10"
                    role="button"
                    tabIndex={0}
                    aria-label={`Wall ${g.id}: ${LABEL[k2]}. Activate to change.`}
                    onClick={() => setOpen((o) => ({ ...o, [g.id]: NEXT[o[g.id]] }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setOpen((o) => ({ ...o, [g.id]: NEXT[o[g.id]] }))
                      }
                    }}
                  />
                </g>
              )
            })}
            <text x={X(W / 2)} y={Y(D) + 26} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
              {`900 x 600 cm axes · exterior 25 · partition 12`}
            </text>
          </svg>

          <svg viewBox={`0 0 520 ${isoH}`} className="w-full" role="img" aria-label="The same plan extruded into walls in isometric view">
            <polygon points={[P(-TE / 2, -TE / 2, 0), P(W + TE / 2, -TE / 2, 0), P(W + TE / 2, D + TE / 2, 0), P(-TE / 2, D + TE / 2, 0)].join(" ")} className="fill-muted/40" />
            {boxes.map((b, i) => {
              const [top, sx, sy] = FILL[b.tone]
              return (
                <g key={i} stroke="oklch(0.35 0.02 250 / 0.55)" strokeWidth={0.5} strokeLinejoin="round">
                  <polygon points={[P(b.x1, b.y0, b.z0), P(b.x1, b.y1, b.z0), P(b.x1, b.y1, b.z1), P(b.x1, b.y0, b.z1)].join(" ")} fill={sx} />
                  <polygon points={[P(b.x0, b.y1, b.z0), P(b.x1, b.y1, b.z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)].join(" ")} fill={sy} />
                  <polygon points={[P(b.x0, b.y0, b.z1), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)].join(" ")} fill={top} />
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-3 grid gap-2 font-mono text-[11px] leading-relaxed sm:grid-cols-2">
          <div className="rounded-md border border-border/60 p-2.5">
            <div className="mb-1 text-foreground">from the plan</div>
            {traced ? (
              <div className="text-muted-foreground">
                {`5 dark bands as wall axes and thicknesses (25, 12). Gaps in the bands: ${counts.length}. Nothing else: a raster plan has no door or window objects, only breaks in the ink.`}
              </div>
            ) : (
              <div className="text-muted-foreground">
                {`5 wall axes and thicknesses, ${doors} door${doors === 1 ? "" : "s"} and ${wins} window${wins === 1 ? "" : "s"}, each with a host wall, a position and a width.`}
              </div>
            )}
          </div>
          <div className="rounded-md border border-border/60 p-2.5">
            <div className="mb-1 text-foreground">{traced ? "what the tracer made of it" : "defaults, not on the plan"}</div>
            {traced ? (
              <div className="text-muted-foreground">
                <span style={{ color: "oklch(0.7 0.14 65)" }}>{`${stats.bridged} bridged`}</span>
                {` (gap ≤ ${gap} cm, now solid wall) · `}
                <span style={{ color: "oklch(0.6 0.2 25)" }}>{`${stats.voids} full-height void${stats.voids === 1 ? "" : "s"}`}</span>
                {` (gap > ${gap} cm, two walls, no sill or lintel). 0 openings survive as elements. Every wall gets h = ${h} cm. One image, one storey.`}
              </div>
            ) : (
              <div className="text-muted-foreground">
                {`storey height ${h} · slab ${slab} · door head ${DOOR_HEAD} · window sill ${SILL}, head ${WIN_HEAD} · storey ${levels > 1 ? "elevations " + 0 + " and " + (h + slab) : "elevation 0"}. ${stats.cut} hole${stats.cut === 1 ? "" : "s"} cut per storey.`}
              </div>
            )}
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A toy two-room plan. In element mode the openings are objects and the heights are defaults, which is what every plan-only tool has to do. In traced mode the
        same plan goes through the rule in 3d-new-era-ai&apos;s <code>trace.rs</code>: an opening no wider than <code>max_gap</code> becomes wall (amber), a wider one leaves a hole from floor to top.
      </figcaption>
    </figure>
  )
}
