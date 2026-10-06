"use client"

import { useState, type CSSProperties } from "react"

import { cn } from "@/lib/utils"

// The shape of the port, as its own shipped files describe it (index.html, loader.js,
// io_worker.js, wgpu_worker.js, audio-worklet.js and the wasm import list).
//
// Everything that matters lives in ONE shared wasm64 memory (3 GB at start, 16 GB
// ceiling), drawn here as the slab in the middle. The engine's C++ threads (left) never
// call a browser API that would make them yield: they write into rings and tables in
// that memory and wait on Atomics, and a handful of JavaScript workers with normal event
// loops (right) do the asynchronous work against the browser APIs at the outer edge.
// Each channel is one horizontal lane that crosses the region it shares; packets show
// which way the data moves. Pick a region or a worker to light its lane.
//
// Two geometries, chosen by container width: a four-column one for the article column
// and a compact three-column one (APIs folded into the worker boxes) for phones, so
// the text never renders below ~11px.

type Key = "page" | "gpu" | "io" | "audio" | "engine"

// dir: +1 = engine → outward, -1 = outward → engine
type Channel = {
  worker: string
  wsub: string
  api: string
  region: string
  rsub: string
  rsubShort: string
  color: string
  lanes: number[]
  flow: string
  detail: string
}

const CH: Record<Key, Channel> = {
  page: {
    worker: "Page",
    wsub: "input, title screen",
    api: "DOM",
    region: "input block",
    rsub: "keys · mouse · text ring",
    rsubShort: "keys, mouse, text",
    color: "oklch(0.64 0.15 300)",
    lanes: [-1],
    flow: "DOM → page → input block → engine threads",
    detail:
      "256 key bytes, then int32 words for mouse position, deltas, wheel, buttons, focus, pointer lock and a 64-entry text ring. The page writes them with Atomics.store from DOM events; the engine reads them like a keyboard driver would.",
  },
  gpu: {
    worker: "GPU worker",
    wsub: "owns the device",
    api: "WebGPU",
    region: "32 MB command ring",
    rsub: "opcode + payload words",
    rsubShort: "opcode + payload",
    color: "oklch(0.62 0.14 250)",
    lanes: [1],
    flow: "engine threads → command ring → GPU worker → WebGPU",
    detail:
      "The engine still talks Direct3D 11, to a null device that records each call as an opcode plus payload words. The GPU worker drains the ring and replays it on WebGPU with shaders translated offline from DXBC to WGSL. Readbacks and fences wait on a word in the ring.",
  },
  io: {
    worker: "IO worker",
    wsub: "block store + fetch",
    api: "fetch + OPFS",
    region: "read slots + hint ring",
    rsub: "16-word slot per thread",
    rsubShort: "16-word slots",
    color: "oklch(0.70 0.14 65)",
    lanes: [1, -1],
    flow: "engine threads ⇄ read slots ⇄ IO worker ⇄ fetch + OPFS",
    detail:
      "Each engine thread takes a 16-word slot: file id, offset, destination address, length, state. The IO worker serves it from an append-only store in the Origin Private File System, or fetches the missing 4 KB blocks with HTTP Range requests and copies them straight into the heap. The streamer also posts hints for reads it will make later, so up to 96 fetches run ahead of demand.",
  },
  audio: {
    worker: "AudioWorklet",
    wsub: "128 frames/callback",
    api: "Web Audio",
    region: "audio ring",
    rsub: "interleaved float stereo",
    rsubShort: "float stereo",
    color: "oklch(0.64 0.15 0)",
    lanes: [1],
    flow: "engine threads → audio ring → AudioWorklet → Web Audio",
    detail:
      "The engine's mixer writes interleaved float stereo into a ring; the AudioWorklet copies out 128 frames per callback and plays silence on underrun. It only starts after a click or key press, because browsers do not allow audio before a gesture.",
  },
  engine: {
    worker: "Engine threads",
    wsub: "main() + 75 pthreads",
    api: "none that yields",
    region: "the C++ heap itself",
    rsub: "2,444 MB arena (my run)",
    rsubShort: "2,444 MB arena",
    color: "oklch(0.62 0.15 150)",
    lanes: [1, -1],
    flow: "engine threads ⇄ their own heap (Atomics.wait, never an event loop)",
    detail:
      "Rockstar's RAGE engine compiled with Emscripten: about 91,000 functions in a 63 MB wasm64 module. Its threads block freely (Atomics.wait), which is exactly what a browser main thread may not do, so main() runs in a worker (loader.js) and the page only owns the canvas.",
  },
}

