"use client"

import { useState } from "react"

import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The smallest honest B-rep with a hole in it: a 120 x 80 x 40 block with an
// 18-radius bore through the middle. It is a hand-built model of the data
// structure, laid out the way the omniSolid BrepArray schema
// (source/schema/omniSolid/resources/schema.usda) and the SmBrep object graph
// (.agents/skills/smlib-brep-model/references/brep-format.md) describe it, not
// the output of a kernel run. A kernel may, for example, split each circle into
// two arcs; the counting rules below would then give different numbers.
//
// The array sizes in the right-hand panel are computed from the model with the
// schema's own rules: two faceuses per face, loops listed once per face, and
// one BrepArray edgeuse per face-edge incidence (the runtime mate pair is
// collapsed). Euler-Poincare is checked from the same counts.

type V3 = [number, number, number]
type Dir = 1 | -1
type EdgeKind = "line" | "circle"
type Edge = { id: string; kind: EdgeKind; v: [string, string]; note?: string }
type Use = { e: string; d: Dir }
type FaceKind = "plane" | "cylinder"
type Face = { id: string; label: string; kind: FaceKind; visible: boolean; loops: Use[][] }

const L = 120
const D = 80
const H = 40
const CX = 60
const CY = 40
const R = 18

const VERTS: Record<string, V3> = {
  V0: [0, 0, 0], V1: [L, 0, 0], V2: [L, D, 0], V3: [0, D, 0],
  V4: [0, 0, H], V5: [L, 0, H], V6: [L, D, H], V7: [0, D, H],
  Vb: [CX + R, CY, 0], Vt: [CX + R, CY, H],
}

const EDGES: Edge[] = [
  { id: "e0", kind: "line", v: ["V0", "V1"] }, { id: "e1", kind: "line", v: ["V1", "V2"] },
  { id: "e2", kind: "line", v: ["V2", "V3"] }, { id: "e3", kind: "line", v: ["V3", "V0"] },
  { id: "e4", kind: "line", v: ["V4", "V5"] }, { id: "e5", kind: "line", v: ["V5", "V6"] },
  { id: "e6", kind: "line", v: ["V6", "V7"] }, { id: "e7", kind: "line", v: ["V7", "V4"] },
  { id: "e8", kind: "line", v: ["V0", "V4"] }, { id: "e9", kind: "line", v: ["V1", "V5"] },
  { id: "e10", kind: "line", v: ["V2", "V6"] }, { id: "e11", kind: "line", v: ["V3", "V7"] },
  { id: "cb", kind: "circle", v: ["Vb", "Vb"], note: "closed: starts and ends on one vertex" },
  { id: "ct", kind: "circle", v: ["Vt", "Vt"], note: "closed: starts and ends on one vertex" },
  { id: "seam", kind: "line", v: ["Vb", "Vt"], note: "the seam: the bore face uses it twice" },
]

const FACES: Face[] = [
  { id: "top", label: "Top", kind: "plane", visible: true, loops: [
    [{ e: "e4", d: 1 }, { e: "e5", d: 1 }, { e: "e6", d: 1 }, { e: "e7", d: 1 }],
    [{ e: "ct", d: -1 }],
  ] },
  { id: "bottom", label: "Bottom", kind: "plane", visible: false, loops: [
    [{ e: "e3", d: -1 }, { e: "e2", d: -1 }, { e: "e1", d: -1 }, { e: "e0", d: -1 }],
    [{ e: "cb", d: 1 }],
  ] },
  { id: "front", label: "Front", kind: "plane", visible: false, loops: [
    [{ e: "e0", d: 1 }, { e: "e9", d: 1 }, { e: "e4", d: -1 }, { e: "e8", d: -1 }],
  ] },
  { id: "right", label: "Right", kind: "plane", visible: true, loops: [
    [{ e: "e1", d: 1 }, { e: "e10", d: 1 }, { e: "e5", d: -1 }, { e: "e9", d: -1 }],
  ] },
  { id: "back", label: "Back", kind: "plane", visible: true, loops: [
    [{ e: "e2", d: 1 }, { e: "e11", d: 1 }, { e: "e6", d: -1 }, { e: "e10", d: -1 }],
  ] },
  { id: "left", label: "Left", kind: "plane", visible: false, loops: [
    [{ e: "e3", d: 1 }, { e: "e8", d: 1 }, { e: "e7", d: -1 }, { e: "e11", d: -1 }],
  ] },
  { id: "bore", label: "Bore", kind: "cylinder", visible: true, loops: [
    [{ e: "cb", d: -1 }, { e: "seam", d: 1 }, { e: "ct", d: 1 }, { e: "seam", d: -1 }],
  ] },
]

