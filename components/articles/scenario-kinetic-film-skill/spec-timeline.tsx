"use client"

import { useState } from "react"

// The scene lists of the three example specs, parsed as text from
// examples/*/spec.js (never executed). [block, startBeat, endBeat].

type Scene = [string, number, number]
type Film = { id: string; label: string; bpm: number; beats: number; scenes: Scene[] }

const FILMS: Film[] = [
  {
    id: "starter",
    label: "starter",
    bpm: 170,
    beats: 42,
    scenes: [["Words", 0, 8], ["Strike", 8, 17], ["Hero", 17, 25], ["Words", 25, 31], ["Logo", 31, 42]],
  },
  {
    id: "kaiju",
    label: "Kaiju Postal",
    bpm: 172,
    beats: 68,
    scenes: [["Words", 0, 8], ["Picture", 8, 16], ["Words", 16, 24], ["Picture", 24, 32], ["Fly", 32, 43], ["Hero", 43, 51], ["Words", 51, 57], ["Logo", 57, 68]],
  },
  {
    id: "just",
    label: "Just code",
    bpm: 173.75,
    beats: 150,
    scenes: [
      ["Words", 0, 9], ["Strike", 9, 19], ["Graph", 19, 25], ["Hero", 25, 33], ["Prompt", 33, 52], ["Stretch", 52, 60], ["Fly", 60, 71],
      ["Words", 71, 77], ["Notes", 77, 93], ["Counters", 93, 104], ["Progress", 104, 113], ["Chain", 113, 125], ["Rewind", 125, 133],
      ["Words", 133, 140], ["Logo", 139, 150],
    ],
  },
]

const SAYS: Record<string, string> = {
  Words: "Sequencer of one-word shots (punch3d, slam, stack, pair, split, cut), each on a beat.",
  Strike: "'No X. No Y.' denials, each with a fake UI behind the word.",
  Graph: "A number that kills an old way of working.",
  Hero: "The name, in extruded 3D type.",
  Prompt: "The brief typed out, ending in the push that becomes the drop.",
  Stretch: "One word stretched by Archivo's width axis.",
  Fly: "The camera flies through 3D type.",
  Notes: "Iteration: notes applied to a preview.",
  Counters: "Counters of lines, frames and pages, taken from the film itself.",
  Progress: "A progress bar that finishes.",
  Chain: "Input to output as linked nodes.",
  Rewind: "Replays the film from the same spec.",
  Picture: "Key art with pushes, pans, weather and cut-ins on words.",
  Logo: "The end card, the only place the film may rest.",
}

const HUES: Record<string, number> = {
  Words: 250, Strike: 20, Graph: 150, Hero: 45, Prompt: 300, Stretch: 190, Fly: 330,
  Notes: 90, Counters: 210, Progress: 120, Chain: 270, Rewind: 0, Picture: 170, Logo: 60,
}

const W = 720

export function SpecTimeline() {
  const [f, setF] = useState(1)
  const [sel, setSel] = useState<number | null>(null)
  const film = FILMS[f]
  const beatS = 60 / film.bpm
  const sx = (b: number) => 8 + (b / film.beats) * (W - 16)
  const s = sel !== null ? film.scenes[sel] : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the three example specs, scene by scene</span>
        <span className="text-muted-foreground/50">parsed from examples/*/spec.js</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
          {FILMS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setF(i)
                setSel(null)
              }}
              className={`rounded-md border px-2 py-1 ${f === i ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} 90`} className="w-full" role="img" aria-label={`Scene bars for ${film.label} on a beat axis.`}>
          {film.scenes.map(([b, a, e], i) => (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
              <rect
                x={sx(a)}
                y={i % 2 === 0 ? 14 : 44}
                width={Math.max(2, sx(e) - sx(a) - 1)}
                height={26}
                rx={3}
                fill={`hsl(${HUES[b] ?? 200} 50% 55%)`}
                opacity={sel === null || sel === i ? 0.9 : 0.35}
                stroke={sel === i ? "currentColor" : "none"}
              />
              {sx(e) - sx(a) > 38 ? (
                <text x={sx(a) + 4} y={(i % 2 === 0 ? 14 : 44) + 17} fontSize={10} className="font-mono" fill="#111">
                  {b}
                </text>
              ) : null}
            </g>
          ))}
          <text x={8} y={84} fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            beat 0
          </text>
          <text x={W - 8} y={84} textAnchor="end" fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            beat {film.beats} · {(film.beats * beatS).toFixed(2)} s
          </text>
        </svg>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {s
            ? `${s[0]}: beats ${s[1]}-${s[2]}, ${((s[2] - s[1]) * beatS).toFixed(2)} s. ${SAYS[s[0]]}`
            : "Click a bar. Each scene is one block class from blocks.js placed between two beats; nothing else is in the timeline."}
        </p>
      </div>
    </figure>
  )
}
