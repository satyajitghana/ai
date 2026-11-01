"use client"

import { useState } from "react"

// Beat arithmetic for the three specs that ship in the skill. Every number is
// derived from `bpm`, `beats` and `fps` as written in each examples/*/spec.js
// (read from the downloaded files). The tempo error is the reader's what-if:
// a generated track that really runs at (1 + e) x the tempo it was asked for.

type Preset = { id: string; label: string; bpm: number; beats: number }

const PRESETS: Preset[] = [
  { id: "starter", label: "starter", bpm: 170, beats: 42 },
  { id: "kaiju", label: "Kaiju Postal", bpm: 172, beats: 68 },
  { id: "just", label: "Just code", bpm: 173.75, beats: 150 },
]
const FPS_OPTS = [24, 30, 60]
const W = 720

export function BeatClock() {
  const [p, setP] = useState(2)
  const [fps, setFps] = useState(60)
  const [errPct, setErrPct] = useState(0.15)

  const { bpm, beats } = PRESETS[p]
  const beatS = 60 / bpm
  const dur = beats * beatS
  const frames = Math.round(dur * fps)
  const beatFrames = beatS * fps
  const quantMs = (0.5 / fps) * 1000
  const lateS = dur * (errPct / 100)
  const lateFrames = lateS * fps

  // last 8 beats of the film: the true grid and the same grid on a track that is slow by errPct
  const tail = 8
  const t0 = dur - tail * beatS
  const x = (t: number) => ((t - t0) / (tail * beatS + 0.3)) * (W - 40) + 20
  const hits = Array.from({ length: tail + 1 }, (_, i) => dur - (tail - i) * beatS)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>beat clock · cuts on a frame grid</span>
        <span className="text-muted-foreground/50">arithmetic from the spec files</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-muted-foreground">spec</span>
            {PRESETS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setP(i)}
                className={`rounded-md border px-2 py-1 ${p === i ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-muted-foreground">fps</span>
            {FPS_OPTS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFps(f)}
                className={`rounded-md border px-2 py-1 ${fps === f ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">track tempo error</span>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.05}
            value={errPct}
            onChange={(e) => setErrPct(Number(e.target.value))}
            className="w-48"
            aria-label="tempo error in percent"
          />
          <span className="w-14">{errPct.toFixed(2)} %</span>
        </label>

        <svg viewBox={`0 0 ${W} 86`} className="w-full" role="img" aria-label="The last eight beats of the film. Solid ticks are the beat grid the picture is cut to; dashed ticks are where the same beats fall on a track whose tempo is off by the chosen percentage.">
          <line x1={20} x2={W - 20} y1={42} y2={42} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
          {hits.map((h, i) => (
            <g key={i}>
              <line x1={x(h)} x2={x(h)} y1={20} y2={42} stroke="currentColor" strokeWidth={2} />
              <line x1={x(h * (1 + errPct / 100))} x2={x(h * (1 + errPct / 100))} y1={44} y2={66} stroke="oklch(0.62 0.2 25)" strokeWidth={2} strokeDasharray="3 3" />
            </g>
          ))}
          <text x={20} y={12} fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            film cut (solid) and a track {errPct.toFixed(2)} % slow (dashed), last 8 beats
          </text>
          <text x={20} y={80} fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            final hit is {(lateS * 1000).toFixed(0)} ms late
          </text>
        </svg>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <Cell k="beat length" v={`${beatS.toFixed(4)} s`} />
          <Cell k={`beat in frames @ ${fps}`} v={beatFrames.toFixed(2)} />
          <Cell k="film" v={`${dur.toFixed(2)} s · ${frames} f`} />
          <Cell k="cut snaps by up to" v={`${quantMs.toFixed(1)} ms`} />
          <Cell k="last hit late by" v={`${(lateS * 1000).toFixed(0)} ms`} />
          <Cell k="in frames" v={lateFrames.toFixed(1)} />
          <Cell k="beats" v={String(beats)} />
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          A beat is never a whole number of frames, so each cut is rounded to the nearest frame. The skill fixes fps at 60 in every example spec, which keeps that rounding under 8.3 ms. The tempo error is the larger risk: the skill says a 0.15 % error puts the last hits of a 50 s film 70 ms late.
        </p>
      </div>
    </figure>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-base">{v}</div>
    </div>
  )
}