// ---- isometric drawing ----------------------------------------------------
const C30 = 0.8660254037844386
const S30 = 0.5
const K = 1.55
const OX = 150
const OY = 75
const iso = ([x, y, z]: V3): [number, number] => [OX + (x - y) * C30 * K, OY + ((x + y) * S30 - z) * K]
const circlePts = (z: number, n = 48): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * 2 * Math.PI
    return iso([CX + R * mcos(t), CY + R * msin(t), z])
  })
const toPath = (pts: [number, number][], close = false) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") + (close ? " Z" : "")

const facePoly = (f: Face) => {
  const outer = f.loops[0]
  return outer.map((u) => {
    const e = EDGES.find((x) => x.id === u.e)!
    return iso(VERTS[u.d === 1 ? e.v[0] : e.v[1]])
  })
}

const edgeGeom = (e: Edge): [number, number][] => {
  if (e.kind === "circle") return circlePts(e.id === "ct" ? H : 0)
  return [iso(VERTS[e.v[0]]), iso(VERTS[e.v[1]])]
}
const HIDDEN_EDGES = new Set(["e0", "e3", "e8", "cb", "seam"])

// ---- UV drawings (unit box, v up) ------------------------------------------
type UVSeg = { use: Use; pts: [number, number][] }
function uvLoops(f: Face): UVSeg[] {
  const out: UVSeg[] = []
  const rect: [number, number][] = [[0.08, 0.1], [0.92, 0.1], [0.92, 0.9], [0.08, 0.9]]
  if (f.kind === "cylinder") {
    const [cbU, seamU, ctU, seamD] = f.loops[0]
    out.push({ use: cbU, pts: [[0.92, 0.1], [0.08, 0.1]] })
    out.push({ use: seamU, pts: [[0.08, 0.1], [0.08, 0.9]] })
    out.push({ use: ctU, pts: [[0.08, 0.9], [0.92, 0.9]] })
    out.push({ use: seamD, pts: [[0.92, 0.9], [0.92, 0.1]] })
    return out
  }
  f.loops[0].forEach((use, i) => out.push({ use, pts: [rect[i], rect[(i + 1) % 4]] }))
  if (f.loops[1]) {
    const use = f.loops[1][0]
    const n = 40
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * 2 * Math.PI * (use.d === -1 ? -1 : 1)
      return [0.5 + 0.15 * mcos(t), 0.5 + 0.22 * msin(t)] as [number, number]
    })
    out.push({ use, pts })
  }
  return out
}

const UW = 260
const UH = 170
const ux = (u: number) => 10 + u * (UW - 20)
const uy = (v: number) => UH - 10 - v * (UH - 20)

function arrowAt(pts: [number, number][]) {
  const m = Math.floor((pts.length - 1) / 2)
  const a = pts[m]
  const b = pts[Math.min(m + 1, pts.length - 1)]
  const [x0, y0] = [ux(a[0]), uy(a[1])]
  const [x1, y1] = pts.length === 2 ? [ux((a[0] + b[0]) / 2), uy((a[1] + b[1]) / 2)] : [ux(b[0]), uy(b[1])]
  const [bx, by] = pts.length === 2 ? [ux(pts[0][0]), uy(pts[0][1])] : [x0, y0]
  const dx = x1 - bx
  const dy = y1 - by
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = dx / len
  const ny = dy / len
  const tip: [number, number] = [x1, y1]
  const l: [number, number] = [x1 - nx * 9 - ny * 5, y1 - ny * 9 + nx * 5]
  const r: [number, number] = [x1 - nx * 9 + ny * 5, y1 - ny * 9 - nx * 5]
  return `M${l[0].toFixed(1)},${l[1].toFixed(1)} L${tip[0].toFixed(1)},${tip[1].toFixed(1)} L${r[0].toFixed(1)},${r[1].toFixed(1)}`
}

