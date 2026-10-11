"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The five timings on Vivix's W1 page ("Time · Ref-to-Video"): 8-second clip, one
// reference image, 720p (H3 Max 768p), average of 10 runs, submission to completion,
// queue time excluded. Vivix ran them; nobody else has. The real-time factor is
// generation time / clip length. The buffer is what a player would need to bank
// before pressing play so that a session of `session` seconds never stalls, if the
// model kept producing at that rate: session x (factor - 1), zero when factor <= 1.
// That last step is an idealisation (the timings are for whole asynchronous jobs,
// not a stream), and the prose says so.

const ROWS = [
  { label: "Vivix W1", gen: 8.4 },
  { label: "MiniMax H3 Max", gen: 10.8 },
  { label: "Kling 3.0 Omni", gen: 145.9 },
  { label: "Seedance 2.0", gen: 183.5 },
  { label: "Seedance 2.5", gen: 272.4 },
]

const CLIP = 8

function dur(s: number): string {
  if (s < 0.05) return "none"
  if (s < 60) return `${s.toFixed(1)} s`
  if (s < 3600) return `${(s / 60).toFixed(1)} min`
  return `${(s / 3600).toFixed(1)} h`
}

export function RealtimeFactor() {
  const [pick, setPick] = useState(0)
  const [session, setSession] = useState(60)
  const row = ROWS[pick]
  const factor = row.gen / CLIP
  const buffer = Math.max(0, session * (factor - 1))
  const maxGen = ROWS[ROWS.length - 1].gen
  const scale = (v: number) => (v / maxGen) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>real-time factor = generation time ÷ clip length</span>
        <span className="text-muted-foreground/60">8 s clip, 720p, Vivix&apos;s timings</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="space-y-1.5">
          {ROWS.map((r, i) => {
            const f = r.gen / CLIP
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setPick(i)}
                aria-pressed={pick === i}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2 rounded px-1 py-0.5 text-left font-mono text-[11px] sm:grid-cols-[9rem_1fr_5rem]",
                  pick === i ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="truncate">{r.label}</span>
                <span className="relative h-3 rounded-sm bg-muted/40">
                  <span className="absolute inset-y-0 left-0 rounded-sm bg-foreground/35" style={{ width: `${scale(r.gen).toFixed(2)}%` }} />
                  <span
                    className="absolute inset-y-0 w-0.5 bg-orange-500"
                    style={{ left: `${scale(CLIP).toFixed(2)}%` }}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-right tabular-nums">{f.toFixed(2)}x</span>
              </button>
            )
          })}
          <p className="pl-1 font-mono text-[10px] text-muted-foreground/70">
            grey bar: seconds to make the clip · orange tick: the 8 s it plays for
          </p>
        </div>

        <label className="block font-mono text-xs text-muted-foreground">
          session to play without a stall: <span className="text-foreground">{dur(session)}</span>
          <Range min={10} max={600} step={10} value={session} onChange={(e) => setSession(Number(e.target.value))} className="mt-1 w-full" />
        </label>

        <div className="rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
          <div>
            {row.label}: {row.gen} s to make {CLIP} s, a factor of {factor.toFixed(2)}.
          </div>
          <div className="text-muted-foreground">
            {factor <= 1
              ? "Faster than playback: a stream at this rate never has to wait."
              : `To play ${dur(session)} straight through at this rate, a player banks ${dur(buffer)} before pressing play.`}
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        The timings are whole asynchronous jobs, measured by Vivix and averaged over 10 runs with queue time excluded. A stream
        is a different workload; the buffer line only shows what a factor above one means if it held.
      </figcaption>
    </figure>
  )
}
