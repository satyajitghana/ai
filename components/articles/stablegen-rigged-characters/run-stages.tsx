"use client"

// StableGen's TRELLIS.2 run as a progress bar. The per-phase start and weight
// numbers are copied from _PHASE_LAYOUTS in stablegen/mesh_gen/trellis2.py at
// f494e5f (READ from the code). They split a progress bar, not wall-clock time:
// the add-on never measures how long a phase takes. Where each stage runs comes
// from installer.py and the workflow code (READ). SSR-safe: plain state.

import { useState } from "react"

type Layout = { phases: string[]; starts: number[]; weights: number[] }

const LAYOUTS: Record<string, Layout> = {
  "txt2img+trellis+rigging+texturing": { phases: ["Preview image", "TRELLIS.2 mesh", "SkinTokens rig", "Texture"], starts: [0, 15, 60, 75], weights: [15, 45, 15, 25] },
  "trellis+rigging+texturing": { phases: ["TRELLIS.2 mesh", "SkinTokens rig", "Texture"], starts: [0, 60, 75], weights: [60, 15, 25] },
  "txt2img+trellis+texturing": { phases: ["Preview image", "TRELLIS.2 mesh", "Texture"], starts: [0, 15, 65], weights: [15, 50, 35] },
  "trellis+texturing": { phases: ["TRELLIS.2 mesh", "Texture"], starts: [0, 65], weights: [65, 35] },
  "txt2img+trellis+rigging": { phases: ["Preview image", "TRELLIS.2 mesh", "SkinTokens rig"], starts: [0, 15, 75], weights: [15, 60, 25] },
  "trellis+rigging": { phases: ["TRELLIS.2 mesh", "SkinTokens rig"], starts: [0, 75], weights: [75, 25] },
  "txt2img+trellis": { phases: ["Preview image", "TRELLIS.2 mesh"], starts: [0, 15], weights: [15, 85] },
  trellis_only: { phases: ["TRELLIS.2 mesh"], starts: [0], weights: [100] },
}

const WHERE: Record<string, string> = {
  "Preview image": "ComfyUI, an image model (SDXL or Qwen Image): GPU",
  "TRELLIS.2 mesh": "ComfyUI node ComfyUI-TRELLIS2: GPU, the heaviest stage",
  "SkinTokens rig": "ComfyUI node StableGenSkinTokensAutoRig, in its own Python environment: GPU",
  Texture: "Blender projects views a diffusion model paints: GPU for the views, Blender for the bake",
}
const COLORS = ["#3b7dd8", "#d9622b", "#3f8f4f", "#8b5fbf"]

export function RunStages() {
  const [img, setImg] = useState(true)
  const [rig, setRig] = useState(true)
  const [tex, setTex] = useState(true)
  const key = [img ? "txt2img" : "", "trellis", rig ? "rigging" : "", tex ? "texturing" : ""].filter(Boolean).join("+")
  const L = LAYOUTS[key === "trellis" ? "trellis_only" : key]
  const toggles: [string, boolean, (v: boolean) => void][] = [
    ["prompt to preview image", img, setImg],
    ["auto-rig", rig, setRig],
    ["texture projection", tex, setTex],
  ]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one run, as the progress bar sees it</span>
        <span className="text-muted-foreground/70">read from _PHASE_LAYOUTS</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {toggles.map(([label, on, set]) => (
            <label key={label} className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs">
              <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">layout key: {L === LAYOUTS.trellis_only ? "trellis_only" : key}</p>
        <div className="mt-2 flex h-9 overflow-hidden rounded" role="img" aria-label="Progress bar split by phase">
          {L.phases.map((p, i) => (
            <div key={p} className="flex items-center justify-center overflow-hidden px-1 font-mono text-[11px] text-white" style={{ width: L.weights[i] + "%", background: COLORS[["Preview image", "TRELLIS.2 mesh", "SkinTokens rig", "Texture"].indexOf(p)] }}>
              {L.weights[i]}
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {L.phases.map((p, i) => (
            <li key={p}>
              <span className="font-mono text-xs">
                {p} · starts at {L.starts[i]}, weight {L.weights[i]}
              </span>
              <span className="block text-muted-foreground">{WHERE[p]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">The weights are shares of a progress bar. The add-on records no timings, so they say nothing about how long each stage takes.</p>
      </div>
    </figure>
  )
}
