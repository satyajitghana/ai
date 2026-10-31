"use client"

import { useState } from "react"

// The arithmetic of the compute -> indirect-draw chain, with the constants read from
// examples/jsm/pipelines/MeshletDrawingPipeline.js and MeshletGeometryUtils.js at cb0a902:
//   MESHLET_SIZE = 64, WORKGROUP_SIZE = 64, MAX_WORKGROUPS = 65535, draw args [192, visible, 0, 0].
// The levels use the NOMINAL triangle ratios of LOD_TARGETS (1, .55, .25, .1, .04, .015) on the demo teapot
// (6,320 triangles, 129,600 instances: counted by running TeapotGeometry(1, 10)). The simplifier may stop
// short of a target, so real counts per level differ. REASONED, not measured on a GPU.

const SIZE = 64
const WG = 64
const MAXWG = 65535
const TEAPOT_TRIS = 6320
const RATIOS = [1, 0.55, 0.25, 0.1, 0.04, 0.015]
const INSTANCES = 129600

const fmt = (x: number) => Math.round(x).toLocaleString("en-US")

export function DrawArgs() {
  const [level, setLevel] = useState(0)
  const [inView, setInView] = useState(0.35)
  const [facing, setFacing] = useState(0.5)

  const tris = Math.floor(TEAPOT_TRIS * RATIOS[level])
  const clustersPerObject = Math.ceil(tris / SIZE)
  const objects = Math.round(INSTANCES * inView)
  const entering = objects * clustersPerObject
  const workgroups = Math.ceil(entering / WG)
  const rows = Math.ceil(workgroups / MAXWG)
  const queued = Math.round(entering * facing)
  const vertices = queued * SIZE * 3
  const drawn = queued * SIZE

  const stages = [
    ["1  cull objects", `${fmt(INSTANCES)} threads, 64 per group: sphere vs 6 planes, pick a level, atomicAdd the cluster count`],
    ["2  write dispatch", `1 thread: groups = ceil(${fmt(entering)} / ${WG}) = ${fmt(workgroups)}, as ${Math.min(workgroups, MAXWG)} x ${rows} x 1`],
    ["3  cull clusters", `${fmt(entering)} threads: cone, then frustum; survivors go to a queue by atomicAdd`],
    ["4  write draw args", `1 thread per queue: [${SIZE * 3}, ${fmt(queued)}, 0, 0]`],
    ["5  draw indirect", `${fmt(queued)} instances x ${SIZE * 3} vertices = ${fmt(vertices)} vertex invocations`],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>reasoned from the source · demo scene constants</span>
        <span className="text-muted-foreground/60">no GPU was run</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_15rem] sm:p-5">
        <ol className="space-y-2">
          {stages.map(([h, t]) => (
            <li key={h} className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="font-mono text-xs font-semibold">{h}</div>
              <div className="font-mono text-xs text-muted-foreground">{t}</div>
            </li>
          ))}
        </ol>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">selected level: {level} ({fmt(tris)} tris, {clustersPerObject} clusters)</span>
            <input type="range" min={0} max={5} step={1} value={level} onChange={(e) => setLevel(+e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">objects in view: {(inView * 100).toFixed(0)}%</span>
            <input type="range" min={0.01} max={1} step={0.01} value={inView} onChange={(e) => setInView(+e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">clusters surviving the cone: {(facing * 100).toFixed(0)}%</span>
            <input type="range" min={0.05} max={1} step={0.01} value={facing} onChange={(e) => setFacing(+e.target.value)} className="w-full" />
          </label>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">triangles drawn</dt>
            <dd>{fmt(drawn)}</dd>
            <dt className="text-muted-foreground">of full LOD 0</dt>
            <dd>{fmt(INSTANCES * TEAPOT_TRIS)}</dd>
          </dl>
        </div>
      </div>
    </figure>
  )
}
