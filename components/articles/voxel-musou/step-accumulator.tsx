"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The whole of voxel-musou's main loop (src/main.js at 5702d90), replayed in
// integer ticks of 1/720 s so every number below is exact:
//
//   acc += Math.min(0.1, Math.max(0, (now - last) / 1000))
//   let n = 0
//   while (acc >= 1 / 60 && n < 4) { step(); acc -= 1 / 60; n++ }
//   if (n === 4) acc = 0
//   render()
//
// 1/60 s = 12 ticks, 0.1 s = 72 ticks, and 720 / rate is an integer for every
// refresh rate offered, so the replay has no floating-point drift at all.
// Nothing here runs the game; it runs the three lines above.

const STEP = 12 // 1/60 s
const CLAMP = 72 // 0.1 s
const CAP = 4 // steps per rAF
const FRAMES = 16
const STALL_AT = 7 // frame index that gets the 250 ms hitch
const STALL = 180 // 250 ms

const RATES = [144, 120, 60, 30, 20, 15, 12, 10]

const ACC = "oklch(0.62 0.14 250)"
const LOST = "oklch(0.6 0.19 27)"

type Frame = { dt: number; clipped: number; steps: number; dropped: number }

function replay(rate: number, stall: boolean, frames: number): Frame[] {
  const dt0 = 720 / rate
  let acc = 0
  const out: Frame[] = []
  for (let i = 0; i < frames; i++) {
    const dt = stall && i === STALL_AT ? STALL : dt0
    const used = Math.min(CLAMP, dt)
    acc += used
    let n = 0
    while (acc >= STEP && n < CAP) {
      acc -= STEP
      n++
    }
    let dropped = 0
    if (n === CAP) {
      dropped = acc
      acc = 0
    }
    out.push({ dt, clipped: dt - used, steps: n, dropped })
  }
  return out
}

const ms = (ticks: number) => {
  const v = (ticks * 1000) / 720
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1)
}

export function StepAccumulator() {
  const [rate, setRate] = useState(60)
  const [stall, setStall] = useState(false)

  const m = useMemo(() => {
    const shown = replay(rate, stall, FRAMES)
    // long-run speed: ten seconds of wall time, no hitch
    const long = replay(rate, false, rate * 10)
    const simLong = long.reduce((a, f) => a + f.steps, 0) * STEP
    const wallLong = long.reduce((a, f) => a + f.dt, 0)
    const wall = shown.reduce((a, f) => a + f.dt, 0)
    const sim = shown.reduce((a, f) => a + f.steps, 0) * STEP
    const zero = shown.filter((f) => f.steps === 0).length
    return { shown, speed: simLong / wallLong, wall, sim, zero }
  }, [rate, stall])

  let note: string
  if (stall) {
    note =
      "The 250 ms hitch is clamped to 100 ms, four steps run, and the remainder is thrown away. The world advances 67 ms across a 250 ms gap: it pauses rather than jumping ahead, and nothing inside the sim ever sees the wall clock."
  } else if (rate > 60) {
    note = `${m.zero} of these ${FRAMES} frames run no sim step at all and redraw the same state: there is no interpolation between steps, so a ${rate} Hz display shows 60 distinct states a second on an uneven cadence.`
  } else if (rate >= 15) {
    note =
      "Each frame runs as many whole steps as fit, up to four. Down to 15 frames a second the sim keeps real time exactly."
  } else {
    note = `The cap fires on every frame and the leftover time is discarded. The sim runs at ${m.speed.toFixed(2)}× real time: below 15 fps the game goes into slow motion instead of catching up.`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">src/main.js · the frame loop</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          replayed exactly · 1 step = 1/60 s · ≤ 4 steps per frame · Δt clamped to 100 ms
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-3">
        <span className="mr-1 font-mono text-[11px] text-muted-foreground">display</span>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            aria-pressed={rate === r}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums transition-colors",
              rate === r ? "text-background" : "text-muted-foreground hover:text-foreground"
            )}
            style={rate === r ? { background: ACC, borderColor: ACC } : undefined}
          >
            {r} Hz
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={stall}
            onChange={(e) => setStall(e.target.checked)}
            className="accent-foreground"
          />
          one 250 ms hitch
        </label>
      </div>

      <div className="px-3 py-4 sm:px-4">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `2.6rem repeat(${FRAMES}, minmax(0, 1fr))` }}
        >
          <span className="self-end font-mono text-[9px] text-muted-foreground">Δt ms</span>
          {m.shown.map((f, i) => (
            <span
              key={`dt${i}`}
              className={cn(
                "text-center font-mono text-[9px] tabular-nums",
                f.clipped ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {ms(f.dt)}
            </span>
          ))}

          <span className="self-center font-mono text-[9px] text-muted-foreground">steps</span>
          {m.shown.map((f, i) => (
            <div key={`st${i}`} className="flex flex-col-reverse gap-0.5" aria-hidden>
              {Array.from({ length: CAP }, (_, k) => (
                <span
                  key={k}
                  className={cn("h-2.5 rounded-[2px] border", k < f.steps ? "" : "border-dashed opacity-40")}
                  style={k < f.steps ? { background: ACC, borderColor: ACC } : undefined}
                />
              ))}
            </div>
          ))}

          <span className="font-mono text-[9px] text-muted-foreground">lost</span>
          {m.shown.map((f, i) => {
            const lost = f.clipped + f.dropped
            return (
              <span
                key={`lo${i}`}
                className="text-center font-mono text-[9px] tabular-nums"
                style={{ color: lost ? LOST : undefined }}
              >
                {lost ? ms(lost) : "·"}
              </span>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            these {FRAMES} frames: wall <span className="text-foreground">{ms(m.wall)} ms</span>
          </span>
          <span>
            sim advanced <span className="text-foreground">{ms(m.sim)} ms</span>
          </span>
          <span>
            long-run sim speed{" "}
            <span className="text-foreground">{m.speed.toFixed(2)}×</span>
          </span>
        </div>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">{note}</p>
    </figure>
  )
}