const WORKERS: Exclude<Key, "engine">[] = ["page", "gpu", "io", "audio"]
const ORDER: Key[] = ["engine", "page", "gpu", "io", "audio"]

type Col = { x: number; w: number }
type Geo = {
  id: string
  W: number
  H: number
  compact: boolean
  head: number
  slabTop: number
  eng: Col
  slab: Col
  wk: Col
  api?: Col
  rowY: number[]
  rowH: number
  heapY: number
  heapH: number
  // name: box titles · region: region names · sub: every secondary line · head: column headings
  fs: { name: number; region: number; sub: number; head: number }
  speed: number
}

// Wide: the article column is 720px, so the SVG renders at ~0.93 of its viewBox and the
// 12.5-unit secondary text lands at ~11.6px.
const WIDE: Geo = {
  id: "w",
  W: 760,
  H: 424,
  compact: false,
  head: 16,
  slabTop: 26,
  eng: { x: 4, w: 146 },
  slab: { x: 176, w: 244 },
  wk: { x: 446, w: 170 },
  api: { x: 640, w: 116 },
  rowY: [58, 132, 206, 280],
  rowH: 64,
  heapY: 354,
  heapH: 62,
  fs: { name: 15, region: 14.5, sub: 12.5, head: 12.5 },
  speed: 150,
}

// Compact: a phone's ~340px figure renders this at ~0.96.
const COMPACT: Geo = {
  id: "c",
  W: 340,
  H: 388,
  compact: true,
  head: 14,
  slabTop: 24,
  eng: { x: 1, w: 28 },
  slab: { x: 36, w: 180 },
  wk: { x: 224, w: 115 },
  rowY: [36, 104, 172, 240],
  rowH: 60,
  heapY: 312,
  heapH: 64,
  fs: { name: 13.5, region: 13, sub: 12, head: 12 },
  speed: 90,
}

const FLOW_CSS = `
@keyframes gta-pm-flow {
  0% { transform: translateX(0); opacity: 0; }
  10% { opacity: 1; }
  88% { opacity: 1; }
  100% { transform: translateX(var(--gta-d)); opacity: 0; }
}
.gta-pm-pk { animation: gta-pm-flow var(--gta-t) linear infinite; animation-delay: var(--gta-delay); }
@media (prefers-reduced-motion: reduce) {
  .gta-pm-pk { animation: none; opacity: 0; }
}
`

