"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Visualizes torch.profiler.schedule(wait, warmup, active, repeat) across steps.
// Each prof.step() advances one cell; the schedule decides whether that step is
// skipped (wait), run-but-discarded (warmup), or run-and-recorded (active). Only
// recorded steps land in key_averages() and the exported trace. Toggle presets to
// see the recording window move. Fully deterministic, bounded loop — SSR-safe.

const REC = "oklch(0.64 0.16 150)" // recorded (green)
const WARM = "oklch(0.76 0.15 70)" // warmup (amber)
const WAIT = "oklch(0.62 0.02 260)" // wait / idle (grey)

const MAX_CELLS = 12

type Preset = { label: string; wait: number; warmup: number; active: number; repeat: number; steps: number; note: string }

const PRESETS: Preset[] = [
  {
    label: "wait=1, warmup=1, active=3, repeat=1",
    wait: 1, warmup: 1, active: 3, repeat: 1, steps: 5,
    note: "The post's schedule. Over range(5): step 0 waits, step 1 warms up, steps 2-4 record. That is the 3 calls you see in the table and ProfilerStep#2 as the first recorded step.",
  },
  {
    label: "wait=0, warmup=0, active=3, repeat=1",
    wait: 0, warmup: 0, active: 3, repeat: 1, steps: 3,
    note: "No warmup. Every step records — but the first recorded step pays a cold-start cost (the CPU sits idle a couple hundred microseconds before it issues the first launch). Skipping warmup means that artifact lands in your numbers.",
  },
  {
    label: "wait=1, warmup=1, active=3, repeat=2",
    wait: 1, warmup: 1, active: 3, repeat: 2, steps: 10,
    note: "repeat=2 runs the whole wait/warmup/active cycle twice, giving two separate recording windows in one run — handy for catching step-to-step variance (kernel timings drift with GPU clocks and thermals).",
  },
]

type Phase = "wait" | "warmup" | "active" | "done"

function phaseAt(p: Preset, s: number): Phase {
  const cycle = p.wait + p.warmup + p.active
  if (cycle === 0) return "done"
  if (p.repeat > 0 && s >= p.repeat * cycle) return "done"
  const pos = s % cycle
  if (pos < p.wait) return "wait"
  if (pos < p.wait + p.warmup) return "warmup"
  return "active"
}

const STYLE: Record<Phase, { fill: string; label: string }> = {
  wait: { fill: WAIT, label: "wait" },
  warmup: { fill: WARM, label: "warmup" },
  active: { fill: REC, label: "record" },
  done: { fill: "transparent", label: "" },
}

export function ScheduleStrip() {
  const [pi, setPi] = useState(0)
  const p = PRESETS[pi]

  // Bounded, deterministic: exactly p.steps cells, never more than MAX_CELLS.
  const n = Math.min(p.steps, MAX_CELLS)
  const cells: Phase[] = []
  for (let s = 0; s < n; s++) cells.push(phaseAt(p, s))
  const recorded = cells.filter((c) => c === "active").length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>torch.profiler.schedule · which steps land in the trace</span>
        <span style={{ color: REC }}>{recorded} recorded</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* preset toggle */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((preset, idx) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setPi(idx)}
              aria-pressed={pi === idx}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                pi === idx ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={pi === idx ? { background: REC } : undefined}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* step strip */}
        <div className="flex flex-wrap gap-1.5">
          {cells.map((phase, s) => {
            const st = STYLE[phase]
            const on = phase === "active"
            return (
              <div key={s} className="flex flex-col items-center gap-1">
                <div
                  className="flex h-12 w-16 items-center justify-center rounded-md border font-mono text-[9px] transition-colors"
                  style={{
                    background: st.fill,
                    opacity: phase === "wait" ? 0.35 : phase === "warmup" ? 0.85 : 0.95,
                    color: on || phase === "warmup" ? "oklch(0.2 0 0)" : "var(--muted-foreground)",
                  }}
                >
                  {st.label}
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {on ? `#${s}` : `step ${s}`}
                </span>
              </div>
            )
          })}
        </div>

        {/* mapping to prof.step() */}
        <div className="mt-3 overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">for _ in range({p.steps}):</span>{"  "}step(); prof.step()  <span className="text-muted-foreground/60"># {recorded} step(s) recorded</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{p.note}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: WAIT, opacity: 0.5 }} /> wait — skipped</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: WARM }} /> warmup — run, discarded</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REC }} /> active — recorded</span>
        </div>
      </div>
    </figure>
  )
}
