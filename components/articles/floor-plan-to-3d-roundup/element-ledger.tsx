"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a BIM element needs, where a drawing set carries it, and what each of the four tools in
// the article does with it. The "where" column is general drafting practice. The tool cells are
// the article's evidence and say what kind it is:
//   read      taken from the drawing itself
//   prompt    supplied by a person in the request (Snaptrude's demo prompt)
//   default   a fixed value the tool fills in
//   setting   a value the user sets per storey or per wall type
//   derived   computed from other geometry when needed, not stored
//   guessed   inferred by a model from the picture
//   claimed   the vendor says so; the demo does not show it
//   missing   not stored, or the author says it is not there
//   unknown   no source says either way
// 3d-new-era-ai cells come from its code at commit 81711b4; Snaptrude's from its demo video,
// its site and its help pages; Interior AI's from levelsio's posts and the 3D Space panel in his
// video; the barn tool's from Romain Briaux's video frames and replies.

type Status = "read" | "prompt" | "default" | "setting" | "derived" | "guessed" | "claimed" | "missing" | "unknown"
type Tool = "snaptrude" | "interior" | "barn" | "newera"
type Row = { field: string; ifc: string; where: string; cells: Record<Tool, [Status, string]> }

const TOOLS: { id: Tool; label: string }[] = [
  { id: "snaptrude", label: "Snaptrude Agent" },
  { id: "interior", label: "Interior AI 3D" },
  { id: "barn", label: "the barn tool" },
  { id: "newera", label: "3d-new-era-ai" },
]

const STATUS: Record<Status, { label: string; tone: string }> = {
  read: { label: "read", tone: "oklch(0.6 0.14 150)" },
  setting: { label: "setting", tone: "oklch(0.6 0.12 200)" },
  prompt: { label: "prompt", tone: "oklch(0.6 0.13 255)" },
  derived: { label: "derived", tone: "oklch(0.62 0.1 290)" },
  default: { label: "default", tone: "oklch(0.68 0.14 70)" },
  guessed: { label: "guessed", tone: "oklch(0.64 0.15 45)" },
  claimed: { label: "claimed", tone: "oklch(0.62 0.04 250)" },
  missing: { label: "missing", tone: "oklch(0.6 0.19 25)" },
  unknown: { label: "unknown", tone: "oklch(0.6 0.01 250)" },
}

