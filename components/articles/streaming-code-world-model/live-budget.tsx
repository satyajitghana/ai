"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What "live" would mean at a given render cost per chunk.
//
// - One chunk is 17 frames at 24 fps (rtcwm/model/layout.py CLIP_FRAMES; the
//   release is 24 fps), so it plays for 17/24 = 0.708 s.
// - The proxy of a chunk is complete only once its 17th frame exists, so a chunk
//   can start rendering 16/24 s after its first proxy frame at the earliest.
// - Presets are the README's seconds per chunk on one H200. Those times come
//   from rtcwm/eval/evaluate.py's on_chunk callback, which brackets the
//   transformer work only: the VAE decodes the whole stream after the loop, so
//   decode time is not in them.
// - Model: a game produces proxy in real time and a single GPU renders chunks
//   back to back. Lag of chunk k = when its pixels exist minus when its proxy
//   started.

const CHUNK_S = 17 / 24
const FILL_S = 16 / 24
const PRESETS: [string, number][] = [
  ["35 steps", 47.9],
  ["4-step, CWM teacher", 5.2],
  ["4-step, streaming teacher", 5.1],
  ["real time", Number(CHUNK_S.toFixed(2))],
]

const C_LINE = "oklch(0.62 0.18 25)"
const C_OK = "oklch(0.70 0.15 150)"

function lagAt(render: number, k: number): number {
  // chunk k's proxy starts at k*CHUNK_S and is complete at k*CHUNK_S + FILL_S
  let busy = 0
  let done = 0
  for (let i = 0; i <= k; i++) {
    const ready = i * CHUNK_S + FILL_S
    const start = Math.max(ready, busy)
    done = start + render
    busy = done
  }
  return done - k * CHUNK_S
}

// Two geometries: the wide plot for sm and up, and a narrow one for a phone
// column (~330 px), drawn near 1:1 so both axis labels stay inside and legible.
type Geo = { W: number; H: number; PX0: number; PX1: number; PY0: number; PY1: number; fs: number; narrow: boolean }
const WIDE: Geo = { W: 640, H: 170, PX0: 48, PX1: 620, PY0: 20, PY1: 140, fs: 9, narrow: false }
const NARROW: Geo = { W: 340, H: 190, PX0: 46, PX1: 330, PY0: 24, PY1: 160, fs: 10.5, narrow: true }

export function LiveBudget() {
  const [render, setRender] = useState(5.1)
  const [playS, setPlayS] = useState(60)
  const nChunks = Math.max(1, Math.round(playS / CHUNK_S))
  const lags = Array.from({ length: nChunks }, (_, k) => lagAt(render, k))
  const lagEnd = lags[lags.length - 1]
  const factor = render / CHUNK_S
  const videoPerMin = (60 / render) * CHUNK_S
  const wall = nChunks * render
  const yMax = Math.max(2, lagEnd * 1.1)
  const keepsUp = render <= CHUNK_S + 1e-9

  const plot = (g: Geo) => {
    const { W, H, PX0, PX1, PY0, PY1 } = g
    const px = (k: number) => PX0 + (k / Math.max(1, nChunks - 1)) * (PX1 - PX0)
    const py = (v: number) => PY1 - (v / yMax) * (PY1 - PY0)
    const path = lags.map((v, k) => `${k === 0 ? "M" : "L"} ${px(k).toFixed(1)} ${py(v).toFixed(1)}`).join(" ")
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        className={g.narrow ? "mx-auto block w-full max-w-md sm:hidden" : "hidden w-full max-w-[640px] sm:block"}
      >
        <title>
          {`Lag between a chunk's first proxy frame and its rendered pixels, over ${nChunks} chunks at ${render.toFixed(
            2,
          )} seconds per chunk. The last chunk's lag is ${lagEnd.toFixed(1)} seconds.`}
        </title>
        <line x1={PX0} x2={PX1} y1={PY1} y2={PY1} stroke="currentColor" strokeOpacity={0.3} />
        <line x1={PX0} x2={PX0} y1={PY0} y2={PY1} stroke="currentColor" strokeOpacity={0.3} />
        {[0, 0.5, 1].map((f) => (
          <text
            key={f}
            x={PX0 - 6}
            y={py(f * yMax) + 3}
            textAnchor="end"
            className="fill-current font-mono"
            fontSize={g.fs}
            opacity={0.7}
          >
            {(f * yMax).toFixed(yMax < 10 ? 1 : 0)} s
          </text>
        ))}
        <text x={PX1} y={PY1 + 17} textAnchor="end" className="fill-current font-mono" fontSize={g.fs} opacity={0.7}>
          chunk {nChunks - 1} ({((nChunks - 1) * CHUNK_S).toFixed(0)} s of game time)
        </text>
        <text x={PX0} y={PY1 + 17} className="fill-current font-mono" fontSize={g.fs} opacity={0.7}>
          chunk 0
        </text>
        <path d={path} fill="none" stroke={keepsUp ? C_OK : C_LINE} strokeWidth={2} />
        {g.narrow ? (
          <text x={PX0 + 6} y={PY0 + 2} className="fill-current font-mono" fontSize={g.fs} opacity={0.7}>
            lag, proxy start → pixels
            <tspan x={PX0 + 6} dy={g.fs * 1.3}>
              (decode not included)
            </tspan>
          </text>
        ) : (
          <text x={PX0 + 6} y={PY0 + 2} className="fill-current font-mono" fontSize={g.fs} opacity={0.7}>
            lag, proxy start → pixels (decode not included)
          </text>
        )}
      </svg>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          a game feeding proxy at 24 fps into one GPU, chunk by chunk
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([name, v]) => (
            <button
              key={name}
              type="button"
              onClick={() => setRender(v)}
              aria-pressed={render === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                render === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {name} · {v} s
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-48 text-muted-foreground">render per chunk: {render.toFixed(2)} s</span>
          <Range
            min={0.2}
            max={50}
            step={0.01}
            value={render}
            onChange={(e) => setRender(Number(e.target.value))}
            accent={C_LINE}
            className="min-w-[160px] flex-1"
            aria-label="Render time per chunk in seconds"
          />
        </label>
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className="w-48 text-muted-foreground">game time played: {playS} s</span>
          <Range
            min={5}
            max={120}
            step={1}
            value={playS}
            onChange={(e) => setPlayS(Number(e.target.value))}
            accent={C_LINE}
            className="min-w-[160px] flex-1"
            aria-label="Seconds of game time"
          />
        </label>

        {plot(WIDE)}
        {plot(NARROW)}

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">one chunk plays for:</span> {CHUNK_S.toFixed(3)} s
          </p>
          <p>
            <span className="text-muted-foreground">slower than real time:</span>{" "}
            {factor < 1 ? "no, faster" : `${factor.toFixed(1)}x`}
          </p>
          <p>
            <span className="text-muted-foreground">video per wall-clock minute:</span> {videoPerMin.toFixed(1)} s
          </p>
          <p>
            <span className="text-muted-foreground">wall time for {playS} s of game:</span> {(wall / 60).toFixed(1)} min
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">lag of the last chunk:</span> {lagEnd.toFixed(1)} s
            {keepsUp ? ", flat: the GPU keeps up" : `, growing ${(render - CHUNK_S).toFixed(2)} s per chunk`}
          </p>
        </div>
      </div>
    </figure>
  )
}
