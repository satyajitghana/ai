"use client"

// The scan-to-threejs pipeline, stage by stage, with who does the work:
// a deterministic script or the app, or the agent's (and finally a person's)
// judgement. Every stage, file and quoted line comes from
// .agents/skills/scan-to-threejs/ (SKILL.md, references/*.md, scripts/*) and
// apps/house-capture/README.md in github.com/wesbos/3d-model-anything at
// 31b2dc9 (MEASURED by reading them). SSR-safe: plain state, no effects.

import { useState } from "react"

type Who = "app" | "script" | "agent"
type Stage = { name: string; who: Who; files: string; does: string; doesNot: string }

const STAGES: Stage[] = [
  {
    name: "Capture",
    who: "app",
    files: "apps/house-capture (Swift, RoomPlan + ARKit)",
    does: "Records RoomPlan walls, openings and furniture boxes, the LiDAR mesh as PLY, posed photos with intrinsics, and 256x192 depth frames, on one AR session. Shoots a photo automatically when the view would turn enough red mesh green.",
    doesNot: "Decide what anything is beyond RoomPlan's sixteen furniture categories. A furniture box is a bound, not a shape.",
  },
  {
    name: "Convert",
    who: "script",
    files: "bundle_to_room.py, house_to_rooms.py",
    does: "Rotates the scan so the dominant walls run along X and Z, puts the floor at y = 0, writes WallDefs with inward normals, openings in wall coordinates, oriented object boxes, and every photo's position, forward, up and vertical field of view.",
    doesNot: "Align separate sessions. Unaligned sessions are reported as blocked, not guessed.",
  },
  {
    name: "Measure",
    who: "script",
    files: "bundle_plan.py, ortho.py, measure_scan.mjs, photos_for.py",
    does: "Draws the plan with photo positions, renders orthographic elevations with a meter grid, histograms ceiling heights, and lists the best photos of any point.",
    doesNot: "Read the outputs. The agent looks at the plan and the photos and writes the numbers down.",
  },
  {
    name: "Model",
    who: "agent",
    files: "demos/<room>/items/*.ts, parts/*.ts",
    does: "Writes TypeScript that builds each object from three.js primitives, lathes, sweeps, tubes and extrusions, with photo crops and CC0 textures, sized from the measured boxes and real product dimensions.",
    doesNot: "Come from a template. The skill gives recipes (cushion, pillow, lathe, sweep) and pitfalls, not furniture.",
  },
  {
    name: "Render the photo's camera",
    who: "script",
    files: "cap.sh, cmp_photo.sh, tools/capture.html?photo=N",
    does: "Puts a three.js camera at photo N's pose with its vertical field of view and aspect, renders the model, and stitches photo and render side by side.",
    doesNot: "Score the pair. In the skill's words, these tools capture and stitch comparisons; they do not evaluate similarity.",
  },
  {
    name: "Compare and fix",
    who: "agent",
    files: "the model's own vision, reading the stitched images",
    does: "Identifies concrete discrepancies, fixes the largest, and renders again.",
    doesNot: "Use a number. There is no image metric, threshold or loss anywhere in the repo.",
  },
  {
    name: "Stop",
    who: "agent",
    files: "BRIEF.md, the integrator",
    does: "Ends when the significant discrepancies are resolved. In the shipped office brief, the integrator performs final visual acceptance.",
    doesNot: "Have a fixed round count or a pass mark. Wes says he judged mostly by eye.",
  },
]

const COLORS: Record<Who, string> = { app: "#3b7dd8", script: "#3f8f4f", agent: "#d9622b" }
const LABEL: Record<Who, string> = { app: "the app", script: "a script", agent: "judgement" }

export function WhoDecides() {
  const [i, setI] = useState(0)
  const s = STAGES[i]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>scan-to-threejs: who does each step</span>
        <span className="text-muted-foreground/70">read from the skill and its scripts</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pipeline stage">
          {STAGES.map((x, k) => {
            const on = k === i
            return (
              <button
                key={x.name}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setI(k)}
                className={
                  "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                  (on ? "text-background" : "bg-background/50 text-muted-foreground hover:text-foreground")
                }
                style={{
                  borderColor: COLORS[x.who],
                  ...(on ? { background: COLORS[x.who] } : {}),
                }}
              >
                {k + 1}. {x.name}
              </button>
            )
          })}
        </div>
        <div className="mt-4 space-y-2 text-sm leading-relaxed">
          <p className="font-mono text-[11px] tracking-wide uppercase" style={{ color: COLORS[s.who] }}>
            done by {LABEL[s.who]} · {s.files}
          </p>
          <p>{s.does}</p>
          <p className="text-muted-foreground">
            <span className="font-mono text-[11px]">does not: </span>
            {s.doesNot}
          </p>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded" aria-hidden>
          {STAGES.map((x, k) => (
            <div key={x.name} className="flex-1" style={{ background: COLORS[x.who], opacity: k === i ? 1 : 0.35 }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 font-mono text-[10.5px] text-muted-foreground">
          {(Object.keys(LABEL) as Who[]).map((w) => (
            <span key={w}>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COLORS[w] }} />
              {LABEL[w]}
            </span>
          ))}
        </div>
      </div>
    </figure>
  )
}
