"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The deck's 13 scenes as its source defines them: id, title, beat count and the transition it
// enters with (`enterWith`), from the scene objects in the artifact's main script. "Code" is how
// many kilobytes of minified JavaScript sit between the end of the previous scene's definition and
// the end of this one, so a scene's own shaders and helpers count toward it (the opening scene's
// figure excludes the sound synthesizer that sits before it). The technique line is what the code
// and the recording show. The note is the scene's first line of speaker notes, verbatim.

type Scene = { id: string; title: string; beats: number; enter: string; kb: number; tech: string; note: string }

const SCENES: Scene[] = [
  { id: "office", title: "The Future of AI", beats: 3, enter: "fade", kb: 23.3, tech: "Canvas 2D text and a default-looking chart drawn into textures, retyped and restyled glyph by glyph", note: "Hello. This is a talk about the future of AI." },
  { id: "tower", title: "The real chart", beats: 4, enter: "portal-in", kb: 44.1, tech: "METR's points on a paper tower; an analytic sky and cloud deck in GLSL", note: "METR measures how long a task AI can finish on its own, half the time." },
  { id: "boat", title: "Anchor", beats: 3, enter: "fold", kb: 59.0, tech: "A shaded sea with caustics and foam in render targets; the chart's sheet lands on the water and becomes the paper boat", note: "This is how most of us forecast." },
  { id: "loop", title: "The loop", beats: 4, enter: "wash", kb: 34.1, tech: "Flat poster art drawn in fragment shaders: a 26-blade fan, gears at two to one", note: "Start with the plain fact." },
  { id: "swarm", title: "A country of them", beats: 4, enter: "portal-in", kb: 55.4, tech: "Instanced agents over a night terrain; a counter driven by elapsed time", note: "This is one of them, working alone." },
  { id: "dominoes", title: "Thirty steps", beats: 3, enter: "flaps", kb: 52.4, tech: "Instanced city; each domino's fall time from a closed-form geometric schedule, not a physics engine", note: "Here is why people who study this expect it to be sudden." },
  { id: "calendar", title: "2027", beats: 4, enter: "slam", kb: 37.1, tech: "A wall calendar whose day cells are resized by a Hermite spline in log space", note: "This is 2027 on the wall." },
  { id: "lamp", title: "How far you can see", beats: 3, enter: "portal-out", kb: 49.4, tech: "Pools of lantern light on a dark field, then rock arches at sunrise", note: "Forget test scores. Intelligence is how far you can see." },
  { id: "selectall", title: "Select all", beats: 3, enter: "daybreak", kb: 41.9, tech: "A planet from the embedded land mask, the Sun, a shell of panels closing round it", note: "Up to now it has only been editing screens." },
  { id: "aim", title: "Aim", beats: 4, enter: "line", kb: 68.4, tech: "A practice room, a target and an arrow of light, with a scale bar", note: "Everything so far assumed one thing: that it aims where we meant it to." },
  { id: "futures", title: "Two aims", beats: 3, enter: "tear", kb: 78.6, tech: "Two worlds rendered side by side with a divider you can drag", note: "Same bay, same power." },
  { id: "pile", title: "You are here", beats: 2, enter: "portal-in", kb: 9.7, tech: "Every earlier slide on one curved wall; today's date from the viewer's clock", note: "That was the whole talk, on one curve." },
  { id: "questions", title: "Any questions?", beats: 3, enter: "portal-out", kb: 3.1, tech: "The template again, a typed answer, and a one-degree rotation of the whole frame", note: "Any questions?" },
]
const MAX = 78.6

export function SceneBreakdown() {
  const [sel, setSel] = useState("boat")
  const s = SCENES.find((x) => x.id === sel)!
  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3">
        <span className="font-medium">The 13 scenes, as the source defines them</span>
        <span className="block text-muted-foreground">Bar length is each scene&apos;s share of the deck&apos;s own minified code, in KB. Pick a scene for its beats, transition and first speaker note.</span>
      </figcaption>
      <div className="grid gap-1">
        {SCENES.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setSel(x.id)}
            aria-pressed={sel === x.id}
            className={cn("grid grid-cols-[1.5rem_8.5rem_1fr_3.5rem] items-center gap-2 rounded px-1 py-0.5 text-left", sel === x.id ? "bg-foreground/10" : "hover:bg-foreground/5")}
          >
            <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
            <span className="truncate font-mono text-xs">{x.id}</span>
            <span className="h-3 rounded-sm bg-foreground/15">
              <span className={cn("block h-3 rounded-sm", sel === x.id ? "bg-amber-500" : "bg-foreground/60")} style={{ width: `${(x.kb / MAX) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-[11px] text-muted-foreground">{x.kb} KB</span>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-md border border-border bg-background p-3">
        <p className="font-medium">
          {s.title} <span className="font-normal text-muted-foreground">· {s.beats} beats · enters with <code className="font-mono text-[12px]">{s.enter}</code></span>
        </p>
        <p className="mt-1">{s.tech}</p>
        <p className="mt-1 text-muted-foreground">Notes, beat 1: &ldquo;{s.note}&rdquo;</p>
      </div>
    </figure>
  )
}
