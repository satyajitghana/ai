"use client"

import { useState } from "react"

import { Frame, GREEN, Pill, STREAM, T, VIOLET, ACCENT } from "./viz"
import { TOKEN_SIZES } from "./data"

// The loop the posts imply, one step at a time. Tool names are READ from
// LichtFeld Studio's source (src/mcp, src/app/mcp_gui_tools.cpp) and from the
// community Blender server's README and add-on. Whether the author's loop
// really goes through each step is INFERRED: the posts give the setup and the
// conclusions, not the prompts or the tool calls.

type Step = {
  n: number
  title: string
  server: "LichtFeld" | "Blender" | "outside both" | "model"
  tools: string[]
  returns: string
  images: number
  source: "posts" | "inferred"
  risk: string
}

const STEPS: Step[] = [
  {
    n: 1,
    title: "Load the capture and learn its cameras",
    server: "LichtFeld",
    tools: ["scene.load_dataset", "scene.load_checkpoint", "dataset.get_info", "camera.list"],
    returns: "Dataset metadata and the dataset cameras (UID, pose, field of view). A checkpoint loads a trained splat instead of training one.",
    images: 0,
    source: "posts",
    risk: "Units are the SfM frame's: the scale is arbitrary until something known fixes it.",
  },
  {
    n: 2,
    title: "Look at the splat from the capture cameras",
    server: "LichtFeld",
    tools: ["render.capture {camera_index}", "camera.set_view", "camera.go_to_dataset_camera"],
    returns: "A PNG of the splat from a dataset camera's pose and vertical field of view (or from a free eye/target/up), up to 16,384 px a side. Lens cameras are rendered as pinhole.",
    images: 1,
    source: "posts",
    risk: "Floaters, view-dependent colour and holes show up as geometry that is not there.",
  },
  {
    n: 3,
    title: "Look at the original photos",
    server: "outside both",
    tools: ["read the dataset's image files"],
    returns: "The training images themselves. The second post: referencing both the splat and the training images seems best.",
    images: 1,
    source: "posts",
    risk: "Photos and renders differ in exposure and sharpness; the model has to know which one to trust.",
  },
  {
    n: 4,
    title: "Extract what is deterministic",
    server: "outside both",
    tools: ["gaussians.read", "python.point_cloud.access", "a script of your own"],
    returns: "Raw Gaussian means, scales and opacities, or the SfM points; planes, up, scale and boxes fitted by code. The author's idea, not yet shown.",
    images: 0,
    source: "inferred",
    risk: "RANSAC fails past a share of outliers (our toy: 6 to 9 of 12 at 40% floaters).",
  },
  {
    n: 5,
    title: "Build in Blender with Python",
    server: "Blender",
    tools: ["execute_blender_code", "get_scene_info"],
    returns: "Whatever the script prints, and a compact scene listing. Meshes, collections and names are the model's own choice.",
    images: 0,
    source: "posts",
    risk: "The code runs unguarded in your Blender session. A bad script can change or delete your scene.",
  },
  {
    n: 6,
    title: "Compare from the same pose, then edit",
    server: "Blender",
    tools: ["look (viewport / camera / angles)", "get_viewport_screenshot", "render.capture"],
    returns: "A Blender view from a camera moved to the LichtFeld camera's pose, next to the splat render. The model lists differences, edits the script, and loops.",
    images: 2,
    source: "inferred",
    risk: "Pose transfer between the two programs is the fragile part: axes, units and field of view must match.",
  },
]

const SERVER_COLOR = { LichtFeld: STREAM, Blender: GREEN, "outside both": VIOLET, model: ACCENT } as const

export function LoopStepper() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const hd = TOKEN_SIZES.find((t) => t.w === 1920 && t.h === 1080)
  const tok = hd ? hd.high : 0
  return (
    <Frame
      label="the render, compare, refine loop · tool names READ, steps partly INFERRED"
      right={
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((x, k) => (
            <Pill key={x.n} active={k === i} onClick={() => setI(k)}>
              {x.n}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          Image costs use the 1920 x 1080 row of the high-resolution tier ({tok.toLocaleString("en-US")} visual tokens
          per image, the vision docs’ formula, REASONED for this use). Steps marked <b>inferred</b> are what the posts’
          setup and conclusions imply; the author’s actual tool calls are not published.
        </>
      }
    >
      <svg viewBox="0 0 560 70" role="img" className="h-auto w-full">
        <title>Six steps in a row; the current step is highlighted and a return arrow leads from step six to step two.</title>
        {STEPS.map((x, k) => {
          const cx = 40 + k * 96
          return (
            <g key={x.n} onClick={() => setI(k)} className="cursor-pointer">
              {k > 0 ? <line x1={cx - 96 + 14} y1={28} x2={cx - 14} y2={28} className="stroke-border" strokeWidth={1.5} /> : null}
              <circle cx={cx} cy={28} r={13} fill={SERVER_COLOR[x.server]} fillOpacity={k === i ? 0.35 : 0.1} stroke={SERVER_COLOR[x.server]} strokeWidth={k === i ? 2 : 1} />
              <T x={cx} y={32} size={11} anchor="middle" opacity={0.95} weight={600}>
                {x.n}
              </T>
              <T x={cx} y={58} size={7.5} anchor="middle" opacity={0.6}>
                {x.server}
              </T>
            </g>
          )
        })}
        <path d="M 520 44 C 520 66, 150 66, 150 44" fill="none" className="stroke-border" strokeWidth={1.2} strokeDasharray="3 3" />
      </svg>
      <div className="mt-2 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            {s.n}. {s.title}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {s.server} · {s.source === "posts" ? "in the posts" : "inferred"}
            {s.images ? ` · ${s.images} image${s.images > 1 ? "s" : ""} ≈ ${(s.images * tok).toLocaleString("en-US")} tokens` : ""}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.tools.map((t) => (
            <code key={t} className="rounded border bg-background px-1.5 py-0.5 text-[10px] text-foreground">
              {t}
            </code>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">Returns:</b> {s.returns}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">Goes wrong:</b> {s.risk}
        </p>
      </div>
    </Frame>
  )
}
