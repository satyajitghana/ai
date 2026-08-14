"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Which model does what, and what the paper says happens when you swap it.
//
// The roster is from Implementation Details; the failure notes are quoted or
// paraphrased from the Limitations section, which is unusually specific about
// which substitutions were tried and did not work.

type Slot = {
  role: string
  model: string
  open: boolean
  job: string
  swap: string
}

const SLOTS: Slot[] = [
  {
    role: "agent / planner",
    model: "Claude Opus 4.8",
    open: false,
    job: "Turns the prompt into a structured specification of regions, terrain, assets, materials and spatial relations — then writes the Blender programs that build them.",
    swap: "\"Current open-source language models often struggled to generate procedural terrain and materials that were both executable and consistent with user requirements.\" Executable is the hard half: the output is a program that either runs in Blender or does not.",
  },
  {
    role: "image generation",
    model: "GPT-Image-2",
    open: false,
    job: "Produces the semantic layout maps that define region boundaries, and the regional composition images that objects are later extracted from.",
    swap: "\"Open-source image generation models frequently failed to produce usable semantic layout maps or to preserve object appearance and pose during object-image generation and extraction.\" Pose preservation is what makes the extracted mesh land in the right orientation.",
  },
  {
    role: "segmentation",
    model: "SAM3",
    open: true,
    job: "Separates individual objects out of the regional composition images so each can become its own mesh.",
    swap: "Not flagged as a failure point in the paper's limitations.",
  },
  {
    role: "2D → 3D lifting",
    model: "SAM3D",
    open: true,
    job: "Recovers 3D structure for the segmented objects.",
    swap: "Not flagged as a failure point in the paper's limitations.",
  },
  {
    role: "3D generation",
    model: "Hunyuan3D",
    open: true,
    job: "Reconstructs editable textured meshes — 2048×2048 PBR maps for large objects, 1024×1024 for small ones.",
    swap: "\"The visual quality of the final scene is also directly bounded by the 3D generation backbone, as low-fidelity geometry and textures noticeably reduce immersion.\"",
  },
  {
    role: "execution",
    model: "Blender 5.1.1",
    open: true,
    job: "Where terrain generation, object placement, scene refinement and rendering actually happen.",
    swap: "\"Blender, whose APIs and complex node-based workflows remain challenging for current language models.\" Material node graphs an artist would build get reduced to simpler approximations.",
  },
]

const CLOSED = "oklch(0.68 0.13 85)"
const OPEN = "oklch(0.60 0.15 255)"

export function ModelStack() {
  const [sel, setSel] = useState(0)
  const s = SLOTS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">six models, one pipeline</span>
        <span className="font-mono text-[10px] text-muted-foreground">4× NVIDIA H20</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {SLOTS.map((x, i) => (
            <button
              key={x.role}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: x.open ? OPEN : CLOSED }}
              />
              <span className="w-28 shrink-0 truncate font-mono text-[10px] text-muted-foreground">{x.role}</span>
              <span className="truncate font-mono text-[11px] text-foreground">{x.model}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: OPEN }} />
            open / self-hostable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CLOSED }} />
            proprietary API
          </span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: s.open ? OPEN : CLOSED }}>
            {s.model} — {s.role}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{s.job}</div>
          <div className="mt-2 border-t pt-2 text-sm leading-6 text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">on replacing it</span>
            <br />
            {s.swap}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Decomposing a hard task into stages is supposed to make each stage easier. The paper reports the opposite
          for the two stages that produce something executable: planning has to emit Blender programs that run, and
          image generation has to emit layouts precise enough to segment. Both are places where a weaker model does
          not degrade gracefully, it fails. That is why the honest version of this system&rsquo;s requirements is
          not &ldquo;an agent&rdquo; but{" "}
          <span className="text-foreground">Claude Opus 4.8 plus GPT-Image-2 plus Hunyuan3D</span>, which the
          authors say outright.
        </p>
      </div>
    </figure>
  )
}
