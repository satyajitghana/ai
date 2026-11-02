"use client"

import { useState } from "react"

import { Frame, GREEN, Pill, STREAM } from "./viz"
import { LFS_CONCRETE_NAMES, LFS_GROUPS } from "./data"

// What each side exposes. LichtFeld: tool names extracted by script from every
// file that registers tools (src/mcp, src/app/mcp_*.cpp, the Python bridge) at
// commit 8a9f5ef: MEASURED counts, READ schemas. Blender: the community server's
// README table (nine tools) and the add-on's always-on command table (21).

const USED: Record<string, string[]> = {
  scene: ["scene.load_dataset", "scene.load_checkpoint", "scene.list_nodes", "scene.save_ply", "scene.generate_collision", "scene.export_collision"],
  camera: ["camera.list", "camera.get", "camera.set_view", "camera.go_to_dataset_camera"],
  render: ["render.capture", "render.capture_window"],
  dataset: ["dataset.get_info"],
  gaussians: ["gaussians.read"],
  selection: ["selection.by_description"],
}

const NOTES: Record<string, string> = {
  "render.capture":
    "Camera UID optional: omit it for the live viewport, pass it for that dataset camera's pose and vertical field of view. Width and height up to 16,384 (nearest-neighbour resize). Returns a base64 PNG, delivered to the model as an image.",
  "camera.set_view": "eye, target, optional up and fov_degrees: a free viewpoint, not only the capture cameras.",
  "gaussians.read": "Raw means, scales, rotations, opacities, sh0 and shN for a node; indices or the first N rows (default 256).",
  "scene.generate_collision": "Voxelizes one selected splat into a collision node (voxel_size 0.05 and opacity 0.1 by default): a coarse solid the model can read back.",
  "selection.by_description": "Selects Gaussians by a natural-language description using an LLM with vision. It needs ANTHROPIC_API_KEY or OPENAI_API_KEY in the app's environment.",
  "dataset.get_info": "Metadata of the loaded dataset or training scene.",
  "camera.list": "Dataset camera nodes in the scene, with their UIDs: what render.capture's camera_index refers to.",
  "scene.load_dataset": "A COLMAP dataset directory, with options for the strategy and iteration count: this app trains the splat.",
}

const BLENDER_COMMUNITY = [
  ["execute_blender_code", "Python in the live Blender session"],
  ["look", "viewport, camera, multi-angle sheet or animation frames; solid, material, rendered, wireframe or xray"],
  ["get_scene_info", "one line per object, with the fields you pick"],
  ["generate_3d", "Tripo, Hunyuan3D, Hyper3D Rodin or Meshy"],
  ["search_assets / import_asset", "Poly Haven, Sketchfab, Poly Pizza"],
  ["get_addon_status", "versions and enabled integrations"],
  ["disable_telemetry, record_trajectory_feedback", "data-collection controls (collection is opt-in)"],
] as const

export function ToolSurface() {
  const [onlyUsed, setOnlyUsed] = useState(false)
  const [sel, setSel] = useState<string | null>("render")
  const rows = LFS_GROUPS.filter(([g]) => !onlyUsed || USED[g])
  const max = Math.max(...LFS_GROUPS.map(([, n]) => n))
  const detail = sel ? USED[sel] : undefined
  return (
    <Frame
      label={`LichtFeld Studio: ${LFS_CONCRETE_NAMES} tool names in ${LFS_GROUPS.length} groups · MEASURED by script`}
      right={
        <div className="flex gap-1.5">
          <Pill active={!onlyUsed} onClick={() => setOnlyUsed(false)}>
            all groups
          </Pill>
          <Pill active={onlyUsed} onClick={() => setOnlyUsed(true)}>
            used by this workflow
          </Pill>
        </div>
      }
      note={
        <>
          The count is of names found by a script in the files that register tools, plus two dynamic prefixes (
          <code>editor.</code>, <code>shader.</code>) that are not single tools; a few more tools register from other
          files. The ten or so a modelling loop needs sit in six groups. Which of them the author calls is not
          published: this is the set that fits the posts.
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div>
          <ul className="space-y-1" aria-label="LichtFeld Studio tool groups">
            {rows.map(([g, n]) => {
              const used = Boolean(USED[g])
              return (
                <li key={g}>
                  <button
                    type="button"
                    onClick={() => setSel(g)}
                    aria-pressed={sel === g}
                    className={
                      "flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-left transition-colors " +
                      (sel === g ? "bg-muted/50" : "hover:bg-muted/30")
                    }
                  >
                    <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">{g}</span>
                    <span className="relative h-3 flex-1 rounded-sm bg-muted/30">
                      <span
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{ width: `${(n / max) * 100}%`, background: used ? STREAM : "currentColor", opacity: used ? 0.75 : 0.22 }}
                      />
                    </span>
                    <span className="w-6 text-right font-mono text-[10px] text-foreground">{n}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {detail ? (
            <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
              <div className="font-mono text-[10px] text-foreground">{sel}.*</div>
              <ul className="mt-2 space-y-2">
                {detail.map((t) => (
                  <li key={t}>
                    <code className="rounded border bg-background px-1 py-0.5 text-[10px] text-foreground">{t}</code>
                    {NOTES[t] ? <span className="ml-1.5">{NOTES[t]}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : sel ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No tool in this group is needed for the loop described in the posts.
            </p>
          ) : null}
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">
            Blender (community server): nine tools, 21 always-on add-on commands
          </div>
          <ul className="space-y-1.5">
            {BLENDER_COMMUNITY.map(([t, d]) => (
              <li key={t} className="rounded border bg-background/60 px-2 py-1.5">
                <code className="text-[10px] text-foreground" style={{ color: GREEN }}>
                  {t}
                </code>
                <div className="text-[10px] leading-snug text-muted-foreground">{d}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  )
}