// ---- counts, computed from the model ---------------------------------------
const nV = Object.keys(VERTS).length
const nE = EDGES.length
const nF = FACES.length
const nLoops = FACES.reduce((a, f) => a + f.loops.length, 0)
const nUses = FACES.reduce((a, f) => a + f.loops.reduce((b, l) => b + l.length, 0), 0)
const usesOf = (eid: string) =>
  FACES.flatMap((f) => f.loops.flatMap((l, li) => l.filter((u) => u.e === eid).map((u) => ({ face: f, loop: li, d: u.d }))))
const everyEdgeTwice = EDGES.every((e) => usesOf(e.id).length === 2)
const everyPairOpposite = EDGES.every((e) => {
  const u = usesOf(e.id)
  return u.length === 2 && u[0].d === -u[1].d
})
// Euler-Poincare for one connected solid: V - E + F - (L - F) = 2(S - G)
const genus = 1 - (nV - nE + nF - (nLoops - nF)) / 2

export function TopologyExplorer() {
  const [face, setFace] = useState<string>("bore")
  const [edge, setEdge] = useState<string | null>("seam")
  const f = FACES.find((x) => x.id === face)!
  const segs = uvLoops(f)
  const faceEdges = new Set(f.loops.flat().map((u) => u.e))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">brep → region → shell → face → loop → edge → vertex</span>
        <span className="font-mono text-[10px] text-muted-foreground">a block with a bore, as data</span>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[1.25fr_1fr] sm:p-4">
        <div>
          <svg viewBox="0 0 330 250" className="w-full" role="img" aria-label="Isometric drawing of a rectangular block with a cylindrical hole. The selected face and edge are highlighted.">
            {FACES.filter((x) => x.kind === "plane").map((x) => (
              <path
                key={x.id}
                d={toPath(facePoly(x), true)}
                fill={x.id === face ? "var(--hg-accent, oklch(0.6 0.16 250))" : x.visible ? "currentColor" : "none"}
                fillOpacity={x.id === face ? (x.visible ? 0.45 : 0.18) : x.visible ? 0.06 : 0}
                stroke="none"
                className="cursor-pointer"
                onClick={() => setFace(x.id)}
              />
            ))}
            <path
              d={toPath(circlePts(H), true)}
              fill={face === "bore" ? "var(--hg-accent, oklch(0.6 0.16 250))" : "currentColor"}
              fillOpacity={face === "bore" ? 0.4 : 0.14}
              className="cursor-pointer"
              onClick={() => setFace("bore")}
            />
            {EDGES.map((e) => {
              const on = edge === e.id
              const inFace = faceEdges.has(e.id)
              return (
                <g key={e.id} className="cursor-pointer" onClick={() => setEdge(e.id)}>
                  <path d={toPath(edgeGeom(e))} fill="none" stroke="transparent" strokeWidth={10} />
                  <path
                    d={toPath(edgeGeom(e))}
                    fill="none"
                    stroke={on ? "oklch(0.62 0.2 30)" : "currentColor"}
                    strokeOpacity={on ? 1 : inFace ? 0.85 : 0.45}
                    strokeWidth={on ? 3 : inFace ? 1.8 : 1.1}
                    strokeDasharray={HIDDEN_EDGES.has(e.id) ? "4 3" : undefined}
                  />
                </g>
              )
            })}
            {Object.entries(VERTS).map(([id, p]) => {
              const [x, y] = iso(p)
              return <circle key={id} cx={x} cy={y} r={2.2} className="fill-foreground" opacity={0.7} />
            })}
          </svg>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            click a face in the tree, or an edge in the drawing · dashed = hidden
          </p>
        </div>

        <div className="space-y-2 font-mono text-[11px]">
          <div>
            <div className="text-muted-foreground">Brep</div>
            <div className="ml-2 border-l pl-2">
              <div className="text-muted-foreground">Region 0 · voidRegion (infinite) · 1 shell · 7 faceuses (opposite)</div>
              <div className="text-muted-foreground">Region 1 · solidRegion · 1 shell · 7 faceuses (same)</div>
              <div className="ml-2 mt-1 flex flex-wrap gap-1 border-l pl-2">
                {FACES.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setFace(x.id)}
                    className={cn(
                      "rounded border px-1.5 py-0.5",
                      x.id === face ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border p-2">
            <div>
              {f.label} · {f.kind} · {f.loops.length} loop{f.loops.length > 1 ? "s" : ""}
            </div>
            {f.loops.map((l, li) => (
              <div key={li} className="text-muted-foreground">
                {li === 0 ? "outer" : "inner"}:{" "}
                {l.map((u, k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEdge(u.e)}
                    className={cn("mr-1 underline-offset-2 hover:underline", edge === u.e && "text-foreground")}
                  >
                    {u.e}
                    {u.d === 1 ? "+" : "−"}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {edge && (
            <div className="rounded-md border p-2">
              {(() => {
                const e = EDGES.find((x) => x.id === edge)!
                const uses = usesOf(edge)
                return (
                  <>
                    <div>
                      {e.id} · {e.kind} · {e.v[0]} → {e.v[1]}
                    </div>
                    {e.note && <div className="text-muted-foreground">{e.note}</div>}
                    {uses.map((u, i) => (
                      <div key={i} className="text-muted-foreground">
                        edgeuse {i}: {u.face.label}, {u.loop === 0 ? "outer" : "inner"} loop, {u.d === 1 ? "same" : "opposite"}
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 border-t p-3 sm:grid-cols-2 sm:p-4">
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">
            {f.label} in its own (u, v) parameter space{f.kind === "cylinder" ? " · u = angle, v = height" : ""}
          </div>
          <svg viewBox={`0 0 ${UW} ${UH}`} className="w-full" role="img" aria-label={`The ${f.label} face's trimming loops drawn in parameter space, with arrows showing each edgeuse's direction.`}>
            <rect x={ux(0)} y={uy(1)} width={ux(1) - ux(0)} height={uy(0) - uy(1)} fill="none" stroke="currentColor" strokeOpacity={0.15} />
            {segs.map((s, i) => {
              const on = edge === s.use.e
              return (
                <g key={i} className="cursor-pointer" onClick={() => setEdge(s.use.e)}>
                  <path
                    d={toPath(s.pts.map(([u, v]) => [ux(u), uy(v)] as [number, number]))}
                    fill="none"
                    stroke={on ? "oklch(0.62 0.2 30)" : "var(--hg-accent, oklch(0.6 0.16 250))"}
                    strokeWidth={on ? 3 : 2}
                  />
                  <path d={arrowAt(s.pts)} fill="none" stroke={on ? "oklch(0.62 0.2 30)" : "currentColor"} strokeWidth={1.5} />
                </g>
              )
            })}
            {f.kind === "cylinder" && (
              <>
                <text x={ux(0.08) + 4} y={uy(0.5)} fontSize={9} className="fill-muted-foreground font-mono">seam (u=0)</text>
                <text x={ux(0.92) - 64} y={uy(0.5)} fontSize={9} className="fill-muted-foreground font-mono">seam (u=2π)</text>
              </>
            )}
          </svg>
        </div>

        <div className="font-mono text-[11px]">
          <div className="mb-1 text-[10px] text-muted-foreground">what the BrepArray prim would hold (counted from this model)</div>
          <table className="w-full">
            <tbody>
              {[
                ["region:type", 2],
                ["shell:faceuseCount", 2],
                ["faceuse:faceIndex", 2 * nF],
                ["face:loopCount", nF],
                ["loop:edgeuseCount", nLoops],
                ["edgeuse:edgeIndex", nUses],
                ["edge:curveType", nE],
                ["vertex:pointType", nV],
              ].map(([k, v]) => (
                <tr key={k as string} className="border-b border-border/40">
                  <td className="py-0.5 text-muted-foreground">{k}</td>
                  <td className="py-0.5 text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-muted-foreground">
            every edge used exactly twice: {everyEdgeTwice ? "yes" : "no"} · in opposite directions: {everyPairOpposite ? "yes" : "no"}
          </div>
          <div className="text-muted-foreground">
            Euler–Poincaré: V − E + F − (L − F) = {nV} − {nE} + {nF} − ({nLoops} − {nF}) = {nV - nE + nF - (nLoops - nF)} → genus {genus}
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A hand-built model of the data structure, not a kernel run. The counting rules are the omniSolid BrepArray
        schema&apos;s: two faceuses per face, loops listed once per face, and one edgeuse record per face–edge incidence.
      </figcaption>
    </figure>
  )
}
