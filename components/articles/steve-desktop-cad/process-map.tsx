"use client"

// The processes behind one Steve build, and which of them a given document kind
// starts. Everything here is READ from the repository at commit b9709ca (file
// paths are given on each node); nothing is measured at run time. The routing
// follows cad_server.py (a document of kind "blender" goes to the Blender
// executor, every other kind to the CAD executor) and local_blender.links()
// (a Blender scene that links a CAD part first builds the part and receives its
// preview.glb).

import { useState } from "react"

import { cn } from "@/lib/utils"

type NodeId = "ui" | "host" | "worker" | "solver" | "blender"
type Kind = "part" | "design" | "blender"

type Info = {
  label: string
  sub: string
  x: number
  y: number
  what: string
  from: string
  licence: string
  where: string
}

const NODES: Record<NodeId, Info> = {
  ui: {
    label: "Viewer and editor",
    sub: "React 19, three 0.186.1",
    x: 20,
    y: 24,
    what: "The CAD interface: sketch tools, feature dialogs, source editor, three.js viewport. 587 TypeScript files, 110,930 lines (counted).",
    from: "Committed in cad-web/, built with Vite, shown inside a Qt WebEngine window.",
    licence: "Repository licence (Apache-2.0); upstream notices retained per docs/UPSTREAM.txt.",
    where: "cad-web/src, docs/UPSTREAM.txt",
  },
  host: {
    label: "Desktop host",
    sub: "PySide6 + FastAPI on loopback",
    x: 20,
    y: 76,
    what: "Starts and cancels the other processes, stores documents, serves the viewer an HTTP API guarded by a random session header, and hosts the Pydantic AI assistant. About 10,000 lines of Python in src/steve_desktop (counted).",
    from: "Committed in src/steve_desktop.",
    licence: "Repository licence (Apache-2.0).",
    where: "src/steve_desktop/cad_server.py, cad_process.py",
  },
  worker: {
    label: "CAD worker",
    sub: "document Python, then OCCT",
    x: 56,
    y: 24,
    what: "A subprocess that runs the document's Python against the vendored steve.Model feature API, which calls a CadQuery fork and, through OCP, the OpenCascade kernel. It returns exact volume, area and a mesh for the viewer.",
    from: "Model API committed in vendor/steve (about 32,000 lines of Python with the rest of vendor/). CadQuery fork pinned at commit 6a8cf4f. cadquery-ocp 8.0.1.1.0 comes from PyPI.",
    licence: "The wrapper wheel's metadata says Apache-2.0. The repository's THIRD-PARTY-LICENSES index (461 files) has no entry naming OCP or OpenCascade.",
    where: "vendor/steve/model.py, src/steve_desktop/cad_kernel.py, requirements.txt",
  },
  solver: {
    label: "Sketch solver",
    sub: "planegcs as WebAssembly",
    x: 56,
    y: 76,
    what: "FreeCAD's 2D constraint solver compiled to WebAssembly and driven over a pipe by a Node process (bridge.mjs). The sketch you constrain is solved here, not in OCCT.",
    from: "Committed: vendor/solver, with 42,848 lines of C++ source and build scripts. A pinned node binary is fetched by tools/fetch_node.py for the Windows build.",
    licence: "LGPL-2.1 or later for planegcs, per vendor/solver/NOTICE, with the notices kept beside the source.",
    where: "vendor/solver/NOTICE, vendor/steve_sketch.py",
  },
  blender: {
    label: "Blender",
    sub: "external, optional, 4.5.x",
    x: 88,
    y: 50,
    what: "A separate blender process started with --background --factory-startup --disable-autoexec --offline-mode, running the repository's blender_run.py. It evaluates the scene, measures it, and renders four views and optionally an MP4 with Cycles on the CPU.",
    from: "Not in the repository. blender_runtime.install() downloads a pinned archive (4.5.9) from download.blender.org and checks its SHA-256; the app can also use a Blender you point it at.",
    licence: "Blender states GPL (2 or later for its source, 3 or later for binaries) on blender.org/about/license. blender_run.py imports bpy and sits in an Apache-2.0 repository.",
    where: "src/steve_desktop/blender_runtime.py, vendor/blender/blender_run.py",
  },
}

