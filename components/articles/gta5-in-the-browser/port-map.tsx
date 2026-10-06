"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The shape of the port, as its own shipped files describe it (index.html, loader.js,
// io_worker.js, wgpu_worker.js, audio-worklet.js and the wasm import list).
//
// Everything that matters lives in ONE shared wasm64 memory (3 GB at start, 16 GB
// ceiling). The engine's C++ threads never call a browser API that would make them
// yield: they write into rings and tables in that memory and wait on Atomics, and a
// handful of JavaScript workers with normal event loops do the asynchronous work
// (fetch, WebGPU, audio) on their behalf. Pick a box to see what crosses the memory.

const ACCENT = "oklch(0.62 0.15 150)"
const WARM = "oklch(0.70 0.13 70)"
const COOL = "oklch(0.62 0.13 250)"
const MUTED = "oklch(0.62 0.03 250)"

type Key = "page" | "engine" | "gpu" | "io" | "audio"

const NODES: Record<Key, { label: string; sub: string; x: number; y: number; color: string }> = {
  page: { label: "Page", sub: "DOM events, title screen", x: 20, y: 20, color: MUTED },
  engine: { label: "Engine threads", sub: "main() + 75 pthreads", x: 20, y: 150, color: ACCENT },
  gpu: { label: "GPU worker", sub: "owns the WebGPU device", x: 400, y: 20, color: COOL },
  io: { label: "IO worker", sub: "fetch + OPFS block store", x: 400, y: 150, color: WARM },
  audio: { label: "AudioWorklet", sub: "48 kHz stereo out", x: 400, y: 280, color: MUTED },
}

const REGIONS: Record<Key, { name: string; detail: string }> = {
  page: {
    name: "input block",
    detail:
      "256 key bytes, then int32 words for mouse position, deltas, wheel, buttons, focus, pointer lock and a 64-entry text ring. The page writes them with Atomics.store from DOM events; the engine reads them like a keyboard driver would.",
  },
  engine: {
    name: "the C++ heap itself",
    detail:
      "Rockstar's RAGE engine compiled with Emscripten: about 91,000 functions in a 63 MB wasm64 module. Its threads block freely (Atomics.wait), which is exactly what a browser main thread may not do, so main() runs in a worker (loader.js) and the page only owns the canvas.",
  },
  gpu: {
    name: "32 MB command ring",
    detail:
      "The engine still talks Direct3D 11, to a null device that records each call as an opcode plus payload words. The GPU worker drains the ring and replays it on WebGPU with shaders translated offline from DXBC to WGSL. Readbacks and fences wait on a word in the ring.",
  },
  io: {
    name: "read slots + hint ring",
    detail:
      "Each engine thread takes a 16-word slot: file id, offset, destination address, length, state. The IO worker serves it from an append-only store in the Origin Private File System, or fetches the missing 4 KB blocks with HTTP Range requests and copies them straight into the heap. The streamer also posts hints for reads it will make later, so up to 96 fetches run ahead of demand.",
  },
  audio: {
    name: "audio ring",
    detail:
      "The engine's mixer writes interleaved float stereo into a ring; the AudioWorklet copies out 128 frames per callback and plays silence on underrun. It only starts after a click or key press, because browsers do not allow audio before a gesture.",
  },
}

const EDGES: [Key, Key][] = [
  ["page", "engine"],
  ["engine", "gpu"],
  ["engine", "io"],
  ["engine", "audio"],
]

const W = 200
const H = 70

export function PortMap() {
  const [sel, setSel] = useState<Key>("gpu")
  const r = REGIONS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one shared wasm64 memory · 3 GB at start · 16 GB ceiling
        </span>
        <span className="font-mono text-xs text-muted-foreground">pick a box</span>
      </div>
      <div className="px-3 pt-3">
        <svg viewBox="0 0 620 370" className="h-auto w-full" role="img" aria-label="Threads and workers of the GTA V browser port around one shared memory">
          <rect x={250} y={10} width={120} height={350} rx={10} fill="currentColor" opacity={0.06} />
          <text x={310} y={190} textAnchor="middle" fontSize={13} fill="currentColor" opacity={0.7} transform="rotate(-90 310 190)">
            SharedArrayBuffer · Atomics
          </text>
          {EDGES.map(([a, b]) => {
            const A = NODES[a]
            const B = NODES[b]
            const active = sel === a || sel === b
            const x1 = A.x < 250 ? A.x + W : A.x
            const x2 = B.x < 250 ? B.x + W : B.x
            return (
              <line
                key={a + b}
                x1={x1}
                y1={A.y + H / 2}
                x2={x2}
                y2={B.y + H / 2}
                stroke={active ? NODES[sel].color : "currentColor"}
                strokeWidth={active ? 3 : 1.5}
                strokeDasharray={active ? undefined : "4 4"}
                opacity={active ? 0.95 : 0.35}
              />
            )
          })}
          {(Object.keys(NODES) as Key[]).map((k) => {
            const n = NODES[k]
            const on = sel === k
            return (
              <g key={k} onClick={() => setSel(k)} style={{ cursor: "pointer" }}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={W}
                  height={H}
                  rx={10}
                  fill={n.color}
                  fillOpacity={on ? 0.28 : 0.1}
                  stroke={n.color}
                  strokeWidth={on ? 2.5 : 1}
                />
                <text x={n.x + 14} y={n.y + 30} fontSize={15} fontWeight={600} fill="currentColor">
                  {n.label}
                </text>
                <text x={n.x + 14} y={n.y + 52} fontSize={12} fill="currentColor" opacity={0.7}>
                  {n.sub}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {(Object.keys(NODES) as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSel(k)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              sel === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {NODES[k].label}
          </button>
        ))}
      </div>
      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">in shared memory: {r.name}</span>
        <p className="mt-1">{r.detail}</p>
      </figcaption>
    </figure>
  )
}
