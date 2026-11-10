"use client"

import { useState } from "react"

// Real-time capture versus a virtual clock, for one second of 60 fps video.
// The presets are what I measured on this sandbox's headless Chromium
// (SwiftShader, no GPU) with my own probe and recorder:
//   gearbox at 1440x900, real time: 122.1 and 146.4 ms per frame in two runs
//   gearbox at 960x540, real time: 56 and 61 frames in 5 s in two runs (89 and 82 ms)
//   virtual-clock capture of the gearbox at 960x540: 110 ms per output frame
// A screen recorder at 60 fps can only hold frames the page drew; a virtual
// clock steps time by exactly 1/60 s per frame and waits as long as it takes.

const PRESETS = [
  { label: "laptop GPU (vsync)", ms: 16.7 },
  { label: "gearbox 960x540 (89)", ms: 89 },
  { label: "capture step 960x540 (110)", ms: 110 },
  { label: "gearbox 1440x900 (122)", ms: 122.1 },
]
const W = 720

export function ClockRace() {
  const [ms, setMs] = useState(110)
  const frameMs = 1000 / 60
  // which output slots of a 60 fps screen recording hold a fresh frame
  const fresh = Array.from({ length: 60 }, (_, i) => i === 0 || Math.floor((i * frameMs) / Math.max(ms, frameMs)) !== Math.floor(((i - 1) * frameMs) / Math.max(ms, frameMs)))
  const drawn = fresh.filter(Boolean).length
  const wallVirtual = (60 * ms) / 1000
  // a setTimeout(1000) keeps wall time, so under the virtual clock it fires after 1000/ms frames
  const timerFrame = Math.min(9999, Math.round(1000 / ms))
  const cell = (W - 40) / 60

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one second of 60 fps video · two ways to get it</span>
        <span className="text-muted-foreground/50">presets measured here</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
          <span className="mr-1 text-muted-foreground">cost per frame</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setMs(p.ms)}
              className={`rounded-md border px-2 py-1 ${ms === p.ms ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">or set it</span>
          <input type="range" min={5} max={250} step={0.1} value={ms} onChange={(e) => setMs(Number(e.target.value))} className="w-48" aria-label="milliseconds to render and capture one frame" />
          <span className="w-16">{ms.toFixed(1)} ms</span>
        </label>

        <svg viewBox={`0 0 ${W} 132`} className="w-full" role="img" aria-label={`Sixty output frames. A screen recorder gets ${drawn} new pictures and repeats the rest; the virtual clock gets 60 distinct frames and takes ${wallVirtual.toFixed(1)} seconds of wall time.`}>
          <text x={20} y={14} fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            screen recorder: {drawn} new pictures, {60 - drawn} repeats
          </text>
          {fresh.map((f, i) => (
            <rect key={`a${i}`} x={20 + i * cell} y={20} width={cell - 1.5} height={26} rx={1.5} fill={f ? "oklch(0.6 0.12 240)" : "var(--muted-foreground)"} fillOpacity={f ? 0.85 : 0.15} />
          ))}
          <text x={20} y={68} fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            virtual clock: 60 distinct frames, {wallVirtual.toFixed(1)} s of wall time to make them
          </text>
          {Array.from({ length: 60 }, (_, i) => (
            <rect key={`b${i}`} x={20 + i * cell} y={74} width={cell - 1.5} height={26} rx={1.5} fill="oklch(0.65 0.15 45)" fillOpacity={0.85} />
          ))}
          {timerFrame < 60 && <line x1={20 + timerFrame * cell} x2={20 + timerFrame * cell} y1={70} y2={104} stroke="oklch(0.55 0.2 25)" strokeWidth={2} />}
          <text x={20} y={122} fontSize={10} className="font-mono" fill="oklch(0.55 0.2 25)">
            a setTimeout(…, 1000) fires at frame ~{timerFrame} ({(timerFrame / 60).toFixed(2)} s of video), not frame 60
          </text>
        </svg>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <Cell k="real-time fps" v={(1000 / Math.max(ms, frameMs)).toFixed(1)} />
          <Cell k="recorder repeats" v={`${60 - drawn} / 60`} />
          <Cell k="virtual: wall per 1 s" v={`${wallVirtual.toFixed(1)} s`} />
          <Cell k="timer lands at" v={`${(timerFrame / 60).toFixed(2)} s`} />
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          The virtual clock trades wall time for smoothness: at 110 ms a frame, a 6 s clip took 40 s to record, and every frame in which something moved is its own picture. What it cannot fix is a page that schedules on setTimeout, which keeps real time. I measured that too: a 1 s timer fired at frame 30 of a 320 px capture and at frame 18 of a 1920 px one.
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
