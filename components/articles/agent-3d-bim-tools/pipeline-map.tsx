"use client"

// Where each tool in this roundup sits on a capture → model → BIM pipeline,
// what it takes in, what it hands on, and how an agent drives it. Every format
// and interface below was read from the tool's own repository or docs on
// 12 Nov 2026 (see the article for the file each comes from). Nothing here was
// run. SSR-safe: plain state.

import { useState } from "react"

type Tool = {
  id: string
  name: string
  stage: number
  input: string
  output: string
  agent: string
  licence: string
}

const STAGES = ["Capture", "Reconstruct", "Model", "BIM / IFC", "Ship and review"]

const TOOLS: Tool[] = [
  {
    id: "pascal-capture",
    name: "Pascal capture",
    stage: 0,
    input: "phone session: ARKit trajectory, XYZ or PLY points, a surface mesh, a USDZ room model",
    output: "a scan node; the viewer's CaptureRuntime draws it as reference layers",
    agent: "hosted MCP only (list_captures, get_capture, open_capture_as_project)",
    licence: "MIT (editor); capture service hosted",
  },
  {
    id: "kotohibi",
    name: "360 camera → Metashape",
    stage: 1,
    input: "360 video, cubemap frames",
    output: "dense.ply point cloud + COLMAP cubemaps",
    agent: "none: a person runs the photogrammetry",
    licence: "proprietary tools",
  },
  {
    id: "ogc3dtiles",
    name: "blender_ogc3dtiles",
    stage: 1,
    input: "3D Tiles: b3dm/glb meshes, pnts points, KHR_gaussian_splatting",
    output: "streamed tiles as Blender meshes, points or native 5.3 splats",
    agent: "Blender Python; stream_tick() runs headless under blender -b",
    licence: "MIT",
  },
  {
    id: "blender-claude",
    name: "Claude + Blender MCP",
    stage: 2,
    input: "dense.ply + cubemap images",
    output: "a procedural Blender scene",
    agent: "MCP into Blender; the agent writes bpy",
    licence: "GPL Blender; MCP server unnamed",
  },
  {
    id: "pascal",
    name: "Pascal Editor",
    stage: 2,
    input: ".glb/.gltf scan or an image as reference; IFC import",
    output: "scene graph JSON, GLB; IFC4 from the editor",
    agent: "MCP: 53 tools in the README table, plus scene and project tools",
    licence: "MIT",
  },
  {
    id: "viz3d",
    name: "viz3d build-house-from-plan",
    stage: 2,
    input: "plan sheets read into plan.json",
    output: "Blender Cycles house, unit and fit reports",
    agent: "skill: Python checks + Blender scripts",
    licence: "MIT",
  },
  {
    id: "mutiny",
    name: "MutinyBIM",
    stage: 3,
    input: "linked IFC, PDF/image/DXF/DWG underlays",
    output: "IFC4X3_ADD2, PDF sheets, schedules",
    agent: "MCP (9 core tools) running scripts; CLI; sync protocol",
    licence: "Apache-2.0",
  },
  {
    id: "gltf",
    name: "glTF-Transform",
    stage: 4,
    input: "glTF / GLB",
    output: "smaller glTF: Draco or Meshopt, KTX2/WebP/AVIF textures",
    agent: "CLI (39 commands) or the TypeScript API",
    licence: "MIT",
  },
  {
    id: "vork",
    name: "vork",
    stage: 4,
    input: "scene JSON (glTF assets), Slang programs",
    output: "PNG/EXR frames, MP4/MOV, GLB export",
    agent: "CLI: vork help, vork render, look, edit",
    licence: "source-available preview",
  },
  {
    id: "diorama",
    name: "ha-diorama",
    stage: 4,
    input: "card YAML: floors, room polygons in metres, entities",
    output: "a clickable 3D home in Home Assistant",
    agent: "write the YAML; no MCP",
    licence: "MIT",
  },
  {
    id: "mapbox",
    name: "Mapbox GL JS",
    stage: 4,
    input: "vector tiles, GeoJSON, terrain, glTF and tiled 3D models",
    output: "a WebGL map",
    agent: "code; Mapbox's own MCP server (MIT) for its APIs",
    licence: "Mapbox TOS (not open since v2)",
  },
]

export function PipelineMap() {
  const [sel, setSel] = useState("mutiny")
  const t = TOOLS.find((x) => x.id === sel) ?? TOOLS[0]
  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      aria-label="Pipeline map of the tools in this roundup"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>capture → model → BIM, and who drives each step</span>
        <span className="text-muted-foreground/60">read from source</span>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-5 sm:p-5">
        {STAGES.map((s, i) => (
          <div key={s} className="rounded-lg border p-2">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {i + 1}. {s}
            </div>
            <div className="flex flex-col gap-1.5">
              {TOOLS.filter((x) => x.stage === i).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setSel(x.id)}
                  aria-pressed={sel === x.id}
                  className={
                    "rounded-md border px-2 py-1 text-left text-xs " +
                    (sel === x.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted/50")
                  }
                >
                  {x.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 border-t p-4 text-sm sm:grid-cols-2 sm:p-5" aria-live="polite">
        <Field k="takes" v={t.input} />
        <Field k="hands on" v={t.output} />
        <Field k="how an agent drives it" v={t.agent} />
        <Field k="licence" v={t.licence} />
      </div>
    </figure>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div>{v}</div>
    </div>
  )
}