const TABS: { id: string; label: string; rows: Row[] }[] = [
  {
    id: "wall",
    label: "Wall",
    rows: [
      {
        field: "axis or footprint",
        ifc: "IfcWall geometry",
        where: "plan, exact in a vector DWG; pixels in a scan",
        cells: {
          snaptrude: ["prompt", "the prompt says trace every room from the DWG at true size and shape; result shown only as a render"],
          interior: ["guessed", "its own panel: sizes are estimates unless the plan shows dimensions"],
          barn: ["read", "read from the architect's vector PDF, no AI; author says within about 1 cm"],
          newera: ["read", "traced from dark bands, horizontal and vertical only, or typed by the agent"],
        },
      },
      {
        field: "thickness",
        ifc: "type layer set total",
        where: "plan hatch width",
        cells: {
          snaptrude: ["unknown", "not shown in the demo"],
          interior: ["unknown", "no wall properties exposed"],
          barn: ["setting", "per storey: exterior 39.5 cm, interior 7 cm, override per wall"],
          newera: ["read", "band thickness, kept between 5 and 45 cm"],
        },
      },
      {
        field: "height, top",
        ifc: "extrusion depth, storey",
        where: "sections and elevations, not the plan",
        cells: {
          snaptrude: ["prompt", "storey heights written in the prompt: 3.4 m, 4.0 m"],
          interior: ["unknown", "generated scene; no height input"],
          barn: ["setting", "ceiling height per storey, 240 cm in the demo"],
          newera: ["default", "250 cm (Level::DEFAULT_HEIGHT, the tracer's h)"],
        },
      },
      {
        field: "base storey",
        ifc: "IfcRelContainedInSpatialStructure",
        where: "sheet title: one plan per floor",
        cells: {
          snaptrude: ["prompt", "the prompt orders floor mapping, Lower Ground to Level 7"],
          interior: ["missing", "one floor only"],
          barn: ["setting", "storey tabs: RDC and Étage"],
          newera: ["setting", "Wall.level; none means the lowest storey"],
        },
      },
      {
        field: "type, layers",
        ifc: "IfcWallType, IfcMaterialLayerSet",
        where: "wall-type legend and specification",
        cells: {
          snaptrude: ["claimed", "site: walls with defined types and properties"],
          interior: ["missing", "colours and paint only"],
          barn: ["setting", "build-ups with layers and R-values, quantities and costs"],
          newera: ["setting", "a wall_type id: a name and a thickness, no layers"],
        },
      },
      {
        field: "export as an IFC wall",
        ifc: "IfcWall in a file",
        where: "",
        cells: {
          snaptrude: ["claimed", "site: native IFC 2x3 and IFC 4; not shown in the demo"],
          interior: ["missing", "a Blender-built scene shown in three.js"],
          barn: ["missing", "no export yet, per the author"],
          newera: ["missing", "no IFC; GLB is one node, one mesh"],
        },
      },
    ],
  },
  {
    id: "opening",
    label: "Door / window",
    rows: [
      {
        field: "host wall, position",
        ifc: "IfcRelVoidsElement, IfcRelFillsElement",
        where: "plan symbol in the wall",
        cells: {
          snaptrude: ["claimed", "site lists doors and windows as BIM elements"],
          interior: ["missing", "levelsio: the big sliding windows to the garden are missing"],
          barn: ["read", "doors and windows read from the vector drawing"],
          newera: ["derived", "a piece snapped into a wall; the host is found at render time, arcs get no hole"],
        },
      },
      {
        field: "width",
        ifc: "OverallWidth",
        where: "plan, or the tag",
        cells: {
          snaptrude: ["unknown", "not shown"],
          interior: ["unknown", "not shown"],
          barn: ["read", "shown as width over height, 74/204 for a door"],
          newera: ["setting", "piece width, a catalog size unless set"],
        },
      },
      {
        field: "height, sill",
        ifc: "OverallHeight, placement z",
        where: "schedule or elevation; some plans annotate it",
        cells: {
          snaptrude: ["unknown", "not shown"],
          interior: ["unknown", "not shown"],
          barn: ["read", "French plans write it next to each opening: 100/120, 230/110"],
          newera: ["setting", "piece height and elevation; a catalog default unless set"],
        },
      },
      {
        field: "swing, handing",
        ifc: "OperationType",
        where: "door arc on the plan",
        cells: {
          snaptrude: ["unknown", "not shown"],
          interior: ["missing", "no doors to operate"],
          barn: ["read", "swing arcs drawn in its plan view"],
          newera: ["setting", "hinge_right, leaves, sliding on the opening"],
        },
      },
    ],
  },
  {
    id: "storey",
    label: "Storey",
    rows: [
      {
        field: "how many",
        ifc: "IfcBuildingStorey per level",
        where: "one sheet per floor, and the section",
        cells: {
          snaptrude: ["prompt", "named in the prompt: Lower Ground, Ground, Levels 1 to 7"],
          interior: ["missing", "one floor only"],
          barn: ["setting", "two storey tabs, RDC and Étage"],
          newera: ["setting", "levels tool; tracing one image makes walls on one storey"],
        },
      },
      {
        field: "elevation",
        ifc: "Elevation",
        where: "section, level datums",
        cells: {
          snaptrude: ["prompt", "follows from the heights in the prompt"],
          interior: ["missing", "one floor only"],
          barn: ["unknown", "only ceiling height and slab are shown"],
          newera: ["setting", "Level.elevation, set per storey"],
        },
      },
      {
        field: "slab",
        ifc: "IfcSlab",
        where: "section",
        cells: {
          snaptrude: ["claimed", "site lists slabs"],
          interior: ["missing", "a floor surface"],
          barn: ["setting", "floor slab above: 24 cm in the demo"],
          newera: ["default", "12 cm (Level::DEFAULT_FLOOR_THICKNESS)"],
        },
      },
    ],
  },
  {
    id: "space",
    label: "Room",
    rows: [
      {
        field: "boundary",
        ifc: "IfcSpace",
        where: "enclosed by walls on the plan",
        cells: {
          snaptrude: ["prompt", "the prompt asks to trace every room and tag its department"],
          interior: ["unknown", "rooms are not exposed as objects"],
          barn: ["read", "rooms with areas: Mezzanine 39.48 m²"],
          newera: ["derived", "holes in the union of wall footprints"],
        },
      },
      {
        field: "name, use",
        ifc: "Name, ObjectType",
        where: "room label",
        cells: {
          snaptrude: ["prompt", "department colours given in the prompt"],
          interior: ["unknown", "labels on the plan are an input to the model"],
          barn: ["read", "Chambre 2, Palier, Salle d'eau"],
          newera: ["setting", "room name and use, set by the agent"],
        },
      },
    ],
  },
]

export function ElementLedger() {
  const [tab, setTab] = useState(0)
  const [tool, setTool] = useState<Tool>("newera")
  const rows = TABS[tab].rows
  const tally = rows.reduce<Record<string, number>>((acc, r) => {
    const s = r.cells[tool][0]
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const pill = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">what an element needs, and who supplies it</span>
        <span className="text-muted-foreground/60">evidence per cell, Nov 2026</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t, i) => (
            <button key={t.id} type="button" aria-pressed={tab === i} onClick={() => setTab(i)} className={pill(tab === i)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} className={pill(tool === t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1.5 pr-3 font-normal">field</th>
                <th className="pb-1.5 pr-3 font-normal">where a drawing set has it</th>
                <th className="pb-1.5 font-normal">{TOOLS.find((t) => t.id === tool)?.label}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const [s, note] = r.cells[tool]
                return (
                  <tr key={r.field} className="border-t border-border/60 align-top">
                    <td className="py-1.5 pr-3">
                      <div className="text-foreground">{r.field}</div>
                      <div className="text-[10px] text-muted-foreground/70">{r.ifc}</div>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{r.where || "n/a"}</td>
                    <td className="py-1.5">
                      <span className="mr-1.5 inline-block rounded px-1.5 py-px text-[10px] text-white" style={{ background: STATUS[s].tone }}>
                        {STATUS[s].label}
                      </span>
                      <span className="text-muted-foreground">{note}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(STATUS) as Status[])
            .filter((s) => tally[s])
            .map((s) => (
              <span key={s}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: STATUS[s].tone }} />
                {`${STATUS[s].label} ${tally[s]}`}
              </span>
            ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Rows are the fields an IFC element of that kind carries. A plan sheet carries the first one or two of each well; heights, storeys, types and openings&apos; vertical
        sizes live in sections, elevations, legends and schedules. Read is from the drawing; prompt is from the person; default and claimed are neither.
      </figcaption>
    </figure>
  )
}