const EDGES: [NodeId, NodeId][] = [
  ["ui", "host"],
  ["host", "worker"],
  ["worker", "solver"],
  ["host", "blender"],
  ["worker", "blender"],
]

const KINDS: { id: Kind; label: string; runs: NodeId[]; note: string }[] = [
  {
    id: "part",
    label: "part",
    runs: ["ui", "host", "worker", "solver"],
    note: "A single part. The feature API runs in the CAD worker, sketches go through the solver, no Blender is involved.",
  },
  {
    id: "design",
    label: "design",
    runs: ["ui", "host", "worker", "solver"],
    note: "An assembly of components. Same engines as a part; assembly checks run inside the worker, forking per CPU on POSIX.",
  },
  {
    id: "blender",
    label: "blender scene",
    runs: ["ui", "host", "worker", "blender"],
    note: "Routed to a one-slot Blender executor. A scene that links a CAD part first builds the part and receives it as a glTF file, never as code.",
  },
]

export function ProcessMap() {
  const [kind, setKind] = useState<Kind>("part")
  const [sel, setSel] = useState<NodeId>("blender")
  const k = KINDS.find((x) => x.id === kind)!
  const info = NODES[sel]
  const on = (id: NodeId) => k.runs.includes(id)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what one build starts</span>
        <span className="text-muted-foreground/60">read from the code, commit b9709ca</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">document kind</span>
          {KINDS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={kind === x.id}
              onClick={() => setKind(x.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                kind === x.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{k.note}</p>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox="0 0 640 220" className="w-full min-w-[520px]" role="img">
            <title>
              Five boxes: the viewer and the desktop host on the left, the CAD worker and sketch solver in the middle, Blender on the right.
              The boxes a document of the selected kind starts are drawn solid.
            </title>
            {EDGES.map(([a, b]) => {
              const A = NODES[a]
              const B = NODES[b]
              const live = on(a) && on(b)
              return (
                <line
                  key={a + b}
                  x1={A.x * 6.4}
                  y1={A.y * 2.2}
                  x2={B.x * 6.4}
                  y2={B.y * 2.2}
                  className={live ? "stroke-foreground" : "stroke-muted-foreground/40"}
                  strokeDasharray={live ? undefined : "3 4"}
                />
              )
            })}
            {(Object.keys(NODES) as NodeId[]).map((id) => {
              const n = NODES[id]
              const live = on(id)
              const w = 116
              const h = 46
              return (
                <g key={id} transform={`translate(${n.x * 6.4 - w / 2},${n.y * 2.2 - h / 2})`} className="cursor-pointer" onClick={() => setSel(id)}>
                  <rect
                    width={w}
                    height={h}
                    rx={6}
                    className={cn("fill-background", live ? "stroke-foreground" : "stroke-muted-foreground/40")}
                    strokeWidth={sel === id ? 2.5 : 1}
                    strokeDasharray={live ? undefined : "4 3"}
                  />
                  <text x={w / 2} y={19} textAnchor="middle" fontSize={11} className={live ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}>
                    {n.label}
                  </text>
                  <text x={w / 2} y={34} textAnchor="middle" fontSize={8.5} className="fill-muted-foreground font-mono">
                    {n.sub}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed">
          <div className="text-foreground">{info.label}</div>
          <dl className="mt-1.5 space-y-1.5 text-muted-foreground">
            <div>
              <dt className="inline text-foreground">what: </dt>
              <dd className="inline">{info.what}</dd>
            </div>
            <div>
              <dt className="inline text-foreground">comes from: </dt>
              <dd className="inline">{info.from}</dd>
            </div>
            <div>
              <dt className="inline text-foreground">licence as stated: </dt>
              <dd className="inline">{info.licence}</dd>
            </div>
            <div>
              <dt className="inline text-foreground">look at: </dt>
              <dd className="inline">{info.where}</dd>
            </div>
          </dl>
        </div>
      </div>
    </figure>
  )
}
