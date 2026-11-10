"use client"

// Why a fillet must not remember "edge 15". The L bracket's edges in OpenCascade's explorer order,
// before and after one hole is cut in the plate, upstream of any fillet. The hole touches none of the
// original 18 edges, yet 5 of them get a new index (13->16, 14->17, 15->18, 16->19, 17->20): the hole's
// three edges take 13-15. MEASURED in OpenCascade 8.0 (edges-data.ts says how).
//
// SolidCraft (reported, docs/book/src/dev/naming.md) stores an edge by the faces it separates,
// "<face A>|<face B>", with faces named from kernel history. The face names shown here are my own short
// labels in that spirit, not strings SolidCraft printed.

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { EDGES_HOLE, EDGES_PLAIN, type Edge } from "./edges-data"

const C30 = 0.8660254037844386
const S30 = 0.5
const K = 2.4

function iso(p: [number, number, number]): [number, number] {
  return [(p[0] - p[1]) * C30 * K, ((p[0] + p[1]) * S30 - p[2]) * K]
}

// a face label for a point on the bracket's boundary (plain bracket only; the hole wall is separate)
function faceOf(m: [number, number, number]): string[] {
  const [x, y, z] = m
  const out: string[] = []
  const e = 1e-6
  if (Math.abs(z) < e) out.push("bottom")
  if (Math.abs(y) < e) out.push("front end")
  if (Math.abs(y - 60) < e) out.push("back end")
  if (Math.abs(x) < e) out.push("wall outside")
  if (Math.abs(x - 40) < e) out.push("plate edge")
  if (Math.abs(z - 6) < e && x > 6 - e) out.push("plate top")
  if (Math.abs(x - 6) < e && z > 6 - e) out.push("wall inside")
  if (Math.abs(z - 30) < e) out.push("wall top")
  return out
}

const same = (a: Edge, b: Edge) => a.mid.every((v, i) => Math.abs(v - b.mid[i]) < 1e-6)

export function NamesNotIndices() {
  const [hole, setHole] = useState(false)
  const [stored, setStored] = useState(15)

  const target = EDGES_PLAIN[stored]
  const edges = hole ? EDGES_HOLE : EDGES_PLAIN
  const byIndex = edges[stored]
  const byName = edges.find((e) => same(e, target))
  const moved = useMemo(() => EDGES_PLAIN.filter((e) => EDGES_HOLE.findIndex((h) => same(h, e)) !== e.i).map((e) => e.i), [])

  const box = useMemo(() => {
    const ps = EDGES_HOLE.flatMap((e) => e.pts.map(iso))
    const xs = ps.map((p) => p[0])
    const ys = ps.map((p) => p[1])
    return [Math.min(...xs) - 10, Math.min(...ys) - 10, Math.max(...xs) - Math.min(...xs) + 20, Math.max(...ys) - Math.min(...ys) + 20]
  }, [])

  const path = (e: Edge) => e.pts.map(iso).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("")
  const name = faceOf(target.mid).join(" | ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>a fillet remembers one edge</span>
        <span className="text-muted-foreground/60">OpenCascade explorer order, measured</span>
      </div>
      <div className="grid gap-5 p-4 sm:grid-cols-[1.2fr_1fr] sm:p-5">
        <svg viewBox={box.map((v) => v.toFixed(2)).join(" ")} className="h-60 w-full" role="img" aria-label="L bracket edges; the stored edge and the edge its index now points at are highlighted">
          {edges.map((e) => (
            <path key={e.i} d={path(e)} className="fill-none stroke-foreground/35" strokeWidth={1} />
          ))}
          {byName ? <path d={path(byName)} className="fill-none stroke-emerald-600" strokeWidth={3.2} strokeLinecap="round" /> : null}
          {byIndex && byName && !same(byIndex, byName) ? (
            <path d={path(byIndex)} className="fill-none stroke-rose-600" strokeWidth={3.2} strokeLinecap="round" strokeDasharray="5 3" />
          ) : null}
        </svg>
        <div className="space-y-3 font-mono text-[11px]">
          <div className="flex flex-wrap gap-1.5">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={hole === v}
                onClick={() => setHole(v)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                  hole === v ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {v ? "after: hole cut upstream" : "before: as filleted"}
              </button>
            ))}
          </div>
          <div className="text-muted-foreground">
            edge the fillet was made on:{" "}
            <select
              value={stored}
              onChange={(e) => setStored(Number(e.target.value))}
              className="rounded border bg-background px-1 py-0.5 text-foreground"
              aria-label="Edge index stored by the fillet"
            >
              {EDGES_PLAIN.map((e) => (
                <option key={e.i} value={e.i}>
                  #{e.i}
                  {moved.includes(e.i) ? " (moves)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">stored as an index, #{stored}</div>
            <div className={cn("mt-1", byIndex && byName && !same(byIndex, byName) ? "text-rose-600" : "text-foreground")}>
              {byIndex && byName && !same(byIndex, byName)
                ? `now rounds a different edge, at (${byIndex.mid.join(", ")})`
                : "still the right edge"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">stored as the faces it separates</div>
            <div className="mt-1 text-emerald-700 dark:text-emerald-400">{name}</div>
            <div className="mt-1 text-muted-foreground">
              found again {hole ? `as #${byName?.i ?? "?"}` : `as #${stored}`}, at ({target.mid.join(", ")})
            </div>
          </div>
          <p className="text-muted-foreground">
            The hole touches none of the 18 edges. {moved.length} of them still change index, because the explorer lists the
            hole&apos;s three new edges at #13 to #15 and shifts everything after them.
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Green: the edge the fillet means. Red dashes: what index #{stored} points at after the edit, when that differs.
        Edge lists come from an OpenCascade run; the face labels are mine, in the form SolidCraft&apos;s naming uses.
      </figcaption>
    </figure>
  )
}
