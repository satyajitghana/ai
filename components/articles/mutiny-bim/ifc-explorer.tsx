"use client"

// The IFC 4.3 file MutinyBIM wrote for my scanned-room script, as a tree you
// can click. The rows (ifc-data.ts) are generated from the file itself with
// IfcOpenShell 0.9.0; nothing structural is typed by hand. The "kernel had"
// notes compare each entity with the kernel record it came from
// (scan-room.model.json from the same run); they are my reading of the two
// files, and the "missing" toggle lists what a scan-to-BIM handover usually
// expects and this file does not carry. SSR-safe: plain state, no maths.

import { useState } from "react"
import { IFC_COUNTS, IFC_ROWS, IFC_TOTAL, type IfcRow } from "./ifc-data"

const KERNEL_NOTE: Record<string, string> = {
  IfcWall:
    "Kernel record: start, end, thickness 230, height 3000, wallType \"Wall\", classId arch.wall, lateral \"center\". In IFC: a box extruded along the centreline. Thickness survives only as profile YDim; no material layer set, no Pset_WallCommon, no wall-to-wall join.",
  IfcSlab:
    "Kernel record: outline (4 points), thickness 150, top on the level. In IFC: the outline extruded 150 mm down from the storey. No Pset_SlabCommon, no material.",
  IfcDoor:
    "Kernel record: an opening of type door in its host wall, offset 900, width 900, height 2134 (the default when the script gives none: 7 ft). In IFC: OverallWidth 900 and OverallHeight 2134, an IfcOpeningElement voiding the wall and the door filling it.",
  IfcWindow:
    "Kernel record: an opening of type window, width 1500, height 1200, sill 900 by default. In IFC: OverallWidth and OverallHeight, its own opening element, no mark (the script gave none).",
  IfcSpace:
    "Kernel record: a space traced from a seed point, its outline on the walls' inner faces, and the four walls that bound it. In IFC: a name, a long name, NetFloorArea 27.5859 m², four space boundaries with no connection geometry, and no body or footprint of its own.",
  IfcDuctSegment:
    "Kernel record: start and end in 3D, size 406.4 x 200 rect, systemId, links to the elbow, flow 0. In IFC: an extruded rectangle and two ports. The size is in the profile only; no Pset_DuctSegmentTypeCommon, no PredefinedType, no flow.",
  IfcDuctFitting:
    "Kernel record: a 90 degree radius elbow (r/w 1) with two sized ports. In IFC: PredefinedType BEND, two ports, the system assignment, and no body at all.",
  IfcBuildingStorey: "Kernel record: a level named \"Scan L1\" at elevation 0.",
}

const MISSING = [
  "IfcMaterial / IfcMaterialLayerSet on walls and slabs (0 in the file)",
  "Pset_WallCommon, Pset_SlabCommon (IsExternal, LoadBearing, FireRating)",
  "Qto_WallBaseQuantities and other element quantities (the only quantity set is the space's)",
  "IfcRelConnectsPathElements between walls: corners are not joined",
  "IfcSpace body or footprint geometry",
  "Connection geometry on IfcRelSpaceBoundary",
  "Duct size and flow as properties (geometry only)",
  "Any classification reference (0 IfcClassificationReference)",
]

function label(r: IfcRow) {
  const name = r.name && r.name !== "None" ? ` '${r.name}'` : ""
  return `${r.entity}${name}`
}

export function IfcExplorer() {
  const [sel, setSel] = useState(() => IFC_ROWS.findIndex((r) => r.entity === "IfcWall"))
  const [missing, setMissing] = useState(false)
  const row = IFC_ROWS[sel] ?? IFC_ROWS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent" aria-label="IFC 4.3 entity explorer for the exported scanned room">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>scan-room.ifc · IFC4X3_ADD2 · {IFC_TOTAL} entities</span>
        <button
          type="button"
          onClick={() => setMissing((v) => !v)}
          aria-pressed={missing}
          className={"rounded-md border px-2 py-0.5 " + (missing ? "border-foreground bg-foreground text-background" : "hover:text-foreground")}
        >
          what it does not carry
        </button>
      </div>

      <div className="grid gap-0 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <ul className="max-h-[26rem] overflow-y-auto border-b p-2 font-mono text-xs sm:border-b-0 sm:border-r">
          {IFC_ROWS.map((r, i) => (
            <li key={r.step}>
              <button
                type="button"
                onClick={() => {
                  setSel(i)
                  setMissing(false)
                }}
                aria-pressed={i === sel}
                className={
                  "w-full truncate rounded px-1.5 py-1 text-left " +
                  (i === sel && !missing ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
                }
                style={{ paddingLeft: `${0.375 + Math.min(r.depth, 5) * 0.6}rem` }}
              >
                {label(r)}
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 p-4 text-sm">
          {missing ? (
            <div>
              <div className="mb-2 font-semibold">Not in the file</div>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {MISSING.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <div className="mt-4 mb-1 font-semibold">Entity counts</div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {IFC_COUNTS.map(([k, n]) => (
                  <span key={k} className="rounded border px-1.5 py-0.5 text-muted-foreground">
                    {k} {n}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="font-mono text-base font-semibold">{label(row)}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  #{row.step} · GlobalId {row.guid}
                  {row.predefined ? ` · ${row.predefined}` : ""}
                </div>
              </div>

              {KERNEL_NOTE[row.entity] ? <p className="leading-snug text-muted-foreground">{KERNEL_NOTE[row.entity]}</p> : null}

              <Block title="Property sets">
                {Object.keys(row.psets).length === 0 ? (
                  <Muted>none</Muted>
                ) : (
                  Object.entries(row.psets).map(([ps, props]) => (
                    <div key={ps} className="mb-1.5">
                      <div className="font-mono text-xs">{ps}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {Object.entries(props)
                          .map(([k, v]) => `${k} = ${String(v)}`)
                          .join(" · ")}
                      </div>
                    </div>
                  ))
                )}
              </Block>

              <Block title="Body">
                {row.rep.length === 0 ? (
                  <Muted>no representation</Muted>
                ) : (
                  row.rep.map((r, j) => (
                    <div key={j} className="font-mono text-[11px] text-muted-foreground">
                      {r.rep} · {r.item}
                      {r.profile ? ` · ${r.profile}` : ""}
                      {r.xy ? ` ${r.xy[0]} x ${r.xy[1]}` : ""}
                      {r.depth !== undefined ? ` · depth ${r.depth}` : ""}
                    </div>
                  ))
                )}
                {row.bbox ? (
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    world box (mm): [{row.bbox[0].join(", ")}] to [{row.bbox[1].join(", ")}]
                  </div>
                ) : null}
              </Block>

              <Block title="Relations">
                {row.rels.length === 0 ? (
                  <Muted>only its place in the spatial tree</Muted>
                ) : (
                  row.rels.map((r) => (
                    <div key={r} className="font-mono text-[11px] text-muted-foreground">
                      {r}
                    </div>
                  ))
                )}
              </Block>
            </div>
          )}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        Every row is read from the file MutinyBIM exported for the room in this article, with IfcOpenShell. Click an entity for its property sets, body and relations; the toggle lists what a scan-to-BIM handover usually needs and the file lacks.
      </figcaption>
    </figure>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] text-muted-foreground/70">{children}</div>
}
