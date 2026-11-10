"use client"

// Relative volume error of one part (oracle case 24 at its recorded parameters: 60 x 40 x 15 block,
// d10 hole, exact V = 34,821.9028 mm3), on a log scale, for each way of holding the shape.
// MEASURED rows: my OpenCascade 8.0 run (cadquery-ocp 8.0.1.1). STL volumes are the signed-tetrahedron
// sum over the written binary STL; meshing is BRepMesh_IncrementalMesh(linear, angular in rad).
// REPORTED row: SolidCraft's default oracle tolerance (tests/oracle/README.md). Not a SolidCraft run.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

type Row = { id: string; label: string; err: number; kind: "brep" | "mesh" | "gate"; detail: string }

const ROWS: Row[] = [
  { id: "sweep", label: "B-rep, 12 rebuilds", err: 1.6e-16, kind: "brep", detail: "worst of 12 parameter settings, OpenCascade mass properties against the closed form" },
  { id: "step", label: "STEP written, read back", err: 1.25e-15, kind: "brep", detail: "STEP file of 19,030 bytes, 434 entities; the read-back solid measures the same to 1.25e-15" },
  { id: "s1", label: "STL 0.1 mm, 0.5 rad", err: 3.28e-4, kind: "mesh", detail: "120 triangles, 6,084 bytes. The hole becomes a polygon inscribed in the circle, so the mesh holds more material than the part" },
  { id: "s2", label: "STL 0.1 mm, 0.25 rad", err: 8.55e-5, kind: "mesh", detail: "220 triangles, 11,084 bytes" },
  { id: "s3", label: "STL 0.1 mm, 0.1 rad", err: 1.4e-5, kind: "mesh", detail: "520 triangles, 26,084 bytes" },
  { id: "s4", label: "STL 0.01 mm, 0.05 rad", err: 3.5e-6, kind: "mesh", detail: "1,024 triangles, 51,284 bytes" },
  { id: "s5", label: "STL 0.001 mm, 0.01 rad", err: 1.4e-7, kind: "mesh", detail: "5,044 triangles, 252,284 bytes: 13 times the STEP file, still about 9e8 times the B-rep's error" },
  { id: "gate", label: "SolidCraft oracle gate", err: 1e-3, kind: "gate", detail: "the default relative tolerance a reference case must meet on volume and area (reported)" },
]

const LO = -17
const HI = -2

export function ErrorLadder() {
  const [sel, setSel] = useState("s1")
  const pos = (e: number) => ((mlog10(e) - LO) / (HI - LO)) * 100
  const cur = ROWS.find((r) => r.id === sel) ?? ROWS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one part, held five ways</span>
        <span className="text-muted-foreground/60">relative volume error, log scale</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="space-y-1.5">
          {ROWS.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={sel === r.id}
              onClick={() => setSel(r.id)}
              className={cn(
                "grid w-full cursor-pointer grid-cols-[9.5rem_1fr_4.5rem] items-center gap-2 rounded-md px-1.5 py-1 text-left font-mono text-[10.5px] transition-colors sm:grid-cols-[12rem_1fr_5rem]",
                sel === r.id ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-muted/30",
              )}
            >
              <span className="truncate">{r.label}</span>
              <span className="relative h-2.5 rounded-full bg-muted/40">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    r.kind === "brep" && "bg-emerald-600/70",
                    r.kind === "mesh" && "bg-amber-600/70",
                    r.kind === "gate" && "bg-transparent",
                  )}
                  style={{ width: `${pos(r.err).toFixed(2)}%` }}
                />
                {r.kind === "gate" ? (
                  <span className="absolute -inset-y-1 w-0.5 bg-rose-600/80" style={{ left: `${pos(r.err).toFixed(2)}%` }} />
                ) : null}
              </span>
              <span className="text-right">{r.err.toExponential(1)}</span>
            </button>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-[9.5rem_1fr_4.5rem] gap-2 px-1.5 font-mono text-[9px] text-muted-foreground/60 sm:grid-cols-[12rem_1fr_5rem]">
          <span />
          <span className="flex justify-between">
            <span>1e-17</span>
            <span>1e-12</span>
            <span>1e-7</span>
            <span>1e-2</span>
          </span>
          <span />
        </div>
        <p className="mt-3 rounded-lg border p-3 font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground">{cur.label}.</span> {cur.detail}
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Green: exact geometry. Amber: triangle meshes of it. Red line: the tolerance SolidCraft&apos;s reference
        tests apply. Measured in OpenCascade on a CPU; SolidCraft&apos;s own numbers are not in this chart.
      </figcaption>
    </figure>
  )
}
