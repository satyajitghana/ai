"use client"

// How much of its bounding box an element actually fills. MEASURED on the
// public Duplex_A_20110907.ifc sample: each element meshed by IfcOpenShell
// 0.9.0 in world coordinates, its volume taken by the divergence theorem over
// the triangles, divided by the volume of its axis-aligned bounding box.
// Furniture is left out: its meshes are not reliably closed, so the volume is
// not trustworthy. A box that size is what debim's importer writes for any
// element it has no specific path for, and a beam becomes a solid BOX profile of
// its flange width and depth (src/debim/importer.py, read at commit 4ffd1f3);
// 1 / fill is then how much material a quantity take-off on that box would
// count, REASONED, for an element whose axes line up with the world's. The
// isometric beam is a sketch drawn to the measured fill ratio.

import { useState } from "react"

type Row = { cls: string; n: number; fill: number }

const ROWS: Row[] = [
  { cls: "IfcStairFlight", n: 2, fill: 0.02 },
  { cls: "IfcBeam", n: 8, fill: 0.107 },
  { cls: "IfcMember", n: 4, fill: 0.159 },
  { cls: "IfcWindow", n: 24, fill: 0.188 },
  { cls: "IfcDoor", n: 14, fill: 0.292 },
  { cls: "IfcRailing", n: 4, fill: 0.507 },
  { cls: "IfcSlab", n: 21, fill: 0.951 },
  { cls: "IfcWall", n: 57, fill: 1.0 },
  { cls: "IfcCovering", n: 13, fill: 1.0 },
  { cls: "IfcFooting", n: 7, fill: 1.0 },
]

// isometric projection with fixed constants (cos 30 = 0.8660, sin 30 = 0.5)
const C = 0.866
const S = 0.5
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * C, (x + y) * S - z]
}
function pts(p: [number, number, number][], ox: number, oy: number): string {
  return p
    .map(([x, y, z]) => {
      const [u, v] = iso(x, y, z)
      return `${(ox + u).toFixed(1)},${(oy + v).toFixed(1)}`
    })
    .join(" ")
}

// An extruded section along x: front face polygon in (y, z), length L.
function Extrusion({ face, L, ox, oy, fill, stroke }: { face: [number, number][]; L: number; ox: number; oy: number; fill: string; stroke: string }) {
  const front = face.map(([y, z]) => [0, y, z] as [number, number, number])
  const back = face.map(([y, z]) => [L, y, z] as [number, number, number])
  const sides = face.map((_, i) => {
    const j = (i + 1) % face.length
    return [front[i], front[j], back[j], back[i]]
  })
  return (
    <g stroke={stroke} strokeWidth={0.8} strokeLinejoin="round">
      {sides.map((q, i) => (
        <polygon key={i} points={pts(q, ox, oy)} fill={fill} fillOpacity={0.35} />
      ))}
      <polygon points={pts(back, ox, oy)} fill={fill} fillOpacity={0.2} />
      <polygon points={pts(front, ox, oy)} fill={fill} fillOpacity={0.75} />
    </g>
  )
}

// I-section 40 wide x 60 deep, sized so its area is 10.7% of the box (2,400):
// flanges 2 x 40 x 2.6 = 208, web 0.89 x 54.8 = 48.8, total 256.8.
const BW = 40
const BD = 60
const TF = 2.6
const TW = 0.89
const ISEC: [number, number][] = [
  [0, 0],
  [BW, 0],
  [BW, TF],
  [BW / 2 + TW / 2, TF],
  [BW / 2 + TW / 2, BD - TF],
  [BW, BD - TF],
  [BW, BD],
  [0, BD],
  [0, BD - TF],
  [BW / 2 - TW / 2, BD - TF],
  [BW / 2 - TW / 2, TF],
  [0, TF],
]
const BOX: [number, number][] = [
  [0, 0],
  [BW, 0],
  [BW, BD],
  [0, BD],
]

export function BoxOverstatement() {
  const [box, setBox] = useState(false)
  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      aria-label="How much of its bounding box each element type fills in the Duplex sample"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>fill ratio · Duplex_A, 154 elements</span>
        <span className="text-muted-foreground/60">measured</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[15rem_1fr] sm:p-5">
        <div>
          <svg viewBox="0 0 240 200" className="w-full rounded-md border bg-background" role="img"
            aria-label={box ? "The beam drawn as debim's solid box profile" : "A wide-flange beam drawn as its I-section"}>
            <Extrusion face={box ? BOX : ISEC} L={150} ox={70} oy={115} fill={box ? "#f59e0b" : "#38bdf8"} stroke="currentColor" />
          </svg>
          <div className="mt-2 flex gap-2 font-mono text-xs">
            <button type="button" onClick={() => setBox(false)} aria-pressed={!box}
              className={"rounded-md border px-2 py-0.5 " + (!box ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>
              IFC: I-section
            </button>
            <button type="button" onClick={() => setBox(true)} aria-pressed={box}
              className={"rounded-md border px-2 py-0.5 " + (box ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>
              debim: BOX
            </button>
          </div>
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            {box
              ? "Same flange width, same depth, solid. A take-off on this counts about 9.3 times the steel."
              : "A W410X60 fills 10.7% of the box around it: two flanges and a web."}
          </p>
        </div>
        <table className="w-full self-start font-mono text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-normal">class</th>
              <th className="text-right font-normal">n</th>
              <th className="w-1/3 text-left font-normal pl-3">median fill</th>
              <th className="text-right font-normal">box / real</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.cls}>
                <td className="py-0.5">{r.cls}</td>
                <td className="text-right">{r.n}</td>
                <td className="pl-3">
                  <div className="relative h-2 rounded bg-muted/40">
                    <div className="absolute inset-y-0 left-0 rounded bg-sky-500/70" style={{ width: `${Math.max(1, r.fill * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{r.fill.toFixed(3)}</span>
                </td>
                <td className="text-right">{r.fill >= 0.995 ? "1x" : `${(1 / r.fill).toFixed(1)}x`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-snug text-muted-foreground sm:px-5">
        Walls, slabs, coverings and footings are boxes already, so a box costs them nothing. Beams, members, windows, doors and
        stairs are where the volume goes wrong. The last column is reasoned (1 / fill) and holds for elements square to the world
        axes; it is a statement about a box, not a run of debim&apos;s QTO.
      </figcaption>
    </figure>
  )
}