function Diagram({ g, sel, pick, className }: { g: Geo; sel: Key; pick: (k: Key) => void; className?: string }) {
  const engRight = g.eng.x + g.eng.w
  const laneEnd = g.api ? g.api.x : g.wk.x + g.wk.w
  const bandX = g.slab.x + 10
  const bandW = g.slab.w - 20
  const engTop = g.rowY[0]
  const engBot = g.heapY + g.heapH
  const engOn = sel === "engine"
  const tid = `gta-pm-${g.id}-title`
  const did = `gta-pm-${g.id}-desc`
  const sub = g.fs.sub

  // A channel's lane (or two, one per direction) runs from the engine's edge to the
  // outer edge, under the boxes; packets ride it and show through each region.
  const lanesFor = (k: Key, cy: number, x0: number, x1: number) => {
    const c = CH[k]
    const on = sel === k
    const offs = c.lanes.length === 2 ? [-5, 5] : [0]
    const len = x1 - x0
    const t = len / g.speed
    const n = Math.max(2, Math.round(len / (on ? 70 : 120)))
    return c.lanes.map((dir, li) => {
      const y = cy + offs[li]
      return (
        <g key={`${k}-${li}`}>
          <line
            x1={x0}
            y1={y}
            x2={x1}
            y2={y}
            stroke={on ? c.color : "currentColor"}
            strokeOpacity={on ? 0.75 : 0.16}
            strokeWidth={on ? 1.75 : 1.25}
            strokeDasharray={on ? undefined : "3 4"}
            className="transition-all duration-300"
          />
          {Array.from({ length: n }, (_, i) => (
            <circle
              key={i}
              cx={dir > 0 ? x0 : x1}
              cy={y}
              r={on ? 3.6 : 2.3}
              fill={c.color}
              fillOpacity={on ? 1 : 0.4}
              className="gta-pm-pk"
              style={
                {
                  "--gta-d": `${dir * len}px`,
                  "--gta-t": `${t.toFixed(2)}s`,
                  "--gta-delay": `${(-(t * (i + li / 2)) / n).toFixed(2)}s`,
                } as CSSProperties
              }
            />
          ))}
        </g>
      )
    })
  }

  const box = (x: number, y: number, w: number, h: number, rx: number, color: string, on: boolean, tint: [number, number], stroke?: string) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill="var(--background)" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill={color}
        fillOpacity={on ? tint[1] : tint[0]}
        stroke={on ? color : (stroke ?? color)}
        strokeOpacity={on ? 1 : stroke ? 1 : 0.55}
        strokeWidth={on ? 2 : 1.25}
        className="transition-all duration-300"
      />
    </>
  )

  return (
    <svg
      viewBox={`0 0 ${g.W} ${g.H}`}
      className={cn("h-auto w-full select-none", className)}
      role="img"
      aria-labelledby={`${tid} ${did}`}
    >
      <title id={tid}>The GTA V browser port: engine threads and JavaScript workers around one shared wasm64 memory</title>
      <desc id={did}>
        The engine threads on the left write into regions of one shared memory: an input block, a 32 MB command ring, read slots with a
        hint ring, an audio ring, and the C++ heap. On the right, the page, the GPU worker, the IO worker and the AudioWorklet each use one
        region and are the only users of their browser API: the DOM, WebGPU, fetch with the Origin Private File System, and Web Audio.
        Selected: {CH[sel].flow}.
      </desc>

      {/* column headings */}
      <g className="fill-muted-foreground font-mono" fontSize={g.fs.head}>
        {!g.compact && (
          <text x={g.eng.x + g.eng.w / 2} y={g.head} textAnchor="middle">
            C++ engine
          </text>
        )}
        <text x={g.slab.x + g.slab.w / 2} y={g.head} textAnchor="middle">
          shared wasm64 memory
        </text>
        <text x={g.wk.x + g.wk.w / 2} y={g.head} textAnchor="middle">
          {g.compact ? "JS workers" : "JavaScript workers"}
        </text>
        {g.api && (
          <text x={g.api.x + g.api.w / 2} y={g.head} textAnchor="middle">
            browser APIs
          </text>
        )}
      </g>

      {/* the slab */}
      <rect x={g.slab.x} y={g.slabTop} width={g.slab.w} height={g.H - g.slabTop - 2} rx={12} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.25} />
      {!g.compact && (
        <text x={g.slab.x + g.slab.w / 2} y={g.slabTop + 20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={sub}>
          SharedArrayBuffer · Atomics
        </text>
      )}

      {WORKERS.map((k, i) => (
        <g key={k}>{lanesFor(k, g.rowY[i] + g.rowH / 2, engRight, laneEnd)}</g>
      ))}
      {lanesFor("engine", g.heapY + g.heapH / 2, engRight, bandX)}

      {/* regions: tinted, not opaque, so the packets read as passing through them */}
      {WORKERS.map((k, i) => {
        const c = CH[k]
        const on = sel === k
        const y = g.rowY[i]
        const cy = y + g.rowH / 2
        return (
          <g key={k} onClick={() => pick(k)} className="cursor-pointer">
            <rect
              x={bandX}
              y={y}
              width={bandW}
              height={g.rowH}
              rx={8}
              fill={c.color}
              fillOpacity={on ? 0.2 : 0.08}
              stroke={c.color}
              strokeOpacity={on ? 1 : 0.5}
              strokeWidth={on ? 2 : 1}
              className="transition-all duration-300"
            />
            <text x={bandX + 12} y={cy - (g.compact ? 13 : 14)} className="fill-foreground" fontSize={g.fs.region} fontWeight={600}>
              {c.region}
            </text>
            <text x={bandX + 12} y={cy + (g.compact ? 21 : 23)} className="fill-muted-foreground font-mono" fontSize={sub}>
              {g.compact ? c.rsubShort : c.rsub}
            </text>
          </g>
        )
      })}
      <g onClick={() => pick("engine")} className="cursor-pointer">
        {box(bandX, g.heapY, bandW, g.heapH, 8, CH.engine.color, engOn, [0.08, 0.2])}
        <text x={bandX + 12} y={g.heapY + g.heapH / 2 - 4} className="fill-foreground" fontSize={g.fs.region} fontWeight={600}>
          {CH.engine.region}
        </text>
        <text x={bandX + 12} y={g.heapY + g.heapH / 2 + 15} className="fill-muted-foreground font-mono" fontSize={sub}>
          {g.compact ? CH.engine.rsubShort : CH.engine.rsub}
        </text>
      </g>

      {/* engine: one tall box, a bus every lane leaves from */}
      <g onClick={() => pick("engine")} className="cursor-pointer">
        {box(g.eng.x, engTop, g.eng.w, engBot - engTop, 10, CH.engine.color, engOn, [0.07, 0.18])}
        {g.compact ? (
          <text
            transform={`rotate(-90 ${g.eng.x + g.eng.w / 2} ${(engTop + engBot) / 2})`}
            x={g.eng.x + g.eng.w / 2}
            y={(engTop + engBot) / 2 + 4.5}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={g.fs.name}
            fontWeight={600}
          >
            Engine threads{" "}
            <tspan className="fill-muted-foreground font-mono" fontSize={sub} fontWeight={400}>
              · main() + 75 pthreads
            </tspan>
          </text>
        ) : (
          <>
            <text x={g.eng.x + 14} y={engTop + 28} className="fill-foreground" fontSize={g.fs.name} fontWeight={600}>
              Engine threads
            </text>
            <g className="fill-muted-foreground font-mono" fontSize={sub}>
              <text x={g.eng.x + 14} y={engTop + 48}>
                main()
              </text>
              <text x={g.eng.x + 14} y={engTop + 64}>
                + 75 pthreads
              </text>
            </g>
            {/* thread lanes, each parked on a wait */}
            {Array.from({ length: 6 }, (_, i) => {
              const y = engTop + 98 + i * 22
              const run = 52 + ((i * 37) % 5) * 9
              return (
                <g key={i} stroke={CH.engine.color} strokeLinecap="round">
                  <line x1={g.eng.x + 16} y1={y} x2={g.eng.x + 16 + run} y2={y} strokeWidth={2} strokeOpacity={0.7} />
                  <line x1={g.eng.x + 24 + run} y1={y - 5} x2={g.eng.x + 24 + run} y2={y + 5} strokeWidth={2.2} />
                  <line x1={g.eng.x + 30 + run} y1={y - 5} x2={g.eng.x + 30 + run} y2={y + 5} strokeWidth={2.2} />
                </g>
              )
            })}
            <g className="fill-muted-foreground font-mono" fontSize={sub}>
              <text x={g.eng.x + 14} y={engTop + 250}>
                each blocks in
              </text>
              <text x={g.eng.x + 14} y={engTop + 266}>
                Atomics.wait;
              </text>
              <text x={g.eng.x + 14} y={engTop + 282}>
                none yields
              </text>
              <text x={g.eng.x + 14} y={engBot - 16}>
                63 MB wasm64
              </text>
            </g>
          </>
        )}
      </g>

      {/* workers, and (wide) the browser API each one alone owns */}
      {WORKERS.map((k, i) => {
        const c = CH[k]
        const on = sel === k
        const y = g.rowY[i]
        const cy = y + g.rowH / 2
        return (
          <g key={k} onClick={() => pick(k)} className="cursor-pointer">
            {box(g.wk.x, y, g.wk.w, g.rowH, 9, c.color, on, [0.03, 0.18], "var(--border)")}
            <rect x={g.wk.x + 1} y={y + 12} width={3.5} height={g.rowH - 24} rx={1.75} fill={c.color} />
            <text x={g.wk.x + 14} y={cy - 4} className="fill-foreground" fontSize={g.fs.name} fontWeight={600}>
              {c.worker}
            </text>
            <text x={g.wk.x + 14} y={cy + 15} className="fill-muted-foreground font-mono" fontSize={sub}>
              {g.compact ? c.api : c.wsub}
            </text>
            {g.api && (
              <>
                <rect
                  x={g.api.x}
                  y={cy - 16}
                  width={g.api.w}
                  height={32}
                  rx={16}
                  fill="var(--background)"
                  stroke={on ? c.color : "currentColor"}
                  strokeOpacity={on ? 1 : 0.28}
                  strokeWidth={on ? 1.75 : 1}
                  className="transition-all duration-300"
                />
                <text
                  x={g.api.x + g.api.w / 2}
                  y={cy + 4.5}
                  textAnchor="middle"
                  className={cn("font-mono", on ? "fill-foreground" : "fill-muted-foreground")}
                  fontSize={sub}
                >
                  {c.api}
                </text>
              </>
            )}
          </g>
        )
      })}

      {/* legend, in the room the heap row leaves on the right */}
      <g className="fill-muted-foreground font-mono" fontSize={sub}>
        <circle cx={g.wk.x + 8} cy={g.heapY + 20} r={3.4} fill={CH[sel].color} />
        <text x={g.wk.x + 18} y={g.heapY + 24}>
          {g.compact ? "data moving" : "packets move the way the data does"}
        </text>
        <text x={g.wk.x + 4} y={g.heapY + 46}>
          {g.compact ? "tap any box" : "each worker alone owns its browser API"}
        </text>
      </g>
    </svg>
  )
}

export function PortMap() {
  const [sel, setSel] = useState<Key>("gpu")
  const c = CH[sel]

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <style>{FLOW_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one shared wasm64 memory · 3 GB at start · 16 GB ceiling</span>
        <span className="hidden @min-[560px]:inline">pick a region or a worker</span>
      </div>

      <div className="px-2 pt-3">
        <Diagram g={WIDE} sel={sel} pick={setSel} className="hidden @min-[680px]:block" />
        <Diagram g={COMPACT} sel={sel} pick={setSel} className="mx-auto max-w-[460px] @min-[680px]:hidden" />
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-3" role="group" aria-label="Channel">
        {ORDER.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={sel === k}
            onClick={() => setSel(k)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              sel === k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: CH[k].color }} aria-hidden />
            {CH[k].worker}
          </button>
        ))}
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted-foreground">
          <span className="uppercase tracking-wide">in shared memory:</span>
          <span className="font-semibold text-foreground" style={{ color: c.color }}>
            {c.region}
          </span>
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{c.flow}</div>
        <p className="mt-2">{c.detail}</p>
      </figcaption>
    </figure>
  )
}
